import {assertBrowserSuccess} from './browser-dispatch-v1.js';
import {readFile,writeFile,rename} from 'node:fs/promises';
// All website writes use ordinary Playwright UI clicks; no Pinterest API endpoints.
export const queueParameters={type:'object',additionalProperties:false,required:['action'],properties:{action:{type:'string',enum:['begin','resume','create','bind','search','enqueue','drain','status','finish','close']},queueId:{type:'string',description:'Shared queue identifier returned by begin. Give this to the three research agents.'},jobId:{type:'string',description:'begin/resume: toolbox task ID and recovery directory. resume explicitly starts another authorized ten-minute round from persisted pending candidates; requires queueId and original owner.'},profileUrl:{type:'string',description:'create: authorized Pinterest profile URL; creates one public board, binds it and skips empty-board baseline.'},auto:{type:'boolean',description:'drain: true enables owner-authorized continuous saving until cutoff; false pauses it.'},boardUrl:{type:'string',description:'begin/bind: authorized destination board. Omit in begin to start research immediately; owner binds before saving.'},boardName:{type:'string',description:'begin: exact displayed destination board name.'},section:{type:'string',description:'begin: existing section name; omit to save to the board root.'},startedAt:{type:'string',description:'begin: original round start ISO timestamp. Deadline is always start + 600 seconds.'},query:{type:'string',description:'search: ONLY browser entry for researchers. Returns sourceId, visible candidates and screenshot. View screenshot with read_image before enqueue; never call Playwright or tabs directly.'},sourceId:{type:'string',description:'search: existing queue source to scroll, without reloading it.'},scroll:{type:'boolean',description:'search: scroll an existing source down one viewport.'},items:{type:'array',maxItems:25,items:{type:'object',additionalProperties:false,required:['pinId','reviewed','reason'],properties:{pinId:{type:'string',pattern:'^[0-9]+$'},reviewed:{type:'boolean',description:'Must be true after actually viewing the source screenshot.'},reason:{type:'string',description:'One concrete useful visible feature.'}}}},limit:{type:'integer',minimum:1,maximum:5,description:'drain: max queued cards per short batch; default 3.'}}};
export function parseBrowserResult(value){
 assertBrowserSuccess(value);let found;
 function walk(v){if(found!==undefined)return;if(typeof v==='string'){if(v.includes('### Result\n')){const t=v.split('### Result\n')[1].split('\n###')[0];try{found=JSON.parse(t);return;}catch{}}let o;try{o=JSON.parse(v);}catch{}if(o&&typeof o==='object')walk(o);return;}if(v&&typeof v==='object'){assertBrowserSuccess(v);for(const x of Object.values(v))walk(x);}}
 walk(value);if(found===undefined)throw Error('Browser returned no parsed result');return found;
}
export async function browserOperation(page,a){
 const context=page.context();
 // Keep Playwright Page objects outside the document: window.name is reset by cross-site navigation.
 const registryKey=Symbol.for('dsh.art-toolbox.pages.v1');
 // MCP creates a fresh VM per call. Store refs on the host BrowserContext, never VM globalThis.
 let pages=context[registryKey];if(!pages){pages=new Map();context[registryKey]=pages;}
 for(const [name,p] of pages)if(p.isClosed())pages.delete(name);
 async function owned(name,create=false){
  let p=pages.get(name);if(p&&!p.isClosed())return p;
  if(!create)return null;
  if(pages.size>=5)throw Error('Toolbox page limit reached (5); close the active round before opening another');
  p=await context.newPage();pages.set(name,p);return p;
 }
 const now=()=>Date.now();const remaining=()=>a.deadline-now();
 if(a.action==='create'){
  const p=await owned(a.pageName,true);p.setDefaultTimeout(4000);let created=false;
  try{await p.goto(a.profileUrl,{waitUntil:'domcontentloaded',timeout:8000});
   await p.getByRole('button',{name:/^创建 Pin 图或图板$|^Create Pin or board$/}).click();
   await p.getByRole('menuitem',{name:/^图板$|^Board$/}).click();
   await p.locator('#board-name').fill(a.boardName);
   const secret=p.getByRole('checkbox');if(await secret.count()===1&&await secret.isChecked())await secret.uncheck();
   await p.getByRole('dialog').getByRole('button',{name:/^创建$|^Create$/}).click();created=true;
   const done=p.getByRole('dialog').getByRole('button',{name:/^完成$|^Done$/});if(await done.count())await done.click();
   await p.waitForURL(u=>u.pathname.split('/').filter(Boolean).length===2,{timeout:6000});
   return {boardUrl:p.url(),boardName:a.boardName,created:true};
  }catch(e){throw Error((created?'Board may already exist; inspect before retry. ':'')+String(e));}finally{await p.close();}
 }
 if(a.action==='baseline'){
  const p=await owned(a.pageName,true);p.setDefaultTimeout(4000);const signatures=new Set(),pinIds=new Set();let visited=0;const baselineStart=Date.now();
  try{
   await p.goto(a.boardUrl,{waitUntil:'domcontentloaded',timeout:8000});await p.getByText(a.boardName,{exact:true}).first().waitFor({timeout:5000});
   await p.locator('h2').first().waitFor({timeout:4000}).catch(()=>{});
   const urls=await p.locator('a[href]').evaluateAll((es,base)=>[...new Set(es.map(e=>e.href).filter(h=>h.startsWith(base)&&h!==base&&new URL(h).pathname.slice(new URL(base).pathname.length).split('/').filter(Boolean).length===1))],a.boardUrl);
   for(const url of [...new Set([...(a.section?[a.boardUrl+encodeURIComponent(a.section)+'/']:[]),a.boardUrl,...urls.slice(0,6)])]){
    if(remaining()<30000||Date.now()-baselineStart>30000)break;if(p.url()!==url)await p.goto(url,{waitUntil:'commit',timeout:6000});
    await p.locator('[data-test-id=pin] img').first().waitFor({timeout:6000}).catch(()=>{});
    for(let i=0;i<4;i++){const cards=await p.locator('[data-test-id=pin]').evaluateAll(es=>es.map(e=>({id:e.getAttribute('data-test-pin-id'),sig:e.querySelector('[data-test-image-signature]')?.getAttribute('data-test-image-signature')})));for(const c of cards){if(c.sig)signatures.add(c.sig);if(c.id)pinIds.add(c.id);}if(i<3){await p.mouse.wheel(0,650);await p.waitForTimeout(400);}}
    visited++;
   }
   return {signatures:[...signatures],pinIds:[...pinIds],visitedPages:visited,scope:'Target section first, then board root and up to six sections; four viewports per page, 30-second read budget'};
  }finally{await p.close();}
 }
 if(a.action==='search'){
  if(remaining()<120000)return {stopped:true,reason:'Search cutoff reached'};
  const p=await owned(a.pageName,true);p.setDefaultTimeout(3500);
  if(a.url)await p.goto(a.url,{waitUntil:'domcontentloaded',timeout:Math.min(9000,remaining())});
  if(a.scroll)await p.mouse.wheel(0,650);
  await p.locator('[data-test-id=pin] img').first().waitFor({timeout:5000});
  await p.screenshot({path:a.screenshot,timeout:5000});
  const cards=await p.locator('[data-test-id=pin]').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.bottom>120&&r.top<innerHeight&&r.width>0}).map(e=>({pinId:e.getAttribute('data-test-pin-id'),pinUrl:e.querySelector('a[href*="/pin/"]')?.href,imageUrl:e.querySelector('img')?.src,signature:e.querySelector('[data-test-image-signature]')?.getAttribute('data-test-image-signature')})).filter(x=>x.pinId&&x.imageUrl));
  return {cards,screenshot:a.screenshot};
 }
 if(a.action==='drain'){
  const results=[];const batchStart=now();const budget=ms=>Math.max(1,Math.min(ms,remaining()-25000,42000-(now()-batchStart)));const p=await owned(a.pageName,true);p.setDefaultTimeout(3000);
  for(const item of a.items){
   if(remaining()<30000||now()-batchStart>30000)break;
   const t=now();let clicked=false,stage='navigate';
   try{
    // A dedicated detail page makes saving independent of virtualized search cards and scrolling.
    await p.goto('https://www.pinterest.com/pin/'+item.pinId+'/',{waitUntil:'domcontentloaded',timeout:budget(8000)});
    stage='destination';const picker=p.locator('[data-test-id=PinBetterSaveDropdown]').first();
    await picker.waitFor({state:'visible',timeout:budget(4000)});
    // Pinterest renders a clickable placeholder before board data is ready. Wait on data, not a fixed sleep.
    await p.waitForFunction(()=>{const e=document.querySelector('[data-test-id=PinBetterSaveDropdown]');return e&&e.textContent.trim()&&!/^[.…]+$/.test(e.textContent.trim());},{},{timeout:budget(8000)});
    const dialog=p.getByRole('dialog').last();
    const input=dialog.locator('input[aria-label="通过你的图板搜索"],input[aria-label="Search through your boards"]');
    for(let attempt=0;attempt<2;attempt++){
     await picker.click({timeout:budget(3000)});
     try{await input.waitFor({state:'visible',timeout:budget(5000)});break;}
     catch(e){if(attempt===1)throw e;await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden',timeout:budget(2000)});}
    }
    await input.fill(a.boardName,{timeout:budget(3000)});
    const choice=dialog.getByText(a.boardName,{exact:true});await choice.waitFor({state:'visible',timeout:budget(5000)});
    if(await choice.count()!==1)throw Error('Ambiguous destination; no save attempted');
    // Conservatively mark the write attempt BEFORE the click. Never replay an uncertain save.
    stage='select-board';if(!a.section)clicked=true;await choice.click({timeout:budget(3000)});
    if(a.section){const section=dialog.getByText(a.section,{exact:true});await section.waitFor({state:'visible',timeout:budget(3000)});if(await section.count()!==1)throw Error('Ambiguous section');stage='select-section';clicked=true;await section.click({timeout:budget(3000)});}
    stage='verify';await dialog.waitFor({state:'hidden',timeout:budget(3500)});
    await p.getByRole('button',{name:/已收藏的 Pin 图|Saved Pin/}).first().waitFor({state:'visible',timeout:budget(3500)});
    results.push({pinId:item.pinId,status:'verified',destinationSelected:a.section||a.boardName,elapsedMs:now()-t,sourceUrl:p.url()});
   }catch(e){const diagnostic=await p.evaluate(()=>({url:location.href,visibility:document.visibilityState,dialogs:[...document.querySelectorAll('[role=dialog]')].map(e=>e.textContent?.slice(0,200))})).catch(()=>null);results.push({pinId:item.pinId,status:clicked?'unverified':'skipped',writeAttempted:clicked,stage,diagnostic,elapsedMs:now()-t,reason:String(e).slice(0,1800)});await p.keyboard.press('Escape').catch(()=>{});}
  }
  return {results,elapsedMs:now()-batchStart};
 }
 if(a.action==='finish'){
  const p=await owned(a.pageName,true);p.setDefaultTimeout(4000);await p.goto(a.boardUrl,{waitUntil:'domcontentloaded',timeout:8000});
  await p.locator('a[href*="/pin/"] img').first().waitFor({timeout:4000}).catch(()=>{});
  await p.screenshot({path:a.screenshot,timeout:4000});return {url:p.url(),text:(await p.locator('body').innerText()).slice(0,1600),screenshot:a.screenshot};
 }
 if(a.action==='close'){
  let closed=0;for(const name of a.pageNames){const p=pages.get(name);if(p){await p.close().catch(()=>{});pages.delete(name);closed++;}}return {closed};
 }
 throw Error('Unknown browser operation');
}

