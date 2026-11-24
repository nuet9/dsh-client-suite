# Windows 软件准备与最小验收

本指南对应套件快照 2026-11-24 与 Harness `0.2.2-rc.5`。先按目标功能安装软件，再生成和审阅插件计划；软件安装器、插件管理器、账号授权和模型下载均由部署者独立确认。本仓库不自动安装任何外部软件。

## 最短准备流程

1. 安装受支持的 Windows x64 Harness Desktop 和 Node.js 24 LTS（Harness manifest 下限 `>=24.9.0`）；另安装 Git for Windows（如需套件 Git Bash 功能），从官方页面获取当前受支持版本，不要将最低版本当长期固定版本。
2. 按所需功能准备本页表格中的软件、Python 环境和独立数据目录；准备需要的模型、账号或授权。不要复制浏览器 cookies、真实 profile、密钥或其他机器的配置。
3. 使用 Node 和 pnpm 在套件副本运行：`node scripts/prepare.mjs --config <本地配置.json>`；只选特定插件时，可重复传 `--plugin <feature-inventory.json 中的精确名称>`。示例：

```powershell
node --version
pnpm --version
node scripts/prepare.mjs --config .\deployment.json --plugin '@local/background-browser-control'
Get-Content .\scripts\prepared\install-plan.json
```

当前 `prepare.mjs` 支持重复 `--plugin`，使用 `feature-inventory.json` 中精确名称（如 `@local/background-browser-control`）。模板目前含 30 项 variables；配置按变量名从 JSON 的 `variables` 读取，未提供时回退到同名环境变量。缺失已选插件必填项时列入 `configurationRequired` 并以退出码 2 结束。脚本只生成带内容哈希的 `scripts/prepared/<slug>-<hash16>/` 插件副本及计划；旧目录保留，仅安装计划更新。审阅后才由部署者调用 Harness `plugin_manager`。插件所需普通 npm 包仅在对应 prepared 子目录运行 `pnpm install --ignore-scripts --config.auto-install-peers=false`；绝不对 Harness profile 执行 pnpm install。清单见 [external-dependencies.json](../scripts/external-dependencies.json)。

## 按功能准备

| 功能 | 需要准备 | 最小验收；未验证项 |
|---|---|---|
| Harness 与 Node | Windows Desktop Harness `0.2.2-rc.5` 快照；Node 满足 manifest `>=24.9.0`，建议受支持的 Node 24 LTS 更新版 | `node --version`；目标 Harness 中核对插件管理器/工具。该版本信息来自当前运行包 manifest，不承诺其他 DSH 版本或异机兼容 |
| 浏览器 | Chrome；Playwright MCP 使用独立 profile，后台 Chrome DevTools MCP 使用另一专用 user-data-dir；日常 Chrome 仅按明确授权连接。当前锁定 `@playwright/mcp` 0.0.83、`chrome-devtools-mcp` 1.9.0 | `chrome.exe --version`，CLI `--help`；先在空专用 profile 创建新页。Chrome 最低版、企业策略、扩展登录及实际浏览器 MCP 组合未实机验证，见 [BROWSER-SETUP.md](BROWSER-SETUP.md) |
| Blender MCP | Blender 与匹配的 Blender MCP add-on；单独 Python 环境安装上游 `blender_mcp`，将 Python 路径和 server 仓库工作目录分别配置。套件启动形态：`python -m blender_mcp.server --host 127.0.0.1 --port 9876` | Python `-m blender_mcp.server --help`（若上游不支持 help，则通过服务器启动日志检查监听）；Blender 内确认 add-on 与服务连接。此端口是套件配置，不是上游默认值；本套件不锁上游 server 发行号，未做连接测试 |
| Windows MCP | Windows；隔离 Python 环境安装并锁定 `windows-mcp` 依赖，按套件参数 `python -m windows_mcp serve` 配置解释器和包目录 | 运行 `python -m windows_mcp serve` 的启动日志并检查 Harness 工具注册；上游安装布局、版本和实际控制未在此快照验证，参见来源登记 |
| ComfyUI 与 SUPIR | 独立 ComfyUI 安装、Python、输出目录、所需节点与用户自行取得且许可适用的模型权重。SUPIR 模板使用单独 backend 配置，监听 `127.0.0.1:8199`；示例模型名见模板/补丁，不随套件分发 | 在 ComfyUI 自身 UI/API 查看服务健康与节点、模型清单；再以非付费本地图像做一次受控 smoke test。8199 是此 SUPIR 配置端口，不是 ComfyUI 通用默认值；未在干净机器验证模型组合/GPU 显存 |
| Tripo 静态模型处理技能 | 本地 Blender 可执行程序；按随包技能说明提供单一静态 GLB 和显式人工审核的分组计划 | 先跑只读 inspect/validate，再处理一份可丢弃副本并比较几何验证报告；不包含在线 Tripo 生成、模型权重或新许可。动画/蒙皮等超出此流程支持范围 |
| Office | 如需处理 Office 文件，安装有相应授权的 Microsoft 365/Office；Harness 本身不会随套件安装 Office | 通过本机应用打开一个测试副本，核对导出/渲染；具体版本、许可证、Office 自动化能力依组织策略，未由套件验证 |
| WorkBuddy | 独立安装官方 WorkBuddy Windows 客户端（官方说明：Windows 10 或更新；页面未给固定版本），由用户本人登录 | 检查客户端版本并在其界面确认技能/专家目录可用；套件只桥接 WorkBuddy 专家入口，不迁移账号、目录或凭证 |
| 公司图片/视频服务 | Drock 公司服务账号与 Harness 提供的凭据配置；只在用户授权的真实请求中使用 | 先用服务提供的非生成健康/模型信息检查（若账户接口支持）；生成可能计费。公开资料/本套件未验证账户、配额或实际生成；不把 API key 放配置模板 |
| Git / Git Bash | 官方 Git for Windows；Git Bash 路径按 `deployment.example.json` 单独填写 | `git --version`、`bash --version`。桌面终端按配置的 Git Bash 工作目录启动；没有已核验固定发行号，不安装 UGit 兼容层 |
| 可选桌面鲸鱼挂件 | 仅桌面固定功能需要 Windows x64、.NET 10 SDK、相应运行时和 Evergreen WebView2；Web widget 本身不要求这些原生依赖 | `dotnet --info`、`dotnet --list-runtimes`；检查 WebView2 Runtime。正式构建脚本的 `--allow-restore` 会下载锁定 NuGet WebView2 包 `1.0.3537.50`，需人工审阅并确认；本次未运行构建或下载 |

## 来源与版本判读

[software-sources.json](../scripts/software-sources.json) 登记官方来源、观测日期和版本状态。`pinned` 仅表示套件或打包脚本的真实锁定值；`minimum` 是运行包下限，不是推荐永远安装的版本；`live` 表示应从官方页面选择当前支持版本；`unverified` 表示无经证实的上游发行号。不要将滚动页面当天显示的版本转写为长期保证，也不要用上游包版本推断 DSH 插件兼容。

Windows MCP、Blender MCP、Chrome/Python/Office、ComfyUI 节点和 SUPIR 权重未在新机器实装；公开来源可能更新。外部服务 smoke test、登录、付费图片/视频生成及模型下载均未执行。