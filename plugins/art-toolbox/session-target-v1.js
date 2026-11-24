// A SessionId is opaque. Routing is determined by the native target, not its prefix.
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value;
export function normalizeSessionTarget(a) {
  if (!identity(a?.sessionId)) throw Error('请先打开一个已创建的对话');
  const t = a.sessionTarget ?? {kind:'session',sessionId:a.sessionId};
  if (t?.kind === 'session' && t.sessionId === a.sessionId) return {kind:'session',sessionId:a.sessionId};
  if (t?.kind === 'subagent' && identity(t.parentSessionId) && t.childSessionId === a.sessionId && t.parentSessionId !== t.childSessionId) {
    if (t.mode !== 'continuable') throw Error('此子代理不能续聊，请切换到可继续对话的代理');
    return {kind:'subagent',parentSessionId:t.parentSessionId,childSessionId:t.childSessionId,mode:'continuable'};
  }
  throw Error('对话目标不匹配，请重新打开工具箱');
}
export async function validateSessionTarget(a, services, signal) {
  const target = normalizeSessionTarget(a);
  const header = await services.header(a.sessionId, signal);
  if (header.id !== a.sessionId) throw Error('对话目标不存在');
  if (target.kind === 'session') {
    if (header.origin === 'subagent') throw Error('子代理对话缺少原生目标，请重新打开工具箱');
  } else {
    if (header.origin !== 'subagent') throw Error('对话目标不是子代理');
    const rows = await services.descendants(target.parentSessionId, signal);
    const child = rows.find(row => row.id === target.childSessionId);
    if (!child || child.mode !== 'continuable') throw Error('子代理不可续聊或不属于此主对话');
  }
  return target;
}
export async function targetForAgent(agent, subagents, signal) {
  const root = subagents.rootOf(agent);
  if (root.id === agent.id) return {kind:'session',sessionId:agent.id};
  const rows = await subagents.listDescendants(root.id, signal);
  const child = rows.find(row => row.id === agent.id);
  if (!child) throw Error('当前子代理不可用');
  return normalizeSessionTarget({sessionId:agent.id,sessionTarget:{kind:'subagent',parentSessionId:root.id,childSessionId:agent.id,mode:child.mode}});
}
export function routePrompt(request, target, services, signal) {
  if (target.kind === 'subagent') return services.childPrompt({requestId:request.requestId,childSessionId:target.childSessionId,delivery:request.mode,content:request.content,...(request.clientTimeZone ? {clientTimeZone:request.clientTimeZone} : {})}, signal);
  const {sessionTarget:_target,...ordinary} = request;
  return services.sessionPrompt(ordinary, signal);
}
export async function admitTaskPrompt(request, target, selected, services, signal) {
  let r = request;
  if (r.content.some(p => p.type === 'image')) {
    const current = await services.currentModel(target, signal);
    const infos = await Promise.all([...(selected ? [selected] : []),...(current ? [current] : [])].map(v => services.modelInfo(v)));
    if (infos.some(v => v.inputModalities && !v.inputModalities.includes('image'))) r = {...r,content:r.content.filter(p => p.type !== 'image').map(p => p.type === 'text' ? {...p,text:p.text+'\n参考图片已保存到上述本机路径。开始制作前用可用的视觉工具读取原图；无视觉能力时报告阻碍，不能仅凭文字猜测。'} : p)};
  }
  return routePrompt(r, target, services, signal);
}
 export const sessionTargetSchema = {oneOf:[{type:'object',additionalProperties:false,required:['kind','sessionId'],properties:{kind:{const:'session'},sessionId:{type:'string'}}},{type:'object',additionalProperties:false,required:['kind','parentSessionId','childSessionId','mode'],properties:{kind:{const:'subagent'},parentSessionId:{type:'string'},childSessionId:{type:'string'},mode:{enum:['continuable','one-shot','unknown']}}}]};
