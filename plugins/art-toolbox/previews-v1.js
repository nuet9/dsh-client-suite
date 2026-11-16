import sharp from 'sharp';
import {stat,readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export function imageService(root){
 const pending=new Map();let tail=Promise.resolve();
 async function convert(file,mode){
  const info=await stat(file);const key=createHash('sha256').update(file+'\0'+info.mtimeMs+'\0'+info.size+'\0'+mode).digest('hex').slice(0,32);
  const dest=path.join(root,'.previews',key+'-'+mode+'.jpg');
  try{return await readFile(dest);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(pending.has(key))return pending.get(key);
  const task=tail.catch(()=>{}).then(async()=>{
   const dims=mode==='thumb'?[640,420]:[1800,1800];
   const image=sharp(file,{failOn:'error',limitInputPixels:80000000,animated:false}).rotate().resize(...dims,{fit:'inside',withoutEnlargement:true}).flatten({background:'#f3f4f6'});
   let buf=await image.jpeg({quality:mode==='thumb'?78:88,mozjpeg:true}).toBuffer();
   if(mode==='thumb'&&buf.length>96*1024)buf=await sharp(buf).resize(480,320,{fit:'inside'}).jpeg({quality:60,mozjpeg:true}).toBuffer();
   await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest+'.tmp',buf);await rename(dest+'.tmp',dest);return buf;
  });pending.set(key,task);tail=task;try{return await task;}finally{pending.delete(key);}
 }
 return {async thumbnail(file){return 'data:image/jpeg;base64,'+(await convert(file,'thumb')).toString('base64');},async preview(file){if((await stat(file)).size>4*1024*1024)return 'data:image/jpeg;base64,'+(await convert(file,'detail')).toString('base64');const ext=path.extname(file).slice(1).toLowerCase();return 'data:image/'+(ext==='jpg'?'jpeg':ext)+';base64,'+(await readFile(file)).toString('base64');}};
}
