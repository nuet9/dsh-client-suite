import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NAVIGATION_TOOLS, cleanEntry, navigationWrapper } from './auth.js';

export const inject = ['tools', 'connection', 'webApp'];

// Resolve from the running installation, not a second copy of dsh-scope.
// Scope ancestry must share the exact Host registry's WeakMap.
export async function apply(ctx) {
  const anchor = process.env.DSH_INSTALL_DIR
    ? join(process.env.DSH_INSTALL_DIR, 'package.json')
    : process.versions.electron && process.resourcesPath
      ? join(process.resourcesPath, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
      : undefined;
  if (!anchor) throw new Error('The running Harness module anchor is unavailable.');
  if (JSON.parse(await readFile(anchor, 'utf8')).name !== '@deepseek-ai/dsh') throw new Error('The running module anchor is not the official Harness package.');
  const require = createRequire(anchor);
  const toolsEntry = require.resolve('@deepseek-ai/dsh-tools');
  const scopeEntry = createRequire(toolsEntry).resolve('@deepseek-ai/dsh-scope');
  const { bindScopeParent } = await import(pathToFileURL(scopeEntry).href);
  install(ctx, bindScopeParent);
}

export function install(ctx, bindScopeParent) {
  const sessions = new WeakMap();
  let active = true;
  ctx.effect(() => () => { active = false; });
  ctx.effect(() => ctx.tools.register({
    name: 'harness_browser_auth',
    description: 'Enable or disable official Harness GUI login for this session\'s existing browser navigation tools. Returns only the clean current loopback URL; never exports tokens or cookies. Create an owned background task page first, then navigate to that clean URL normally. Other websites and API paths are unchanged. No browser starts and no auth setting changes.',
    parameters: {
      type: 'object', properties: { action: { type: 'string', enum: ['enable', 'disable', 'status'] } },
      required: ['action'], additionalProperties: false
    },
    output: {
      schema: {
        type: 'object', properties: { enabled: { type: 'boolean' }, url: { type: 'string' }, tools: { type: 'array', items: { type: 'string' } } },
        required: ['enabled', 'url', 'tools'], additionalProperties: false
      },
      render: (_, value) => [{ type: 'text', text: JSON.stringify(value) }]
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const agent = exec.agent;
      if (!agent?.ctx) throw new Error('This adapter requires a live calling agent scope.');
      const url = cleanEntry(ctx.webApp.getAdvertisedUrl()).href;
      let state = sessions.get(agent);
      if (state && !state.current()) { state.dispose(); sessions.delete(agent); state = undefined; }
      if (args.action === 'disable') {
        if (state) { state.dispose(); sessions.delete(agent); }
        return { enabled: false, url, tools: [] };
      }
      if (args.action === 'enable' && !state) {
        const originals = NAVIGATION_TOOLS.map(name => [name, ctx.tools.executable(name, agent)]).filter(([, tool]) => tool);
        if (!originals.length) throw new Error('No allowed browser navigation tool is available in this session.');
        const probe = {};
        bindScopeParent(probe, agent);
        const disposers = [], records = [];
        state = { disposed: false, tools: [], current: () => active && !state.disposed && records.every(r => ctx.tools.get(r.name) === r.original), dispose() {
          if (state.disposed) return;
          state.disposed = true;
          for (const off of disposers.splice(0).reverse()) off();
        } };
        try {
          for (const [name, original] of originals) {
            if (ctx.tools.get(name) !== original) continue;
            let wrapper;
            // From this blank child scope our wrapper is inherited, so every
            // agent/preset restrict applies. Use get, not executable: our own
            // `when` is conditional and its availability is being computed.
            const live = () => state.current() && ctx.tools.get(name, probe) === wrapper;
            wrapper = navigationWrapper(original, ctx, live);
            disposers.push(agent.ctx.tools.register(wrapper, { when: live }));
            records.push({ name, original });
            state.tools.push(name);
          }
          if (!state.tools.length) throw new Error('Navigation tools already have scope-local adapters; no tool was replaced.');
          disposers.push(ctx.effect(() => state.dispose));
          disposers.push(agent.ctx.effect(() => state.dispose));
          sessions.set(agent, state);
        } catch (error) { state.dispose(); throw error; }
      }
      return { enabled: !!state && state.current(), url, tools: state && state.current() ? state.tools : [] };
    }
  }));
}
