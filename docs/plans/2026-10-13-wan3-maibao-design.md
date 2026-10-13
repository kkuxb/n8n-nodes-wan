# 麦包 Wan 3.0 n8n 节点设计

日期：2026-10-13（Asia/Shanghai）

状态：用户已确认产品设计；最后调整为默认 1080P。本文保留设计阶段的证据边界；2026-10-13 实施与实测结果另见 `../verification/acceptance.md`。

## 1. 目标与交付边界

独立开发、发布 `n8n-nodes-wan`，节点显示名为「Wan 视频生成」。对接麦包提供的 `wan3.0-video`，复用现有 Seedance 节点的操作习惯和适用代码，不修改 Seedance 项目，不依赖用户同时安装 Seedance 包。

复用基线：`D:/Projects/n8n-nodes-seedance2`，参考提交 `6116086`，包版本 `1.5.0`。开发前重新检查源目录变更，只复制经过检查的必要文件，不复制密钥、node_modules、dist、开发运行时或历史工作流。

首版覆盖完整视频功能：

- 文生视频、首帧图生视频、首尾帧图生视频。
- 多模态参考：图片、视频、音频；任务意图为参考生成、视频编辑、视频延长。
- 创建任务、查询任务、等待完成、成功后下载视频。
- 图片 URL 与 n8n binary 输入；视频和音频 URL 输入。

首版不包含：文档／网页参考、视频／音频 binary 上传、对象存储、火山素材库、Seedream 图像生成、Prime 模型、任务列表、取消／删除任务、MOV 输出、返回尾帧图。扩展这些功能须有麦包接口依据和单独验收。

## 2. 证据与未验证能力

来源会话：`codex://threads/01a13068-6d34-7011-b67f-1b9c93712993`，标题「核实 Wan 3.0 人脸参考素材支持」。

本机证据：

- `C:/Users/Administrator/.codex/outputs/maibao-wan3-test-20261012/测试报告.md`
- `C:/Users/Administrator/.codex/outputs/maibao-wan3-round2-20261012/第二轮测试报告.md`
- `C:/Users/Administrator/.codex/outputs/maibao-wan3-round2-20261012/request.json`

已实测：

| 项目 | 结论 |
| --- | --- |
| 模型 | `wan3.0-video` |
| 文生视频 | 480P、16:9、5 秒、无音轨成功 |
| 人物图片 URL＋音频 URL | 720P、9:16、8 秒、有音轨成功 |
| 水印 | 第二轮成片可见；开关请求被接受 |
| seed、prompt_extend | 请求被接受；固定 seed 的复现效果、实际关闭改写未独立验证 |
| 创建返回 | 顶层 `task_id`／`id`、`status: queued` |
| 查询返回 | `in_progress`／`completed`；视频在 `metadata.url` |
| 初始 unknown | 新任务短暂 unknown 后恢复并完成，不能直接判失败 |

发布前待验证：1080P 默认规格、图片 Base64 直传（首帧／尾帧／参考图）、首尾帧、视频参考、纯音频参考的适用规则、视频编辑与延长及边界组合。不能把官方支持或 HTTP 200 等同于麦包成片能力验证。

协议核对参考：

- https://docs.bailian.console.aliyun.com/zh/model-studio/wan3-video-generation-api-reference
- https://docs.bailian.console.aliyun.com/zh/model-studio/wan3-video-generation-guide

文档规则和麦包实际行为冲突时保留证据，调整适配或提交设计变更，不静默降级已确认功能。

## 3. 凭证与接口

凭证显示名「麦包 Wan API」，内部名建议 `maibaoWanApi`：

- API Key：password 字段，由 n8n 凭证系统保存。
- Base URL：默认 `https://ai.maibao.chat`，表示根地址；统一处理末尾斜杠。
- 用户不需要百炼地域、业务空间 ID 或官方密钥。

认证：`Authorization: Bearer <麦包 API Key>`。

创建：`POST /api/v1/services/aigc/video-generation/video-synthesis`，请求头包含 `Content-Type: application/json` 和 `X-DashScope-Async: enable`。

查询：`GET /api/v1/tasks/{task_id}`；编码 taskId，避免拼接为额外路径。

创建请求结构：

```json
{
  "model": "wan3.0-video",
  "input": { "prompt": "实际提交提示词" },
  "parameters": {
    "resolution": "1080P",
    "ratio": "adaptive",
    "duration": 5,
    "audio": true,
    "prompt_extend": true,
    "watermark": false
  }
}
```

有素材时附加 `input.media: [{ type, url }]`。不使用 `/v1/chat/completions`，不添加 `/alibailian` 前缀。

