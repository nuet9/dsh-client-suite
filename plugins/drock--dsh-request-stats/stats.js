export const KEY = 'drockRequestStats';
export const VERSION = 2;
export const TIME_ZONE = 'Asia/Shanghai';
const zero = () => ({ total: 0, success: 0, failed: 0, interrupted: 0 });
// Beijing is UTC+08:00 year-round; never depend on Host/browser local time.
export function requestDay(time) {
  if (typeof time !== 'number' || !Number.isSafeInteger(time)) return null;
  const date = new Date(time + 8 * 60 * 60 * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  const key = date.toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}
function bump(row, field, interrupted) {
  return { ...row, total: row.total + 1, [field]: row[field] + 1, interrupted: row.interrupted + (interrupted ? 1 : 0) };
}
function bumpModel(rows, provider, model, field, interrupted) {
  const models = rows.slice();
  const i = models.findIndex(r => r.provider === provider && r.model === model);
  const row = i < 0 ? { provider, model, ...zero() } : models[i];
  const updated = bump(row, field, interrupted);
  if (i < 0) models.push(updated); else models[i] = updated;
  return models;
}
export function initStats(_header, inheritedEventCount) {
  return { ...zero(), version: VERSION, timeZone: TIME_ZONE, turns: 0, models: [], days: [], ownedFrom: Number(inheritedEventCount), route: null, lastTurn: null, seq: -1 };
}
export function statsView(s) {
  return { version: s.version, timeZone: s.timeZone, total: s.total, success: s.success, failed: s.failed, interrupted: s.interrupted, turns: s.turns, models: s.models, days: s.days, seq: s.seq };
}
export function applyStats(s, e) {
  if (e.type === 'request/header') {
    const { provider, model } = e.data.header.config;
    return { ...s, route: { provider, model } };
  }
  if (e.type === 'request/context' && s.route === null) {
    const { provider, model } = e.data;
    return { ...s, route: { provider, model } };
  }
  if (e.seq < s.ownedFrom || (e.type !== 'assistant/message' && e.type !== 'assistant/attempt')) return s;
  const source = e.type === 'assistant/message' ? e.data.message.source : s.route;
  const provider = source?.provider ?? '(unknown)', model = source?.model ?? '(unknown)';
  const interrupted = e.type === 'assistant/message' && e.data.interrupted === true;
  const field = e.type === 'assistant/attempt' || interrupted ? 'failed' : 'success';
  const models = bumpModel(s.models, provider, model, field, interrupted);
  const date = requestDay(e.time);
  const days = s.days.slice();
  const i = days.findIndex(r => r.date === date);
  const day = i < 0 ? { date, ...zero(), models: [] } : days[i];
  const updated = { ...bump(day, field, interrupted), models: bumpModel(day.models, provider, model, field, interrupted) };
  if (i < 0) days.push(updated); else days[i] = updated;
  return { ...bump(s, field, interrupted), turns: s.turns + (s.lastTurn === e.data.turn ? 0 : 1), lastTurn: e.data.turn, seq: Number(e.seq), models, days };
}
export function createSchemas(z) {
  const counters = z.object({total:z.number().int().nonnegative(),success:z.number().int().nonnegative(),failed:z.number().int().nonnegative(),interrupted:z.number().int().nonnegative()});
  const modelSchema = counters.extend({provider:z.string(),model:z.string()});
  const daySchema = counters.extend({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),models:z.array(modelSchema)});
  const viewSchema = counters.extend({version:z.literal(VERSION),timeZone:z.literal(TIME_ZONE),turns:z.number().int().nonnegative(),models:z.array(modelSchema),days:z.array(daySchema),seq:z.number().int().min(-1)});
  return {viewSchema,stateSchema:viewSchema.extend({ownedFrom:z.number().int().nonnegative(),route:z.object({provider:z.string(),model:z.string()}).nullable(),lastTurn:z.number().nullable()})};
}
