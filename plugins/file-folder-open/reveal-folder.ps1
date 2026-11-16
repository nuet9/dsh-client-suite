param([Parameter(Mandatory=$true)][string]$TargetPath)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$taskItem=Get-Item -LiteralPath $TargetPath
$taskFolder=if($taskItem.PSIsContainer){$taskItem.FullName}else{$taskItem.DirectoryName}
Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class RevealFolderV3{[DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int n);[DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();}'
$taskShell=New-Object -ComObject Shell.Application
function Get-TargetFolderWindow {
 @($taskShell.Windows()) | Where-Object {try {$_.FullName -like '*explorer.exe' -and $_.Document.Folder.Self.Path.TrimEnd('\') -ieq $taskFolder.TrimEnd('\')}catch{$false}} | Sort-Object @{Expression={[RevealFolderV3]::IsWindowVisible([intptr]$_.HWND)};Descending=$true} | Select-Object -First 1
}
$taskWindow=Get-TargetFolderWindow
if(-not $taskWindow){$taskShell.Open($taskFolder)}
for($taskTry=0;$taskTry -lt 30 -and -not $taskWindow;$taskTry++){Start-Sleep -Milliseconds 150;$taskWindow=Get-TargetFolderWindow}
if(-not $taskWindow){throw 'Explorer did not register the requested folder window'}
$taskHwnd=[intptr]$taskWindow.HWND
# Explicitly show even if the launching process inherited a hidden startup state.
for($taskTry=0;$taskTry -lt 3;$taskTry++){[void][RevealFolderV3]::ShowWindowAsync($taskHwnd,9);[void][RevealFolderV3]::SetForegroundWindow($taskHwnd);Start-Sleep -Milliseconds 400}
if(-not [RevealFolderV3]::IsWindowVisible($taskHwnd)){throw 'Explorer folder window is still hidden'}
[pscustomobject]@{version='3';folder=$taskFolder;hwnd=$taskWindow.HWND;visible=$true;foreground=([RevealFolderV3]::GetForegroundWindow() -eq $taskHwnd)} | ConvertTo-Json -Compress
