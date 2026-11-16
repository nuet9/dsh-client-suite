import {randomUUID,createHash} from 'node:crypto';
const KEY='__pinterest_research_v1';
export const researchPolicy=Object.freeze({maxResearchers:3,maxDepth:2,tools:['pinterest_queue','read_image'],actions:['search','enqueue','status']});
export const researchParameters={type:'object',additionalProperties:false,required:['jobId','queueId','requestId'],properties:{jobId:{type:'string'},queueId:{type:'string'},requestId:{type:'string',description:'Stable ID for this one research direction; reuse on retry.'},prompt:{type:'string',description:'One independent research direction; no browser navigation or writes.'},queryOnly:{type:'boolean'}}};
export function researchService({ctx,settings,jobs,queue,clock=Date.now,uuid=randomUUID}){
 let tail=Promise.resolve();const runs=new Set();const read=()=>JSON.parse(settings.get(KEY)?.body||'{"requests":{}}');
 const store=async data=>settings.put(KEY,{body:JSON.stringify(data),revision:(settings.get(KEY)?.revision||0)+1});
 const recordFor=id=>Object.values(read().requests).find(r=>r.childId===id);
 const keyFor=a=>a.queueId+'\0'+a.requestId;
 function guard(exec){const r=recordFor(exec.agent?.id);if(!r)return;const args=exec.arguments;
  if(exec.name==='read_image')return;
  if(exec.name==='pinterest_queue'&&researchPolicy.actions.includes(args?.action)&&args.queueId===r.queueId)return;
  return 'Pinterest researcher is read-only: use its assigned queue search/enqueue/status and read_image only; no delegation or direct browser calls';
 }
 async function authorize(a,parent,signal){
  signal?.throwIfAborted();if(!parent||ctx.agents.get(parent.id)!==parent)throw Error('Exact live task session required');
  const q=queue.info(a.queueId),job=jobs.get(a.jobId);
  if(!q||q.owner!==parent.id||q.jobId!==a.jobId||q.closed||q.deadline-clock()<=120000)throw Error('Research requires an active owned round with more than two minutes remaining');
  if(!job||job.kind!=='pinterest'||job.sessionId!==parent.id||!['submitted','working'].includes(job.status))throw Error('Research requires the original active Pinterest task');
  const depth=Math.max(parent.options?.subagentDepth||0,parent.session.header.delegationDepth||0);
  if(depth>1||recordFor(parent.id))throw Error('Research recursion is forbidden');
  if(depth===1){const root=ctx.subagents.rootOf(parent);const rows=await ctx.subagents.listDescendants(root.id,signal);if(!rows.some(r=>r.id===parent.id&&r.kind==='child'&&r.mode==='continuable'))throw Error('Continuable child task required');}
  for(const name of researchPolicy.tools)if(!ctx.tools.get(name,parent))throw Error('Required research tool unavailable: '+name);
  return {q,job};
 }
 async function invoke(a,parent,signal){
  if(!a||!/^[-a-zA-Z0-9_]{8,100}$/.test(a.requestId||''))throw Error('Stable research requestId required');
  signal?.throwIfAborted();if(!parent||ctx.agents.get(parent.id)!==parent)throw Error('Exact live task session required');const data=read(),key=keyFor(a),old=data.requests[key];
  if(old){if(old.owner!==parent.id||old.jobId!==a.jobId)throw Error('Research request owner conflict');if(!a.queryOnly&&old.prompt!==a.prompt)throw Error('Research request content changed');return old;}
  if(a.queryOnly)return {status:'unknown',retryable:false,message:'No persisted admission; do not redispatch uncertain research automatically'};
  const {q,job}=await authorize(a,parent,signal);if(typeof a.prompt!=='string'||!a.prompt.trim()||a.prompt.length>5000)throw Error('One research direction required (1–5000 characters)');
  if(Object.values(data.requests).filter(r=>r.queueId===a.queueId).length>=researchPolicy.maxResearchers)throw Error('At most three researchers per queue; reuse original researchers');
  const childId=uuid(),r={owner:parent.id,jobId:a.jobId,queueId:a.queueId,requestId:a.requestId,prompt:a.prompt,childId,status:'admitting',deadline:q.deadline};data.requests[key]=r;await store(data);
  // Reserve before activation so the global guard applies before the first child tool step.
  try{const run=await ctx.subagents.startActivation({provider:'spawn',parent,childId,name:'research-'+createHash('sha256').update(childId).digest('hex').slice(0,12),label:a.prompt.slice(0,80),maxDepth:ctx.subagents.resolveMaxDepth(researchPolicy.maxDepth),signal,delivery:'parent',...(job.modelSelection?{agentOptions:job.modelSelection}:{}),prompt:[{type:'text',text:['Pinterest只读研究代理；禁止递归委派、直接浏览器、命令执行、写文件或收藏。','任务ID：'+a.jobId,'队列ID：'+a.queueId,'共用截止时间：'+new Date(q.deadline).toISOString(),'方向：'+a.prompt,'仅用 pinterest_queue search（queueId固定）→ read_image 实际查看返回截图 → enqueue reviewed=true附具体可见理由。首批60–90秒回传，不等整轮结束。status可查队列。图片不可见则报告不能筛选，不凭标题凑数。到截止前2分钟停止新搜索。只回传候选与限制，收藏由队列所有者执行。'].join('\n')}]});r.status='started';r.childId=run.childId;runs.add(run);run.result.finally(()=>runs.delete(run)).catch(e=>ctx.logger?.warn?.('Pinterest research settlement failed: %s',String(e.message||e)));}
  catch(e){r.status='uncertain';r.error=String(e.message||e);r.retryable=false;}
  await store(data);return r;
 }
 return {policy:researchPolicy,recordFor,guard,async authorizedReader(q,session){const r=recordFor(session);return !!r&&r.owner===q.owner&&r.queueId===q.id&&r.jobId===q.jobId;},execute(a,parent,signal){const p=tail.then(()=>invoke(a,parent,signal));tail=p.catch(()=>{});return p;},async close(){await tail;await Promise.all([...runs].map(run=>run.dispose?.()));runs.clear();}};
}
