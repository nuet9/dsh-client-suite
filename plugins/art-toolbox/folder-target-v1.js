import path from 'node:path';
import {stat} from 'node:fs/promises';
export async function resolveResultFolder(entry,check=stat){
 if(!entry)throw Error('成果记录不存在');
 const files=(entry.files||[]).filter(f=>typeof f==='string');
 const candidates=[entry.outputDir,...files.filter(f=>/\.(blend|fbx|glb|gltf|obj|zip)$/i.test(f)).map(f=>path.dirname(f)),...files.map(f=>path.dirname(f))];
 for(const dir of [...new Set(candidates.filter(Boolean))]){
  if(!path.isAbsolute(dir)||/^\\\\/.test(dir)||/[\x00-\x1f"]/.test(dir))continue;
  try{if((await check(dir)).isDirectory())return dir;}catch{}
 }
 throw Error('成果文件夹不存在，请检查原文件位置');
}
