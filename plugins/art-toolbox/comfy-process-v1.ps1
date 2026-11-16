param([ValidateSet('status','start','stop')][string]$Operation='status',[switch]$Force)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$root='__DSH_SUITE_ART_TOOLBOX_COMFY_ROOT__'; $python="$root\venv\Scripts\python.exe"; $main="$root\ComfyUI\main.py"; $lock="$root\ComfyUI\.launcher.lock"; $port=8188
function Norm($s) { if (!$s) { return '' }; return ([string]$s).Replace('/','\').Trim('"').ToLowerInvariant() }
function Tokens($s) { @([regex]::Matches([string]$s,'"([^"]*)"|([^\s"]+)') | ForEach-Object { if ($_.Groups[1].Success) { $_.Groups[1].Value } else { $_.Groups[2].Value } }) }
function ScriptToken($command) {
 $a=Tokens $command
 for ($i=1; $i -lt $a.Count; $i++) {
  if ($a[$i] -in @('-c','-m')) { return '' }
  if ($a[$i] -in @('-X','-W')) { $i++; continue }
  if ($a[$i].StartsWith('-')) { continue }
  return $a[$i]
 }
 return ''
}
function Snapshot {
 $all=@(Get-CimInstance Win32_Process); $owners=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
 $data=$null; if (Test-Path -LiteralPath $lock) { try { $data=Get-Content -LiteralPath $lock -Raw -Encoding UTF8 | ConvertFrom-Json } catch {} }
 $fresh=($null -ne $data -and $data.ts -is [ValueType] -and ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds()-[double]$data.ts) -ge 0 -and ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds()-[double]$data.ts) -lt 300 -and $data.pid -and @($all | Where-Object {$_.ProcessId -eq $data.pid}).Count -gt 0)
 $confirmed=@(); $launchers=@(); $uncertain=@()
 foreach ($p in $all) {
  if ((Norm $p.ExecutablePath) -ne (Norm $python)) { continue }
  $entry=Norm (ScriptToken $p.CommandLine)
  if ($entry -eq (Norm "$root\scripts\launch_comfyui.py")) { $launchers+=$p; continue }
  $absolute=$entry -eq (Norm $main)
  $relative=$entry -eq 'main.py'
  $lockIdentity=($null -ne $data -and $data.ts -is [ValueType] -and [int]$data.pid -eq [int]$p.ProcessId -and $null -ne $p.CreationDate -and [Math]::Abs([double]$data.ts-([DateTimeOffset]$p.CreationDate).ToUnixTimeSeconds()) -lt 30)
  if ($absolute -or ($relative -and $lockIdentity)) { $confirmed+=$p }
  elseif ($relative) { $uncertain+=$p }
 }
 $ids=@($confirmed | ForEach-Object { [int]$_.ProcessId })
 $unknownOwners=@($owners | Where-Object { $_ -notin $ids })
 $unknownLock=($fresh -and $data.pid -and @($all | Where-Object { $_.ProcessId -eq $data.pid }).Count -gt 0 -and $data.pid -notin $ids)
 $state='stopped'; $message=''
 if ($unknownOwners.Count -or $unknownLock -or $uncertain.Count) { $state='conflict'; $message='Unknown port owner, relative main identity, or live launcher lock; refusing mutation' }
 elseif ($ids.Count -or $fresh -or $launchers.Count) { $state='starting' }
 return @{ state=$state; pids=$ids; message=$message; all=$all; confirmed=$confirmed; launchers=$launchers; fresh=$fresh; owners=$owners }
}
function Public($s) { @{state=$s.state;url='http://127.0.0.1:8188';pids=@($s.pids);queueRunning=$null;queuePending=$null;message=$s.message} }
$mutex=New-Object Threading.Mutex($false,'Local\DSH-ComfyUI-Service-v1')
$held=$false
try {
 if ($Operation -ne 'status') { $held=$mutex.WaitOne(0); if (!$held) { @{state='starting';url='http://127.0.0.1:8188';pids=@();queueRunning=$null;queuePending=$null;message='Another service operation is active'} | ConvertTo-Json -Compress; exit } }
 $s=Snapshot
 if ($Operation -eq 'status' -or $s.state -eq 'conflict') { Public $s | ConvertTo-Json -Compress; exit }
 if ($Operation -eq 'start') {
  if ($s.state -ne 'stopped') { Public $s | ConvertTo-Json -Compress; exit }
  if (!(Test-Path -LiteralPath $python) -or !(Test-Path -LiteralPath $main)) { throw 'Fixed ComfyUI python or main.py not found' }
  # Run main directly: no launcher/splash/browser and no delayed launcher resurrection.
  $code=@'
import subprocess,os,json,time,pathlib
r=pathlib.Path('__DSH_SUITE_ART_TOOLBOX_COMFY_ROOT__'); (r/'_dl').mkdir(exist_ok=True); out=(r/'_dl'/'server.log').open('a',encoding='utf-8',errors='replace')
out.write('\n===== DSH service launch =====\n');out.flush()
p=subprocess.Popen([str(r/'venv'/'Scripts'/'python.exe'),'-X','utf8',str(r/'ComfyUI'/'main.py'),'--listen','127.0.0.1','--port','8188','--disable-auto-launch'],cwd=str(r/'ComfyUI'),env={**os.environ,'PYTHONUTF8':'1','PYTHONIOENCODING':'utf-8'},stdin=subprocess.DEVNULL,stdout=out,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW|subprocess.CREATE_NEW_PROCESS_GROUP,close_fds=True)
(r/'ComfyUI'/'.launcher.lock').write_text(json.dumps({'pid':p.pid,'ts':time.time()}),encoding='utf-8')
print(json.dumps({'state':'starting','url':'http://127.0.0.1:8188','pids':[p.pid],'queueRunning':None,'queuePending':None}))
'@
  $out=& $python -X utf8 -c $code
  if ($LASTEXITCODE -ne 0) { throw 'Direct ComfyUI start failed; inspect original server.log' }
  $out; exit
 }
 if ($s.launchers.Count) { throw 'Active original launcher detected; stop refused to prevent restart race (including force)' }
 if ($s.state -eq 'stopped') { Public $s | ConvertTo-Json -Compress; exit }
 if (!$Force) {
  try { $q=Invoke-RestMethod -Uri 'http://127.0.0.1:8188/queue' -TimeoutSec 2; if ($null -eq $q.queue_running -or $null -eq $q.queue_pending -or $q.queue_running -isnot [array] -or $q.queue_pending -isnot [array]) { throw 'Queue unknown' }; if ($q.queue_running.Count -or $q.queue_pending.Count) { throw 'Queue busy' } } catch { throw 'Stop refused: queue busy or unknown; force required' }
 }
 # Revalidate roots and each descendant immediately before stopping; never taskkill /T or all python.
 $tree=@($s.confirmed); $front=@($s.confirmed)
 while ($front.Count) { $parents=@($front | ForEach-Object {$_.ProcessId}); $front=@($s.all | Where-Object {$_.ParentProcessId -in $parents -and $_.ProcessId -notin @($tree | ForEach-Object {$_.ProcessId})}); $tree+=$front }
 [array]::Reverse($tree)
 foreach ($p in $tree) {
  $live=Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ProcessId)" -ErrorAction SilentlyContinue
  if (!$live) { continue }
  if ($live.CreationDate -ne $p.CreationDate -or $live.ParentProcessId -ne $p.ParentProcessId -or $live.ExecutablePath -ne $p.ExecutablePath -or !$live.ExecutablePath) { throw 'Process identity changed or unknown; stop refused' }
  Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
 }
 $after=Snapshot
 if ($after.state -ne 'conflict') {
  $after.state=if ($after.pids.Count) {'error'} else {'stopped'}
  $after.message=if ($after.pids.Count) {'Confirmed processes remain'} else {'Confirmed ComfyUI tree stopped; original lock left untouched'}
 }
 Public $after | ConvertTo-Json -Compress
} catch { @{state='error';url='http://127.0.0.1:8188';pids=@();queueRunning=$null;queuePending=$null;message=$_.Exception.Message} | ConvertTo-Json -Compress } finally { if ($held) {$mutex.ReleaseMutex()}; $mutex.Dispose() }
