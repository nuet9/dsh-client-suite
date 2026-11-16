import { wrapExecutor } from './core.js';
export const inject = ['tools', 'systemPrompt', 'ptcRuntime'];
export async function apply(ctx, config) {
  const { PtcExecutor } = await import(config.executorModule);
  if (typeof PtcExecutor !== 'function') throw new Error('PTC executor export unavailable');
  ctx.tools.setExecutor(wrapExecutor(new PtcExecutor(ctx, { maxParallelSubCalls: 10 })));
}
