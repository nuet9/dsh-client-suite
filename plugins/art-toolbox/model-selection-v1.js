import {Toolbox as Repository,parameters as previousParameters,kinds} from './repository-v11.js';
export const parameters=structuredClone(previousParameters);
parameters.properties.action.enum.push('models','saveModel');
parameters.properties.modelSelection={anyOf:[{type:'null'},{type:'object',additionalProperties:false,required:['provider','model'],properties:{provider:{type:'string',minLength:1,maxLength:200},model:{type:'string',minLength:1,maxLength:300}}}],description:'saveModel/start/continue: provider/model route, or null to follow the current conversation. Omit at start to use the saved per-function choice.'};
export {baseSpec,repositorySpec,kinds} from './repository-v11.js';
export function normalizeSelection(value){if(value===null)return null;if(!value||typeof value!=='object'||typeof value.provider!=='string'||!value.provider.trim()||value.provider.length>200||typeof value.model!=='string'||!value.model.trim()||value.model.length>300)throw Error('请选择有效模型');return {provider:value.provider,model:value.model};}
export class Toolbox extends Repository{
 constructor(domain,repoDomain,services){super(domain,repoDomain,{...services,resolveTaskModel:(kind,choice)=>this.resolveTaskModel(kind,choice)});}
 modelSetting(kind){const row=this.settings.get('__model_'+kind);return {selection:row?JSON.parse(row.body):null,revision:row?.revision||0};}
 async resolveTaskModel(kind,choice){const selected=normalizeSelection(choice===undefined?this.modelSetting(kind).selection:choice);if(selected)await this.services.validateModel(selected);return selected;}
 async run(a,signal){
  if(a?.action==='models')return {catalog:await this.services.modelCatalog()};
  if(a?.action==='saveModel'){
   if(!kinds.includes(a.kind))throw Error('Unknown tool');const old=this.modelSetting(a.kind);if(a.revision!==old.revision)throw Error('模型设置已变化，请刷新后重试');
   const selection=normalizeSelection(a.modelSelection);if(selection)await this.services.validateModel(selection);
   await this.settings.put('__model_'+a.kind,{body:JSON.stringify(selection),revision:old.revision+1});return {modelSetting:this.modelSetting(a.kind)};
  }
  const result=await super.run(a,signal);if(a?.action==='get')result.modelSettings=Object.fromEntries(kinds.filter(k=>!a.kind||k===a.kind).map(k=>[k,this.modelSetting(k)]));return result;
 }
}
const equal=(a,b)=>a?.provider===b?.provider&&a?.model===b?.model&&a?.reasoningEffort===b?.reasoningEffort;
// Invoked synchronously after inbox claim, before the driver captures its model.
export function taskModelRouter(jobs){
 const active=new Map();
 return {
  claim({agent,message,turn}){const job=jobs.get(message.source?.rpcId);if(!job?.modelSelection||['completed','failed'].includes(job.status)||job.sessionId!==agent.id||message.source?.kind!=='user')return;
   const previous=agent.model.current();if(!previous)return;
   const existing=active.get(agent.id);active.set(agent.id,{agent,turn,previous:existing?.previous||{...previous},selected:{...job.modelSelection}});agent.model.select(job.modelSelection);
  },
  end(session,event){if(event.type!=='turn/end')return;const record=active.get(session.id);if(!record||record.turn!==event.data.turn)return;active.delete(session.id);if(equal(record.agent.model.current(),record.selected))record.agent.model.select(record.previous);},
  dispose(){for(const record of active.values())if(equal(record.agent.model.current(),record.selected))record.agent.model.select(record.previous);active.clear();}
 };
}
