# 麦包 Wan 3.0 节点验收报告

日期：2026-10-13（Asia/Shanghai）。版本：0.1.0。用户在本会话明确授权实施及必要的付费测试。

结论：9 个取得任务 ID 的用例全部完成生成、下载和解码验证；另有 1 条创建响应超时，未重试，受理与扣费状态未知。核心功能验收通过，精确扣费金额未核实。

## 实施内容

独立包 `n8n-nodes-wan`，默认 1080P。已实现文生、首帧、首尾帧、多模态参考，以及视频编辑和向前／向后／双向延长。图片支持 URL／binary，音视频支持 URL。默认创建后等待并下载，另有独立查询、有限 unknown 观察、超时续查及下载失败恢复。

创建请求一次提交，180 秒超时，不自动重发。图片不在节点内自动缩放或压缩。延长时长表示最终输出视频总时长。

## 自动化与实际 n8n

- 构建通过，TypeScript strict 模式。
- `npm run lint` 通过，保留 n8n Cloud 兼容规则，未禁用规则绕过检查。
- `npm test`：31 项行为测试通过，覆盖请求、校验、binary helper、task_id 优先级、状态、unknown、外部轮询上下文、超时、查询有限重试、取消、下载恢复、多 item、continueOnFail、默认值。
- Node.js 24.15.0、n8n 2.20.9 CLI 独立 profile 实际执行成功：查询已完成的真实任务，下载 8,762,237 字节 MP4，binary.data 为 `filesystem-v2`，文件引用由 n8n binary 服务管理。
- n8n 凭证通过 CLI 导入隔离的本地 profile 后由 n8n 加密保存；导入所需的临时明文文件已删除。测试 helper 和凭据不打入安装包。
- 工作流示例的节点引用和连接已检查；完整外部 Wait 示例未另行提交付费执行，内部行为通过自动化测试覆盖。
- 本地 `.tgz` 安装包已解包并由 n8n `PackageDirectoryLoader` 加载成功：包名 n8n-nodes-wan，节点 wan，凭证 maibaoWanApi。包内容仅含 dist、README、许可证、脱敏验收文档和工作流示例，不含本机证据、脚本或密钥。

## 付费测试结果

通过真实节点 `Wan.execute` 以及 n8n-core 的 HTTP helper 调用麦包；首次创建立即持久化任务 ID，后续只查询该 ID。验收 helper 的 binary 输入读取和输出落盘适配在本机执行；真实 n8n filesystem binary 下载另经上节 CLI 验证。

为控制费用，除默认规格用例外，新模式使用 480P 和较短时长。以下成功项均已下载、ffprobe 检查并完成 ffmpeg 全文件解码。

| 用例 | Task ID | 视频规格 | 观察与结论 |
| --- | --- | --- | --- |
| 默认文生视频 | task_ReVN20lbI6gi6Ejm9KI0NGd4JIXkDlCk | 1920×1080，5 秒，30fps，有音轨 | 橙色机器人在木桌上由左向右行走；默认 1080P 通过 |
| 图片 binary 首帧 | task_RtHdF5CuxDjD5eC4veK5bBZISwC4GlSJ | 854×480，2 秒，30fps，有音轨 | WEBP 经 binary helper 转 data URL；首帧南瓜画面保持，镜头推进 |
| URL 首尾帧 | task_17clE4kr9hMuWoipthcYsUu4PxH6b3IV | 854×480，3 秒，30fps，有音轨 | 从南瓜到兔子的过渡，与官方首尾帧样例对应 |
| 视频参考 | task_dDoRU4pTwGljgPZ9seEtEzugWUWagB3b | 854×480，3 秒，30fps，有音轨 | 保留橙色机器人的外观及行走动作，桌面按提示变为白色 |
| 视频编辑 | task_rb3lVlr0NuvlKLpDrVuIePyB9U0lIviH | 854×480，5 秒，30fps，有音轨 | 蓝背景变为粉红色；机器人和木桌保持可见 |
| 向后延长 | task_6v2k22FwV2QAjaqpOk9GrfLjcQm2GlKn | 854×480，8 秒，30fps，有音轨 | 前段沿用行走，后段增加挥手；最终时长不是 5＋8 秒 |
| 向前延长 | task_MV8FEK9PCNPzwCm3lAuVJCJBlvevB8yX | 854×480，8 秒，30fps，有音轨 | 前段增加起步过程，再接入行走 |
| 双向延长 | task_BDREninFyAQbOhbgIp2yt0aaMGsFpsmy | 854×480，8 秒，30fps，有音轨 | 前段从画面左边入场，后段新增挥手 |
| 小 JPEG binary＋音频 URL | task_if53mgQL9jgKUzfHEHRcqyIE9PJ8qvn6 | 550×742，2 秒，30fps，有音轨 | JPEG binary 经 Base64 提交成功；保留眼镜、黑发和米色毛衣，人物有说话动作 |

