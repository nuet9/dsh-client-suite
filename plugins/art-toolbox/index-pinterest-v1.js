import {dispatchBrowser,assertBrowserSuccess} from './browser-dispatch-v1.js';
import {researchService,researchParameters} from './pinterest-research-v1.js';
import {pinterestReadOperation} from './pinterest-sync-v1.js';
import {comfyService} from './comfy-service-v1.js';
import {comfyLibrary} from './comfy-library-v1.js';
import {comfyLibraryParameters} from './comfy-library-schema-v1.js';
import {taskModelRouter} from './model-selection-v1.js';
import {agentRequest,assertActiveTask} from './agent-request-v1.js';
import {validateSessionTarget,targetForAgent,admitTaskPrompt,sessionTargetSchema} from './session-target-v1.js';
import {queueService,queueParameters,browserOperation,parseBrowserResult} from './pinterest-queue-v11.js';
import {browserLoginService} from './browser-login-v2.js';
import {revealFile} from './folder-reveal-v1.js';
import {resolveResultFolder} from './folder-target-v1.js';
import {resolveWorkflowFolder} from './workflow-folder-v1.js';
import {z} from 'file:///__DSH_SUITE_ART_TOOLBOX_HARNESS_RUNTIME_ROOT__/node_modules/zod/index.js';
import {stat,lstat,readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {imageService} from './previews-v1.js';
import {isAbsolute} from 'node:path';
import {Toolbox,baseSpec,repositorySpec,parameters,kinds} from './pinterest-sync-v1.js';
export const inject=['storageDomain','connection','tools','sessionController','attachments','systemPrompt','llm','agents','subagents','sessionQuery'];
export async function apply(ctx){
 const browser=browserLoginService({hasActiveJobs:()=>[...box.jobs.entries()].some(([,j])=>j.kind==='pinterest'&&['submitted','submitting','working'].includes(j.status)),async callBrowser(op,args){
  const batch=await dispatchBrowser(ctx.tools,op,args,AbortSignal.timeout(25000));
 
 assertBrowserSuccess(batch);return batch;
 }});
 const workflowParameters=structuredClone(parameters);delete workflowParameters.properties.includeThumbnails;workflowParameters.properties.kind.description='Workflow type; get with kind returns only its settings and jobs.';workflowParameters.properties.action.enum.push('browser');workflowParameters.properties.browserOperation={type:'string',enum:['status','open'],description:'browser: status checks the dedicated profile; open shows Pinterest login in a dedicated Chrome window. Open only when the user explicitly requests a visible login window.'};
 workflowParameters.properties.sessionTarget=sessionTargetSchema;
  const targetServices={header:(id,signal)=>ctx.sessionQuery.inspectSession(id,s=>({...s.header}),signal),descendants:(id,signal)=>ctx.subagents.listDescendants(id,signal)};
  const comfy=comfyService();
   const workflows=comfyLibrary({root:fileURLToPath(new URL('../../art-repositories/comfy-workflows/',import.meta.url))});
 async function execute(a,signal){if(!a||typeof a!=='object')throw Error('Invalid request');if(a.action==='workflowFolder'){const folder=await resolveWorkflowFolder({target:a.target,id:a.id,libraryRoot:fileURLToPath(new URL('../../art-repositories/comfy-workflows/',import.meta.url)),comfyRoot:'__DSH_SUITE_ART_TOOLBOX_COMFY_ROOT__/ComfyUI',stat:lstat,detail:payload=>workflows.execute(payload)});await revealFile(JSON.stringify(folder));return {folder};}if(['start','continue'].includes(a.action))a={...a,sessionTarget:await validateSessionTarget(a,targetServices,signal)};if(a?.action==='workflowLibrary'){const {operation,...payload}=a;return workflows.execute({...payload,action:operation});}if(a?.action==='comfy')return comfy.execute(a.operation,{force:a.force===true});if(a.action==='browser'){if(!['status','open'].includes(a.browserOperation))throw Error('请选择浏览器操作');return a.browserOperation==='open'?browser.open():browser.status();}if((a.action==='start'&&a.kind==='pinterest')||(a.action==='continue'&&box.find(a.id)?.kind==='pinterest')){if((await browser.status()).mode==='login')throw Error('请先关闭登录用的专用浏览器窗口，再开始后台搜集；登录状态会保留');}return box.execute(a,signal);}

 const domain=await ctx.storageDomain.open(baseSpec(z));
 let repoDomain;try{repoDomain=await ctx.storageDomain.open(repositorySpec(z));}catch(e){await repoDomain?.close();await domain.close();throw e;}
 const repositoryRoot=fileURLToPath(new URL('../../art-repositories/',import.meta.url));
 const outputDir=(kind,id)=>{if(!kinds.includes(kind)||!/^[-a-zA-Z0-9_]{8,100}$/.test(id))throw Error('Invalid task directory');return path.join(repositoryRoot,kind,id,'output');};
 const box=new Toolbox(domain,repoDomain,{repositoryRoot,outputDir,async pinterestRead(a,signal){
 if((await browser.status()).mode==='login')throw Error('请先关闭专用登录窗口再同步，登录会保留');
 const code='async(page)=>('+pinterestReadOperation.toString()+')(page,'+JSON.stringify(a)+')';
 const result=await dispatchBrowser(ctx.tools,'run_code_unsafe',{code},signal?AbortSignal.any([signal,AbortSignal.timeout(50000)]):AbortSignal.timeout(50000));
 return parseBrowserResult(result);
 },async mirror(entry){const key=entry.id.replace(/[^a-zA-Z0-9_-]/g,'_');const dir=path.join(repositoryRoot,entry.kind,entry.jobId||key);await mkdir(dir,{recursive:true});const dest=path.join(dir,'record.json');await writeFile(dest+'.tmp',JSON.stringify(entry,null,2),'utf8');await rename(dest+'.tmp',dest);const md=['# '+entry.title,'',entry.summary,'','验证与限制：'+entry.verification,'',...entry.files.map(f=>'- ['+path.basename(f)+'](<file:///'+f.replace(/\\/g,'/')+'>)'),'','记录只索引原文件，未移动或覆盖原件。'].join('\n');await writeFile(path.join(dir,'成果说明.md'),md,'utf8');const all=box.all().filter(e=>e.kind===entry.kind&&!e.archived);await writeFile(path.join(repositoryRoot,entry.kind,'目录.md'),['# '+entry.kind+' 成果仓库','',...all.map(e=>'- '+e.title+' / '+e.status+' / '+e.id)].join('\n'),'utf8');},...imageService(repositoryRoot),saveImage:a=>ctx.attachments.saveImage(a),imagePath:r=>ctx.attachments.imageHostPath(r),modelCatalog:()=>ctx.sessionController.modelCatalog(),async validateModel(selection){const list=await ctx.llm.listModels(selection.provider);if(!list.some(m=>m.id===selection.model))throw Error('该模型当前不可用，请重新选择：'+selection.model);await ctx.llm.resolveCallConfig(selection);},async prompt(r,s){
 const job=box.jobs.get(r.requestId),selected=job?.modelSelection;
  const target=await validateSessionTarget({sessionId:r.sessionId,sessionTarget:r.sessionTarget??job?.sessionTarget},targetServices,s);
  return admitTaskPrompt(r,target,selected,{
   sessionPrompt:(request,signal)=>ctx.sessionController.prompt(request,signal),
   childPrompt:(request,signal)=>ctx.subagents.prompt(request,signal),
   modelInfo:v=>ctx.llm.resolveModelInfo(v.provider,v.model),
   async currentModel(t,signal){
    if(t.kind==='subagent'){const live=ctx.agents.get(t.childSessionId);return live?live.model.current():ctx.sessionQuery.inspectSession(t.childSessionId,session=>{const config=session.requestHeader()?.config;return config?{provider:config.provider,model:config.model}:undefined;},signal);}
    const resolved=await ctx.sessionController.resolveAgent(t.sessionId);if('error' in resolved)throw Error('会话不可用：'+JSON.stringify(resolved.error));return resolved.agent.model.current();
   }
  },s);
 },async checkFile(f){if(typeof f!=='string'||!isAbsolute(f)||!(await stat(f)).isFile())throw Error('Deliverable must be an existing absolute file: '+f);}});
 let research;
  const queue=queueService({authorizeReader:(q,session)=>research.authorizedReader(q,session),browserStatus:()=>browser.status(),mkdir,outputDir:id=>outputDir('pinterest',id),async callBrowser(a){
 const code='async(page)=>('+browserOperation.toString()+')(page,'+JSON.stringify(a)+')';
 const result=await dispatchBrowser(ctx.tools,'run_code_unsafe',{code},AbortSignal.timeout(55000));
 return parseBrowserResult(result);
 }});
 research=researchService({ctx,settings:box.settings,jobs:box.jobs,queue});
  const queueJobs=new Map();
 const routing=taskModelRouter(box.jobs);
 const disposers=[ctx.tools.guard(exec=>research.guard(exec)),()=>research.close(),ctx.on('agent/inbox/claimed',payload=>routing.claim(payload)),ctx.on('session/event',(session,event)=>routing.end(session,event)),()=>routing.dispose()];let closing;const dispose=()=>closing??=(async()=>{for(const d of disposers.reverse())await d();await queue.dispose();await box.close();await repoDomain.close();await domain.close();})();ctx.effect(()=>dispose);
 try{
 const migration={imported:0,existing:0,errors:[]};try{const records=JSON.parse(await readFile(path.join(repositoryRoot,'history-import.json'),'utf8'));for(const item of records){try{const r=await box.execute({...item,action:'import'});migration[r.existing?'existing':'imported']++;}catch(e){migration.errors.push({id:item.id,error:String(e.message||e)});}}}catch(e){if(e.code!=='ENOENT')migration.errors.push({error:String(e.message||e)});}migration.tripo=await box.reclassifyTripoHistory();await mkdir(repositoryRoot,{recursive:true});await writeFile(path.join(repositoryRoot,'migration-status.json'),JSON.stringify(migration,null,2));
 disposers.push(ctx.systemPrompt.section({name:'art-toolbox-repository',order:860,text:'美术任务成果库：用户已要求将后续材质、照片建模、Tripo处理、参数化建模、Pinterest参考搜集、工程整理和资产汇总成果分类保存。制作完成并验证后，工具箱任务用 art_toolbox report；普通对话任务用 art_toolbox import 登记真实成果文件、名称、类型及验证限制。查询旧结果用 repository，再用 detail 读取一个条目。ComfyUI工作流另用 comfy_workflows list/detail/import/annotate/check/install：保留源JSON与来源会话，逐节点说明调整方式，记录成功/实验/失败验证状态；安装仅写入ComfyUI工作流目录，不自动推理或下载模型。修改旧成果保留原件，另存版本并关联 parentId。'}));
 disposers.push(ctx.connection.fetch.register({path:'/api/art-toolbox-folder',methods:['POST'],requestBody:'buffered',async fetch(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))return new Response('Expected JSON',{status:415});
 let e;try{e=await request.json();}catch{return new Response('Invalid JSON',{status:400});}
 if(e?.type!=='client-request'||typeof e.rpcId!=='string'||e.method!=='art-toolbox-folder'||typeof e.payload?.id!=='string')return new Response('Invalid envelope',{status:400});
 let result;try{const folder=await resolveResultFolder(box.find(e.payload.id));await revealFile(JSON.stringify(folder));result={ok:true,value:{folder}};}catch(error){result={ok:false,error:{code:'OPEN_FOLDER_ERROR',message:String(error.message||error),details:{}}};}
 return Response.json({type:'server-response',rpcId:e.rpcId,result});
 }}));
 disposers.push(ctx.connection.fetch.register({path:'/api/art-toolbox',methods:['POST'],requestBody:'buffered',async fetch(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))return new Response('Expected JSON',{status:415});let e;try{e=await request.json();}catch{return new Response('Invalid JSON',{status:400});}if(e?.type!=='client-request'||typeof e.rpcId!=='string'||e.method!=='art-toolbox')return new Response('Invalid envelope',{status:400});let result;try{if(e.payload?.action==='report')throw Error('Results must be reported by task session');result={ok:true,value:await execute(e.payload,request.signal)};}catch(error){result={ok:false,error:{code:e?.payload?.action==='workflowFolder'?'OPEN_FOLDER_ERROR':'ART_TOOLBOX_ERROR',message:String(error.message||error),details:{}}};}return Response.json({type:'server-response',rpcId:e.rpcId,result});
 }}));
 disposers.push(ctx.tools.register({name:'pinterest_research',description:'Only an active Pinterest toolbox task owner may start up to three read-only researchers in its queue. Local absolute depth 2 only; no global depth change. Research uses queue search/enqueue/status and read_image, no direct browser, writes or recursive delegation. Reuse stable requestId; uncertain requests are query-only, never automatically resubmitted.',parameters:researchParameters,output:{schema:{type:'object',additionalProperties:true},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},execute:(a,exec)=>research.execute(a,exec.agent,exec.signal),isConcurrencySafe:()=>false}));
  disposers.push(ctx.tools.register({name:'pinterest_queue',description:'Collect reviewed Pinterest references through queue-owned background browser pages. begin immediately. Researchers MUST use only queue search, view its screenshot with read_image, then enqueue; never call Playwright/tabs directly. All queue browser operations are serialized. Owner binds the authorized destination, then drain auto:true continuously saves reviewed candidates until cutoff; auto:false pauses. finish stops saving and captures one preview. Reviewed candidates persist across close/deadline; resume explicitly begins a new authorized round with jobId and queueId. Enforces a shared ten-minute deadline, deduplicates candidates, and returns real saved versus pending counts.',parameters:queueParameters,output:{schema:{type:'object',additionalProperties:true},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},execute(a,exec){if(!exec.agent)throw Error('Session required');return (async()=>{const info=a.queueId?queue.info(a.queueId):null;const taskJobId=a.jobId||info?.jobId||queueJobs.get(a.queueId);if(!['status','finish','close'].includes(a.action))assertActiveTask(box.jobs.get(taskJobId));if(['begin','resume'].includes(a.action)){const j=box.jobs.get(a.jobId);if(!j||j.kind!=='pinterest'||j.sessionId!==exec.agent.id)throw Error('队列必须来自原Pinterest任务会话');}const d=box.registry().tasks[taskJobId]?.destination;if(d?.mode==='append'&&a.action==='create')throw Error('本任务已选择补充已有图版，禁止新建图版');if(d?.mode==='append'&&['begin','bind'].includes(a.action)&&a.boardUrl&&new URL(a.boardUrl).href!==new URL(d.boardUrl).href)throw Error('队列图版与已选择目的地不一致');const r=await queue.execute(a,exec.agent.id);if(['begin','resume','create','bind'].includes(a.action)&&r.boardUrl){const jobId=a.jobId||info?.jobId||queueJobs.get(a.queueId);if(jobId)await box.execute({action:'recordPinterestDestination',jobId,value:{boardUrl:r.boardUrl,boardName:a.boardName||r.boardName,section:a.section||''},sessionId:exec.agent.id});}if(a.action==='begin'&&r.queueId)queueJobs.set(r.queueId,a.jobId);return r;})();}}));
 disposers.push(ctx.tools.register({name:'comfy_workflows',description:'Preserve ComfyUI source JSON and maintain the annotated art-toolbox workflow library. list/detail search saved entries; import copies a real source, annotate saves node adjustment guidance with revision checks, check reads local dependency availability, install copies a version to ComfyUI workflows. Never queues inference or downloads models. Keep verification and source-session provenance.',parameters:comfyLibraryParameters,output:{schema:{type:'object',additionalProperties:true},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},execute:a=>workflows.execute(a),isConcurrencySafe:()=>false}));
  disposers.push(ctx.tools.register({name:'comfy_control',description:'Control this machine\'s ComfyUI backend at __DSH_SUITE_ART_TOOLBOX_COMFY_ROOT__: status is read-only; start launches it silently without opening a browser; stop terminates only verified ComfyUI processes. Closing its webpage does not stop the backend. Use force:true only after explicit user confirmation when generation jobs are busy or queue state is unknown.',parameters:{type:'object',properties:{operation:{type:'string',enum:['status','start','stop']},force:{type:'boolean',description:'Confirm stopping even when generation jobs exist or queue state is unknown.'}},required:['operation'],additionalProperties:false},output:{schema:{type:'object',additionalProperties:true},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},execute:a=>execute({action:'comfy',...a}),timeoutMs:60000}));
 disposers.push(ctx.tools.register({name:'art_toolbox',description:'Manage art workflows and categorized result repositories: materials, photo modeling, procedural modeling, Tripo GLB processing, project cleanup, asset summaries and Pinterest reference curation. Find past results with repository/detail; start or continue work in the current session; report task results or import existing deliverables. Versions retain their source files. Results return image paths; use read_image to view them. Tripo GLB processing uses tripo-model-processing; Pinterest curation uses pinterest-reference-curator.',parameters:workflowParameters,output:{schema:{type:'object',additionalProperties:true},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},execute(a,exec){if(!exec.agent)throw Error('Session required');return (async()=>{const target=['start','continue'].includes(a.action)?await targetForAgent(exec.agent,ctx.subagents,exec.signal):undefined;return execute(agentRequest(a,exec.agent.id,target),exec.signal);})();}}));
 }catch(e){await dispose();throw e;}
}
