export function createReferenceRegistry(entries){
 if(!Array.isArray(entries))throw TypeError('Reference providers must be an array');
 const byId=new Map();
 const providers=entries.map(entry=>{
  if(!entry||typeof entry.id!=='string'||!/^[a-z][a-z0-9-]{1,31}$/.test(entry.id))throw Error('Invalid reference provider id');
  if(byId.has(entry.id))throw Error('Duplicate reference provider: '+entry.id);
  if(typeof entry.label!=='string'||!entry.label.trim())throw Error('Reference provider label is required');
  if(!['connected','unavailable'].includes(entry.status))throw Error('Invalid reference provider status: '+entry.id);
  const caps=entry.capabilities||{};
  const capabilities=Object.freeze(Object.fromEntries(['search','visualReview','remoteSave','destination'].map(key=>[key,caps[key]===true])));
  if(entry.status==='connected'&&(typeof entry.taskKind!=='string'||typeof entry.adapter!=='string'||!capabilities.search))throw Error('Connected reference providers require taskKind, adapter, and search capability: '+entry.id);
  if(entry.status==='unavailable'&&(entry.taskKind!==null||entry.adapter!==null||Object.values(capabilities).some(Boolean)))throw Error('Unavailable reference providers cannot declare active operations: '+entry.id);
  const provider=Object.freeze({id:entry.id,label:entry.label,status:entry.status,taskKind:entry.taskKind,adapter:entry.adapter,capabilities});
  byId.set(provider.id,provider);
  return provider;
 });
 return Object.freeze({
  list:()=>providers,
  get:id=>byId.get(id)||null,
  resolve:(taskKind,id)=>{
   const provider=byId.get(id||'pinterest');
   if(!provider)throw Error('Unknown reference provider: '+String(id));
   if(provider.status!=='connected'||provider.taskKind!==taskKind||!provider.adapter)throw Error('Reference provider is not connected or not mapped to this task: '+provider.id);
   return provider;
  }
 });
}

const unavailable={search:false,visualReview:false,remoteSave:false,destination:false};
export const referenceRegistry=createReferenceRegistry([
 {id:'pinterest',label:'Pinterest',status:'connected',taskKind:'pinterest',adapter:'pinterest-queue-v11',capabilities:{search:true,visualReview:true,remoteSave:true,destination:true}},
 {id:'huaban',label:'花瓣',status:'unavailable',taskKind:null,adapter:null,capabilities:unavailable},
 {id:'yandex',label:'Yandex',status:'unavailable',taskKind:null,adapter:null,capabilities:unavailable}
]);
export const referenceProviders=referenceRegistry.list();
export const getReferenceProvider=referenceRegistry.get;
export const resolveReferenceProvider=referenceRegistry.resolve;
