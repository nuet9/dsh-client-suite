import { randomUUID } from 'node:crypto';
import { defaults } from './defaults.js';
export const parameters={type:'object',additionalProperties:false,required:['action'],properties:{action:{type:'string',enum:['list','get','save','delete']},id:{type:'string',description:'Required for get/delete; omit on save to create.'},query:{type:'string',description:'Optional text filter for list.'},title:{type:'string'},group:{type:'string',description:'Workflow collection name, 1–80 characters. Defaults to the existing collection or 未分组.'},stage:{type:'string',enum:['start','iterate','finish','other']},body:{type:'string',description:'Full prompt text for save, up to 20000 characters.'},revision:{type:'integer',description:'Required current revision for updating or deleting an existing prompt.'}}};
export function spec(z){return {name:'workflow_prompts',version:1,tables:{prompts:{valueSchema:z.object({id:z.string(),title:z.string().min(1).max(120),group:z.string().min(1).max(80).optional(),stage:z.enum(['start','iterate','finish','other']),body:z.string().min(1).max(20000),revision:z.number().int().positive(),updatedAt:z.string()})}},global:{schema:z.object({seeded:z.boolean()}),initial:{seeded:false}}};}
export const groupOf=x=>x.group||(['start','iterate','finish'].includes(x.id)?'概念设计流程提示词':'未分组');
export class Library {
 constructor(domain){this.domain=domain;this.table=domain.table('prompts');this.tail=Promise.resolve();}
 async seed(){if(!this.domain.global.get().seeded){for(const item of defaults)if(!this.table.get(item.id))await this.table.put(item.id,{...item,revision:1,updatedAt:new Date().toISOString()});await this.domain.global.set({seeded:true});}}
 execute(args){const job=this.tail.then(()=>this.run(args));this.tail=job.catch(()=>{});return job;}
 async run(a){if(!a||typeof a!=='object')throw Error('Invalid request');const summary=x=>({id:x.id,title:x.title,group:groupOf(x),stage:x.stage,revision:x.revision,updatedAt:x.updatedAt});
 if(a.action==='list'){const q=String(a.query||'').toLowerCase();return {items:[...this.table.entries()].map(([,v])=>v).filter(v=>(groupOf(v)+' '+v.title+' '+v.body).toLowerCase().includes(q)).map(summary)};}
 const old=typeof a.id==='string'?this.table.get(a.id):undefined;
 if(a.action==='get'){if(!old)throw Error('Prompt not found');return {item:{...old,group:groupOf(old)}};}
 if(a.action==='save'){
  if(typeof a.title!=='string'||!a.title.trim()||a.title.length>120)throw Error('Title must contain 1–120 characters');
  if(typeof a.body!=='string'||!a.body.trim()||a.body.length>20000)throw Error('Prompt must contain 1–20000 characters');
  if(!['start','iterate','finish','other'].includes(a.stage))throw Error('Invalid stage');
  if(a.id&&!old)throw Error('Prompt not found; omit id to create');
  if(old&&a.revision!==old.revision)throw Error('Revision conflict: reload before saving');
  if(!old&&this.table.size>=500)throw Error('Library limit: 500 prompts');
  const group=a.group===undefined?(old?groupOf(old):'未分组'):a.group;
  if(typeof group!=='string'||!group.trim()||group.length>80)throw Error('Group must contain 1–80 characters');
  const item={group:group.trim(),id:old?.id||randomUUID(),title:a.title.trim(),stage:a.stage,body:a.body,revision:(old?.revision||0)+1,updatedAt:new Date().toISOString()};await this.table.put(item.id,item);return {item};
 }
 if(a.action==='delete'){if(!old)throw Error('Prompt not found');if(a.revision!==old.revision)throw Error('Revision conflict: reload before deleting');await this.table.delete(old.id);return {deleted:old.id};}
 throw Error('Unknown action');
 }
 async close(){await this.tail;}
}
