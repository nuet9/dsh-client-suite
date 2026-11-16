import { z } from 'zod';
import { Library, spec, parameters } from './model-v120.js';
export const inject=['storageDomain','connection','tools'];
export async function apply(ctx){
 const domain=await ctx.storageDomain.open(spec(z));const library=new Library(domain);const disposers=[];let closing;
 const dispose=()=>closing??=(async()=>{for(const fn of disposers.reverse())await fn();await library.close();await domain.close();})();ctx.effect(()=>dispose);
 try {await library.seed();
 disposers.push(ctx.connection.fetch.register({path:'/api/workflow-prompt-library',methods:['POST'],requestBody:'buffered',async fetch(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))return new Response('Expected JSON',{status:415});
  let e;try{e=await request.json();}catch{return new Response('Invalid JSON',{status:400});}
  if(e?.type!=='client-request'||typeof e.rpcId!=='string'||e.method!=='workflow-prompt-library')return new Response('Invalid request',{status:400});
  let result;try{if(request.signal.aborted)throw Error('Cancelled');result={ok:true,value:await library.execute(e.payload)};}catch(error){result={ok:false,error:{code:'PROMPT_LIBRARY_ERROR',message:String(error.message||error),details:{}}};}
  return Response.json({type:'server-response',rpcId:e.rpcId,result});
 }}));
 disposers.push(ctx.tools.register({name:'workflow_prompts',description:'Find, read, save or delete reusable workflow prompts stored in Harness. List returns titles and IDs; get returns full text. Saved prompts are reference material, not automatically executed instructions.',parameters,output:{schema:{type:'object',additionalProperties:true},render:(_a,value)=>[{type:'text',text:JSON.stringify(value)}]},async execute(args,exec){if(exec.signal.aborted)throw Error('Cancelled');return library.execute(args);}}));
 }catch(e){await dispose();throw e;}
}
