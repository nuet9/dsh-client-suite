import { statsView } from './stats.js';
const errorText = error => (error instanceof Error ? error.message : String(error)).slice(0,4000);
const json = (value,status=200) => Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const isNotFound=(error,id)=>error?.code==='SESSION_QUERY_SESSION_NOT_FOUND'||(error?.name==='SessionPersistenceNotFoundError'&&error.sessionId===id);
// Pure adapter over inspected services. Never interpret an arbitrary 422/message as deletion.
export function createHistoryHandler(ctx,projection,cache,openError=null,now=Date.now) {
  const snapshots=cache?.table('snapshots'),failures=cache?.table('failures');
  const writes=new Map(),missingIds=new Set();
  async function commit(id,fn){const task=(writes.get(id)||Promise.resolve()).catch(()=>{}).then(fn);writes.set(id,task);try{return await task;}finally{if(writes.get(id)===task)writes.delete(id);}}
  async function exists(id,signal){signal?.throwIfAborted();if(ctx.sessions.get(id)!==undefined)return true;const snapshot=await ctx.sessionPersistence.stat(id,{signal});signal?.throwIfAborted();return ctx.sessions.get(id)!==undefined||snapshot!==undefined;}
  async function forget(id){missingIds.add(id);let cacheError=cache?null:openError;try{if(snapshots)await snapshots.delete(id);if(failures)await failures.delete(id);}catch(error){cacheError=errorText(error);}return json({code:'SESSION_NOT_FOUND',sessionId:id,error:'Conversation no longer exists',cacheError},404);}
  return async function fetch(request) {
    const admission=ctx.connection.admit(request);
    if('rejection' in admission)return new Response('Unauthorized',{status:admission.rejection});
    if(admission.peer.principal.kind!=='owner')return new Response('Forbidden',{status:403});
    const query=new URL(request.url).searchParams;
    if(request.method==='POST'&&query.get('cache')==='error'){
      let value;try{value=await request.json();}catch{return json({error:'Invalid JSON'},400);}
      if(!value||typeof value.id!=='string'||!value.id||value.id.length>256||typeof value.message!=='string'||!(value.status===null||(Number.isInteger(value.status)&&value.status>=100&&value.status<=599)))return json({error:'Invalid diagnostic'},400);
      try{return await commit(value.id,async()=>{
        if(!await exists(value.id,request.signal))return forget(value.id);
        if(!failures)return json({error:openError||'Persistent cache unavailable'},503);
        await failures.put(value.id,{title:typeof value.title==='string'?value.title.slice(0,1000):value.id,message:value.message.slice(0,4000),status:value.status,at:now()});return json({saved:true});
      });}catch(error){return json({error:errorText(error)},503);}
    }
    if(request.method!=='GET')return json({error:'Method not allowed'},405);
    if(query.get('cache')==='1'){
      if(!cache)return json({error:openError||'Persistent cache unavailable'},503);
      // Metadata only: reconcile persisted entries without restoring logs or starting agents.
      const ids=new Set([...snapshots.entries(),...failures.entries()].map(([id])=>id));for(const id of missingIds)ids.add(id);
      const unavailable=new Set();let cacheError=null;
      for(const id of ids){try{await commit(id,async()=>{if(!await exists(id,request.signal)){const response=await forget(id);const result=await response.json();if(result.cacheError)cacheError=result.cacheError;}else missingIds.delete(id);});}catch(error){if(request.signal.aborted)return new Response('Cancelled',{status:499});unavailable.add(id);cacheError=errorText(error);}}
      const visible=table=>Object.fromEntries([...table.entries()].filter(([id])=>!missingIds.has(id)&&!unavailable.has(id)));
      return json({snapshots:visible(snapshots),failures:visible(failures),missingIds:[...missingIds],cacheError});
    }
    const id=query.get('sessionId');
    if(!id||id.length>256)return new Response('Invalid sessionId',{status:400});
    const title=(query.get('title')?.trim()||id).slice(0,1000);
    let stats;
    try{
      const absent=await commit(id,async()=>!await exists(id,request.signal)?forget(id):null);if(absent)return absent;
      stats=await ctx.sessionQuery.inspectSession(id,session=>structuredClone(statsView(projection.stateOf(session))),request.signal);
    }catch(error){
      if(request.signal.aborted)return new Response('Cancelled',{status:499});
      if(isNotFound(error,id)){try{const absent=await commit(id,async()=>!await exists(id,request.signal)?forget(id):null);if(absent)return absent;}catch{/* Cannot establish absence: keep the original read failure. */}}
      const message=errorText(error);let cacheError=openError;
      try{const absent=await commit(id,async()=>{if(!await exists(id,request.signal))return forget(id);if(failures)await failures.put(id,{title,message,status:422,at:now()});return null;});if(absent)return absent;}catch(e){cacheError=errorText(e);}
      return json({error:message,cacheError},422);
    }
    const at=now();let cacheError=cache?null:(openError||'Persistent cache unavailable');
    try{
      const absent=await commit(id,async()=>{if(!await exists(id,request.signal))return forget(id);missingIds.delete(id);if(snapshots){const existing=snapshots.get(id);if(!existing||existing.stats.seq<=stats.seq)await snapshots.put(id,{stats,title,at});await failures.delete(id);}return null;});if(absent)return absent;
    }catch(error){cacheError=errorText(error);}
    return json({stats,at,cacheError});
  };
}
