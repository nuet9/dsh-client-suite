import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);const ci=args.indexOf('--config');
const cfg=ci>=0?JSON.parse(fs.readFileSync(path.resolve(args[ci+1]),'utf8')):{variables:{}};
const inventory=JSON.parse(fs.readFileSync(path.join(root,'feature-inventory.json'),'utf8')).features;
const template=JSON.parse(fs.readFileSync(path.join(root,'scripts/deployment.example.json'),'utf8'));
const selected=args.includes('--plugin')?[args[args.indexOf('--plugin')+1]]:inventory.filter(f=>f.defaultEnabled!==false).map(f=>f.name);
const output=path.join(root,'scripts','prepared');if(fs.existsSync(output)){if(output!==path.join(root,'scripts','prepared'))throw Error('Invalid output');fs.rmSync(output,{recursive:true})}fs.mkdirSync(output,{recursive:true});
const errors=[];const plan=[];
for(const f of inventory.filter(f=>selected.includes(f.name))){
 if(f.kind==='builtin'||f.kind==='official-reference'){plan.push({name:f.name,title:f.title,tool:'plugin_manager',arguments:{action:'list_bundles'},nextStep:{tool:'plugin_manager',action:'set_bundle',enabled:true,targetFrom:'Use the exact entry identifier returned by list_bundles for '+f.name},missingBundleBehavior:'Stop and report that the compatible Harness distribution does not provide this bundle; do not guess an npm install target.',requiresExplicitAuthorization:true});continue}
 if(!f.included){plan.push({name:f.name,title:f.title,tool:'plugin_manager',arguments:{action:'install_bundle',target:f.installTarget},requiresExplicitAuthorization:true});continue}
 const slug=path.basename(f.directory);const source=path.join(root,f.directory);const dest=path.join(output,slug);
 const missing=Object.entries(template.requirements).filter(([k,v])=>v.plugin===slug&&!(cfg.variables?.[k]||process.env[k]));
 if(missing.length){errors.push({name:f.name,missing:missing.map(([key,details])=>({key,...details}))});continue}
 for(const rel of ['package.json',...f.files]){const input=path.join(source,rel);if(!fs.existsSync(input))throw Error('Missing packaged file: '+input);const target=path.join(dest,rel);fs.mkdirSync(path.dirname(target),{recursive:true});let data=fs.readFileSync(input);if(/\.(js|mjs|cjs|ts|json|yml|yaml|py|ps1|sh|svg|css)$/.test(rel)){let text=data.toString('utf8');text=text.replace(/__DSH_SUITE_[A-Z0-9_]+__/g,token=>{const key=token.slice(2,-2);const val=cfg.variables?.[key]||process.env[key];if(!val)throw Error('Missing '+key);if(/[\r\n'"`]/.test(val)||val.includes('${'))throw Error(key+': values must be single-line and exclude quotes/backticks; use forward-slash paths');return val.replaceAll('\\','/');});data=Buffer.from(text)}fs.writeFileSync(target,data)}
 plan.push({name:f.name,tool:'plugin_manager',arguments:{action:'install_bundle',target:dest},requiresExplicitAuthorization:true,dependencyPreparation:f.dependencies});
}
fs.writeFileSync(path.join(output,'install-plan.json'),JSON.stringify({warning:'Review only: no tools executed. Install exclusively via Harness plugin_manager. Do not hand-edit profiles or authorize scripts/version exemptions implicitly.',calls:plan,configurationRequired:errors},null,2)+'\n');
console.log(JSON.stringify({prepared:plan.length,configurationRequired:errors.length,plan:'scripts/prepared/install-plan.json'},null,2));
if(errors.length)process.exitCode=2;
