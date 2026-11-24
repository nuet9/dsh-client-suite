const MAX_IMAGE_BYTES=20*1024*1024;

export function detectImageType(bytes){
 if(!(bytes instanceof Uint8Array))return null;
 if(bytes.length>=12&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return 'image/png';
 if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
 if(bytes.length>=12&&bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&bytes[8]===0x57&&bytes[9]===0x45&&bytes[10]===0x42&&bytes[11]===0x50)return 'image/webp';
 return null;
}

export function imageInputService({fs,workingDirectory,attachments,sessionQuery}){
 async function persist(bytes,signal){if(bytes.length>MAX_IMAGE_BYTES)throw Error('Image exceeds 20 MiB');const mediaType=detectImageType(bytes);if(!mediaType)throw Error('参考图必须是有效PNG、JPEG或WebP');const ref=await attachments.saveImage({data:bytes,mediaType});const imagePath=attachments.imageHostPath(ref);if(typeof imagePath!=='string'||!imagePath)throw Error('无法为参考图生成可读取的附件路径');return {ref,imagePath};}
  async function useStoredImage(ref,signal){const stored=await attachments.readImage(ref,signal);if(stored.data.length>MAX_IMAGE_BYTES)throw Error('Image exceeds 20 MiB');const mediaType=detectImageType(stored.data);if(!mediaType||stored.ref.mediaType!==mediaType)throw Error('参考图必须是有效PNG、JPEG或WebP');const imagePath=attachments.imageHostPath(stored.ref);if(typeof imagePath!=='string'||!imagePath)throw Error('无法为参考图生成可读取的附件路径');return {ref:stored.ref,imagePath};}
 return {
  async loadPath(input,agent,signal){if(!agent)throw Error('本机会话图片读取需要可信 Agent');const cwd=await workingDirectory.ensure(agent,signal),target=await fs.resolve(input,{cwd,signal}),bytes=await fs.readBytes(target,signal,MAX_IMAGE_BYTES);return persist(bytes,signal);},
  async resolveSessionImage(sessionId,id,agent,signal){if(!agent||agent.id!==sessionId)throw Error('图片附件必须来自当前可信接收会话');const images=await sessionQuery.inspectSession(sessionId,session=>session.deriveMessages().flatMap(message=>message.role==='user'?message.content.filter(block=>block.type==='image'&&block.attachment).map(block=>({id:block.attachment.attachmentId,attachment:block.attachment})):[]),signal);const match=images.find(image=>image.id===id);if(!match)throw Error('指定图片不属于当前会话的用户图片');return useStoredImage(match.attachment,signal);}
 };
}
