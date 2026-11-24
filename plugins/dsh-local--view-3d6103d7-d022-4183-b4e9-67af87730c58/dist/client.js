window.__ModuleLoader__.load({
  id: "@dsh-local/view-3d6103d7-d022-4183-b4e9-67af87730c58",
  factory(require) {
    const React = require('react');
    const { createElement: h, useEffect, useMemo, useRef, useState, useSyncExternalStore } = React;
    const panelId = "@dsh-local/view-3d6103d7-d022-4183-b4e9-67af87730c58:skills";
    const endpoint = 'personalizedSkills3d6103d7/get';
    const css = ".dsh-personalized-skills {\n  box-sizing: border-box;\n  height: 100%;\n  min-height: 0;\n  overflow: auto;\n  background: var(--dsw-alias-bg-base);\n  color: var(--dsw-alias-label-primary);\n}\n\n.dsh-personalized-skills .skills-inner {\n  width: min(100%, 1100px);\n  margin-inline: auto;\n  box-sizing: border-box;\n  padding: calc(clamp(24px, 4vw, 52px) + var(--dsh-frame-top-clearance, 0px)) clamp(18px, 4vw, 50px) 48px;\n}\n\n.dsh-personalized-skills .skills-header,\n.dsh-personalized-skills .skills-search-row {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 14px;\n  flex-wrap: wrap;\n}\n\n.dsh-personalized-skills h1 {\n  margin: 0;\n  font-size: clamp(24px, 3vw, 34px);\n  line-height: 1.25;\n  overflow-wrap: anywhere;\n}\n\n.dsh-personalized-skills h2 {\n  margin: 24px 0 10px;\n  font-size: 15px;\n}\n\n.dsh-personalized-skills .skills-search-row { margin: 22px 0 18px; }\n.dsh-personalized-skills .skills-count { color: var(--dsw-alias-label-secondary); font-size: 13px; }\n\n.dsh-personalized-skills .skills-search {\n  flex: 1 1 280px;\n  max-width: 440px;\n  display: flex;\n  gap: 9px;\n  padding: 0 12px;\n  align-items: center;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: var(--dsw-radius-xl);\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-base);\n}\n\n.dsh-personalized-skills .skills-search svg { flex-shrink: 0; }\n.dsh-personalized-skills .skills-search input {\n  min-width: 0;\n  width: 100%;\n  padding: 10px 0;\n  background: transparent;\n  border: 0;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  outline: none;\n}\n\n.dsh-personalized-skills .skills-search input::placeholder { color: var(--dsw-alias-label-secondary); }\n.dsh-personalized-skills .skills-search:focus-within,\n.dsh-personalized-skills button:focus-visible {\n  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));\n  outline-offset: 2px;\n}\n\n.dsh-personalized-skills .skills-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(min(100%, 272px), 1fr));\n  gap: 12px;\n  list-style: none;\n  padding: 0;\n  margin: 0;\n}\n\n.dsh-personalized-skills .skills-grid li { min-width: 0; }\n.dsh-personalized-skills .skills-card,\n.dsh-personalized-skills .skills-control {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: var(--dsw-radius-xl);\n  background: var(--dsw-alias-bg-base);\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  cursor: pointer;\n}\n\n.dsh-personalized-skills .skills-card:hover,\n.dsh-personalized-skills .skills-control:hover {\n  border-color: var(--dsw-alias-state-business-primary);\n  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 4%, var(--dsw-alias-bg-base));\n}\n\n.dsh-personalized-skills .skills-control { padding: 7px 12px; }\n.dsh-personalized-skills .skills-back { margin-bottom: 18px; }\n.dsh-personalized-skills .skills-card {\n  width: 100%;\n  height: 100%;\n  box-sizing: border-box;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  text-align: start;\n  padding: 14px;\n  overflow-wrap: anywhere;\n}\n\n.dsh-personalized-skills .skills-card-title { display: flex; align-items: start; gap: 8px; }\n.dsh-personalized-skills .skills-card-title code { font-size: 13px; font-weight: 600; line-height: 18px; }\n.dsh-personalized-skills .skills-card-title svg { flex: 0 0 auto; color: var(--dsw-alias-state-business-primary); }\n.dsh-personalized-skills .skills-card-arrow { margin-inline-start: auto; line-height: 1; font-size: 19px; }\n.dsh-personalized-skills .skills-card-copy { font-size: 13px; line-height: 1.55; color: var(--dsw-alias-label-secondary); }\n.dsh-personalized-skills .skills-term { display: block; color: var(--dsw-alias-label-primary); font-size: 12px; margin-bottom: 2px; }\n.dsh-personalized-skills .skills-empty { margin-top: 24px; color: var(--dsw-alias-label-secondary); }\n.dsh-personalized-skills .skills-original {\n  margin: 0;\n  padding: clamp(14px, 2vw, 24px);\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: var(--dsw-radius-xl);\n  color: var(--dsw-alias-label-primary);\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  font-size: 13px;\n  line-height: 1.65;\n  tab-size: 2;\n}\n";
    const translations = {"diagnose-windows-sandbox-acl":{"source":"Use on Windows for unexpected DSH sandbox access denials: workspace writes or listing fail, or an ordinarily readable path cannot be read. One bundled command inspects the path and every ancestor and repairs the ACL problems it proves in that same run. Expected confinement denials need no ACL repair.","purpose":"检查 Windows 路径及其上级目录的访问控制列表，并修复已证实的权限异常。","scenario":"工作区意外无法写入或列出文件，或通常可读的路径突然无法读取时。"},"dsh-badge":{"source":"Add the official “powered by dsh” badge to documents, pull requests, merge requests, and other content produced with DeepSeek Harness. Use whenever creating a pull request or merge request. Also use when the user asks for a dsh badge, powered-by-dsh attribution, or a reusable dsh badge asset or snippet.","purpose":"给 DeepSeek Harness 生成的内容添加官方 powered by dsh 标记。","scenario":"创建 PR 或合并请求，或需要在文档中标注来源、复用徽章资源时。"},"dsh-doc":{"source":"Use when a task needs facts about DeepSeek Harness (DSH) itself, such as how a feature, setting, plugin, agent preset, tool, or Cordis API of the running installation works; when the user asks to design, review, build, install, enable, or debug a DSH plugin, bundle, MCP connection, agent preset, plugin icon or detail page, or a DSH tool definition or skill; and when upgrading a plugin or profile to a newer DSH release. Loading it grants no permission to change files or the profile.","purpose":"查阅当前 Harness 安装版本的功能、设置、插件、智能体预设、工具及 Cordis API 文档。","scenario":"设计、评审、构建或排查 DSH 组件，以及升级插件或配置时。"},"office":{"source":"Create or edit Office files; inspect Office files and PDFs. Load before rendering, conversion, or recalculation to enable office_render, office_convert, and office_recalculate next step.","purpose":"创建、编辑和检查 Office 文件，并检查 PDF。","scenario":"需要渲染、转换或重新计算 Office 文件时。"},"office-docx":{"source":"Create, read, edit, and validate Word documents (.docx).","purpose":"创建、阅读、编辑和验证 Word 文档。","scenario":"处理 .docx 格式的文档时。"},"office-pptx":{"source":"Create, read, edit, and validate PowerPoint presentations (.pptx).","purpose":"创建、阅读、编辑和验证 PowerPoint 演示文稿。","scenario":"处理 .pptx 格式的演示文稿时。"},"office-xlsx":{"source":"Create, read, edit, and validate Excel workbooks, data, and formulas (.xlsx).","purpose":"创建、阅读、编辑和验证 Excel 工作簿、数据及公式。","scenario":"处理 .xlsx 格式的表格、数据和计算公式时。"},"official-plugins":{"source":"Check DSH’s optional plugins when the user asks how to do or use something in this app, whether it can, or says a capability is missing or should change: tools, input, thinking or title display, session search, terminals, worktrees, agent teams, desktop control, automation, access, approvals, badges or signatures, plugins or plugin sources. Not a request to develop DSH, even in its own repository: load before reading files or source. Not for ordinary tasks, quoted wishes or declined offers.","purpose":"查找 Harness 自带的可选插件，确认应用中的功能由哪些插件提供。","scenario":"询问会话搜索、终端、工具、输入、审批或其他 Harness 功能如何使用、是否可用时。"},"personalized-pages":{"source":"Plan an optional page or small tool when the user asks for a page, tab, panel, tool or interface in this app (even for one-off use), wants something to keep, revisit or update later, will keep changing data in your answer, or wants a live view of this app’s own data (Sessions, tasks, logs, workspace). Load this before reading any files or source; it says how to submit the proposal. Not for requested files or code, ordinary answers, existing-feature questions, quoted wishes or declined offers.","purpose":"规划 Harness 内的个性化页面、标签页、侧栏面板或小工具，并提交创建提案。","scenario":"需要可反复打开或维护的界面，或需要查看会话、任务、日志和工作区的实时数据时。"}};
    const normalize = value => value.normalize('NFKC').toLocaleLowerCase('zh-CN');

    function textFor(skill) {
      const candidate = Object.hasOwn(translations, skill.name) ? translations[skill.name] : undefined;
      const translation = candidate?.source === skill.description ? candidate : undefined;
      const purpose = translation?.purpose ?? skill.description;
      const scenario = translation?.scenario ?? (skill.whenToUse || purpose);
      return { name: skill.name, purpose, scenario, combined: scenario === purpose,
        search: normalize([skill.name, purpose, scenario, skill.description, skill.whenToUse].filter(Boolean).join(' ')) };
    }

    function BookIcon({ size = 18 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('path', { d: 'M12 6.2C9.5 4.6 6 4.1 3.1 5.2v13.1c3-.9 6.5-.4 8.9 1.1 2.4-1.5 5.9-2 8.9-1.1V5.2c-2.9-1.1-6.4-.6-8.9 1v13.2M6.4 8.8l2.8.6m-2.8 2.9 2.8.6m5.6-3.5 2.8-.6m-2.8 4.1 2.8-.6' }));
    }

    function SearchIcon() {
      return h('svg', { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.8, strokeLinecap: 'round', 'aria-hidden': true },
      h('circle', { cx: 10.5, cy: 10.5, r: 5.7 }), h('path', { d: 'm15 15 4.4 4.4' }));
    }

    function Card({ skill, onOpen, cardRef }) {
      return h('button', { ref: cardRef, type: 'button', className: 'skills-card', onClick: onOpen },
        h('span', { className: 'skills-card-title' }, h(BookIcon, { size: 17 }),
          h('code', null, skill.name), h('span', { className: 'skills-card-arrow', 'aria-hidden': true }, '›')),
        h('span', { className: 'skills-card-copy' }, h('span', { className: 'skills-term' },
          skill.combined ? '用途与适用场景' : '用途'), skill.purpose),
        !skill.combined && h('span', { className: 'skills-card-copy' },
          h('span', { className: 'skills-term' }, '适用场景'), skill.scenario));
    }

    function useRead(read, identity) {
      const [state, setState] = useState({ phase: 'loading' });
      useEffect(() => {
        const controller = new AbortController();
        setState({ phase: 'loading' });
        Promise.resolve().then(() => read(controller.signal)).then(value => {
          if (!controller.signal.aborted) setState({ phase: 'ready', value });
        }, () => {
          if (!controller.signal.aborted) setState({ phase: 'error' });
        });
        return () => controller.abort();
      }, [identity]);
      return state;
    }

    function Detail({ skill, read, onBack }) {
      const state = useRead(read, skill.name);
      const heading = useRef(null);
      useEffect(() => { heading.current?.focus(); }, []);
      return h('article', { 'aria-labelledby': `${panelId}-detail` },
        h('button', { type: 'button', className: 'skills-control skills-back', onClick: onBack }, '← 返回技能目录'),
        h('h1', { tabIndex: -1, ref: heading, id: `${panelId}-detail` }, h('code', null, skill.name)),
        h('h2', null, '原说明'),
        state.phase === 'loading' && h('p', { role: 'status' }, '正在读取原说明…'),
        state.phase === 'error' && h('p', { role: 'alert' }, '原说明读取失败。返回目录后可重新打开。'),
        state.phase === 'ready' && (state.value?.content
          ? h('pre', { className: 'skills-original' }, state.value.content)
          : h('p', { role: 'status' }, '当前会话中已无法读取这项技能的原说明。')));
    }

    function Catalog({ sessionId, list, detail, leave }) {
      const [query, setQuery] = useState('');
      const [selection, setSelection] = useState(null);
      const [revision, setRevision] = useState(0);
      const opener = useRef(new Map());
      const restoreFocus = useRef(null);
      const state = useRead(signal => list(sessionId, signal), revision);
      const entries = useMemo(() => (state.value?.skills ?? []).map(textFor), [state.value]);
      const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
      const visible = entries.filter(entry => terms.every(term => entry.search.includes(term)));
      const selected = entries.find(entry => entry.name === selection);
      const showLoading = state.phase === 'loading';
      useEffect(() => {
        if (selection === null && restoreFocus.current !== null) {
          opener.current.get(restoreFocus.current)?.focus();
          restoreFocus.current = null;
        }
      }, [selection]);
      if (selected) {
        return h(Detail, { key: selected.name, skill: selected,
          read: signal => detail(sessionId, selected.name, signal),
          onBack: () => { restoreFocus.current = selection; setSelection(null); } });
      }
      return h(React.Fragment, null,
        h(PageHeader, { leave }),
        h('div', { className: 'skills-search-row' },
          h('label', { className: 'skills-search', htmlFor: `${panelId}-search` }, h(SearchIcon),
            h('input', { id: `${panelId}-search`, type: 'search', value: query, 'aria-label': '搜索技能',
              placeholder: '搜索技能名称、用途或场景', onChange: event => setQuery(event.target.value) })),
          state.phase === 'ready' && h('span', { role: 'status', className: 'skills-count' }, `${visible.length} 项技能`)),
        showLoading && h('p', { role: 'status' }, '正在读取当前会话的技能目录…'),
        state.phase === 'error' && h('div', { className: 'skills-empty' },
          h('p', { role: 'alert' }, '技能目录读取失败。'),
          h('button', { type: 'button', className: 'skills-control', onClick: () => setRevision(value => value + 1) }, '重试')),
        state.phase === 'ready' && (visible.length
          ? h('ul', { className: 'skills-grid', 'aria-label': '技能目录' }, visible.map(skill => h('li', { key: skill.name },
            h(Card, { skill, onOpen: () => setSelection(skill.name), cardRef: element => {
              if (element) opener.current.set(skill.name, element);
              else opener.current.delete(skill.name);
            } }))))
          : h('p', { className: 'skills-empty', role: 'status' }, entries.length ? '没有匹配的技能。' : '当前会话没有可浏览的技能。')));
    }

    function PageHeader({ leave }) {
      return h('header', { className: 'skills-header' },
        h('h1', null, '技能'),
        h('button', { type: 'button', className: 'skills-control', onClick: leave }, '返回会话'));
    }

    function apply(ctx) {
      const main = ctx.uiSession.adapter.current;
      const subscribe = listener => main.subscribe(listener);
      const getSession = () => main.getSnapshot().key;
      const leave = () => {
        if (ctx.layout.panelInfo.getSnapshot().activePanelId === panelId) ctx.layout.selectPanel(null);
      };
      const list = async (sessionId, signal) => {
        signal.throwIfAborted();
        const result = await ctx.remote.skills.list({ sessionId }, signal);
        signal.throwIfAborted();
        if (!result.ok) throw new Error('Skills catalog unavailable');
        return result.value;
      };
      const detail = async (sessionId, name, signal) => {
        const result = await ctx.connection.rpc.call('/api', endpoint, { args: { request: { sessionId, name } } }, signal);
        if (!result.ok) throw new Error('Skill detail unavailable');
        return result.value;
      };

      function Page() {
        const sessionId = useSyncExternalStore(subscribe, getSession);
        return h('section', { className: 'dsh-personalized-skills', 'aria-label': '技能' },
          h('div', { className: 'skills-inner' }, sessionId
            ? h(Catalog, { key: sessionId, sessionId, list, detail, leave })
            : h(React.Fragment, null, h(PageHeader, { leave }),
              h('p', { className: 'skills-empty', role: 'status' }, '请先打开一个会话，再查看该会话可用的技能。'))));
      }

      ctx.effect(() => ctx.locale.register(panelId, { zh: { title: '技能' }, en: { title: 'Skills' } }));
      const t = ctx.locale.bind(panelId);
      ctx.effect(() => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.append(style);
        return () => style.remove();
      });
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: panelId }, Page));
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: panelId, order: 0.01, label: () => t('title'), locale: panelId,
      }, BookIcon));
      ctx.effect(() => leave);
    }

    return { inject: ['slots', 'layout', 'uiSession', 'remote', 'remote.skills', 'connection', 'locale'], apply };
  },
});
