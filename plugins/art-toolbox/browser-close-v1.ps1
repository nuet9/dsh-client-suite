$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$profile = [IO.Path]::GetFullPath($env:ATB_BROWSER_PROFILE).TrimEnd('\').ToLowerInvariant()
$rows = @(Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object {
    $cmd = $_.CommandLine
    if (!$cmd -or $cmd -match '(?:^|\s)--type=') { return $false }
    if (!$cmd) { return $false }
    $match = [regex]::Match($cmd, '--user-data-dir(?:=|\s+)(?:"([^"]+)"|([^\s]+))')
    if (!$match.Success) { return $false }
    $dir = if ($match.Groups[1].Success) { $match.Groups[1].Value } else { $match.Groups[2].Value }
    try { [IO.Path]::GetFullPath($dir).TrimEnd('\').ToLowerInvariant() -eq $profile } catch { $false }
})
$targets = @($rows | Where-Object { $_.ProcessId -gt 0 } | Select-Object -ExpandProperty ProcessId -Unique)
$terminated = 0
foreach ($processId in $targets) {
    $proc = Get-Process -Id ([int]$processId) -ErrorAction SilentlyContinue
    if ($proc) { Stop-Process -Id ([int]$processId) -Force -ErrorAction Stop; $terminated++ }
}
$deadline = [DateTime]::UtcNow.AddSeconds(5)
do {
    Start-Sleep -Milliseconds 200
    $remaining = @(Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object {
        $cmd = $_.CommandLine
        if (!$cmd -or $cmd -match '(?:^|\s)--type=') { return $false }
        $match = [regex]::Match($cmd, '--user-data-dir(?:=|\s+)(?:"([^"]+)"|([^\s]+))')
        if (!$match.Success) { return $false }
        $dir = if ($match.Groups[1].Success) { $match.Groups[1].Value } else { $match.Groups[2].Value }
        try { [IO.Path]::GetFullPath($dir).TrimEnd('\').ToLowerInvariant() -eq $profile } catch { $false }
    })
} while ($remaining.Count -gt 0 -and [DateTime]::UtcNow -lt $deadline)
if ($remaining.Count -gt 0) { throw 'Dedicated Chrome processes remain after force termination' }
[pscustomobject]@{ terminated = $terminated } | ConvertTo-Json -Compress
