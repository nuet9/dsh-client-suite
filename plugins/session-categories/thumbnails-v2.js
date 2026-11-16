import {stat,readFile,mkdir,writeFile,readdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const KEY='local.session-categories.latest-image.v1';
const MAX_BYTES=32*1024*1024, MAX_PIXELS=40_000_000, MAX_CANDIDATES=16;
const CACHE_ROOT=fileURLToPath(new URL('./.thumbnail-cache/',import.meta.url));
const badTool=/read.?image|modlens|screenshot|screen.?capture|browser|desktop|inspect|image.?search/i;
const imageExt=/\.(png|jpe?g|webp|gif|avif|bmp)$/i;
const timeOf=v=>typeof v==='number'&&Number.isFinite(v)?v:Date.parse(v)||0;
const hash=s=>createHash('sha256').update(s).digest('hex');
export function localImagePath(raw,cwd){
 if(typeof raw!=='string'||raw.length>4096||/[\x00-\x1f]/.test(raw))return null;
 let s=raw.trim();try{s=decodeURIComponent(s);}catch{return null;}
 if(/^file:\/\//i.test(s)){try{s=fileURLToPath(s);}catch{return null;}}
 s=s.replace(/^\/([a-z]:[\\/])/i,'$1');
 if(/^[a-z]+:/i.test(s)&&! /^[a-z]:[\\/]/i.test(s))return null;
 if(s.startsWith('\\\\')||s.startsWith('//'))return null; // never network shares
 if(!imageExt.test(s))return null;
 if(!path.isAbsolute(s)){if(!cwd)return null;s=path.resolve(cwd,s);}
 return s;
}
function validRef(r){return r&&typeof r.attachmentId==='string'&&/^image\/(png|jpeg|webp|gif)$/.test(r.mediaType)&&Number.isSafeInteger(r.bytes)&&r.bytes>0&&r.bytes<=MAX_BYTES&&Number.isSafeInteger(r.width)&&r.width>0&&Number.isSafeInteger(r.height)&&r.height>0&&r.width*r.height<=MAX_PIXELS;}
function refCopy(r){return {attachmentId:r.attachmentId,mediaType:r.mediaType,bytes:r.bytes,width:r.width,height:r.height,...(typeof r.name==='string'?{name:r.name}:{})};}
function candidatePath(raw,state,event,source){const file=localImagePath(raw,state.cwd);return file?{kind:'path',path:file,seq:event.seq,time:event.time,source}:null;}
function structuredOutputs(value,state,event,out,depth=0){
 if(!value||typeof value!=='object'||depth>3)return;
 if(value.status&& !['completed','succeeded','success','recorded','done'].includes(value.status))return;
 if(value.imageRef&&validRef(value.imageRef))out.push({kind:'attachment',attachment:refCopy(value.imageRef),seq:event.seq,time:event.time,source:'generated-result'});
 for(const key of ['previewFile','generatedImage','outputImage','image_path','imagePath']){const c=candidatePath(value[key],state,event,'generated-result');if(c)out.push(c);}
 if(value.status==='completed'&&Array.isArray(value.files))for(const f of value.files.slice(0,20)){if(typeof f==='string'){const c=candidatePath(f,state,event,'generated-file');if(c)out.push(c);}else structuredOutputs(f,state,event,out,depth+1);}
 // Explicit output containers only; do not walk arguments, reference images, or arbitrary JSON.
 for(const key of ['result','value','output','data'])if(value[key]&&typeof value[key]==='object')structuredOutputs(value[key],state,event,out,depth+1);
}
export function initialImageState(header){return {cwd:header.cwd||'',calls:{},userImages:[],candidates:[]};}
export function foldImageEvent(state,event){
 const d=event.data||{};
 if(event.type==='user/message'){const ids=(d.content||[]).filter(b=>b.type==='image'&&b.attachment?.attachmentId).map(b=>b.attachment.attachmentId);return ids.length?{...state,userImages:[...new Set([...state.userImages,...ids])].slice(-512),candidates:state.candidates.filter(c=>c.kind!=='attachment'||!ids.includes(c.attachment.attachmentId))}:state;}
 if(event.type==='tool/call'){
  const entries=Object.entries(state.calls).slice(-127);return {...state,calls:{...Object.fromEntries(entries),[d.callId]:String(d.name||'')+(/read_image|screenshot|windows_desktop|google_chrome/i.test(d.arguments||'')?' read_image':'')}};
 }
 if(!['assistant/message','tool/result'].includes(event.type))return state;
 const message=d.message;if(!message||message.isError||d.error||!Array.isArray(message.content))return state;
 const tool=event.type==='tool/result';const toolName=state.calls[message.toolCallId||message.source?.callId]||'';
 if(tool&&badTool.test(toolName))return state;
 const found=[];
 for(const block of message.content){
  if(block.type==='image'&&validRef(block.attachment))found.push({kind:'attachment',attachment:refCopy(block.attachment),seq:event.seq,time:event.time,source:tool?'tool-image':'assistant-image'});
  if(block.type!=='text'||typeof block.text!=='string'||block.text.length>2_000_000)continue;
  if(!tool){const text=block.text.replace(/\x60\x60\x60[\s\S]*?\x60\x60\x60/g,'');const re=/!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\s*\)/g;let m;while((m=re.exec(text))){const c=candidatePath(m[1]||m[2],state,event,'assistant-markdown');if(c)found.push(c);}}
  else if(block.text.length<1_000_000){try{structuredOutputs(JSON.parse(block.text),state,event,found);}catch{}}
 }
 if(!found.length)return state;
 const ids=new Set();const candidates=[...found.reverse(),...state.candidates].filter(c=>{if(c.kind==='attachment'&&state.userImages.includes(c.attachment.attachmentId))return false;const id=c.kind==='path'?c.path:c.attachment.attachmentId;if(ids.has(id))return false;ids.add(id);return true;}).slice(0,MAX_CANDIDATES);
 return {...state,candidates};
}
export async function createThumbnailRepository(ctx,z,options={}){
 const definition={key:KEY,stateVersion:1,stateSchema:z.object({cwd:z.string(),calls:z.record(z.string(),z.string()),userImages:z.array(z.string()),candidates:z.array(z.unknown())}),init:initialImageState,apply:foldImageEvent};
 const handle=await ctx.sessionProjections.register(definition);
 const domain=await ctx.storageDomain.open({name:'session_category_thumbnail_cache',version:1,tables:{sessions:{valueSchema:z.object({body:z.string()})}}});
 const table=domain.table('sessions');const pending=new Map(),images=new Map(),bridges=new Map(),results=new Map(),refreshed=new Map();let disposed=false,scanNeeded=true,sharpPromise,tail=Promise.resolve();const counters={queued:0,completed:0,failures:0,logReads:0,events:0,liveReads:0,statReads:0,stateErrors:0,lastError:null};
 const cacheRoot=options.cacheRoot||CACHE_ROOT;
 const sharp=()=>sharpPromise??=options.sharp?Promise.resolve(options.sharp):import('sharp').then(m=>m.default);
 function collectBridge(){if(!scanNeeded)return;scanNeeded=false;bridges.clear();
  function keep(id,c){if(typeof id!=='string'||!id||!c)return;const old=bridges.get(id)||[];bridges.set(id,[...old,c].sort((a,b)=>b.time-a.time).slice(0,MAX_CANDIDATES));}
  const media=ctx.storageDomain.get('drock_media');if(media)for(const [,job]of media.table('jobs').entries())if(job.status==='completed'&&job.kind!=='video')for(const f of job.files||[]){const time=timeOf(job.completedAt||job.updatedAt||job.createdAt);if(validRef(f.imageRef))keep(job.sessionId,{kind:'attachment',attachment:refCopy(f.imageRef),time,seq:-1,source:'drock-media'});else{const file=localImagePath(f.path);if(file)keep(job.sessionId,{kind:'path',path:file,time,seq:-1,source:'drock-media'});}}
  const art=ctx.storageDomain.get('art_toolbox_repository');if(art)for(const [,row]of art.table('entries').entries()){try{const e=JSON.parse(row.body);if(e.archived||!['completed','recorded'].includes(e.status))continue;const file=localImagePath(e.previewFile);if(file)keep(e.sessionId,{kind:'path',path:file,time:timeOf(e.updatedAt||e.createdAt),seq:-1,source:'art-toolbox'});}catch{}}
 }
 const unlisten=ctx.on('domain/changed',change=>{if(['drock_media','art_toolbox_repository'].includes(change.domain))scanNeeded=true;});
 async function stateFor(id,signal){
  const live=ctx.sessions?.get(id);if(live){counters.liveReads++;return handle.stateOf(live);}
  counters.statReads++;const snapshot=await ctx.sessionPersistence.stat(id,{signal});if(!snapshot||snapshot.formatStatus==='migration-required')return null;
  const identity=JSON.stringify(snapshot.header);let row;try{row=JSON.parse(table.get(id)?.body||'null');}catch{}
  if(row?.identity!==identity||row?.version!==1)row=null;
  if(row?.revision===snapshot.revision)return row.state;
  const log=await ctx.sessionPersistence.open(id,'read',{signal});
  try{
   let state=row?.state||initialImageState(log.header),offset=row?row.seq+1:0;
   // A shrunken stored log invalidates our derived checkpoint.
   if(snapshot.eventCount!==undefined&&snapshot.eventCount<offset){state=initialImageState(log.header);offset=0;}
   let seq=offset-1;const limit=snapshot.eventCount;
   for(;;){if(signal?.aborted)throw signal.reason;counters.logReads++;const result=await log.read(offset,Math.min(512,limit===undefined?512:Math.max(0,limit-offset)),{signal});if(!result.events.length)break;
    for(const event of result.events){counters.events++;state=foldImageEvent(state,event);seq=event.seq;}offset=seq+1;if(result.events.length<512||limit!==undefined&&offset>=limit)break;
   }
   await table.put(id,{body:JSON.stringify({version:1,identity,revision:snapshot.revision,seq,state})});return state;
  }finally{await log.close();}
 }
 async function cleanupDisk(){const files=(await readdir(cacheRoot,{withFileTypes:true})).filter(e=>e.isFile()&&/^[a-f0-9]{64}\.jpg$/.test(e.name));if(files.length<=256)return;const dated=await Promise.all(files.map(async e=>({file:path.join(cacheRoot,e.name),time:(await stat(path.join(cacheRoot,e.name))).mtimeMs})));dated.sort((a,b)=>b.time-a.time);await Promise.all(dated.slice(256).map(e=>unlink(e.file).catch(()=>{})));}
 async function render(candidate,signal){
  let key,bytes;
  if(candidate.kind==='attachment'){const r=candidate.attachment;key=hash(r.attachmentId+':thumb-v1');const old=images.get(key);if(old)return {src:old,version:key};bytes=Buffer.from((await ctx.attachments.readImage(r,signal)).data);}
  else{const s=await stat(candidate.path);if(!s.isFile()||s.size<=0||s.size>MAX_BYTES)return null;key=hash(candidate.path+'\0'+s.mtimeMs+'\0'+s.size+':thumb-v1');const old=images.get(key);if(old)return {src:old,version:key};}
  const file=path.join(cacheRoot,key+'.jpg');let jpeg;
  try{jpeg=await readFile(file);if(jpeg.length>40*1024)throw Error('Invalid thumbnail');}catch{
   if(!bytes)bytes=await readFile(candidate.path);if(bytes.length>MAX_BYTES)return null;
   const decoder=await sharp();jpeg=await decoder(bytes,{failOn:'error',limitInputPixels:MAX_PIXELS,animated:false}).rotate().resize(360,240,{fit:'inside',withoutEnlargement:true}).flatten({background:'#eeeeee'}).jpeg({quality:72}).toBuffer();
   if(jpeg.length>40*1024)jpeg=await decoder(jpeg).resize(280,190,{fit:'inside'}).jpeg({quality:55}).toBuffer();if(jpeg.length>40*1024)return null;await mkdir(cacheRoot,{recursive:true});await writeFile(file,jpeg);await cleanupDisk();
  }
  const src='data:image/jpeg;base64,'+jpeg.toString('base64');images.set(key,src);if(images.size>128)images.delete(images.keys().next().value);return {src,version:key};
 }
 async function getInternal(id,signal){
  if(disposed)return null;let state;try{state=await stateFor(id,signal);}catch(error){if(signal?.aborted)throw error;counters.stateErrors++;counters.lastError=typeof error?.code==='string'?error.code:'STATE_READ_FAILED';state=null;}
  collectBridge();const candidates=[...(state?.candidates||[]),...(bridges.get(id)||[])].sort((a,b)=>b.time-a.time||b.seq-a.seq);
  for(const candidate of candidates){try{const result=await render(candidate,signal);if(result)return {sessionId:id,...result,source:candidate.source,time:candidate.time};}catch(error){if(signal?.aborted)throw error;}}
  return null;
 }
 async function refresh(id,signal){
  if(disposed||typeof id!=='string'||id.length>200)return null;if(pending.has(id))return pending.get(id);
  counters.queued++;const run=tail.catch(()=>{}).then(()=>getInternal(id,signal)).then(value=>{results.set(id,value);refreshed.set(id,Date.now());counters.completed++;return value;},error=>{counters.failures++;refreshed.set(id,Date.now());throw error;});
  tail=run;pending.set(id,run);try{return await run;}finally{pending.delete(id);}
 }
 const close=async()=>{disposed=true;unlisten();await tail.catch(()=>{});await handle.dispose();await domain.close();images.clear();results.clear();};
 return {
  list(ids){const result={};if(!Array.isArray(ids)||disposed)return result;for(const id of [...new Set(ids)]){if(typeof id!=='string')continue;const value=results.get(id);result[id]=value?{...value,src:'/api/session-categories-thumbnail?sessionId='+encodeURIComponent(id)+'&version='+encodeURIComponent(value.version)}:null;if(Date.now()-(refreshed.get(id)||0)>2500&&!pending.has(id))void refresh(id).catch(()=>{});}return result;},
  refresh, get:refresh,
  response(request){const url=new URL(typeof request==='string'?request:request.url);const value=results.get(url.searchParams.get('sessionId'));if(!value||value.version!==url.searchParams.get('version'))return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});const data=Buffer.from(value.src.split(',')[1],'base64');return new Response(typeof request!=='string'&&request.method==='HEAD'?null:data,{status:200,headers:{'Content-Type':'image/jpeg','Content-Length':String(data.length),'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff',ETag:'"'+value.version+'"'}});},
  diagnostics(){return {...counters,pending:pending.size,cachedSessions:results.size,cachedImages:images.size,bridgeSessions:bridges.size,disposed};},
  invalidateBridges(){scanNeeded=true;refreshed.clear();},close,dispose:close
 };
}
