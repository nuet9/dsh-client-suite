import { createFileTools } from './core.js';
export const inject = ['tools', 'fs', 'sandboxPolicy', 'workingDirectory', 'sessions'];
const str = description => ({ type: 'string', description });
const obj = (properties, required) => ({ type: 'object', properties, required, additionalProperties: false });
const arr = items => ({ type: 'array', items, minItems: 1, maxItems: 64 });
const digest = str('Lowercase SHA-256 of current UTF-8 text; obtain from preview before applying.');
export const definitions = [
  {
    name: 'dev_text_batch',
    description: 'Preview or apply literal text edits after validating every file. Single-file writes are atomic; multi-file failures attempt guarded rollback, not a cross-file transaction. Returns hashes and rollback status.',
    action: 'batch',
    parameters: obj({ files: arr(obj({ path: str('Existing text file in session workspace.'), expected_hash: digest, edits: arr(obj({ old_text: str('Nonempty literal to match in the result of preceding edits.'), new_text: str('Literal replacement, including dollar signs verbatim.'), replace_all: { type: 'boolean', description: 'Default false requires exactly one match; true replaces all matches.' } }, ['old_text','new_text'])) }, ['path','edits'])), preview: { type: 'boolean', description: 'Default false. True validates and returns hashes without writing.' } }, ['files'])
  },
  {
    name: 'dev_notebook_cells', action: 'notebook',
    description: 'Preview or replace selected nbformat 4 cell sources by zero-based index. Preserves all other JSON fields, metadata and outputs. Does not execute cells; existing outputs may be stale. Returns file hashes.',
    parameters: obj({ path: str('Existing notebook in session workspace.'), expected_hash: digest, cells: arr(obj({ index: { type: 'integer', description: 'Zero-based cell index, unique within this call.' }, source: str('Entire new source text.'), expected_source: str('Optional exact current cell source to guard the edit.') }, ['index','source'])), preview: { type: 'boolean', description: 'Default false. True validates without writing.' } }, ['path','cells'])
  },
  {
    name: 'dev_file_checkpoint', action: 'checkpoint',
    description: 'Create, preview or restore an explicit set of existing text files. Restore requires current hashes from preview and uses guarded rollback on failure. Stores plaintext in a workspace JSON file. This is a file checkpoint, not session rewind.',
    parameters: obj({ action: { type: 'string', enum: ['create','preview','restore'] }, checkpoint_path: str('Workspace JSON file; create requires an absent path, parent directory must exist.'), paths: arr(str('For create only: exact existing text file to snapshot. No directory discovery.')), files: arr(obj({ path: str('For preview/restore: exact path selected from the checkpoint.'), expected_hash: { ...digest, description: 'Required on restore: current before_hash from preview. Concurrent changes reject restoration.' } }, ['path'])) }, ['action','checkpoint_path'])
  }
];
export function apply(ctx) {
  for (const { action, ...definition } of definitions) {
    ctx.effect(() => ctx.tools.register({
      ...definition,
      output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      async execute(args, exec) {
        if (!exec.agent) throw new Error('Requires a session agent');
        const session = ctx.sessions.get(exec.agent.id);
        if (!session) throw new Error('Session is not live');
        const cwd = ctx.workingDirectory.get(session);
        const policy = ctx.sandboxPolicy.resolve({ session });
        return createFileTools(ctx.fs, { cwd, sessionId: exec.agent.id, policy, signal: exec.signal })[action](args);
      }
    }));
  }
}
