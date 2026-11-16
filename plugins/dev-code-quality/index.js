import { Worker } from 'node:worker_threads';
import { Config } from './config.js';
import { extensions } from './core.js';
export { Config };
export const inject=['tools','commands','workingDirectory','sessions','sandboxPolicy','agents'];
export const parameters={type:'object',additionalProperties:false,properties:{action:{type:'string',enum:['status','diagnostics','query','task']},task:{type:'string',description:'Configured task name; discover with status.'},workspaceRoot:{type:'string',description:'Defaults to the current session working directory.'},project:{type:'string',description:'tsconfig/jsconfig path relative to workspaceRoot.'},filePath:{type:'string',description:'TS/JS path relative to workspaceRoot; diagnostics limits checks to this file.'},operation:{type:'string',enum:['goToDefinition','findReferences','goToImplementation','hover']},position:{type:'object',additionalProperties:false,properties:{line:{type:'integer',minimum:0},character:{type:'integer',minimum:0}},required:['line','character'],description:'Zero-based UTF-16 cursor.'},limit:{type:'integer',minimum:1,maximum:500}},required:['action']};
export class CodeQualityService {
 constructor(ctx,config){this.ctx=ctx;this.config=Config.parse(config);this.workers=new Set();this.hookResults=new Map();this.queues=new Map();this.hookControllers=new Map();this.hookDepth=new Map();this.closed=false;this.provider='not registered';}
 async execute(args,agent,signal){
 if(this.closed)throw Error('Plugin disposed');
 if(!agent||this.ctx.agents.get(agent.id)!==agent)throw Error('An exact live initiating agent is required');
 const session=this.ctx.sessions.get(agent.id);if(!session)throw Error('Live session required');
 const policy=this.ctx.sandboxPolicy.resolve({session});
 if(args.action==='status')return {engine:'typescript',languages:Object.keys(extensions),tasks:[{name:'diagnostics',description:'Check TS/JS project or file'},...this.config.tasks],hooks:this.config.hooks,provider:this.provider,policyMode:policy.mode,lastHook:policy.mode==='danger-full-access'?(this.hookResults.get(agent.id)??null):null,limitations:['TS/JS only; local Host files','Disk contents only; no unsaved editor buffers','No repository scripts, formatters or arbitrary commands','Project references reported but not recursively built','No filesystem watcher; hooks observe configured Harness write/edit tool results only']};
 if(policy.mode!=='danger-full-access')throw Error('TS/JS Host file reads require danger-full-access; current session mode: '+policy.mode);
 if(args.action==='task'){const task=args.task==='diagnostics'?{}:this.config.tasks.find(x=>x.name===args.task);if(!task)throw Error('Unknown task; discover names with status');args={...task,action:'diagnostics',workspaceRoot:args.workspaceRoot};}
 if(!['query','diagnostics'].includes(args.action))throw Error('Unknown action');
 if(args.action==='query'&&(!args.filePath||!args.operation||!args.position))throw Error('query requires filePath, operation and position');
 if(args.limit!==undefined&&(!Number.isInteger(args.limit)||args.limit<1||args.limit>500))throw Error('limit must be 1..500');
 const workspaceRoot=args.workspaceRoot??(agent?await this.ctx.workingDirectory.ensure(agent,signal):undefined);if(!workspaceRoot)throw Error('workspaceRoot required without an agent');
 signal?.throwIfAborted();
 if(this.workers.size>=4)throw Error('Language service busy: maximum 4 concurrent workers');
 return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./worker.js',import.meta.url),{workerData:{request:{...args,workspaceRoot},limits:this.config},resourceLimits:{maxOldGenerationSizeMb:384},execArgv:[]});this.workers.add(worker);let settled=false;
 const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);this.workers.delete(worker);void worker.terminate();err?reject(err):resolve(value);};
 const abort=()=>finish(Error('Language request aborted'));const timer=setTimeout(()=>finish(Error('Language request timed out')),this.config.timeoutMs);signal?.addEventListener('abort',abort,{once:true});
 worker.once('message',m=>m.ok?finish(null,m.value):finish(Error(m.error)));worker.once('error',e=>finish(e));worker.once('exit',code=>{if(!settled)finish(Error('Language worker exited: '+code));});if(signal?.aborted)abort();
 });
 }
 observe(exec,result){
 if(!this.config.hooks.enabled||result.isError||!exec.agent||!this.config.hooks.tools.includes(exec.name)||this.closed)return;
 const id=exec.agent.id,previous=this.queues.get(id)??Promise.resolve();
 if((this.hookDepth.get(id)??0)>=32){this.hookResults.set(id,{trigger:exec.name,callId:exec.callId,status:'error',error:'Hook queue limit reached (32)'});return;}
 let controller=this.hookControllers.get(id);if(!controller){controller=new AbortController();this.hookControllers.set(id,controller);}const signal=controller.signal;this.hookDepth.set(id,(this.hookDepth.get(id)??0)+1);
 const pending=previous.catch(()=>{}).then(async()=>{if(this.closed||signal.aborted)return;try{const value=await this.execute({action:'task',task:this.config.hooks.task},exec.agent,signal);if(signal.aborted)return;this.hookResults.set(id,{trigger:exec.name,callId:exec.callId,status:'completed',value});}catch(error){if(signal.aborted)return;this.hookResults.set(id,{trigger:exec.name,callId:exec.callId,status:'error',error:String(error.message??error)});}});
 this.queues.set(id,pending);void pending.finally(()=>{this.hookDepth.set(id,Math.max(0,(this.hookDepth.get(id)??1)-1));if(this.queues.get(id)===pending){this.queues.delete(id);this.hookControllers.delete(id);this.hookDepth.delete(id);}});
 }
 cancelAgent(id){this.hookControllers.get(id)?.abort();this.hookResults.delete(id);}
 async dispose(){this.closed=true;for(const controller of this.hookControllers.values())controller.abort();await Promise.all([...this.workers].map(w=>w.terminate()));await Promise.all([...this.queues.values()]);this.hookResults.clear();}
}
export function apply(ctx,rawConfig){
 const service=new CodeQualityService(ctx,rawConfig);
 ctx.effect(()=>()=>service.dispose());
 ctx.effect(()=>ctx.tools.register({name:'dev_code_quality',description:'Inspect TS/JS project diagnostics, language navigation, configured tasks and hook results. Use status to discover tasks and limits. File reads require the current session to have danger-full-access.',parameters,output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value,null,2)}]},execute:(args,exec)=>service.execute(args,exec.agent,exec.signal)}));
 const command=(name,description,handler,hint)=>ctx.effect(()=>ctx.commands.register({name,description,...(hint?{input:{hint}}:{}),handler:async invocation=>{try{const value=await handler(invocation);return {kind:'success',text:JSON.stringify(value,null,2)};}catch(error){return {kind:'error',text:String(error.message??error)};}}}));
 command('quality','TS/JS 质量检查 / diagnostics, tasks and hook status',i=>{const input=i.rawInput.trim();return service.execute(input?JSON.parse(input):{action:'status'},i.agent,i.signal);},'JSON: {"action":"diagnostics"} or {"action":"task","task":"name"}');
 command('quality-check','检查 TS/JS 项目 / Check TS/JS project',i=>service.execute({action:'diagnostics',...(i.rawInput.trim()?{project:i.rawInput.trim()}: {})},i.agent,i.signal),'Optional tsconfig/jsconfig path (spaces supported, no quotes required)');
 for(const task of service.config.tasks)command('quality-'+task.name,task.description,i=>{if(i.rawInput.trim())throw Error('This configured task accepts no arguments; use /quality JSON for other operations');return service.execute({action:'task',task:task.name},i.agent,i.signal);});
 ctx.on('tools/result',(exec,result)=>{service.observe(exec,result);});
 ctx.on('agent/disposed',({agent})=>{service.cancelAgent(agent.id);});
 if(service.config.registerLspProvider)ctx.inject(['lsp'],lctx=>{try{lctx.effect(()=>lctx.lsp.registerProvider({id:'local-dev-code-quality-typescript',extensionToLanguage:extensions,query:async(request,signal)=>{const result=await service.execute({...request,action:'query'},ctx.agents.currentInitiator(),signal);return result.kind==='hover'?result:{kind:'locations',locations:result.locations,resolvedWorkspaceUri:result.resolvedWorkspaceUri};}}));service.provider='registered';}catch(error){service.provider='unavailable: '+String(error.message??error);}});
}
