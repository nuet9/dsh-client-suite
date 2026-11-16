# 浏览器配置与迁移

本文对应 2026-11-16 发布套件，结合来源安装文档与已迁移的发布源码提供部署步骤和验证标准。套件提供模板准备脚本，但没有据此宣称异机安装、浏览器登录或站点任务已验证。通用环境与凭据边界见 [ENVIRONMENT.md](ENVIRONMENT.md)，代理操作模板见 [portable-AGENTS.md](portable-AGENTS.md)。

## 先选择浏览器路线

| 路线 | 入口与存储 | 登录与适用任务 | 关键边界 |
|---|---|---|---|
| Harness 专用 Chrome | `mcp__playwright_browser__*`，独立持久 `${HARNESS_BROWSER_PROFILE}` | 默认网页任务；需要在专用 profile 单独登录 | 不继承日常 Chrome 的标签、cookies、扩展或账号；Playwright 当前页操作不能多人并发切换 |
| 后台浏览器：session | `background_browser_open({url,storage:"session"})`；调用者派生临时 context | 公开网页、不同会话的临时存储分离 | 子代理不继承 context；不是独立进程或系统安全边界；不承诺重启持久性或降权清除 |
| 后台浏览器：shared | `background_browser_open({url,storage:"shared"})`，或基础 MCP 未指定隔离 context 的新页；共享持久 `${BACKGROUND_BROWSER_PROFILE}` | 明确需要该专用后台 profile 的持久登录 | 页面归属分离，账号和同源存储仍共享；同账号写入必须串行 |
| 用户日常 Chrome | `google_chrome_connect` → `open/read/evaluate`，用户正在使用的 Chrome | 仅用户明确授权日常浏览器时；可能使用其既有登录 | 不启动 Chrome；只控制本会话新建任务页，不能认领既有标签；连接授权可能再次提示 |

不要把“后台标签”“headless”“专用 profile”“会话隔离”混为同一属性。headless 只描述窗口形态；新页不必然有新存储；已登录不证明是日常 Chrome。

## 版本、依赖与适配前提

| 组件 | 本次来源版本 | 安装前提和限制 |
|---|---|---|
| Harness | 安装包 `@deepseek-ai/dsh` 0.2.2-rc.3 | 已读安装 manifest；早期后台浏览器真实验证记录基于 0.2.1-rc.5 desktop。没有证据覆盖所有 DSH 版本或非 Windows 系统 |
| `@local/playwright-extension-mcp` | 1.0.1；固定 `@playwright/mcp` 0.0.83 | Chrome + Node + stdio MCP；包名沿用历史命名，当前专用路线不需要 Playwright Chrome Extension 或其 token |
| `@local/pinterest-browser-headless` | 1.0.0 | 修改既有 `playwright-extension-mcp` row 加 `--headless`，不是第二个 MCP；依赖原 row 存在和 patch 正确作用域 |
| `@local/background-browser-control` | 1.0.0；固定 `chrome-devtools-mcp` 1.9.0 | 需要支持 `--pageIdRouting=true`、显式 pageId 及 isolated context 的实际安装构建；不要只凭上游同版本号推断兼容 |
| `@local/browser-session-guard` | 1.0.0 | Host `tools`、`systemPrompt` 服务；依赖基础 MCP 新页输出中唯一 `[selected]` 行解析 |
| `@local/background-browser-hub` | 1.0.0 | 基础 MCP + guard；无新增第三方运行依赖，通过原工具执行管线调用 |
| `@local/google-chrome-control` | 1.0.0 | Windows desktop、用户已打开 Chrome、手动允许 remote debugging；依赖 profile 中 `chrome-devtools-mcp` 的内部 Puppeteer 导出 |

Chrome 具体最低版本、Node 最低版本、非 Windows 路径、Chrome Dev/Canary/自定义 profile、企业策略、更新后 Puppeteer 内部路径均未在本次验证。部署者应使用其 Harness 支持的 Node，并记录实际 Chrome/Node 版本后运行下述最小验证。

## 生成部署者本地配置

先定位 `${WORKSPACE_ROOT}`、`${DSH_PROFILE_DIR}`、`${NODE_EXECUTABLE}`、`${CHROME_EXECUTABLE}`、`${PLAYWRIGHT_MCP_CLI}`、`${DEVTOOLS_MCP_CLI}`。两个 profile 选为独立、可写、不会提交版本库的目录：`${HARNESS_BROWSER_PROFILE}` 与 `${BACKGROUND_BROWSER_PROFILE}`。另建 `${BROWSER_WORK_DIR}` 供后台 MCP 工作。

