window.__ModuleLoader__.load({
  id: '@drock/dsh-request-stats',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const KEY = 'drockRequestStats';
    const words = {
      'zh-CN': {title:'请求统计', subtitle:'按对话和模型统计已记录的请求尝试', back:'返回对话', all:'全部对话', main:'主对话', child:'任务代理', filter:'对话范围', search:'搜索对话或模型', load:'补齐历史统计', loading:'正在读取历史…', total:'请求尝试', success:'完整响应', failed:'失败 / 中断', turns:'有请求轮次', methodology:'统计口径', updated:'历史快照更新', models:'模型分布', conversations:'对话明细', model:'模型', provider:'提供商', count:'次数', conversation:'对话', kind:'类型', empty:'没有符合条件的对话', pending:'待读取', unavailable:'读取失败', coverage:'统计覆盖', note:'统计来自会话日志：完整响应、失败及中断尝试均计数，不是用户消息数或工具调用数。分支继承的历史不重复计数。未写入日志的底层 HTTP 重试、标题生成及外部生图请求不在此统计；提供商/模型为请求路线，不保证服务端执行模型。', partial:'部分历史尚未读取，当前合计不是完整总数。点击“补齐历史统计”按需读取，不会启动模型请求。', detail:'查看此对话', clear:'显示全部', error:'部分对话读取失败，可再次补齐。', shown:'已读取', archived:'包含归档对话；只统计当前客户端可访问的会话目录。', daily:'每日调用次数', date:'日期', today:'今天调用', yesterday:'昨天调用', dailyCoverage:'每日统计覆盖', dailyPartial:'部分对话还是旧版统计或尚未读取，请点击“补齐历史统计”补算每日次数。', dailyNote:'北京时间（Asia/Shanghai / UTC+8），按请求结算日志日期分日；仅列有调用的日期。当前筛选同时作用于每日汇总，≥ 表示已知下限。', unknownDate:'日期未知', unknownNote:'部分历史请求缺少有效时间，单独列为“日期未知”，不会算进今天或昨天。', noDaily:'暂无可用的每日统计，请先补齐历史。', historyErrors:'历史统计读取失败', errorReason:'错误原因', sessionId:'对话 ID', retryOne:'重试这条', retryFailures:'只重试失败项', locate:'定位对话', missingTitle:'对话不在当前目录', previousStats:'保留旧统计，最新读取失败', errorDetails:'错误详情', refreshError:'会话目录刷新失败，已确认删除的对话仍会从统计中排除', cacheLoading:'正在恢复已保存的统计…', cacheError:'缓存读写失败，当前结果可能无法在重开后保留', cacheNote:'历史读取结果和失败诊断保存在当前客户端配置中；重开自动恢复，不自动重扫日志。缓存是带时间的快照，最新会话统计优先。', failureNote:'这里是历史统计读取错误，不是模型调用失败。列表保留本页尚未恢复的错误，不受当前筛选影响；成功重读后才移除。已有值仍保留旧统计，覆盖数量代表有可用快照，不保证本轮读取成功。', locale:'zh-CN'},
      en: {title:'Request statistics', subtitle:'Recorded request attempts by conversation and model', back:'Back to conversation', all:'All conversations', main:'Main conversations', child:'Task agents', filter:'Conversation scope', search:'Search conversations or models', load:'Load historical statistics', loading:'Reading history…', total:'Request attempts', success:'Complete responses', failed:'Failed / interrupted', turns:'Turns with requests', methodology:'Counting methodology', updated:'History snapshot updated', models:'Model distribution', conversations:'Conversation details', model:'Model', provider:'Provider', count:'Count', conversation:'Conversation', kind:'Type', empty:'No matching conversations', pending:'Not loaded', unavailable:'Read failed', coverage:'Coverage', note:'Counts come from session logs: complete, failed and interrupted attempts, not user messages or tool calls. Fork-inherited history is not counted twice. Unlogged HTTP retries, title generation and external image requests are excluded. Provider/model identifies the requested route, not necessarily the server-side execution model.', partial:'Some history has not been loaded; totals are incomplete. Load historical statistics on demand without starting any model requests.', detail:'Show this conversation', clear:'Show all', error:'Some conversations failed to load; retry loading history.', shown:'Loaded', archived:'Includes archived conversations; limited to the session catalog accessible to this client.', daily:'Daily request counts', date:'Date', today:'Today', yesterday:'Yesterday', dailyCoverage:'Daily coverage', dailyPartial:'Some conversations have old statistics or have not been read. Load historical statistics to rebuild daily counts.', dailyNote:'Beijing time (Asia/Shanghai / UTC+8), grouped by request settlement date. Only dates with requests are listed. Current filters apply; ≥ indicates a known lower bound.', unknownDate:'Unknown date', unknownNote:'Some historical requests have no valid timestamp. They are listed separately and are not assigned to today or yesterday.', noDaily:'No daily statistics available. Load history first.', historyErrors:'History statistics read errors', errorReason:'Error reason', sessionId:'Conversation ID', retryOne:'Retry this', retryFailures:'Retry failures only', locate:'Locate conversation', missingTitle:'Conversation absent from catalog', previousStats:'Previous statistics retained; latest read failed', errorDetails:'Error details', refreshError:'Session catalog refresh failed; confirmed missing conversations remain excluded', cacheLoading:'Restoring saved statistics…', cacheError:'Cache read/write failed; current results may not survive reopening', cacheNote:'History results and diagnostics are saved in the current client profile. Reopening restores snapshots without rereading logs. Newer live statistics take precedence.', failureNote:'These are history read errors, not failed model calls. Unresolved errors from this page remain across filters and are removed only after a successful read. Previous values are retained; coverage counts available snapshots, not successful reads in this batch.', locale:'en'}
    };
    const css = `.drs-page{height:100%;overflow:auto;box-sizing:border-box;padding:calc(var(--dsh-frame-top-clearance,0px) + 28px) 32px 32px;padding-left:max(32px,var(--dsh-frame-leading-clearance,0px));color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:inherit}.drs-wrap{max-width:1150px;margin:auto}.drs-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:22px}.drs-page h1{font-size:24px;margin:0 0 8px;font-weight:600}.drs-page h2{font-size:17px;margin:0}.drs-muted{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.6}.drs-page button,.drs-page input,.drs-page select{font:inherit;color:inherit;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:9px 12px;min-height:38px;box-sizing:border-box}.drs-page button{cursor:pointer}.drs-page button:hover{background:var(--dsw-alias-bg-layer-2)}.drs-page button:disabled{cursor:wait;opacity:.55}.drs-page :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}.drs-tools{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.drs-tools input{flex:1;min-width:180px}.drs-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0 24px}.drs-card{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);padding:16px;border-radius:12px}.drs-number{font-size:28px;font-weight:600;font-variant-numeric:tabular-nums;margin-top:6px}.drs-section{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;margin-bottom:20px}.drs-section-header{padding:16px;background:var(--dsw-alias-bg-layer-1);display:flex;justify-content:space-between;align-items:center;gap:10px}.drs-scroll{overflow:auto}.drs-page table{border-collapse:collapse;width:100%;font-size:13px;text-align:left}.drs-page th,.drs-page td{padding:12px 16px;border-top:1px solid var(--dsw-alias-border-l1);vertical-align:top}.drs-page th{color:var(--dsw-alias-label-secondary);font-weight:500}.drs-num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.drs-model{overflow-wrap:anywhere;min-width:140px}.drs-name{max-width:380px;overflow-wrap:anywhere}.drs-link{border:0!important;background:transparent!important;padding:0!important;min-height:0!important;text-align:left;color:var(--dsw-alias-brand-primary)!important}.drs-bar{height:4px;background:var(--dsw-alias-bg-layer-2);border-radius:4px;margin-top:6px}.drs-bar span{height:100%;display:block;background:var(--dsw-alias-brand-primary);border-radius:4px}.drs-notice{padding:12px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);margin-bottom:16px;line-height:1.6;font-size:13px}.drs-error{color:var(--dsw-alias-state-error-primary)}.drs-empty{padding:24px;text-align:center}.drs-note{padding:14px 0}.drs-page details summary{cursor:pointer}.drs-progress{font-variant-numeric:tabular-nums}@media(max-width:700px){.drs-page{padding:24px 16px}.drs-head{flex-wrap:wrap}.drs-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.drs-page th,.drs-page td{padding:10px}.drs-number{font-size:24px}}`;
    const hasDaily=s=>s?.version===2&&s.timeZone==='Asia/Shanghai'&&Array.isArray(s.days);
    function pickStats(wire,local){
      if(!wire)return local;
      if(local&&local.seq>=wire.seq&&hasDaily(local)&&!hasDaily(wire))return local;
      return local&&local.seq>wire.seq?local:wire;
    }
    function aggregateDays(rows){
      const days=new Map();
      for(const r of rows)for(const day of r.stats.days){
        const a=days.get(day.date)||{date:day.date,total:0,success:0,failed:0,models:new Map()};
        for(const n of ['total','success','failed'])a[n]+=day[n]||0;
        for(const m of day.models){
          const k=JSON.stringify([m.provider,m.model]);
          const model=a.models.get(k)||{provider:m.provider,model:m.model,total:0};
          model.total+=m.total;a.models.set(k,model);
        }
        days.set(day.date,a);
      }
      return [...days.values()].map(a=>({...a,models:[...a.models.values()].sort((x,y)=>y.total-x.total)})).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    }
    const dayKey=time=>new Date(time+8*60*60*1000).toISOString().slice(0,10);
    function Icon({size=18}) {return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.5,'aria-hidden':true},h('path',{d:'M4 4v16h17M8 16v-5m5 5V6m5 10V9',strokeLinecap:'round',strokeLinejoin:'round'}));}
    return {inject:['slots','locale','sessions','layout'],apply(ctx) {
      ctx.effect(()=>ctx.locale.register('drock-request-stats', {...words,zh:words['zh-CN']}));
      const t=ctx.locale.bind('drock-request-stats');
      function Page({useSessions}) {
        React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getLocale());
        const catalog=useSessions(s=>s);
        const [scope,setScope]=React.useState('all');
        const [query,setQuery]=React.useState('');
        const [chosen,setChosen]=React.useState(null);
        const [busy,setBusy]=React.useState(false);
        const [progress,setProgress]=React.useState({done:0,total:0});
        const [failures,setFailures]=React.useState({});
        const [snapshots,setSnapshots]=React.useState({});
        const [updated,setUpdated]=React.useState(null);
        const [clock,setClock]=React.useState(Date.now());
        const [cacheLoading,setCacheLoading]=React.useState(true);
        const [cacheError,setCacheError]=React.useState(null);
        const [missingIds,setMissingIds]=React.useState({});
        const [refreshError,setRefreshError]=React.useState(null);
        React.useEffect(()=>{
          let timer;
          function arm(now){
            clearTimeout(timer);
            const offset=8*60*60*1000,day=24*60*60*1000;
            const next=(Math.floor((now+offset)/day)+1)*day-offset;
            timer=setTimeout(tick,Math.max(100,next-now+100));
          }
          function tick(){const now=Date.now();setClock(now);arm(now);}
          function onVisible(){if(document.visibilityState==='visible')tick();}
          arm(Date.now());document.addEventListener('visibilitychange',onVisible);
          return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',onVisible);};
        },[]);
        const mounted=React.useRef(true), running=React.useRef(false), controller=React.useRef(null),missingRef=React.useRef({});
        React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();}},[]);
        const rows=catalog.ids.filter(id=>!missingIds[id]).map(id=>catalog.byId[id]).filter(Boolean).map(r=>{const wire=catalog.projectionsBySession[r.id]?.values?.[KEY] || r.projectionValues?.[KEY];const local=snapshots[r.id];return {...r,stats:pickStats(wire,local)};});
        const needle=query.trim().toLowerCase();
        const visible=rows.filter(r=>(scope==='all'||(scope==='child')===(r.origin==='subagent'))&&(!chosen||r.id===chosen)&&(!needle||!r.stats||[r.displayTitle,r.id,...(r.stats?.models||[]).map(m=>m.model+' '+m.provider)].join(' ').toLowerCase().includes(needle)));
        const loaded=visible.filter(r=>r.stats);
        const sums=loaded.reduce((a,r)=>{for(const k of ['total','success','failed','turns'])a[k]+=r.stats[k]||0;return a;},{total:0,success:0,failed:0,turns:0});
        const models=new Map();for(const r of loaded)for(const m of r.stats.models||[]){const k=JSON.stringify([m.provider,m.model]);const a=models.get(k)||{provider:m.provider,model:m.model,total:0,success:0,failed:0};for(const n of ['total','success','failed'])a[n]+=m[n]||0;models.set(k,a);}
        const modelRows=[...models.values()].sort((a,b)=>b.total-a.total);
        const dailyLoaded=loaded.filter(r=>hasDaily(r.stats));
        const dailyRows=aggregateDays(dailyLoaded);
        const undated=dailyRows.find(r=>r.date===null)?.total||0;
        const today=dayKey(clock),yesterday=dayKey(clock-24*60*60*1000);
        const dailyIncomplete=dailyLoaded.length<visible.length||undated>0;
        const failureRows=Object.entries(failures).filter(([id])=>!missingIds[id]).map(([id,error])=>({id,error:typeof error==='string'?{message:error}:error,session:catalog.byId[id]}));
        const detailRef=React.useRef(null);
        React.useEffect(()=>{if(chosen!==null)detailRef.current?.scrollIntoView({block:'start'});},[chosen]);
        function locate(id){setScope('all');setQuery('');setChosen(id);}
        function dropMissing(id,error=null){
          missingRef.current={...missingRef.current,[id]:true};setMissingIds({...missingRef.current});
          for(const setter of [setSnapshots,setFailures])setter(s=>{const next={...s};delete next[id];return next;});
          setChosen(value=>value===id?null:value);if(error)setCacheError(error);
        }
        const deletedResponse=(status,value,id)=>status===404&&value?.code==='SESSION_NOT_FOUND'&&value.sessionId===id;
        async function refreshCatalog(){try{await ctx.sessions.refresh();if(mounted.current)setRefreshError(null);}catch(e){if(mounted.current)setRefreshError(e.message||String(e));}}
        React.useEffect(()=>{
          const abort=new AbortController();let active=true;
          async function restore(){
            try{
              await refreshCatalog();if(!active)return;
              const url=new URL('./api/drock-request-stats',document.baseURI);url.searchParams.set('cache','1');
              const response=await fetch(url,{credentials:'same-origin',signal:abort.signal,cache:'no-store'});
              const body=await response.json();
              if(!response.ok)throw new Error(body.error||'HTTP '+response.status);
              if(active){
                for(const id of body.missingIds||[])if(typeof id==='string')dropMissing(id);
                setCacheError(body.cacheError||null);
                const records=Object.entries(body.snapshots||{}).filter(([id])=>catalog.byId[id]&&!missingRef.current[id]);
                setSnapshots(s=>{const next={...s};for(const [id,record] of records)next[id]=pickStats(next[id],record.stats);return next;});
                setFailures(s=>Object.fromEntries(Object.entries({...Object.fromEntries(Object.entries(body.failures||{}).filter(([id])=>catalog.byId[id])),...s}).filter(([id])=>!missingRef.current[id])));
                const latest=Math.max(0,...records.map(([,r])=>r.at||0));if(latest)setUpdated(latest);
              }
            }catch(e){if(active&&!abort.signal.aborted)setCacheError(e.message||String(e));}
            finally{if(active)setCacheLoading(false);}
          }
          if(catalog.phase==='ready')restore();
          return()=>{active=false;abort.abort();};
        },[catalog.phase]);
        async function loadHistory(targetIds){
          if(running.current||cacheLoading)return;
          const ids=[...new Set(Array.isArray(targetIds)?targetIds:visible.map(r=>r.id))].filter(id=>!missingRef.current[id]);
          if(!ids.length)return;
          running.current=true;setBusy(true);
          controller.current=new AbortController();const signal=controller.current.signal;
          let cursor=0,done=0,successful=0;setProgress({done,total:ids.length});
          async function worker(){
            while(mounted.current&&cursor<ids.length){
              const id=ids[cursor++];if(missingRef.current[id])continue;let status=null;
              try{
                const url=new URL('./api/drock-request-stats',document.baseURI);url.searchParams.set('sessionId',id);url.searchParams.set('title',catalog.byId[id]?.displayTitle?.trim()||id);
                const response=await fetch(url,{credentials:'same-origin',signal,cache:'no-store'});status=response.status;
                if(!response.ok){
                  let reason='HTTP '+status,deleted=false;
                  try{
                    const body=await response.text();let value;
                    try{value=JSON.parse(body);}catch{}
                    if(deletedResponse(status,value,id)){if(mounted.current)dropMissing(id,value.cacheError);deleted=true;}
                    const message=typeof value?.error==='string'?value.error:body;
                    if(message)reason+=': '+message.slice(0,4000);
                    if(value?.cacheError&&mounted.current)setCacheError(value.cacheError);
                  }catch{}
                  if(deleted)continue;
                  throw new Error(reason);
                }
                const value=await response.json();
                if(!value.stats||typeof value.stats.total!=='number'||!Array.isArray(value.stats.models))throw new Error('Missing or invalid statistics');
                if(mounted.current&&!missingRef.current[id]){
                  successful++;
                  if(value.cacheError)setCacheError(value.cacheError);
                  setSnapshots(s=>({...s,[id]:pickStats(s[id],value.stats)}));
                  setFailures(s=>{if(!(id in s))return s;const next={...s};delete next[id];return next;});
                }
              }catch(e){
                if(mounted.current&&!signal.aborted&&!missingRef.current[id]){
                  const failure={title:catalog.byId[id]?.displayTitle?.trim()||id,message:e.message||String(e),status,at:Date.now()};
                  setFailures(s=>({...s,[id]:failure}));
                  try{
                    const url=new URL('./api/drock-request-stats',document.baseURI);url.searchParams.set('cache','error');
                    const response=await fetch(url,{method:'POST',credentials:'same-origin',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...failure})});
                    if(!response.ok){let value;try{value=await response.json();}catch{}if(deletedResponse(response.status,value,id)){if(mounted.current)dropMissing(id,value.cacheError);}else throw new Error(value?.error||'HTTP '+response.status);}
                  }catch(saveError){if(mounted.current&&!signal.aborted)setCacheError(saveError.message||String(saveError));}
                }
              }finally{done++;if(mounted.current)setProgress({done,total:ids.length});}
            }
          }
          try{await Promise.all([worker(),worker()]);if(mounted.current&&!signal.aborted)await refreshCatalog();}finally{running.current=false;if(mounted.current){setBusy(false);if(successful>0)setUpdated(Date.now());}}
        }
        const num=n=>n.toLocaleString();
        const cols=(labels)=>h('thead',null,h('tr',null,...labels.map((x,i)=>h('th',{key:x,className:i>1?'drs-num':null,scope:'col'},t(x)))));
        return h('div',{className:'drs-page','data-request-stats':true},h('style',null,css+'.drs-daily-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.drs-failure-id{display:block;user-select:text;overflow-wrap:anywhere;margin-top:8px}.drs-error-body{white-space:pre-wrap;overflow-wrap:anywhere;max-height:200px;overflow:auto;font:inherit}.drs-failure-actions{display:flex;gap:8px;flex-wrap:wrap}.drs-failure-section .drs-section-header{flex-wrap:wrap}'),h('div',{className:'drs-wrap'},
          h('div',{className:'drs-head'},h('div',null,h('h1',null,t('title')),h('div',{className:'drs-muted'},t('subtitle'))),h('button',{type:'button',onClick:()=>ctx.layout.selectPanel(null)},t('back'))),
          h('div',{className:'drs-tools'},h('select',{'aria-label':t('filter'),value:scope,onChange:e=>{setScope(e.target.value);setChosen(null);}},...['all','main','child'].map(k=>h('option',{key:k,value:k},t(k)))),h('input',{type:'search','aria-label':t('search'),placeholder:t('search'),value:query,onChange:e=>setQuery(e.target.value)}),h('button',{type:'button',disabled:busy||cacheLoading||!visible.length,onClick:loadHistory},busy?t('loading'):t('load'))),
          h('div',{className:'drs-muted drs-progress',role:'status','aria-live':'polite'},t('coverage')+': '+loaded.length+' / '+visible.length+(busy?' · '+progress.done+' / '+progress.total:'')+(updated?' · '+t('updated')+': '+new Date(updated).toLocaleTimeString():'')),
          visible.length>loaded.length&&h('div',{className:'drs-notice'},t('partial')),
          cacheLoading&&h('div',{className:'drs-notice drs-muted',role:'status'},t('cacheLoading')),
          cacheError&&h('div',{className:'drs-notice drs-error',role:'alert'},t('cacheError')+': '+cacheError),
          refreshError&&h('div',{className:'drs-notice drs-error',role:'alert'},t('refreshError')+': '+refreshError),
          failureRows.length>0&&h('section',{className:'drs-section drs-failure-section','data-history-errors':true,'aria-label':t('historyErrors')},
            h('div',{className:'drs-section-header'},h('h2',{className:'drs-error',role:'status','aria-live':'polite'},t('historyErrors')+' · '+failureRows.length),h('button',{type:'button',disabled:busy||cacheLoading,onClick:()=>loadHistory(failureRows.map(r=>r.id))},t('retryFailures'))),
            h('div',{className:'drs-notice drs-muted'},t('failureNote')),
            h('div',{className:'drs-scroll'},h('table',null,cols(['conversation','errorReason']),h('tbody',null,...failureRows.map(({id,error,session})=>h('tr',{key:id},
              h('td',{className:'drs-name'},h('button',{type:'button',className:'drs-link',disabled:busy||cacheLoading||!session,onClick:()=>locate(id),title:t('locate')},session?.displayTitle?.trim()||error.title||id),h('code',{className:'drs-failure-id'},t('sessionId')+': '+id),!session&&h('div',{className:'drs-muted'},t('missingTitle')),h('div',{className:'drs-failure-actions'},h('button',{type:'button',disabled:busy||cacheLoading,onClick:()=>loadHistory([id])},t('retryOne')))),
              h('td',null,h('div',{className:'drs-error'},error.status?'HTTP '+error.status:t('unavailable')),h('details',{open:true},h('summary',null,t('errorDetails')),h('pre',{className:'drs-error-body'},error.message||t('unavailable'))),error.at&&h('div',{className:'drs-muted'},new Date(error.at).toLocaleString()))
            )))))
          ),
          h('div',{className:'drs-cards'},...['total','success','failed','turns'].map(k=>h('div',{key:k,className:'drs-card'},h('div',{className:'drs-muted'},t(k)),h('div',{className:'drs-number'},loaded.length?num(sums[k]):'—')))),
          h('section',{className:'drs-section','data-daily-stats':true},
            h('div',{className:'drs-section-header'},h('h2',null,t('daily')),h('div',{className:'drs-muted'},t('dailyCoverage')+': '+dailyLoaded.length+' / '+visible.length)),
            h('div',{className:'drs-notice drs-muted'},t('dailyNote')),
            dailyLoaded.length<visible.length&&h('div',{className:'drs-notice'},t('dailyPartial')),
            undated>0&&h('div',{className:'drs-notice'},t('unknownNote')),
            h('div',{className:'drs-cards drs-daily-cards'},...[[today,'today'],[yesterday,'yesterday']].map(([date,label])=>h('div',{key:date,className:'drs-card'},h('div',{className:'drs-muted'},t(label)+' · '+date),h('div',{className:'drs-number'},dailyLoaded.length?(dailyIncomplete?'≥ ':'')+num(dailyRows.find(r=>r.date===date)?.total||0):'—')))),
            h('div',{className:'drs-scroll'},dailyRows.length?h('table',null,cols(['date','count','success','failed','models']),h('tbody',null,...dailyRows.map(day=>h('tr',{key:day.date||'unknown'},h('td',null,day.date||t('unknownDate')),...['total','success','failed'].map(k=>h('td',{key:k,className:'drs-num'},num(day[k]))),h('td',{className:'drs-model'},...day.models.map(m=>h('div',{key:JSON.stringify([m.provider,m.model])},m.provider+' / '+m.model+' · '+num(m.total)))))))):h('div',{className:'drs-empty drs-muted'},dailyLoaded.length?t('empty'):t('noDaily')))
          ),
          h('section',{className:'drs-section'},h('div',{className:'drs-section-header'},h('h2',null,t('models'))),h('div',{className:'drs-scroll'},modelRows.length?h('table',null,cols(['model','provider','count','success','failed']),h('tbody',null,...modelRows.map(m=>h('tr',{key:JSON.stringify([m.provider,m.model])},h('td',{className:'drs-model'},m.model,h('div',{className:'drs-bar','aria-hidden':true},h('span',{style:{width:(sums.total?100*m.total/sums.total:0)+'%'}}))),h('td',null,m.provider),...['total','success','failed'].map(k=>h('td',{key:k,className:'drs-num'},num(m[k]))))))):h('div',{className:'drs-empty drs-muted'},catalog.phase!=='ready'?t('loading'):t('empty')))),
          h('section',{className:'drs-section',ref:detailRef},h('div',{className:'drs-section-header'},h('h2',null,t('conversations')),chosen&&h('button',{type:'button',onClick:()=>setChosen(null)},t('clear'))),h('div',{className:'drs-scroll'},visible.length?h('table',null,cols(['conversation','model','count','failed']),h('tbody',null,...visible.map(r=>h('tr',{key:r.id},h('td',{className:'drs-name'},h('button',{type:'button',className:'drs-link',title:t('detail'),onClick:()=>setChosen(r.id)},r.displayTitle?.trim()||r.id),h('div',{className:'drs-muted'},r.origin==='subagent'?t('child'):t('main')),failures[r.id]&&h('div',{className:'drs-error'},t(r.stats?'previousStats':'unavailable'))),h('td',{className:'drs-model'},r.stats?(r.stats.models.map(m=>m.model).join(', ')||'—'):t(failures[r.id]?'unavailable':'pending')),h('td',{className:'drs-num'},r.stats?num(r.stats.total):'—'),h('td',{className:'drs-num'},r.stats?num(r.stats.failed):'—'))))):h('div',{className:'drs-empty drs-muted'},t('empty')))),
          h('details',{className:'drs-note drs-muted'},h('summary',null,t('methodology')),h('p',null,t('note')),h('p',null,t('archived')),h('p',null,t('cacheNote')))
        ));
      }
      ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'drock-request-stats'},Page));
      ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'drock-request-stats',order:21,locale:'drock-request-stats',label:()=>t('title')},Icon));
    }};
  }
});
