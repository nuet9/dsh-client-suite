import { z } from 'zod';
import { KEY, VERSION, initStats, applyStats, statsView, createSchemas } from './stats.js';
import { createHistoryHandler } from './history-api.js';
import { createCacheSpec } from './cache-spec.js';
export const inject = ['sessionProjections', 'sessionQuery', 'connection', 'storageDomain', 'sessions', 'sessionPersistence'];
export async function apply(ctx) {
  const { stateSchema, viewSchema } = createSchemas(z);
  const projection = await ctx.sessionProjections.register({key:KEY,stateVersion:VERSION,stateSchema,init:initStats,apply:applyStats,wire:{viewSchema,view:statsView,summary:true}});
  ctx.effect(() => () => projection.dispose());
  let cache=null,openError=null;
  try {
    cache=await ctx.storageDomain.open(createCacheSpec(z,viewSchema));
    ctx.effect(()=>()=>cache.close());
  } catch(error) {openError=error instanceof Error?error.message:String(error);}
  const unregister=ctx.connection.fetch.register({path:'/api/drock-request-stats',methods:['GET','POST'],requestBody:'buffered',fetch:createHistoryHandler(ctx,projection,cache,openError)});
  ctx.effect(()=>unregister);
}
