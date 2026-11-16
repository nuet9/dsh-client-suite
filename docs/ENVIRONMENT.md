# 匹配环境与外部服务

整理日期：2026-11-16。本套件的插件界面、任务路由和文档不自动安装生产软件，不自带外部账号、密钥、模型权重或浏览器登录。本文列出部署者需要自行准备的依赖；浏览器的配置步骤见 [BROWSER-SETUP.md](BROWSER-SETUP.md)，可选长期约定见 [portable-AGENTS.md](portable-AGENTS.md)。

## 基础环境与路径

| 变量记号 | 部署者应确认的值 |
|---|---|
| `${WORKSPACE_ROOT}` | 自己选择且可写的工作区，不等于 Harness 安装根 |
| `${BUNDLE_ROOT}` | 本套件实际解压或源码根；以分发清单确认哪些插件确实随包提供 |
| `${DSH_PROFILE_DIR}` | 当前正在运行的 Harness profile，由运行环境发现 |
| `${NODE_EXECUTABLE}`、`${PNPM_ENTRY}`、`${PYTHON_EXECUTABLE}` | 优先取 `load_workspace_dependencies` 返回值；外部软件的专用 Python 单独确认 |
| `${CHROME_EXECUTABLE}`、`${HARNESS_BROWSER_PROFILE}`、`${BACKGROUND_BROWSER_PROFILE}` | 实际 Chrome 和两个独立的非公开 profile 位置 |
| `${BLENDER_EXECUTABLE}`、`${COMFYUI_ROOT}`、`${COMFYUI_URL}` | 用户自行安装的生产软件与实际服务地址，按功能需要填写 |

`${...}` 是本文说明记号，与发布包源码的 `__DSH_SUITE_*__` 模板 token 不同。套件使用 [prepare.mjs](../scripts/prepare.mjs) 将 36 项部署配置写入生成副本；配置字段、所属插件、用途与提示以 [deployment.example.json](../scripts/deployment.example.json) 的 `variables/requirements` 为准。复制该模板到不提交版本库的本地配置文件，填自己的路径；脚本优先读取该文件，再读取同名环境变量。不要把本文 `${...}` 直接写进配置值。PowerShell 实际环境变量使用 `$env:名称`。

本次确认运行安装包为 `@deepseek-ai/dsh` **0.2.2-rc.3**，Windows desktop。早期开发终端/后台浏览器记录基于 0.2.1-rc.5，不能推导任意新旧版兼容。所有插件须对照其 manifest、当前 DSH 文档与 Inspect 接口核对；浏览器矩阵见配套文档。macOS、Linux、容器、远程 Host、企业 Chrome 策略和第二台机器实装未在本次验证。

## 安装顺序

1. 在已有 Harness 环境加载 `dsh-doc`，确认安装版本、当前 profile、工具与权限。本文不要求更改模型默认值、全局权限、系统 PATH、注册表或执行策略。
2. 从可信分发取得源码或安装包，检查 `package.json`、`dsh.bundle.patch`、依赖、打包 `files` 和许可证。确认实际入口都随包存在，不能只验证旧入口或只复制部分源码。
3. 填写本地部署配置后，从套件根使用已发现的 Node 运行 `node scripts/prepare.mjs --config <本地配置.json>`，或加 `--plugin @local/background-browser-control` 只准备指定包。脚本将发布源码中的 `__DSH_SUITE_*__` token 替换到 `scripts/prepared/` 副本，生成 `install-plan.json`；未填写选定插件的必需字段会列入 `configurationRequired` 并退出 2。值必须单行、不含引号/反引号或 `${`，路径建议正斜杠；不要手改发布源码。每次运行会重新生成整个 prepared 目录，先保存自己的配置，不在该目录存放项目或手工修改。
4. 按 [external-dependencies.json](../scripts/external-dependencies.json) 单独准备外部软件和包依赖。仅在 prepared 插件目录运行 `pnpm install --ignore-scripts --config.auto-install-peers=false`；不在 profile 执行该命令，不自动安装 Harness/React peer。脚本不会安装浏览器、Python、模型或付费服务。源码 link 安装必须保留生成目录及依赖，重新 prepare 前先处理仍引用该目录的安装；也可打包生成副本再安装审查过的 tarball。
5. 审阅生成的 `install-plan.json`；它只是计划，不会执行工具。通过 `plugin_manager` 先 `list_bundles`，再在获得安装授权后对选定包使用计划中的正式安装入口；配置采用 Harness 支持的配置编辑入口。不要覆盖整个 profile 或复制作者 profile。尊重管理器版本约束；不要为跳过约束擅自增加版本豁免。
6. 检查管理器的 `application/nextStep`。`restart-required` 或 `module-comparison` 按提示完整重开，再实际查工具和功能。Client 刷新、Host 重开、源码构建监听是不同条件，不承诺写文件自动生效。
7. 先做无付费、最小范围验收。分别记录依赖检查、离线测试、真实工具、界面与生产效果的状态。只有静态通过时标“待实机”，不要标“部署成功”。

