import { randomUUID } from 'node:crypto';

const fail = code => { throw new Error(code); };
const ownerOf = exec => typeof exec?.agent?.id === 'string' && exec.agent.id ? exec.agent.id : fail('SESSION_REQUIRED');
const safeUrl = value => {
  if (typeof value !== 'string' || value.length > 8192) fail('INVALID_URL');
  let url; try { url = new URL(value); } catch { fail('INVALID_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('INVALID_URL');
  return url.href;
};
function deadline(promise, ms, expired) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => { expired(); reject(new Error('TIMEOUT')); }, ms); })]).finally(() => clearTimeout(timer));
}

export function createController(connect, { connectMs = 45000, operationMs = 25000 } = {}) {
  let browser, connecting, disposed = false, generation = 0, tail = Promise.resolve(), queued = 0;
  const owned = new Map();
  const drop = () => { generation++; const old = browser; browser = undefined; owned.clear(); if (old) { try { old.disconnect(); } catch {} } };
  const requireBrowser = () => {
    if (disposed) fail('PLUGIN_DISPOSED');
    if (!browser?.connected) fail('EXPLICIT_CONNECT_REQUIRED');
    return browser;
  };
  const pageOf = (id, owner) => {
    const entry = owned.get(id);
    if (!entry || entry.owner !== owner) fail('PAGE_NOT_OWNED');
    return entry;
  };
  function enqueue(work) {
    if (disposed) return Promise.reject(new Error('PLUGIN_DISPOSED'));
    if (queued >= 16) return Promise.reject(new Error('QUEUE_FULL'));
    queued++;
    const run = tail.then(() => deadline(Promise.resolve().then(work), operationMs, drop));
    tail = run.catch(() => {}).finally(() => { queued--; });
    return run;
  }
  async function session(entry, work) {
    const b = requireBrowser();
    const target = await b.waitForTarget(target => target._targetId === entry.targetId, { timeout: 10000 }).catch(() => undefined);
    if (!target) { owned.delete(entry.id); fail('PAGE_GONE'); }
    const cdp = await target.createCDPSession();
    try { return await work(cdp); } finally { await cdp.detach().catch(() => {}); }
  }
  const api = {
    status(_, exec) {
      const owner = ownerOf(exec);
      return Promise.resolve({ connected: Boolean(browser?.connected), connecting: Boolean(connecting), pages: [...owned.values()].filter(p => p.owner === owner).map(p => p.id), disposed });
    },
    async connect(_, exec) {
      ownerOf(exec);
      if (disposed) fail('PLUGIN_DISPOSED');
      if (browser?.connected) return { connected: true, reused: true };
      if (connecting) return connecting;
      const epoch = generation;
      const pending = Promise.resolve().then(connect).then(async candidate => {
        if (disposed || epoch !== generation) { await candidate.disconnect(); fail('CONNECT_CANCELLED'); }
        browser = candidate;
        candidate.on('disconnected', () => { if (browser === candidate) { browser = undefined; owned.clear(); generation++; } });
        return { connected: true, reused: false };
      });
      connecting = deadline(pending, connectMs, () => { generation++; }).catch(error => {
        const code = /^[A-Z_]+$/.test(error?.message || '') ? error.message : /^[A-Z_]+$/.test(error?.code || '') ? error.code : 'TRANSPORT_ERROR';
        fail(`CONNECT_FAILED: ${code}`);
      });
      const attempt = connecting;
      const settled = () => { if (connecting === attempt) connecting = undefined; };
      pending.then(settled, settled);
      return attempt;
    },
    open(args, exec) {
      const owner = ownerOf(exec), url = safeUrl(args.url);
      return enqueue(async () => {
        const b = requireBrowser(), epoch = generation, cdp = await b.target().createCDPSession();
        if ([...owned.values()].filter(p => p.owner === owner).length >= 32) { await cdp.detach(); fail('PAGE_LIMIT'); }
        let targetId;
        try {
          ({ targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', background: true }));
          if (disposed || epoch !== generation || browser !== b) fail('CONNECTION_CHANGED');
          const id = randomUUID(), entry = { id, targetId, owner };
          owned.set(id, entry);
          await session(entry, client => client.send('Page.navigate', { url }));
          return { pageId: id, url };
        } catch {
          if (targetId) { for (const [id, p] of owned) if (p.targetId === targetId) owned.delete(id); await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); }
          fail('OPEN_FAILED');
        } finally { await cdp.detach().catch(() => {}); }
      });
    },
    read(args, exec) {
      const owner = ownerOf(exec);
      return enqueue(() => session(pageOf(args.pageId, owner), async cdp => {
        const limit = args.maxChars ?? 12000;
        if (!Number.isInteger(limit) || limit < 100 || limit > 20000) fail('INVALID_LIMIT');
        const response = await cdp.send('Runtime.evaluate', { expression: `JSON.stringify({url:location.href.slice(0,8192),title:document.title.slice(0,512),text:(document.body?.innerText||'').slice(0,${limit}),truncated:(document.body?.innerText||'').length>${limit}})`, returnByValue: true, timeout: 15000 });
        if (response.exceptionDetails) fail('READ_FAILED');
        return JSON.parse(response.result.value);
      }));
    },
    evaluate(args, exec) {
      const owner = ownerOf(exec);
      if (typeof args.function !== 'string' || args.function.length > 20000) fail('INVALID_FUNCTION');
      return enqueue(() => session(pageOf(args.pageId, owner), async cdp => {
        // Bound serialization in the page before CDP transfers the result to the Host.
        const expression = `(async()=>{const value=await (${args.function})();let budget=16000,nodes=0,truncated=false;const seen=new WeakSet();function trim(v,d=0){if(++nodes>500||d>6||budget<=0){truncated=true;return null;}if(v==null||typeof v==='boolean')return v??null;if(typeof v==='number')return Number.isFinite(v)?v:null;if(typeof v==='string'){let s=v.slice(0,Math.max(0,Math.min(4000,budget)));budget-=s.length;if(s.length<v.length)truncated=true;return s;}if(typeof v!=='object')return null;if(seen.has(v)){truncated=true;return null;}seen.add(v);if(Array.isArray(v)){if(v.length>100)truncated=true;return v.slice(0,100).map(x=>trim(x,d+1));}const out={};let count=0;for(const k in v){if(!Object.prototype.hasOwnProperty.call(v,k))continue;if(++count>50||budget<=0){truncated=true;break;}let key=k.slice(0,128);budget-=key.length;try{Object.defineProperty(out,key,{value:trim(v[k],d+1),enumerable:true});}catch{truncated=true;}}return out;}return JSON.stringify({value:trim(value),truncated});})()`;
        const response = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 15000, userGesture: false });
        if (response.exceptionDetails || typeof response.result?.value !== 'string') fail('EVALUATE_FAILED');
        if (response.result.value.length > 65536) fail('OUTPUT_TOO_LARGE');
        return JSON.parse(response.result.value);
      }));
    },
    close(args, exec) {
      const owner = ownerOf(exec);
      return enqueue(async () => {
        const entry = pageOf(args.pageId, owner), b = requireBrowser(), cdp = await b.target().createCDPSession();
        try { await cdp.send('Target.closeTarget', { targetId: entry.targetId }); owned.delete(entry.id); return { closed: true }; }
        finally { await cdp.detach().catch(() => {}); }
      });
    },
    async disconnect(_, exec) { ownerOf(exec); generation++; await tail; drop(); return { connected: false }; },
    async dispose() { disposed = true; generation++; await tail; drop(); }
  };
  return api;
}
