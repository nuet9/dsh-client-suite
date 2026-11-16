window.__ModuleLoader__.load({
  id:'@local/interactive-chart',
  factory(require){
    const React=require('react'),h=React.createElement,ns='interactive-chart';
    const dictionaries={en:{title:'Chart',type:'Chart type',line:'Line',bar:'Bar',table:'Show data table',series:'Visible series',empty:'No numeric data in visible series',unavailable:'Recorded chart unavailable',preparing:'Preparing',running:'Running',failed:'Failed',inspect:'Inspect tool call',all:'Values',rows:'rows',category:'Categorical x axis; row order is preserved.'},zh:{title:'交互图表',type:'图表类型',line:'折线图',bar:'柱状图',table:'显示数据表',series:'可见系列',empty:'可见系列中没有数值数据',unavailable:'记录图表不可用',preparing:'准备中',running:'运行中',failed:'失败',inspect:'查看工具调用',all:'数值',rows:'行',category:'X轴按类别显示，保留数据行顺序。'}};
    const text=v=>v==null?'':String(v),key=v=>JSON.stringify(v);
    function recorded(block){
      const d=block.isError?null:block.meta?.interactiveChart;
      if(!d||d.version!==1||typeof d.title!=='string'||typeof d.x!=='string'||typeof d.y!=='string'||d.series!==undefined&&typeof d.series!=='string'||!Array.isArray(d.rows)||d.rows.length>500)return null;
      const keys=[d.x,d.y,...(d.series===undefined?[]:[d.series])];
      if(new Set(keys).size!==keys.length||!d.rows.every(r=>r&&typeof r==='object'&&!Array.isArray(r)&&keys.every(k=>r[k]==null||(k===d.y?typeof r[k]==='number'&&Number.isFinite(r[k]):typeof r[k]==='string'||typeof r[k]==='number'&&Number.isFinite(r[k])))))return null;
      if(d.series!==undefined&&new Set(d.rows.map(r=>key(r[d.series]))).size>12)return null;
      return d;
    }
    const css='.ic{color:var(--dsw-alias-label-primary);font:inherit;min-width:0;padding:8px 0}.ic header,.ic-controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.ic h4{margin:0;font-size:14px;overflow-wrap:anywhere}.ic-controls{margin:10px 0}.ic label{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:100%;overflow-wrap:anywhere}.ic input{flex-shrink:0}.ic select{color:inherit;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);padding:4px;border-radius:4px;font:inherit}.ic fieldset{border:1px solid var(--dsw-alias-border-l1);margin:8px 0;padding:6px 10px;display:flex;gap:12px;flex-wrap:wrap;min-width:0}.ic legend,.ic-note{font-size:12px;color:var(--dsw-alias-label-secondary)}.ic svg{display:block;width:100%;height:auto;aspect-ratio:720/360;overflow:visible}.ic svg text{fill:var(--dsw-alias-label-secondary);font-size:11px}.ic-scroll{max-height:320px;overflow:auto;max-width:100%}.ic table{border-collapse:collapse;width:100%;font-size:12px}.ic td,.ic th{text-align:left;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);overflow-wrap:anywhere;max-width:260px}.ic button{color:inherit;background:transparent;border:0;font:inherit;cursor:pointer}.ic :focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:2px}.ic pre{white-space:pre-wrap;overflow-wrap:anywhere}';
    function Chart({data:d,t}){
      const [type,setType]=React.useState('line'),[hidden,setHidden]=React.useState([]),[table,setTable]=React.useState(false);
      const groups=React.useMemo(()=>{const m=new Map();d.rows.forEach((r,i)=>{const k=d.series===undefined?'all':key(r[d.series]);if(!m.has(k))m.set(k,{key:k,label:d.series===undefined?t('all'):text(r[d.series]),points:[]});m.get(k).points.push({r,i});});return [...m.values()];},[d,t]);
      const visible=groups.filter(g=>!hidden.includes(g.key)),points=visible.flatMap(g=>g.points).filter(p=>typeof p.r[d.y]==='number');
      // Divide first to avoid overflow for opposite-sign values near Number.MAX_VALUE.
      const magnitude=Math.max(1,...points.map(p=>Math.abs(p.r[d.y]))),lo=Math.min(0,...points.map(p=>p.r[d.y]/magnitude)),rawHi=Math.max(0,...points.map(p=>p.r[d.y]/magnitude)),hi=rawHi===lo?lo+1:rawHi,span=hi-lo;
      const Y=v=>300-(v/magnitude-lo)/span*260;
      const X=i=>60+(i+0.5)/Math.max(1,d.rows.length)*640;
      const baseline=Y(0),dash=['','7 4','2 3','10 3 2 3'];
      const nodes=[];
      for(let j=0;j<=4;j++){const y=40+j*65,value=(hi-j/4*span)*magnitude;nodes.push(h('g',{key:'tick'+j},h('line',{x1:60,x2:700,y1:y,y2:y,stroke:'var(--dsw-alias-border-l1)'}),h('text',{x:54,y:y+4,textAnchor:'end'},Number(value.toPrecision(4)).toString())));}
      nodes.push(h('line',{key:'zero',x1:60,x2:700,y1:baseline,y2:baseline,stroke:'var(--dsw-alias-label-secondary)'}));
      visible.forEach((g,gi)=>{let segment=[];const segments=[];g.points.forEach(p=>{if(typeof p.r[d.y]==='number')segment.push(p);else{if(segment.length)segments.push(segment);segment=[];}});if(segment.length)segments.push(segment);
        if(type==='line')segments.forEach((s,si)=>nodes.push(h('polyline',{key:g.key+'l'+si,points:s.map(p=>`${X(p.i)},${Y(p.r[d.y])}`).join(' '),fill:'none',stroke:'var(--dsw-alias-label-primary)',strokeWidth:2,strokeDasharray:dash[gi%4]})));
        g.points.filter(p=>typeof p.r[d.y]==='number').forEach(p=>{const label=`${g.label}: ${text(p.r[d.x])}, ${p.r[d.y]}`,width=Math.max(0.2,Math.min(40,640/Math.max(1,d.rows.length)*0.72));nodes.push(type==='bar'?h('rect',{key:g.key+'p'+p.i,x:X(p.i)-width/2,y:Math.min(baseline,Y(p.r[d.y])),width,height:Math.abs(baseline-Y(p.r[d.y])),fill:'var(--dsw-alias-label-primary)',opacity:1-gi%4*0.18},h('title',null,label)):h('circle',{key:g.key+'p'+p.i,cx:X(p.i),cy:Y(p.r[d.y]),r:3,fill:'var(--dsw-alias-bg-base)',stroke:'var(--dsw-alias-label-primary)'},h('title',null,label)));});
      });
      d.rows.forEach((r,i)=>{if(i%Math.max(1,Math.ceil(d.rows.length/8))===0)nodes.push(h('text',{key:'x'+i,x:X(i),y:320,textAnchor:'middle'},text(r[d.x]).slice(0,16)));});
      const cols=[d.x,d.y,...(d.series===undefined?[]:[d.series])];
      return h(React.Fragment,null,
        h('div',{className:'ic-controls'},h('label',null,t('type'),h('select',{value:type,onChange:e=>setType(e.target.value)},h('option',{value:'line'},t('line')),h('option',{value:'bar'},t('bar')))),h('label',null,h('input',{type:'checkbox',checked:table,onChange:e=>setTable(e.target.checked)}),t('table')),h('span',{className:'ic-note'},d.rows.length,' ',t('rows'))),
        d.series!==undefined&&h('fieldset',null,h('legend',null,t('series')),groups.map((g,i)=>h('label',{key:g.key},h('input',{type:'checkbox',checked:!hidden.includes(g.key),onChange:e=>setHidden(old=>e.target.checked?old.filter(k=>k!==g.key):[...old,g.key])}),`${i+1}. ${g.label||'∅'}`))),
        h('p',{className:'ic-note'},t('category')),
        points.length?h('svg',{viewBox:'0 0 720 360',role:'img','aria-label':`${d.title}: ${d.x}, ${d.y}`},h('title',null,d.title),...nodes,h('text',{x:380,y:350,textAnchor:'middle'},d.x),h('text',{x:60,y:20},d.y)):h('p',{role:'status'},t('empty')),
        table&&h('div',{className:'ic-scroll',tabIndex:0,role:'region','aria-label':d.title},h('table',null,h('caption',null,d.title),h('thead',null,h('tr',null,cols.map(k=>h('th',{key:k,scope:'col'},k)))),h('tbody',null,visible.flatMap(g=>g.points).sort((a,b)=>a.i-b.i).map(p=>h('tr',{key:p.i},cols.map(k=>h('td',{key:k},text(p.r[k])))))))));
    }
    function View({block,phase,t,inspect}){const d=phase==='result'?recorded(block):null;return h('section',{className:'ic','data-interactive-chart':true},h('style',null,css),h('header',null,h('h4',null,d?.title??t('title')),inspect&&h('button',{type:'button',onClick:inspect,'aria-label':t('inspect')},'⋯')),d?h(Chart,{key:block.callId,data:d,t}):h('p',{role:'status'},t(phase==='preparing'?'preparing':phase==='start'?'running':block.isError?'failed':'unavailable')),phase==='result'&&block.isError&&h('pre',null,(block.content??[]).filter(c=>c.type==='text').map(c=>c.text).join('\n')));}
    return {inject:['slots','locale'],apply(ctx){ctx.effect(()=>ctx.locale.register(ns,dictionaries));ctx.slots.inject('tool.call.toolview',()=>ctx.slots.register({name:'tool.call.toolview',key:'interactive_chart',locale:ns},View));}};
  }
});