export function queueService({callBrowser,browserStatus,mkdir,outputDir,authorizeReader=async()=>false,clock=Date.now,uuid=()=>crypto.randomUUID(),setTimer=setTimeout,clearTimer=clearTimeout,storage={readFile,writeFile,rename}}){
 const queues=new Map();let disposed=false,lifecycle=Promise.resolve();let writer=Promise.resolve(),browserTail=Promise.resolve();
 const exclusiveBrowser=fn=>{const p=browserTail.then(()=>{if(disposed)throw Error('Toolbox service stopped');return fn();});browserTail=p.catch(()=>{});return p;};
 const recoveryFile=q=>q.root+'/pinterest-queue-'+q.id+'.json';
 function persist(q){
  const data=JSON.stringify({version:1,id:q.id,owner:q.owner,jobId:q.jobId,deadline:q.deadline,boardUrl:q.boardUrl,boardName:q.boardName,section:q.section,baseline:q.baseline,items:q.items,observed:[...q.observed],sources:[...q.sources],existingPinIds:[...q.existingPinIds],existingSignatures:[...q.existingSignatures],saveMs:q.saveMs,timings:q.timings,lastError:q.lastError,browserFailed:!!q.browserFailed,closed:!!q.closing},null,2);
  q.persistence=(q.persistence||Promise.resolve()).catch(()=>{}).then(async()=>{const file=recoveryFile(q);await storage.writeFile(file+'.tmp',data,'utf8');await storage.rename(file+'.tmp',file);});return q.persistence;
 }
 const snapshot=q=>({queueId:q.id,recoveryFile:recoveryFile(q),closed:!!q.closing,expired:clock()>=q.deadline,deadline:new Date(q.deadline).toISOString(),remainingSeconds:Math.max(0,Math.ceil((q.deadline-clock())/1000)),destinationReady:!!q.boardUrl,auto:!!q.auto,observed:q.observed.size,...Object.fromEntries(['pending','saving','verified','already-saved','unverified','skipped','blocked'].map(s=>[s==='already-saved'?'alreadySaved':s,q.items.filter(i=>i.status===s).length])),totalSaveMs:q.saveMs,boardUrl:q.boardUrl,boardName:q.boardName,baseline:q.baseline,timings:q.timings,lastError:q.lastError});
 async function call(q,a){const t=clock();try{return await exclusiveBrowser(()=>{if(a.action!=='close'&&(q.closing||clock()>=q.deadline))throw Error('Round stopped before browser execution');if(q.browserFailed&&a.action!=='close')throw Error('Browser failed; no automatic relaunch');q.browserTouched=true;return callBrowser(a).catch(e=>{q.browserFailed=true;q.auto=false;q.lastError=String(e.message||e);throw e;});});}finally{const m=q.timings[a.action]??={calls:0,ms:0};m.calls++;m.ms+=clock()-t;}}
 function destination(a){const u=new URL(a.boardUrl);if(u.origin!=='https://www.pinterest.com'||!/^\/[^/]+\/[^/]+\/$/.test(u.pathname)||/^\/(pin|search)\//.test(u.pathname))throw Error('Expected a real Pinterest board URL');if(!a.boardName?.trim())throw Error('Exact boardName required');return {boardUrl:u.href,boardName:a.boardName,section:a.section||''};}
 async function bind(q,a){const dest=destination(a);const baseline=await call(q,{action:'baseline',deadline:q.deadline,pageName:'atb-'+q.id+'-baseline',...dest});Object.assign(q,dest);q.existingSignatures=new Set(baseline.signatures||[]);q.existingPinIds=new Set(baseline.pinIds||[]);q.baseline={knownImages:q.existingSignatures.size,visitedPages:baseline.visitedPages,scope:baseline.scope};for(const i of q.items)if(i.status==='pending'&&(q.existingPinIds.has(i.pinId)||(i.signature&&q.existingSignatures.has(i.signature))))i.status='already-saved';}
 async function batch(q,limit=5){const run=async()=>{if(q.closing||q.deadline-clock()<=30000){q.auto=false;return snapshot(q);}if(!q.boardUrl)throw Error('Owner must bind a destination before saving');let items=q.items.filter(i=>i.status==='pending');const first=items[0];if(!first)return snapshot(q);items=items.slice(0,limit);for(const i of items)i.status='saving';await persist(q);let result;try{result=await call(q,{action:'drain',pageName:'atb-'+q.id+'-writer',deadline:q.deadline,items,boardName:q.boardName,section:q.section});}catch(e){for(const i of items){i.status='unverified';i.writeAttempted=true;i.reason='Browser operation interrupted; inspect destination before retry';}await persist(q);throw e;}for(const i of items)if(i.status==='saving')i.status='pending';for(const r of result.results||[]){const item=q.items.find(i=>i.pinId===r.pinId);if(item){Object.assign(item,r);q.saveMs+=r.elapsedMs||0;if(r.status==='verified'){q.existingPinIds.add(item.pinId);if(item.signature)q.existingSignatures.add(item.signature);}}}const failures=(result.results||[]).filter(r=>['skipped','unverified','blocked'].includes(r.status)).length;if(failures>=2){q.auto=false;q.lastError='Repeated save failures; paused with reviewed candidates preserved';}await persist(q);return {...snapshot(q),results:result.results};};const p=writer.then(run);writer=p.catch(()=>{});return p;}
 function pump(q){if(!q.auto||q.worker||q.closing)return;q.worker=(async()=>{while(q.auto&&!q.closing&&q.deadline-clock()>30000&&q.items.some(i=>i.status==='pending')){const before=new Set(q.items.filter(i=>i.status==='pending').map(i=>i.pinId));await batch(q);if(!q.items.some(i=>before.has(i.pinId)&&i.status!=='pending')){q.auto=false;q.lastError='No save progress; automatic saving paused';break;}}})().catch(e=>{q.auto=false;q.lastError=String(e);}).finally(()=>{q.worker=null;});}
 async function cleanup(q){
  q.auto=false;q.closing=true;clearTimer(q.timer);
  await q.worker;await writer;
  if(q.browserTouched&&(await browserStatus()).mode==='background'){try{await call(q,{action:'close',pageNames:[...q.sources.values()].map(s=>s.pageName).concat('atb-'+q.id+'-finish','atb-'+q.id+'-writer','atb-'+q.id+'-create','atb-'+q.id+'-baseline')});}catch(e){q.lastError=String(e);}}
  await persist(q);
 }
 function expire(q){clearTimer(q.timer);q.timer=setTimer(()=>{q.cleanup=cleanup(q).catch(e=>{q.lastError=String(e);});},Math.max(1,q.deadline-clock()));q.timer?.unref?.();}
 async function invoke(a,session){
  if(disposed)throw Error('Toolbox service stopped');
  if(a.action==='begin'){
   if(typeof a.jobId!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(a.jobId))throw Error('Invalid jobId');
   const same=[...queues.values()].find(q=>q.jobId===a.jobId&&q.owner===session&&!q.closing&&clock()<q.deadline);if(same)return snapshot(same);
   if([...queues.values()].some(q=>!q.closing&&clock()<q.deadline))throw Error('Another Pinterest round is active; reuse its queue or finish it first');
   const status=await browserStatus();if(!['background','closed'].includes(status.mode))throw Error('Dedicated background browser required');
   const start=a.startedAt?Date.parse(a.startedAt):clock();if(!Number.isFinite(start)||start>clock()+1000||start+600000<=clock())throw Error('Round start invalid or expired');
   const id=uuid(),q={id,owner:session,jobId:a.jobId,deadline:start+600000,observed:new Map(),items:[],sources:new Map(),existingSignatures:new Set(),existingPinIds:new Set(),saveMs:0,root:outputDir(a.jobId),timings:{},boardUrl:null};await mkdir(q.root,{recursive:true});queues.set(id,q);expire(q);try{if(a.boardUrl)await bind(q,a);}catch(e){await cleanup(q);queues.delete(id);throw e;}return snapshot(q);
  }
  if(a.action==='resume'){
   if(!/^[-a-zA-Z0-9_]{8,100}$/.test(a.jobId||'')||!/^[-a-zA-Z0-9_]{1,100}$/.test(a.queueId||''))throw Error('Valid jobId and queueId required');
   let q=queues.get(a.queueId);
   if(!q){const raw=JSON.parse(await storage.readFile(outputDir(a.jobId)+'/pinterest-queue-'+a.queueId+'.json','utf8'));if(raw.version!==1||raw.id!==a.queueId||raw.jobId!==a.jobId)throw Error('Invalid recovery file');q={...raw,closing:!!raw.closed,root:outputDir(a.jobId),observed:new Map(raw.observed),sources:new Map(raw.sources),existingPinIds:new Set(raw.existingPinIds),existingSignatures:new Set(raw.existingSignatures)};}
   if(q.owner!==session)throw Error('Only original queue owner may resume');if([...queues.values()].some(other=>other.id!==q.id&&!other.closing&&clock()<other.deadline))throw Error('Another Pinterest round is active');await q.cleanup;
   if(q.worker||(!q.closing&&clock()<q.deadline))throw Error('Finish or close the active round before resuming');
   const same=[...queues.values()].find(q=>q.jobId===a.jobId&&q.owner===session&&!q.closing&&clock()<q.deadline);if(same)return snapshot(same);
   if([...queues.values()].some(q=>!q.closing&&clock()<q.deadline))throw Error('Another Pinterest round is active; reuse its queue or finish it first');
   const status=await browserStatus();if(!['background','closed'].includes(status.mode))throw Error('Dedicated background browser required');
   const start=a.startedAt?Date.parse(a.startedAt):clock();if(!Number.isFinite(start)||start>clock()+1000||start+600000<=clock())throw Error('Round start invalid or expired');
   q.deadline=start+600000;q.closing=false;q.auto=false;q.lastError=null;q.browserFailed=false;q.browserTouched=false;q.cleanup=null;q.sources=new Map();q.observed=new Map();
   for(const i of q.items){if(i.status==='saving'){i.status='unverified';i.writeAttempted=true;i.reason='Interrupted save; not automatically replayed';}else if(['skipped','blocked'].includes(i.status)&&i.writeAttempted===false)i.status='pending';}
   queues.set(q.id,q);expire(q);await persist(q);return snapshot(q);
  }
  const q=queues.get(a.queueId);if(!q)throw Error('Queue not found; use resume with jobId to recover an explicitly authorized new round');
  if(q.owner!==session){if(!['search','enqueue','status'].includes(a.action)||!await authorizeReader(q,session))throw Error('Only queue owner or its admitted read-only researcher may access this queue');}
  if(a.action==='status')return {...snapshot(q),items:q.items.slice(-30).map(({pinId,status,reason,stage,elapsedMs,diagnostic})=>({pinId,status,reason,stage,elapsedMs,diagnostic}))};
  if(a.action==='close'){await (q.cleanup??=cleanup(q));return snapshot(q);}
  if(a.action==='finish'){q.auto=false;await q.worker;if(!q.boardUrl)throw Error('No destination bound');if(clock()>=q.deadline)return {...snapshot(q),stopped:true};try{return {...snapshot(q),...await call(q,{action:'finish',pageName:'atb-'+q.id+'-finish',boardUrl:q.section?q.boardUrl+encodeURIComponent(q.section)+'/':q.boardUrl,screenshot:q.root+'/图版快速预览.png'})};}finally{await(q.cleanup??=cleanup(q));}}
  if(q.closing||clock()>=q.deadline)throw Error('Round closed or expired; candidates retained in '+recoveryFile(q)+'. Owner may explicitly resume a new round.');
  if(a.action==='create'){
   if(q.deadline-clock()<60000)throw Error('Insufficient time to create board');if(q.boardUrl)throw Error('Destination already bound');const u=new URL(a.profileUrl);if(u.origin!=='https://www.pinterest.com'||u.pathname.split('/').filter(Boolean).length!==1||!a.boardName?.trim())throw Error('Exact profile URL and board name required');
   const r=await call(q,{action:'create',pageName:'atb-'+q.id+'-create',profileUrl:u.href,boardName:a.boardName,deadline:q.deadline});Object.assign(q,destination(r));q.baseline={knownImages:0,scope:'Newly created empty board'};return snapshot(q);
  }
  if(a.action==='bind'){if(q.boardUrl)throw Error('Destination already bound');await bind(q,a);return snapshot(q);}
  if(a.action==='search'){
   if(q.deadline-clock()<=120000)return {...snapshot(q),stopped:true};let source;
   if(a.sourceId){source=q.sources.get(a.sourceId);if(!source)throw Error('Unknown source');if(source.owner!==session)throw Error('Source belongs to another researcher');}
   else{if(!a.query?.trim()||a.query.length>300)throw Error('Search query required');source=[...q.sources.values()].find(s=>s.owner===session);if(source)source.query=a.query;else{if(q.sources.size>=3)throw Error('Research page limit reached (3); reuse existing researchers');const id=uuid();source={id,owner:session,pageName:'atb-'+q.id+'-'+id,query:a.query};q.sources.set(id,source);}}
   const r=await call(q,{action:'search',deadline:q.deadline,pageName:source.pageName,url:a.sourceId?null:'https://www.pinterest.com/search/pins/?q='+encodeURIComponent(a.query),scroll:!!a.scroll,screenshot:q.root+'/search-'+source.id+'-'+uuid()+'.png'});for(const c of r.cards||[])q.observed.set(session+'\0'+c.pinId,{...c,sourceId:source.id,pageName:source.pageName});return {...snapshot(q),sourceId:source.id,...r};
  }
  if(a.action==='enqueue'){
   if(!Array.isArray(a.items)||a.items.length>25)throw Error('Enqueue up to 25 reviewed items');for(const i of a.items)if(i.reviewed!==true||!i.reason?.trim()||!q.observed.has(session+'\0'+i.pinId))throw Error('Actual visual review of observed candidates required');let added=0,duplicates=0,existing=0;
   for(const i of a.items){const seen=q.observed.get(session+'\0'+i.pinId);if(q.existingPinIds.has(seen.pinId)||(seen.signature&&q.existingSignatures.has(seen.signature))){existing++;continue;}if(q.items.some(x=>x.pinId===i.pinId||(seen.signature&&x.signature===seen.signature))){duplicates++;continue;}q.items.push({...seen,reason:i.reason,status:'pending'});added++;}pump(q);return {...snapshot(q),added,duplicates,existing};
  }
  if(a.action==='drain'){if(!q.boardUrl)throw Error('Bind destination first');if(a.auto!==undefined){q.auto=a.auto;if(q.auto)pump(q);else await q.worker;return snapshot(q);}await q.worker;return batch(q,Math.min(5,Math.max(1,a.limit||3)));}
  throw Error('Unknown queue action');
 }
 return {info(id){const q=queues.get(id);return q?{id:q.id,owner:q.owner,jobId:q.jobId,deadline:q.deadline,closed:!!q.closing}:null;},async execute(a,session){try{let result;if(['begin','resume'].includes(a.action)){const run=lifecycle.then(()=>invoke(a,session));lifecycle=run.catch(()=>{});result=await run;}else result=await invoke(a,session);return JSON.parse(JSON.stringify(result));}finally{const q=queues.get(a.queueId)||[...queues.values()].find(q=>q.jobId===a.jobId&&q.owner===session);if(q)await persist(q);}},async dispose(){for(const q of queues.values()){q.auto=false;q.closing=true;clearTimer(q.timer);}await Promise.all([...queues.values()].map(q=>q.worker));await writer;for(const q of queues.values())await(q.cleanup??=cleanup(q));await browserTail;disposed=true;}};
}
