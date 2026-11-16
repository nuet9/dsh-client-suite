export const inject = ['tools'];
export const parameters = {
  type:'object', additionalProperties:false, required:['title','x','y','rows'],
  properties:{
    title:{type:'string',minLength:1,maxLength:160,description:'Chart title, 1-160 characters.'},
    x:{type:'string',minLength:1,maxLength:80,description:'Row key for categorical x labels; row order is preserved.'},
    y:{type:'string',minLength:1,maxLength:80,description:'Distinct row key for finite numeric y values; null or missing values form gaps.'},
    series:{type:'string',minLength:1,maxLength:80,description:'Optional distinct row key for series labels; at most 12 series.'},
    rows:{type:'array',maxItems:500,items:{type:'object',additionalProperties:true},description:'Up to 500 rows using only x, y and optional series keys. x/series cells are strings or finite numbers (null/missing displays empty); y cells are finite numbers or null. Entire input is limited to 256 KiB.'}
  }
};
export function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an object.');
  if (Buffer.byteLength(JSON.stringify(input),'utf8')>262144) throw new Error('Input exceeds 256 KiB.');
  if (Object.keys(input).some(k=>!['title','x','y','series','rows'].includes(k))) throw new Error('Unknown input field.');
  const {title,x,y,series,rows}=input;
  if(typeof title!=='string'||!title.trim()||title.length>160) throw new Error('title must contain 1-160 characters.');
  const keys=[x,y,...(series===undefined?[]:[series])];
  if(keys.some(k=>typeof k!=='string'||!k.trim()||k.length>80)||new Set(keys).size!==keys.length) throw new Error('x, y and series must name distinct nonempty keys of at most 80 characters.');
  if(!Array.isArray(rows)||rows.length>500) throw new Error('rows must contain at most 500 objects.');
  const normalized=rows.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!keys.includes(k))) throw new Error('Rows must contain only declared keys.');
    return Object.fromEntries(keys.map(k=>{
      const value=Object.hasOwn(row,k)?row[k]:null;
      if(value!==null&&(k===y?typeof value!=='number'||!Number.isFinite(value):!['string','number'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))) throw new Error('Invalid cell: labels must be strings/numbers/null; y must be finite numbers/null.');
      return [k,value];
    }));
  });
  if(series!==undefined&&new Set(normalized.map(r=>JSON.stringify(r[series]))).size>12) throw new Error('At most 12 series are supported.');
  return {version:1,title,x,y,...(series===undefined?{}:{series}),rows:normalized};
}
export function apply(ctx) {
  ctx.effect(()=>ctx.tools.register({
    name:'interactive_chart',
    description:'Display supplied JSON data as an interactive line or bar chart in this conversation, with series visibility and a data table. Returns a recorded chart and concise row-count receipt.',
    parameters,
    output:{
      schema:{type:'object',additionalProperties:false,required:['version','title','x','y','rows'],properties:{version:{type:'integer'},title:{type:'string'},x:{type:'string'},y:{type:'string'},series:{type:'string'},rows:{type:'array',items:{type:'object',additionalProperties:true}}}},
      render(_args,value){return [{type:'text',text:JSON.stringify({title:value.title,rows:value.rows.length,x:value.x,y:value.y,...(value.series?{series:value.series}:{})})}];},
      presentationMeta(_args,value){return {interactiveChart:value};}
    },
    isConcurrencySafe:()=>true,
    async execute(args){return normalize(args);}
  }));
}
