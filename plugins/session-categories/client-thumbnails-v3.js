window.__ModuleLoader__.load({
  id: '@local/session-categories',
  factory(require) {
    const React = require('react'), h = React.createElement, ns = 'session-categories';
    const dictionaries = {
      zh: {sessionName:'会话名称',renameSession:'重命名会话',navigation:'更多功能',archiveSession:'停止并归档',restoreSession:'恢复会话',archiveHint:'停止此会话的活动并从普通列表隐藏；历史与产物保留，可在“显示已归档会话”中恢复。',restoreHint:'恢复到原工作区，不自动重启任务。',zoom:'缩放',zoomHint:'Ctrl＋鼠标滚轮缩放缩略图',view:'展示方式',listView:'列表',cardView:'缩略图',preview:'会话缩略图',defaultPreview:'会话默认图标',created:'创建于',history:'历史会话',archived:'已归档',color:'颜色标记',none:'无颜色',red:'红色',orange:'橙色',yellow:'黄色',green:'绿色',blue:'蓝色',purple:'紫色',gray:'灰色',addWorkspace:'添加工作区',title:'会话分类',stock:'原始列表',switch:'切换会话分类视图',add:'新建分类',newSession:'新建会话',rename:'重命名',remove:'删除分类',deleteHint:'仅删除分类，其中的会话会回到“未分类”。',confirm:'确认删除',cancel:'取消',save:'保存',name:'分类名称',unclassified:'未分类',empty:'暂无会话',loading:'正在读取分类…',search:'搜索会话标题',move:'移动到分类',actions:'会话操作',refresh:'刷新',retry:'重试',fold:'展开或收起工作区',showArchived:'显示已归档会话',noWorkspace:'暂无工作区，请切回原始列表添加。',more:'显示更多',error:'操作失败',open:'打开会话',running:'进行中',noRunning:'暂无进行中的对话',current:'当前打开的对话',completed:'生成完成',waiting:'等待你回答',approval:'等待授权',review:'等待确认计划',unread:'生成完成，尚未查看'},
      en: {sessionName:'Conversation name',renameSession:'Rename conversation',navigation:'More features',archiveSession:'Stop and archive',restoreSession:'Restore session',archiveHint:'Stop activity and hide from the normal list. History and outputs remain; restore via Show archived sessions.',restoreHint:'Restore to its workspace without restarting tasks.',zoom:'Zoom',zoomHint:'Ctrl + mouse wheel to zoom thumbnails',view:'Display mode',listView:'List',cardView:'Thumbnails',preview:'Session thumbnail',defaultPreview:'Default session icon',created:'Created',history:'Conversation',archived:'Archived',color:'Color label',none:'No color',red:'Red',orange:'Orange',yellow:'Yellow',green:'Green',blue:'Blue',purple:'Purple',gray:'Gray',addWorkspace:'Add workspace',title:'Session categories',stock:'Original list',switch:'Toggle session categories',add:'New category',newSession:'New session',rename:'Rename',remove:'Delete category',deleteHint:'Sessions in this category will become unclassified.',confirm:'Confirm deletion',cancel:'Cancel',save:'Save',name:'Category name',unclassified:'Unclassified',empty:'No sessions',loading:'Loading categories…',search:'Search session titles',move:'Move to category',actions:'Session actions',refresh:'Refresh',retry:'Retry',fold:'Expand or collapse workspace',showArchived:'Show archived sessions',noWorkspace:'No workspaces. Switch to the original list to add one.',more:'Show more',error:'Operation failed',open:'Open session',running:'In progress',noRunning:'No conversations in progress',current:'Currently open conversation',completed:'Generation complete',waiting:'Waiting for your answer',approval:'Waiting for approval',review:'Waiting for plan review',unread:'Generation complete, unread'}
    };
    function Icon({name='categories',size=18}) {
      const paths={list:'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',cards:'M3 3h18v7H3z M3 14h18v7H3z',categories:'M3 4h6l2 2h10v13H3z M3 9h18 M8 9v10',chevron:'m9 5 7 7-7 7',down:'m5 9 7 7 7-7',plus:'M12 5v14 M5 12h14',newSession:'M14 5H5v14h14v-9 M13 11l7-7 M15 4h5v5',edit:'m4 16-1 5 5-1L20 8l-4-4z M14 6l4 4',close:'m6 6 12 12 M6 18 18 6',more:'M5 12h.01 M12 12h.01 M19 12h.01'};
      return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.5,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,className:'sc-icon'},name==='more'?[5,12,19].map(cx=>h('circle',{key:cx,cx,cy:12,r:1.5,fill:'currentColor',stroke:'none'})):h('path',{d:paths[name]||paths.categories}));
    }
    const labelColors={red:'#e57373',orange:'#eea05b',yellow:'#d8c357',green:'#73b988',blue:'#6fa5e6',purple:'#b28ad8',gray:'#9b9b9b'};
    const isMainSession=item=>item?.origin!=='subagent';
    // Geometry uses the rendered cards, so column count and zoom need no estimates.
    function boxOf(rect){return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height};}
    function listDropTarget(boxes,y){const before=boxes.find(b=>y<b.top+b.height/2);return {beforeSessionId:before?.id||null,y:before?.top??boxes.at(-1)?.bottom};}
    function gridDropTarget(boxes,x,y){
      if(!boxes.length)return {beforeSessionId:null};
      const lines=[];
      for(const box of boxes){let line=lines.at(-1);if(!line||box.top>=line.bottom-1){line={top:box.top,bottom:box.bottom,boxes:[]};lines.push(line);}line.boxes.push(box);line.bottom=Math.max(line.bottom,box.bottom);}
      if(y<lines[0].top){const first=boxes[0];return {beforeSessionId:first.id,x:first.left-4,y:first.top,height:first.height};}
      if(y>lines.at(-1).bottom){const last=boxes.at(-1);return {beforeSessionId:null,x:last.right+4,y:last.top,height:last.height};}
      let line=lines[0];
      for(let i=1;i<lines.length;i++){if(y>=(lines[i-1].bottom+lines[i].top)/2)line=lines[i];else break;}
      const before=line.boxes.find(b=>x<(b.left+b.right)/2),last=line.boxes.at(-1);
      const next=before||boxes[boxes.indexOf(last)+1];
      return {beforeSessionId:next?.id||null,x:before?before.left-4:last.right+4,y:line.top,height:line.bottom-line.top};
    }
    const css = `
.sc-row[data-color]{border-left:3px solid var(--sc-label-color);background:color-mix(in srgb,var(--sc-label-color) 10%,transparent)}
.sc-row[data-color]:hover,.sc-row[data-color][data-active=true]{background:color-mix(in srgb,var(--sc-label-color) 18%,var(--dsw-alias-bg-layer-2))}
.sc-palette{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.sc-browser .sc-swatch{width:26px;height:26px;padding:3px;border:1px solid var(--dsw-alias-border-l1);display:flex;align-items:center;justify-content:center}.sc-swatch span{display:block;width:16px;height:16px;border-radius:3px;background:var(--sc-label-color)}.sc-swatch[aria-pressed=true]{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}

.sc-browser{display:flex;flex-direction:column;min-height:0;overflow:hidden;flex:1;color:var(--dsw-alias-label-primary);font:inherit;padding:8px;gap:8px}
.sc-browser *{box-sizing:border-box}.sc-browser button,.sc-toggle{font:inherit;cursor:pointer;color:inherit;border:0;border-radius:6px;background:transparent;padding:5px 7px}
.sc-browser button:hover,.sc-toggle:hover{background:var(--dsw-alias-bg-layer-2)}.sc-browser button:disabled{opacity:.5;cursor:wait}
.sc-browser :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.sc-toggle:focus:not(:focus-visible){outline:none;box-shadow:none}.sc-toggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,currentColor);outline-offset:-2px}
.sc-top,.sc-heading,.sc-row,.sc-form-actions{display:flex;align-items:center;gap:4px;min-width:0}.sc-top strong{flex:1;font-size:13px}.sc-top button{font-size:12px}
.sc-browser input,.sc-browser select{font:inherit;color:inherit;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:6px;min-width:0;max-width:100%}
.sc-browser input[type=search]{width:100%}.sc-scroll{overflow:auto;min-height:0;flex:1}.sc-workspace{margin-bottom:8px}.sc-heading{min-height:32px}.sc-heading>.sc-label{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.sc-group{margin-left:10px;border-left:1px solid var(--dsw-alias-border-l1);padding-left:5px}.sc-group .sc-heading{font-size:12px}.sc-group .sc-label{font-weight:500}.sc-count,.sc-muted{color:var(--dsw-alias-label-secondary);font-size:12px}.sc-count{flex-shrink:0}
.sc-row{min-height:30px;border-radius:6px;position:relative}.sc-row[data-active=true]{background:var(--dsw-alias-bg-layer-2)}.sc-session{flex:1;min-width:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sc-dot{color:var(--dsw-alias-brand-primary);width:9px;font-size:14px;flex-shrink:0}
.sc-running{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px;margin-bottom:10px}.sc-running-title{font-size:12px;font-weight:600;padding:3px 5px}.sc-badge{flex-shrink:0;color:var(--dsw-alias-brand-primary);font-size:11px;white-space:nowrap;padding:2px 4px}.sc-row[data-running=true] .sc-dot{color:var(--dsw-alias-brand-primary)}
.sc-status{width:16px;flex:none;display:inline-flex;align-items:center;justify-content:center}.sc-spinner{flex:none;color:var(--dsw-alias-label-secondary)}.sc-spinner-motion{transform-origin:center;animation:sc-state-spin 1.5s linear infinite}.sc-spinner-track,.sc-spinner-arc{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}.sc-spinner-track{opacity:.25}.sc-spinner-arc{stroke-dasharray:12 150;animation:sc-state-dash 1.5s ease-in-out infinite}@keyframes sc-state-spin{to{transform:rotate(360deg)}}@keyframes sc-state-dash{0%{stroke-dasharray:12 150;stroke-dashoffset:0}50%{stroke-dasharray:24 150;stroke-dashoffset:-6}100%{stroke-dasharray:12 150;stroke-dashoffset:0}}@media(prefers-reduced-motion:reduce){.sc-spinner-motion,.sc-spinner-arc{animation:none}.sc-spinner-arc{stroke-dasharray:18 150;stroke-dashoffset:-3}}.sc-completed-dot{width:10px;height:10px;border-radius:50%;background:var(--dsw-alias-state-success-primary)}.sc-completed-label{color:var(--dsw-alias-state-success-primary);font-size:11px;white-space:nowrap;flex:none;padding:2px 4px}
.sc-editor,.sc-menu{padding:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);margin:4px 0}.sc-editor input,.sc-menu select{width:100%;margin:5px 0}.sc-form-actions{justify-content:flex-end}.sc-error{color:var(--dsw-alias-state-error-primary);font-size:12px;overflow-wrap:anywhere}.sc-rail{padding:8px;display:flex;justify-content:center}.sc-menu label{font-size:12px}.sc-toggle{display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px}.sc-muted{padding:4px 7px}.sc-filter{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.sc-icon{display:block;flex:none}.sc-toggle{width:28px;height:28px;min-width:28px;min-height:28px;flex:none;padding:0;box-sizing:border-box;margin:0;align-self:center;line-height:0;color:var(--dsw-alias-label-secondary);border-radius:8px;transition:background .15s,color .15s}.sc-toggle[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.sc-browser{padding:8px 10px;gap:10px;font-size:13px;line-height:20px}.sc-top{height:28px;padding:0 4px}.sc-top strong{font-weight:600}.sc-browser button{line-height:20px}.sc-browser input[type=search]{height:32px;padding:5px 10px;border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
.sc-heading{gap:4px;min-height:32px;padding:0 4px}.sc-heading>.sc-label{display:flex;align-items:center;gap:6px;padding:4px 0}.sc-heading>button:not(.sc-label),.sc-row>button:not(.sc-session){width:24px;height:24px;padding:4px;display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--dsw-alias-label-secondary)}
.sc-heading>button:not(.sc-label){opacity:0}.sc-heading:hover>button:not(.sc-label),.sc-heading:focus-within>button:not(.sc-label){opacity:1}.sc-row>button:not(.sc-session){opacity:0}.sc-row:hover>button:not(.sc-session),.sc-row:focus-within>button:not(.sc-session),.sc-row>button[aria-expanded=true]:not(.sc-session){opacity:1}
.sc-workspace{margin-bottom:12px}.sc-group{margin-left:12px;padding-left:8px;border-left:0}.sc-group .sc-heading{color:var(--dsw-alias-label-secondary)}.sc-count{font-size:11px;font-variant-numeric:tabular-nums;opacity:.75;min-width:16px;text-align:center}.sc-row{min-height:32px;padding:0 6px;gap:6px;border-radius:8px}.sc-row:hover{background:var(--dsw-alias-bg-layer-2)}.sc-session{padding:6px 0!important;line-height:20px}.sc-browser .sc-session:hover{background:transparent}.sc-status{width:16px;height:20px}.sc-running{border:0;border-radius:0;padding:0 0 8px;margin-bottom:8px;border-bottom:1px solid var(--dsw-alias-border-l1)}.sc-running-title{padding:4px 6px;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500}.sc-muted{margin:0;font-size:12px;padding:6px}.sc-completed-label{font-size:11px;padding-right:2px}.sc-rail button{width:32px;height:32px;padding:7px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}.sc-filter{padding:0 4px}.sc-filter input{accent-color:var(--dsw-alias-brand-primary)}
.sc-disclosure{display:inline-flex;align-items:center;justify-content:center;width:16px;min-width:16px;height:20px;flex:0 0 16px;opacity:1;visibility:visible;color:var(--dsw-alias-label-primary)}.sc-disclosure>.sc-icon{display:block;width:16px;height:16px;opacity:1;visibility:visible;stroke:currentColor;stroke-width:1.75;fill:none}.sc-heading-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-row[draggable=true]{cursor:grab}.sc-row[draggable=true]:active{cursor:grabbing}.sc-category-heading>button:not(.sc-label){transition:opacity .15s}
.sc-grid-insert{position:absolute;left:var(--sc-drop-x);top:var(--sc-drop-y);width:2px;height:var(--sc-drop-height);border-radius:2px;background:var(--dsw-alias-brand-primary);pointer-events:none;z-index:4;transform:translateX(-1px)}.sc-grid-insert:before,.sc-grid-insert:after{content:"";position:absolute;left:-2px;width:6px;height:2px;background:inherit;border-radius:2px}.sc-grid-insert:before{top:0}.sc-grid-insert:after{bottom:0}.sc-grid-insert-empty{width:calc(100% - 24px);height:36px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent);border:1px dashed var(--dsw-alias-brand-primary);border-radius:6px;transform:none}.sc-grid-insert-empty:before,.sc-grid-insert-empty:after{display:none}
.sc-group{position:relative}.sc-insert-line{position:absolute;left:10px;right:10px;top:var(--sc-drop-y);height:1px;transform:translateY(-.5px);background:linear-gradient(90deg,transparent,var(--dsw-alias-brand-primary) 16%,var(--dsw-alias-brand-primary) 84%,transparent);opacity:.8;pointer-events:none;z-index:4;border-radius:999px}
.sc-scroll{position:relative}.sc-workspace>.sc-heading[draggable=true]{cursor:grab}.sc-workspace>.sc-heading[draggable=true]:active{cursor:grabbing}
.sc-pending-dot{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border:1.5px solid currentColor;border-radius:50%;color:var(--dsw-alias-state-warn-primary);font-size:10px;font-weight:700;line-height:1}.sc-pending-label{color:var(--dsw-alias-state-warn-primary);font-size:11px;white-space:nowrap;flex:none;padding:2px 4px}
@media(hover:none){.sc-heading>button:not(.sc-label),.sc-row>button:not(.sc-session){opacity:1}}

.sc-card-meta{display:none}.sc-view-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px}.sc-view-switch{display:flex;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;flex-shrink:0}.sc-view-switch button{display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:3px 6px}.sc-view-switch button[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}
.sc-browser[data-view=cards] .sc-row{align-items:flex-start;gap:6px;margin:6px 0;padding:9px 7px;min-height:76px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1)}
.sc-browser[data-view=cards] .sc-row:hover{background:var(--dsw-alias-bg-layer-2)}.sc-browser[data-view=cards] .sc-row[data-active=true]{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,var(--dsw-alias-bg-layer-1))}
.sc-browser[data-view=cards] .sc-row[data-color]{border-left:3px solid var(--sc-label-color);background:color-mix(in srgb,var(--sc-label-color) 10%,var(--dsw-alias-bg-layer-1))}.sc-browser[data-view=cards] .sc-row[data-color]:hover,.sc-browser[data-view=cards] .sc-row[data-color][data-active=true]{background:color-mix(in srgb,var(--sc-label-color) 17%,var(--dsw-alias-bg-layer-1))}
.sc-browser[data-view=cards] .sc-row>.sc-status{margin-top:4px}.sc-browser[data-view=cards] .sc-row>.sc-session{white-space:normal;padding:2px 0!important;overflow:hidden;align-self:stretch}.sc-browser[data-view=cards] .sc-session-title{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;line-height:1.5;font-weight:500}
.sc-browser[data-view=cards] .sc-card-meta{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin-top:6px;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary)}.sc-card-meta time{font-variant-numeric:tabular-nums}.sc-card-state{overflow-wrap:anywhere}.sc-card-state[data-attention=true]{color:var(--dsw-alias-brand-primary)}.sc-card-state[data-pending=true]{color:var(--dsw-alias-state-warn-primary)}
.sc-browser[data-view=cards] .sc-row>.sc-pending-label,.sc-browser[data-view=cards] .sc-row>.sc-completed-label{display:none}.sc-browser[data-view=cards] .sc-row>button:not(.sc-session){flex:none;opacity:1;padding:3px}.sc-browser[data-view=cards] .sc-group{padding-left:7px;margin-left:6px}

.sc-session-preview{display:none}.sc-tile{min-width:0}.sc-session-grid{min-width:0}
.sc-browser[data-view=cards] .sc-session-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,118px),1fr));gap:8px;align-items:start;margin:5px 0 8px}
.sc-browser[data-view=cards] .sc-row{display:block;position:relative;min-width:0;min-height:0;width:100%;height:100%;margin:0;padding:5px;border-radius:8px}
.sc-browser[data-view=cards] .sc-row>.sc-session{display:block;width:100%;white-space:normal;padding:0!important;overflow:hidden;text-align:center}
.sc-browser[data-view=cards] .sc-session-preview{display:flex;width:100%;height:100px;align-items:center;justify-content:center;overflow:hidden;border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);margin-bottom:7px}
.sc-session-preview img{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none}.sc-session-preview svg{width:48px;height:56px;flex:none}
.sc-browser[data-view=cards] .sc-session-title{font-size:12px;line-height:1.45;min-height:1.45em;text-align:center;-webkit-line-clamp:3;font-weight:500}
.sc-browser[data-view=cards] .sc-row>.sc-status{position:absolute;left:9px;top:8px;margin:0;z-index:1;border-radius:4px;background:var(--dsw-alias-bg-layer-1);pointer-events:none}
.sc-browser[data-view=cards] .sc-row>button:not(.sc-session){position:absolute;right:7px;top:7px;margin:0;width:22px;height:22px;z-index:2;opacity:1;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:5px}
.sc-browser[data-view=cards] .sc-card-meta{justify-content:center;gap:2px 6px;margin-top:4px;font-size:10px;line-height:1.45}.sc-browser[data-view=cards] .sc-card-meta time{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-browser[data-view=cards] .sc-tile{height:100%}.sc-browser[data-view=cards] .sc-session-grid>.sc-muted{grid-column:1/-1}

.sc-browser[data-view=cards] .sc-session-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--sc-tile-width,118px)),1fr))}
.sc-browser[data-view=cards] .sc-tile{height:calc(var(--sc-preview-height,80px) + 56px)}
.sc-browser[data-view=cards] .sc-row{height:100%}
.sc-browser[data-view=cards] .sc-session-preview{height:var(--sc-preview-height,80px);margin-bottom:5px}
.sc-browser[data-view=cards] .sc-session-preview svg{width:38px;height:44px}
.sc-browser[data-view=cards] .sc-session-title{-webkit-line-clamp:2;max-height:35px;line-height:17.4px}
.sc-browser[data-view=cards] .sc-card-meta{display:none}
/* Linear-inspired navigation: a quiet single column, not a gallery. */
.sc-browser[data-view=list] .sc-session-grid{display:flex;flex-direction:column;gap:2px;margin:3px 0 8px}
.sc-browser[data-view=list] .sc-row{min-height:44px;padding:0 6px;gap:6px;border-radius:6px}
.sc-browser[data-view=list] .sc-session{display:flex;align-items:center;gap:10px;padding:6px 0!important;white-space:normal}
.sc-browser[data-view=list] .sc-session-preview{display:flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 28px;margin:0;overflow:hidden;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary)}
.sc-browser[data-view=list] .sc-session-preview[data-has-image=true]{background:var(--dsw-alias-bg-layer-1)}
.sc-browser[data-view=list] .sc-session-preview img{object-fit:cover}
.sc-browser[data-view=list] .sc-session-preview svg{width:18px;height:18px}
.sc-session-copy{display:block;min-width:0;flex:1}
.sc-browser[data-view=list] .sc-session-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:18px;text-align:left;font-weight:400}
.sc-browser[data-view=list] .sc-card-meta{display:flex;align-items:center;gap:7px;min-width:0;margin-top:1px;font-size:10px;line-height:14px;color:var(--dsw-alias-label-secondary);overflow:hidden;white-space:nowrap}
.sc-browser[data-view=list] .sc-card-meta time{flex:none;font-variant-numeric:tabular-nums}
.sc-browser[data-view=list] .sc-card-state{overflow:hidden;text-overflow:ellipsis}
.sc-browser[data-view=list] .sc-card-state[data-attention=true]{color:var(--dsw-alias-state-success-primary)}
.sc-browser[data-view=list] .sc-row[data-running=true] .sc-card-state{color:var(--dsw-alias-label-secondary)}
.sc-browser[data-view=list] .sc-card-state[data-pending=true]{color:var(--dsw-alias-state-warn-primary)}
.sc-browser[data-view=list] .sc-row>.sc-pending-label,.sc-browser[data-view=list] .sc-row>.sc-completed-label{display:none}
.sc-browser[data-view=list] .sc-row[data-active=true] .sc-session-title{font-weight:500}
.sc-browser[data-view=list] .sc-row[data-color]{border-left:2px solid var(--sc-label-color);background:transparent}
.sc-browser[data-view=list] .sc-row[data-color]:hover,.sc-browser[data-view=list] .sc-row[data-color][data-active=true]{background:color-mix(in srgb,var(--sc-label-color) 10%,var(--dsw-alias-bg-layer-2))}
.sc-browser[data-view=list] .sc-group{margin-left:8px;padding-left:6px}
.sc-browser[data-view=cards] .sc-session-preview svg{width:32px;height:32px}
.sc-view-switch{border:0;background:var(--dsw-alias-bg-layer-1)}
.sc-view-switch button[aria-pressed=true]{color:var(--dsw-alias-label-primary)}
@media(prefers-reduced-motion:reduce){.sc-category-heading>button:not(.sc-label){transition:none}}
.sc-zoom{display:flex;align-items:center;justify-content:flex-end;gap:6px;font-size:11px;color:var(--dsw-alias-label-secondary)}.sc-zoom input[type=range]{width:88px;height:18px;padding:0;accent-color:var(--dsw-alias-brand-primary);border:0}.sc-zoom output{min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
`;
    return {
      inject: ['slots','locale','connection','uiWorkspace','workspaces','sessions'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(ns, dictionaries));
        // Default on every client load; stock remains a temporary escape hatch.
        // New design starts in list mode once; keep v1 intact for rollback.
        const viewKey='dsh.session-categories.view.v2';
        const foldKey='dsh.session-categories.fold.v1';
        const unclassifiedFoldKey='dsh.session-categories.unclassified-fold.v1';
        let enabled=true;
        const listeners=new Set();
        const mode={getSnapshot:()=>enabled,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
        async function rpc(payload, signal) {
          const result=await ctx.connection.rpc.call('/api','session-categories',payload,signal);
          if(!result.ok) throw new Error(result.error.message);
          return result.value;
        }
        function Editor({editor,busy,t,onSave,onCancel}) {
          const [name,setName]=React.useState(editor.name||'');
          return h('form',{className:'sc-editor',onSubmit:e=>{e.preventDefault();if(!busy)onSave(name);}},
            editor.kind==='delete'?h('p',null,t('deleteHint')):h('label',null,t(editor.kind==='renameSession'?'sessionName':'name'),h('input',{value:name,maxLength:100,autoFocus:true,required:true,onChange:e=>setName(e.target.value)})),
            h('div',{className:'sc-form-actions'},h('button',{type:'button',onClick:onCancel,disabled:busy},t('cancel')),h('button',{type:'submit',disabled:busy||editor.kind!=='delete'&&!name.trim()},t(editor.kind==='delete'?'confirm':'save'))));
        }
        // Native StateDot geometry/timing, scoped locally: plain-JS plugins do not import private Client modules.
        function pendingLabel(pending,t){return pending?t(pending==='approval'?'approval':pending==='plan-review'?'review':'waiting'):null;}
        function StatusIndicator({running,completed,current,pending,t}) {
          const label=pendingLabel(pending,t)||(running?t('running'):completed?t('unread'):current?t('current'):undefined);
          function synchronize(element){if(element)for(const animation of element.getAnimations?.({subtree:true})||[])animation.startTime=0;}
          return h('span',{className:'sc-status',title:label,role:label?'img':undefined,'aria-label':label},pending?h('span',{className:'sc-pending-dot','aria-hidden':true},'?'):running?
            h('svg',{className:'sc-spinner',ref:synchronize,onAnimationStart:e=>synchronize(e.currentTarget),width:14,height:14,viewBox:'0 0 24 24','aria-hidden':true,'data-state':'ongoing'},h('g',{className:'sc-spinner-motion'},h('circle',{className:'sc-spinner-track',cx:12,cy:12,r:9.5}),h('circle',{className:'sc-spinner-arc',cx:12,cy:12,r:9.5}))):
            completed?h('span',{className:'sc-completed-dot','aria-hidden':true}):h('span',{className:'sc-dot','aria-hidden':true},current?'•':''));
        }

        function SessionPreview({preview,title,t}) {
          const src=typeof preview?.src==='string'?preview.src:'',version=preview?.version??'';
          const signature=src+'\u0000'+String(version),[failed,setFailed]=React.useState(null);
          const available=!!src&&failed!==signature;
          return h('span',{className:'sc-session-preview','data-has-image':available,'aria-hidden':true},available?h('img',{key:signature,src,alt:'',loading:'lazy',decoding:'async',draggable:false,onError:()=>setFailed(signature)}):h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.5,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2z M7 9h10 M7 13h6'})));
        }
        function SessionTitle({title,createdAt,running,completed,current,pending,archived,t}) {
          const stamp=Number.isFinite(createdAt)&&createdAt>0?new Date(createdAt):null;
          const valid=stamp&&Number.isFinite(stamp.getTime());
          const pad=value=>String(value).padStart(2,'0');
          const date=valid?stamp.getFullYear()+'-'+pad(stamp.getMonth()+1)+'-'+pad(stamp.getDate())+' '+pad(stamp.getHours())+':'+pad(stamp.getMinutes()):null;
          const state=pendingLabel(pending,t)||(running?t('running'):completed?t('completed'):current?t('current'):archived?t('archived'):null);
          return h('span',{className:'sc-session-copy'},h('span',{className:'sc-session-title',title:[title,date,state].filter(Boolean).join('\n')},title),h('span',{className:'sc-card-meta'},date&&h('time',{dateTime:stamp.toISOString(),title:t('created')+' '+date},date.slice(0,10)),h('span',{className:'sc-card-state','data-pending':!!pending,'data-attention':!!pending||running||completed},state)));
        }
        const dragType='application/x-dsh-category-session';
        let draggedSession=null;
        function beginDrag(event,workspaceId,sessionId){draggedSession={workspaceId,sessionId};event.dataTransfer.effectAllowed='move';event.dataTransfer.setData(dragType,JSON.stringify(draggedSession));}
        function endDrag(){draggedSession=null;}
        function Workspace({workspace,summary,statuses,archived,showArchived,query,t,view,onPreviews,onWorkspaceDragStart,onWorkspaceDragEnd}) {
          const wid=workspace.workspaceId;
          const [data,setData]=React.useState(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[editor,setEditor]=React.useState(null),[menu,setMenu]=React.useState(null),[menuPoint,setMenuPoint]=React.useState(null),[limits,setLimits]=React.useState({});
          const [folded,setFolded]=React.useState(()=>{try{return JSON.parse(localStorage.getItem(foldKey)||'{}')[wid]===true;}catch{return false;}});
          const [unclassifiedFolded,setUnclassifiedFolded]=React.useState(()=>{try{return JSON.parse(localStorage.getItem(unclassifiedFoldKey)||'{}')[wid]===true;}catch{return false;}});
          function toggleUnclassified(){setUnclassifiedFolded(value=>{const next=!value;try{const saved=JSON.parse(localStorage.getItem(unclassifiedFoldKey)||'{}');saved[wid]=next;localStorage.setItem(unclassifiedFoldKey,JSON.stringify(saved));}catch{}return next;});}
          const alive=React.useRef(true),sequence=React.useRef(0),pending=React.useRef(false),mutating=React.useRef(false);
          const refresh=React.useCallback(async(signal)=>{
            if(mutating.current||pending.current)return;
            pending.current=true;const n=++sequence.current;
            try{const value=await rpc({action:'list',workspaceId:wid},signal);if(alive.current&&n===sequence.current){setData(value);onPreviews(value.previewsBySession||{});setError('');}}
            catch(e){if(alive.current&&!signal?.aborted&&n===sequence.current)setError(String(e.message||e));}
            finally{pending.current=false;}
          },[wid,onPreviews]);
          const [archiveError,setArchiveError]=React.useState('');
          const menuRef=React.useRef(null);
          React.useEffect(()=>{
            if(!menu)return;
            const closeOutside=e=>{if(!menuRef.current?.contains(e.target))setMenu(null);};
            const escape=e=>{if(e.key==='Escape')setMenu(null);};
            window.addEventListener('pointerdown',closeOutside);window.addEventListener('keydown',escape);
            return()=>{window.removeEventListener('pointerdown',closeOutside);window.removeEventListener('keydown',escape);};
          },[menu]);
          React.useLayoutEffect(()=>{
            const element=menuRef.current;if(!element||!menuPoint)return;
            const rect=element.getBoundingClientRect();
            element.style.left=Math.max(8,Math.min(menuPoint.x,window.innerWidth-rect.width-8))+'px';
            element.style.top=Math.max(8,Math.min(menuPoint.y,window.innerHeight-rect.height-8))+'px';
            element.querySelector('button:not(:disabled)')?.focus();
          },[menu,menuPoint]);
          const membership=workspace.sessionIds.join('\0');
          React.useEffect(()=>{alive.current=true;const ac=new AbortController();refresh(ac.signal);const timer=setInterval(()=>refresh(ac.signal),view==='cards'?3000:15000);const onFocus=()=>refresh(ac.signal);window.addEventListener('focus',onFocus);return()=>{alive.current=false;sequence.current++;ac.abort();clearInterval(timer);window.removeEventListener('focus',onFocus);};},[refresh,membership,view]);
          async function change(payload){
            if(mutating.current)return false;
            mutating.current=true;sequence.current++;setBusy(true);setError('');
            try{const value=await rpc({workspaceId:wid,...payload});if(alive.current){setData(value);setEditor(null);setMenu(null);}return true;}
            catch(e){if(alive.current)setError(String(e.message||e));return false;}
            finally{mutating.current=false;if(alive.current)setBusy(false);}
          }
          async function changeArchive(sessionId,restore){
            if(mutating.current||!workspace.sessionIds.includes(sessionId))return false;
            mutating.current=true;sequence.current++;setBusy(true);setArchiveError('');
            try{
              if(restore)await ctx.uiWorkspace.unarchiveSession(sessionId);
              else await ctx.uiWorkspace.archiveSession(sessionId,{stopActivity:true});
              if(alive.current)setMenu(null);
              return true;
            }catch(e){if(alive.current)setArchiveError(String(e?.message||e));return false;}
            finally{mutating.current=false;if(alive.current)setBusy(false);}
          }
          function fold(){setFolded(v=>{const next=!v;try{const all=JSON.parse(localStorage.getItem(foldKey)||'{}');all[wid]=next;localStorage.setItem(foldKey,JSON.stringify(all));}catch{}return next;});}
          const categories=data?.categories||[], assignments=data?.assignments||{};
          const created=data?.createdAtBySession||{};
          const creationRank=id=>Number.isFinite(created[id])?created[id]:(data?.sessionIds.includes(id)?0:Number.MAX_SAFE_INTEGER);
          const chronological=[...workspace.sessionIds].sort((a,b)=>creationRank(b)-creationRank(a)||a.localeCompare(b));
          const ids=chronological.filter(id=>isMainSession(summary[id])&&(showArchived||!archived.has(id)));
          const filtered=ids.filter(id=>(summary[id]?.displayTitle||id).toLocaleLowerCase().includes(query));
          const save=name=>change(editor.kind==='renameSession'?{action:'renameSession',sessionId:editor.id,name}:editor.kind==='delete'?{action:'delete',categoryId:editor.id}:{action:editor.kind==='create'?'create':'rename',...(editor.id?{categoryId:editor.id}:{}),name});
          const [dropTarget,setDropTarget]=React.useState(null);
          React.useEffect(()=>{const clear=()=>setDropTarget(null);window.addEventListener('dragend',clear);window.addEventListener('drop',clear);return()=>{window.removeEventListener('dragend',clear);window.removeEventListener('drop',clear);};},[]);
          function dragOver(event,key){
            if(busy||draggedSession?.workspaceId!==wid)return;
            event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';
            const group=event.currentTarget,rect=group.getBoundingClientRect();
            const rows=[...group.querySelectorAll('.sc-row[data-session-id]')].filter(row=>row.dataset.sessionId!==draggedSession.sessionId);
            const boxes=rows.map(row=>({id:row.dataset.sessionId,...boxOf(row.getBoundingClientRect())}));
            const gridView=group.closest('.sc-browser')?.dataset.view==='cards';
            const target=gridView?gridDropTarget(boxes,event.clientX,event.clientY):listDropTarget(boxes,event.clientY);
            const heading=group.querySelector('.sc-heading')?.getBoundingClientRect();
            setDropTarget({key,beforeSessionId:target.beforeSessionId,grid:gridView,
              x:(target.x??rect.left+10)-rect.left+group.scrollLeft,
              y:(target.y??heading?.bottom??rect.top+32)-rect.top+group.scrollTop,
              height:target.height??40,empty:boxes.length===0});
          }
          function drop(event,key){event.preventDefault();event.stopPropagation();const target=dropTarget;setDropTarget(null);const source=draggedSession;endDrag();if(busy||source?.workspaceId!==wid||!workspace.sessionIds.includes(source.sessionId)||target?.key!==key)return;void change({action:'move',sessionId:source.sessionId,categoryId:key||null,beforeSessionId:target.beforeSessionId});}
          function row(id){
            const item=summary[id],title=item?.displayTitle||id,current=(item?.retainedBy?.mainView||0)>0,status=statuses.get(id),pending=status?.pendingInteraction,running=status?.running??item?.running===true,completed=!pending&&!running&&!current&&status?.completionUnread===true;
            return h('div',{key:id,className:'sc-tile'},h('div',{className:'sc-row','data-session-id':id,onContextMenu:e=>{e.preventDefault();e.stopPropagation();setMenuPoint({x:e.clientX,y:e.clientY});setMenu(id);},onKeyDown:e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();setMenuPoint({x:rect.left+24,y:rect.bottom});setMenu(id);}},'data-color':data?.sessionColors?.[id],style:{'--sc-label-color':labelColors[data?.sessionColors?.[id]]},draggable:!busy,onDragStart:e=>beginDrag(e,wid,id),onDragEnd:endDrag,'data-active':current,'data-running':running},h('button',{className:'sc-session',title,'aria-label':title,'aria-current':current?'page':undefined,onClick:()=>ctx.uiWorkspace.openSession(id)},h(SessionPreview,{preview:data?.previewsBySession?.[id],title,t}),h(SessionTitle,{title,createdAt:created[id],running,completed,current,pending,archived:archived.has(id),t})),h(StatusIndicator,{running,completed,current,pending,t}),pending&&h('span',{className:'sc-pending-label'},pendingLabel(pending,t)),completed&&h('span',{className:'sc-completed-label'},t('completed')),h('button',{title:t('actions'),'aria-label':t('actions')+': '+title,'aria-expanded':menu===id,onClick:e=>{const rect=e.currentTarget.getBoundingClientRect();setMenuPoint({x:rect.right-240,y:rect.bottom+4});setMenu(menu===id?null:id);}},h(Icon,{name:'more',size:16}))),
              menu===id&&h('div',{className:'sc-menu',ref:menuRef,style:menuPoint?{position:'fixed',left:menuPoint.x,top:menuPoint.y,zIndex:1000,width:240,maxWidth:'calc(100vw - 16px)',maxHeight:'calc(100vh - 16px)',overflowY:'auto',margin:0,boxShadow:'0 6px 24px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent)'}:undefined,onContextMenu:e=>e.preventDefault(),onKeyDown:e=>{if(e.key==='Escape'){setMenu(null);e.currentTarget.previousElementSibling?.querySelector('button[aria-expanded]')?.focus();}}},h('button',{type:'button',disabled:busy,onClick:()=>{setMenu(null);setEditor({kind:'renameSession',id,name:title});},style:{marginBottom:10}},t('renameSession')),h('label',{style:{paddingTop:8,borderTop:'1px solid var(--dsw-alias-border-l1)'}},t('color')),h('div',{className:'sc-palette',role:'group','aria-label':t('color')},[null,...Object.keys(labelColors)].map(color=>h('button',{key:color||'none',className:'sc-swatch',title:t(color||'none'),'aria-label':t(color||'none'),'aria-pressed':(data?.sessionColors?.[id]||null)===color,disabled:busy,onClick:()=>change({action:'color',sessionId:id,color})},color?h('span',{style:{'--sc-label-color':labelColors[color]},'aria-hidden':true}):h(Icon,{name:'close',size:16})))),h('label',null,t('move'),h('select',{'aria-label':t('move'),disabled:busy||!data,value:assignments[id]||'',onChange:e=>change({action:'move',sessionId:id,categoryId:e.target.value||null})},h('option',{value:''},t('unclassified')),categories.map(c=>h('option',{key:c.id,value:c.id},c.name)))),h('p',{className:'sc-muted'},t(archived.has(id)?'restoreHint':'archiveHint')),h('div',{className:'sc-form-actions'},h('button',{type:'button',disabled:busy,onClick:()=>changeArchive(id,archived.has(id))},t(archived.has(id)?'restoreSession':'archiveSession')),h('button',{type:'button',onClick:()=>setMenu(null)},t('cancel')))));
          }
          function group(category){
            const key=category?.id||'', saved=data?.manualGroupOrders?.[key||'unclassified']||(category?data?.sessionOrder:[])||[], groupIds=filtered.filter(id=>(assignments[id]||'')===key), members=[...groupIds.filter(id=>!saved.includes(id)),...saved.filter(id=>groupIds.includes(id))], collapsed=(category?category.collapsed:unclassifiedFolded)&&!query,limit=limits[key]||20;
            return h('section',{className:'sc-group',key:key||'unclassified','data-drop-target':dropTarget?.key===key,onDragOver:e=>dragOver(e,key),onDragLeave:e=>{if(!e.currentTarget.contains(e.relatedTarget))setDropTarget(null);},onDrop:e=>drop(e,key)},h('div',{className:'sc-heading sc-category-heading'},h('button',{className:'sc-label','aria-expanded':!collapsed,disabled:!!category&&busy,onClick:()=>category?change({action:'collapse',categoryId:key,collapsed:!category.collapsed}):toggleUnclassified()},h('span',{className:'sc-disclosure','aria-hidden':true},h(Icon,{name:collapsed?'chevron':'down',size:16})),h('span',{className:'sc-heading-text'},category?.name||t('unclassified'))),h('span',{className:'sc-count'},members.length),category&&h('button',{title:t('rename'),'aria-label':t('rename')+': '+category.name,onClick:()=>setEditor({kind:'rename',id:key,name:category.name})},h(Icon,{name:'edit',size:14})),category&&h('button',{title:t('remove'),'aria-label':t('remove')+': '+category.name,onClick:()=>setEditor({kind:'delete',id:key})},h(Icon,{name:'close',size:14}))),
              dropTarget?.key===key&&h('div',{className:dropTarget.grid?'sc-grid-insert'+(dropTarget.empty?' sc-grid-insert-empty':''):'sc-insert-line','aria-hidden':true,style:{'--sc-drop-y':dropTarget.y+'px','--sc-drop-x':dropTarget.x+'px','--sc-drop-height':dropTarget.height+'px'}}),!collapsed&&(members.length?h('div',{className:'sc-session-grid'},members.slice(0,limit).map(row)):h('p',{className:'sc-muted'},t('empty'))),!collapsed&&members.length>limit&&h('button',{onClick:()=>setLimits(v=>({...v,[key]:limit+50}))},t('more'),' (',members.length-limit,')'));
          }
          return h('section',{className:'sc-workspace','data-workspace-id':wid},h('div',{className:'sc-heading',draggable:true,onDragStart:e=>{if(e.target.closest('button')?.classList.contains('sc-label')===false){e.preventDefault();return;}onWorkspaceDragStart(e,wid);},onDragEnd:onWorkspaceDragEnd},h('button',{className:'sc-label',title:workspace.path,'aria-expanded':!folded,onClick:fold},h(Icon,{name:folded?'chevron':'down',size:14}),workspace.title),h('span',{className:'sc-count'},ids.length),h('button',{title:t('add'),'aria-label':t('add')+': '+workspace.title,disabled:!data,onClick:()=>{setFolded(false);setEditor({kind:'create'});}},h(Icon,{name:'plus',size:16})),h('button',{title:t('newSession'),'aria-label':t('newSession')+': '+workspace.title,onClick:()=>ctx.uiWorkspace.startSession(wid)},h(Icon,{name:'newSession',size:16}))),
            archiveError&&h('div',{className:'sc-error',role:'alert'},archiveError),
            error&&h('div',{className:'sc-error',role:'alert'},error,' ',h('button',{onClick:()=>refresh()},t('retry'))),
            (!folded||query)&&h(React.Fragment,null,editor&&h(Editor,{key:editor.kind+editor.id,editor,busy,t,onSave:save,onCancel:()=>setEditor(null)}),!data?h('p',{className:'sc-muted'},t('loading')):categories.map(group),data&&group(null)));
        }
        function Browser({wide,expandSidebar,useWorkspaces,useSessions,useSessionStatus,renderSlot,t}) {
          const snapshot=useWorkspaces(s=>s), list=useSessions(s=>s),statuses=useSessionStatus(s=>s);
          const [view,setView]=React.useState(()=>{try{return localStorage.getItem(viewKey)==='cards'?'cards':'list';}catch{return 'list';}});
          function selectView(value){setView(value);try{localStorage.setItem(viewKey,value);}catch{}}
          const zoomKey='dsh.session-categories.zoom.v1';
          const [zoom,setZoom]=React.useState(()=>{try{const value=Number(localStorage.getItem(zoomKey));return value>=.65&&value<=1.8?value:1;}catch{return 1;}});
          const browserRef=React.useRef(null);
          const updateZoom=React.useCallback(value=>{setZoom(previous=>{const next=Math.round(Math.max(.65,Math.min(1.8,typeof value==='function'?value(previous):value))*100)/100;try{localStorage.setItem(zoomKey,String(next));}catch{}return next;});},[]);
          React.useEffect(()=>{const element=browserRef.current;if(!element||view!=='cards')return;const wheel=event=>{if(!event.ctrlKey)return;event.preventDefault();event.stopPropagation();updateZoom(value=>value*Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.002));};element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);},[wide,view,updateZoom]);

          const [previews,setPreviews]=React.useState({});
          const onPreviews=React.useCallback(incoming=>{setPreviews(previous=>{let next=previous;for(const [id,preview]of Object.entries(incoming||{})){const old=previous[id];if(old?.src===preview?.src&&old?.version===preview?.version)continue;if(next===previous)next={...previous};if(preview?.src)next[id]=preview;else delete next[id];}return next;});},[]);
          const [query,setQuery]=React.useState(''),[showArchived,setArchived]=React.useState(false);
          const [addingWorkspace,setAddingWorkspace]=React.useState(false),[workspaceError,setWorkspaceError]=React.useState('');
          const addingRef=React.useRef(false);
          const [directoryOpen,setDirectoryOpen]=React.useState(false);
          const [directoryPath,setDirectoryPath]=React.useState('');
          function addWorkspace(){setWorkspaceError('');setDirectoryOpen(true);}
          async function adoptWorkspace(path){
            if(addingRef.current)return;
            addingRef.current=true;setAddingWorkspace(true);setWorkspaceError('');
            try{if(path){await ctx.workspaces.create({path});setDirectoryOpen(false);}}
            catch(error){setWorkspaceError(String(error.message||error));}
            finally{addingRef.current=false;setAddingWorkspace(false);}
          }
          const workspaceOrderKey='dsh.session-categories.workspace-order.v1';
          const [workspaceOrder,setWorkspaceOrder]=React.useState(()=>{try{const saved=JSON.parse(localStorage.getItem(workspaceOrderKey)||'[]');return Array.isArray(saved)?saved.filter(id=>typeof id==='string'):[];}catch{return[];}});
          const [workspaceDrop,setWorkspaceDrop]=React.useState(null);
          const workspaceDrag=React.useRef(null);
          const orderedWorkspaces=[...new Set([...workspaceOrder,...snapshot.items.map(w=>w.workspaceId)])].map(id=>snapshot.items.find(w=>w.workspaceId===id)).filter(Boolean);
          function workspaceDragEnd(){workspaceDrag.current=null;setWorkspaceDrop(null);}
          function workspaceDragStart(event,id){endDrag();workspaceDrag.current=id;event.stopPropagation();event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-dsh-workspace-order',id);}
          function workspaceDragOver(event){if(!workspaceDrag.current)return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';const root=event.currentTarget,rect=root.getBoundingClientRect(),rows=[...root.querySelectorAll('.sc-workspace[data-workspace-id]')].filter(row=>row.dataset.workspaceId!==workspaceDrag.current);const before=rows.find(row=>{const heading=row.firstElementChild.getBoundingClientRect();return event.clientY<heading.top+heading.height/2;});const last=rows.at(-1);setWorkspaceDrop({before:before?.dataset.workspaceId||null,y:(before?before.getBoundingClientRect().top:last?last.getBoundingClientRect().bottom:rect.top)-rect.top+root.scrollTop});}
          function workspaceDropAt(event){if(!workspaceDrag.current)return;event.preventDefault();event.stopPropagation();const source=workspaceDrag.current,target=workspaceDrop;workspaceDragEnd();if(!target)return;const ids=orderedWorkspaces.map(w=>w.workspaceId).filter(id=>id!==source);const index=target.before===null?ids.length:ids.indexOf(target.before);if(index<0)return;ids.splice(index,0,source);setWorkspaceOrder(ids);try{localStorage.setItem(workspaceOrderKey,JSON.stringify(ids));}catch{}}
          React.useEffect(()=>{window.addEventListener('dragend',workspaceDragEnd);return()=>window.removeEventListener('dragend',workspaceDragEnd);},[]);
          if(!wide)return h('div',{className:'sc-rail'},h('button',{onClick:expandSidebar,title:t('title'),'aria-label':t('title')},h(Icon,{name:'categories',size:18})));
          const archived=new Set(snapshot.archivedSessionIds),q=query.trim().toLocaleLowerCase();
          const isRunning=id=>statuses.get(id)?.running??list.byId[id]?.running===true;
          const running=list.ids.filter(id=>isMainSession(list.byId[id])&&(isRunning(id)||statuses.get(id)?.pendingInteraction));
          const completed=list.ids.filter(id=>isMainSession(list.byId[id])&&!isRunning(id)&&!(list.byId[id]?.retainedBy?.mainView>0)&&statuses.get(id)?.completionUnread===true);
          function statusRow(id,active){const item=list.byId[id],title=item.displayTitle||id,current=(item.retainedBy?.mainView||0)>0,pending=statuses.get(id)?.pendingInteraction;return h('div',{key:id,className:'sc-row','data-active':current,'data-running':active},h('button',{className:'sc-session',title,'aria-label':title,'aria-current':current?'page':undefined,onClick:()=>ctx.uiWorkspace.openSession(id)},h(SessionPreview,{preview:previews[id],title,t}),h(SessionTitle,{title,running:active,completed:!active,current,pending,archived:archived.has(id),t})),h(StatusIndicator,{running:active,completed:!active,current,pending,t}),pending&&h('span',{className:'sc-pending-label'},pendingLabel(pending,t)),!active&&!pending&&h('span',{className:'sc-completed-label'},t('completed')));}
          const runningSection=h('section',{className:'sc-running','aria-label':t('running')},h('div',{className:'sc-running-title'},t('running'),' (',running.length,')'),running.length?h('div',{className:'sc-session-grid'},running.map(id=>statusRow(id,true))):h('p',{className:'sc-muted'},t('noRunning')));
          const completedSection=completed.length>0&&h('section',{className:'sc-running','aria-label':t('unread')},h('div',{className:'sc-running-title',role:'status','aria-live':'polite'},t('completed'),' (',completed.length,')'),h('div',{className:'sc-session-grid'},completed.map(id=>statusRow(id,false))));
          return h('div',{className:'sc-browser',ref:browserRef,style:{'--sc-tile-width':Math.round(118*zoom)+'px','--sc-preview-height':Math.round(80*zoom)+'px'},'data-session-categories':true,'data-view':view},h('style',null,css+".sc-toggle{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;align-self:center;flex:0 0 28px;width:28px;height:28px;min-width:28px;min-height:28px;max-width:28px;max-height:28px;padding:0;margin:0;border:0;border-radius:7px;line-height:0;vertical-align:middle;overflow:hidden;outline:none;box-shadow:none;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer}.sc-toggle>svg,.sc-toggle>img{display:block;flex:none;width:18px;height:18px;max-width:18px;max-height:18px;object-fit:contain}.sc-toggle:hover,.sc-toggle[aria-expanded=true],.sc-toggle[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2)}.sc-toggle:focus,.sc-toggle:focus:not(:focus-visible){outline:none;box-shadow:none}.sc-toggle:focus-visible{outline:none;box-shadow:inset 0 0 0 2px #7c8cff}"),h('div',{className:'sc-top'},h('strong',null,t('title')),h('button',{onClick:addWorkspace,disabled:addingWorkspace,title:t('addWorkspace'),'aria-label':t('addWorkspace'),style:{display:'inline-flex',alignItems:'center',gap:'4px'}},h(Icon,{name:'plus',size:14}),t('addWorkspace')),h('button',{onClick:()=>setMode(false)},t('stock'))),directoryOpen&&h('form',{className:'sc-editor',onSubmit:e=>{e.preventDefault();if(directoryPath.trim())void adoptWorkspace(directoryPath.trim());}},h('label',null,t('addWorkspace'),h('input',{value:directoryPath,placeholder:'C:\\Projects\\example','aria-label':t('addWorkspace'),required:true,disabled:addingWorkspace,onChange:e=>setDirectoryPath(e.target.value)})),h('div',{className:'sc-form-actions'},h('button',{type:'button',disabled:addingWorkspace,onClick:()=>setDirectoryOpen(false)},t('cancel')),h('button',{type:'submit',disabled:addingWorkspace||!directoryPath.trim()},t('save')))),workspaceError&&h('div',{className:'sc-error',role:'alert'},workspaceError),h('input',{type:'search',value:query,placeholder:t('search'),'aria-label':t('search'),onChange:e=>setQuery(e.target.value)}),h('div',{className:'sc-view-toolbar'},h('label',{className:'sc-filter'},h('input',{type:'checkbox',checked:showArchived,onChange:e=>setArchived(e.target.checked)}),t('showArchived')),h('div',{className:'sc-view-switch',role:'group','aria-label':t('view')},['list','cards'].map(value=>h('button',{key:value,type:'button','aria-pressed':view===value,title:t(value==='list'?'listView':'cardView'),onClick:()=>selectView(value)},h(Icon,{name:value==='list'?'list':'cards',size:14}),t(value==='list'?'listView':'cardView'))))),view==='cards'&&h('label',{className:'sc-zoom',title:t('zoomHint')},t('zoom'),h('input',{type:'range',min:65,max:180,step:1,value:Math.round(zoom*100),'aria-label':t('zoom'),onChange:e=>updateZoom(Number(e.target.value)/100)}),h('output',null,Math.round(zoom*100)+'%')),h('div',{className:'sc-scroll',onDragOver:workspaceDragOver,onDrop:workspaceDropAt,onDragLeave:e=>{if(!e.currentTarget.contains(e.relatedTarget))setWorkspaceDrop(null);}},workspaceDrop&&h('div',{className:'sc-insert-line','aria-hidden':true,style:{'--sc-drop-y':workspaceDrop.y+'px'}}),runningSection,completedSection,snapshot.items.length?orderedWorkspaces.map(w=>h(Workspace,{key:w.workspaceId,workspace:w,summary:list.byId,statuses,archived,showArchived,query:q,t,view,onPreviews,onWorkspaceDragStart:workspaceDragStart,onWorkspaceDragEnd:workspaceDragEnd})):h('p',{className:'sc-muted'},t('noWorkspace'))));
        }
        // Reuse the live shell registration contract, never private imports or DOM rewriting.
        // Older/newer clients without this contract keep the existing section-only view.
        let nativeShell=null,rootDispose=null,reconcilingRoot=false,rootAvailable=false;
        const compactCss=`
.sc-shell{--dsh-sidebar-inline-padding:8px;--dsh-sidebar-row-padding:12px;--dsh-sidebar-label-gap:6px;--dsh-sidebar-paint-inset:3px;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;color:var(--dsw-alias-label-primary);font:inherit}
.sc-shell[data-caption=true]{padding-top:40px}.sc-shell *{box-sizing:border-box}.sc-shell-head{display:flex;align-items:center;gap:6px;padding:10px 12px;flex:none;border-bottom:1px solid var(--dsw-alias-border-l1)}
.sc-shell-head button,.sc-shell summary{font:inherit;color:inherit;cursor:pointer;border:0;border-radius:6px;background:transparent;padding:6px;list-style:none}.sc-shell summary::-webkit-details-marker{display:none}.sc-shell-head button:hover,.sc-shell summary:hover{background:var(--dsw-alias-bg-layer-2)}.sc-shell :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.sc-shell-brand{display:flex;align-items:center;gap:7px;min-width:0;flex:1;overflow:hidden;white-space:nowrap}.sc-shell-brand>span{overflow:hidden;text-overflow:ellipsis}.sc-shell-new{display:inline-flex;align-items:center;gap:4px;font-size:12px!important;white-space:nowrap}.sc-shell-more{position:relative}.sc-shell-more summary{display:flex;align-items:center;justify-content:center;width:30px;height:30px}
.sc-shell-menu{position:absolute;right:0;top:calc(100% + 5px);z-index:50;width:240px;max-width:calc(100vw - 24px);max-height:65vh;overflow:auto;padding:6px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;box-shadow:0 8px 24px #0003}.sc-shell-menu>button{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:8px}.sc-shell-menu>button[aria-current=page]{background:var(--dsw-alias-bg-layer-2)}
.sc-shell-content{display:flex;flex:1;min-height:0;overflow:hidden}.sc-shell-content>.sc-browser{min-width:0}.sc-shell-foot{display:flex;flex-direction:column;flex:none;padding:8px 8px 8px;border-top:1px solid var(--dsw-alias-border-l1)}.sc-shell-actions{display:flex;align-items:center;flex-wrap:wrap;flex:none;min-width:0;width:100%;gap:4px;padding:4px 0}.sc-shell-foot{isolation:isolate;background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-layer-1))}
`;
        function CompactRoot(props){
          if(props.collapsed||props.drawer)return h(nativeShell.component,props);
          return h(CompactExpanded,props);
        }
        function CompactExpanded(props){
          const {renderSlot,renderFactorySlot,t,startSession,toggleSidebar,selectPanel,usePanels,usePanelInfo,useRemoteAccess}=props;
          const panels=usePanels(s=>s),unpinned=props.useEntryPins(s=>s),active=usePanelInfo(s=>s.activePanelId),canStart=useRemoteAccess('session/create');
          const details=React.useRef(null),summary=React.useRef(null);
          const close=()=>{if(details.current)details.current.open=false;};
          React.useEffect(()=>{
            const outside=e=>{if(details.current&&!details.current.contains(e.target))close();};
            const escape=e=>{if(e.key==='Escape'&&details.current?.open){e.stopPropagation();close();summary.current?.focus();}};
            window.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);
            return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape);};
          },[]);
          const sectionContext=React.useMemo(()=>{const scroller={bindScrollerRef:()=>{}};return{useSectionScroller:()=>scroller};},[]);
          const label=key=>ctx.locale.bind(ns)(key);
          return h('aside',{className:'sc-shell','data-caption':document.documentElement.hasAttribute('data-windows-titlebar'),'data-session-categories-shell':true},h('style',null,compactCss),
            h('header',{className:'sc-shell-head'},h('button',{title:t('toggle.collapse'),'aria-label':t('toggle.collapse'),onClick:toggleSidebar},h(Icon,{name:'list',size:17})),
              h('div',{className:'sc-shell-brand'},renderSlot('sidebar.brand.mark',{size:20},{fallback:h(Icon,{size:20})}),h('span',null,renderSlot('sidebar.brand.name',{},{fallback:'Harness'}))),
              canStart&&renderSlot('sidebar.session.action',{wide:true},{children:h('button',{className:'sc-shell-new',title:label('newSession'),'aria-label':label('newSession'),onClick:()=>startSession()},h(Icon,{name:'plus',size:16}),label('newSession'))}),
              h('details',{className:'sc-shell-more',ref:details},h('summary',{ref:summary,title:label('navigation'),'aria-label':label('navigation')},h(Icon,{name:'more',size:18})),
                h('nav',{className:'sc-shell-menu','aria-label':label('navigation')},panels.map(panel=>h('button',{key:panel.id,type:'button','aria-current':active===panel.id?'page':undefined,onClick:()=>{close();selectPanel(panel.id);}},renderFactorySlot('sidebar.panel.icon',{id:panel.id,size:16,active:active===panel.id}),panel.label)),h('button',{type:'button',onClick:()=>{close();setMode(false);}},label('stock'))))),
            h('div',{className:'sc-shell-content'},renderSlot('sidebar.workspaces',{wide:true,expandSidebar:()=>{}},{hookContext:sectionContext})),
            h('footer',{className:'sc-shell-foot'},h('div',{className:'sc-shell-actions'},renderSlot('sidebar.footer.action',{wide:true})),renderSlot('sidebar.settings',{wide:true})));
        }
        function synchronizeRoot(){
          if(reconcilingRoot)return;
          reconcilingRoot=true;
          try{
            if(!enabled||!rootAvailable){if(rootDispose){const dispose=rootDispose;rootDispose=null;dispose();}return;}
            const candidates=ctx.slots.entriesOfSlot('sidebar').filter(entry=>entry.component!==CompactRoot&&entry.children?.['sidebar.workspaces']&&entry.inject);
            if(rootDispose&&candidates.length===1&&candidates[0]===nativeShell)return;
            if(rootDispose){const dispose=rootDispose;rootDispose=null;dispose();}
            if(candidates.length!==1)return;
            nativeShell=candidates[0];
            try{rootDispose=ctx.slots.register({name:'sidebar',priority:-20,children:nativeShell.children,inject:nativeShell.inject,locale:nativeShell.locale},CompactRoot);}
            catch(error){console.warn('[session-categories] Compact sidebar unavailable; keeping native shell.',error);}
          }finally{reconcilingRoot=false;}
        }
        let browserDispose=null,available=false;
        function synchronize(){
          if(!available)return;
          if(enabled&&!browserDispose)browserDispose=ctx.slots.register({name:'sidebar.workspaces',priority:-10,locale:ns},Browser);
          if(!enabled&&browserDispose){browserDispose();browserDispose=null;}
        }
        function setMode(value){enabled=value;synchronizeRoot();synchronize();listeners.forEach(fn=>fn());}
        function Toggle({t}){const value=React.useSyncExternalStore(mode.subscribe,mode.getSnapshot,mode.getSnapshot);return h(React.Fragment,null,h('style',null,css+".sc-toggle{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;align-self:center;flex:0 0 28px;width:28px;height:28px;min-width:28px;min-height:28px;max-width:28px;max-height:28px;padding:0;margin:0;border:0;border-radius:7px;line-height:0;vertical-align:middle;overflow:hidden;outline:none;box-shadow:none;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer}.sc-toggle>svg,.sc-toggle>img{display:block;flex:none;width:18px;height:18px;max-width:18px;max-height:18px;object-fit:contain}.sc-toggle:hover,.sc-toggle[aria-expanded=true],.sc-toggle[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2)}.sc-toggle:focus,.sc-toggle:focus:not(:focus-visible){outline:none;box-shadow:none}.sc-toggle:focus-visible{outline:none;box-shadow:inset 0 0 0 2px #7c8cff}"),h('button',{className:'sc-toggle',title:t('switch'),'aria-label':t('switch'),'aria-pressed':value,onClick:()=>setMode(!value)},h(Icon,{name:'categories',size:16})));}
        ctx.slots.inject('sidebar.workspaces',()=>{available=true;synchronize();return()=>{available=false;if(browserDispose){browserDispose();browserDispose=null;}};});
        ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'local-session-categories-toggle',order:80,label:()=>ctx.locale.bind(ns)('title'),locale:ns},Toggle));
        ctx.effect(()=>ctx.slots.subscribe('sidebar',synchronizeRoot));
        ctx.slots.inject('sidebar',()=>{rootAvailable=true;synchronizeRoot();return()=>{rootAvailable=false;if(rootDispose){const dispose=rootDispose;rootDispose=null;dispose();}nativeShell=null;};});
      }
    };
  }
});
