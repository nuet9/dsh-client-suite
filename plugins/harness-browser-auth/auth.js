// Only the running Host's clean loopback GUI entry is eligible for normal login.
export const NAVIGATION_TOOLS = [
  'mcp__playwright_browser__browser_navigate',
  'mcp__background_browser__navigate_page'
];

export function cleanEntry(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('The advertised GUI entry is not a clean loopback HTTP(S) URL.');
  }
  return url;
}

export function isLoginNavigation(name, args, entry) {
  if (!NAVIGATION_TOOLS.includes(name) || !args || typeof args.url !== 'string') return false;
  if (name === NAVIGATION_TOOLS[1] && args.type && args.type !== 'url') return false;
  let target;
  try { target = new URL(args.url); } catch { return false; }
  return target.origin === entry.origin && target.pathname === entry.pathname &&
    !target.username && !target.password && !target.search && !target.hash;
}

export function scrub(value, signedUrl) {
  const secrets = [signedUrl];
  for (const part of new URL(signedUrl).searchParams.values()) {
    if (part) secrets.push(part, encodeURIComponent(part));
  }
  const visit = item => {
    if (typeof item === 'string') {
      let text = item;
      for (const secret of secrets) text = text.replaceAll(secret, '[redacted]');
      return text;
    }
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([k, v]) => [visit(k), visit(v)]));
    return item;
  };
  return visit(value);
}

export function navigationWrapper(original, services, isLive) {
  return {
    ...original,
    // Preserve schemas, presenters, identity and all normal pre-execute guards.
    async execute(args, exec) {
      if (!isLive()) throw new Error('Browser authentication adapter is no longer active; enable it again.');
      const entry = cleanEntry(services.webApp.getAdvertisedUrl());
      if (!isLoginNavigation(original.name, args, entry)) return original.execute(args, exec);
      exec.signal.throwIfAborted();
      const signedUrl = services.connection.authenticatedUrl(entry.href);
      const signed = new URL(signedUrl);
      if (signed.origin !== entry.origin || signed.pathname !== entry.pathname || signed.username || signed.password) {
        throw new Error('Official authentication entry changed its target; navigation was stopped.');
      }
      try {
        // Only the execution implementation sees the official login URL.
        // exec.arguments remains the admitted clean URL, never a persisted secret.
        const result = await original.execute({ ...args, url: signedUrl }, exec);
        return scrub(result, signedUrl);
      } catch {
        // Upstream errors can echo page.goto arguments. Never propagate them.
        throw new Error('Official GUI login navigation failed. Inspect the clean page URL and browser status; no credentials were returned.');
      }
    }
  };
}