插件代码若要持久保存自身配置，使用当前 DSH config editor；密钥存 Harness credentials 服务。不要由插件扫描并重写用户的 profile patch，尤其不可丢失其他插件 row、注释或表达式。

## 必要本地技能

套件 [skills 说明](../skills/README.md) 包含 drock-image、photo-modeling-lite、pinterest-reference-curator、tripo-model-processing 的脱敏方法与必要 helper。按白名单提供源代码，不包含私人案例素材、运行缓存或凭据。将需要的完整技能目录手工复制到自己的 `~/.dsh/skills/<技能名>/`，保留相对结构；已有同名目录先比较/备份，再按当前 Harness 方式刷新发现或新建会话，用 `skill` 核对。prepare 只生成插件副本，不会自动安装技能。

drock-image 备用脚本需自己的 `DROCK_IMAGE_API_KEY` 或 `DROCK_IMAGE_API_KEY_FILE`；照片对比可选需要 Pillow；Tripo 的 runner/worker 已随技能提供，必须用 `--blender` 或 `TRIPO_BLENDER_EXECUTABLE` 指定实际 Blender，并对新输入进行视觉分组。技能内脚本运行会生成私人状态/缓存，不能重新打包发布。源技能无独立许可证文件；本套件记录用户授权分发及改编来源，不为第三方软件、API 或素材虚构许可。详见 skills 说明的依赖和验证限制。

## 按功能选择依赖

| 功能 | 需要自行提供 | 不随插件自动具备的能力 |
|---|---|---|
| 会话分类、流程提示词、任务/聊天入口、统计、交互表格/图表 | 匹配的 Harness Host/Client 服务，支持所用工具与 slot 的版本 | 安装 UI 不代表 Client 已刷新；统计也不等于所有客户端 HTTP 请求总量 |
| 文件编辑与代码质量 | 项目与依赖可读、匹配会话策略；`dev-code-quality` 声明 TypeScript 5.9.3、zod 4.1.12 | TS/JS 诊断不是全语言 IDE；该实现文件操作只支持 `danger-full-access`，不会自动放宽权限；Hooks 默认关闭 |
| 开发 Bash 终端 | 实际 Bash 可执行文件及原生 persistent terminal 服务；通过部署模板填写路径，不要求特定 Git 发行版目录 | 不自动安装 Git/Bash；后台 PTY 也服从会话沙箱；历史某模式失败不代表所有模式坏了 |
| GitHub CLI | 部署者选择的官方 gh，以及单独的 GitHub 登录和目标仓库权限 | 文档和本地打包不授予创建仓库、推送、Release 或外部发布权限 |
| 浏览器 | Chrome、Node、匹配 MCP、独立 profile；日常 Chrome 另需用户明确连接授权 | 网站登录、验证码、风控与网络出口可用性；详见浏览器文档 |
| Blender 制作与 live MCP | 实际 Blender、相匹配的 MCP 插件和 Python server、用户授权的 scene；检查 addon/version/连接端口 | 包含建模提示词不等于已安装 Blender 或生成器；不自带场景、资产库、模型权重 |
| Tripo GLB 处理 | 用户合法提供的 GLB、处理所需 Blender/Python 环境和技能 | 处理现有 GLB 不需要由插件自动请求付费生成；若另外使用 Tripo 生成服务，另行配置账号/密钥 |
| ComfyUI 控制与工作流库 | 实际 ComfyUI 安装、其 Python/运行器、API 地址、节点、模型与许可 | 工作流 JSON 存在不代表节点和模型齐备；`install` 仅复制工作流，不自动推理或下载 |
| Pinterest 参考队列 | 专用浏览器及部署者 Pinterest 登录、视觉读图工具、当前会话可用的研究代理 | 无 cookies 搬运；只读候选不等于已收藏；队列要求真实查看图像和唯一写入者 |
| WorkBuddy 桥 | 部署者自己拥有的本地 WorkBuddy 专家目录、桥声明的 yaml 依赖、需要时另配 MCP 服务 | 不捆绑私人专家资源、源平台凭据或 OAuth；连接器预览不代表连接或付费额度已开通 |

