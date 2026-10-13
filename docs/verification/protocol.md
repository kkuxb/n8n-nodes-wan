# Wan 3.0 协议核对

核对日期：2026-10-13（Asia/Shanghai）。使用 agent-reach 的 Jina Reader 网页读取方式核对官方 API 原文，结合麦包真实响应适配。

来源：

- https://docs.bailian.console.aliyun.com/zh/model-studio/wan3-video-generation-api-reference
- https://docs.bailian.console.aliyun.com/zh/model-studio/wan3-video-generation-guide
- 本项目设计文档列出的 2026-10-12 麦包两轮实测报告。

## 已核对规则

1. 请求体 `model/input/parameters`；提示词和素材必填其一，提示词最多 20000 字符。
2. 图片、视频、音频引用分别编号；第一个 reference_video 对应视频1，不是整个数组的第一个元素。
3. first_frame、last_frame、reference_image 支持公网 URL 或 data URL Base64。JPEG/JPG、PNG、BMP、WEBP，≤20 MB；单边 240–8000，最大长宽比 8:1；PNG 不支持透明内容。
4. reference_video：MP4/MOV，单个 1–15 秒，总时长 ≤15 秒，帧率 ≥16，单边 240–4096，比例 ≤8:1，单文件 ≤100 MB。
5. reference_audio：WAV/MP3，单个 1–15 秒，总时长 ≤15 秒，单文件 ≤15 MB。
6. 参考图片最多 10 张，参考视频／音频各最多 5 项，媒体总数最多 20。首尾帧与参考素材互斥；三种参考类型可组合。
7. 分辨率 480P／720P／1080P；默认 1080P。
8. 比例 21:9、16:9、4:3、1:1、3:4、9:16、adaptive。延长必须 adaptive。
9. duration 默认 5，支持 2–30 秒整数或 -1 智能时长；有视频输入时，输入视频总时长＋输出时长不超过 30 秒。
10. seed 为 -1 或 0–2147483647；相同 seed 也不保证结果完全一致。
11. audio 默认 true，prompt_extend 默认 true；本节点显式发送 watermark=false 默认值。

## 实现边界

节点本地检查数量、组合、标量范围、提示词长度、URL 协议以及 binary 图片文件签名／体积。没有引入第三方运行时图像解析依赖；图片像素、透明内容、完整性与远程媒体的时长／大小由上游校验。请勿把本地可检查项写成已检查全部素材限制。

麦包返回顶层 task_id/id/status 和 metadata.url，不能照搬官方 output 结构。新任务 unknown 采用 120 秒观察窗口；实际成片能力以验收报告为准。

模型只支持 wan3.0-video。凭证的 GET /v1/models 测试只验证接口认证，不表示具备实际生成权限。

## 本次实测带来的调整

- 2 MB PNG binary＋音频创建曾在 60 秒超时，结果不明确；未自动重发。
- 创建 HTTP 超时调整为 180 秒，以容纳 Base64 上传和供应商受理延迟；查询和下载仍保持独立超时。
- 图片不做自动压缩或缩放；补充的小 JPEG 是验收素材的单独预处理，不是节点行为。