开发实测可复用此前保存的 Windows 凭据，但不得把读取 Windows 凭据的逻辑加入发布包；运行时仅依赖 n8n 凭证。文档、测试夹具、日志、输出摘要不得包含 API Key 或完整 Base64。

## 4. 界面与默认值

顶层操作为「创建任务」和「查询任务」，不显示无其他选项的图像／视频生成模式选择。

创建字段：模型、创建模式、提示词、当前模式所需素材、分辨率、比例、时长、生成音频、高级选项、等待及下载设置。

| 参数 | 默认值 | 规则 |
| --- | --- | --- |
| 模型 | `wan3.0-video` | 首版仅此模型 |
| 创建模式 | 文生视频 | 可选首帧、首尾帧、多模态 |
| 分辨率 | **1080P** | 480P／720P／1080P；发送大写 P |
| 比例 | adaptive | 固定比例按 Wan 支持范围提供 |
| 普通生成时长 | 5 秒 | 2–30 秒整数或自动 `-1`，发布前复核适用规则 |
| 生成音频 | true | 映射 `audio` |
| 提示词改写 | true | 映射 `prompt_extend` |
| 水印 | false | 显式发送 `watermark: false` |
| 随机种子 | 不指定 | 未填写时省略 `seed`，不把 0 当未填写 |
| 等待完成 | true | 创建和查询均支持关闭 |
| 下载视频 | true | 单次查询已成功也可下载，不依赖等待开关 |
| 查询间隔 | 20 秒 | 内部统一常量 |
| 最长等待 | 20 分钟 | 界面允许正整数分钟 |

比例候选：21:9、16:9、4:3、1:1、3:4、9:16、adaptive；按核实的协议建立统一常量。

视频编辑默认 adaptive、自动时长；视频延长默认向后延长、adaptive、自动时长。自动时长以 `-1` 发送。不要继承 Seedance 对 Wan 不适用的强制参数锁定。

## 5. 素材与意图

首帧／首尾帧使用独立图片字段；多模态使用可重复添加的素材条目。每条包含类型、来源及相应 URL 或 binary 属性名。

图片 binary 使用 n8n `getBinaryDataBuffer` 获取，不能假设 binary.data 是内存 Base64。验证 MIME、体积和空文件后转换为 data URL；是否允许直传及具体格式／大小限制先核实麦包。视频、音频只接受可访问 URL，不接受 `asset://`、本地路径或假装支持官方临时 OSS。

素材数量、组合互斥和格式按已核实 Wan 规则校验。前一会话记录的规则包括参考图片最多 10 张、视频最多 5 段、音频最多 5 段、全部素材最多 20 项，首尾帧不与参考素材混用；正式实现前复核原文和麦包适用性。

URL 媒体的时长、大小不能只凭扩展名确定。首版不额外增加远程视频时长探测；无法本地验证的时长合计限制由界面说明并保留上游明确错误，不能声称已完成本地检查。

编辑／延长必须有参考视频。一个视频时自动选定目标；多个视频时让用户通过稳定的素材位置明确选择目标，不擅自把第一个当目标。提示词中的视频编号按供应商规则由素材列表推导并测试；不重排素材、不重写用户已有的编号。

提示词策略：

- 参考生成：原样提交用户提示词，不添加任务模板。
- 编辑：前置明确目标的指令，例如「编辑视频1，按以下要求修改，未指定修改的内容尽量保持不变。」再换行附上正文。
- 延长：根据向后／向前／双向选择，前置明确目标和方向的指令，换行附上正文。
- 双向延长由用户正文描述前后段内容；首版不提供未经核实的前后秒数 API 字段。
- 编辑／延长要求正文非空。普通生成各模式的提示词必填规则按核实协议确定，不照搬 Seedance 的可选条件。
- 保存 `requestSummary.originalPrompt` 与 `requestSummary.submittedPrompt`。多模态任务意图是节点交互及提示词编排，不发送虚构的 API mode 字段。

延长时长字段明确显示「输出视频总时长」。原视频 5 秒、增加 3 秒时填 8 秒；不把 8 作为新增秒数，不自动读取或累加原视频时长。

## 6. 执行流程与恢复

创建流程：读取当前 item → 解析参数和素材 → 本地校验 → 编排提示词 → 提交一次 → 提取 taskId → 按等待设置返回或查询 → 成功后按设置下载。

独立查询：读取 taskId 和可选的上次轮询上下文 → 单次查询或等待 → 成功时按下载设置下载。支持与 n8n Wait／IF 节点组合。

创建成功但拿不到 taskId，或创建网络超时无法判断是否已受理：返回可理解的错误及已知请求标识，不自动重发 POST。用户主动重跑创建节点仍可能产生新任务，界面文档需说明。

