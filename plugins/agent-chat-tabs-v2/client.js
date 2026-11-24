window.__ModuleLoader__.load({id:'@local/agent-chat-tabs-v2',factory(require){
  function deriveAgentTabs(state,sessionId,address){
    const byId=state.byId||{},projections=state.projectionsBySession||{},parents=new Map();
    for(const [parent,snapshot] of Object.entries(projections))for(const entry of snapshot.values?.subagentCatalog||[])if(entry.mode!=='external')parents.set(entry.id,{parentSessionId:parent,childSessionId:entry.id,mode:entry.mode,entry});
    for(const [id,s]of Object.entries(byId))if(!parents.has(id)&&s.origin==='subagent'&&s.parentId)parents.set(id,{parentSessionId:s.parentId,childSessionId:id});
    if(address)parents.set(sessionId,{...parents.get(sessionId),...address});
    let rootId=sessionId;const seen=new Set([rootId]);while(parents.has(rootId)){const p=parents.get(rootId).parentSessionId;if(seen.has(p))break;seen.add(p);rootId=p;}
    const rows=[],added=new Set();function add(id,depth,entry){if(added.has(id))return;added.add(id);const p=parents.get(id);rows.push({id,depth,target:p?.mode?{parentSessionId:p.parentSessionId,childSessionId:id,mode:p.mode}:id,label:projections[id]?.values?.title||byId[id]?.title||entry?.label||entry?.name||id,activity:entry?.activity||p?.entry?.activity,readOnly:p?.mode==='one-shot'||p?.mode==='unknown',userCreated:/^chat-[0-9a-f]{8}$/.test(entry?.name||p?.entry?.name||'')});for(const e of projections[id]?.values?.subagentCatalog||[])if(e.mode!=='external')add(e.id,depth+1,e);}
    add(rootId,0);for(const id of [...seen].reverse())if(!added.has(id))add(id,1,parents.get(id)?.entry);
    return {rootId,rootConfirmed:!!byId[rootId]&&byId[rootId].origin!=='subagent',rows};
  }
  const statusIconCss='@keyframes agent-chat-tabs-status-rotate{to{transform:rotate(360deg)}}.agent-chat-tabs-status-running{animation:agent-chat-tabs-status-rotate 1s linear infinite;transform-origin:center}@media(prefers-reduced-motion:reduce){.agent-chat-tabs-status-running{animation:none}}';
  function statusIcon(h,running,label){return h('span',{role:'img','aria-label':label,title:label,'data-agent-chat-status':running?'running':'idle',style:{display:'inline-flex',alignItems:'center',justifyContent:'center',width:16,height:16,flexShrink:0,color:running?'var(--dsw-alias-brand-primary)':'var(--dsw-alias-state-idle-primary)'}},h('svg',{width:14,height:14,viewBox:'0 0 16 16',fill:'none','aria-hidden':true,className:running?'agent-chat-tabs-status-running':undefined},h('circle',{cx:8,cy:8,r:5.5,stroke:'currentColor',strokeWidth:running?2:1.5,opacity:running?0.25:1}),running&&h('path',{d:'M8 2.5a5.5 5.5 0 0 1 5.5 5.5',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round'})));}
  function partitionAgentTabs(rows,confirmedIds=new Set()){const marked=rows.map(r=>confirmedIds.has(r.id)?{...r,userCreated:true}:r);return {primary:marked.filter((r,i)=>i===0||r.userCreated),tasks:marked.filter((r,i)=>i>0&&!r.userCreated)};}
  async function executeCreation(sessions,rootId,request,signal){return sessions.using(rootId,{source:'controllerOperation'},async reference=>{const binding=await reference.ready;const response=await binding.ctx.remote.commands.execute('/agent-chat-create '+JSON.stringify(request),[],signal);if(!response?.ok)throw Error(response?.error?.message||'Request failed');if(typeof response.value?.result?.text!=='string')throw Error('Creation command returned no receipt');let result;try{result=JSON.parse(response.value.result.text);}catch{throw Error('Invalid JSON receipt');}if(!['created','rejected','uncertain','needs-confirmation','cancelled'].includes(result?.status))throw Error('Unsupported receipt');return result;});}
  async function executeSettings(connection,rootId,request,signal){const response=await connection.rpc.call('/api','agent-chat-settings',{...request,parentSessionId:rootId},signal);if(!response?.ok)throw Error(response?.error?.message||'Settings failed');const result=response.value;if(!result||!(request.action==='list'?result.preferences:request.action==='models'?result.catalog:result.preference))throw Error('Invalid settings receipt');return result;}
  function createPreferenceCache(){const values=new Map(),tokens=new Map();return {get:root=>values.get(root),begin(root){const token={};tokens.set(root,token);return token;},commit(root,token,prefs){if(tokens.get(root)!==token)return false;values.set(root,prefs);return true;},save(root,id,value){tokens.delete(root);values.set(root,{...(values.get(root)||{}),[id]:value});}};}
  function selectedModel(catalog, selection) {
    const group = catalog?.groups?.find(group => group.id === selection?.provider);
    return group?.models.find(model => model.id === selection.model);
  }
  function modelLabels(catalog, selection, t) {
    const model = selectedModel(catalog, selection);
    const level = selection?.reasoningEffort ?? model?.reasoning?.defaultEffort;
    const effort = model?.reasoning?.efforts.find(item => item.id === level)?.name ?? level;
    return {model: model?.name || selection?.model || t('chooseModel'),
      effort: effort ?? (model?.reasoning || (!model && selection) ? t('providerDefaultEffort') : '')};
  }
  function matchesSelection(actual, requested) {
    return actual?.provider === requested.provider && actual?.model === requested.model &&
      (requested.reasoningEffort === undefined || (actual.reasoningEffort ?? null) === requested.reasoningEffort);
  }
  const DRAFT_QUERY='dsh:agent-chat-draft:query:v1',DRAFT_STATE='dsh:agent-chat-draft:state:v1';
  function publishDraftState(events,store,ownerId){let closed=false;const publish=(disposed=false)=>events.dispatchEvent(new CustomEvent(DRAFT_STATE,{detail:{version:1,ownerId,disposed,active:disposed?null:store.active}}));const query=()=>publish();events.addEventListener(DRAFT_QUERY,query);const unsubscribe=store.subscribe(query);publish();return()=>{if(closed)return;closed=true;events.removeEventListener(DRAFT_QUERY,query);unsubscribe();publish(true);};}
  const freshDraft=()=>({text:'',images:[],uploading:false,busy:false,request:null,result:null,error:null});
  function clearDraftPreviews(draft){for(const image of draft.images||[])if(image.preview){URL.revokeObjectURL(image.preview);image.preview=null;}}
  async function addDraftImages(fileUpload,draft,rootId,files,notify){
    if(draft.request||draft.busy||draft.uploading)return;
    const selected=Array.from(files);if(!selected.length)return;
    if(selected.some(f=>!['image/png','image/jpeg','image/webp','image/gif'].includes(f.type)))throw Error('Only PNG, JPEG, WebP and GIF images are supported');
    if(draft.images.length+selected.length>16)throw Error('At most 16 images per first message');
    draft.uploading=true;draft.error=null;draft.uploadController=new AbortController();notify();
    try{for(const file of selected){const result=await fileUpload.uploadImage(rootId,file,file.type,file.name,draft.uploadController.signal);draft.uploadController.signal.throwIfAborted();if(!result?.ok)throw Error(result?.error?.message||'Image upload failed');if(!result.value?.receiptId||!result.value?.image)throw Error('Invalid image upload receipt');draft.images.push({receiptId:result.value.receiptId,name:result.value.image.name||file.name||'image',preview:URL.createObjectURL(file)});notify();}}
    finally{draft.uploading=false;draft.uploadController=null;notify();}
  }
  function positionFloatingSettings(element,anchor,host){
    const rect=anchor.getBoundingClientRect(),above=rect.top>=96,width=Math.min(640,Math.max(280,rect.width),host.innerWidth-16);
    element.style.width=width+'px';element.style.maxHeight=Math.max(48,Math.min(420,above?rect.top-16:host.innerHeight-rect.bottom-16))+'px';
    const box=element.getBoundingClientRect();element.style.left=Math.max(8,Math.min(rect.left,host.innerWidth-width-8))+'px';
    element.style.top=Math.max(8,Math.min(above?rect.top-box.height-8:rect.bottom+8,host.innerHeight-box.height-8))+'px';
  }
  function mountFloatingSettings(element,anchor,close,host){
    const topLayer=typeof element.showPopover==='function';if(topLayer){element.showPopover();positionFloatingSettings(element,anchor,host);}else{element.style.position='absolute';element.style.inset='auto';element.style.bottom='100%';element.style.left='0';element.style.maxHeight='min(420px, 60vh)';}
    element.querySelector('input')?.focus({preventScroll:true});
    const outside=e=>{if(!element.contains(e.target))close();},key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}},reposition=e=>{if(topLayer&&!element.contains(e?.target))positionFloatingSettings(element,anchor,host);};
    host.addEventListener('pointerdown',outside,true);host.addEventListener('keydown',key,true);host.addEventListener('resize',reposition);host.addEventListener('scroll',reposition,true);
    return()=>{host.removeEventListener('pointerdown',outside,true);host.removeEventListener('keydown',key,true);host.removeEventListener('resize',reposition);host.removeEventListener('scroll',reposition,true);if(topLayer&&element.matches(':popover-open'))element.hidePopover();};
  }
  function mountContextMenu(element,menu,close,host){
    if(typeof element.showPopover==='function'){
      element.showPopover();const box=element.getBoundingClientRect();
      element.style.left=Math.max(8,Math.min(menu.x,host.innerWidth-box.width-8))+'px';
      element.style.top=Math.max(8,Math.min(menu.y,host.innerHeight-box.height-8))+'px';
    }else{element.style.position='absolute';element.style.left='0px';element.style.top='100%';}
    element.querySelector('button')?.focus();
    const outside=e=>{if(!element.contains(e.target))close();},key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();menu.anchor?.focus();}};
    const dismiss=()=>close();host.addEventListener('pointerdown',outside,true);host.addEventListener('keydown',key,true);host.addEventListener('resize',dismiss);host.addEventListener('scroll',dismiss,true);
    return()=>{host.removeEventListener('pointerdown',outside,true);host.removeEventListener('keydown',key,true);host.removeEventListener('resize',dismiss);host.removeEventListener('scroll',dismiss,true);if(typeof element.hidePopover==='function'&&element.matches(':popover-open'))element.hidePopover();};
  }
  function wheelTarget(e,left,width,total){if(e.ctrlKey||e.metaKey||total<=width)return null;const delta=Math.abs(e.deltaX)>=Math.abs(e.deltaY)?e.deltaX:e.deltaY;const unit=e.deltaMode===1?32:e.deltaMode===2?width:1;const next=Math.max(0,Math.min(total-width,left+delta*unit));return next===left?null:next;}
  function handleSurfaceWheel(e,nav){if(e.target?.closest?.('[data-agent-settings-floating]'))return;if(e.ctrlKey||e.metaKey)return;e.stopPropagation();const field=e.target?.closest?.('textarea');if(field&&(e.deltaY<0?field.scrollTop>0:e.deltaY>0&&field.scrollTop+field.clientHeight<field.scrollHeight))return;if(e.cancelable)e.preventDefault();if(e.target?.closest?.('textarea,input,select'))return;const next=wheelTarget(e,nav.scrollLeft,nav.clientWidth,nav.scrollWidth);if(next!==null)nav.scrollLeft=next;}
  function createDraftStore(){const drafts=new Map(),listeners=new Set();let active=null,revision=0;const emit=()=>{revision++;for(const fn of listeners)fn();};return {drafts,get active(){return active;},getSnapshot:()=>revision,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},open(rootId,anchorId){let d=drafts.get(rootId);if(!d||d.result?.status==='created'){d=freshDraft();drafts.set(rootId,d);}active={rootId,anchorId};emit();return d;},leave(){active=null;emit();},close(rootId){const d=drafts.get(rootId);if(d?.busy||d?.uploading)return false;if(d)clearDraftPreviews(d);drafts.delete(rootId);if(active?.rootId===rootId)active=null;emit();return true;},update(d,patch){Object.assign(d,patch);emit();},emit};}
  function pendingTarget(draft,rootId){return draft?.result?.status==='created'?{parentSessionId:rootId,childSessionId:draft.result.childId,mode:'continuable'}:null;}
  function quickSubmission(draft,rootId,newId){if(draft.request)return {...draft.request,queryOnly:true};if(draft.uploading)throw Error('Wait for image upload');if(!draft.text.trim()&&!draft.images.length)throw Error('Empty first message');if(new TextEncoder().encode(draft.text).length>8192)throw Error('First message exceeds 8 KiB');draft.request={parentSessionId:rootId,requestId:newId,quickContext:true,text:draft.text,...(draft.images.length?{imageReceipts:draft.images.map(image=>image.receiptId)}:{})};return {...draft.request,queryOnly:false};}
  return {createPreferenceCache,positionFloatingSettings,mountFloatingSettings,mountContextMenu,executeSettings,publishDraftState,deriveAgentTabs,statusIcon,statusIconCss,partitionAgentTabs,executeCreation,freshDraft,wheelTarget,handleSurfaceWheel,createDraftStore,quickSubmission,pendingTarget,addDraftImages,clearDraftPreviews,inject:['slots','sessions','uiWorkspace','locale','fileUpload','connection'],apply(ctx){
    const React=require('react'),h=React.createElement,store=createDraftStore(),preferenceCache=createPreferenceCache(),confirmed=new Set(),NS='local-agent-chat-tabs-v2';
    const zh={title:'代理对话',main:'主对话',tasks:'任务代理',taskListHint:'任务列表（任务由当前对话通过 subagent 派发，受原生深度和权限限制）',refresh:'刷新',add:'新建聊天（不调用模型）',pending:'新聊天（未发送）',send:'发送',retry:'查询同一请求',sending:'正在发送…',close:'关闭草稿',back:'返回主对话',hint:'仅携带主对话最近已完成消息，不是完整历史；更早内容按需查询。',placeholder:'给新聊天发送消息…',uncertain:'发送结果未确认；请查询同一请求，不要重复发送。',running:'进行中',idle:'未运行',missing:'尚未确认主对话，请返回主对话后重试。',open:'打开已创建聊天',attach:'添加图片',remove:'移除',uploading:'正在上传图片…',textOnly:'首次支持文本＋图片（可粘贴或拖入）；文本最多8 KiB，图片最多16张，大小按原生限制。',failed:'请求失败',settings:'代理设置',displayName:'显示名称',independentModel:'独立模型',keepModel:'保持当前模型',settingsHint:'只修改此子代理；当前请求不被打断，新模型从下一次模型请求或休眠恢复时生效。显示名称不更改内部通信名称。',saving:'保存中…',save:'保存',cancel:'取消',editSettings:'修改名称与模型'};
    const en={title:'Agent chats',main:'Main chat',tasks:'Task agents',taskListHint:'Task list (dispatch via subagent from the current chat, within native depth and permissions)',refresh:'Refresh',add:'New chat (no model call)',pending:'New chat (unsent)',send:'Send',retry:'Check same request',sending:'Sending…',close:'Close draft',back:'Back to main chat',hint:'Only recent completed messages are carried, not full history; older context can be queried.',placeholder:'Message the new chat…',uncertain:'Send is unconfirmed. Check the same request; do not resend.',running:'Running',idle:'Not running',missing:'Main chat is not confirmed. Return to it and retry.',open:'Open created chat',attach:'Add images',remove:'Remove',uploading:'Uploading images…',textOnly:'Text + images (paste or drop); text up to 8 KiB, up to 16 images, native size limits apply.',failed:'Request failed',settings:'Agent settings',displayName:'Display name',independentModel:'Independent model',keepModel:'Keep current model',settingsHint:'This child only. Current requests are not interrupted; the model applies to the next model request or cold activation. Display names do not change internal agent names.',saving:'Saving…',save:'Save',cancel:'Cancel',editSettings:'Change name and model'};
    Object.assign(zh,{childModel:'子对话模型',model:'模型',childEffort:'推理等级',providerDefaultEffort:'默认',chooseModel:'选择模型',searchModels:'搜索模型',noModels:'没有匹配的模型',retryLoad:'重试',modelLoading:'正在读取模型设置…',oldHost:'更新 Host 后可切换推理等级',unconfirmed:'保存回执与所选模型或推理等级不一致，请重新选择。',goBack:'返回',missingChild:'未能读取此子对话的设置',editSettings:'修改名称、模型与推理等级'});
    Object.assign(en,{childModel:'Child model',model:'Model',childEffort:'Reasoning effort',providerDefaultEffort:'Default',chooseModel:'Select model',searchModels:'Search models',noModels:'No matching models',retryLoad:'Retry',modelLoading:'Loading model settings…',oldHost:'Update the host to change reasoning effort',unconfirmed:'The saved model or effort differs from your selection. Select it again.',goBack:'Back',missingChild:'Could not read settings for this child',editSettings:'Change name, model and reasoning effort'});
    ctx.effect(()=>ctx.locale.register(NS,{zh,en}));
    ctx.effect(()=>publishDraftState(window,store,window.crypto.randomUUID()));
    const uiCss=`.act-tab:hover{background:var(--dsw-alias-bg-layer-2)!important}.act-tab:focus-visible,.act-settings :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.act-tab[aria-current=page]{background:var(--dsw-alias-bg-layer-2)!important;color:var(--dsw-alias-label-primary)!important}.act-settings{box-sizing:border-box;width:100%;margin:12px 0 4px;padding:18px 20px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:14px}.act-settings form{display:grid;gap:16px}.act-settings h3{margin:0;font-size:15px;font-weight:600}.act-settings label{display:grid;gap:8px;font-size:13px}.act-settings input,.act-settings select{font:inherit;font-size:14px;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:inherit;height:38px;padding:0 10px}.act-settings small{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.6}.act-settings button{border:0;border-radius:8px;padding:8px 16px;font:inherit;font-size:13px;cursor:pointer;color:inherit;background:var(--dsw-alias-bg-layer-2)}.act-settings button[type=submit]{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}.act-settings button:disabled{opacity:.5;cursor:default}.act-floating{position:fixed;inset:auto;margin:0;width:min(640px,100%);max-height:420px;overflow:auto;overscroll-behavior:contain;padding:16px 18px;box-shadow:0 8px 32px #0005;color:var(--dsw-alias-label-primary)}.act-floating form{gap:12px}.act-floating input,.act-floating select{height:34px}.act-menu{position:fixed;inset:auto;margin:0;min-width:180px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 6px 24px #0004;font-size:13px}.act-menu button{display:block;width:100%;padding:8px 10px;border:0;border-radius:5px;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}.act-menu button:hover,.act-menu button:focus-visible{background:var(--dsw-alias-bg-layer-2);outline:none}`;
    const button={display:'inline-flex',alignItems:'center',gap:5,flexShrink:0,border:'1px solid transparent',borderRadius:6,padding:'4px 8px',font:'inherit',cursor:'pointer',background:'transparent',color:'var(--dsw-alias-label-secondary)',minHeight:28};
    const surface={width:'min(calc(100% - 32px), var(--dsh-chat-content-width, 920px))',boxSizing:'border-box',minWidth:0,margin:'0 auto 6px',padding:'4px 0',position:'relative',background:'var(--dsw-alias-bg-base)',border:'0',borderRadius:0,color:'var(--dsw-alias-label-secondary)',fontSize:12};
    let takeoverDispose;
    function clearTakeover(){takeoverDispose?.();takeoverDispose=undefined;}
    function leave(){clearTakeover();store.leave();}
    function openReal(target){leave();ctx.uiWorkspace.openSession(target);}
    function openPending(rootId,anchorId){clearTakeover();store.open(rootId,anchorId);takeoverDispose=ctx.slots.inject('conversation.composer',()=>ctx.slots.register({name:'conversation.composer',priority:100,locale:NS,select:owner=>owner.sessionId===anchorId&&store.active?.rootId===rootId?{rootId,anchorId}:null},QuickComposer));}
    ctx.effect(()=>()=>{clearTakeover();for(const draft of store.drafts.values()){draft.uploadController?.abort();clearDraftPreviews(draft);}store.leave();});
    function useRevision(){React.useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);}
    function ContextMenu({menu,onClose,onEdit,t}){const ref=React.useRef(null);React.useLayoutEffect(()=>mountContextMenu(ref.current,menu,onClose,window),[menu]);return h('div',{ref,popover:'manual',className:'act-menu',role:'menu','aria-label':t('settings')},h('button',{type:'button',role:'menuitem',onClick:()=>onEdit(menu.row)},t('editSettings')));}
    const preferenceReads=new Map();
    function refreshPreferences(rootId) {
      if(preferenceReads.has(rootId))return preferenceReads.get(rootId);
      const token=preferenceCache.begin(rootId);
      const reading=executeSettings(ctx.connection,rootId,{action:'list'},new AbortController().signal).then(result=>{
        if(preferenceCache.commit(rootId,token,result.preferences))store.emit();
      }).finally(()=>{if(preferenceReads.get(rootId)===reading)preferenceReads.delete(rootId);});
      preferenceReads.set(rootId,reading);
      return reading;
    }
    async function savePreferences(rootId,id,revision,changes,t) {
      const result=await executeSettings(ctx.connection,rootId,{action:'save',childSessionId:id,revision,...changes});
      const value=result.preference;
      // Publish the receipt for its original child even if navigation unmounted the submitting control.
      preferenceCache.save(rootId,id,value);store.emit();
      if(changes.modelSelection && !matchesSelection(value.modelSelection,changes.modelSelection)) throw Error(t('unconfirmed'));
      return result;
    }
    function useCatalog(rootId) {
      const [directory,setDirectory]=React.useState(null),[error,setError]=React.useState('');
      const [attempt,setAttempt]=React.useState(0);
      React.useEffect(()=>{
        if(!rootId)return;
        const controller=new AbortController();
        setError('');
        executeSettings(ctx.connection,rootId,{action:'models'},controller.signal).then(result=>{
          if(!controller.signal.aborted)setDirectory(result);
        }).catch(e=>{if(!controller.signal.aborted)setError(String(e.message||e));});
        return ()=>controller.abort();
      },[rootId,attempt]);
      return {directory,error,reload:()=>setAttempt(value=>value+1)};
    }
    function SettingsPanel({row,rootId,prefs,projection,onSaved,onClose,t,anchorRef}){
      const [title,setTitle]=React.useState(prefs?.title||row.label),[choice,setChoice]=React.useState(null);
      const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(null);
      const {directory,error:catalogError,reload}=useCatalog(rootId);
      const mounted=React.useRef(true),panelRef=React.useRef(null),stateRef=React.useRef(null),saving=React.useRef(false);
      stateRef.current={busy,onClose};
      React.useLayoutEffect(()=>mountFloatingSettings(panelRef.current,anchorRef.current,()=>{if(!stateRef.current.busy)stateRef.current.onClose();},window),[rootId,row.id]);
      React.useLayoutEffect(()=>{if(typeof panelRef.current?.showPopover==='function'&&anchorRef.current)positionFloatingSettings(panelRef.current,anchorRef.current,window);});
      React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
      React.useEffect(()=>{setChoice(null);setTitle(prefs?.title||row.label);},[prefs?.revision,row.id]);
      const current=prefs?.modelSelection??projection;
      const active=choice??current, catalog=directory?.catalog, model=selectedModel(catalog,active);
      const encoded=active?JSON.stringify({provider:active.provider,model:active.model}):'';
      const effortValue=active?.reasoningEffort??'';
      const options=model?.reasoning?.efforts||[];
      const save=async event=>{
        event.preventDefault();if(saving.current)return;
        saving.current=true;setBusy(true);setError(null);
        try {
          const changes={title,...(choice?{modelSelection:choice}:{})};
          const result=await savePreferences(rootId,row.id,prefs.revision,changes,t);
          if(mounted.current)onSaved(result.warning);
        } catch(e){
          if(mounted.current)setError(String(e.message||e));
          refreshPreferences(rootId).catch(()=>{});
        } finally{saving.current=false;if(mounted.current)setBusy(false);}
      };
      return h('section',{ref:panelRef,popover:'manual',className:'act-settings act-floating','data-agent-settings-floating':true,role:'dialog','aria-modal':false,'aria-label':t('settings')},
        h('form',{onSubmit:save},h('h3',null,t('settings')),
          h('label',null,t('displayName'),h('input',{value:title,maxLength:100,disabled:busy,onChange:e=>setTitle(e.target.value)})),
          h('label',null,t('independentModel'),h('select',{value:encoded,disabled:busy||!catalog,onChange:e=>{
            const route=JSON.parse(e.target.value);
            setChoice(current?.provider===route.provider&&current?.model===route.model?null:route);
          }},!model&&h('option',{value:encoded,disabled:true},active?.model||t('keepModel')),
          ...(catalog?.groups||[]).map(g=>h('optgroup',{key:g.id,label:g.name||g.id},g.models.map(m=>h('option',{key:m.id,value:JSON.stringify({provider:g.id,model:m.id})},m.name||m.id)))) )),
          options.length>0&&h('label',null,t('childEffort'),h('select',{value:effortValue,disabled:busy||!directory.supportsReasoningEffort,onChange:e=>setChoice({provider:active.provider,model:active.model,reasoningEffort:e.target.value||null})},
            h('option',{value:''},[t('providerDefaultEffort'),options.find(level=>level.id===model.reasoning.defaultEffort)?.name].filter(Boolean).join(' · ')),
            effortValue&&!options.some(level=>level.id===effortValue)&&h('option',{value:effortValue,disabled:true},effortValue),
            options.map(level=>h('option',{key:level.id,value:level.id},level.name||level.id)))),
          options.length>0&&!directory.supportsReasoningEffort&&h('small',null,t('oldHost')),
          catalogError&&h('p',{role:'alert'},catalogError,' ',h('button',{type:'button',onClick:reload},t('retryLoad'))),
          h('small',null,t('settingsHint')),error&&h('p',{role:'alert'},error),
          h('div',{style:{display:'flex',justifyContent:'flex-end',gap:8}},
            h('button',{type:'button',disabled:busy,onClick:onClose},t('cancel')),
            h('button',{type:'submit',disabled:busy||!title.trim()},busy?t('saving'):t('save')))));
    }
    function Tabs(props){useRevision();const address=props.useSession(s=>s.subagent?.address),byId=props.useSessions(s=>s.byId),projectionsBySession=props.useSessions(s=>s.projectionsBySession),statuses=props.useSessionStatus(s=>s),currentRunning=props.useSession(s=>s.running);const {rootId,rootConfirmed,rows}=deriveAgentTabs({byId,projectionsBySession},props.sessionId,address),{primary,tasks}=partitionAgentTabs(rows,confirmed);const [expanded,setExpanded]=React.useState(false),[error,setError]=React.useState(null),[editing,setEditing]=React.useState(null),[menu,setMenu]=React.useState(null),[reload,setReload]=React.useState(0);const preferences=preferenceCache.get(rootId);React.useEffect(()=>{const controller=new AbortController();setEditing(null);setMenu(null);setError(null);if(rootConfirmed){refreshPreferences(rootId).catch(e=>{if(!controller.signal.aborted)setError(String(e.message||e));});}return()=>controller.abort();},[rootId,rootConfirmed,reload]);const navRef=React.useRef(null),surfaceRef=React.useRef(null);React.useEffect(()=>{const element=surfaceRef.current;const listener=e=>handleSurfaceWheel(e,e.target?.closest?.('[data-agent-tabs-scroll]')||navRef.current);element.addEventListener('wheel',listener,{passive:false});return()=>element.removeEventListener('wheel',listener);},[]);
      const pending=store.drafts.get(rootId),selected=store.active?.rootId===rootId&&store.active.anchorId===props.sessionId;
      const tab=r=>{const running=(r.id===props.sessionId?currentRunning:undefined)??statuses.get(r.id)?.running??(r.activity?r.activity==='running':byId[r.id]?.running),stateLabel=props.t(running?'running':'idle'),label=r.id===rootId?props.t('main'):(preferences?(preferences[r.id]?.title||r.label):'…');const canEdit=!!preferences&&r.id!==rootId&&r.target?.mode==='continuable'&&rootConfirmed&&!selected;const openMenu=e=>{if(!canEdit)return;e.preventDefault();e.stopPropagation();const anchor=e.currentTarget,rect=anchor.getBoundingClientRect();const keyboard=e.type==='keydown';setMenu({row:r,anchor,x:keyboard?rect.left:e.clientX,y:keyboard?rect.bottom:e.clientY});};return h('span',{key:r.id,style:{display:'inline-flex',flexShrink:0,gap:2}},h('button',{type:'button',className:'act-tab',onContextMenu:openMenu,onKeyDown:e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')openMenu(e);},title:label+' · '+stateLabel+' · '+r.id,'aria-label':label+' · '+stateLabel,'aria-current':!selected&&props.sessionId===r.id?'page':undefined,onClick:()=>openReal(r.target),style:{...button,borderColor:!selected&&props.sessionId===r.id?'var(--dsw-alias-brand-primary)':'var(--dsw-alias-border-l1)'}},statusIcon(h,!!running,stateLabel),h('span',{style:{maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},label)));};
      return h('section',{ref:surfaceRef,style:surface,'aria-label':props.t('title')},h('style',null,statusIconCss+uiCss),h('div',{style:{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}},h('span',null,props.t('title')),h('nav',{ref:navRef,'data-agent-tabs-scroll':true,'aria-label':props.t('title'),style:{display:'flex',flex:'1 1 180px',gap:6,overflowX:'auto',minWidth:0}},primary.map(tab),pending&&h('button',{type:'button',onClick:()=>pendingTarget(pending,rootId)?openReal(pendingTarget(pending,rootId)):openPending(rootId,props.sessionId),'aria-current':selected?'page':undefined,style:{...button,borderColor:selected?'var(--dsw-alias-brand-primary)':'var(--dsw-alias-border-l1)'}},props.t(pending.result?.status==='created'?'open':'pending'))),tasks.length>0&&h('button',{type:'button',title:props.t('taskListHint'),'aria-expanded':expanded,onClick:()=>setExpanded(!expanded),style:button},props.t('tasks')+' '+tasks.length),h('button',{type:'button',disabled:!rootConfirmed,title:props.t('add'),'aria-label':props.t('add'),onClick:()=>openPending(rootId,props.sessionId),style:button},'+'),h('button',{type:'button',onClick:()=>{setReload(v=>v+1);ctx.sessions.refreshProjections(rootId).catch(e=>setError(String(e.message||e)));},style:button},props.t('refresh'))),expanded&&h('nav',{'data-agent-tabs-scroll':true,'aria-label':props.t('tasks'),style:{display:'flex',gap:6,overflowX:'auto',marginTop:6}},tasks.map(tab)),menu&&h(ContextMenu,{menu,t:props.t,onClose:()=>setMenu(null),onEdit:r=>{setMenu(null);setEditing(r);}}),editing&&h(SettingsPanel,{key:rootId+':'+editing.id,row:editing,rootId,anchorRef:surfaceRef,t:props.t,prefs:preferences[editing.id],projection:projectionsBySession[editing.id]?.values?.modelSelection?.next,onClose:()=>setEditing(null),onSaved:warning=>{setEditing(null);setError(warning||null);}}),error&&h('p',{role:'alert'},error));
    }
    function QuickComposer(props){useRevision();const {rootId,anchorId}=props.matched;const draft=store.drafts.get(rootId);const mounted=React.useRef(true);React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);const inputRef=React.useRef(null);if(!draft)return null;
      const locked=!!draft.request||draft.busy||draft.uploading;
      const addImages=files=>{void addDraftImages(ctx.fileUpload,draft,rootId,files,store.emit).catch(error=>store.update(draft,{error:String(error.message||error)}));};
      const navigate=childId=>openReal({parentSessionId:rootId,childSessionId:childId,mode:'continuable'});
      const send=async e=>{e.preventDefault();if(draft.busy||draft.uploading)return;let request;try{request=quickSubmission(draft,rootId,window.crypto.randomUUID());}catch(error){store.update(draft,{error:String(error.message||error)});return;}store.update(draft,{busy:true,error:null});try{const result=await executeCreation(ctx.sessions,rootId,request,new AbortController().signal);draft.result=result;if(result.status==='created'){clearDraftPreviews(draft);confirmed.add(result.childId);if(mounted.current&&store.active?.rootId===rootId&&store.active.anchorId===anchorId)navigate(result.childId);}else draft.error=(result.status==='rejected'?props.t('failed'):props.t('uncertain'))+(result.error?': '+result.error:'');}catch(error){draft.error=props.t('uncertain')+': '+String(error.message||error).slice(0,600);}finally{store.update(draft,{busy:false});}};
      return h('div',null,h(Tabs,props),h('section',{style:{...surface,padding:12},'aria-label':props.t('pending')},h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},h('strong',null,props.t('pending')),h('div',null,h('button',{type:'button',style:button,onClick:()=>openReal(rootId)},props.t('back')),h('button',{type:'button',style:button,disabled:draft.busy||draft.uploading,onClick:()=>{if(store.close(rootId))clearTakeover();}},props.t('close')))),h('small',null,props.t('hint')),h('form',{onSubmit:send,onDragOver:e=>{if(!locked)e.preventDefault();},onDrop:e=>{e.preventDefault();if(!locked)addImages(e.dataTransfer.files);}},h('input',{ref:inputRef,type:'file',accept:'image/png,image/jpeg,image/webp,image/gif',multiple:true,disabled:locked,style:{display:'none'},onChange:e=>{addImages(e.target.files);e.target.value='';}}),h('button',{type:'button',style:button,disabled:locked,onClick:()=>inputRef.current?.click()},props.t('attach')),draft.uploading&&h('span',{role:'status'},props.t('uploading')),h('div',{style:{display:'flex',gap:8,flexWrap:'wrap',marginTop:6}},draft.images.map((image,index)=>h('div',{key:image.receiptId,style:{maxWidth:140}},image.preview&&h('img',{src:image.preview,alt:image.name,style:{width:96,height:72,objectFit:'contain'}}),h('div',null,image.name),h('button',{type:'button',style:button,disabled:locked,'aria-label':props.t('remove')+' '+image.name,onClick:()=>{if(image.preview)URL.revokeObjectURL(image.preview);draft.images.splice(index,1);store.emit();}},props.t('remove'))))),h('textarea',{'aria-label':props.t('pending'),placeholder:props.t('placeholder'),value:draft.text,disabled:!!draft.request||draft.busy,onPaste:e=>{const files=Array.from(e.clipboardData?.files||[]).filter(f=>f.type.startsWith('image/'));if(files.length){e.preventDefault();if(!locked)addImages(files);}},rows:4,maxLength:8192,onChange:e=>store.update(draft,{text:e.target.value}),onKeyDown:e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!draft.busy)void send(e);}},style:{boxSizing:'border-box',width:'100%',margin:'8px 0',padding:10,resize:'vertical',overscrollBehavior:'contain',border:'1px solid var(--dsw-alias-border-l1)',borderRadius:8,color:'var(--dsw-alias-label-primary)',background:'var(--dsw-alias-bg-base)',font:'inherit'}}),h('small',null,props.t('textOnly')),draft.error&&h('p',{role:'alert',style:{color:'var(--dsw-alias-state-warn-primary)'}},draft.error),draft.result?.status==='created'?h('button',{type:'button',style:button,onClick:()=>navigate(draft.result.childId)},props.t('open')):h('button',{type:'submit',disabled:draft.busy||draft.uploading||(!draft.request&&!draft.text.trim()&&!draft.images.length),style:button},props.t(draft.busy?'sending':draft.request?'retry':'send')))));
    }
    const pickerCss=`
      .act-model{display:inline-flex;align-items:center;min-width:0;position:relative}
      .act-model-trigger,.act-model-menu button{border:0;background:transparent;font:inherit;cursor:pointer;color:inherit}
      .act-model-trigger{display:flex;align-items:center;gap:4px;min-width:0;max-width:min(360px,44vw);height:28px;padding:0 4px 0 8px;border-radius:6px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
      .act-model-trigger:hover,.act-model-menu button:hover,.act-model-menu button:focus-visible,.act-model-menu button[data-highlighted]{background:var(--dsw-alias-interactive-bg-hover)}
      .act-model-trigger:focus-visible,.act-model-menu :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
      .act-model-trigger span,.act-model-value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .act-model-trigger .act-model-effort,.act-model-value{color:var(--dsw-alias-label-caption)}
      .act-model-trigger .act-model-effort{flex-shrink:1000}
      .act-model-menu{position:fixed;inset:auto;margin:0;box-sizing:border-box;min-width:min(240px,calc(100vw - 24px));width:max-content;max-width:min(420px,calc(100vw - 24px));overflow:auto;overscroll-behavior:contain;padding:4px;z-index:1100;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 4px 20px #0003;font-size:13px;line-height:20px}
      .act-model-menu button{display:flex;align-items:center;gap:8px;width:100%;min-height:32px;border-radius:6px;text-align:start;padding:5px 8px}
      .act-model-menu button:disabled,.act-model-trigger:disabled{cursor:default;color:var(--dsw-alias-label-dimmed)}
      .act-model-menu button span:first-child{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .act-model-menu .act-model-group{padding:4px 8px;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600;position:sticky;top:0;background:var(--dsw-alias-bg-layer-1)}
      .act-model-menu input{box-sizing:border-box;width:100%;font:inherit;padding:5px 8px;margin:2px 0;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:inherit;background:var(--dsw-alias-bg-base)}
      .act-model-note{padding:4px 8px;color:var(--dsw-alias-label-secondary);font-size:12px;overflow-wrap:anywhere}
      .act-model svg{flex:none}
    `;
    function chevron(right=false){return h('svg',{width:12,height:12,viewBox:'0 0 12 12',fill:'none','aria-hidden':true},h('path',{d:right?'m4.5 2.5 3.5 3.5-3.5 3.5':'m2.5 4.5 3.5 3.5 3.5-3.5',stroke:'currentColor',strokeWidth:1.4,strokeLinecap:'round',strokeLinejoin:'round'}));}
    function ChildModelIndicator(props){
      const address=props.useSession(session=>session.subagent?.address);
      const projection=props.useProjection('modelSelection',value=>value?.next);
      if(!address||address.childSessionId!==props.sessionId)return null;
      if(address.mode!=='continuable')return projection?h('span',{title:`${projection.provider}/${projection.model}`},[projection.model,projection.reasoningEffort].filter(Boolean).join(' · ')):null;
      return h(ChildModelSeat,{...props,key:props.sessionId,address,projection});
    }
    function ChildModelSeat({sessionId,address,projection,useSessions,t}){
      const byId=useSessions(s=>s.byId),projectionsBySession=useSessions(s=>s.projectionsBySession);
      const {rootId,rootConfirmed}=deriveAgentTabs({byId,projectionsBySession},sessionId,address);
      return h(ChildModelControl,{key:rootId+':'+sessionId,rootId:rootConfirmed?rootId:null,sessionId,projection,t});
    }
    function ChildModelControl({rootId,sessionId,projection,t}){
      useRevision();
      const prefs=preferenceCache.get(rootId)?.[sessionId];
      const {directory,error:catalogError,reload}=useCatalog(rootId);
      const catalog=directory?.catalog;
      // Wait for the saved route on a cold mount before showing a possibly stale request projection.
      const preferencesKnown=preferenceCache.get(rootId)!==undefined;
      const current=prefs?.modelSelection??(preferencesKnown||!rootId?projection:null);
      const labels=modelLabels(catalog,current,t),reasoning=selectedModel(catalog,current)?.reasoning;
      const [pane,setPane]=React.useState(null),[query,setQuery]=React.useState(''),[index,setIndex]=React.useState(null);
      const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[readError,setReadError]=React.useState('');
      const trigger=React.useRef(null),menu=React.useRef(null),mounted=React.useRef(false),saving=React.useRef(false),returnRow=React.useRef(null);
      const menuId=React.useId();
      function read(){
        if(!rootId)return;
        setReadError('');
        refreshPreferences(rootId).catch(e=>{if(mounted.current)setReadError(String(e.message||e));});
      }
      React.useEffect(()=>{mounted.current=true;read();return()=>{mounted.current=false;};},[rootId]);
      const close=(focus=false)=>{setPane(null);if(focus)trigger.current?.focus({preventScroll:true});};
      const drill=next=>{setQuery('');setIndex(null);setPane(next);};
      const back=()=>{if(pane==='root')close(true);else{returnRow.current=pane;drill('root');}};
      const open=()=>{if(pane){close(true);return;}setError('');read();reload();drill(current?'root':'model');};
      const groups=catalog?.groups||[];
      const search=groups.reduce((count,g)=>count+g.models.length,0)>4;
      const needle=query.trim().toLowerCase();
      const visible=groups.map(group=>({...group,models:group.models.filter(model=>(model.name||model.id).toLowerCase().includes(needle)||model.id.toLowerCase().includes(needle))})).filter(group=>group.models.length);
      const routes=visible.flatMap(g=>g.models.map(m=>({provider:g.id,model:m.id})));
      const selectedIndex=routes.findIndex(route=>route.provider===current?.provider&&route.model===current?.model);
      const activeIndex=Math.min(index??Math.max(0,selectedIndex),routes.length-1);
      const defaultLevel=reasoning?.efforts.find(item=>item.id===reasoning.defaultEffort);
      const ready=!!prefs&&!!catalog&&!busy;
      async function choose(route){
        if(!ready||saving.current)return;
        if(matchesSelection(current,route)){close(true);return;}
        saving.current=true;setBusy(true);setError('');
        try{
          const result=await savePreferences(rootId,sessionId,prefs.revision,{modelSelection:route},t);
          if(mounted.current){close(true);setError(result.warning||'');}
        }catch(e){if(mounted.current){setError(String(e.message||e));read();}}
        finally{saving.current=false;if(mounted.current)setBusy(false);}
      }
      // A top-layer popover stays above the clipped composer; all listeners belong to this open menu.
      const isOpen=pane!==null;
      React.useLayoutEffect(()=>{
        if(!isOpen)return;
        const element=menu.current,anchor=trigger.current;
        element.showPopover?.();
        const place=()=>{
          const rect=anchor.getBoundingClientRect();
          if(!rect.width){close();return;}
          const above=rect.top>=120||rect.top>window.innerHeight-rect.bottom;
          element.style.maxHeight=Math.max(40,Math.min(360,above?rect.top-18:window.innerHeight-rect.bottom-18))+'px';
          element.style.left=Math.max(8,Math.min(rect.right-element.offsetWidth,window.innerWidth-8-element.offsetWidth))+'px';
          element.style.top=(above?Math.max(8,rect.top-8-element.offsetHeight):rect.bottom+8)+'px';
        };
        const outside=e=>{if(!element.contains(e.target)&&!anchor.contains(e.target))close();};
        const observer=new ResizeObserver(place);observer.observe(element);observer.observe(anchor);place();
        window.addEventListener('pointerdown',outside,true);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
        return()=>{observer.disconnect();window.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);if(element.matches(':popover-open'))element.hidePopover();};
      },[isOpen]);
      React.useLayoutEffect(()=>{
        if(!pane)return;
        const target=returnRow.current?menu.current.querySelector(`[data-pane="${returnRow.current}"]`):null;
        returnRow.current=null;
        (target??menu.current.querySelector('input,[aria-checked="true"]:not(:disabled)')??menu.current.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});
      },[pane,search]);
      React.useEffect(()=>{if(pane==='model'&&search)menu.current?.querySelector('[data-highlighted]')?.scrollIntoView({block:'nearest'});},[activeIndex,pane,query]);
      function keys(e){
        if(e.nativeEvent.isComposing)return;
        const stop=()=>{e.preventDefault();e.stopPropagation();};
        if(!pane){if(e.key==='ArrowDown'){stop();open();}return;}
        if(e.key==='Escape'||e.key==='ArrowLeft'&&e.target.tagName!=='INPUT'||e.key==='Tab'&&e.shiftKey){stop();back();return;}
        const field=e.target.tagName==='INPUT';
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){
          stop();const offset=e.key==='ArrowDown'?1:-1;
          if(field){if(routes.length)setIndex((activeIndex+offset+routes.length)%routes.length);return;}
          const rows=Array.from(menu.current.querySelectorAll('button:not(:disabled)'));
          const at=rows.indexOf(e.target);if(rows.length)rows[(at+offset+rows.length)%rows.length].focus();return;
        }
        if(field&&(e.key==='Enter'||e.key==='Tab')){stop();if(routes[activeIndex])choose(routes[activeIndex]);return;}
        if(e.key==='Tab'||e.key==='ArrowRight'&&e.target.dataset.pane){stop();if(e.target===trigger.current)menu.current.querySelector('button:not(:disabled)')?.focus();else e.target.click();}
      }
      const caption=[labels.model,labels.effort].filter(Boolean).join(' · ');
      const cell=(name,label,value,disabled=false)=>h('button',{type:'button',role:'menuitem','data-pane':name,disabled,onClick:()=>drill(name)},h('span',null,t(label)),h('span',{className:'act-model-value'},value),chevron(true));
      const retry=()=>{read();reload();};
      let rowIndex=0;
      return h('div',{className:'act-model','data-act-child-model':'',onKeyDown:keys},h('style',null,pickerCss),
        h('button',{ref:trigger,type:'button',className:'act-model-trigger',title:[current&&`${current.provider}/${current.model}`,caption].filter(Boolean).join(' · '),'aria-label':`${t('childModel')} · ${caption}`,'aria-haspopup':'menu','aria-expanded':isOpen,'aria-controls':isOpen?menuId:undefined,'aria-busy':busy,disabled:!rootId,onClick:open},
          h('span',null,labels.model),labels.effort&&h('span',{className:'act-model-effort'},labels.effort),busy?'…':chevron()),
        !isOpen&&error&&h('span',{role:'alert',className:'act-model-note'},error),
        isOpen&&h('div',{ref:menu,id:menuId,popover:'manual',className:'act-model-menu',role:'menu','aria-label':t('childModel')},
          (readError||catalogError||(!prefs&&preferenceCache.get(rootId)))&&h('div',{role:'alert',className:'act-model-note'},readError||catalogError||t('missingChild'),h('button',{type:'button',onClick:retry},t('retryLoad'))),
          !directory&&!catalogError&&h('div',{role:'status',className:'act-model-note'},t('modelLoading')),
          error&&h('div',{role:'alert',className:'act-model-note'},error),
          (catalog?.failures||[]).map(f=>h('div',{key:f.id,className:'act-model-note'},`${f.name||f.id} · ${f.message}`,h('button',{type:'button',onClick:retry},t('retryLoad')))),
          pane==='root'&&cell('model','model',labels.model),
          pane==='root'&&reasoning?.efforts?.length>0&&cell('effort','childEffort',labels.effort,!directory.supportsReasoningEffort),
          pane==='root'&&reasoning&&!directory?.supportsReasoningEffort&&h('div',{className:'act-model-note'},t('oldHost')),
          pane!=='root'&&current&&h('button',{type:'button','aria-label':t('goBack'),onClick:back},'‹ ',t('goBack')),
          pane==='model'&&search&&h('input',{type:'search',role:'searchbox','aria-label':t('searchModels'),placeholder:t('searchModels'),value:query,'aria-activedescendant':routes.length?`${menuId}-${activeIndex}`:undefined,onChange:e=>{setQuery(e.target.value);setIndex(0);}}),
          pane==='model'&&visible.map(g=>h('div',{key:g.id,role:'group','aria-label':g.name||g.id},h('div',{className:'act-model-group'},g.name||g.id),g.models.map(m=>{
            const route={provider:g.id,model:m.id},checked=current?.provider===g.id&&current.model===m.id,i=rowIndex++;
            return h('button',{key:m.id,id:`${menuId}-${i}`,type:'button',role:'menuitemradio','aria-checked':checked,'data-highlighted':search&&i===activeIndex?'':undefined,disabled:!ready,onClick:()=>choose(route)},h('span',null,m.name||m.id),checked?'✓':'');}))),
          pane==='model'&&catalog&&!routes.length&&h('div',{className:'act-model-note'},t('noModels')),
          pane==='effort'&&reasoning&&[{id:null,name:[t('providerDefaultEffort'),defaultLevel?.name||defaultLevel?.id].filter(Boolean).join(' · ')},...reasoning.efforts].map(item=>{
            const checked=(current?.reasoningEffort??null)===item.id;
            return h('button',{type:'button',key:JSON.stringify(item.id),role:'menuitemradio','aria-checked':checked,title:item.description,disabled:!ready||!directory.supportsReasoningEffort,onClick:()=>checked?close(true):choose({provider:current.provider,model:current.model,reasoningEffort:item.id})},h('span',null,item.name||item.id),checked?'✓':'');})
        ));
    }
    function ChildImagePicker(props){
      const mode=props.useSession(s=>s.subagent?.address.mode);
      return mode==='continuable'?h(ChildImageControl,{key:props.sessionId,t:props.t}):null;
    }
    function ChildImageControl({t}){
      const control=React.useRef(null),picker=React.useRef(null),openedFor=React.useRef(null);
      const [notice,setNotice]=React.useState('');
      const editor=()=>control.current?.closest('[data-composer-card]:not([hidden],[inert])')
        ?.querySelector('[data-input-scroll] [contenteditable="true"]');
      const pick=()=>{
        const target=editor();
        if(!target||target.closest('[hidden],[inert]')){setNotice(t('childPickerUnavailable'));return;}
        setNotice('');openedFor.current=target;picker.current?.click();
      };
      const onChange=e=>{
        const files=Array.from(e.currentTarget.files||[]);e.currentTarget.value='';
        const target=openedFor.current;openedFor.current=null;
        if(!files.length||!target||target!==editor()||target.closest('[hidden],[inert]'))return;
        // Route to this editor's Lexical paste handler, never the document's file-paste fallback.
        const win=target.ownerDocument.defaultView,transfer=new win.DataTransfer();
        for(const file of files)transfer.items.add(file);
        const card=control.current.closest('[data-composer-card]');
        const paste=new win.ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer});
        const stopAtCard=event=>{if(event===paste)event.stopPropagation();};
        card.addEventListener('paste',stopAtCard);
        try{if(target.dispatchEvent(paste))setNotice(t('childPickerUnavailable'));}
        finally{card.removeEventListener('paste',stopAtCard);}
      };
      return h('span',{ref:control,'data-act-child-images':'',style:{display:'inline-flex',alignItems:'center',gap:4,order:-1}},
        h('style',null,'[data-composer-card] :has(> div > [data-act-child-images]) > button[aria-haspopup="listbox"]{display:none}'),
        h('button',{type:'button',title:t('attach'),'aria-label':t('attach'),onClick:pick,style:{...button,width:28,height:28,padding:0,justifyContent:'center',borderRadius:'50%',background:'var(--dsw-alias-bg-layer-2)',fontSize:17,lineHeight:1}},'+'),
        h('input',{ref:picker,type:'file',accept:'image/png,image/jpeg,image/webp,image/gif',multiple:true,hidden:true,onChange}),
        notice&&h('span',{role:'status'},notice));
    }
    zh.childPickerUnavailable='当前输入框暂不能添加图片';en.childPickerUnavailable='This composer cannot add images right now';
    ctx.slots.inject('conversation.input.right',()=>ctx.slots.register({name:'conversation.input.right',id:'local-agent-chat-child-model',order:0,locale:NS},ChildModelIndicator));
    ctx.slots.inject('conversation.input.left',()=>ctx.slots.register({name:'conversation.input.left',id:'local-agent-chat-child-images',order:-30,locale:NS},ChildImagePicker));
    ctx.slots.inject('conversation.input.dock',()=>ctx.slots.register({name:'conversation.input.dock',id:'local-agent-chat-tabs-v2',order:-30,locale:NS},Tabs));
  }};
}});