这些 `${...}` 只是文档记号。发布源码使用 `__DSH_SUITE_*__` token；填写 [deployment.example.json](../scripts/deployment.example.json) 的本地副本后，通过 [prepare.mjs](../scripts/prepare.mjs) 生成配置完成的插件副本，无需修改原源码。脚本从配置 `variables` 或同名环境变量取值，requirements 说明每个字段的插件与用途；路径用正斜杠、不含引号/反引号或换行。运行 `node scripts/prepare.mjs --config <本地配置.json>`，检查 `scripts/prepared/install-plan.json`，再按授权使用 Harness 插件管理器安装。脚本只准备副本和计划，不安装外部依赖或改 profile；依赖清单见 [external-dependencies.json](../scripts/external-dependencies.json)。本地配置和生成目录不提交公共仓库。

后台 MCP 对应模板字段 `DSH_SUITE_BACKGROUND_BROWSER_CONTROL_PATH_4` 至 `PATH_8`：依次为 Node、DevTools MCP CLI、Chrome、独立 user-data-dir、工作目录。Playwright 对应 `DSH_SUITE_PLAYWRIGHT_EXTENSION_MCP_PATH_11` 至 `PATH_14`：依次为 Node、Playwright MCP CLI、专用 user-data-dir、工作目录。headless 覆盖另填 `DSH_SUITE_PINTEREST_BROWSER_HEADLESS_PATH_27` 至 `PATH_30`，与前述 Playwright 路线指向同一部署环境。日常 Chrome 对应 `DSH_SUITE_GOOGLE_CHROME_CONTROL_PROFILE_ROOT` 和 `DSH_SUITE_GOOGLE_CHROME_CONTROL_USER_HOME`。字段含义最终以模板 requirements 为准；不要将本文 `${...}` 直接填入值。

### 专用 Playwright Chrome

stdio MCP 配置应保留 `serverName: playwright_browser`，command 为实际 Node，args 指向实际 Playwright MCP CLI，再加：

```text
--headless
--browser
chrome
--user-data-dir
${HARNESS_BROWSER_PROFILE}
```

基础 1.0.1 bundle 的原始 patch **没有 `--headless`**，README 明确默认 headed，首次调用可能打开独立窗口。后台策略部署应明确加 headless，或安装匹配作用域的 headless 覆盖；不可只读旧说明就声称当前运行无窗口。专用 profile 仍持久保存登录、历史及缓存。

要人工登录时，需用户明确授权打开专用登录窗口，再按该安装的登录入口完成；登录后确认恢复 headless。headless 模式本身不能让用户处理验证码。不要开两个 Chrome 同时占用同一 user-data-dir，也不以复制日常 Chrome cookies 代替登录。

### 显式 pageId 后台浏览器

基础 stdio MCP 使用 `serverName: background_browser`，command 为实际 Node，args 指向实际 DevTools MCP CLI，并核对该构建接受这些已使用参数：

```text
--headless=true
--executablePath=${CHROME_EXECUTABLE}
--userDataDir=${BACKGROUND_BROWSER_PROFILE}
--pageIdRouting=true
--categoryEmulation=false
--categoryPerformance=false
--categoryNetwork=false
--no-usage-statistics
--no-performance-crux
--viewport=1440x1000
```

工作目录设为 `${BROWSER_WORK_DIR}`，历史配置同时设置 `CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS=1` 和 `CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS=1`。这些是该部署的配置，不保证其他版本接受相同参数；CLI 报 unknown option 时先查构建，不换参数重复启动。基础 MCP 准备好后加载 guard，再加载可选 hub；缺 guard 时 hub 应拒绝开页。

推荐调用顺序：

1. `mcp__background_browser__new_page({url:"https://example.com",background:true})`；需要 hub 的存储隔离时改用 `background_browser_open({url:"https://example.com",storage:"session"})`。
2. 保存本次返回 pageId，后续每次传同一个 ID。
3. `background_browser_pages({})` 只列本会话页面，代替被 guard 禁止的全局 `list_pages`。
4. 用本会话页面读标题，再按授权关闭本次任务页。工具重注册、guard 重载、Host 重启会清空归属；遗留页不能重新认领。

