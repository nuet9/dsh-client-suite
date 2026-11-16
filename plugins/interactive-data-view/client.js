window.__ModuleLoader__.load({
  id: '@local/interactive-data-view',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const ns = 'interactive-data-view';
    const dictionaries = {
      en: {title:'Data view', preparing:'Preparing', running:'Running', failed:'Failed', unavailable:'Recorded data unavailable', filter:'Filter rows', bars:'Show bars', empty:'No matching rows', count:'{shown} / {total} rows', inspect:'Inspect tool call', magnitude:'Magnitude', ascending:'Sort ascending', descending:'Sort descending'},
      zh: {title:'\u6570\u636e\u89c6\u56fe', preparing:'\u51c6\u5907\u4e2d', running:'\u8fd0\u884c\u4e2d', failed:'\u5931\u8d25', unavailable:'\u8bb0\u5f55\u6570\u636e\u4e0d\u53ef\u7528', filter:'\u7b5b\u9009\u884c', bars:'\u663e\u793a\u6761\u5f62\u56fe', empty:'\u65e0\u5339\u914d\u884c', count:'{shown} / {total} \u884c', inspect:'\u67e5\u770b\u5de5\u5177\u8c03\u7528', magnitude:'\u7edd\u5bf9\u503c', ascending:'\u5347\u5e8f\u6392\u5217', descending:'\u964d\u5e8f\u6392\u5217'}
    };
    const text = value => value === null || value === undefined ? '' : String(value);
    function recorded(block) {
      if (block.isError) return null;
      const data = block.meta?.interactiveView;
      if (!data || data.version !== 1 || typeof data.title !== 'string' || !Array.isArray(data.columns) || data.columns.length < 1 || data.columns.length > 24 || !data.columns.every(key => typeof key === 'string') || !Array.isArray(data.rows) || data.rows.length > 500) return null;
      if (!data.rows.every(row => row && typeof row === 'object' && !Array.isArray(row) && data.columns.every(key => row[key] == null || ['string','boolean'].includes(typeof row[key]) || typeof row[key] === 'number' && Number.isFinite(row[key])))) return null;
      if (data.numericField !== undefined && (!data.columns.includes(data.numericField) || !data.rows.every(row => row[data.numericField] == null || typeof row[data.numericField] === 'number' && Number.isFinite(row[data.numericField])))) return null;
      return data;
    }
    const css = `.idv{color:var(--dsw-alias-label-primary);font:inherit;min-width:0;padding:8px 0;letter-spacing:0}.idv header{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.idv h4{font-size:14px;margin:0;overflow-wrap:anywhere}.idv-controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:8px 0}.idv input[type=search]{width:240px;max-width:100%;background:var(--dsw-alias-bg-base);color:inherit;border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:5px 8px;font:inherit}.idv label{display:flex;align-items:center;gap:5px}.idv-scroll{max-height:380px;overflow:auto;max-width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:4px}.idv table{border-collapse:collapse;width:100%;font-size:12px}.idv th,.idv td{padding:6px 9px;text-align:left;border-bottom:1px solid var(--dsw-alias-border-l1);max-width:320px;overflow-wrap:anywhere}.idv th{position:sticky;top:0;background:var(--dsw-alias-bg-base);z-index:1}.idv button{font:inherit;color:inherit;background:transparent;border:0;padding:2px;cursor:pointer}.idv button:focus-visible,.idv input:focus-visible,.idv-scroll:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:2px}.idv-count{font-size:12px;color:var(--dsw-alias-label-secondary)}.idv-bar{display:block;height:6px;background:var(--dsw-alias-label-secondary);max-width:100%;margin-top:4px}.idv-error{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}`;
    function Table({data,t}) {
      const [query,setQuery] = React.useState('');
      const [sort,setSort] = React.useState(null);
      const [bars,setBars] = React.useState(false);
      const rows = React.useMemo(() => {
        const needle = query.toLocaleLowerCase();
        const selected = data.rows.map((row,index) => ({row,index})).filter(({row}) => data.columns.some(key => text(row[key]).toLocaleLowerCase().includes(needle)));
        if (sort) selected.sort((a,b) => {
          const x = a.row[sort.key], y = b.row[sort.key];
          const order = x == null ? (y == null ? 0 : 1) : y == null ? -1 : typeof x === 'number' && typeof y === 'number' ? (x < y ? -1 : x > y ? 1 : 0) : text(x).localeCompare(text(y));
          return order * sort.direction || a.index - b.index;
        });
        return selected;
      },[data,query,sort]);
      const maximum = Math.max(0,...rows.map(({row}) => Math.abs(row[data.numericField] ?? 0)));
      return h(React.Fragment,null,
        h('div',{className:'idv-controls'},h('input',{type:'search',value:query,onChange:event=>setQuery(event.target.value),'aria-label':t('filter'),placeholder:t('filter')}),
          data.numericField && h('label',null,h('input',{type:'checkbox',checked:bars,onChange:event=>setBars(event.target.checked)}),t('bars')),
          h('span',{className:'idv-count','aria-live':'polite'},t('count',{shown:rows.length,total:data.rows.length}))),
        h('div',{className:'idv-scroll',tabIndex:0,role:'region','aria-label':data.title},h('table',null,
          h('caption',{style:{textAlign:'left',padding:'6px 9px'}},data.title),
          h('thead',null,h('tr',null,data.columns.map(key=>h('th',{key,scope:'col','aria-sort':sort?.key===key?(sort.direction===1?'ascending':'descending'):'none'},h('button',{type:'button',onClick:()=>setSort({key,direction:sort?.key===key?-sort.direction:1}),title:t(sort?.key===key&&sort.direction===1?'descending':'ascending')},key,' ',sort?.key===key?(sort.direction===1?'\u2191':'\u2193'):'\u2195'))))),
          h('tbody',null,rows.length===0?h('tr',null,h('td',{colSpan:data.columns.length},t('empty'))):rows.map(({row,index})=>h('tr',{key:index},data.columns.map(key=>h('td',{key},text(row[key]),bars&&key===data.numericField&&typeof row[key]==='number'&&h('span',{className:'idv-bar',title:`${t('magnitude')}: ${Math.abs(row[key])}`,style:{width:`${maximum ? Math.abs(row[key])/maximum*100 : 0}%`},'aria-hidden':true})))))))));
    }
    function View({block,phase,t,inspect}) {
      const data = phase === 'result' ? recorded(block) : null;
      const errors = phase === 'result' && block.isError ? (block.content ?? []).filter(item=>item.type==='text').map(item=>item.text).join('\n') : '';
      return h('section',{className:'idv','data-interactive-view':true},h('style',null,css),
        h('header',null,h('h4',null,data?.title ?? t('title')),!data&&h('span',{role:'status'},t(phase==='preparing'?'preparing':phase==='start'?'running':block.isError?'failed':'unavailable')),
          inspect&&h('button',{type:'button',onClick:inspect,title:t('inspect'),'aria-label':t('inspect')},'\u22ef')),
        errors&&h('pre',{className:'idv-error'},errors),
        data&&h(Table,{key:block.callId,data,t}));
    }
    return {
      inject:['slots','locale'],
      apply(ctx) {
        ctx.effect(()=>ctx.locale.register(ns,dictionaries));
        ctx.slots.inject('tool.call.toolview',()=>ctx.slots.register({name:'tool.call.toolview',key:'interactive_view',locale:ns},View));
      }
    };
  }
});
