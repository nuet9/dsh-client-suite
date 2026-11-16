import {silenceNotificationStream} from './silent-notification-stream.js';

// Runtime-attributed sources only: text that merely resembles a notice never qualifies.
export function isChatNotice(message){
 const s=message?.source;
 return message?.role==='user' && typeof s?.senderSessionId==='string' &&
  ((s.kind==='agent-message'&&s.form==='relay') ||
   (s.kind==='subagent-settled'&&s.form==='notice'&&s.stopReason==='completed'));
}
export function ownedChatSenders(rows,parentId,senders){
 return senders.length>0&&senders.every(id=>rows.some(r=>r.kind==='child'&&r.mode==='continuable'&&r.id===id&&r.parentId===parentId&&r.name==='chat-'+id.slice(0,8)));
}
export function registerSilentNotifications(ctx,{isLoopRequest}){
 const eligible=new Map();
 ctx.on('agent/pre-step',async(payload,next)=>{
  const {agent,turn,step,signal}=payload;
  eligible.delete(agent.id);
  const decision=await next();
  if(decision?.kind!=='enter'||step!==1||!payload.messages?.length||!payload.messages.every(isChatNotice))return decision;
  if(!decision.messages.every(m=>isChatNotice(m)||m.source?.kind==='runtime-context'))return decision;
  try{
   if(ctx.subagents.rootOf(agent)!==agent)return decision;
   // Only the very first claimed inbox batch of this turn. Runtime contexts added
   // by next() are not user input; later tool/steering steps always revoke this.
   const senders=[...new Set(payload.messages.map(m=>m.source.senderSessionId))];
   const rows=await ctx.subagents.listDescendants(agent.id,signal);
   if(ownedChatSenders(rows,agent.id,senders)&&!signal.aborted)eligible.set(agent.id,{turn,step,signal,senders});
  }catch(error){ctx.logger?.warn?.('Silent notification eligibility unavailable; keeping normal error handling: '+String(error?.message||error));}
  return decision;
 });
 ctx.on('llm/stream',(options,next)=>{
  const state=eligible.get(options.sessionId);
  const allow=!!state&&isLoopRequest(options)&&options.signal===state.signal;
  return silenceNotificationStream(next(),{allow,signal:options.signal,onSuppressed:failure=>{
   ctx.logger?.warn?.('agent-chat silent notification completion '+JSON.stringify({sessionId:options.sessionId,turn:state.turn,step:state.step,senders:state.senders,failure}));
  }});
 });
 ctx.on('agent/status',({agent,status})=>{if(status==='idle')eligible.delete(agent.id);});
 ctx.on('agent/disposed',({agent})=>eligible.delete(agent.id));
 ctx.effect(()=>()=>eligible.clear());
}
