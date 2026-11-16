export const inject = ['tools'];

export const parameters = {
  type: 'object', additionalProperties: false, required: ['title', 'columns', 'rows'],
  properties: {
    title: {type:'string', minLength:1, maxLength:160, description:'View title, 1-160 characters.'},
    columns: {type:'array', minItems:1, maxItems:24, uniqueItems:true, description:'1-24 unique object keys, in display order; each 1-80 characters.', items:{type:'string',minLength:1,maxLength:80}},
    rows: {type:'array', maxItems:500, description:'Up to 500 JSON objects. Keys must be declared columns; values are string, finite number, boolean or null. Missing cells display empty. Entire input is limited to 256 KiB UTF-8.', items:{type:'object', additionalProperties:true}},
    numeric_field: {type:'string', description:'Optional column containing only finite numbers, null or missing values; enables an optional magnitude bar chart.'}
  }
};
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an object.');
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 262144) throw new Error('Input exceeds 256 KiB.');
  if (Object.keys(input).some(key => !['title','columns','rows','numeric_field'].includes(key))) throw new Error('Unknown input field.');
  const {title, columns, rows, numeric_field: numericField} = input;
  if (typeof title !== 'string' || !title.trim() || title.length > 160) throw new Error('title must contain 1-160 characters.');
  if (!Array.isArray(columns) || columns.length < 1 || columns.length > 24 || columns.some(key => typeof key !== 'string' || !key.trim() || key.length > 80) || new Set(columns).size !== columns.length) throw new Error('columns must contain 1-24 unique nonempty keys.');
  if (!Array.isArray(rows) || rows.length > 500) throw new Error('rows must contain at most 500 objects.');
  if (numericField !== undefined && (typeof numericField !== 'string' || !columns.includes(numericField))) throw new Error('numeric_field must name a column.');
  const normalized = rows.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !columns.includes(key))) throw new Error('Each row must be an object containing only declared columns.');
    return Object.fromEntries(columns.map(key => {
      const value = own(row, key) ? row[key] : null;
      if (value !== null && !['string','number','boolean'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) throw new Error('Cells must be JSON scalars; numbers must be finite.');
      if (key === numericField && value !== null && typeof value !== 'number') throw new Error('numeric_field cells must be numbers or null.');
      return [key, value];
    }));
  });
  return {version:1, title, columns:[...columns], rows:normalized, ...(numericField === undefined ? {} : {numericField})};
}

export function apply(ctx) {
  ctx.effect(() => ctx.tools.register({
    name: 'interactive_view',
    description: 'Display supplied JSON data as an interactive table in this session, with sorting, text filtering and an optional numeric bar chart. Returns the recorded view and a concise row-count receipt; does not read files or fetch data.',
    parameters,
    output: {
      schema: {type:'object', additionalProperties:false, required:['version','title','columns','rows'], properties:{version:{type:'integer'},title:{type:'string'},columns:{type:'array',items:{type:'string'}},rows:{type:'array',items:{type:'object',additionalProperties:true}},numericField:{type:'string'}}},
      render(_args, value) { return [{type:'text', text:JSON.stringify({title:value.title, rows:value.rows.length, columns:value.columns, ...(value.numericField ? {numeric_field:value.numericField} : {})})}]; },
      presentationMeta(_args, value) { return {interactiveView:value}; }
    },
    isConcurrencySafe: () => true,
    async execute(args) { return normalize(args); }
  }));
}
