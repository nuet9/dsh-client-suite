import { createHash, randomUUID } from 'node:crypto';
export const hash = text => createHash('sha256').update(text, 'utf8').digest('hex');
const MAX_FILE = 2 * 1024 * 1024;
const MAX_TOTAL = 8 * 1024 * 1024;
function fail(message) { throw new Error(message); }
function list(xs) { if (!Array.isArray(xs) || !xs.length || xs.length > 64) fail('Expected 1..64 explicit entries'); return xs; }
function text(s) { if (typeof s !== 'string') fail('Expected string'); return s; }
function checkedHash(s) { if (!/^[a-f0-9]{64}$/.test(s)) fail('Expected lowercase SHA-256'); return s; }
export function createFileTools(fs, scope) {
  async function resolve(path) {
    if (!text(path).trim()) fail('Empty path');
    const target = await fs.resolve(path, { cwd: scope.cwd, signal: scope.signal });
    // Restrict every operation to this session workspace, even in Full access.
    const root = await fs.resolve(scope.cwd, { signal: scope.signal });
    if (!fs.contains(root, target)) fail('Path is outside session workspace: ' + path);
    return target;
  }
  async function read(path) {
    const target = await resolve(path);
    const before = await fs.stat(target, scope.signal);
    if (!before || before.type !== 'file') fail('Expected existing regular text file: ' + path);
    if (before.size === undefined || before.size > MAX_FILE) fail('File exceeds 2 MiB or has unknown size: ' + path);
    const content = await fs.readText(target, scope.signal);
    if (content.includes('\u0000') || content.includes('\uFFFD')) fail('Refusing NUL or replacement-character text: ' + path);
    const after = await fs.stat(target, scope.signal);
    if (!after || before.version !== after.version) fail('Concurrent read conflict: ' + path);
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE) fail('File exceeds 2 MiB');
    return { path, target, before: content, after: content, version: after.version, hash: hash(content) };
  }
  function unique(entries) {
    const keys = entries.map(e => e.target.targetKey);
    if (new Set(keys).size !== keys.length) fail('Duplicate file identities/aliases');
    if (entries.reduce((n,e) => n + Buffer.byteLength(e.before) + Buffer.byteLength(e.after),0) > MAX_TOTAL) fail('Batch exceeds 8 MiB');
  }
  function summary(entries) { return entries.map(e => ({ path: e.path, before_hash: e.hash, after_hash: hash(e.after), changed: e.before !== e.after })); }
  async function commit(entries) {
    unique(entries);
    // Validate all versions before the first write; each write also has a provider guard.
    for (const e of entries) {
      const now = await fs.stat(e.target, scope.signal);
      if (!now || now.version !== e.version) fail('Concurrent preflight conflict: ' + e.path);
    }
    const done = [];
    try {
      for (const e of entries) {
        if (e.before === e.after) continue;
        scope.signal?.throwIfAborted();
        const out = await fs.writeText(e.target, e.after, { kind: 'replaceIfVersion', version: e.version }, scope.signal, scope.policy);
        done.push({ ...e, writtenVersion: out.version });
      }
      return { status: 'applied', atomicity: 'per-file; not a cross-file transaction', files: summary(entries) };
    } catch (error) {
      const rollback = [];
      // Cancellation must not prevent compensating writes; policy still applies.
      for (const e of done.reverse()) {
        try {
          await fs.writeText(e.target, e.before, { kind: 'replaceIfVersion', version: e.writtenVersion }, undefined, scope.policy);
          rollback.push({ path: e.path, status: 'restored' });
        } catch (err) { rollback.push({ path: e.path, status: 'conflict-or-failure', error: String(err.message) }); }
      }
      return { status: rollback.some(x => x.status !== 'restored') ? 'rollback-incomplete' : 'failed-rolled-back', error: String(error.message), atomicity: 'per-file; not a cross-file transaction', rollback };
    }
  }
  async function batch(args) {
    const entries = [];
    for (const file of list(args.files)) {
      const e = await read(file.path);
      if (file.expected_hash !== undefined && checkedHash(file.expected_hash) !== e.hash) fail('Hash conflict: ' + file.path);
      for (const edit of list(file.edits)) {
        const old = text(edit.old_text), replacement = text(edit.new_text);
        if (!old) fail('old_text must not be empty');
        const count = e.after.split(old).length - 1;
        if (!count || (!edit.replace_all && count !== 1)) fail('Literal match missing or ambiguous: ' + file.path);
        e.after = edit.replace_all ? e.after.split(old).join(replacement) : e.after.replace(old, () => replacement);
      }
      if (Buffer.byteLength(e.after) > MAX_FILE) fail('Result exceeds 2 MiB');
      entries.push(e);
    }
    unique(entries);
    return args.preview ? { status: 'preview', files: summary(entries) } : commit(entries);
  }
  async function notebook(args) {
    const e = await read(args.path);
    if (args.expected_hash !== undefined && checkedHash(args.expected_hash) !== e.hash) fail('Hash conflict');
    const doc = JSON.parse(e.before);
    if (doc?.nbformat !== 4 || !Array.isArray(doc.cells)) fail('Expected nbformat 4 notebook');
    const seen = new Set();
    for (const edit of list(args.cells)) {
      if (!Number.isInteger(edit.index) || edit.index < 0 || edit.index >= doc.cells.length || seen.has(edit.index)) fail('Invalid or duplicate cell index');
      seen.add(edit.index);
      const cell = doc.cells[edit.index];
      if (!cell || !['code','markdown','raw'].includes(cell.cell_type)) fail('Invalid cell');
      const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
      if (typeof source !== 'string' || (edit.expected_source !== undefined && edit.expected_source !== source)) fail('Cell source conflict');
      const next = text(edit.source);
      cell.source = Array.isArray(cell.source) ? (next.match(/[^\n]*\n|[^\n]+$/g) || []) : next;
    }
    e.after = JSON.stringify(doc, null, 2) + '\n';
    if (Buffer.byteLength(e.after) > MAX_FILE) fail('Result exceeds 2 MiB');
    return args.preview ? { status: 'preview', files: summary([e]) } : commit([e]);
  }
  async function checkpoint(args) {
    const checkpointTarget = await resolve(args.checkpoint_path);
    if (args.action === 'create') {
      const entries = [];
      for (const path of list(args.paths)) entries.push(await read(path));
      unique(entries);
      if (entries.some(e => e.target.targetKey === checkpointTarget.targetKey)) fail('Checkpoint cannot include itself');
      for (const e of entries) { const now = await fs.stat(e.target, scope.signal); if (!now || now.version !== e.version) fail('Concurrent checkpoint conflict'); }
      const doc = { format: 'dev-file-tools-checkpoint-v1', id: randomUUID(), session_id: scope.sessionId, cwd: scope.cwd, files: entries.map(e => ({ path: e.path, hash: e.hash, content: e.before })) };
      const serialized = JSON.stringify(doc);
      if (Buffer.byteLength(serialized) > MAX_FILE) fail('Serialized checkpoint exceeds 2 MiB');
      await fs.writeText(checkpointTarget, serialized + '\n', { kind: 'createIfAbsent' }, scope.signal, scope.policy);
      return { status: 'created', checkpoint_id: doc.id, checkpoint_path: args.checkpoint_path, files: summary(entries) };
    }
    if (!['preview','restore'].includes(args.action)) fail('Unknown checkpoint action');
    const snapshot = await read(args.checkpoint_path);
    const doc = JSON.parse(snapshot.before);
    if (doc.format !== 'dev-file-tools-checkpoint-v1' || doc.session_id !== scope.sessionId || doc.cwd !== scope.cwd) fail('Checkpoint format/session/workspace mismatch');
    list(doc.files);
    const saved = new Map();
    for (const f of doc.files) {
      if (typeof f.path !== 'string' || typeof f.content !== 'string' || hash(f.content) !== f.hash || saved.has(f.path)) fail('Invalid checkpoint entry');
      saved.set(f.path, f);
    }
    const entries = [];
    for (const chosen of list(args.files)) {
      const f = saved.get(chosen.path);
      if (!f) fail('Selected path absent from checkpoint');
      const e = await read(chosen.path);
      if (e.target.targetKey === snapshot.target.targetKey) fail('Checkpoint cannot restore itself');
      if (args.action === 'restore' && checkedHash(chosen.expected_hash) !== e.hash) fail('Restore hash conflict: ' + chosen.path);
      e.after = f.content;
      entries.push(e);
    }
    unique(entries);
    return args.action === 'preview' ? { status: 'preview', checkpoint_id: doc.id, files: summary(entries).map((s,i) => ({ ...s, current_text: entries[i].before.slice(0,1000), restore_text: entries[i].after.slice(0,1000), text_truncated: entries[i].before.length > 1000 || entries[i].after.length > 1000 })) } : commit(entries);
  }
  return { batch, notebook, checkpoint };
}
