import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const MAX_BYTES = 10 * 1024 * 1024;
const queues = new Map();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const safeId = id => {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(id) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(id)) fail('INVALID_ID', '工作流ID只允许1–100位字母、数字、下划线和连字符，且不能使用系统保留名');
  return id;
};
const text = (value, name, max = 6000) => {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) fail('INVALID_INPUT', `${name}必须是最多${max}字的字符串`);
  return value;
};
async function atomic(file, bytes) {
  const temp = file + '.' + randomUUID() + '.tmp';
  try { await fs.writeFile(temp, bytes, { flag: 'wx' }); await fs.rename(temp, file); }
  finally { await fs.rm(temp, { force: true }); }
}
async function regular(file) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('UNSAFE_PATH', '需要普通文件，不能使用符号链接');
  return stat;
}
async function readSmall(file) {
  const stat = await regular(file);
  if (stat.size > MAX_BYTES) fail('TOO_LARGE', '输入不得超过10MiB');
  const bytes = await fs.readFile(file);
  if (bytes.length > MAX_BYTES) fail('TOO_LARGE', '输入不得超过10MiB');
  return bytes;
}
function indexWorkflow(doc) {
  if (!object(doc)) fail('INVALID_WORKFLOW', 'JSON不是工作流对象');
  if (Array.isArray(doc.nodes) && Array.isArray(doc.links)) {
    if (!doc.nodes.length) fail('INVALID_WORKFLOW', '工作流不能没有节点');
    const ids = new Set();
    const nodes = doc.nodes.map(n => {
      if (!object(n) || !['string', 'number'].includes(typeof n.id) || String(n.id).length === 0 || !text(n.type, '节点类型', 300)) fail('INVALID_WORKFLOW', 'UI节点需要id和type');
      const id = String(n.id);
      if (ids.has(id)) fail('INVALID_WORKFLOW', '节点ID重复');
      ids.add(id);
      return { nodeId: id, type: n.type, title: text(n.title, '节点标题', 1000), widgets_values: n.widgets_values ?? [], inputs: n.inputs ?? [], outputs: n.outputs ?? [] };
    });
    return { format: 'ui', nodes };
  }
  const prompt = object(doc.prompt) ? doc.prompt : doc;
  const entries = Object.entries(prompt);
  if (!entries.length || entries.some(([id, n]) => !id || !object(n) || typeof n.class_type !== 'string' || !n.class_type || !object(n.inputs))) fail('INVALID_WORKFLOW', '需要UI nodes+links或API prompt工作流；拒绝空JSON和非工作流');
  return { format: 'api', nodes: entries.map(([nodeId, n]) => ({ nodeId, type: n.class_type, title: typeof n._meta?.title === 'string' ? n._meta.title : '', inputs: n.inputs })) };
}
function mergeNotes(old, incoming, nodes) {
  if (incoming === undefined) return old;
  if (!Array.isArray(incoming) || incoming.length > 10000) fail('INVALID_NOTES', 'notes必须是节点注释数组');
  const valid = new Set(nodes.map(n => n.nodeId));
  const result = new Map(old.map(n => [n.nodeId, n]));
  for (const n of incoming) {
    if (!object(n) || !['number', 'string'].includes(typeof n.nodeId) || !valid.has(String(n.nodeId))) fail('INVALID_NODE', '注释nodeId不存在');
    const nodeId = String(n.nodeId), note = { ...(result.get(nodeId) || { nodeId, purpose: '', adjustment: '', warning: '' }) };
    for (const key of ['purpose', 'adjustment', 'warning']) if (n[key] !== undefined) note[key] = text(n[key], key);
    result.set(nodeId, note);
  }
  return [...result.values()];
}
function artifacts(doc, record) {
  const annotated = structuredClone(doc);
  if (record.format === 'ui') {
    const used = new Set(annotated.nodes.map(n => String(n.id)));
    let next = annotated.nodes.reduce((max, n) => Number.isSafeInteger(n.id) ? Math.max(max, n.id) : max, 0);
    for (const note of record.notes) {
      while (used.has(String(++next))) { /* independent ID */ }
      if (!Number.isSafeInteger(next)) fail('INVALID_WORKFLOW', '节点ID超出安全范围');
      const original = annotated.nodes.find(n => String(n.id) === note.nodeId);
      const pos = Array.isArray(original.pos) ? original.pos : [0, 0];
      const content = `节点 ${note.nodeId}\n用途：${note.purpose}\n调整：${note.adjustment}\n注意：${note.warning}`;
      annotated.nodes.push({ id: next, type: 'Note', pos: [(Number(pos[0]) || 0) + 360, Number(pos[1]) || 0], size: [320, 200], flags: {}, order: annotated.nodes.length, mode: 0, inputs: [], outputs: [], properties: {}, widgets_values: [content], title: `说明 · ${note.nodeId}` });
      used.add(String(next));
    }
    annotated.last_node_id = Math.max(Number(annotated.last_node_id) || 0, next);
  }
  const md = [`# ${record.title}：节点调整说明`, '', `格式：${record.format}；版本：${record.revision}`, `源SHA256：${record.sourceSha256}`, '', 'UI widgets_values仅按原序索引，不推测参数名。API工作流只生成此说明，不改写参数。', '', ...record.notes.flatMap(n => [`## 节点 ${n.nodeId}`, '', `用途：${n.purpose}`, '', `调整：${n.adjustment}`, '', `注意：${n.warning}`, ''])].join('\n');
  return { annotated: record.format === 'api' ? null : json(annotated), markdown: Buffer.from(md) };
}

