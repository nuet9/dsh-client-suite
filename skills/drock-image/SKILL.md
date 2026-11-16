---
name: drock-image
description: 通过配置的公司图像 API 使用腾讯生图模型生成图片、参考图变体或遮罩重绘。用户提到 tx 生图、image2.6、gpt-image-2.6-sunburst、flare、公司官网生图或本 Skill 时使用。
---

使用专门的 Images API；在普通聊天模型会话中调用此技能即可，不需要把会话模型切换到生图型号。

## 优先使用侧栏插件

如果已安装 @local/drock-media 且工具可用，优先调用 drock_media：仅需要了解模型时用get；generate默认使用侧栏设置，内部等待最多50秒，仍未完成时直接wait同一requestId。完成由插件在所属对话轮次自动展示唯一图片/视频预览，回复只给目录链接，不再嵌图或调用present制造第二份预览；Windows图片地址用C:/...，不可加开头斜杠写成/C:/...（会使图片API返回404）；目录链接仍用/C:/.../。工具已返回原生图片预览并自动保存交付副本，不再为常规交付调用read_image、shell复制/改名或present。status可查询/恢复旧任务，不重新生成。MJ及Seedance/Hailuo也统一使用该工具。保持普通对话模型；不要同时使用脚本重复提交同一任务。仅插件不可用时使用下述备用脚本流程。

## 执行

1. 脚本位置为本 Skill 同目录的 image-api.mjs。用 load_workspace_dependencies 获取 Node 的绝对路径。以后台脚本/terminal_send(run_in_background:true)运行，不启动 GUI。
2. 按用户需求写 UTF-8 request.json；必填 prompt，默认 model=gpt-image-2.6-sunburst、n=1、quality=auto、size=auto。仅在用户要求多图时增加 n（最多4）。outputDir 使用当前工作区下唯一输出目录。
3. 运行 node image-api.mjs check request.json，核实请求及 credentialAvailable。缺凭据时明确告知，不能换用其他分组密钥或从备份恢复已移除的 Key。
4. 运行 node image-api.mjs submit request.json。此操作使用公司积分；用户要求生成图片即授权该次生成。每次请求仅提交一次。
5. 返回 taskId 后，间隔约5秒运行 node image-api.mjs poll <返回的stateFile>，直到完成或失败；单次轮询只读任务并下载已完成图片。单阶段最多5分钟，超时保留 taskId/stateFile，向用户说明仍在生成，后续继续 poll，绝不重新 submit。非预期任务状态/响应结构时读取 state.json，先核对官网，不重复提交。
6. 输出图片必须下载并验证真实文件；官网 URL 10分钟过期。向用户给出预览（如可用）及末尾带斜杠的绝对目录链接，标为“打开系统文件夹”。报告真实结果，不把提交成功等同出图成功。

## 请求文件

```json
{
  "prompt": "用户的具体图像需求",
  "model": "gpt-image-2.6-sunburst",
  "n": 1,
  "quality": "auto",
  "size": "auto",
  "images": [],
  "outputDir": "当前工作区下的绝对输出目录"
}
```

images 可含最多16张本地 PNG/JPEG/WebP 路径或 HTTPS URL，脚本转为官网支持的 file_list；原始附件可直接读取，无需覆盖。mask 可选，仅接收已托管的 HTTPS 遮罩 URL，须与参考图同尺寸，白色区域重绘。图生图尺寸比例可能跟随参考图，不能承诺 size 精确生效。未经用户同意不把本地图上传到额外第三方图床。

quality 为 auto/low/medium/high；高画质更贵。size 支持 auto、1024x1024、1536x1024、1024x1536 等，4K及其他尺寸依赖上游。允许模型：gpt-image-2、gpt-image-2.5-flare、gpt-image-2.6-flare、gpt-image-2.5-sunburst、gpt-image-2.6-sunburst、gemini-3-pro-image-preview、gemini-3.1-flash-image-preview。除2.6 sunburst文档外其他模型未逐一验收。

## 凭据与排错

便携脚本只读取部署者设置的 DROCK_IMAGE_API_KEY，或 DROCK_IMAGE_API_KEY_FILE 指向的私密文本文件，不读取 Harness credentials YAML、不复用作者凭据名。密钥只用于认证，不写进 Skill、请求或输出，不向模型显示。Key应属于实际服务开放的图像分组；插件路线通过 Harness 设置独立配置凭据，脚本不自动迁移它。

Base URL=https://ai.freeflyagain.xyz/v1；POST /images/generations，JSON background=true；GET /images/tasks/{id} 查询。不要用 /chat/completions 或 /responses 判断该生图接口健康。401检查Key，429区分额度/限流，404检查模型与分组，500检查上游。超时提交的结果可能不确定，先查公司使用日志，避免重复扣费。

接口摘要见当前目录 api-reference.txt，当前参数和模型可用性须核对官网 https://ai.freeflyagain.xyz/modelSquare 。

验证边界：来源实现曾有异步文生图成功记录；本便携改编没有进行付费生成或异机服务验收。凭据改为部署者显式提供；静态语法通过不能证明配额、模型线路、参考图或遮罩可用。
