import {Toolbox as Previous,parameters as previousParameters,boardURL} from './pinterest-projects-v1-concept.js';
export {baseSpec,repositorySpec,kinds} from './pinterest-projects-v1-concept.js';
export const parameters=structuredClone(previousParameters);
parameters.properties.action.enum.push('syncPinterestBoards','pinterestSections');
parameters.properties.boardUrl={type:'string',description:'pinterestSections: exact Pinterest board root URL.'};
export function safeCover(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='i.pinimg.com'&&!u.username&&!u.password&&!u.port?u.href:'';}catch{return '';}}
export function mergeBoards(registry,result){
 const projects=registry.projects.map(p=>({...p}));
 for(const item of result.boards||[]){const url=boardURL(item.boardUrl),name=String(item.boardName||'').trim();if(!name||name.length>100)continue;
 const old=projects.find(p=>p.boardUrl===url);const value={...(old||{id:'pinterest-'+crypto.randomUUID(),section:'',sections:[]}),name:old?.name||name,boardName:name,boardUrl:url,coverUrl:safeCover(item.coverUrl),remote:true,syncedAt:result.syncedAt};
 if(old)projects[projects.indexOf(old)]=value;else projects.push(value);
 }
 return {...registry,projects};
}
export class Toolbox extends Previous{
 normalizeProject(p,old){return {...super.normalizeProject(p,old),...(old?.remote?{remote:true,coverUrl:safeCover(old.coverUrl),syncedAt:old.syncedAt}:{})};}
 async run(a,signal,context){
  if(a?.action==='syncPinterestBoards'){
   const result=await this.services.pinterestRead({action:'boards'},signal);const merged=mergeBoards(this.registry(),result);await this.putRegistry(merged);
   return {...this.publicRegistry(a.sessionId),syncedAt:result.syncedAt,profileUrl:result.profileUrl,partial:!!result.partial,remoteCount:result.boards.length};
  }
  if(a?.action==='pinterestSections'){
   const result=await this.services.pinterestRead({action:'sections',boardUrl:boardURL(a.boardUrl)},signal);
   return {sections:result.sections,syncedAt:result.syncedAt,partial:!!result.partial};
  }
  return super.run(a,signal,context);
 }
}
// Dedicated Playwright process; touches only a new task-owned page, no credentials/API/writes.
export async function pinterestReadOperation(page,a){
 const p=await page.context().newPage();p.setDefaultTimeout(12000);const deadline=Date.now()+35000;
 const remaining=()=>Math.max(1,deadline-Date.now());
 try{
  await p.goto('https://www.pinterest.com/',{waitUntil:'domcontentloaded',timeout:Math.min(15000,remaining())});
  await p.locator('a[data-test-id="boards-tab"], a[aria-label="你的个人资料"], a[aria-label="Your profile"]').first().waitFor({timeout:Math.min(12000,remaining())});
  const profileUrl=await p.evaluate(()=>{
   const el=document.querySelector('a[data-test-id="boards-tab"]')||document.querySelector('a[aria-label="你的个人资料"],a[aria-label="Your profile"]');
   if(!el)return '';const u=new URL(el.href),parts=u.pathname.split('/').filter(Boolean);return parts.length===1&&u.hostname==='www.pinterest.com'?'https://www.pinterest.com/'+parts[0]+'/':'';
  });
  if(!profileUrl)throw Error('无法识别已登录Pinterest账户，请在专用浏览器完成登录后重试');
  await p.goto(a.action==='sections'?a.boardUrl:profileUrl,{waitUntil:'domcontentloaded',timeout:Math.min(15000,remaining())});
  const selector=a.action==='sections'?'[data-test-id="board-header"]':'[data-test-id="profile-board-card"], [data-test-id="profile-name"]';
  await p.locator(selector).first().waitFor({timeout:Math.min(12000,remaining())});
  const found=new Map();let stable=0,partial=true;
  for(let round=0;round<16&&remaining()>1200;round++){
   const data=await p.evaluate(action=>{
    const root=location.pathname.split('/').filter(Boolean),items=[];
    if(action==='boards')for(const card of document.querySelectorAll('[data-test-id="profile-board-card"]')){
     const link=card.closest('a[href]')||card.querySelector('a[href]');if(!link)continue;const u=new URL(link.href),parts=u.pathname.split('/').filter(Boolean);
     const title=card.querySelector('[data-test-id="board-card-title"]');if(u.hostname!=='www.pinterest.com'||parts.length!==2||parts[0]!==root[0]||parts[1].startsWith('_'))continue;
     const boardName=(title?.textContent||'').trim();if(boardName)items.push({boardUrl:u.origin+'/'+parts.join('/')+'/',boardName,coverUrl:card.querySelector('img[data-test-id="cover-image"]')?.src||''});
    }
    else for(const card of document.querySelectorAll('[data-test-id^="section-"]')){
     const link=card.querySelector('a[href]');if(!link)continue;const u=new URL(link.href),parts=u.pathname.split('/').filter(Boolean);
     if(u.hostname==='www.pinterest.com'&&parts.length===3&&parts[0]===root[0]&&parts[1]===root[1]&&!parts[2].startsWith('_'))items.push({name:card.getAttribute('data-test-id').slice(8)});
    }
    const scroller=document.scrollingElement;return {items,bottom:!scroller||scroller.scrollTop+innerHeight>=scroller.scrollHeight-12,countText:document.querySelector('[data-test-id="board-count-info"]')?.innerText||'',unavailable:/board not found|图板不存在|找不到此图板/i.test(document.body.innerText)};
   },a.action);
   if(data.unavailable)throw Error('Pinterest图版不可访问');
   const before=found.size;for(const v of data.items)found.set(v.boardUrl||v.name,v);
   if(a.action==='sections'){
    const expected=data.countText.match(/(\d+)\s*(?:个图板区块|sections?)/i);if(expected&&found.size>=Number(expected[1])){partial=false;break;}
   }
   stable=found.size===before&&data.bottom?stable+1:0;if(stable>=3){partial=false;break;}
   await p.evaluate(()=>window.scrollBy(0,Math.max(600,innerHeight*0.85)));
   await p.waitForTimeout(Math.min(650,remaining()));
  }
  const syncedAt=new Date().toISOString();
  return a.action==='sections'?{sections:[...found.values()].map(v=>v.name),syncedAt,partial}:{boards:[...found.values()],profileUrl,syncedAt,partial};
 }catch(error){throw Error('Pinterest同步失败（原有项目已保留）：'+String(error.message||error));}
 finally{await p.close().catch(()=>{});}
}