guard 串行化单次调用并按真实调用者登记页，不允许父子会话转移归属。它不隔离浏览器进程、同源账号、页面脚本、shell 或直接 CDP，也不为整个网站事务加锁。需要真正不同账号时应单独设计隔离部署，不以 guard 代替。

### 日常 Chrome

用户先打开其 Chrome，并在 `chrome://inspect/#remote-debugging` 按当前 Chrome 的界面手动启用/批准访问。插件不会自行启动 Chrome，不要求代理加 `--remote-debugging-port`，也不读取或搬运登录数据库。

确认 Host 能取得部署者自己的 `LOCALAPPDATA` 和 `DSH_PROFILE_DIR`。连接器读取 `${LOCALAPPDATA}/Google/Chrome/User Data/DevToolsActivePort` 并从 `${DSH_PROFILE_DIR}/node_modules/chrome-devtools-mcp/build/src/third_party/index.js` 导入 Puppeteer。该内部路径和发现机制可能随版本变化。发布版 `transport.js` 已将原本机 fallback 改为部署模板，prepare 阶段填写目标用户 home 和 profile 根；不要安装仍含未替换 token 的模板源码。环境变量存在时仍以实际运行环境为准，必须验证其对应目标 profile。

调用 `google_chrome_status` 只查状态；只有 `google_chrome_connect` 会主动连接。连接后 `google_chrome_open({url})` 返回不透明 pageId；用 `read/evaluate` 读取，后续动作不会自动重连。用户授权变化、Host/Chrome 重启、超时断连后须显式再 connect 并新建页。连接、WebSocket 地址和发现内容不得写进日志。`disconnect` 会影响其他会话的共享连接，需先协调；它不关闭 Chrome。

## 部署后最小验收

本次未执行下列真实验收，部署者应记录结果后才声明环境可用：

- 插件管理器先 list 核对包标识、安装来源与版本，按 `application/nextStep` 完成必要重开；工具实际存在后再调用。`applied` 不证明浏览器或页面已验证。
- 专用 Playwright：读取 Example Domain 标题；只读核对进程实际 user-data-dir 与 headless 参数，确认没有复用日常 profile。
- 后台 MCP + guard：本会话新页可读、其他会话读该 ID 被拒绝、关闭后自有列表消失。hub 再验证 session 的临时测试值不能被 shared 或另一会话读到，并清除测试值。
- Google Chrome：仅在用户授权后 connect、新建后台任务页、读取公开测试页；由用户确认焦点没有变化，按授权关闭测试页。不将一次连接成功当永久免授权。
- 可运行源码 mock 测试：`node --test plugins/browser-session-guard/ownership.test.js`、`node --test plugins/background-browser-hub/hub.test.js`、`node --test plugins/google-chrome-control/controller.test.js`。路径相对部署者源码根，Node 使用已发现路径；这些测试不证明真实 Chrome、登录和焦点行为。
- 登录、验证码与站点风控单独记录。`background_browser_status` 的 `not-probed` 是未探测；`pages-readable` 只证明这次页面可读；不推断登录成功。Harness 返回 401 使用正常认证入口，禁止复制凭据或关闭认证。

首次启动失败停止该路线并保留原始错误；`Page is not registered to this session` 时新建页，不关闭 guard 绕过；页面输出格式变化时修复版本适配。停用插件不等于退出网站或删除 profile。清理持久 profile 必须取得部署者明确授权，不能作为一般重试步骤。

## 公开分发检查

只分发插件源码、无敏感值配置模板和文档。不包含两个专用 user-data-dir、Chrome 默认 User Data、Cookies/History/Local Storage、DevToolsActivePort、WebSocket 地址、扩展 token、账号截图或真实站点登录记录。版本控制排除 profile、缓存、下载和调试日志；原始本机 README/patch 也要逐项审核，不能把包含私人路径的维护记录直接作为便携包。

本说明依据的源材料类型：全局功能约定、能力索引、浏览器边界说明，以及上述六个浏览器 bundle 的 README、package manifest、patch 和 guard/transport 源码。历史真实验证涵盖专用 profile 分离、后台页面归属和临时存储分离、日常 Chrome 新页读取；均不替代本次新机器验证，也不保证任意站点可自动访问。
