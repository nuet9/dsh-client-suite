export const inject = ['tools', 'agents'];
const originals = new WeakMap();
const ROUTE_FIELDS = ['provider', 'model', 'reasoning_effort'];
export function defaultArguments(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Expected subagent arguments');
  const clean = {...args};
  for (const field of ROUTE_FIELDS) {
    const value = clean[field];
    if (value !== undefined && value !== null && value !== '') {
      throw new Error('SUBAGENT_DEFAULT_ROUTE_ONLY: ordinary subagent uses configured child defaults or compatible parent defaults. Do not guess model or reasoning values. Remove provider, model and reasoning_effort together; explicit child model changes belong in child chat settings. No child was started by this call.');
    }
    delete clean[field];
  }
  for (const field of ['cwd', 'name']) if (clean[field] === '' || clean[field] === null) delete clean[field];
  return clean;
}
export function safeDefinition(definition) {
  const original = originals.get(definition) || definition;
  const parameters = structuredClone(original.parameters);
  if (parameters.type !== 'object' || !parameters.properties) throw new Error('Unsupported native subagent parameter schema');
  for (const field of ROUTE_FIELDS) delete parameters.properties[field];
  if (parameters.required) parameters.required = parameters.required.filter(field => !ROUTE_FIELDS.includes(field));
  const safe = {
    ...original,
    description: original.description.replace(/ Omit `provider`, `model`, and `reasoning_effort`[^.]*\./g, '') + ' Uses configured child model defaults, falling back to compatible parent values. Choose an independent child model through child chat settings.',
    parameters,
    execute(args, exec) { return original.execute(defaultArguments(args), exec); },
  };
  originals.set(safe, original);
  return safe;
}
export function apply(ctx) {
  const owned = new Map();
  function attach(agent) {
    if (owned.has(agent)) return;
    const native = ctx.tools.get('subagent', agent);
    if (!native) return;
    const safe = safeDefinition(native);
    const dispose = agent.ctx.effect(() => {
      const unregister = agent.ctx.tools.register(safe);
      return () => { unregister(); owned.delete(agent); };
    });
    owned.set(agent, dispose);
  }
  ctx.on('agent/created', ({agent}) => { attach(agent); });
  ctx.on('agent/pre-step', async (payload, next) => { attach(payload.agent); return next(); });
  ctx.on('agent/disposed', ({agent}) => { owned.get(agent)?.(); owned.delete(agent); });
  ctx.effect(() => () => { for (const dispose of [...owned.values()]) dispose(); owned.clear(); });
  for (const agent of ctx.agents.list()) attach(agent);
}
