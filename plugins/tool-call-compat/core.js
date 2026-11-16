export const DISCOVERY = ' Tool discovery inside this program: Object.keys(tools) lists callable names; ALL_TOOLS is not defined. To inspect exact argument schemas, call const r = await tools.cordis_inspect_query({platform:"host",provider:"Tool",method:"listTools",input:{}}); console.log(r.data.tools.filter(t => ["read","web_search"].includes(t.name))); change the name filter as needed. Inspect unknown argument schemas before invoking tools; after an argument error, inspect and correct before retrying. Optional controls may be omitted or null. Use sandbox_permissions:null and justification:null for ordinary calls, including danger-full-access; non-null values request real escalation and still require original approval checks.';
export function compatibleParameters(parameters) {
  const properties = { ...parameters.properties };
  for (const key of ['sandbox_permissions', 'justification', 'timeoutMs']) {
    if (!properties[key]) continue;
    const original = properties[key];
    properties[key] = { oneOf: [original, { type: 'null' }], description: (original.description || '') + ' Omit or use null when not requested; null means absent.' };
  }
  return { ...parameters, properties };
}
export function normalizeArguments(raw) {
  let args;
  try { args = JSON.parse(raw); } catch { return raw; }
  if (!args || typeof args !== 'object' || Array.isArray(args)) return raw;
  let changed = false;
  for (const key of ['sandbox_permissions','justification','timeoutMs']) {
    if (args[key] === null) { delete args[key]; changed = true; }
  }
  return changed ? JSON.stringify(args) : raw;
}
export function wrapExecutor(base) {
  return {
    sections: base.sections,
    describe(definitions) {
      const result = base.describe(definitions);
      return { ...result, schemas: result.schemas.map(schema => schema.name === 'run_code' ? { ...schema, description: schema.description + DISCOVERY, parameters: compatibleParameters(schema.parameters) } : schema) };
    },
    execute(input) {
      return base.execute({ ...input, calls: input.calls.map(call => call.name === 'run_code' ? { ...call, arguments: normalizeArguments(call.arguments) } : call) });
    }
  };
}