短暂 unknown 建议采用 120 秒有限宽限期作为实现初值，并在验收中调整。记录首次 unknown 时间；恢复正常状态后清除连续 unknown 计时。外部 Wait 循环需传递 `pollingContext`，不能每次执行重置宽限期而无限等待。无创建时间和历史上下文的独立查询也只给有限观察窗口。

unknown 超出窗口：保持 `status: unknown`，`isFailure: false`、`isSuccess: false`、`isTerminal: false`、`shouldPoll: false`，返回查询异常；不推断服务端任务失败。401／403 等不可恢复查询错误停止；429、网络错误、5xx 使用有限重试且受总等待截止时间约束，耗尽后保留 taskId 和最近可信状态，单独报告 queryError。

等待超时：`timedOut: true`，保留最新任务状态；queued／running 仍可 `shouldPoll: true`，可用查询操作继续跟进。查询请求自身必须有超时，单个请求不能无限越过等待截止时间。

只有明确任务失败响应才设置 `isFailure: true`。查询异常、下载异常和本地等待超时不等于生成失败。

## 7. 输出契约

保留 Seedance 下游常用字段：

- `taskId`、`model`、`status`、`videoUrl`。
- `isSuccess`、`isFailure`、`isTerminal`、`shouldPoll`。
- `error`：供应商明确的任务失败原因。
- `raw`：供应商 JSON 响应；不附带认证请求头。
- `requestSummary`：有效参数、原提示词、提交提示词、素材类型及来源计数，不包含完整 binary 数据。

补充 `providerStatus`、供应商实际提供的 `progress`／`requestId`／`usage`、`timedOut`、`pollCount`、`waitedMs`、`pollingContext`、`queryError`、`downloadError`、`downloaded`。

状态：`queued → queued`、`in_progress → running`、`completed → succeeded`；其他明确终态依据实际协议添加。保留原始状态值，不以进度 100 单独推断成功，不根据官方 retention 写入未经麦包核实的有效期承诺。

taskId 优先 `task_id`，其次 `id`；成功视频地址读取 `metadata.url`。只有有证据支持时增加其他 schema 分支。缺少成功视频 URL 时返回独立的结果解析异常，禁止下载 undefined，也不自动重建任务。

下载使用返回的视频 URL，不携带麦包 API Key；通过 n8n `prepareBinaryData` 写入 `binary.video`。下载失败保留成功任务状态和 URL，返回 downloadError；通过查询操作可重试下载。多 item 输出保留 `pairedItem`，按 n8n continueOnFail 约定隔离失败 item。

## 8. 代码边界与复用

使用 TypeScript 和 n8n node CLI，沿用 Seedance 的 description／shared 拆分习惯。Wan 执行入口负责参数读取与流程编排，纯函数负责请求构造、校验、提示词和响应映射。

可参考复用：

- `nodes/Seedance/description/create.operation.ts`、`get.operation.ts`：界面组织。
- `nodes/Seedance/Seedance.node.ts`：binary 读取、item 关联。
- `nodes/Seedance/shared/transport/request.ts`：HTTP／下载方法。
- `nodes/Seedance/shared/polling/getTaskPolling.ts`：注入时钟和休眠后的轮询思路。
- `nodes/Seedance/shared/mappers/task.ts`：输出字段习惯。

必须重写：凭证、接口路径、payload、模型能力、媒体限制、状态解析、unknown 宽限策略；不直接复制绑定火山协议的函数。

## 9. 验收与发布条件

自动化验证：真实脱敏响应解析、参数边界、提示词编号、状态序列、超时／网络错误、POST 不重发、下载失败恢复、多 item 关联、binary 读取；使用模拟时钟避免真实等待。

实测验收：默认 1080P 文生视频；图片 binary 首帧；URL 首尾帧；图片 binary＋音频 URL；视频 URL 参考；编辑目标视频；延长目标视频且输出总时长正确；前向／双向如纳入界面则验证其行为。复用既有输出作素材可减少重复生成。每个请求仅创建一次，后续沿用原 taskId。

使用 ffprobe 检查尺寸、时长、帧率和音轨；用抽帧／播放检查首尾帧、编辑效果和延长连续性。请求接受与参数实际生效分开记录。不能用模拟测试替代付费接口验收，也不能因上游拒绝就静默降到 720P 或删除 binary 功能。

完成构建、lint、必要单测和 npm 打包检查，说明实测结果与限制。文档提供默认一步生成、拆分 Wait 轮询、超时续查、下载重试、binary 图片和视频延长示例。

设计阶段只完成设计与实施计划。后续用户明确授权实施和必要付费测试，已完成结果见验收报告；未发布 npm 包。
