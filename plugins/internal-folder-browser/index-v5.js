import {Service} from 'file:///__DSH_SUITE_INTERNAL_FOLDER_BROWSER_HARNESS_RUNTIME_ROOT__/node_modules/@deepseek-ai/cordis/lib/index.js';
import {readdir,lstat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const run=promisify(execFile),cache=new Map();
async function enrichIcons(rows){
 if(process.platform!=='win32')return;
 const requests=new Map();
 for(const e of rows){
  const ext=path.extname(e.name).toLowerCase();
  const thumbnail=e.type==='file'&&/\.(png|jpe?g|bmp|gif|tiff?)$/i.test(e.name)&&e.size<16777216;
  e.iconKey=thumbnail?'thumb:'+createHash('sha1').update(e.path+e.modified).digest('hex'):e.type==='directory'?'folder':'ext:'+ext;
  if(!cache.has(e.iconKey)&&requests.size<120)requests.set(e.iconKey,{key:e.iconKey,path:e.path,directory:e.type==='directory',thumbnail});
 }
 if(requests.size){
  try{const input=Buffer.from(JSON.stringify([...requests.values()])).toString('base64');const {stdout}=await run(path.join(process.env.WINDIR||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./file-icons.ps1',import.meta.url)),'-InputBase64',input],{windowsHide:true,shell:false,timeout:20000,maxBuffer:4194304});const result=JSON.parse(stdout.replace(/^\uFEFF/,''));for(const [key,value]of Object.entries(result))if(typeof value==='string'&&value.startsWith('data:image/png;base64,'))cache.set(key,value);}catch(error){console.warn('Folder icons unavailable:',error.message);}
 }
 for(const e of rows){e.icon=cache.get(e.iconKey)||null;delete e.iconKey;}
 if(cache.size>512)for(const key of [...cache.keys()].slice(0,cache.size-512))cache.delete(key);
}
export const inject=['typert','typertGateway','sessions','workingDirectory'];
export class FolderBrowser extends Service {
 constructor(ctx){super(ctx,'localFolderBrowser',true);this.typertRemote={service:this,serviceKey:'localFolderBrowser',namespace:'localFolderBrowser'};}
 async list(folder,sessionId){
  if(typeof folder!=='string'||!folder||/[\x00-\x1f]/.test(folder))throw new Error('需要本地绝对文件夹路径');
  if(!path.isAbsolute(folder)){const session=typeof sessionId==='string'&&this.ctx.sessions.get(sessionId);if(!session)throw new Error('相对文件夹路径需要已加载的所属会话');folder=path.resolve(this.ctx.workingDirectory.get(session),folder);}
   const entries=await readdir(folder,{withFileTypes:true});const rows=await Promise.all(entries.slice(0,2000).map(async e=>{let size=null,modified=null;try{let s=await lstat(path.join(folder,e.name));size=s.size;modified=s.mtime.toISOString();}catch{}return {name:e.name,path:path.join(folder,e.name),type:e.isDirectory()?'directory':'file',size,modified};}));
  await enrichIcons(rows);
  rows.sort((a,b)=>(b.type==='directory')-(a.type==='directory')||a.name.localeCompare(b.name));return {path:folder,parent:path.dirname(folder),entries:rows,truncated:entries.length>2000};
 }
}
export function apply(ctx){
 ctx.plugin(FolderBrowser);
 ctx.effect(()=>ctx.typert.register({package:'@local/internal-folder-browser',face:'host',schemas:[],model:{services:[],events:[],objects:[]},invocations:[{id:'@local/internal-folder-browser:list',service:'localFolderBrowser',namespace:'localFolderBrowser',method:'list',invocation:{kind:'direct'},parameters:[{name:'folder',wire:'folder',source:'json',codec:{mode:'src-json'}},{name:'sessionId',wire:'sessionId',source:'json',optional:true,codec:{mode:'src-json'}}],result:{mode:'src-json'}}]}));
}
