import { Ownership } from './ownership.js';
export const inject = ['tools', 'systemPrompt'];

export function apply(ctx) {
  const ownership = new Ownership();
  let generation;
  const synchronize = () => {
    const current = ctx.tools.get('mcp__background_browser__new_page');
    if (current !== generation) { ownership.reset(); generation = current; }
  };
  ctx.effect(() => ctx.tools.guard(exec => {
    synchronize();
    return ownership.check(exec);
  }));
  // Register pages before any caller can receive and reuse the returned ID.
  let tail = Promise.resolve();
  ctx.on('tools/execute', async (exec, next) => {
    if (!exec.name.startsWith('mcp__background_browser__')) return next();
    const previous = tail;
    let release;
    tail = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      synchronize();
      const denial = ownership.check(exec);
      if (denial) throw new Error(denial);
      if (exec.signal.aborted) throw new Error('Browser call cancelled before dispatch.');
      const result = await next();
      ownership.observe(exec, result);
      return result;
    } finally { release(); }
  });
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next();
    if (!exec.name.startsWith('mcp__background_browser__') || decision.kind !== 'accept' || result.isError) return decision;
    const value = Object.hasOwn(decision, 'value') ? decision.value : result.value;
    if (value === undefined) return decision;
    const { content, ...rest } = decision;
    return { ...rest, value: ownership.sanitize(value, exec.agent?.id) };
  });
  ctx.effect(() => ctx.tools.register({
    name: 'background_browser_pages',
    description: 'List the background-browser page IDs registered to this session. New pages are registered automatically; existing unregistered pages cannot be claimed.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'object', properties: { pageIds: { type: 'array', items: { type: 'integer' } } }, required: ['pageIds'], additionalProperties: false },
      render: (_, value) => [{ type: 'text', text: JSON.stringify(value) }]
    },
    async execute(_, exec) { synchronize(); return { pageIds: ownership.list(exec.agent?.id) }; },
    isConcurrencySafe: () => true
  }));
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'background-browser-session-routing', order: 850,
    text: 'Background browser: create a new task page with mcp__background_browser__new_page. Only page IDs created by this session after the guard loaded can be used. Use background_browser_pages instead of global list_pages. No ownership transfer between parent/child sessions. Browser accounts remain shared; do not perform concurrent account writes. The guard is an operational routing check, not an OS or account security boundary.'
  }));
  return () => ownership.reset();
}