发布套件已处理本机路径、个人启动测试块和相关 fallback；art-toolbox 与会话分类使用声明的普通依赖 `sharp 0.35.5`，原生可选依赖须匹配目标平台，不能依靠作者应用内部的 sharp。Harness 运行时模块位置、ComfyUI 根目录、Windows Program Files、Bash/Blender/Python 路径通过部署模板生成；仍需部署者提供实际外部安装，Windows 进程脚本需要 PowerShell。`${COMFYUI_ROOT}` 是本文说明记号，对应实际模板字段须查 requirements，不能当作插件直接读取的环境变量。Blender server 的 Python 虚拟环境和 add-on 必须匹配，不复制作者虚拟环境。

小鲸鱼 Web 组件使用 Harness；可选桌面置顶还需 Windows x64、.NET 10 SDK/runtime、WebView2。`scripts/build-whale.mjs --allow-restore` 会显式下载固定 NuGet WebView2 1.0.3537.50，只有用户授权此准备动作后才运行；发布包不附原生二进制或 WebView2 DLL，不能把网页组件可用视作桌面置顶已验收。

## 外部服务和密钥

| 服务 | 部署者的配置动作 | 验证与费用边界 |
|---|---|---|
| Harness 对话模型服务 | 在自己的 Harness 服务商配置中认证，确认模型/工具/视觉能力 | 不提供作者模型路由、凭据或订阅；子代理默认可跟随当前配置，不猜 provider/model/reasoning 参数 |
| 公司图像/MJ/视频 API（可选 `drock_media`） | 自己的服务访问权限和三组凭据，在插件侧栏或其支持的 credentials 入口配置；原服务公开目录为 `https://ai.freeflyagain.xyz/modelSquare` | 图片、MJ、视频权限/额度可能不同；`check` 的模型目录可读不证明生成线路可用；生成耗费额度，必须有具体生成请求授权 |
| Blender 资产库/3D 生成器 | 按实际启用的 Poly Haven、Sketchfab、Poly Pizza 或生成服务配置账号、密钥、许可 | 免费资产也须遵守单个许可证；生成服务可能收费，每次按工具和用户授权执行 |
| Pinterest | 在自己的专用 profile 由用户登录并授权目标图版写入 | 公共网页可读不保证收藏权限；新建/追加目标以用户授权为准 |
| WorkBuddy 导出的 MCP 连接器 | 在 Harness 单独填自己的 header/env 凭据并完成所需 OAuth | 配置转换不迁移 WorkBuddy token；stdio/Streamable HTTP 的支持不包含所有 SSE 服务 |
| GitHub/其他发布服务 | 仅用户另行要求发布时，用自己的账号和权限 | 安装和准备脚本不自动发布仓库或 Release |

API endpoint、模型名、配额和认证方式可能变化，按部署者实际可见目录和服务说明核对。文档不附示例真实 token，也不从作者配置导出密钥。媒体任务保留稳定 `requestId`；提交不明先查原任务，换 ID 会产生新付费请求。不要为安装验收自动生成图片、视频或 3D 模型。

## 公开包的排除范围

不得打包或提交：真实 Harness profile、credentials 数据、`.env` 私密值、API key 文件、cookies/token、Chrome User Data 或专用 profile、DevToolsActivePort、WebSocket 发现地址、账号日志、私人会话与任务历史、内部成果库记录、私人项目、上传附件、真实生产素材及未获分发许可的模型权重。不要把这些文件仅改名为 example 后保留原值。

公共配置只放变量说明与空占位。日志、截图、README 历史段和打包清单同样需要检查用户名、本机绝对路径、项目名和账号 ID；“源码没有密钥”不等于 tarball 没有。推荐先列包内容并做文本敏感信息扫描，再由人工查看匹配项；生成的 deployment 配置和 prepared 目录是部署者本地数据，不能随公共模板回传。

## 验证状态和维护

发布套件包含准备脚本、外部依赖清单、36 项部署模板和经迁移处理的插件源码。源码清理和模板生成不等于目标电脑安装验证；安装计划不执行 profile 修改，外部软件和付费服务也不会自动安装或测试。已读的 Harness manifest 只证明来源安装版本，历史记录只说明当时对应机器的结果。第二台电脑实装、全版本兼容、真实浏览器登录、完整媒体播放、所有模型/连接器及生产效果仍需部署者按所选功能另验。

升级时保留旧源包、版本和配置备份但不公开凭据，按官方升级指南核对 DSH 服务、工具 schema、Client slot、MCP 参数和内部依赖路径，再跑相关最小验收。回退通过正式管理器停用/卸载对应包，不删除仍被 link 引用的源码，不以删除浏览器 profile 或生产工程代替回退。
