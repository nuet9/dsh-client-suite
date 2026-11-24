import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const args=process.argv.slice(2), only=new Set();
let configPath;
for(let i=0;i<args.length;i++) {
  const flag=args[i],value=args[++i];
  if(!value||value.startsWith('--')||!['--config','--plugin'].includes(flag)) throw Error('Usage: node scripts/preflight.mjs [--config deployment.json] [--plugin bundle-name]...');
  if(flag==='--plugin') only.add(value); else if(configPath) throw Error('Use only one --config'); else configPath=path.resolve(value);
}
const settings=configPath?read(configPath):{};
const inventory=read(path.join(root,'feature-inventory.json')).features;
for(const name of only) if(!inventory.some(f=>f.name===name)) throw Error('Unknown bundle: '+name);
const selection=inventory.filter(f=>only.size?only.has(f.name):f.defaultEnabled!==false);
const slugs=new Map(selection.filter(f=>f.included).map(f=>[path.basename(f.directory),f.name]));
const {requirements}=read(path.join(root,'scripts/deployment.example.json'));
const [major,minor]=process.versions.node.split('.').map(Number);
const baseline={windows:process.platform==='win32',nodeVersion:process.versions.node,nodeCompatible:major>24||major===24&&minor>=9};
const issues=[],manual=[];
let variablesChecked=0;
for(const [key,rule] of Object.entries(requirements)){
  if(!slugs.has(rule.plugin)) continue;
  const field={bundle:slugs.get(rule.plugin),key,description:rule.description};
  const value=settings.variables?.[key]||process.env[key];
  if(typeof value!=='string'||!value){issues.push({...field,state:'missing'});continue;}
  if(/[\u0000-\u001f'"`]/.test(value)||value.includes('${')||!/^(?:[A-Za-z]:[/\\]|[/\\]{2})/.test(value)){
    issues.push({...field,state:'invalid-windows-path'});continue;
  }
  variablesChecked++;
  try{fs.statSync(value);}catch(error){
    if(/ASAR-aware|runtime root/i.test(rule.description||'')&&/\.asar[/\\]/i.test(value)) manual.push({...field,state:'check-from-Harness-ASAR-runtime'});
    else issues.push({...field,state:error.code==='ENOENT'?'path-not-found':'path-unreadable'});
  }
}
console.log(JSON.stringify({baseline,selected:selection.map(f=>f.name),variablesChecked,issues,manual,limits:'Read-only and offline; does not start programs, access accounts, install packages, or verify compatibility, model files, credentials, endpoints or live tool calls.'},null,2));
if(issues.length||!baseline.windows||!baseline.nodeCompatible) process.exitCode=2;
