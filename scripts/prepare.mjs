import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const options={};
const requested=[];
const args=process.argv.slice(2);
for (let i=0;i<args.length;i++) {
  const flag=args[i], value=args[++i];
  if (!['--config','--plugin'].includes(flag)||!value||value.startsWith('--')) throw Error('Usage: node scripts/prepare.mjs [--config deployment.json] [--plugin bundle-name]...');
  if(flag==='--plugin') requested.push(value);
  else if(options.config) throw Error('Use only one --config');
  else options.config=path.resolve(value);
}
const cfg=options.config?json(options.config):{variables:{}};
const inventory=json(path.join(root,'feature-inventory.json')).features;
const template=json(path.join(root,'scripts/deployment.example.json'));
const selected=new Set(requested.length?requested:inventory.filter(f=>f.defaultEnabled!==false).map(f=>f.name));
for(const name of selected) if(!inventory.some(f=>f.name===name)) throw Error('Unknown bundle: '+name);
const readValue=key=>cfg.variables?.[key]||process.env[key];
const output=path.join(root,'scripts','prepared');
fs.mkdirSync(output,{recursive:true});
const errors=[],plan=[];
for(const f of inventory.filter(f=>selected.has(f.name))){
  if(f.kind==='builtin'||f.kind==='official-reference'){
    plan.push({name:f.name,title:f.title,tool:'plugin_manager',arguments:{action:'list_bundles'},nextStep:{tool:'plugin_manager',action:'set_bundle',enabled:true,targetFrom:'Use the exact entry identifier returned by list_bundles for '+f.name},missingBundleBehavior:'Stop and report that the compatible Harness distribution does not provide this bundle; do not guess an npm install target.',requiresExplicitAuthorization:true});continue;
  }
  if(!f.included){
    if(!f.installTarget) errors.push({name:f.name,reason:'This bundle is not distributed and has no verified install target.'});
    else plan.push({name:f.name,title:f.title,tool:'plugin_manager',arguments:{action:'install_bundle',target:f.installTarget},requiresExplicitAuthorization:true});
    continue;
  }
  const slug=path.basename(f.directory),source=path.join(root,f.directory);
  const missing=Object.entries(template.requirements).filter(([k,v])=>v.plugin===slug&&!readValue(k));
  if(missing.length){errors.push({name:f.name,missing:missing.map(([key,details])=>({key,...details}))});continue;}
  const hash=crypto.createHash('sha256');
  const files=[];
  for(const rel of ['package.json',...f.files]){
    if(path.isAbsolute(rel)||rel.split(/[/\\]/).some(p=>p==='..'||!p)) throw Error('Invalid bundle entry: '+rel);
    let data=fs.readFileSync(path.join(source,rel));
    if(/\.(js|mjs|cjs|ts|json|yml|yaml|py|ps1|sh|svg|css)$/.test(rel)){
      const text=data.toString('utf8').replace(/__DSH_SUITE_[A-Z0-9_]+__/g,token=>{
        const key=token.slice(2,-2),val=readValue(key);
        if(typeof val!=='string'||!val) throw Error('Missing '+key);
        if(/[\u0000-\u001f'"`]/.test(val)||val.includes('${')||!path.win32.isAbsolute(val)||!/^(?:[A-Za-z]:[/\\]|[/\\]{2})/.test(val)) throw Error(key+': use a single-line absolute Windows path without quotes/backticks');
        return val.replaceAll('\\','/');
      });
      data=Buffer.from(text);
    }
    hash.update(JSON.stringify([rel,data.length])).update(data);
    files.push([rel,data]);
  }
  const dest=path.join(output,slug+'-'+hash.digest('hex').slice(0,16));
  if(!fs.existsSync(dest)){
    const stage=fs.mkdtempSync(path.join(output,'.staging-'));
    for(const [rel,data] of files){
      const target=path.join(stage,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data,{flag:'wx'});
    }
    fs.renameSync(stage,dest);
  }
  for(const [rel,data] of files){
    if(!fs.readFileSync(path.join(dest,rel)).equals(data)) throw Error('Prepared bundle differs from release: '+dest+'; preserve installed links and prepare from a fresh release directory.');
  }
  plan.push({name:f.name,version:f.version,contentSha256:f.contentSha256,tool:'plugin_manager',arguments:{action:'install_bundle',target:dest},requiresExplicitAuthorization:true,dependencyPreparation:f.dependencies,updateNote:'A matching version does not prove a matching source. Compare the installed bundle and use only the documented plugin manager path for updates.'});
}
const planPath=path.join(output,'install-plan.json');
const tmpPlan=path.join(output,'.install-plan-'+crypto.randomUUID()+'.json');
fs.writeFileSync(tmpPlan,JSON.stringify({warning:'Review only: no tools executed. Install exclusively via Harness plugin_manager. Do not hand-edit profiles or authorize scripts/version exemptions implicitly. Keep the prepared source directories after linking.',calls:plan,configurationRequired:errors},null,2)+'\n',{flag:'wx'});
fs.renameSync(tmpPlan,planPath);
console.log(JSON.stringify({prepared:plan.length,configurationRequired:errors.length,plan:'scripts/prepared/install-plan.json'},null,2));
if(errors.length) process.exitCode=2;
