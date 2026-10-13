# n8n-nodes-wan

通过**龙猫API**或**麦包API**的 `wan3.0-video` 在 n8n 中生成、编辑和延长视频。独立社区节点包，显示名为 **Wan 视频生成**。

默认 **1080P、自动比例、5 秒、有声、开启提示词改写、关闭水印**；创建任务默认等待完成并下载视频。视频编辑、延长默认自动时长。

当前版本 **0.1.1** · [GitHub 仓库](https://github.com/kkuxb/n8n-nodes-wan) · [版本更新记录](CHANGELOG.md) · [问题反馈](https://github.com/kkuxb/n8n-nodes-wan/issues)

## 安装

从 [v0.1.1 Release](https://github.com/kkuxb/n8n-nodes-wan/releases/tag/v0.1.1) 下载 `n8n-nodes-wan-0.1.1.tgz`，同页提供 `SHA256SUMS.txt` 用于校验。此版本通过 GitHub Release 分发，尚未发布 npm。

自行部署 n8n 时，在其社区节点目录中安装下载的包并重启 n8n：

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install /absolute/path/n8n-nodes-wan-0.1.1.tgz
```

Docker 部署需先将包挂载或复制进容器，使用容器内路径。安装目录由实际 n8n 用户目录决定，不要安装到不相关的宿主机全局目录。

从 0.1.0 升级也使用上述安装命令，然后重启 n8n。已有工作流和麦包凭证可继续使用；新建「Wan API」凭证默认选择龙猫API。切换服务商时，须同时使用该服务商的 Key，并在同一服务商查询其生成的任务。

开发与验收环境为 Node.js 24.15.0、n8n 2.20.9；包声明 Node.js >=22.16，其他 n8n 版本未逐一实测。无第三方运行时依赖；使用 n8n 提供的 HTTP、凭证和 binary helper。

## 凭证

创建「Wan API」凭证：

- **服务商**：默认「龙猫API」（`https://ai.lmao.net.cn`），也可选「麦包API」（`https://ai.maibao.chat`）。选择后自动使用对应根地址，接口后缀不变。
- **API Key**：所选服务商的 Key，由 n8n 加密保存；切换服务商时请填写对应 Key。

升级后已有麦包凭证保留原地址和工作流绑定；新建凭证默认龙猫API。内部凭证类型仍为 `maibaoWanApi`，原 `baseUrl` 字段改为服务商下拉框。旧版自定义地址仍保留；如需改用内置服务商，在下拉框重新选择并保存。

凭证测试读取模型列表，仅验证密钥可访问接口，不证明视频生成权限或余额足够。实际生成通过 `/api/v1/services/aigc/video-generation/video-synthesis`，查询通过 `/api/v1/tasks/{task_id}`。

## 创建任务

操作选「创建任务」，选择创建模式并填写对应参数：

| 模式 | 输入 |
| --- | --- |
| 文生视频 | 提示词 |
| 首帧图生视频 | 一张首帧图片，提示词可选 |
| 首尾帧图生视频 | 首帧和尾帧图片，提示词可选 |
| 多模态参考生视频 | 图片／视频／音频参考，提示词建议填写 |

默认等待完成后输出 `videoUrl` 和 `binary.video`。关闭「等待任务完成」时仅提交任务并返回 `taskId`；「下载视频」不会导致后台等待。

常用设置：

- 分辨率：480P、720P、1080P，默认 1080P。
- 宽高比：自适应、21:9、16:9、4:3、1:1、3:4、9:16。
- 时长：2–30 秒整数，`-1` 表示自动；有视频输入时，输入与输出时长合计不超过 30 秒。
- 高级选项：提示词改写、水印、随机种子。种子可设为 -1 或 0–2147483647，固定种子也不保证逐帧一致。
- 最终提示词最多 20000 字符；节点会校验自动补充任务指令后的长度。

## 参考素材

图片可选择 URL 或 Binary 文件，Binary 属性名填写上游字段名，例如 `data`、`image1`。节点通过 n8n binary 存储接口读取，支持 filesystem binary，不要求在 JSON 内手工 Base64。

视频和音频使用无需登录即可访问的 HTTP/HTTPS URL，不支持本地文件路径、火山 `asset://` 或 binary 上传。

| 素材 | 官方限制及本节点支持 |
| --- | --- |
| 图片 | JPEG/JPG、PNG、BMP、WEBP，单张 ≤20 MB；单边 240–8000 像素，比例不超过 8:1，不能有透明内容 |
| 参考图片 | 最多 10 张 |
| 参考视频 | 最多 5 段，MP4/MOV，单个 1–15 秒、总计 ≤15 秒，单文件 ≤100 MB |
| 参考音频 | 最多 5 段，WAV/MP3，单个 1–15 秒、总计 ≤15 秒，单文件 ≤15 MB |
| 全部参考 | 最多 20 项；不能与首尾帧混用 |

节点本地检查素材数量、组合、URL 协议，以及 binary 图片的文件签名和体积。像素、透明内容、文件完整性和远程素材的大小／时长由上游进一步检查；节点不会下载所有 URL 素材进行探测或自动压缩图片。完整细则见 [协议核对](docs/verification/protocol.md)。

提示词中的「图1」「视频1」「音频1」按各自类型分别编号。例如素材顺序为图片、视频、图片时，对应图1、视频1、图2。

## 视频编辑与延长

选择「多模态参考生视频」，再选择任务意图。

- **参考生成**：用户提示词原样提交。
- **视频编辑**：自动添加编辑目标及尽量保持未指定内容的指令，再附上用户正文。
- **视频延长**：选择向后、向前或双向，自动补充目标及方向指令；宽高比必须自适应。

编辑和延长必须填写正文并提供参考视频。「目标视频编号」按参考视频单独计数。只有一段视频时，默认 0 自动选中；多个视频时必须填 1–5 中实际存在的编号。

延长字段是**输出视频总时长**：原视频 5 秒，再延长 3 秒，填 **8**。填 -1 由模型自动决定。双向延长时在正文说明前后内容，方向属于模型根据提示词执行的意图，不能保证逐帧保持原视频或精确分配前后秒数。

输出 `requestSummary.originalPrompt` 和 `requestSummary.submittedPrompt` 可核对最终请求。`prompt_extend` 开启时，上游还可能再次改写提示词；摘要记录的是节点提交内容。

## 查询、等待和恢复

操作选「查询任务」，任务 ID 可用表达式 `{{ $json.taskId }}`。

- 开启等待：每 20 秒查询一次，默认最长 20 分钟，可调整。
- 关闭等待：只查询一次；若已成功且下载开启，同样输出 `binary.video`。
- 等待超时：`timedOut=true`，保留任务 ID 和最新状态；可用查询操作继续跟进，不必重新创建。
- 新任务可能短暂 `unknown`。节点最多观察连续未知 120 秒，超出后返回 `queryError`，不判为生成失败。
- 401／403 等查询错误停止；网络、429、5xx 最多连续重试 3 次，且受等待总时间限制。
- 下载失败保留 `isSuccess=true` 和 `videoUrl`，返回 `downloadError`；再次查询可重试下载。
- 创建 HTTP 超时为 180 秒，查询单请求最多 60 秒，下载最多 120 秒。创建不自动重发。

外部轮询工作流：

1. 创建任务：关闭等待。
2. Wait：等待约 20 秒。
3. 查询任务：关闭等待，任务 ID 使用 `{{ $json.taskId }}`；轮询上下文使用 `{{ $json.pollingContext || {} }}`。
4. IF 判断：成功进入后续保存节点；`shouldPoll=true` 回到 Wait；失败或 `queryError` 进入错误处理。

必须把轮询上下文带回下一次查询，避免每次执行都重置未知状态窗口。

可导入示例：[创建并下载](examples/create-and-download.json)、[外部 Wait 轮询](examples/resumable-polling.json)。导入后为 Wan 节点选择你的服务商凭证再执行，会产生视频生成费用。轮询示例的 IF false 输出包含成功结果或停止原因，后续可按 `isSuccess`、`error`、`queryError` 分别处理。

不要给「创建任务」开启 n8n 的 Retry On Fail，也不要把查询／下载的错误分支接回创建节点。一次创建响应超时可能已被服务商受理，先核实任务记录；手动重新执行创建也会生成新的付费任务。

## 输出

| 字段 | 含义 |
| --- | --- |
| `taskId` | 后续查询使用的 ID |
| `status` | queued／running／succeeded／failed／cancelled／expired／unknown |
| `providerStatus` | 服务商原始状态，例如 in_progress、completed |
| `videoUrl` | 成功结果 URL，建议及时转存 |
| `isSuccess`、`isFailure`、`isTerminal`、`shouldPoll` | 工作流判断字段 |
| `timedOut`、`pollCount`、`waitedMs`、`pollingContext` | 查询执行信息（查询或等待后提供） |
| `error` | 供应商明确的任务失败 |
| `queryError`／`resultError`／`downloadError` | 查询、结果解析或下载问题 |
| `downloaded`、`binary.video` | 下载状态与 MP4 文件 |
| `requestSummary` | 创建时有效参数和提示词，省略完整 binary |
| `raw` | 供应商原始响应，不包含请求认证头 |

`progress` 仅透传，不能用于预测剩余时间。查询／下载失败不等于视频生成失败。服务商的任务保留时间与结果 URL 有效期未独立核实，不套用官方账号或 Seedance 的期限承诺。

## 开发和验收

```bash
npm ci
npm test
npm run lint
npm pack
```

`scripts/live-test.mjs` 是显式授权后才能运行的付费验收工具，调用实际节点执行逻辑和 n8n-core HTTP helper；请求标记持久化以避免崩溃后重复提交。它要求本机测试依赖及凭据 helper，仅用于开发，不打入发布包。

`scripts/n8n-smoke.mjs` 在独立的 n8n CLI profile 中查询已有任务并下载，验证实际 n8n 执行和 filesystem binary，不创建视频任务。

测试证据在本机 `.local/`（Git 忽略），脱敏结论见 [验收报告](docs/verification/acceptance.md)。单次成片成功不代表所有素材或所有参数组合都有同样表现。

0.1.1 新增龙猫API地址选择，已覆盖本地路由、凭证测试表达式及旧凭证兼容性验证。已有付费生成验收均使用麦包；龙猫尚未进行真实生成测试。
