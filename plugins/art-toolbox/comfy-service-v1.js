import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const jobs = new Map();
const script = fileURLToPath(new URL('./comfy-process-v1.ps1', import.meta.url));
function processCall(operation, force = false) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Operation', operation, ...(force ? ['-Force'] : [])], { windowsHide: true, encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr.trim() || error.message));
      try { resolve(JSON.parse(stdout.replace(/^\uFEFF/, '').trim())); } catch { reject(new Error(`Invalid Comfy process response: ${stdout}`)); }
    });
  });
}
/** Fixed production installation; injectable adapters are for regression tests only. */
export function comfyService(options = {}) {
  const inspect = options.inspect || (() => processCall('status'));
  const start = options.start || (() => processCall('start'));
  const stop = options.stop || (({ force }) => processCall('stop', force));
  const url = options.url || 'http://127.0.0.1:8188';
  const key = options.key || url;
  const request = options.fetch || globalThis.fetch;
  const timeout = options.timeoutMs || 1500;
  const base = (s = {}) => ({ state: 'stopped', url, pids: [], queueRunning: null, queuePending: null, ...s });
  async function json(path) {
    const response = await request(`${url}${path}`, { signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  async function status() {
    const info = base(await inspect());
    if (info.state === 'conflict' || info.state === 'error') return info;
    if (!info.pids.length) return info;
    try {
      const stats = await json('/system_stats');
      if (!stats || typeof stats.system !== 'object') return base({ ...info, state: 'conflict', message: 'Port owner does not expose valid ComfyUI system stats' });
      info.state = 'running';
      try {
        const q = await json('/queue');
        if (!Array.isArray(q.queue_running) || !Array.isArray(q.queue_pending)) throw new Error('Invalid queue');
        info.queueRunning = q.queue_running.length; info.queuePending = q.queue_pending.length;
      } catch { info.message = 'Queue unknown; normal stop is refused'; }
    } catch { info.state = 'starting'; }
    return info;
  }
  async function execute(operation, { force = false } = {}) {
    if (!['status', 'start', 'stop'].includes(operation)) throw new TypeError('Unsupported Comfy operation');
    if (operation === 'status') { try { return await status(); } catch (error) { return base({ state: 'error', message: error.message }); } }
    if (jobs.has(key)) {
      const active = jobs.get(key);
      if (active.operation === operation && active.force === force) return active.promise;
      await active.promise;
      return execute(operation, { force });
    }
    const job = (async () => {
      try {
        const current = await status();
        if (['conflict', 'error'].includes(current.state)) return current;
        if (operation === 'start') {
          if (current.state !== 'stopped') return current;
          return base(await start());
        }
        if (current.state === 'stopped') return current;
        if (!force && (current.queueRunning === null || current.queuePending === null || current.queueRunning > 0 || current.queuePending > 0)) return { ...current, requiresConfirmation: true, message: 'Stop refused: queue busy or unknown; force required' };
        return base(await stop({ force }));
      } catch (error) { return base({ state: 'error', message: error.message }); }
    })();
    const entry = { operation, force, promise: null };
    entry.promise = job.finally(() => { if (jobs.get(key) === entry) jobs.delete(key); });
    jobs.set(key, entry);
    return entry.promise;
  }
  return { execute };
}
