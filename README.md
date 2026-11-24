# Harness 客户端扩展套件

面向 **Windows Desktop / DeepSeek Harness 0.2.2-rc.5 / Node.js ≥24.9**。这份套件整理了作者使用的扩展、可移植配置和软件环境：会话分类、提示词库、美术工具箱、公司生图/视频、专家入口、主对话与代理对话标签、请求统计，以及文件浏览、浏览器控制、开发、图表和定时任务等功能。

- [下载最新正式 Release](https://github.com/nuet9/dsh-client-suite/releases/latest)：选带日期的完整部署 ZIP，不是 GitHub 自动生成的 Source code ZIP。
- [中文功能操作 PPT](docs/Harness-使用指南.pptx)：标注用户提供的真实入口裁图，其他入口用示意或示例；逐项说明入口、用法、场景和收益。
- [Windows 软件安装与验收](docs/SOFTWARE-SETUP.md) · [环境与路径](docs/ENVIRONMENT.md) · [浏览器设置](docs/BROWSER-SETUP.md)

## 一句话交给 Harness

> 请从 https://github.com/nuet9/dsh-client-suite/releases/latest 下载并校验 Windows 完整部署包，在我的 Harness 中按 README 部署我需要的功能：先加载 dsh-doc，查本机环境，运行 verify、preflight 和 prepare，只通过 plugin_manager 安装已授权项，不覆盖现有插件配置；缺软件、登录或授权就列出来，不自动跑付费测试。

这是给**已安装 Harness 的代理**的部署指令，不是免确认安装器。代理可以查找本机路径并生成计划；生产软件、账户登录、模型/权重路径和权限因机器而异。部署者自己完成缺项或明确选择跳过。

## 预检与安装

1. 对照 Release 的 `SHA256SUMS.txt` 校验 ZIP，解压至长期保留的目录。加载 `dsh-doc`，确认运行版本、profile 与 `plugin_manager`，通过 `load_workspace_dependencies` 取得 Node 路径。
2. 运行 `node scripts/verify.mjs --no-write`。根据 `scripts/deployment.example.json` 填写本机的 `deployment.json`，按需求提供路径，不填密钥。`node` 指已核实的可执行文件；PowerShell 可用 `& $Node` 代替。
3. 运行 `node scripts/preflight.mjs --config deployment.json` 检查本机路径，修正缺项后执行 `node scripts/prepare.mjs --config deployment.json`。两者均接受可重复的 `--plugin <完整包名>`；先从不需外部软件的 `@local/session-categories` 试起。退出码 2 表示相应检查有缺项，ASAR 路径留给 Harness 运行时复核。
4. 审阅 `scripts/prepared/install-plan.json`，只通过正式 `plugin_manager` 安装或启用已授权项。不改写 profile、不替用户批准依赖构建脚本或版本豁免，也不自动覆盖同名不同来源插件。源码版本相同不代表内容相同，更新前查 `contentSha256` 和实际安装来源。按管理器提示重开并做无付费最小验收。
5. 保留已链接的生成目录。重复准备相同内容会复用对应目录；不同的配置或源码产生新目录，旧链接不会因 prepare 被删除。技能与约定按下文另行安装或合并。

## 发布范围

- [功能清单](feature-inventory.json) · [安装范围](manifest.json)：52 个来源 bundle（32 份源码、2 个内置、11 个官方引用、7 个注册表引用）。旧子代理安全默认值的运行插件仍停用，不进入默认计划；过时的停用依赖不分发。
- [部署模板](scripts/deployment.example.json)：只填所选插件需要的字段；[外部依赖](scripts/external-dependencies.json)另行准备。
- [六项便携技能](skills/README.md)：照片建模、Tripo 处理、Pinterest 选图、公司生图、概念建模与工业白模对形。
- [可选长期约定](docs/portable-AGENTS.md)：只合并适用规则，不覆盖部署者已有约定。

不分发原 profile、账号、密钥、登录态、私人会话、任务历史、素材、模型权重或个人成果库。生成的 `deployment.json` 和 `scripts/prepared/` 含本机路径，请不要公开提交。第三方代码保留[原许可与声明](third-party/)；未声明许可的本地源码不附加统一开源授权。

[静态验收记录](scripts/verification.json)与安装计划测试不代表已在第二台干净的 Windows 机器完成整套安装。浏览器账号操作、MCP 连通性、模型与付费生成均需按功能在目标机器验收。