三个延长用例使用同一条 5 秒原视频、最终时长均传 8。抽帧验证了方向性，另以 2fps／160×90 灰度帧做滑动比对：原动作与向后结果最接近的起点为 0 秒，向前约 2.5 秒，双向约 0.5 秒。该比对仅支持动作段位置的观察，不是逐帧原片保留、前后时长精确分配或质量保证。

## 一条创建响应超时

原始 `binary-audio-reference` 用例：2,080,420 字节 PNG＋音频 URL，在旧的 60 秒创建超时下没有取得响应或任务 ID。未自动或手动重发该请求，不能确认是否已受理／扣费。

随后将节点创建超时提高为 180 秒，使用单独预处理的 61,336 字节 JPEG、不同提示词与 2 秒输出，建立 `binary-audio-compact` 补充验收。该请求已取得独立 taskId 并生成、下载成功。图片大小和超时同时改变，不能据此单独归因于某一个因素。节点本身不做图片压缩。

所有 taskId 已保留，未查询或核实供应商实际扣费金额。不要把「9 个有 ID 的任务」等同于「只扣了 9 次费用」。

## 已观察到的供应商行为

- 新任务多次先返回 unknown，再转 in_progress。保留有限观察窗口必要，不能立即判永久失败。
- 部分 in_progress 响应已带 completed_at；节点仍按 status 判断，避免提前认定成功。
- 麦包完成状态为 completed，视频在 metadata.url，节点统一映射为 succeeded。
- 音频容器时长可略长于视频流；表格采用视频流时长。
- 自适应比例下实际像素不一定以分辨率标签作为短边。本次 480P 人物参考得到 550×742；报告记录实际像素，没有改写成 480×其他尺寸。

## 本机证据与复现

工作区 `.local/live/<用例名>/` 保存脱敏请求、创建响应、查询时间线、结果、视频、probe.json 和 contact.jpg。完整视频 URL 含供应商签名，保留在被 Git 忽略的本机证据目录，不写入公开文档。

- `.local/live/media-summary.json`：媒体规格与全文件解码结果。
- `.local/live/extension-alignment.json`：延长方向辅助比对。
- `.local/n8n-smoke/summary.json`：实际 n8n CLI 执行和 filesystem binary 结果。
- `scripts/live-test.mjs`：显式授权后运行的付费验收脚本，持久化提交标记避免重复生成。
- `scripts/inspect-live.py`、`scripts/compare-extension.py`：本地媒体检查，无 API 调用。
- `scripts/n8n-smoke.mjs`：实际 n8n 查询下载，无新生成。

## 验证边界

这是单组代表素材的验收，不是所有分辨率×素材组合的穷举。1080P 已通过文生视频验收，其他新增模式本轮主要为 480P；720P 和人物图片 URL＋音频 URL 的历史实测见设计文档。

固定 seed 的复现效果、服务端提示词改写是否实际关闭、台词准确性和音色相似度未独立评测。本节点的任务意图通过提示词表达，模型语义效果不能保证。素材限额的本地校验范围见协议文档，未宣称完整解码所有输入媒体。

尚未发布 npm，也未更改已有 Seedance 节点或用户生产 n8n 的配置。

## 0.1.1 服务商选择验证（2026-10-13）

凭证新增「服务商」下拉框：龙猫API（默认，`https://ai.lmao.net.cn`）和麦包API（`https://ai.maibao.chat`）。沿用 `baseUrl` 存储字段和 `maibaoWanApi` 凭证类型，已有麦包凭证保留原服务商及工作流绑定。

- `npm test`：35/35 通过，包含使用 n8n 的默认值合并验证新凭证默认龙猫、旧麦包地址保留。
- 两家服务商均通过模拟请求验证：创建和查询只切换根地址，路径、模型、参数和认证头保持不变；凭证测试表达式使用 n8n 表达式引擎验证，仍请求 `/v1/models`。
- `npm run lint`：通过。等待完成并默认下载的已有回归测试通过。
- 0.1.1 发布包：使用实际 n8n `PackageDirectoryLoader` 加载打包后的节点和凭证成功，默认服务商为龙猫API；版本号及包内容已核对。
- 本次未新增付费请求，也未使用麦包密钥调用龙猫。上文真实生成及 n8n CLI 验收来自 0.1.0 的麦包测试，不能视为龙猫真实生成验收。
