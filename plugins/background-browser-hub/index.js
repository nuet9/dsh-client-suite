import { createHub } from './hub.js';
export const inject = ['tools'];
const jsonOutput = {
  schema: { type: 'object', additionalProperties: true },
  render: (_, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]
};
export function apply(ctx) {
  const hub = createHub(ctx.tools);
  ctx.effect(() => ctx.tools.register({
    name: 'background_browser_open',
    description: 'Open a headless task page with session-temporary or shared-profile storage. Returns its owned page ID. Session storage separates cookies from other contexts but is not a process or security boundary.',
    parameters: { type: 'object', additionalProperties: false, properties: {
      url: {type:'string',maxLength:8192,description:'HTTP(S) URL or about:blank; no embedded credentials.'},
      storage: {type:'string',enum:['session','shared'],default:'session',description:'session (default): temporary context for this session, not inherited by child sessions. shared: existing persistent profile; accounts shared across sessions.'}
    }, required:['url'] },
    output: jsonOutput,
    execute: (args, exec) => hub.open(args, exec)
  }));
  ctx.effect(() => ctx.tools.register({
    name: 'background_browser_status',
    description: 'Check browser-tool availability and list this session\'s first 12 owned pages. Optionally read titles, origins, and document readiness. Does not infer login status or prove the entire browser service is healthy.',
    parameters: {type:'object',additionalProperties:false,properties:{inspect_pages:{type:'boolean',default:false,description:'Read each owned page\'s title, origin, and readiness; false only checks registrations and ownership.'}}},
    output: jsonOutput,
    execute: (args, exec) => hub.status(args, exec)
  }));
}