/** File-backed, inference-free ComfyUI workflow library. All actions return promises. */
export function comfyLibrary({ root, comfyRoot = '__DSH_SUITE_ART_TOOLBOX_COMFY_ROOT__/ComfyUI', fetch: fetcher = globalThis.fetch } = {}) {
  if (typeof root !== 'string' || !root) fail('INVALID_ROOT', '需要库root目录');
  root = path.resolve(root); comfyRoot = path.resolve(comfyRoot);
  const dirFor = id => path.join(root, safeId(id));
  async function load(id) {
    const dir = dirFor(id);
    try {
      const stat = await fs.lstat(dir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail('UNSAFE_PATH', '库条目不能是符号链接');
      const record = JSON.parse((await readSmall(path.join(dir, 'record.json'))).toString('utf8'));
      if (record.id !== id || !Number.isSafeInteger(record.revision) || record.revision < 1) fail('CORRUPT_RECORD', '记录结构损坏');
      const source = await readSmall(path.join(dir, 'source.json'));
      if (sha256(source) !== record.sourceSha256) fail('SOURCE_INTEGRITY', 'source.json完整性校验失败');
      const doc = JSON.parse(source.toString('utf8').replace(/^\uFEFF/, ''));
      const indexed = indexWorkflow(doc);
      return { dir, record, source, doc, nodes: indexed.nodes };
    } catch (e) { if (e.code === 'ENOENT') fail('NOT_FOUND', '工作流不存在'); throw e; }
  }
  function pathsFor(dir, revision) {
    const versionDir = path.join(dir, 'revisions', String(revision));
    return { source: path.join(dir, 'source.json'), record: path.join(dir, 'record.json'), annotated: path.join(versionDir, 'annotated.json'), notes: path.join(versionDir, '节点调整说明.md') };
  }
  function detail(v) { return { record: v.record, nodes: v.nodes, notes: v.record.notes, paths: pathsFor(v.dir, v.record.revision) }; }
  async function version(dir, doc, source, record) {
    const target = path.join(dir, 'revisions', String(record.revision));
    const stage = path.join(dir, 'revisions', '.tmp-' + randomUUID());
    const data = artifacts(doc, record);
    if ((data.annotated || source).length > MAX_BYTES || json(record).length > MAX_BYTES || data.markdown.length > MAX_BYTES) fail('TOO_LARGE', '注释生成文件不得超过10MiB');
    await fs.mkdir(stage, { recursive: true });
    try {
      await fs.writeFile(path.join(stage, 'annotated.json'), data.annotated || source, { flag: 'wx' });
      await fs.writeFile(path.join(stage, '节点调整说明.md'), data.markdown, { flag: 'wx' });
      await fs.writeFile(path.join(stage, 'record.json'), json(record), { flag: 'wx' });
      // An interrupted attempt may leave an uncommitted version; never overwrite it.
      try { await fs.rename(stage, target); }
      catch (e) { if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(e.code)) throw e; fail('VERSION_EXISTS', '版本目录已存在，请检查上次中断的写入'); }
      // record.json is the commit point. Readers use immutable revision artifacts.
      await atomic(path.join(dir, 'annotated.json'), data.annotated || source);
      await atomic(path.join(dir, '节点调整说明.md'), data.markdown);
      await atomic(path.join(dir, 'record.json'), json(record));
    } finally { await fs.rm(stage, { recursive: true, force: true }); }
  }
  async function run(a) {
    if (!object(a)) fail('INVALID_INPUT', '需要动作对象');
    if (a.action === 'import') {
      const id = safeId(a.id ?? randomUUID());
      if ((typeof a.sourcePath === 'string') === (typeof a.jsonText === 'string')) fail('INVALID_INPUT', 'sourcePath和jsonText必须且只能提供一个');
      if (typeof a.sourcePath === 'string' && !path.isAbsolute(a.sourcePath)) fail('INVALID_INPUT', 'sourcePath必须是本机绝对路径');
      const source = typeof a.sourcePath === 'string' ? await readSmall(path.resolve(a.sourcePath)) : Buffer.from(a.jsonText, 'utf8');
      if (source.length > MAX_BYTES) fail('TOO_LARGE', '输入不得超过10MiB');
      let doc; try { doc = JSON.parse(source.toString('utf8').replace(/^\uFEFF/, '')); } catch { fail('INVALID_JSON', 'JSON解析失败'); }
      const { format, nodes } = indexWorkflow(doc), sourceSha256 = sha256(source);
      let old; try { old = await load(id); } catch (e) { if (e.code !== 'NOT_FOUND') throw e; }
      if (old) { if (old.record.sourceSha256 !== sourceSha256) fail('ID_CONFLICT', '相同ID已关联不同源内容'); return { ...detail(old), existing: true }; }
      const title = text(a.title, 'title', 300).trim() || id;
      if (a.tags !== undefined && (!Array.isArray(a.tags) || a.tags.length > 50 || a.tags.some(t => typeof t !== 'string' || t.length > 100))) fail('INVALID_INPUT', 'tags无效');
      if (a.parentId !== undefined) { safeId(a.parentId); if (a.parentId === id) fail('INVALID_INPUT', 'parentId不能指向自身'); await load(a.parentId); }
      const now = new Date().toISOString();
      const record = { id, title, summary: text(a.summary, 'summary'), verification: text(a.verification, 'verification'), sourceSessionId: text(a.sourceSessionId, 'sourceSessionId', 300), sourcePath: typeof a.sourcePath === 'string' ? path.resolve(a.sourcePath) : null, tags: a.tags || [], parentId: a.parentId || null, format, revision: 1, sourceSha256, sourceBytes: source.length, nodeCount: nodes.length, createdAt: now, updatedAt: now, notes: mergeNotes([], a.notes, nodes) };
      const stage = path.join(root, '.import-' + randomUUID()), dir = dirFor(id);
      await fs.mkdir(stage);
      try { await fs.writeFile(path.join(stage, 'source.json'), source, { flag: 'wx' }); await version(stage, doc, source, record); await fs.rename(stage, dir); }
      finally { await fs.rm(stage, { recursive: true, force: true }); }
      return { ...detail({ dir, record, nodes }), existing: false };
    }
    if (a.action === 'list') {
      const offset = a.offset ?? 0, limit = a.limit ?? 20;
      if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail('INVALID_INPUT', '分页要求offset>=0，limit为1–100');
      const query = text(a.query, 'query', 1000).trim().toLowerCase();
      const items = [], errors = [];
      for (const entry of await fs.readdir(root, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        try {
          const v = await load(entry.name), r = v.record;
          const displayTerms = {
            'cloud-tile-success-00002-20261116':'云形细化 保留整体构图 分块调整云形与细节 用户认可恢复',
            'cloud-small-two-pass-20261116':'整图重塑＋细节补充 先调整整图云形 再分块补充细节 未实跑',
            'cloud-dual-bright-shadow-20261116':'亮部替换 只换亮部 保留原暗灰 未实跑',
            'cloud-working-exposure-experiment-20261116':'暗部纹理回注 临时提亮生成纹理 回注原图光色 实验未验',
            'cloud-tile-history-20261116':'初始暗部保护 早期切块细化 暗部回混 历史方案',
            'cloud-interior-flux1-failed-20261116':'面内纹理 FLUX1 失败对照 暗部内部仍大片平滑',
            'cloud-interior-klein9b-failed-20261116':'面内纹理 Klein9B 失败对照 轮廓增强 面内仍空'
          }[r.id] || '';
          if (query && ![r.id, r.title, r.summary, displayTerms, ...r.tags, ...v.nodes.map(n => `${n.nodeId} ${n.type} ${n.title}`)].join('\n').toLowerCase().includes(query)) continue;
          const { notes, ...record } = r;
          items.push({ ...record, noteCount: notes.length, nodes: v.nodes.map(({ nodeId, type, title }) => ({ nodeId, type, title })) });
        } catch (e) { errors.push({ id: entry.name, code: e.code || 'CORRUPT_RECORD', message: e.message }); }
      }
      items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      return { items: items.slice(offset, offset + limit), total: items.length, offset, limit, hasMore: offset + limit < items.length, errors, root };
    }
    if (!['detail', 'annotate', 'install', 'check'].includes(a.action)) fail('INVALID_ACTION', '未知工作流库动作');
    const v = await load(safeId(a.id));
    if (a.action === 'detail') return detail(v);
    if (a.action === 'annotate') {
      if (!Number.isSafeInteger(a.revision) || a.revision !== v.record.revision) fail('REVISION_CONFLICT', '版本冲突，请刷新后重试');
      const record = { ...v.record, revision: v.record.revision + 1, updatedAt: new Date().toISOString(), notes: mergeNotes(v.record.notes, a.notes, v.nodes) };
      await version(v.dir, v.doc, v.source, record);
      return detail({ ...v, record });
    }
    if (a.action === 'install') {
      const bytes = await readSmall(pathsFor(v.dir, v.record.revision).annotated);
      const installDir = path.join(comfyRoot, 'user', 'default', 'workflows', '美术工具箱');
      await fs.mkdir(comfyRoot, { recursive: true });
      // Check each directory before creating its children, so a redirected user
      // directory cannot cause even a preparatory write outside this tree.
      for (const relative of ['user', 'user/default', 'user/default/workflows', 'user/default/workflows/美术工具箱']) {
        const directory = path.join(comfyRoot, relative);
        try { await fs.mkdir(directory); } catch (e) { if (e.code !== 'EEXIST') throw e; }
        const stat = await fs.lstat(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink()) fail('UNSAFE_PATH', '安装目录不能经过符号链接');
      }
      let installedPath = path.join(installDir, `${v.record.id}.json`), existing = false;
      const staging = path.join(installDir, '.install-' + randomUUID() + '.tmp');
      await fs.writeFile(staging, bytes, { flag: 'wx' });
      try {
        for (let index = 0; ; index++) {
          if (index > 0) installedPath = path.join(installDir, `${v.record.id}-r${v.record.revision}-${sha256(bytes).slice(0, 12)}${index > 1 ? '-' + index : ''}.json`);
          // Hard-link the complete file: exclusive and atomic, unlike a direct
          // write or rename (which can replace the user's modified destination).
          try { await fs.link(staging, installedPath); break; }
          catch (e) { if (e.code !== 'EEXIST') throw e; try { if (sha256(await readSmall(installedPath)) === sha256(bytes)) { existing = true; break; } } catch (err) { if (err.code !== 'UNSAFE_PATH' && err.code !== 'TOO_LARGE') throw err; } }
        }
      } finally { await fs.rm(staging, { force: true }); }
      return { id: v.record.id, revision: v.record.revision, installedPath, existing, queued: false, message: '已安装。请在ComfyUI工作流列表中加载；未排队、未执行推理。', format: v.record.format };
    }
    const base = { id: v.record.id, revision: v.record.revision, endpoint: 'http://127.0.0.1:8188/object_info', queued: false };
    let info;
    try {
      if (typeof fetcher !== 'function') throw Error('fetch不可用');
      const response = await fetcher(base.endpoint, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      info = await response.json();
      if (!object(info)) throw Error('object_info响应无效');
    } catch (e) { return { ...base, online: false, status: 'offline', message: `ComfyUI离线或object_info不可用：${e.message}。未启动服务、下载模型或执行推理。`, missingNodeTypes: [], modelInputs: [] }; }
    const missingNodeTypes = [...new Set(v.nodes.filter(n => !['Note', 'MarkdownNote'].includes(n.type) && !Object.hasOwn(info, n.type)).map(n => n.type))];
    const modelInputs = [];
    if (v.record.format === 'api') for (const n of v.nodes) {
      const schema = info[n.type]?.input;
      for (const [name, value] of Object.entries(n.inputs)) {
        if (!/(model|ckpt|checkpoint|lora|vae|clip|unet|control_net)/i.test(name) || typeof value !== 'string') continue;
        const declaration = schema?.required?.[name] ?? schema?.optional?.[name];
        const choices = declaration?.[0];
        modelInputs.push({ nodeId: n.nodeId, type: n.type, input: name, value, available: Array.isArray(choices) ? choices.includes(value) : null, ...(Array.isArray(choices) ? {} : { reason: 'object_info未提供此命名输入的可选列表' }) });
      }
    }
    const nodeTypesAvailable = missingNodeTypes.length === 0;
    const compatible = v.record.format === 'ui' ? null : nodeTypesAvailable && modelInputs.every(m => m.available === true);
    const status = !nodeTypesAvailable ? 'missing-or-unverified' : v.record.format === 'ui' ? 'nodes-available-models-unverified' : compatible ? 'compatible' : 'missing-or-unverified';
    return { ...base, online: true, status, compatible, nodeTypesAvailable, missingNodeTypes, modelInputs, limitations: v.record.format === 'ui' ? ['UI widgets_values没有可靠参数名，未检查模型输入；只检查节点类型。'] : ['仅核对object_info声明的节点类型与命名模型输入选项；不代表实际推理成功。'], message: '只读检查完成；未下载、启动或排队推理。' };
  }
  return { execute(a) {
    const previous = queues.get(root) || Promise.resolve();
    const task = previous.catch(() => {}).then(async () => { await fs.mkdir(root, { recursive: true }); return run(a); });
    queues.set(root, task);
    task.finally(() => { if (queues.get(root) === task) queues.delete(root); }).catch(() => {});
    return task;
  } };
}
