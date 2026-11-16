import {randomUUID} from 'node:crypto';
// Submit the underlying tool to the installed executor; do not assume run_code/PTC transport.
export async function dispatchBrowser(tools,operation,args,signal){
 const name='mcp__playwright_browser__browser_'+operation;
 if(!tools.executable(name))throw Error('Browser tool unavailable: '+name+'; check the dedicated MCP connection and active executor');
 return tools.execute({calls:[{type:'tool-call',id:'pinterest-'+randomUUID(),name,arguments:JSON.stringify(args)}],signal});
}
export function browserFailure(v){
 const parts=[v?.error?.info?.code,v?.error?.message,v?.error?.info?.reason,...(v?.content||[]).filter(p=>p.type==='text').map(p=>p.text)].filter(Boolean);
 return 'Browser call failed: '+(parts.join(' | ').slice(0,1800)||'executor returned isError without diagnostic');
}
export function assertBrowserSuccess(value){
 function check(v){if(v&&typeof v==='object'){if(v.isError===true)throw Error(browserFailure(v));for(const x of Object.values(v))check(x);}}
 check(value);
}
