param([string]$InputBase64)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class FolderIconNative {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct Info { public IntPtr hIcon; public int iIcon; public uint attributes; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string displayName; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=80)] public string typeName; }
 [DllImport("shell32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SHGetFileInfo(string path,uint attrs,out Info info,uint cb,uint flags);
 [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr hIcon);
}
'@
$items=ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($InputBase64)))
$results=@{}
foreach($item in $items){
 $stream=New-Object IO.MemoryStream
 $bitmap=$null
 try{
  if($item.thumbnail){
   $image=[Drawing.Image]::FromFile($item.path)
   try {
    $bitmap=New-Object Drawing.Bitmap 192,192
    $graphics=[Drawing.Graphics]::FromImage($bitmap)
    try{$graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;$ratio=[Math]::Min(192.0/$image.Width,192.0/$image.Height);$w=[Math]::Max(1,[int]($image.Width*$ratio));$h=[Math]::Max(1,[int]($image.Height*$ratio));$graphics.DrawImage($image,[int]((192-$w)/2),[int]((192-$h)/2),$w,$h)}finally{$graphics.Dispose()}
   }finally{$image.Dispose()}
  }else{
   $info=New-Object FolderIconNative+Info
   $attrs=128;if($item.directory){$attrs=16}
   $null=[FolderIconNative]::SHGetFileInfo($item.path,$attrs,[ref]$info,[Runtime.InteropServices.Marshal]::SizeOf($info),272)
   if($info.hIcon -eq [IntPtr]::Zero){continue}
   try{$icon=[Drawing.Icon]::FromHandle($info.hIcon);$bitmap=$icon.ToBitmap()}finally{$null=[FolderIconNative]::DestroyIcon($info.hIcon)}
  }
  $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
  $results[$item.key]='data:image/png;base64,'+[Convert]::ToBase64String($stream.ToArray())
 }catch{}finally{if($bitmap){$bitmap.Dispose()};$stream.Dispose()}
}
ConvertTo-Json -InputObject $results -Compress
