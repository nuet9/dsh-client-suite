param([Parameter(Mandatory=$true)][string]$ProfilePath)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$target=[IO.Path]::GetFullPath($ProfilePath).TrimEnd('\').ToLowerInvariant()
$items=@(Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object {
 $cmd=$_.CommandLine
 if (!$cmd -or $cmd -match '(?:^|\s)--type=') { return $false }
 $match=[regex]::Match($cmd,'--user-data-dir(?:=|\s+)(?:"([^"]+)"|([^\s]+))')
 if (!$match.Success) { return $false }
 $dir=if($match.Groups[1].Success){$match.Groups[1].Value}else{$match.Groups[2].Value}
 try { [IO.Path]::GetFullPath($dir).TrimEnd('\').ToLowerInvariant() -eq $target } catch { $false }
} | ForEach-Object {
 $proc=Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
 [pscustomobject]@{pid=$_.ProcessId;headless=($_.CommandLine -match '(?:^|\s)--headless(?:[=\s]|$)');visible=($null -ne $proc -and $proc.MainWindowHandle -ne 0)}
})
ConvertTo-Json -InputObject $items -Compress
