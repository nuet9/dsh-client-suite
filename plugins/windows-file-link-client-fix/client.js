window.__ModuleLoader__.load({
 id:'@local/windows-file-link-client-fix',
 factory(){
  function normalizeAddress(address){
   if(typeof address!=='string')return address;
   const prefix='dsh-resource://file/session/';
   if(!address.startsWith(prefix))return address;
   const cut=address.indexOf('/',prefix.length);
   if(cut<0)return address;
   const path=address.slice(cut+1);
   if(path[0]==='/' && /^[a-z]:[/]/i.test(path.slice(1)))return address.slice(0,cut+1)+path.slice(1);
   return address;
  }
  function apply(ctx){
   ctx.effect(()=>{
    const controller=ctx.sidebarRight,prototype=Object.getPrototypeOf(controller);
    const descriptor=Object.getOwnPropertyDescriptor(prototype,'placeResource');
    if(typeof descriptor?.value!=='function')throw new Error('Unsupported sidebarRight.placeResource');
    const original=descriptor.value;
    function placeResource(sessionId,actions,address,options){return original.call(this,sessionId,actions,normalizeAddress(address),options);}
    Object.defineProperty(prototype,'placeResource',{...descriptor,value:placeResource});
    const status={version:'1.1.1',installed:true,normalizeAddress};
    window.__windowsFileLinkFix=status;
    return ()=>{if(prototype.placeResource===placeResource)Object.defineProperty(prototype,'placeResource',descriptor);if(window.__windowsFileLinkFix===status)delete window.__windowsFileLinkFix;};
   });
  }
  return {apply,inject:['sidebarRight']};
 }
});
