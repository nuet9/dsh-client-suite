import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inv=JSON.parse(fs.readFileSync(path.join(root,'feature-inventory.json'),'utf8')).features;
const template=JSON.parse(fs.readFileSync(path.join(root,'scripts/deployment.example.json'),'utf8'));
const failures=[];let checked=0,syntax=0;
const deny=/(^|\/)(node_modules|\.git|evidence|outputs?|backups?|history|screenshots?)(\/|$)/i;
for(const f of inv.filter(f=>f.included)){
 const dir=path.join(root,f.directory);const pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
 for(const rel of ['package.json',...f.files]){checked++;if(deny.test(rel))failures.push(f.name+': forbidden '+rel);const full=path.join(dir,rel);if(!fs.existsSync(full)){failures.push('Missing '+full);continue}if(fs.lstatSync(full).isSymbolicLink())failures.push('Symlink '+full);
 if(/\.(js|mjs|cjs|json|ts|yml|yaml|ps1|py|sh|svg)$/.test(rel)){
 const text=fs.readFileSync(full,'utf8');if(/(?:Users[\\/]+Drock|gpt-6-astra|default-workspace[\\/]+gpt|file:\/\/\/[CD]:|D:\/ty|host-verification|老建筑)/i.test(text))failures.push('Private machine path '+f.directory+'/'+rel);
 if(/(?:sk-[A-Za-z0-9]{25,}|gh[pousr]_[A-Za-z0-9]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text))failures.push('Credential pattern '+f.directory+'/'+rel);
 for(const token of text.match(/__DSH_SUITE_[A-Z0-9_]+__/g)||[])if(!template.requirements[token.slice(2,-2)])failures.push('Undeclared token '+token);
 if(/\.(js|mjs|cjs)$/.test(rel)){syntax++;const result=spawnSync(process.execPath,['--check',full],{encoding:'utf8'});if(result.status!==0)failures.push('Syntax '+f.directory+'/'+rel+': '+result.stderr)}
 for(const m of text.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"](\.[^'"\n]+)['"]/g)){if(m[1]==='...'||rel.endsWith('.d.ts')||m.index>0&&text.slice(Math.max(0,m.index-20),m.index).includes('commonjs'))continue;let target=path.resolve(path.dirname(full),m[1].split('?')[0]);if(rel==='lib/client-mermaid.js'&&m[1]==='../../graphlib/graph.js')continue;if(!fs.existsSync(target)&&!fs.existsSync(target+'.js'))failures.push('Missing runtime import '+f.directory+'/'+rel+' → '+m[1])}
 }}
 if(pkg.scripts)failures.push(f.name+': lifecycle scripts retained');
 const hash=crypto.createHash('sha256');for(const rel of ['package.json',...f.files].sort()){hash.update(rel+'\0');hash.update(fs.readFileSync(path.join(dir,rel)));}if(f.contentSha256!==hash.digest('hex'))failures.push(f.name+': content hash differs from inventory');
}
const safe=inv.find(f=>f.name==='@local/subagent-safe-defaults');if(safe.defaultEnabled!==false)failures.push('Safe defaults must remain disabled');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));if(manifest.reconciliation?.missing?.length||manifest.reconciliation?.extra?.length)failures.push('Profile reconciliation mismatch');
for(const f of inv){if(f.kind==='registry-reference'&&f.installTarget!==f.name+'@'+f.version)failures.push(f.name+': registry version must be exact');for(const notice of f.notices||[])if(!fs.existsSync(path.join(root,notice)))failures.push(f.name+': missing license notice');}
for(const f of manifest.excluded||[])if(f.defaultEnabled!==false||f.sourceEnabled)failures.push(f.name+': excluded entry unexpectedly enabled');
const result={passed:!failures.length,bundles:inv.length,sourceBundles:inv.filter(f=>f.included).length,files:checked,syntaxChecked:syntax,pathTemplateCount:Object.keys(template.requirements).length,failures,limits:['Static validation only; no profile installed, no external service or paid generation tested.','Local-source packages without declared licenses require repository owner license decision.','Prepared files may contain destination-host private paths; exclude scripts/prepared and deployment.json from publication.']};
if(!process.argv.includes('--no-write'))fs.writeFileSync(path.join(root,'scripts','verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
