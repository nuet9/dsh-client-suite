window.__ModuleLoader__.load({id:'@local/file-folder-open/host-v3',factory(){
 function targetOf(address){
  if(typeof address!=='string')return;
  const m=/^dsh-resource:\/\/file\/session\/[^/]+\/(.*)$/.exec(address);if(!m)return;
  let p;try{p=m[1].split('/').map(decodeURIComponent).join('/');}catch{return;}
  p=p.replace(/^\/([a-z]:\/)/i,'$1');
  if(!/^[a-z]:\//i.test(p)||!p.endsWith('/'))return;
  return p.replace(/\/$/,'').replace(/\//g,String.fromCharCode(92));
 }
 function apply(ctx){ctx.effect(()=>{
  const proto=Object.getPrototypeOf(ctx.sidebarRight),descriptor=Object.getOwnPropertyDescriptor(proto,'placeResource');
  if(typeof descriptor?.value!=='function')throw new Error('sidebar navigation interface unavailable');
  const original=descriptor.value;
  function placeResource(sessionId,actions,address,options){
   const path=targetOf(address),scope=ctx.sessions.scope(sessionId);
   if(!path||!scope)return original.call(this,sessionId,actions,address,options);
   return scope.remote.commands.execute('/reveal-system-folder-v3 '+JSON.stringify(path),[],new AbortController().signal).then(result=>{
    if(!result.ok||result.value?.result?.kind!=='success'){console.error('打开所在文件夹失败',result);return original.call(this,sessionId,actions,address,options);}
   }).catch(error=>{console.error('打开所在文件夹失败',error);return original.call(this,sessionId,actions,address,options);});
  }
  Object.defineProperty(proto,'placeResource',{...descriptor,value:placeResource});const status={version:'1.2.0',targetOf};window.__fileFolderOpen=status;
  return ()=>{if(proto.placeResource===placeResource)Object.defineProperty(proto,'placeResource',descriptor);if(window.__fileFolderOpen===status)delete window.__fileFolderOpen;};
 });}
 return {apply,inject:['sidebarRight','sessions']};
}});
