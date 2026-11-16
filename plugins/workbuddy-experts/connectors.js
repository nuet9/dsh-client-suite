import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Preview only: this module never spawns, connects, installs, or reads credential stores.
const OFFICIAL = 'workbuddy-connector-plugins-official';
const REGISTERED = new Set(['tmeet', 'tencent-docs']);
const validId = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.test(id);
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 10);
const sensitive = /token|pass(?:word|wd)?|secret|api[-_]?key|access[-_]?key|private[-_]?key|authorization|credential|signature|session|cookie|auth|^key$|^code$/i;
const unknownTemplate = /\$\{|\{\{|<[^>]+>|\$[A-Z_][A-Z0-9_]*|%[A-Z_][A-Z0-9_]*%/;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const nameFor = identity => {
  const prefix = ('wb_' + identity.replace(/[^A-Za-z0-9_-]/g, '_')).slice(0, 21);
  return prefix + '_' + hash(identity);
};
const ref = (identity, field) => '\u0024{credential:WB_BRIDGE_' + hash(identity + ':' + field).toUpperCase() + '}';
const note = (warnings, text) => { if (!warnings.includes(text)) warnings.push(text); };

async function readJson(root, file) {
  // realpath containment rejects packages redirected outside the supplied WorkBuddy root.
  const base = await fs.realpath(root);
  const target = await fs.realpath(file);
  const relative = path.relative(base, target);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('unsafe-path');
  const stat = await fs.stat(target);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('invalid-size');
  // Deliberately never propagate JSON parser errors: they can quote raw source secrets.
  try { return JSON.parse((await fs.readFile(target, 'utf8')).replace(/^\uFEFF/, '')); }
  catch { throw new Error('invalid-json'); }
}

async function findPackage(wbRoot, id) {
  const market = path.join(wbRoot, 'plugins', 'marketplaces', OFFICIAL, 'connectors', id);
  const candidates = [market];
  // Cache is only a fallback; no registry or credential files are inspected.
  const cache = path.join(wbRoot, 'plugins', 'cache', OFFICIAL, id);
  candidates.push(cache);
  try {
    const versions = await fs.readdir(cache, { withFileTypes: true });
    for (const v of versions.filter(v => v.isDirectory() && validId(v.name)).sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }))) candidates.push(path.join(cache, v.name));
  } catch { /* Optional cache. */ }
  let malformed = false;
  for (const root of candidates) {
    try {
      const manifest = await readJson(wbRoot, path.join(root, '.codebuddy-plugin', 'plugin.json'));
      if (!object(manifest)) { malformed = true; continue; }
      return { root, manifest, source: root === market ? 'official-marketplace' : 'marketplace-cache' };
    } catch (e) { if (e.code !== 'ENOENT') malformed = true; }
  }
  return { source: 'missing', malformed };
}

function cleanUrl(value, identity, field, warnings) {
  if (typeof value !== 'string' || unknownTemplate.test(value)) {
    note(warnings, 'URL 缺失或含未知模板，需要手动补齐。');
    return ref(identity, field);
  }
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('protocol');
    if (url.username || url.password) {
      url.username = ''; url.password = '';
      note(warnings, 'URL 用户名/密码已移除，需要手动配置认证。');
    }
    if (url.hash) { url.hash = ''; note(warnings, 'URL fragment 已移除，请检查服务地址。'); }
    const keys = [...new Set(url.searchParams.keys())];
    for (const key of keys) if (sensitive.test(key)) {
      url.searchParams.set(key, ref(identity, field + ':' + key));
      note(warnings, 'URL 敏感查询参数已替换，需要手动提供 Harness 凭据。');
    }
    return url.toString().replace(/%24%7Bcredential%3A(WB_BRIDGE_[A-F0-9]+)%7D/gi, (_, k) => '\u0024{credential:' + k + '}');
  } catch {
    note(warnings, 'URL 无效，需要手动补齐。');
    return ref(identity, field);
  }
}

