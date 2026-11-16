import fs from 'node:fs/promises';
import path from 'node:path';
const BASE='https://ai.freeflyagain.xyz/v1';
const args=process.argv.slice(2), cmd=args[0], file=args[1];
async function key(){
 if(process.env.DROCK_IMAGE_API_KEY) return process.env.DROCK_IMAGE_API_KEY.trim();
 if(process.env.DROCK_IMAGE_API_KEY_FILE){const value=(await fs.readFile(process.env.DROCK_IMAGE_API_KEY_FILE,'utf8')).trim();if(value)return value;}
 throw Error('MISSING_CREDENTIAL: set DROCK_IMAGE_API_KEY or DROCK_IMAGE_API_KEY_FILE to your own private key file; never commit credentials');
}
async function api(route,body){const r=await fetch(BASE+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+await key(),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});const t=await r.text();let j;try{j=JSON.parse(t);}catch{throw Error('HTTP '+r.status+': non-JSON response');}if(!r.ok||j.error)throw Error('HTTP '+r.status+': '+JSON.stringify(j).slice(0,1800));return j;}
async function image(value){if(/^https:\/\//.test(value)||value.startsWith('data:image/'))return value;const b=await fs.readFile(value);const ext=path.extname(value).toLowerCase();const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[ext];if(!mime)throw Error('Reference must be PNG, JPEG, or WebP');return 'data:'+mime+';base64,'+b.toString('base64');}
async function payload(o){
 if(typeof o.prompt!=='string'||!o.prompt.trim())throw Error('prompt is required');
 const n=o.n??1;if(!Number.isInteger(n)||n<1||n>4)throw Error('n must be 1..4');
 const model=o.model??'gpt-image-2.6-sunburst';if(!['gpt-image-2.6-sunburst','gpt-image-2.6-flare','gpt-image-2.5-sunburst','gpt-image-2.5-flare','gpt-image-2','gemini-3-pro-image-preview','gemini-3.1-flash-image-preview'].includes(model))throw Error('Unsupported image model');
 const p={model,prompt:o.prompt,n,size:o.size??'auto',quality:o.quality??'auto',background:true};if(!['auto','low','medium','high'].includes(p.quality))throw Error('Invalid quality');
 if(o.images?.length){if(!Array.isArray(o.images)||o.images.length>16)throw Error('images must be an array of up to 16 paths/URLs');p.file_list=await Promise.all(o.images.map(async v=>({url:await image(v)})));}
 if(o.mask){if(!o.images?.length)throw Error('mask requires images');if(!/^https:\/\//.test(o.mask))throw Error('mask must be a hosted HTTPS URL, with same dimensions as the reference');p.mask_url=o.mask;}
 return p;
}
function items(j){return Array.isArray(j?.data)?j.data:Array.isArray(j?.data?.data)?j.data.data:Array.isArray(j?.result?.data)?j.result.data:Array.isArray(j?.result)?j.result:[];}
async function save(state,j){state.response=j;state.updatedAt=new Date().toISOString();const list=items(j);state.files??=[];
 for(let i=0;i<list.length;i++){const item=list[i];if(state.files.some(f=>f.index===i))continue;let b;if(item.b64_json)b=Buffer.from(item.b64_json,'base64');else if(item.url){const u=new URL(item.url);if(u.protocol!=='https:')throw Error('Image download requires HTTPS');const r=await fetch(u,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Image download HTTP '+r.status);b=Buffer.from(await r.arrayBuffer());}else continue;
 const png=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpg=b[0]===255&&b[1]===216;const webp=b.toString('ascii',8,12)==='WEBP';if(!png&&!jpg&&!webp)throw Error('Downloaded content is not PNG/JPEG/WebP');const out=path.join(state.outputDir,'image-'+(i+1)+(png?'.png':jpg?'.jpg':'.webp'));await fs.writeFile(out,b);state.files.push({index:i,path:out,bytes:b.length});}
 state.status=state.files.length?'completed':String(j.status??j.data?.status??'pending');await fs.writeFile(state.stateFile,JSON.stringify(state,null,2));return {status:state.status,taskId:state.taskId,files:state.files,stateFile:state.stateFile};}
async function main(){if(!file||!['submit','poll','check'].includes(cmd))throw Error('Usage: node image-api.mjs submit|check request.json OR poll state.json');
 if(cmd==='poll'){const state=JSON.parse(await fs.readFile(file,'utf8'));if(!state.taskId)throw Error('No task id; inspect saved response, do not resubmit automatically');return save(state,await api('/images/tasks/'+encodeURIComponent(state.taskId)));}
 const o=JSON.parse(await fs.readFile(file,'utf8'));const p=await payload(o);if(cmd==='check'){let available=true;try{await key();}catch{available=false;}return {valid:true,credentialAvailable:available,endpoint:BASE+'/images/generations',model:p.model,n:p.n,referenceCount:p.file_list?.length??0};}
 const outputDir=path.resolve(o.outputDir??path.join(path.dirname(file),'outputs',new Date().toISOString().replace(/[:.]/g,'-')));await fs.mkdir(outputDir,{recursive:true});const state={status:'submitting',outputDir,stateFile:path.join(outputDir,'state.json'),model:p.model,createdAt:new Date().toISOString()};await fs.writeFile(state.stateFile,JSON.stringify(state,null,2));
 let j;try{j=await api('/images/generations',p);}catch(e){state.status='submission_error_or_unknown';state.error=e.message;await fs.writeFile(state.stateFile,JSON.stringify(state,null,2));throw e;}
 state.taskId=j.task_id??j.id??j.data?.task_id??j.data?.id;return save(state,j);
}
try{console.log(JSON.stringify(await main(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
