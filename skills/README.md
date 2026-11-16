# 本地技能的便携副本

这四个技能及白名单 helper 来自发布者本地技能，由用户明确授权作为本套件源码分发并进行脱敏改编。来源目录没有附独立 LICENSE；这里不虚构第三方许可证，也不替第三方软件、模型、API 文档或素材授予许可。对这些本地方法/脚本的分发授权不扩展到服务商、Blender、Python/Pillow 或用户素材。

| 技能 | 白名单内容 | 外部依赖与改编 |
|---|---|---|
| drock-image | SKILL、简写接口摘要、image-api.mjs | Node（需 fetch）、部署者服务访问权限；备用脚本只读 DROCK_IMAGE_API_KEY 或 DROCK_IMAGE_API_KEY_FILE，不扫描 Harness credentials YAML。优先已装 drock_media，禁止双重付费提交 |
| photo-modeling-lite | SKILL、方法 references、EVALUATION、compare.py | 视觉能力、可执行的 3D 工具；compare.py 可选依赖 Pillow。私人案例与旧建模项目替换为通用方法，无样件 |
| pinterest-reference-curator | SKILL、队列/选图 references、manifest.mjs | 匹配工具箱队列、视觉读图和专用浏览器、部署者登录；manifest 仅按需，无浏览器脚本或 cookies |
| tripo-model-processing | SKILL、plan/runner references、runner.py、worker.py | 独立 Python、Blender；通过 --blender 或 TRIPO_BLENDER_EXECUTABLE 指定，不附固定安装路径。所有输入新建视觉 plan，不附私人 plans/cache/GLB |

## 手工安装

将所需完整技能目录复制到部署者自己的 Harness 用户技能目录（通常 `~/.dsh/skills/<技能名>/`），保留 SKILL.md、references 和 scripts 的相对结构。已有同名技能先备份或比较，不覆盖未知定制。根据当前 Harness 文档刷新技能发现或新建会话，再调用 `skill` 核对名称和正文。套件 prepare 脚本准备插件，不会自动安装这些技能；不要把它们放进 profile 的 node_modules 当作 bundle 安装。

技能不会自动安装 Python、Pillow、Chrome、Blender、模型或付费服务。Tripo scripts 目录运行时会产生私有 `.cache`（含源路径、几何、渲染和验证数据），须可写、不得提交版本库；只分发源脚本，不能把运行后的整个目录重新打包。生产输出放独立目录，原输入不覆盖。

## 分发白名单和验证边界

仅复制本文所列文字与源代码，排除源 README 的个人维护记录、第三方网站整页抓取、私人照片、GLB/BLEND、源 hash 绑定的计划、凭据文件、缓存、日志、运行结果和截图。接口摘要重新编写，不把第三方站点全文作为自有材料发布。

本次可做静态语法和离线辅助函数检查，不执行付费请求、浏览器登录或真实建模；异机工具发现、生产效果、视觉判定、模型许可和服务额度仍需部署者验收。参考提示不保证自动成功。
