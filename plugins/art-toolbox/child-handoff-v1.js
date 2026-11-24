import {createHash,randomUUID} from 'node:crypto';

const ttl=15*60_000;
const maxBytes=32*1024*1024;
const fields=['action','kind','id','sessionId','sessionTarget','requestId','prompt','title','sourceProvider','targetCount','boardName','pinterestDestination','rememberProject','modelSelection','inputs','image','imagePath','imageAttachmentId'];
export const claimParameters={type:'object',properties:{ticket:{type:'string',minLength:36,maxLength:36}},required:['ticket'],additionalProperties:false};

export function childHandoffs({run,owns,now=Date.now}){
 const rows=new Map(),tickets=new Map();let bytes=0;
 const receipt=row=>({requestId:row.id,status:row.status,...(row.error?{error:row.error}:{})});
 function release(row){if(row.input){bytes-=row.size;delete row.input;}}
 function sweep(){for(const [id,row] of rows){if(row.status==='claiming'||now()<row.expires)continue;release(row);tickets.delete(row.ticket);if(now()>=row.expires+ttl)rows.delete(id);else if(row.status==='pending'){row.status='expired';row.error='子会话未在期限内领取任务；请重新提交。';}}}
 return {
  stage(payload,signal){
   signal.throwIfAborted();sweep();
   const id=payload.requestId;if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(id))throw Error('Invalid request ID');
   const input=structuredClone(Object.fromEntries(fields.filter(k=>Object.hasOwn(payload,k)).map(k=>[k,payload[k]])));
   const text=JSON.stringify(input),size=Buffer.byteLength(text),digest=createHash('sha256').update(text).digest('hex');
   const existing=rows.get(id);if(existing){if(existing.digest!==digest)throw Error('Request ID conflict');return {handoff:receipt(existing)};}
   if(rows.size>=64||size>28_200_000||bytes+size>maxBytes)throw Error('子会话待领取任务已达容量限制');
   const ticket=randomUUID();
   const marker=`【美术工具箱】请立即调用 art_toolbox_claim，参数 ticket=${ticket}。仅按成功领取后返回的指令执行；工具不可用、领取失败或没有返回指令则停止并报告，不另开任务、不启动制作或搜集。`;
   const row={id,ticket,marker,input,digest,size,owner:input.sessionId,expires:now()+ttl,status:'pending'};
   rows.set(id,row);tickets.set(ticket,row);bytes+=size;
   // The Client submits this through the resource-scoped native Gateway, not this HTTP route.
   return {handoff:receipt(row),wake:{requestId:id,childSessionId:input.sessionId,delivery:'queue',content:[{type:'text',text:marker}]}};
  },
  lookup(id,sessionId){sweep();const row=rows.get(id);return row&&row.owner===sessionId?receipt(row):undefined;},
  modelJob(id,agent,message){sweep();const row=rows.get(id);const input=row?.input;if(row?.status==='pending'&&input?.modelSelection&&message.content?.length===1&&message.content[0].type==='text'&&message.content[0].text===row.marker&&owns(agent,input.sessionTarget))return {sessionId:row.owner,modelSelection:input.modelSelection};},
  async claim(ticket,agent,signal){
   signal.throwIfAborted();sweep();const row=tickets.get(ticket),input=row?.input;
   if(!input||row.status!=='pending'||!owns(agent,input.sessionTarget))throw Error('任务不存在、已领取、已过期或不属于当前子会话');
   row.status='claiming';tickets.delete(ticket);
   try{const result=await run(input,agent,signal);if(result.delivery!=='inline'||!result.instructions)throw Error('未生成任务指令，不得开始制作');row.status='claimed';return result;}
   catch(error){row.status='failed';row.error=String(error.message||error);throw error;}
   finally{release(row);}
  },
  dispose(){for(const row of rows.values())release(row);rows.clear();tickets.clear();},
 };
}
