import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {stat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const profilePath=fileURLToPath(new URL('../../.harness-browser-profile/',import.meta.url));
export const loginURL='https://www.pinterest.com/';
const ps=path.join(process.env.WINDIR||'C:/Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
const execFileAsync=promisify(execFile);
export async function processes(){
 if(process.platform!=='win32')throw Error('此专用浏览器入口目前仅支持Windows');
 const script=fileURLToPath(new URL('./browser-process-v1.ps1',import.meta.url));
 const command=(await readFile(script,'utf8')).replace(/^param[^\r\n]*[\r\n]+/, '$ProfilePath=$env:ATB_BROWSER_PROFILE'+String.fromCharCode(10));
 const stdout=await new Promise((resolve,reject)=>execFile(ps,['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:10000,maxBuffer:65536,env:{...process.env,ATB_BROWSER_PROFILE:profilePath}},(e,out,err)=>e?reject(Error(err||e.message)):resolve(out)));
 const value=JSON.parse(String(stdout).trim()||'[]');return Array.isArray(value)?value:[value];
}
export function statusOf(rows){return {mode:rows.some(r=>r.headless)?'background':rows.length?'login':'closed',visible:rows.some(r=>r.visible),processCount:rows.length};}
export function browserLoginService({callBrowser,inspect=processes,launch,canClose=()=>true,forceClose}={}){
 let opening=false;
 const start=launch||async function(){
  const candidates=[path.join(process.env.PROGRAMFILES||'__DSH_SUITE_ART_TOOLBOX_PROGRAM_FILES__','Google','Chrome','Application','chrome.exe'),path.join(process.env['PROGRAMFILES(X86)']||'__DSH_SUITE_ART_TOOLBOX_PROGRAM_FILES__ (x86)','Google','Chrome','Application','chrome.exe')];
  let executable;for(const f of candidates){try{if((await stat(f)).isFile()){executable=f;break;}}catch{}}
  if(!executable)throw Error('未找到Chrome，请检查Harness专用浏览器安装');
  await new Promise((resolve,reject)=>{const child=spawn(executable,['--user-data-dir='+profilePath,'--new-window',loginURL],{shell:false,windowsHide:false,detached:true,stdio:'ignore'});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
 };
 async function closeVisible(){
   if(process.platform!=='win32')throw Error('此专用浏览器入口目前仅支持Windows');
   const before=await inspect();
   if(!before.length)return {...statusOf(before),closed:false,message:'没有专用浏览器进程'};
   const targets=before.filter(r=>r.pid||r.processId);
   if(!targets.length)return {...statusOf(before),closed:false,message:'未找到专用浏览器进程标识'};
   if(forceClose){const result=await forceClose({profilePath,targets});const after=await inspect();if(after.length)throw Error('已执行强制关闭，但仍检测到专用浏览器进程');if(result?.terminated<1)throw Error('没有强制结束任何专用浏览器进程');return {...statusOf(after),closed:true,terminated:result.terminated,message:'专用浏览器进程已强制结束'};}
    const source=fileURLToPath(new URL('./browser-close-v1.ps1',import.meta.url));
   const command=(await readFile(source,'utf8')).replace(/^param[^\r\n]*[\r\n]+/, '$ProfilePath=$env:ATB_BROWSER_PROFILE'+String.fromCharCode(10));
   const {stdout}=await execFileAsync(ps,['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:12000,maxBuffer:65536,env:{...process.env,ATB_BROWSER_PROFILE:profilePath}});
   const result=JSON.parse(String(stdout).trim()||'{}');
   if(result.error)throw Error(result.error);
   const after=await inspect();
   if(after.length)throw Error('已执行强制关闭，但仍检测到专用浏览器进程');
   if(result.terminated<1)throw Error('没有强制结束任何专用浏览器进程');
   return {...statusOf(after),closed:true,terminated:result.terminated||0,message:'专用浏览器进程已强制结束'};
  }
  return {async status(){return statusOf(await inspect());},close:closeVisible,async open(){
  if(opening)throw Error('正在打开专用浏览器，请稍候');opening=true;
  try{
   let rows=await inspect();
   if(rows.some(r=>r.headless)){
    const tabs=await callBrowser('tabs',{action:'list'});
    const text=JSON.stringify(tabs);
    // Only an idle MCP browser may be handed off. Do not close task or user pages.
    const urls=[...text.matchAll(/https?:\/\/[^\s)"\\]+/g)].map(m=>m[0]);
    if(urls.length)throw Error('专用后台浏览器仍有网页打开，请先结束浏览任务并关闭任务标签页，再点击登录');
    await callBrowser('close',{});
    rows=await inspect();
    if(rows.length)throw Error('后台浏览器尚未释放，请稍后再点击；未强制结束进程');
   }
   await start();
   const deadline=Date.now()+7000;
   do {rows=await inspect();if(rows.some(r=>!r.headless&&r.visible))return {...statusOf(rows),opened:true,message:'专用浏览器已打开。请在窗口中登录Pinterest；完成后关闭该专用窗口，再开始搜集。'};await new Promise(r=>setTimeout(r,300));}while(Date.now()<deadline);
   throw Error('已请求打开专用Chrome，但未确认可见窗口。请检查是否已有专用窗口被遮挡；未重复启动。');
  }finally{opening=false;}
 }};
}
