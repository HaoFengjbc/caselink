# CaseLink 内部测试直接 AI 调用发布记录

2026-10-09，America/New_York。用户明确要求删除全部站内 AI 付费保护；主会话完成修改、验证和生产发布。

## 发布与范围

- 正式站：https://caselink-eight.vercel.app
- 已发布业务提交：`2f78f06`；本记录是部署后的文档补充。
- 部署：`dpl_JDvxaxDQj6D9JA6mnXZNvhShJNjG`，`production / Ready`，创建于 18:00:31 ET；正式域名已指向本部署。
- [Vercel 详情](https://vercel.com/hao-s-projects-2154e1c6/caselink/JDvxaxDQj6D9JA6mnXZNvhShJNjG)。
- 删除 Redis 前置条件、IP/会话每日配额、全局日预算、预留核销、并发额度及前端手动重试次数上限。所有付费入口直接调用 provider；未改换模型。
- 删除配套服务器结果缓存和分布式幂等：每个 HTTP 重试都会重新执行；不再宣称服务器可去重。保留浏览器重复点击、输入版本和迟到响应保护。
- 保留案情隐私、领域和输入校验、引用验证及同源检查。技术超时和结构化输出长度控制仍用于响应有效性，不是费用额度。
- 未更改生产环境变量、OpenAI 账户控制台、原有访问配置或搜索服务配置。没有读取/输出密钥，没有 Git push。

主要变更文件：`src/lib/usage/*` 已删除；调用改为 `src/lib/ai/execution.ts` 的请求局部诊断。分析/整理/capabilities API、AI 与搜索 transport、AnalysisSubmit、请求与重试协议、语言文案、环境变量示例和验收脚本相应更新。完整文件列表见业务提交。

## 实际验证

| 验证 | 实际结果 |
| --- | --- |
| 本地回归 | 25 个测试文件通过，322 项通过、2 项跳过。旧 Redis 配额测试随已删除功能移除；新增直接调用、并发模拟、恢复与日志隔离测试。模拟 provider 仅作为离线测试证据。 |
| 静态与构建 | TypeScript 通过，Next.js 生产构建通过；云端构建与 36 页生成通过。 |
| 上传范围 | dry manifest 173 个条目、1,595,626 字节；私密文件、环境变量、浏览器资料和测试产物均排除。 |
| 正式站免费检查 | 15/15 通过，包括三类虚构规则报告、完整快照、手动整理、页面、公开案例及请求拒绝。18:01:24 ET 完成。此脚本模型调用为 0。 |
| 真实 AI 报告 | **1 次请求通过**：`live_ai`，模型 `gpt-6.1-sol`，综合阶段 46,820 ms，输入 18,770 tokens、输出 2,421 tokens；3 个案例、3 个行动、23 个来源、14 个引文，完整快照及证据引用验证通过。网页来源 0；报告如实标记搜索不可用。 |
| 真实 AI 整理 | **1 次请求未通过产品校验**：模型 `gpt-6-luna` 已完成返回，5,491 ms，输入 1,362 tokens、输出 595 tokens；服务端返回 `INVALID_MODEL_OUTPUT`。浏览器显示原话/问题校验失败，原输入仍在，可继续手动流程。不能记作整理功能通过。 |
| 浏览器 | 生产 `/new` 已显示“实时 AI 模式”，无付费/Redis 阻断提示。AI 整理失败后，原始叙述、目标、私下使用及披露限制保留，手动进入核对页正常。未再次提交付费请求。 |

本次共 **2 次真实模型请求、0 次搜索请求**，均使用虚构表达案件；这是验收次数，不是产品限额。实际金额未查询账户账单，记录为 `null`，不以 token 数编造支出。没有运行真实用户案例，也未保存虚构报告到用户浏览器历史。

线上 capabilities：`liveAvailable=true`，`paidProtectionEnabled=false`，`serverResultRetentionSeconds=0`，`idempotencyEnabled=false`，`webSearchAvailable=false`。

## 未完成与演示

1. 真实整理请求在 provider 返回后未通过原话/问题校验。当前诊断保留错误码及 token 元数据，不保存模型原文，尚不能判定具体哪一项失败。此问题与付费门槛无关；本轮没有弱化校验来伪造通过，应另行复现修复。
2. Brave 受控搜索配置仍缺失，本次没有真实联网验收。正式案例库 AI 综合已实测成功；不能说联网已恢复。
3. 本轮未重复历史保存/跨标签页删除/导入导出全流程验收；此前证据仍见原迭代验收，不据本轮回归扩大结论。

演示路径：正式站 → 开始新分析 → 虚构表达案件 → 填写叙述/目标/披露边界 → 手动核对 → 页面显示实时 AI 模式 → 主动提交生成行动参考。AI 整理可单独测试，当前有上述已知失败。规则参考入口继续可用，联网不可用说明可见。

仅本地保存、排除 Git 与上传的产物位于 `test-results/direct-ai-20261009/`：`tests.log`、`typecheck.log`、`build.log`、`deploy.log`、`vercel-inspect.txt`、`http-checks.json`、`live-ai-smoke.json`、`execution-logs.jsonl`、`intake-validation.jpg`、`live-ai-ready.jpg`。日志只含阶段与用量元数据，不含案情或模型正文。

上一部署 `dpl_4981LcNSHWJeuvRfUhFQFBvdUuVP` 保留，未回滚。该部署仍有本轮已移除的付费前置条件。
