export const settingsParameters = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['list', 'models', 'save'] },
    parentSessionId: { type: 'string' },
    childSessionId: { type: 'string' },
    revision: { type: 'integer', minimum: 0 },
    title: { type: 'string', maxLength: 100 },
    modelSelection: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        model: { type: 'string' },
        reasoningEffort: {
          oneOf: [{ type: 'string' }, { type: 'null' }],
          description: 'An effort ID from this model’s catalog. Use null for its current default. Omission retains the saved effort on the same model.',
        },
      },
      required: ['provider', 'model'],
      additionalProperties: false,
    },
  },
  required: ['action', 'parentSessionId'],
  additionalProperties: false,
};

export function settingsSpec(z) {
  return {
    name: 'agent_chat_preferences',
    version: 1,
    tables: {
      preferences: {
        valueSchema: z.object({
          parentSessionId: z.string(),
          title: z.string(),
          revision: z.number().int().nonnegative(),
          modelSelection: z.object({
            provider: z.string(),
            model: z.string(),
            reasoningEffort: z.string().min(1).optional(),
          }).nullable(),
        }),
      },
    },
  };
}

function emptyPreference(parentSessionId) {
  return { parentSessionId, title: '', revision: 0, modelSelection: null };
}

function requireChild(rows, childId) {
  if (!rows.some(row => row.id === childId)) throw Error('Select a continuable child in this conversation');
}

function resolveSelection(value, previous, catalog) {
  if (!value || typeof value.provider !== 'string' || !value.provider.trim() || value.provider.length > 200 ||
      typeof value.model !== 'string' || !value.model.trim() || value.model.length > 300) {
    throw Error('Invalid model selection');
  }
  const provider = catalog.groups.find(group => group.id === value.provider);
  const model = provider?.models.find(item => item.id === value.model);
  if (!model) throw Error('Model is not currently available');

  const selection = { provider: value.provider, model: value.model };
  let effort = value.reasoningEffort;
  // Existing model-only clients have no way to specify a reset. An explicit null follows adapter defaults.
  if (effort === undefined && previous?.provider === value.provider && previous.model === value.model) {
    effort = previous.reasoningEffort;
  }
  if (effort == null) return selection;
  if (typeof effort !== 'string' || !effort.length || !model.reasoning?.efforts.some(item => item.id === effort)) {
    throw Error('Reasoning effort is not currently available for this model');
  }
  return { ...selection, reasoningEffort: effort };
}

export class ChatPreferences {
  constructor(ctx, table) {
    this.ctx = ctx;
    this.table = table;
    this.tail = Promise.resolve();
  }

  async authorize(request, caller, signal, browser) {
    const rootId = request?.parentSessionId;
    if (browser) {
      if (typeof rootId !== 'string' || !rootId) throw Error('Select a main conversation');
      const header = await this.ctx.sessionQuery.inspectSession(rootId, session => session.header, signal);
      if (!header || header.origin === 'subagent') throw Error('Settings require a main conversation');
    } else if (!caller || caller.id !== rootId || this.ctx.agents.get(rootId) !== caller ||
               this.ctx.subagents.rootOf(caller) !== caller) {
      throw Error('Settings require the exact main conversation');
    }
    const rows = await this.ctx.subagents.listDescendants(rootId, signal);
    signal?.throwIfAborted();
    return rows.filter(row => row.kind === 'child' && row.mode === 'continuable' && row.id !== rootId);
  }

  run(request, caller, signal) { return this.enqueue(request, caller, signal, false); }
  runBrowser(request, signal) { return this.enqueue(request, undefined, signal, true); }

  enqueue(request, caller, signal, browser) {
    const task = this.tail.then(() => this.execute(request, caller, signal, browser));
    this.tail = task.catch(() => {});
    return task;
  }

  liveChild(childId, rootId) {
    const child = this.ctx.agents.get(childId);
    if (child && (child.session.header.origin !== 'subagent' || this.ctx.subagents.rootOf(child).id !== rootId)) {
      throw Error('Child owner changed');
    }
    return child;
  }

  async execute(request, caller, signal, browser) {
    const rows = await this.authorize(request, caller, signal, browser);
    const { action, parentSessionId, childSessionId, title, modelSelection } = request;
    if (childSessionId !== undefined || action === 'save') requireChild(rows, childSessionId);
    if (action === 'models') {
      const catalog = await this.ctx.sessionController.modelCatalog();
      signal?.throwIfAborted();
      return { catalog, supportsReasoningEffort: true };
    }
    if (action === 'list') {
      return { preferences: Object.fromEntries(rows.map(row => {
        const stored = this.table.get(row.id);
        return [row.id, stored?.parentSessionId === parentSessionId ? stored : emptyPreference(parentSessionId)];
      })) };
    }
    if (action !== 'save') throw Error('Unknown settings action');
    const old = this.table.get(childSessionId) ?? emptyPreference(parentSessionId);
    if (old.parentSessionId !== parentSessionId) throw Error('Child owner changed');
    if (request.revision !== old.revision) throw Error('Settings changed; reload before saving');
    if (title === undefined && modelSelection === undefined) throw Error('No settings to save');
    if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.trim().length > 100)) {
      throw Error('Name must contain 1–100 characters');
    }

    let selection = old.modelSelection;
    if (modelSelection !== undefined) {
      const catalog = await this.ctx.sessionController.modelCatalog();
      selection = resolveSelection(modelSelection, old.modelSelection, catalog);
      // Provider discovery can take time. Check the currently authorized child before committing.
      requireChild(await this.authorize(request, caller, signal, browser), childSessionId);
    }
    signal?.throwIfAborted();
    if (!browser && this.ctx.agents.get(parentSessionId) !== caller) throw Error('Main conversation is no longer available');
    this.liveChild(childSessionId, parentSessionId);
    const next = { parentSessionId, title: title?.trim() ?? old.title, revision: old.revision + 1, modelSelection: selection };
    await this.table.put(childSessionId, next);

    const receipt = { childSessionId, preference: next };
    if (modelSelection === undefined) return { ...receipt, modelState: 'unchanged' };
    try {
      const child = this.liveChild(childSessionId, parentSessionId);
      if (!child) return { ...receipt, modelState: 'next-activation' };
      child.model.select(selection);
      return { ...receipt, modelState: 'next-request' };
    } catch (error) {
      return { ...receipt, modelState: 'next-activation', warning: 'Saved for next activation: ' + String(error.message || error) };
    }
  }

  // Called synchronously when the provider publishes a local child, before queued work starts.
  started(info) {
    if (!info.local) return;
    const row = this.table.get(info.id);
    const child = this.ctx.agents.get(info.id);
    if (!row?.modelSelection || child?.session.header.origin !== 'subagent') return;
    if (this.ctx.subagents.rootOf(child).id === row.parentSessionId) child.model.select(row.modelSelection);
  }

  async close() { await this.tail; }
}
