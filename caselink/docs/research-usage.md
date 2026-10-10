# CaseLink 研究调用与执行记录

2026-10-09 用户明确要求移除全部站内付费保护，用于内部测试。此说明替代先前 Redis 预算/配额方案；此前交付文档保留历史事实，不代表当前调用方式。

## 当前配置

实时 AI 仅需 `ANALYSIS_MODE=live`、`OPENAI_API_KEY`、`OPENAI_MODEL`，整理模型沿用 `OPENAI_INTAKE_MODEL`。不需要 Redis、会话密钥、审核价格表、每日金额、IP/会话请求额度或并发上限。旧用量环境变量即使存在也不再被应用读取。

删除了用量计数、预留与核销、租约、付费前置拦截、匿名用量 Cookie、服务器结果缓存及前端两次尝试上限。没有用单进程内存限制替代它们。

`/api/capabilities` 返回 `paidProtectionEnabled:false`、`serverResultRetentionSeconds:0`、`idempotencyEnabled:false`；`liveAvailable` 只取决于 live 模式和必要模型配置。它是配置检查，真实连通性须通过模型请求单独验证。

## 请求与隐私

`requestId`、`inputVersion`、`operation` 和可选 `parentAnalysisId` 保留用于标识用户操作。每个 HTTP 请求直接执行，不使用 Cookie 握手、共享缓存或分布式幂等；同 ID 再次提交也会重新调用。没有服务器存档可跨用户返回。补查仍由新的用户操作触发，服务器不再维护父报告留存或跨请求的完整轮次链；`round` 为本次初查/补查标识（1/2），不是累计研究次数。

浏览器仍防止同一按钮连点，取消和输入变更后不采用迟到结果；这些是状态正确性逻辑，不是付费额度。可重试错误由用户主动重试，没有次数上限。SDK 不自动重放请求。

用户关闭 AI、规则/手动模式、表达案件领域校验、输入格式与请求体边界、同源检查、内容与引用验证保留。服务超时和结构化输出长度控制用于完成有效响应，不是日预算或费用预留。API 自身的限流、模型错误和额度错误如实显示；本站没有修改 OpenAI 账户限制。

CaseLink 不在服务器缓存案情/报告；浏览器仍默认内存、仅主动保存才进入历史，单独同意才刷新恢复。OpenAI 请求继续 `store:false`；不据此保证上游平台的全部留存政策。

## 可选联网

联网复用 `ANALYSIS_MODE=live`、`OPENAI_API_KEY`、`OPENAI_MODEL`，不再需要 Brave Search 密钥。`OPENAI_WEB_SEARCH_ENABLED` 缺省启用，设为 `false` 可明确关闭；它不会覆盖用户关闭 AI 或选择规则参考。能力接口的 `webSearchProvider=openai`、`webSearchAvailable` 只描述配置状态，不证明上游连通或额度充足。`controlledSearchConfigured=false` 保留旧字段的准确含义，不把 OpenAI 搜索说成固定字面查询。

服务器从规范化地区、刑民程序、阶段和批准的议题类别构造最多两条种子查询，发送前再次校验。原始案情、上传原文、用户姓名、具体披露笔记及自由研究计划不传入搜索模型；完整案情只进入无搜索工具的整理和综合。OpenAI 工具可以基于公开资料扩展查询，不能声称所有实际搜索词都逐字固定。实际返回的查询另行保留，不把种子词冒充执行记录。

一次明确提交只运行一轮：发现来源（一次 OpenAI 请求，最多 3 次工具调用）、读取最多 3 个候选来源（一次请求，最多 6 次工具调用）、无工具综合。发现与读取共用 65 秒，总分析保留 270 秒截止时间。没有自动第二轮或 SDK 重试。明确点击补查才产生新一轮。

读取阶段必须有候选 URL 的 completed open_page；只保留该阶段与已打开 URL 绑定的引用段落。不采纳发现摘要、不将未打开来源掺入已读段落。打开页面不保证正文完整、判断正确、法律适用或团队核实；这些状态仍须分开。规则参考不会联网，搜索失败会如实保留失败状态并尝试现有库综合。若综合失败，规则草稿与真实取得的来源可保留，但不能声称真实 AI 分析成功。旧报告保留其原快照与当时读取状态。

接口依据：[OpenAI 官方 Web search 文档](https://developers.openai.com/api/docs/guides/tools-web-search)，2026-10-10 查阅。实际真实调用记录见本次恢复搜索验收文档。

## 执行记录

`src/lib/ai/execution.ts` 仅使用请求局部 AsyncLocalStorage 记录实际模型、response ID、token 数、工具调用、阶段耗时和失败阶段；没有计数器或锁。即使没有诊断上下文，transport 也可直接执行。

不打印输入、prompt、模型文本、IP、Cookie 或密钥。没有价格表时费用是 `null`，不能将真实付费请求标成零费用。无需外部调用的规则/手动请求为零。运行记录不是实时进度事件。

## 验证边界

针对性测试覆盖无配置直通、35 个并发模拟整理请求、失败后再提交、输入变化和补查、请求局部记录隔离、隐私日志及零服务器结果缓存。模拟 provider 不等于真实 AI 成功；真实发布与少量虚构案件的调用结果单独记入发布文档。

上游错误分类参考：[OpenAI rate limits](https://developers.openai.com/api/docs/guides/rate-limits)。本文没有操作账户控制台或声称移除了提供商限制。
