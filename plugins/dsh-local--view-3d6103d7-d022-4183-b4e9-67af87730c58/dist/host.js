const packageName = '@dsh-local/view-3d6103d7-d022-4183-b4e9-67af87730c58';
const namespace = 'personalizedSkills3d6103d7';
const serviceKey = `${packageName}:detail`;
const json = { mode: 'src-json' };

export const inject = ['agents', 'sessionQuery', 'sessionSkillCatalog', 'typert', 'workingDirectory'];

export function apply(ctx) {
  const lifetime = new AbortController();
  const service = {
    async get(request, signal) {
      if (typeof request?.sessionId !== 'string' || !request.sessionId ||
          typeof request.name !== 'string' || !request.name) return null;

      const { sessionId, name } = request;
      const readSignal = AbortSignal.any([signal, lifetime.signal]);
      readSignal.throwIfAborted();
      const catalog = await ctx.sessionSkillCatalog.list({ sessionId }, readSignal);
      readSignal.throwIfAborted();
      if (!catalog.skills.some(skill => skill.name === name)) return null;

      using observation = await ctx.sessionQuery.observeSession(sessionId);
      const projection = observation.projections?.values;
      if (!projection) return null;
      const live = ctx.agents.get(sessionId);
      const presets = ctx.get('agentPresets');
      let cwd = projection.workingDirectory ?? observation.header.cwd ?? ctx.workingDirectory.defaultDirectory;
      if (live) cwd = await ctx.workingDirectory.ensure(live, readSignal);
      const registry = (live && presets?.serviceFor(live, 'skills')) ?? ctx.get('skills');
      if (!registry) return null;

      const acquireScope = async () => {
        if (!presets || live) return undefined;
        try {
          return await presets.acquireScope(projection.agentPreset ?? undefined);
        } catch {
          return undefined;
        }
      };
      await using lease = await acquireScope();
      const options = { cwd, scope: live ?? lease?.key, signal: readSignal };
      // Confirm visibility again in the precise registry view that will load the body.
      const summaries = await registry.list(options);
      if (!summaries.some(skill => skill.name === name && skill.invocation.userInvocable)) return null;
      const skill = await registry.get(name, options);
      readSignal.throwIfAborted();
      return skill?.name === name && skill.invocation.userInvocable ? { content: skill.content } : null;
    },
  };
  service.typertRemote = { service, serviceKey, namespace };

  const removeService = ctx.reflect.provide(serviceKey, service);
  let removeRemote;
  try {
    removeRemote = ctx.typert.register({
      package: packageName,
      face: 'host',
      model: {},
      schemas: [],
      invocations: [{
        id: `${packageName}:get-skill`,
        service: serviceKey,
        namespace,
        method: 'get',
        invocation: { kind: 'direct' },
        parameters: [{ name: 'request', wire: 'request', source: 'json', codec: json }],
        cancellation: { parameter: 'signal' },
        result: json,
      }],
    });
  } catch (error) {
    void removeService();
    throw error;
  }
  ctx.effect(() => async () => {
    lifetime.abort();
    await removeRemote();
    await removeService();
  });
}
