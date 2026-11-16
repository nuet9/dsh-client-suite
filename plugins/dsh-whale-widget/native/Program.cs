using System;
using System.Drawing;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
class Pet : Form {
 readonly WebView2 web=new(); readonly Uri url; readonly string home;
 readonly System.Windows.Forms.Timer topTimer=new(){Interval=2000}; bool reported=false;
 [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h,int n);
 [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 protected override bool ShowWithoutActivation=>true;
 void Pin(){if(IsHandleCreated&&Visible&&(GetWindowLong(Handle,-20)&8)==0)SetWindowPos(Handle,new IntPtr(-1),0,0,0,0,0x13);}
 protected override void OnShown(EventArgs e){base.OnShown(e);Pin();topTimer.Start();}
 public Pet(Uri u,string state){url=u;home=state;FormBorderStyle=FormBorderStyle.None;TopMost=true;ShowInTaskbar=false;StartPosition=FormStartPosition.Manual;Bounds=Screen.PrimaryScreen!.WorkingArea;BackColor=Color.Magenta;TransparencyKey=Color.Magenta;Region=new Region(Rectangle.Empty);Text="余额挂件";
 topTimer.Tick+=(_,_)=>Pin();web.Dock=DockStyle.Fill;web.DefaultBackgroundColor=Color.Transparent;Controls.Add(web);
 Load+=async(_,_)=>{try{var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(home,"webview"));await web.EnsureCoreWebView2Async(env);web.CoreWebView2.Settings.AreDevToolsEnabled=false;web.CoreWebView2.Settings.AreDefaultContextMenusEnabled=false;web.CoreWebView2.Settings.IsStatusBarEnabled=false;
 web.CoreWebView2.NewWindowRequested+=(_,e)=>e.Handled=true;
 web.CoreWebView2.NavigationStarting+=(_,e)=>{if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out var next)||next.GetLeftPart(UriPartial.Authority)!=url.GetLeftPart(UriPartial.Authority))e.Cancel=true;};
 web.CoreWebView2.WebMessageReceived+=(_,e)=>{try{if(!e.Source.StartsWith(url.GetLeftPart(UriPartial.Authority)+"/dsh-whale/desktop"))return;using var doc=JsonDocument.Parse(e.WebMessageAsJson);var d=doc.RootElement;if(d.GetProperty("type").GetString()!="region")return;double sx=ClientSize.Width/d.GetProperty("width").GetDouble(),sy=ClientSize.Height/d.GetProperty("height").GetDouble();var region=new Region();region.MakeEmpty();foreach(var r in d.GetProperty("rects").EnumerateArray()){var a=r.EnumerateArray();a.MoveNext();double x=a.Current.GetDouble();a.MoveNext();double y=a.Current.GetDouble();a.MoveNext();double w=a.Current.GetDouble();a.MoveNext();double h=a.Current.GetDouble();if(w>0&&h>0)region.Union(new Rectangle((int)Math.Floor(x*sx),(int)Math.Floor(y*sy),(int)Math.Ceiling((x+w)*sx)-(int)Math.Floor(x*sx),(int)Math.Ceiling((y+h)*sy)-(int)Math.Floor(y*sy)));}var old=Region;Region=region;old?.Dispose();Pin();if(!reported&&d.GetProperty("ready").GetBoolean()){reported=true;Console.WriteLine("READY");Console.Out.Flush();}}catch{}};
 web.Source=url;
 }catch(Exception ex){File.WriteAllText(Path.Combine(home,"error.txt"),ex.ToString());Close();}};
 FormClosed+=(_,_)=>{topTimer.Dispose();web.Dispose();};
 _=Task.Run(async()=>{while(await Console.In.ReadLineAsync() is string line){if(line=="close"&&IsHandleCreated)BeginInvoke(new Action(Close));}if(IsHandleCreated)BeginInvoke(new Action(Close));});
 }
 [STAThread] static int Main(string[] args){try{if(args.Length>0&&args[0]=="--check"){_=CoreWebView2Environment.GetAvailableBrowserVersionString();return 0;}var raw=Console.ReadLine();var home=Console.ReadLine();if(!Uri.TryCreate(raw,UriKind.Absolute,out var u)||!u.IsLoopback||u.Scheme!="http"||u.AbsolutePath!="/dsh-whale/desktop"||string.IsNullOrEmpty(home))return 2;try{Directory.CreateDirectory(home);}catch(UnauthorizedAccessException){home=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"..","state","desktop"));Directory.CreateDirectory(home);}Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);Application.EnableVisualStyles();Application.Run(new Pet(u,home));return 0;}catch(Exception ex){File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"native-error.txt"),ex.ToString());Console.Error.WriteLine(ex.ToString());return 1;}}
}
