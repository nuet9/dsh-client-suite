// Mirrors the built-in first-token reading and open-step boundaries. Only the
// extra denominator and excluded TTFT observations are projected; raw data stays intact.
export const TARGET = { provider: 'tynuet9-2', model: 'claude-opus-5-5' };
export const TARGET_MODELS = ['claude-haiku-5-5', 'claude-opus-5', 'claude-opus-5-5', 'claude-sonnet-5-5'];
export const KEY = 'localClaudeThroughputCorrection';
export function firstTokenTime(stream) {
  for (const r of stream ?? []) {
    if (r.type === 'chunk') {
      const c = r.chunk;
      if (((c.type === 'text-delta' || c.type === 'reasoning-delta') && c.text !== '') ||
          (c.type === 'tool-call-delta' && (c.argumentsDelta !== '' || c.name !== undefined))) return r.time;
    } else {
      if (r.type === 'tool-call-chunks' && r.name !== undefined) return r.time0;
      const fragments = r.type === 'tool-call-chunks' ? r.args : r.texts;
      let time = r.time0;
      for (let i = 0; i < fragments.length; i++) {
        if (i > 0) time += r.dt[i - 1];
        if (fragments[i] !== '') return time;
      }
    }
  }
}
export function init() {
  return { extraDecodeMs: 0, excludedTtftMs: 0, excludedTtftSteps: 0, correctedSteps: 0, openStep: null };
}
export function view(s) {
  return { extraDecodeMs: s.extraDecodeMs, excludedTtftMs: s.excludedTtftMs,
    excludedTtftSteps: s.excludedTtftSteps, correctedSteps: s.correctedSteps };
}
export function apply(s, e) {
  if (e.type === 'step/start') return { ...s, openStep: { turn: e.data.turn, step: e.data.step, startTime: e.time, firstTokenTime: null } };
  if (e.type === 'step/end') return s.openStep === null ? s : { ...s, openStep: null };
  if (e.type !== 'assistant/attempt' && e.type !== 'assistant/message') return s;
  const open = s.openStep;
  if (!open || open.turn !== e.data.turn || open.step !== e.data.step) return s;
  const first = open.firstTokenTime ?? firstTokenTime(e.data.stream) ?? null;
  if (e.type === 'assistant/attempt') {
    return open.firstTokenTime !== null || first === null ? s : { ...s, openStep: { ...open, firstTokenTime: first } };
  }
  const next = { ...s, openStep: null };
  const source = e.data.message?.source;
  if (source?.provider !== TARGET.provider || !TARGET_MODELS.includes(source?.model) || first === null) return next;
  const wall = Math.max(0, e.time - open.startTime);
  const decode = Math.max(0, e.time - first);
  // This is an observed buffered-delivery heuristic, not a reconstructed decode clock.
  if (wall <= 0 || decode / wall >= 0.35) return next;
  const tokens = e.data.usage?.outputTokens;
  const hasUsage = typeof tokens === 'number' && Number.isFinite(tokens) && tokens >= 0;
  return { ...next, extraDecodeMs: s.extraDecodeMs + (hasUsage ? wall - decode : 0),
    excludedTtftMs: s.excludedTtftMs + Math.max(0, first - open.startTime),
    excludedTtftSteps: s.excludedTtftSteps + 1, correctedSteps: s.correctedSteps + 1 };
}
export function correctStats(stats, correction) {
  if (!stats || !correction || correction.correctedSteps === 0) return stats;
  return { ...stats, decodeMs: stats.decodeMs + correction.extraDecodeMs,
    ttftMs: Math.max(0, stats.ttftMs - correction.excludedTtftMs),
    ttftSteps: Math.max(0, stats.ttftSteps - correction.excludedTtftSteps) };
}
