import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { Catalog } from './catalog.js';
import { discoverConnectors, connectorConfig } from './connectors.js';
export const inject=['connection','tools','skills','commands','agents'];
export async function apply(ctx){
 const catalog=new Catalog();let control;let revision=0;let refreshPending;
 async function refresh(){return refreshPending??=(async()=>{try{const r=await catalog.refresh();revision++;control?.invalidate();return r;}finally{refreshPending=null;}})();}
 try{await refresh();}catch(e){catalog.warnings=[String(e.message)];}
 ctx.skills.registerProvider(c=>{control=c;return {name:'workbuddy-experts',list:async()=>catalog.skills.map(s=>({...s,rank:150,locator:s.name})),get:async candidate=>catalog.skills.find(s=>s.name===candidate.locator)};});
 function activate(agent,id,signal){if(signal?.aborted)throw Error('Cancelled');if(!agent)throw Error('请先打开一个可用的会话');const e=catalog.get(id);agent.inject(createUserMessage({source:{kind:'user'},content:[{type:'text',text:catalog.prompt(e)}]}));return {expertId:id,title:e.title,queued:true,message:'专家规范已加入当前会话，将从后续步骤开始使用。连接器状态另行验证。'};}
 function reset(agent,signal){if(signal?.aborted)throw Error('Cancelled');if(!agent)throw Error('No live conversation');agent.inject(createUserMessage({source:{kind:'user'},content:[{type:'text',text:'停止使用 WorkBuddy 专家桥此前选择的专家角色，后续按我的普通对话指令继续。保留已有任务事实和产物。'}]}));return {queued:true,message:'已加入停止专家角色的会话指令。'};}
 async function execute(args,agent,signal){if(signal?.aborted)throw Error('Cancelled');switch(args.action){
 case 'list':return {...catalog.summary(),revision,connectorDetails:(await discoverConnectors(catalog.root,[...new Set([...catalog.connectors.map(c=>c.id),...catalog.experts.flatMap(e=>e.connectors)])])).map(c=>({...c,registered:catalog.connectors.some(v=>v.id===c.id)}))};
 case 'refresh':await refresh();return execute({action:'list'},agent,signal);
 case 'get':{const e=catalog.get(args.id);return {...e,content:catalog.prompt(e)};}
 case 'skill':{const s=catalog.skills.find(s=>s.name===args.id);if(!s)throw Error('Skill not found');return s;}
 case 'connector':return connectorConfig(catalog.root,args.id);
 case 'activate':return activate(agent,args.id,signal);
 case 'reset':return reset(agent,signal);
 default:throw Error('Unknown action');}}
 ctx.commands.register({name:'wb-expert',description:'选择本机 WorkBuddy 专家；list 查看，off 停止',input:{hint:'list | <expert-id> | off'},async handler({agent,rawInput,signal}){try{const id=rawInput.trim();if(!id||id==='list')return {kind:'success',text:catalog.experts.map(e=>e.title+' — /wb-expert '+e.id).join('\n')||'未发现已登记专家'};const r=await execute({action:id==='off'?'reset':'activate',id},agent,signal);return {kind:'success',text:r.message};}catch(e){return {kind:'error',text:e.message};}}});
 ctx.tools.register({name:'workbuddy_experts',description:'Discover and use installed local WorkBuddy experts, load their original skills, and inspect standard MCP connector configurations. activate/reset apply only to this conversation. Connector configs do not migrate WorkBuddy credentials or establish authentication.',parameters:{type:'object',properties:{action:{type:'string',enum:['list','refresh','get','skill','connector','activate','reset']},id:{type:'string'}},required:['action'],additionalProperties:false},output:{schema:{type:'object',additionalProperties:true},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},execute:(args,exec)=>execute(args,exec.agent,exec.signal)});
 ctx.connection.fetch.register({path:'/api/workbuddy-experts',methods:['POST'],requestBody:'buffered',async fetch(request){
  const admission=ctx.connection.admit(request);if(admission.rejection)return new Response('Unauthorized',{status:admission.rejection});if(admission.peer.principal.kind!=='owner')return new Response('Owner required',{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return new Response('Expected JSON',{status:415});
  let envelope;try{envelope=await request.json();}catch{return new Response('Invalid JSON',{status:400});}
  if(envelope?.type!=='client-request'||typeof envelope.rpcId!=='string'||envelope.method!=='workbuddy-experts')return new Response('Invalid RPC envelope',{status:400});
  let result;try{const args=envelope.payload;if(!args||typeof args!=='object')throw Error('Invalid request');const agent=args.sessionId?ctx.agents.get(args.sessionId):undefined;result={ok:true,value:await execute(args,agent,request.signal)};}catch(error){result={ok:false,error:{code:'WB_EXPERTS_ERROR',message:String(error.message||error),details:{}}};}
  return Response.json({type:'server-response',rpcId:envelope.rpcId,result});
 }});
}
