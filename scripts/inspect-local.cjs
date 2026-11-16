const fs=require('node:fs'),p=require('node:path');
const root=process.env.DSH_PROFILE_DIR;
if(!root) throw Error('Set DSH_PROFILE_DIR for read-only source inspection');
const x=JSON.parse(fs.readFileSync(p.join(root,'package.json')));
for(const n of x.dsh.profile.bundles){if(n.startsWith('@deepseek'))continue;let d=x.dependencies[n];let dir=d?.startsWith('link:')?d.slice(5):p.join(root,'node_modules',n);try{dir=fs.realpathSync(dir);const j=JSON.parse(fs.readFileSync(p.join(dir,'package.json')));console.log(JSON.stringify({name:n,dir,version:j.version,files:j.files,license:j.license,deps:j.dependencies,peers:j.peerDependencies,scripts:j.scripts,dsh:j.dsh}));}catch(e){console.log(n+': '+e.message)}}
