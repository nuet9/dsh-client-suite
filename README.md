# Harness 客户端完整扩展套件

把 nuet9 使用的 DeepSeek Harness 客户端新增功能整理成可审查、按环境配置的部署套件。目标基线为 **Windows Desktop / DSH 0.2.2-rc.3 / Node.js 24+**。

包括截图中的会话分类、流程提示词库、美术工具箱、公司生图/视频、专家入口、主/代理对话标签和请求统计，以及文件浏览、系统文件夹链接、浏览器控制、交互表格/图表、开发文件工具、TS/JS 诊断、小鲸鱼等。官方及第三方插件通过精确版本清单引用，不随包复制个人 profile。

**安装包完成静态验证，尚未在另一台干净电脑完成整套实装。** 外部服务、模型、付费生成和页面交互须按功能另验。安装扩展不等于已安装 Chrome、Blender、ComfyUI、WorkBuddy 或获得服务账号。

## 快速部署

1. 下载本仓库的完整部署 ZIP 并解压到长期保留的目录。先阅读 [环境说明](docs/ENVIRONMENT.md)、[浏览器设置](docs/BROWSER-SETUP.md) 和 [外部依赖](scripts/external-dependencies.json)。
2. 在已安装的 Harness 中让代理加载 `dsh-doc`，确认当前 DSH 版本、运行环境和 `plugin_manager` 可用。
3. 用 `load_workspace_dependencies` 取得 Node 路径。运行 `node scripts/verify.mjs` 验证分发文件。
4. 将 `scripts/deployment.example.json` 复制为根目录 `deployment.json`，按实际路径填写自己需要的配置；模板不含密钥。运行 `node scripts/prepare.mjs --config deployment.json`。
5. 检查 `scripts/prepared/install-plan.json`。缺配置的插件会列在 `configurationRequired`，退出码为 2；它们尚未准备成功。可用 `--plugin @local/session-categories` 等单独准备一项。
6. 把生成计划交给 Harness 代理，明确要求通过 `plugin_manager` 逐项安装。官方及基础功能先读取管理器清单再启用；第三方使用指定版本。本套件不直接修改 profile。遇依赖构建脚本或版本不符，按管理器实际提示处理，不自动授权脚本或豁免。
7. 按管理器提示完整重开 Harness，然后核对工具、入口与最小功能。保留解压及生成目录，链接安装依赖这些目录。

可以给目标 Harness 发送：

> 请先读本套件 README、docs/ENVIRONMENT.md 和 docs/BROWSER-SETUP.md，加载 dsh-doc，检查环境。根据我的实际路径生成 deployment.json，执行 verify 和 prepare，再检查 install-plan。安装我选择的功能时只使用 plugin_manager，不覆盖原 profile，不复制账号和登录状态，不自动运行付费测试。缺少软件、配置或版本不匹配请明确报告。

## 功能与配置

- [完整功能清单](feature-inventory.json)：每项版本、中文名称、来源、依赖、纳入状态及文件哈希。
- [安装清单](manifest.json)：52 项 profile 功能，含 33 份源码及官方/第三方引用；已停用的旧子代理实验不默认重新启用。
- [部署变量](scripts/deployment.example.json)：36 个按功能填写的可执行文件、模块、目录模板。只需填写所选功能需要的字段。
- [四项配套技能](skills/README.md)：照片建模、Tripo 处理、Pinterest 参考与公司生图备用脚本；复制完整目录安装，prepare 不自动安装技能。
- [可选长期约定](docs/portable-AGENTS.md)：按自己环境合并到工作区约定，不覆盖原有 AGENTS。
- [浏览器设置](docs/BROWSER-SETUP.md)：专用 Playwright、后台 session/shared 与日常 Chrome 的连接边界和首次登录。

ComfyUI、Blender、Windows 桌面控制、SUPIR、WorkBuddy、小鲸鱼桌面模式等需要独立依赖。小鲸鱼桌面组件只提供源码和显式构建脚本，不捆绑作者编译缓存。具体前提见外部依赖清单。

## 隐私与授权

不提供 API key、cookies、登录态、私人会话、任务历史、素材、模型权重、个人成果库或原 profile。部署者使用自己的账号并自行登录。生成的 `deployment.json` 和 `scripts/prepared/` 含本机路径，默认忽略，勿公开上传。

第三方代码遵守各自 LICENSE，见 [第三方信息](third-party/)。本地未声明许可证的源码以现有状态提供供审阅，尚未授予统一开源许可证；部署者转发、修改再发布前应与仓库维护者确认。不能把第三方版权归给本仓库。

## 验证范围

`verify` 检查源码白名单、入口闭包、文件哈希、路径模板、个人启动测试残留及 JavaScript 语法。[静态验证结果](scripts/verification.json) 不等同于异机安装、Host 实际加载、浏览器账号操作或生产效果验收。各插件原说明可能含历史验证结果，应以本套件当前限制为准。

升级和回退使用 Harness 正式插件管理器。保留旧版本备份，不删除仍被链接引用的目录，不以清除浏览器登录目录或聊天记录作为回退方式。
