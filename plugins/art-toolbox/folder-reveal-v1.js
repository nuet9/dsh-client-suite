import {stat,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const inject=['commands'];
export async function revealFile(raw){
 const p=JSON.parse(raw);
 if(process.platform!=='win32'||typeof p!=='string'||!path.win32.isAbsolute(p)||/[\x00-\x1f"]/.test(p)||/^\\\\/.test(p))throw new Error('需要有效的本地绝对路径');
 await stat(p);
 const runner=path.join(process.env.WINDIR||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const script=fileURLToPath(new URL('./reveal-folder.ps1',import.meta.url));
 const result=await new Promise((resolve,reject)=>{
  const c=spawn(runner,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-TargetPath',p],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';const timer=setTimeout(()=>{c.kill();reject(new Error('打开文件夹超时'));},15000);
  c.stdout.on('data',b=>stdout+=b.toString('utf8'));c.stderr.on('data',b=>stderr+=b.toString('utf8'));
  c.once('error',e=>{clearTimeout(timer);reject(e)});c.once('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error(stderr||'打开系统文件夹失败'));try{resolve(JSON.parse(stdout.trim()))}catch{reject(new Error('打开文件夹未返回有效验证结果'))}});
 });
 await writeFile(new URL('./last-open.json',import.meta.url),JSON.stringify({...result,at:new Date().toISOString()},null,2));
 if(!result.visible)throw new Error('目标文件夹窗口仍不可见');
 return {kind:'success'};
}
