import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.platform!=='win32')throw Error('Whale desktop pin requires Windows x64, .NET 10 SDK, and WebView2 runtime; the web widget does not require this build.');
if(!process.argv.includes('--allow-restore'))throw Error('This optional build downloads NuGet WebView2 and requires explicit --allow-restore. No software is installed by prepare.');
const dir=path.join(root,'scripts','prepared','dsh-whale-widget');
if(!fs.existsSync(path.join(dir,'native','WhalePet.csproj')))throw Error('Prepare dsh-whale-widget first.');
const result=spawnSync('dotnet',['publish',path.join(dir,'native','WhalePet.csproj'),'-c','Release','-r','win-x64','--self-contained','false','-o',path.join(dir,'bin')],{stdio:'inherit',windowsHide:true});
if(result.error)throw Error('Install/configure .NET 10 SDK separately: '+result.error.message);
if(result.status===0){const file=path.join(dir,'package.json');const pkg=JSON.parse(fs.readFileSync(file,'utf8'));pkg.files=[...new Set([...pkg.files,'bin'])];fs.writeFileSync(file,JSON.stringify(pkg,null,2)+'\n')}
process.exitCode=result.status||0;
