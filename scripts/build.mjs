import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const suite=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const profile=process.env.DSH_SUITE_SOURCE_PROFILE;
const workspace=process.env.DSH_SUITE_SOURCE_WORKSPACE;
if(!profile||!workspace) throw Error('Read-only capture requires DSH_SUITE_SOURCE_PROFILE and DSH_SUITE_SOURCE_WORKSPACE. No profile is modified.');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const source=read(path.join(profile,'package.json'));
const previousManifest=read(path.join(suite,'manifest.json'));
const livePath=process.env.DSH_SUITE_SOURCE_INVENTORY;
if(!livePath)throw Error('Set DSH_SUITE_SOURCE_INVENTORY to a read-only plugin_manager list_bundles JSON capture.');
const live=read(livePath).entries;
const liveByName=new Map(live.map(x=>[x.name,x]));
const profilePatch=fs.readFileSync(path.join(profile,'cordis.patch.yml'),'utf8');
const safeDisabled=/- id: local-subagent-safe-defaults\s*\r?\n\s+disabled: true/.test(profilePatch);
const capturedOn=process.env.DSH_SUITE_CAPTURE_DATE||new Date().toISOString().slice(0,10);
const inventory=[];const variables={};
const deny=/(^|\/)(node_modules|\.git|obj|bin|evidence|outputs?|backups?|history|screenshots?|test|tests|fixtures?|docs)(\/|$)|(^|\/)(README[^/]*|VERIFICATION[^/]*|verification\.json|PROVENANCE\.md|DESKTOP-PIN\.md|test\.[^/]+)$/i;
const textExt=/\.(js|mjs|cjs|ts|json|yml|yaml|py|ps1|sh|svg|css|csproj|xml|props|targets|cs)$/i;
function walk(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{let r=prefix+e.name;if(deny.test(r)||e.isSymbolicLink())return [];return e.isDirectory()?walk(path.join(dir,e.name),r+'/'):[r]})}
function portable(text,slug,rel){
 const literalRules=[[/(['"])([^'"\r\n]*(?:Users[\\/]+[^\\/\s'"`]+|D:[\\/]+comfyui|C:[\\/]+Program Files)[^'"\r\n]*)(\1)/g]];
 if(rel==='cordis.patch.yml')text=text.replace(literalRules[0][0],(all,q,value)=>{
 const base=value.replaceAll('\\','/');if(!/^(?:[A-Z]:\/|file:|--[A-Za-z]+=)/i.test(base))return all;
 const flag=base.startsWith('--')?base.slice(0,base.indexOf('=')+1):'';const key='DSH_SUITE_'+slug.replace(/[^a-z0-9]/gi,'_').toUpperCase()+'_PATH_'+Object.keys(variables).length;
 variables[key]={plugin:slug,file:rel,required:true,description:'Absolute deployment path for '+(flag||base.split('/').pop())+'; preserve required external dependency, install it separately.',hint:'Forward-slash path only; do not include '+(flag||'quotes or file:/// unless this is a module URL')};return q+flag+'__'+key+'__'+q;
 });
 const rules=[
 [/C:[\\/]+Users[\\/]+[^\\/\s'"`]+[\\/]+Documents[\\/]+deepseek-harness[\\/]+default-workspace[\\/]+gpt(?:-6-astra)?/gi,'WORKSPACE_ROOT','Workspace directory containing your deployed skills/helpers'],
 [/C:[\\/]+deepseek[\\/]+resources[\\/]+app\.asar[\\/]+dsh/gi,'HARNESS_RUNTIME_ROOT','Target Harness runtime root (ASAR-aware file URL consumers require compatible Desktop runtime)'],
 [/C:[\\/]+Users[\\/]+[^\\/\s'"`]+[\\/]+\.dsh[\\/]+profiles[\\/]+desktop/gi,'PROFILE_ROOT','Target Harness profile directory; read only; installation still uses plugin_manager'],
 [/C:[\\/]+Users[\\/]+[^\\/\s'"`]+/gi,'USER_HOME','Destination operating-system user home'],
 [/D:[\\/]+comfyui/gi,'COMFY_ROOT','Separately installed ComfyUI parent directory'],
 [/C:[\\/]+Program Files/gi,'PROGRAM_FILES','Windows Program Files directory'],
 ];
 for(const [pattern,suffix,description] of rules)text=text.replace(pattern,()=>{const key='DSH_SUITE_'+slug.replace(/[^a-z0-9]/gi,'_').toUpperCase()+'_'+suffix;variables[key]={plugin:slug,file:rel,required:true,description,hint:'Use an absolute forward-slash directory path without a trailing slash'};return '__'+key+'__'});
 return text;
}
for(const name of source.dsh.profile.bundles){
 if(['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app'].includes(name)){inventory.push({name,kind:'builtin',included:false,reason:'Provided by target Harness; never repackaged'});continue}
 if(name.startsWith('@deepseek-ai/')){const version=process.env.DSH_SUITE_SOURCE_DSH_VERSION;if(!version)throw Error('Set verified DSH_SUITE_SOURCE_DSH_VERSION for shipped optional bundles');inventory.push({name,version,kind:'official-reference',included:false,installTarget:name+'@'+version,license:'MIT',defaultEnabled:false,reason:'Shipped optional Harness bundle; target installation must provide compatible version'});continue}
 const spec=source.dependencies?.[name];
 const local=name.startsWith('@local/')||name.startsWith('@dsh-local/')||name==='@drock/dsh-request-stats'||name==='dsh-whale-widget';
 let src=spec?.startsWith('link:')?path.resolve(profile,spec.slice(5)):path.join(profile,'node_modules',name);

 const pkg=read(path.join(src,'package.json'));
 if(liveByName.get(name)?.version&&pkg.version!==liveByName.get(name).version)throw Error(name+': installed source/version differs from live bundle capture');
 const slug=name.replace(/^@local\//,'').replace(/^@/,'').replaceAll('/','--');
 if(!local){
  const notices=[];const target=path.join(suite,'third-party',slug);fs.mkdirSync(target,{recursive:true});
  for(const f of fs.readdirSync(src).filter(f=>/^(LICEN[CS]E|NOTICE|COPYING|THIRD_PARTY_NOTICES)(\.|$)/i.test(f)))if(fs.statSync(path.join(src,f)).isFile()){fs.copyFileSync(path.join(src,f),path.join(target,f));notices.push('third-party/'+slug+'/'+f)}
  inventory.push({name,version:pkg.version,kind:name.startsWith('@deepseek')?'official-reference':'registry-reference',included:false,installTarget:name+'@'+pkg.version,license:pkg.license||'UNDECLARED',notices,dependencies:pkg.dependencies||{},defaultEnabled:false});continue;
 }
 if(!Array.isArray(pkg.files))throw Error(name+': no package.files allowlist');
 let allowed=new Set();for(const pattern of pkg.files){if(deny.test(pattern))continue;for(const f of fs.globSync(pattern,{cwd:src})){const full=path.join(src,f);if(fs.lstatSync(full).isSymbolicLink())continue;if(fs.statSync(full).isDirectory()){for(const r of walk(full,f.replaceAll('\\','/')+'/'))allowed.add(r)}else if(!deny.test(f.replaceAll('\\','/')))allowed.add(f.replaceAll('\\','/'))}}
 // Select runtime graph rooted at exports/main/bundle/client, rather than archive historical versions.
 const selected=new Set();let roots=[];
 const exportsWalk=v=>{if(typeof v==='string'&&v.startsWith('./')&&!v.includes('*'))roots.push(v.slice(2));else if(v&&typeof v==='object')Object.values(v).forEach(exportsWalk)};
 exportsWalk(pkg.exports);if(pkg.main)roots.push(pkg.main.replace(/^\.\//,''));if(pkg.dsh?.bundle?.patch)roots.push(pkg.dsh.bundle.patch.replace(/^\.\//,''));
 for(const f of fs.readdirSync(src))if(/^(LICENSE|NOTICE|COPYING)(\.|$)/i.test(f)&&fs.statSync(path.join(src,f)).isFile())allowed.add(f);
 roots.push(...[...allowed].filter(f=>/^(locale\/|assets\/|native\/|bin\/|src\/|lib\/types\/)|(^|\/)(icon\.[^/]+|LICENSE[^/]*|NOTICE[^/]*)$/.test(f)));
 if(!pkg.exports&&!pkg.main)roots.push('index.js','client.js');
 if(pkg.dsh?.client)roots.push(...[...allowed].filter(f=>/^lib\/client[^/]*\.js$/.test(f)));
 const queue=[...roots];while(queue.length){const f=queue.pop();if(selected.has(f)||!allowed.has(f))continue;selected.add(f);if(!textExt.test(f))continue;const text=fs.readFileSync(path.join(src,f),'utf8');for(const m of text.matchAll(/['"`]((?:\.\.?\/)[^'"`\n]+)['"`]/g)){let r=path.posix.normalize(path.posix.join(path.posix.dirname(f),m[1].split('?')[0]));if(allowed.has(r))queue.push(r);else if(allowed.has(r+'.js'))queue.push(r+'.js')}
 // Packaged helper script names often use URL/path joins rather than imports.
 for(const a of allowed)if(/\.(ps1|py|exe|dll|css)$/.test(a)&&text.includes(path.posix.basename(a)))queue.push(a);
 }
 const dest=path.join(suite,'plugins',slug);if(fs.existsSync(dest)){if(!dest.startsWith(path.join(suite,'plugins')+path.sep))throw Error('Invalid output path');fs.rmSync(dest,{recursive:true})}fs.mkdirSync(dest,{recursive:true});
 const copied=[];for(const f of selected){if(deny.test(f))continue;const out=path.join(dest,f);fs.mkdirSync(path.dirname(out),{recursive:true});let data=fs.readFileSync(path.join(src,f));if(name==='dsh-whale-widget'&&f==='native/WhalePet.csproj')data=Buffer.from('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>WinExe</OutputType><TargetFramework>net10.0-windows</TargetFramework><UseWindowsForms>true</UseWindowsForms><PlatformTarget>x64</PlatformTarget><Nullable>enable</Nullable></PropertyGroup><ItemGroup><PackageReference Include="Microsoft.Web.WebView2" Version="1.0.3537.50" /></ItemGroup></Project>\n');if(textExt.test(f))data=Buffer.from(data.toString('utf8').replace(/(['"])file:\/\/\/C:\/deepseek\/resources\/app\.asar\/dsh\/node_modules\/sharp\/dist\/index\.mjs\1/g,"'sharp'"));if(name==='@local/internal-folder-browser'&&f==='index-v5.js')data=Buffer.from(data.toString('utf8').replace(/ ctx\.inject\(\['localFolderBrowser'\],[\s\S]*?\}\);\}\);\r?\n/,''));if(textExt.test(f))data=Buffer.from(portable(data.toString('utf8'),slug,f));fs.writeFileSync(out,data);copied.push(f)}
 const output={...pkg,private:true,files:copied};delete output.scripts;delete output.devDependencies;
 if(['@local/art-toolbox','@local/session-categories'].includes(name))output.dependencies={...output.dependencies,sharp:'0.35.5'};
 if(name==='dsh-whale-widget'){const license=fs.readFileSync(path.join(suite,'third-party','dsh-whale-widget','LICENSE'));fs.writeFileSync(path.join(dest,'LICENSE'),license);copied.push('LICENSE')}

 // Ordinary dependencies satisfy non-Harness peer tools without profile edits or lifecycle scripts.
 for(const [n,v]of Object.entries(output.peerDependencies||{}))if(['zod','typescript'].includes(n)){output.dependencies={...output.dependencies,[n]:v}}
 if(name==='@local/subagent-safe-defaults'&&safeDisabled){const patch=path.join(dest,pkg.dsh.bundle.patch);fs.appendFileSync(patch,'\n- id: local-subagent-safe-defaults\n  disabled: true\n')}
 fs.writeFileSync(path.join(dest,'package.json'),portable(JSON.stringify(output,null,2),slug,'package.json')+'\n');
 inventory.push({name,version:pkg.version,kind:name==='dsh-better-sidebar'||name==='dsh-whale-widget'?'modified-third-party-source':'local-source',included:true,directory:'plugins/'+slug,license:pkg.license||'UNDECLARED',defaultEnabled:name!=='@local/subagent-safe-defaults',files:copied.sort(),dependencies:output.dependencies||{},peerDependencies:output.peerDependencies||{},sourceNote:name==='dsh-better-sidebar'?'User-requested local modified tree; profile registry version is not substituted.':'Captured via package.files and runtime reference graph; no profile data copied.'});
}
// Remove prior captured packages no longer represented by the live snapshot.
for(const entry of fs.readdirSync(path.join(suite,'plugins'),{withFileTypes:true})){const target=path.resolve(suite,'plugins',entry.name);if(entry.isDirectory()&&!inventory.some(f=>f.directory==='plugins/'+entry.name)){if(path.dirname(target)!==path.join(suite,'plugins'))throw Error('Invalid obsolete output path');fs.rmSync(target,{recursive:true});}}
for(const f of inventory.filter(f=>f.included)){const hash=crypto.createHash('sha256');for(const rel of ['package.json',...f.files].sort()){hash.update(rel+'\0');hash.update(fs.readFileSync(path.join(suite,f.directory,rel)));}f.contentSha256=hash.digest('hex');}
const labels=read(path.join(suite,'scripts','feature-labels.json'));for(const f of inventory){const active=liveByName.get(f.name);f.title=labels[f.name]||f.name;f.sourceListed=true;f.bundleEnabled=active?.enabled===true;f.sourceEnabled=f.bundleEnabled&&!(f.name==='@local/subagent-safe-defaults'&&safeDisabled);f.defaultEnabled=f.sourceEnabled;f.installationMode=f.kind==='builtin'||f.kind==='official-reference'?'discover-and-enable-existing-bundle':f.included?'local-source-install':'exact-registry-install';if(f.name==='@local/subagent-safe-defaults')f.stateNote='Bundle is listed enabled, but profile row local-subagent-safe-defaults is explicitly disabled; packaged row remains disabled.';if(f.name.startsWith('@dsh-local/'))f.privacyReview='Generic runtime skill catalog UI; no copied skill bodies, session identifiers, credentials or private paths. Reads authorized current-session skill bodies at runtime.';}
const excluded=live.filter(x=>!source.dsh.profile.bundles.includes(x.name)).map(x=>({name:x.name,version:x.version,sourceListed:false,sourceEnabled:x.enabled===true,defaultEnabled:false,availability:x.availability,reason:x.availability==='profile'?'Disabled stale installed dependency; not in active profile bundle array, not redistributed or enabled.':'Inactive distribution or missing bundle; outside enabled client snapshot.'}));
const reconciliation={sourceProfileBundleCount:source.dsh.profile.bundles.length,liveEnabledBundleCount:live.filter(x=>x.enabled).length,inventoryBundleCount:inventory.length,missing:source.dsh.profile.bundles.filter(n=>!inventory.some(f=>f.name===n)),extra:inventory.filter(f=>!source.dsh.profile.bundles.includes(f.name)).map(f=>f.name),excludedDisabledProfileDependencies:excluded.filter(x=>x.availability==='profile').length};
const manifest={...previousManifest,schemaVersion:1,reconciliation,requiredSkills:previousManifest.requiredSkills,name:'harness-client-suite',capturedOn,targetHarnessVersion:process.env.DSH_SUITE_SOURCE_DSH_VERSION,snapshotRevision:capturedOn+'-rc5',updatePolicy:'Prepared local sources keep original package versions; compare content SHA-256 as well as version. Reinstall changed source through plugin_manager; never infer same-version contents are unchanged.',excluded,node: '>=24',installation:{method:'Harness plugin_manager install_bundle only',never:['write profile dependencies','relax permissions or approval policy','grant version exemptions','run dependency lifecycle scripts'],steps:['Copy deployment.example.json to an untracked deployment.json and fill required variables.','node scripts/prepare.mjs --config deployment.json','Review generated install-plan.json and per-plugin prerequisites.','Use each plugin_manager call only after explicit installation authorization; do not pass approvedBuilds without separate approval.'],dependencies:'Optional: pnpm install --ignore-scripts --config.auto-install-peers=false in each prepared plugin directory; never in a profile directory.'},environmentTemplate:'scripts/deployment.example.json',limitations:['No external binaries installed or paid integrations tested.','Target Harness must satisfy peers and engines; plugin_manager compatibility checks remain authoritative.','UNDECLARED local-source license requires owner confirmation before redistribution under a chosen license.'],features:inventory.map(({name,title,version,kind,directory,installTarget,defaultEnabled,installationMode,contentSha256})=>({name,title,version,kind,directory,installTarget,defaultEnabled,installationMode,contentSha256}))};
fs.writeFileSync(path.join(suite,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(suite,'feature-inventory.json'),JSON.stringify({schemaVersion:1,capturedOn,targetHarnessVersion:process.env.DSH_SUITE_SOURCE_DSH_VERSION,features:inventory,excluded},null,2)+'\n');
fs.writeFileSync(path.join(suite,'scripts','deployment.example.json'),JSON.stringify({variables:Object.fromEntries(Object.keys(variables).map(k=>[k,''])),requirements:variables},null,2)+'\n');
console.log(JSON.stringify({bundles:inventory.length,sourceBundles:inventory.filter(x=>x.included).length,pathVariables:Object.keys(variables).length,sha256:crypto.createHash('sha256').update(JSON.stringify(inventory)).digest('hex')},null,2));
