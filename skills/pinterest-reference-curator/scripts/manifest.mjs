import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export function pinURL(value) {
  const u=new URL(value);
  if(u.protocol!=='https:' || !/(^|\.)pinterest\.(com|co\.uk|ca|fr|de|jp|com\.au)$/.test(u.hostname)) throw Error('Expected a Pinterest HTTPS Pin URL');
  const m=u.pathname.match(/^\/pin\/(\d+)\/?$/);
  if(!m) throw Error('Expected /pin/<numeric-id>/');
  return 'https://www.pinterest.com/pin/'+m[1]+'/';
}
export function validate(m) {
  const errors=[], seen=new Set(), images=new Set();
  if(!Number.isInteger(m.target)||m.target<1) errors.push('target must be a positive integer');
  if(typeof m.topic!=='string'||!m.topic.trim()) errors.push('topic is required');
  if(!Array.isArray(m.items)) return {errors:[...errors,'items must be an array'],selected:0,verified:0};
  for(const [i,item] of m.items.entries()) {
    const label='item '+(i+1); let pin='';
    try {pin=pinURL(item.pin_url); if(seen.has(pin)) errors.push(label+': duplicate Pin'); seen.add(pin);} catch(e) {errors.push(label+': '+e.message);}
    for(const k of ['name','category','reason','source_type']) if(typeof item[k]!=='string'||!item[k].trim()) errors.push(label+': missing '+k);
    if(item.image_url) {try {const u=new URL(item.image_url); if(u.protocol!=='https:') throw Error(); const image=u.origin+u.pathname; if(images.has(image)) errors.push(label+': duplicate image URL'); images.add(image);} catch {errors.push(label+': invalid image_url');}}
    if(!['pending','unverified','verified'].includes(item.save_status)) errors.push(label+': invalid save_status');
    if(item.save_status==='verified' && (!m.board_url || typeof item.save_evidence!=='string'||!item.save_evidence.trim())) errors.push(label+': verified requires board_url and save_evidence');
  }
  return {errors,selected:m.items.length,verified:m.items.filter(x=>x.save_status==='verified').length,target:m.target};
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function main(args) {
  const [cmd,file,topic,target='50']=args;
  if(cmd==='init') {
    if(!file||!topic) throw Error('init <directory> <topic> [target]');
    const n=Number(target); if(!Number.isInteger(n)||n<1) throw Error('target must be positive integer');
    await fs.mkdir(file,{recursive:true});
    const dest=path.join(file,'manifest.json');
    await fs.writeFile(dest,JSON.stringify({version:1,topic,target:n,board_url:null,items:[]},null,2)+'\n',{flag:'wx'});
    console.log(dest); return;
  }
  if(!['check','export'].includes(cmd)||!file) throw Error('Use init, check or export');
  const m=JSON.parse(await fs.readFile(file,'utf8')); const result=validate(m);
  if(result.errors.length) throw Error(result.errors.join('\n'));
  if(cmd==='export') {
    const cards=m.items.map((x,i)=>'<article><h2>'+esc(x.name)+'</h2><p>'+esc(x.category)+' · '+esc(x.source_type)+' · '+esc(x.save_status)+'</p><p>'+esc(x.reason)+'</p><a href="'+esc(pinURL(x.pin_url))+'">Pinterest Pin '+(i+1)+'</a>'+(x.image_url?'<p><a href="'+esc(x.image_url)+'">图片链接</a></p>':'')+'</article>').join('\n');
    const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>'+esc(m.topic)+'</title><style>body{max-width:1000px;margin:32px auto;padding:16px;font:16px/1.6 system-ui}article{border:1px solid #ccc;border-radius:12px;padding:16px;margin:16px 0}h2{font-size:20px}</style><h1>'+esc(m.topic)+'</h1><p>入选 '+result.selected+' / 目标 '+result.target+'；Pinterest已验证保存 '+result.verified+'。本文件是参考索引，不是Pinterest图版。</p>'+cards+'</html>';
    await fs.writeFile(path.join(path.dirname(file),'参考索引.html'),html);
  }
  console.log(JSON.stringify(result));
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1});
