export const settingsParameters={type:'object',properties:{action:{type:'string',enum:['list','models','save']},parentSessionId:{type:'string'},childSessionId:{type:'string'},revision:{type:'integer',minimum:0},title:{type:'string',maxLength:100},modelSelection:{type:'object',properties:{provider:{type:'string'},model:{type:'string'}},required:['provider','model'],additionalProperties:false}},required:['action','parentSessionId'],additionalProperties:false};
export function settingsSpec(z){return {name:'agent_chat_preferences',version:1,tables:{preferences:{valueSchema:z.object({parentSessionId:z.string(),title:z.string(),revision:z.number().int().nonnegative(),modelSelection:z.object({provider:z.string(),model:z.string()}).nullable()})}}};}
export class ChatPreferences {
 constructor(ctx,table){this.ctx=ctx;this.table=table;this.tail=Promise.resolve();}
 async authorize(a,caller,signal,browser=false){
  if(browser){if(!a||typeof a.parentSessionId!=='string'||!a.parentSessionId)throw Error('Select a main conversation');const header=await this.ctx.sessionQuery.inspectSession(a.parentSessionId,s=>({...s.header}),signal);if(!header||header.origin==='subagent')throw Error('Settings require a main conversation');const rows=await this.ctx.subagents.listDescendants(a.parentSessionId,signal);signal?.throwIfAborted();return rows.filter(r=>r.kind==='child'&&r.mode==='continuable');}
  if(!a||caller?.id!==a.parentSessionId||this.ctx.agents.get(caller.id)!==caller||this.ctx.subagents.rootOf(caller)!==caller)throw Error('Settings require the exact main conversation');
  const rows=await this.ctx.subagents.listDescendants(caller.id,signal);signal?.throwIfAborted();return rows.filter(r=>r.kind==='child'&&r.mode==='continuable');
 }
 run(a,caller,signal){const task=this.tail.then(()=>this.execute(a,caller,signal));this.tail=task.catch(()=>{});return task;}
 runBrowser(a,signal){const task=this.tail.then(()=>this.execute(a,{id:a?.parentSessionId},signal,true));this.tail=task.catch(()=>{});return task;}
  async execute(a,caller,signal,browser=false){
   const rows=await this.authorize(a,caller,signal,browser);
  if(a.action==='models')return {catalog:await this.ctx.sessionController.modelCatalog()};
  if(a.action==='list')return {preferences:Object.fromEntries(rows.map(row=>[row.id,this.table.get(row.id)||{parentSessionId:caller.id,title:'',revision:0,modelSelection:null}]))};
  if(a.action!=='save'||!rows.some(r=>r.id===a.childSessionId))throw Error('Select a continuable child in this conversation');
  const old=this.table.get(a.childSessionId)||{parentSessionId:caller.id,title:'',revision:0,modelSelection:null};
  if(a.revision!==old.revision)throw Error('Settings changed; reload before saving');
  if(a.title===undefined&&a.modelSelection===undefined)throw Error('No settings to save');
  if(a.title!==undefined&&(typeof a.title!=='string'||!a.title.trim()||a.title.trim().length>100))throw Error('Name must contain 1–100 characters');
  let selection=old.modelSelection;
  if(a.modelSelection!==undefined){const v=a.modelSelection;if(!v||typeof v.provider!=='string'||!v.provider.trim()||v.provider.length>200||typeof v.model!=='string'||!v.model.trim()||v.model.length>300)throw Error('Invalid model selection');
   const catalog=await this.ctx.sessionController.modelCatalog();if(!catalog.groups.some(g=>g.id===v.provider&&g.models.some(m=>m.id===v.model)))throw Error('Model is not currently available');selection={provider:v.provider,model:v.model};
  }
  signal?.throwIfAborted();
  if(!browser&&this.ctx.agents.get(caller.id)!==caller)throw Error('Main conversation is no longer available');
  const next={parentSessionId:caller.id,title:a.title===undefined?old.title:a.title.trim(),revision:old.revision+1,modelSelection:selection};
  await this.table.put(a.childSessionId,next);
  let applied=false,warning;
  if(a.modelSelection!==undefined){const child=this.ctx.agents.get(a.childSessionId);if(child){try{if(this.ctx.subagents.rootOf(child).id!==caller.id)throw Error('Child owner changed');child.model.select(selection);applied=true;}catch(e){warning='Saved for next activation: '+String(e.message||e);}}}
  return {childSessionId:a.childSessionId,preference:next,modelState:a.modelSelection===undefined?'unchanged':applied?'next-request':'next-activation',...(warning?{warning}:{})};
 }
 // Cold children are not resumed just to edit settings. Replay their saved choice before queued work starts.
 created(agent){const row=this.table.get(agent.id);if(!row?.modelSelection||agent.session.header.origin!=='subagent')return;if(this.ctx.subagents.rootOf(agent).id!==row.parentSessionId)return;agent.model.select(row.modelSelection);}
 async close(){await this.tail;}
}
