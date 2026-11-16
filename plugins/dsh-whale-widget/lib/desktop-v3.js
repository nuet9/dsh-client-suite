import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
export function installDesktop(ctx, registerRoute, base, home) {
 const file=path.join(home,'.dshw-desktop.json'), exe=path.join(base,'bin','WhalePet.exe');
 let child=null, ready=false, lastError=null, prefs={}, enabled=false, disposed=false, queue=Promise.resolve();
 try {const d=JSON.parse(readFileSync(file,'utf8'));enabled=d.enabled===true;prefs=d.prefs||{};}catch{}
 function cleanPrefs(raw){const out={};for(const k of ['dshw-role','dshw-last-seq','dshw-wait-sound','dshw-snd-once','dshw-auto-bubble'])if(typeof raw?.[k]==='string'&&raw[k].length<8192)out[k]=raw[k];return out;}
 prefs=cleanPrefs(prefs);
 const status=()=>({ok:true,enabled,running:!!child,ready,lastError,prefs});
 const save=()=>writeFileSync(file,JSON.stringify({enabled,prefs}));
 async function stop(){const c=child;if(!c)return;await new Promise(resolve=>{const t=setTimeout(()=>{c.kill();resolve();},2500);c.once('exit',()=>{clearTimeout(t);resolve();});c.stdin.end('close\n');});if(child===c)child=null;ready=false;}
 async function change(value, raw){
  if(raw)prefs={...prefs,...cleanPrefs(raw)};
  if(!value){enabled=false;save();await stop();return status();}
  if(process.platform!=='win32')throw Error('桌面置顶仅支持 Windows');
  if(child&&ready){enabled=true;save();return status();}
  await access(exe);lastError=null;ready=false;
  const c=spawn(exe,[],{cwd:base,windowsHide:true,stdio:['pipe','pipe','pipe']});child=c;
  c.stdin.on('error',()=>{});
  c.once('exit',code=>{if(child===c){child=null;ready=false;if(enabled&&!disposed){enabled=false;lastError=code?'桌面窗口退出（'+code+'）':null;save();}}});
  c.stderr.on('data',()=>{});
  try {
   await new Promise((resolve,reject)=>{let buf='';const t=setTimeout(()=>{reject(Error('桌面窗口初始化超时'));},20000);const fail=e=>{clearTimeout(t);reject(e);};c.once('error',fail);c.once('exit',code=>fail(Error('桌面窗口未就绪（'+code+'）')));c.stdout.on('data',chunk=>{buf+=chunk.toString();if(buf.includes('READY')){clearTimeout(t);resolve();}});
    c.once('spawn',()=>c.stdin.write(ctx.connection.authenticatedUrl(ctx.webServer.getOrigin()+'/dsh-whale/desktop')+'\n'+path.join(home,'whale-desktop')+'\n'));
   });
   if(disposed)throw Error('插件已卸载');ready=true;enabled=true;save();return status();
  }catch(e){lastError=e.message;enabled=false;save();await stop();throw e;}
 }
 function perform(action,raw){if(action==='status')return Promise.resolve(status());if(action==='check')return access(exe).then(async()=>{const {verifyDesktop}=await import('./verify-desktop.js?run='+Date.now());return verifyDesktop(ctx,base);});if(!['enable','disable'].includes(action))throw Error('Unknown action');const task=queue.then(()=>change(action==='enable',raw));queue=task.catch(()=>{});return task;}
 async function body(req){let text='';for await(const part of req){text+=part;if(text.length>65536)throw Error('请求过大');}return JSON.parse(text||'{}');}
 ctx.effect(()=>registerRoute({kind:'exact',path:'/dsh-whale/desktop.json',handler:async(req,res)=>{try{let out;if(req.method==='GET')out=status();else if(req.method==='POST'){const d=await body(req);if(typeof d.enabled!=='boolean')throw Error('enabled 必须为布尔值');out=await perform(d.enabled?'enable':'disable',d.prefs);}else{res.writeHead(405);res.end();return;}res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(out));}catch(e){res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({ok:false,error:e.message}));}}}));
 // The login exchange is owned by Connection; never publish a token to page script.
 ctx.effect(()=>ctx.webServer.register({kind:'exact',path:'/dsh-whale/desktop',handler:async(req,res)=>{const u=new URL(req.url,'http://localhost');const authReq={headers:req.headers,method:req.method,url:'/'+u.search};const authRes={writeHead:(code,headers={})=>res.writeHead(code,headers.location||headers.Location?{...headers,location:'/dsh-whale/desktop'}:headers),end:b=>res.end(b)};if(!ctx.connection.authorizeIndex(authReq,authRes))return;res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end(await readFile(path.join(base,'assets','desktop.html'),'utf8'));}}));
 ctx.inject(['tools'],c=>c.effect(()=>c.tools.register({name:'whale_desktop',description:'Read or change the original balance widget’s desktop pin setting. Enabling moves its display to the desktop; disabling returns it to Harness.',parameters:{type:'object',properties:{action:{type:'string',enum:['status','check','enable','disable']}},required:['action'],additionalProperties:false},output:{schema:{type:'object'},render:(_,v)=>[{type:'text',text:JSON.stringify(v)}]},execute:args=>perform(args.action).then(({prefs,...v})=>v)})));
 ctx.effect(()=>()=>{disposed=true;if(child){child.stdin.end('close\n');child.kill();child=null;}});
 if(enabled)perform('enable').catch(()=>{});
}