function cleanText(value, identity, field, warnings) {
  if (typeof value !== 'string') {
    note(warnings, '配置字段类型无效，需要手动补齐。'); return ref(identity, field);
  }
  if (/https?:\/\//i.test(value)) {
    if (/^https?:\/\//i.test(value) && !/\s/.test(value)) return cleanUrl(value, identity, field, warnings);
    note(warnings, '嵌入 URL 的命令参数需要手动补齐。'); return ref(identity, field);
  }
  if (unknownTemplate.test(value) || /(?:bearer\s+|(?:token|password|passwd|secret|api[-_]?key|access[-_]?key|authorization)\s*[=:])/i.test(value)) {
    note(warnings, '命令或参数中的凭据/模板已替换，需要手动补齐。'); return ref(identity, field);
  }
  return value;
}

function placeholders(value, identity, field, warnings) {
  if (!object(value)) { if (value != null) note(warnings, 'headers/env 格式无效，需要手动补齐。'); return undefined; }
  const result = Object.create(null);
  for (const key of Object.keys(value)) {
    if (!/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(key)) { note(warnings, '已省略不安全的 headers/env 字段名。'); continue; }
    result[key] = ref(identity, field + ':' + key);
  }
  if (Object.keys(result).length) note(warnings, 'headers/env 已全部替换为独立 Harness 凭据占位；未继承 WorkBuddy 值。');
  return Object.keys(result).length ? result : undefined;
}

/** Return native DSH entries for inspection only. ready means no manual fields remain, not connected. */
export async function connectorConfig(wbRoot, id) {
  if (!validId(id)) throw new Error('Invalid connector id');
  if (typeof wbRoot !== 'string' || !wbRoot) throw new Error('Invalid WorkBuddy root');
  const warnings = [], entries = [];
  const pkg = await findPackage(wbRoot, id);
  const result = { id, config: entries, warnings, source: pkg.source, ready: false };
  if (!pkg.root) {
    warnings.push(pkg.malformed ? '连接器清单不可读取或无效。' : '本地市场中未找到连接器。'); return result;
  }
  let data;
  for (const file of ['mcp.json', '.mcp.json']) {
    try { data = await readJson(wbRoot, path.join(pkg.root, file)); break; }
    catch (e) { if (e.code !== 'ENOENT') note(warnings, 'MCP 配置不可读取或 JSON 无效。'); }
  }
  // Some packages declare the same mcpServers map directly in plugin.json.
  if (!data && object(pkg.manifest.mcpServers)) data = { mcpServers: pkg.manifest.mcpServers };
  if (!object(data?.mcpServers) || !Object.keys(data.mcpServers).length) {
    note(warnings, '包未提供 MCP server 配置；可能仅支持 WorkBuddy 本地扩展。'); return result;
  }
  for (const [serverKey, server] of Object.entries(data.mcpServers)) {
    if (!object(server)) { note(warnings, '已跳过格式无效的 MCP server。'); continue; }
    const identity = id + ':' + serverKey;
    const type = server.transport ?? server.type ?? (server.command ? 'stdio' : server.url ? 'streamable-http' : '');
    const transport = type === 'streamableHttp' ? 'streamable-http' : type;
    if (!['stdio', 'streamable-http'].includes(transport)) {
      note(warnings, transport === 'sse' ? 'SSE 传输不受支持，需要服务提供 Streamable HTTP。' : '未知 MCP 传输类型，需要手动转换。'); continue;
    }
    const config = { serverName: nameFor(identity), transport, expandTemplates: true, failOnStartupError: false };
    if (transport === 'streamable-http') {
      config.url = cleanUrl(server.url, identity, 'url', warnings);
      const headers = placeholders(server.headers, identity, 'headers', warnings);
      if (headers) config.headers = headers;
      // Even unused fields must never appear in the generated output.
      if (server.env != null) { placeholders(server.env, identity, 'env', warnings); note(warnings, 'HTTP server 的 env 不适用于原生 HTTP transport，已省略。'); }
    } else {
      config.command = cleanText(server.command, identity, 'command', warnings);
      if (typeof server.command === 'string' && /\s/.test(server.command)) {
        config.command = ref(identity, 'command'); note(warnings, '复合 shell command 需要手动改为可执行文件及 args。');
      }
      if (server.args != null && !Array.isArray(server.args)) note(warnings, 'stdio args 格式无效，需要手动补齐。');
      const args = Array.isArray(server.args) ? server.args : [];
      config.args = args.map((arg, i) => {
        const previous = i ? args[i - 1] : '';
        if (typeof previous === 'string' && /^--?[^=]+$/.test(previous) && sensitive.test(previous.replace(/^--?/, ''))) {
          note(warnings, '凭据命令参数值已替换，需要手动提供 Harness 凭据。'); return ref(identity, 'args:' + i);
        }
        if (typeof arg === 'string' && /^--?[^=]+=/.test(arg) && sensitive.test(arg.slice(0, arg.indexOf('=')).replace(/^--?/, ''))) {
          note(warnings, '凭据命令参数值已替换，需要手动提供 Harness 凭据。'); return arg.slice(0, arg.indexOf('=') + 1) + ref(identity, 'args:' + i);
        }
        return cleanText(arg, identity, 'args:' + i, warnings);
      });
      const env = placeholders(server.env, identity, 'env', warnings);
      if (env) config.env = env;
      if (server.cwd != null) config.cwd = cleanText(server.cwd, identity, 'cwd', warnings);
      if (server.headers != null) { placeholders(server.headers, identity, 'headers', warnings); note(warnings, 'stdio headers 不适用于原生 stdio transport，已省略。'); }
    }
    entries.push({ id: 'mcp-' + config.serverName, name: '@deepseek-ai/dsh-mcp-client', config });
  }
  result.ready = entries.length > 0 && warnings.length === 0;
  note(warnings, '仅生成接入配置，未执行连接、OAuth 或安装；Workbench 注册状态不代表 Harness 已连接。');
  // JSON is a YAML 1.2 subset and preserves literal credential templates without JS tags.
  if (entries.length) result.yaml = JSON.stringify([{ insert: entries }], null, 2) + '\n';
  return result;
}

/** Safe summaries: never expose source manifests, environment values, or request headers. */
export async function discoverConnectors(wbRoot, ids) {
  if (typeof wbRoot !== 'string' || !wbRoot) throw new Error('Invalid WorkBuddy root');
  if (ids == null) {
    try { ids = (await fs.readdir(path.join(wbRoot, 'plugins', 'marketplaces', OFFICIAL, 'connectors'), { withFileTypes: true })).filter(v => v.isDirectory() && validId(v.name)).map(v => v.name); }
    catch { return []; }
  }
  if (!Array.isArray(ids)) throw new Error('Connector ids must be an array');
  const summaries = [];
  for (const id of [...new Set(ids)]) {
    if (!validId(id)) continue;
    const result = await connectorConfig(wbRoot, id);
    const transports = [...new Set(result.config.map(entry => entry.config.transport))];
    summaries.push({ id, title: id, registered: REGISTERED.has(id), status: result.source === 'missing' ? 'missing' : result.config.length ? (result.ready ? 'configuration-ready' : 'manual-setup-required') : 'unavailable', ready: result.ready, source: result.source, serverCount: result.config.length, transports, warnings: result.warnings });
  }
  return summaries;
}
