# PDF 建档生产发布

> 当前生产修复为 `9657313`：[日期格式匹配与人工核对](date-review-fix.md)。此前 [30 秒超时修复](timeout-fix.md) 为 `c44840c`，[排版引文校验与诊断](validation-fix.md) 为 `babb63f`。下文保留首次上线验收事实。

2026-10-09，America/New_York。用户明确要求“上到生产页面”，本轮完成发布。

## 已上线

- 正式上传入口：[CaseLink 上传案件材料](https://caselink-eight.vercel.app/new)。
- 部署 `dpl_eDfnV1NLF7tjWZhhU5Lib7WsPNBo`，`production / Ready`；正式别名已核验指向此部署。
- [Vercel 部署详情](https://vercel.com/hao-s-projects-2154e1c6/caselink/eDfnV1NLF7tjWZhhU5Lib7WsPNBo)。部署创建于 18:13:57 ET，18:17 ET 完成正式域名验证。
- 上线业务源码：`d9e9292`，分支 `codex/caselink-pdf-intake`，整合 PDF 本地版本 `9440c58` 与已上线主线 `b6d444d`。
- 先 `deploy --prod --skip-domain` 构建独立部署，验证云端解析与真实提取，再 `vercel promote` 切换正式别名。切换前确认正式站仍为此前检查的版本，没有覆盖并行新部署。
- 原生产版本 `dpl_JDvxaxDQj6D9JA6mnXZNvhShJNjG` 保留可回退；本轮未回滚。

## 与首次本地验收的差异

最初 PDF 分支保留 Redis 预算控制；生产主线已在另一轮按用户要求移除该方案。本次部署保留当前生产直连 AI 行为，PDF 使用同一请求局部执行记录，未重新加回 Redis、价格表、日预算、用量 Cookie、服务端结果缓存或重试次数门槛。每次主动重试会重新执行。

保留明确 AI 同意、文件/请求体边界、同源检查、逐页引文校验、技术超时、迟到响应保护与内存清理。每进程最多两个解析 worker 是 PDF 解析资源保护，不是模型付费并发配额；繁忙返回 `PARSER_BUSY`。

没有读取/输出生产模型密钥，没有更改模型、生产环境变量或 OpenAI 账户控制台。`OPENAI_INTAKE_MODEL=gpt-6-luna` 真实验证成功；正式库 AI 综合沿用已上线配置。公开搜索当前仍未配置，不影响 PDF 提取。

原 `/Users/fenghao/Desktop/hackhaton` 含另一条资料扩充工作线的未提交改动，本轮没有修改、暂存或合并这些文件。生产源码在上述独立分支；后续发布请以该集成提交为基础，避免从旧 main 单独发布而丢失 PDF 功能。

## 实际结果

| 检查 | 结果 |
| --- | --- |
| 整合后全量单元/服务测试 | 29 个测试文件；357 项通过、2 项缺少既有 provider 录制样本而跳过。数量相对初次验收变化来自整合当前主线已删除的用量测试。 |
| 静态与构建 | TypeScript、本地 Next webpack 生产构建、Vercel npm ci / TypeScript / 37 页构建均通过。 |
| 本地 PDF 浏览器 | 9 项通过，包含模拟提取交互、手动录入到规则结果和真实 PDF HTTP 解析。 |
| 上传清单 | 139 个普通文件、1,416,425 字节；环境文件、密钥、本地原文、文档、开发脚本、测试 PDF 和截图排除。 |
| 云端原始解析 | 两份真实 PDF、共 3 物理页全部提取；本地文字模式没有模型阶段。 |
| **真实 AI 提取** | **1 次 `gpt-6-luna` 成功**：27,018 ms，输入 1,700 tokens，输出 3,439 tokens，0 工具调用。合并为同一案件，18 个提取项，1 处收函日期冲突；全部引文与对应物理页文字逐项匹配。 |
| 正式域名免费 HTTP | **15/15 通过**，包括三类规则报告/完整快照、页面、同源拒绝、手动整理与新版 PDF 能力字段。旧检查脚本原先未允许新增 PDF 字段，已更新并重跑通过；4 项验收脚本测试通过。 |
| 正式域名 PDF | **2 项 Playwright 通过**：实际双 PDF、扫描、空白、加密、损坏、31 页和文字预算检查；真实浏览器关闭 AI 读取/移除/扫描提示。 |
| 正式浏览器核对 | 复用前面**同一次真实 AI 响应**，未再次收费提取；展示原文、保留日期冲突、填目标与内部律师接收范围、明确确认，再实际请求现有规则分析成功。页面异常 0。 |

本次新发起 **1 次真实模型请求、0 次搜索 provider 请求**。仅使用仓库许可测试的虚构 Mira Vale 案件，没有实际客户材料。金额没有查到账单，保持 `null`，不能将 token 数当作实际费用或声称零花费。

真实返回保守地将程序类型和当前阶段保留为 unknown；没有因为律师函就补成已起诉或法院认定。收函日期的冲突由用户在核对页处理。一次成功样本不能证明所有 PDF 或模型归因始终准确，原有人工核对和扫描限制仍保留。

## 截图与证据

下面是这次真实提取结果的界面；浏览器展示复用了该已验证响应，避免第二次付费。规则分析由正式接口实际执行。

- [真实提取及冲突](production-screenshots/live-extraction-review.png)
- [双文件原文定位](production-screenshots/live-source-detail.png)
- [核对后的规则行动参考](production-screenshots/live-rule-result.png)
- [模型、用量与提取计数](production-evidence/candidate-live-summary.json)
- [云端读取结果](production-evidence/candidate-local-summary.json)
- [正式域名 15 项 HTTP 检查](production-evidence/http-checks.json)
- [正式浏览器流程记录](production-evidence/browser-production-summary.json)
- [正式 PDF 解析检查](production-evidence/runtime-production.log)

完整临时构建/测试/CLI 日志、虚构提取返回和浏览器复现脚本位于 `test-results/pdf-production/`，已排除部署和 Git。提交的证据只有上述虚构测试摘要及截图，没有凭据或用户文件。

## 使用与边界

正式站 `/new` → 上传同案 1–3 份文字 PDF → 勾选材料 AI 处理同意 → 点击“读取材料并整理案情” → 查看原文、处理冲突 → 填本次目标和披露范围并确认 → 生成行动参考。

限制仍为单份 3 MiB、文件合计 3.9 MB、multipart 4 MB、共 30 个物理页、75,000 UTF-8 文本字节；扫描 OCR 暂不支持，提供文字粘贴/手动路径。原 PDF 默认只在请求与浏览器内存中暂存，没有文件库、公开材料链接或长期服务端存储；保存报告仅留引用片段、来源、核对记录和报告快照。

完整说明及初次模拟验收见 [本地验收历史](acceptance.md)。现有手动 AI 整理曾出现模型输出校验失败，属于主线既有待修事项；本次成功的是新的 PDF 材料提取，不据此宣称手动 AI 整理的旧问题也已解决。
