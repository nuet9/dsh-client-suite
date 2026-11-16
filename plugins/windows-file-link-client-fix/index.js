import {writeFile} from 'node:fs/promises';
export const inject=['clientModules'];
export function apply(ctx,config){
 ctx.effect(()=>ctx.clientModules.onGraphChanged(()=>{writeFile(config.graphReport,JSON.stringify({pid:process.pid,entries:ctx.clientModules.graph().entries.map(x=>({id:x.id,url:x.url}))},null,2)).catch(()=>{});}));
 writeFile(config.graphReport,JSON.stringify({pid:process.pid,entries:ctx.clientModules.graph().entries.map(x=>({id:x.id,url:x.url}))},null,2)).catch(()=>{});
}
