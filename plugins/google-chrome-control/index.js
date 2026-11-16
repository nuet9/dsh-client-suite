import { createController } from './controller.js';
import { connectChrome } from './transport.js';
export const inject = ['tools'];
const object = properties => ({ type: 'object', additionalProperties: false, properties });
const empty = object({});
const pageId = { type: 'string', maxLength: 64, description: 'Owned pageId returned by google_chrome_open in this session.' };
const output = { schema: { type: 'object', additionalProperties: true }, render: (_, value) => [{ type: 'text', text: JSON.stringify(value) }] };
export const definitions = [
  ['status', 'Read connection state and this session\'s owned page IDs. Does not connect or list user tabs.', empty],
  ['connect', 'Explicitly connect to everyday Google Chrome and retain one connection across calls. May request manual Chrome permission. Never launches Chrome. Disconnection requires another explicit connect.', empty],
  ['open', 'Open an HTTP(S) task page in the background using the connected everyday Chrome account. Returns a session-owned pageId. Accounts remain shared; avoid concurrent account writes.', { ...object({ url: { type: 'string', maxLength: 8192, description: 'HTTP(S) URL without embedded credentials.' } }), required: ['url'] }],
  ['read', 'Read bounded title, URL and visible text from a session-owned task page. Requires an existing connection.', { ...object({ pageId, maxChars: { type: 'integer', minimum: 100, maximum: 20000, default: 12000, description: 'Maximum text characters.' } }), required: ['pageId'] }],
  ['evaluate', 'Run a JavaScript function on a session-owned task page; returns bounded JSON and a truncation flag. May modify the page or submit account actions; external writes require user authorization. Not a security sandbox.', { ...object({ pageId, function: { type: 'string', maxLength: 20000, description: 'Zero-argument JavaScript function expression, optionally async. Return concise JSON. No focus, popups, downloads or new windows.' } }), required: ['pageId', 'function'] }],
  ['close', 'Close only a task page owned by this session.', { ...object({ pageId }), required: ['pageId'] }],
  ['disconnect', 'Disconnect the shared plugin connection without closing Chrome or tabs. Invalidates all task-page ownership, including other sessions; use only when no other plugin task is active.', empty]
];
export function apply(ctx) {
  const controller = createController(connectChrome);
  ctx.effect(() => {
    const disposers = definitions.map(([method, description, parameters]) => ctx.tools.register({
      name: `google_chrome_${method}`, description, parameters, output, timeoutMs: 60000,
      async execute(args, exec) {
        const properties = parameters.properties;
        if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(key => !(key in properties))) throw new Error('INVALID_ARGUMENTS');
        for (const key of parameters.required || []) if (!(key in args)) throw new Error('INVALID_ARGUMENTS');
        for (const [key, value] of Object.entries(args)) {
          const rule = properties[key];
          if ((rule.type === 'string' && (typeof value !== 'string' || value.length > rule.maxLength)) || (rule.type === 'integer' && (!Number.isInteger(value) || value < rule.minimum || value > rule.maximum))) throw new Error('INVALID_ARGUMENTS');
        }
        try { return await controller[method](args, exec); }
        catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (/^[A-Z_]+$/.test(message) || message.startsWith('CONNECT_FAILED:')) throw new Error(message);
          throw new Error('CHROME_OPERATION_FAILED: explicit connect may be required.');
        }
      }
    }));
    return async () => { for (const dispose of disposers) dispose(); await controller.dispose(); };
  });
}
