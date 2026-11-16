import { createHash, randomUUID } from 'node:crypto';

export function contextName(owner) {
  return `dsh-session-${createHash('sha256').update(owner).digest('hex').slice(0, 32)}`;
}
export function normalizeOpen(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['url', 'storage'].includes(key))) throw new Error('Expected url and optional storage.');
  if (typeof input.url !== 'string' || input.url.length > 8192) throw new Error('url must be a URL of at most 8192 characters.');
  const url = new URL(input.url);
  if (!['http:', 'https:'].includes(url.protocol) && url.href !== 'about:blank') throw new Error('Only HTTP(S) and about:blank are supported.');
  if (url.username || url.password) throw new Error('Credentials in URLs are not supported.');
  const storage = input.storage ?? 'session';
  if (!['session', 'shared'].includes(storage)) throw new Error('storage must be session or shared.');
  return { url: url.href, storage };
}
export function textsOf(result) {
  const texts = [];
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'text' && typeof item === 'string') texts.push(item);
      else visit(item);
    }
  };
  visit(result.value ?? result.content);
  return texts;
}
export function selectedPage(result) {
  const matches = textsOf(result).flatMap(text => [...text.matchAll(/^(\d+):[^\r\n]*\[selected\]/gm)]);
  if (matches.length !== 1) throw new Error('The new page could not be identified; do not guess a page ID.');
  return Number(matches[0][1]);
}
export function pageSnapshot(result) {
  const candidates = textsOf(result).flatMap(text => [...text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)]);
  if (candidates.length !== 1) throw new Error('Unexpected browser inspection response.');
  const data = JSON.parse(candidates[0][1]);
  if (!data || typeof data.origin !== 'string' || typeof data.title !== 'string' || !['loading','interactive','complete'].includes(data.readyState)) throw new Error('Invalid browser page snapshot.');
  return { origin: data.origin.slice(0, 512), title: data.title.slice(0, 240), readyState: data.readyState };
}
const CHECK_PAGE = '() => ({title:document.title.slice(0,240),origin:location.origin,readyState:document.readyState})';

export function createHub(tools) {
  async function invoke(exec, name, args) {
    if (!exec.agent?.id) throw new Error('A live session caller is required.');
    if (exec.signal.aborted) throw new Error('Browser operation cancelled.');
    const result = await tools.execute({ name, arguments: args, agent: exec.agent, signal: exec.signal, callId: randomUUID(), rootCallId: exec.rootCallId, parent: exec.token });
    if (result.isError) throw new Error(`${name}: ${result.error?.message ?? 'operation failed'}`);
    return result;
  }
  return {
    async open(input, exec) {
      const {url, storage} = normalizeOpen(input);
      if (!exec.agent?.id) throw new Error('A live session caller is required.');
      // Do not create untracked pages when the ownership guard is absent.
      if (!tools.get('background_browser_pages', exec.agent)) throw new Error('Browser session guard is unavailable.');
      const result = await invoke(exec, 'mcp__background_browser__new_page', { url, background: true, ...(storage === 'session' ? {isolatedContext: contextName(exec.agent.id)} : {}) });
      return { pageId: selectedPage(result), storage, persistence: storage === 'shared' ? 'shared-profile' : 'temporary-browser-context', accountStatus: 'not-checked' };
    },
    async status(input, exec) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'inspect_pages') || input.inspect_pages !== undefined && typeof input.inspect_pages !== 'boolean') throw new Error('Expected optional inspect_pages boolean.');
      if (!exec.agent?.id) throw new Error('A live session caller is required.');
      const inspect = input.inspect_pages ?? false;
      const names = ['background_browser_pages', 'mcp__background_browser__new_page', 'mcp__background_browser__evaluate_script'];
      const unavailable = names.filter(name => !tools.get(name, exec.agent));
      if (unavailable.length) return { registered: false, unavailable, connection: 'not-probed', accountStatus: 'not-checked', pages: [], truncated: false };
      const list = await invoke(exec, 'background_browser_pages', {});
      const pageIds = list.value?.pageIds;
      if (!Array.isArray(pageIds) || pageIds.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error('Invalid owned-page response.');
      const pages = [];
      for (const pageId of pageIds.slice(0, 12)) {
        if (!inspect) { pages.push({ pageId, state: 'not-probed' }); continue; }
        try {
          const snapshot = pageSnapshot(await invoke(exec, 'mcp__background_browser__evaluate_script', { pageId, function: CHECK_PAGE, waitForStableDom: false }));
          pages.push({ pageId, state: 'readable', ...snapshot });
        } catch (error) {
          if (exec.signal.aborted) throw error;
          pages.push({ pageId, state: 'unavailable', reason: String(error.message).slice(0, 300) });
        }
      }
      return { registered: true, unavailable: [], connection: !inspect || !pages.length ? 'not-probed' : pages.every(page => page.state === 'readable') ? 'pages-readable' : 'partial-or-unavailable', accountStatus: 'not-checked', pages, truncated: pageIds.length > 12 };
    }
  };
}
