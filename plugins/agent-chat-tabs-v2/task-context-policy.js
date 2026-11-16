// Task dispatch and ordinary chat creation have different history/ownership contracts.
const TASK_ROUTE = 'agent_chat_create 是普通聊天入口，不是任务派发入口。需要任务代理时，仅使用当前工具清单中可用且深度允许的原生 subagent，prompt 只提供任务说明、必要资料和验收标准。不要改填主会话 ID、自动代办或反复重试。';
export function taskContextGuard(exec,ctx){
  if(exec.name==='subagent_fork')return {reason:'任务代理必须使用全新上下文。禁止 subagent_fork 继承父对话历史；请使用 subagent，并在 prompt 中仅提供当前调用者下发的任务说明、必要资料和验收标准。已有继承型任务代理不会被自动清理。',info:{name:'TaskContextPolicy',code:'TASK_CONTEXT_INHERITANCE_DISABLED'}};
  if(exec.name!=='agent_chat_create')return undefined;
  const caller=exec.agent;
  let root;
  try{
    if(!caller?.id||ctx?.agents?.get(caller.id)!==caller)throw Error('Caller is not live');
    root=ctx.subagents.rootOf(caller);
    if(!root)throw Error('Root is not live');
  }catch{
    return {reason:'普通聊天创建需要有效的 live caller 和主树 root；当前身份不可用，未创建任何代理。'+TASK_ROUTE,info:{name:'TaskContextPolicy',code:'CHAT_CREATION_CALLER_UNAVAILABLE'}};
  }
  if(root!==caller)return {reason:'子代理对话不能通过 agent_chat_create 创建普通兄弟聊天；这不等于不能派发任务。'+TASK_ROUTE,info:{name:'TaskContextPolicy',code:'CHILD_CHAT_USE_NATIVE_SUBAGENT'}};
  return undefined;
}
export function taskRoutingText(ctx,context){
  const scope=context?.scope;
  // tools.get checks scoped registration visibility, not per-step admission/depth.
  const visible=scope?ctx.tools.get('subagent',scope):undefined;
  return '## 任务代理与普通聊天入口\n'+
    '界面的“任务代理”按钮仅展开任务列表，不是创建任务按钮。agent_chat_create 仅用于用户明确要求的新普通聊天，可能携带近期上下文、摘要或继承父历史，不用于无历史任务派发。普通聊天创建仍要求真实主树 root，子对话不得把 caller 冒充为主会话。\n'+
    (visible?'当前 scope 注册了原生 subagent。派发独立任务时选择当前模型工具清单里可用的 subagent，在当前允许的委派深度内调用；一级子对话也可在权限和深度允许时派发二级任务。只填写 description、prompt 和必要的 name/cwd；可选字段未指定就省略，勿发送空 provider/model/reasoning_effort 或猜测推理档位。具体字段、模型默认路由和授权以当前原生工具定义为准。\n':'当前 scope 未发现原生 subagent 注册；不得声称任务一定可派发，也不能改用聊天创建或 fork 绕过。\n')+
    'spawn 任务不自动继承父对话历史，仍有系统/preset 指令、环境信息以及调用者主动放入 prompt 的材料；这不是文件/进程隔离。任务不得使用 subagent_fork。深度、权限、provider 或 root 不可用时报告实际错误，不自动重派发、不借主代理绕过限制。';
}
export function registerTaskContextPolicy(ctx){
  ctx.tools.guard(exec=>taskContextGuard(exec,ctx));
  ctx.systemPrompt.section({name:'local-agent-chat-task-routing',order:950,text:context=>taskRoutingText(ctx,context)});
}
