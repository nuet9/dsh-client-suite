import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export const extensions = {'.ts':'typescript','.tsx':'typescriptreact','.js':'javascript','.jsx':'javascriptreact','.mts':'typescript','.cts':'typescript','.mjs':'javascript','.cjs':'javascript'};
function contained(root, file) { const rel=path.relative(root,file); return !rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel); }
export function run(request, limits={}) {
 const root=fs.realpathSync(request.workspaceRoot); const maxFiles=limits.maxFiles??2000; const maxBytes=limits.maxFileBytes??2097152;
 const resolve=(file)=> { const target=fs.realpathSync(path.resolve(root,file)); if(!contained(root,target)) throw Error('Path escapes workspace root'); return target; };
 const configPath=request.project?resolve(request.project):ts.findConfigFile(root,ts.sys.fileExists,'tsconfig.json')??ts.findConfigFile(root,ts.sys.fileExists,'jsconfig.json');
 let parsed={fileNames:[],options:{allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext},errors:[]};
 if(configPath) { if(!contained(root,configPath)) throw Error('Project config is outside workspace'); const config=ts.readConfigFile(configPath,ts.sys.readFile); if(config.error) parsed.errors.push(config.error); else parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,path.dirname(configPath),{noEmit:true},configPath); }
 const file=request.filePath?resolve(request.filePath):undefined;
 if(file&&!extensions[path.extname(file).toLowerCase()]) throw Error('Unsupported language: TS/JS only');
 if(!configPath&&!file) throw Error('No tsconfig.json/jsconfig.json; provide filePath for inferred TS/JS checks');
 const names=[...new Set([...parsed.fileNames,...(file?[file]:[])])].sort();
 if(names.length>maxFiles) throw Error('Project exceeds maxFiles: '+maxFiles);
 let snapshots=0;
 const host={getScriptFileNames:()=>names,getScriptVersion:()=> '0',getScriptSnapshot:(name)=> { if(!ts.sys.fileExists(name))return; if(fs.statSync(name).size>maxBytes)throw Error('File exceeds maxFileBytes: '+name); if(++snapshots>maxFiles+200)throw Error('Dependency graph exceeds file budget');const text=ts.sys.readFile(name);return text===undefined?undefined:ts.ScriptSnapshot.fromString(text); },getCurrentDirectory:()=>root,getCompilationSettings:()=>({...parsed.options,noEmit:true}),getDefaultLibFileName:o=>ts.getDefaultLibFilePath(o),fileExists:ts.sys.fileExists,readFile:ts.sys.readFile,readDirectory:ts.sys.readDirectory,directoryExists:ts.sys.directoryExists,realpath:ts.sys.realpath,getDirectories:ts.sys.getDirectories};
 const service=ts.createLanguageService(host);
 const range=(name,span)=>{const sf=service.getProgram()?.getSourceFile(name)??ts.createSourceFile(name,ts.sys.readFile(name)??'',ts.ScriptTarget.Latest);return {start:sf.getLineAndCharacterOfPosition(span.start),end:sf.getLineAndCharacterOfPosition(span.start+span.length)};};
 try {
 if(request.action==='diagnostics') {
 const ds=[...parsed.errors,...service.getCompilerOptionsDiagnostics()];
 for(const name of file?[file]:names) { ds.push(...service.getSyntacticDiagnostics(name),...service.getSemanticDiagnostics(name)); }
 const unique=new Map();for(const d of ds){ const item={filePath:d.file?.fileName??null,code:d.code,category:ts.DiagnosticCategory[d.category].toLowerCase(),message:ts.flattenDiagnosticMessageText(d.messageText,'\n'),...(d.file&&d.start!==undefined?{range:{start:d.file.getLineAndCharacterOfPosition(d.start),end:d.file.getLineAndCharacterOfPosition(d.start+(d.length??0))}}:{})};unique.set(JSON.stringify(item),item); }
 const all=[...unique.values()].sort((a,b)=>(a.filePath??'').localeCompare(b.filePath??'')||(a.range?.start.line??-1)-(b.range?.start.line??-1)||(a.range?.start.character??-1)-(b.range?.start.character??-1)||a.code-b.code);
 const limit=request.limit??100;return {engine:'typescript',version:ts.version,workspaceRoot:root,project:configPath??null,filesChecked:(file?[file]:names).length,total:all.length,truncated:all.length>limit,diagnostics:all.slice(0,limit),projectReferences:parsed.projectReferences?.length??0};
 }
 if(!file)throw Error('filePath required for language query');
 const sf=service.getProgram()?.getSourceFile(file);if(!sf)throw Error('File not in language service');
 const line=request.position?.line,character=request.position?.character;
 if(!Number.isInteger(line)||!Number.isInteger(character)||line<0||character<0)throw Error('position must use nonnegative zero-based UTF-16 coordinates');
 const starts=sf.getLineStarts(); if(line>=starts.length)throw Error('Line outside file');const lineEnd=line+1<starts.length?starts[line+1]:sf.text.length;if(starts[line]+character>lineEnd)throw Error('Character outside line');
 const offset=sf.getPositionOfLineAndCharacter(line,character);
 if(request.operation==='hover'){const q=service.getQuickInfoAtPosition(file,offset);return {kind:'hover',hover:q?{contents:ts.displayPartsToString(q.displayParts)+(q.documentation?.length?'\n'+ts.displayPartsToString(q.documentation):''),range:range(file,q.textSpan)}:null};}
 const results=request.operation==='goToDefinition'?service.getDefinitionAtPosition(file,offset):request.operation==='findReferences'?service.getReferencesAtPosition(file,offset):request.operation==='goToImplementation'?service.getImplementationAtPosition(file,offset):(()=>{throw Error('Unsupported operation');})();
 const limit=request.limit??100;const locations=(results??[]).map(x=>({uri:pathToFileURL(x.fileName).href,range:range(x.fileName,x.textSpan)}));return {kind:'locations',locations:locations.slice(0,limit),resolvedWorkspaceUri:pathToFileURL(root).href,total:locations.length,truncated:locations.length>limit};
 } finally {service.dispose();}
}
