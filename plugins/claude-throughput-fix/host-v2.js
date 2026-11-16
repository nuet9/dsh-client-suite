import { z } from 'zod';
import { KEY, init, apply as fold, view } from './metrics.js?scope=four-models-v2';
export const inject = ['sessionProjections'];
export function apply(ctx) {
  const viewSchema = z.object({ extraDecodeMs: z.number().nonnegative(), excludedTtftMs: z.number().nonnegative(),
    excludedTtftSteps: z.number().int().nonnegative(), correctedSteps: z.number().int().nonnegative() });
  ctx.sessionProjections.register({ key: KEY, stateVersion: 2,
    stateSchema: viewSchema.extend({ openStep: z.object({ turn: z.number(), step: z.number(), startTime: z.number(), firstTokenTime: z.number().nullable() }).nullable() }),
    init, apply: fold, wire: { viewSchema, view } });
}
