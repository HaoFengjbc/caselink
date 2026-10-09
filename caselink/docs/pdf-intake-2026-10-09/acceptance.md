# PDF 上传建档：本地验收记录

日期：2026-10-09。基线 `8b18d11`；集成分支 `codex/caselink-pdf-intake`。本轮未推送、未覆盖生产。

## 验收结论

**代码和本地集成完成；真实 PDF 解析通过；模拟 AI 的完整建档演示通过；真实模型提取待配置后验证。**

完成上传两份虚构表达案件材料、预填核对页、显示原文出处、处理日期冲突、用户改写、补充目标及披露范围、统一确认、生成现有规则行动参考、主动保存并重新打开快照。浏览器提取响应明确由测试拦截器模拟，未把预置结果放入产品提取路径。demo 模式上传实际只返回本地文字，不伪造自动预填。

原手动录入走同一 NewCaseInput / IntakeRecord；领域限定、英国法域规范化、独立隐私偏好、报告快照、正式库多案比较继续保留。现有分析与比较的单元测试全部通过，新增浏览器测试也从手动入口跑到规则行动参考。

## 分工与提交

先检查仓库、AGENTS.md、已安装 Next 文档、最近验收与配置。没有重新初始化 Git；原工作区没有被修改。

| 责任 | 分支 / 已集成提交 | 范围 |
| --- | --- | --- |
| 主会话 | `codex/caselink-pdf-intake` / `d70ca00` | 公共 schema、语言、依赖、Next 配置、用量控制、案情衔接、快照与导出 |
| Agent 1 | `codex/caselink-pdf-server` / 原 `554a6ef`、`2c5336b` → 集成 `28ecb1a`、`5ca48c2` | PDF worker、解析、模型提取、来源校验、API、服务测试与虚构材料 |
| Agent 2 | `codex/caselink-pdf-ui` / `8f49f05` → 集成 `6ae63da` | 上传状态、核对、追问、页面与浏览器测试 |
| 主会话收尾 | 本文所在最终集成提交，可用 `git log -1` 查看 | 修复生产打包后的 PDF.js 解析路径、增量日期冲突、重复追问、端到端与保存快照验证、交付记录 |

每个执行者使用独立 worktree；公共文件由主会话统一维护。开发期间原 `main` 另外前进到 `2f78f06`（移除应用付费用量保护），与本任务保留预算保护的要求不同。本分支保留任务要求，没有合并这项并行策略改动，也没有覆盖原 `main`；最终合并前需先统一策略。并行工作已记录一次生产发布，因此本文“本轮未覆盖生产”仅指 PDF 功能分支。完整改动清单见 [changed-files.txt](changed-files.txt)。

## 支持范围与实际限制

| 项目 | 已实现行为 |
| --- | --- |
| 可提取文字 PDF | 实际 PDF.js 逐页解析，保留物理页序与精确原文片段 |
| 同案多文件 | 1–3 份；新增时只处理新文件，明确确认同案后追加，保留旧笔记 |
| 扫描 / 纯图片 | 识别为 `image_only`，明确未做 OCR；可粘贴文字改走手动入口 |
| 部分不可读 | 显示不可读页和未处理页；只有已提取的文字页送模型 |
| 加密、损坏、假 PDF、零字节 | 拒绝，返回实际错误；不调用模型 |
| Word、独立图片、压缩包 | 不提供支持入口 |
| 整页查看 | 本版提供原文片段、文件名、物理页码；没有内置整页 PDF 浏览器 |
| 印刷页码 | 不推测。`printedPage:null`，明确物理页码与印刷页码不同 |

限制来自当前应用的 multipart → Next Node Function → worker → 模型链路，不采用模型 PDF API 的上限：

- 每份 3 MiB（3,145,728 字节）；同案文件合计 3,900,000 字节。
- 整个 multipart 请求最多 4,000,000 字节，包括字段和边界。应用采用低于 Vercel 4.5 MB 请求体上限的阈值；实际部署代理可能更低，生产仍需实测。[Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- 同案共 30 个 PDF 物理页；一次提取最多 75,000 UTF-8 文本字节。超过文本预算时整页标为 omitted，不截断后冒充完整页。
- 接收请求体 15 秒；PDF worker 15 秒硬终止；请求总截止 55 秒；路由 maxDuration 60 秒；浏览器 60 秒；整理模型默认 30 秒，受总截止约束。
- 每个 Node 进程最多 2 个解析 worker；每个 worker 的 V8 heap 128 MiB old / 32 MiB young，栈 4 MiB。它不是整个宿主进程的硬内存上限。
- 一次模型调用最多 8,000 输出 tokens，无 SDK 自动重试；最多 48 个提取项、12 个冲突、5 个候选案件。输出超出结构或被截断时拒绝整份模型结果，保留重试或本地文字路径。

## 来源与案情衔接

文件 ID 来自内容 SHA-256；文件名按不可信文本处理。每条提取项保存文件 ID / 名称、PDF 物理页码、精确原文片段、陈述主体、信息性质、日期类别及不确定说明。服务端要求每个引文是对应已处理页面文字中的连续子串；日期也必须出现在所引片段中。拼接引文、虚构页码、引用遗漏页会拒绝，不能因此证明模型的语义归纳一定正确。

指控、当事人陈述、文书中的法院认定和一般记载分别标识；索赔不成为判赔，回复要求不成为法定期限。文件日期、事件日期和事实截至日期分开。历史文书的程序阶段不自动覆盖当前状态。

多案件必须先选择；后续文件必须确认属于同案。冲突并列保存，允许“仍不清楚，保留两项待核实”。每轮追问最多 3 项；目标、披露和冲突用专门控件，避免模型改写成重复问题。用户必须确认本次目标和接收范围，既往公开记录不能授权本次公开。编辑笔记保留原始引文，移除来源会移除依赖项，并使相关结构化事实重新待核对。

已有领域判断应用于后续完整研究；空白手写叙述不会挡住材料提取。明确无关仍不进入完整付费研究，关联不明先核对。用户未允许 AI 时可实际解析文字，零模型调用。

增量上传采用保守的单值/日期冲突检查；复杂的跨批次语义差异仍需要人工核对，不能宣称能发现全部矛盾。一次同时上传相关文件，可让整理模型比较同一批材料。

## 临时数据、服务与保存

- 浏览器只在当前流程内存持有 File 与逐页文字；移除、重置或离开流程后释放相关引用。默认刷新不会恢复上传材料；另行同意刷新恢复时也只保存笔记和引用，不保存原 PDF 或逐页全文。
- 服务端 multipart 缓冲和 worker 内存临时解析，应用没有写入 `/tmp`、文件库、对象存储、普通日志或公开目录。成功、失败、取消均进入清理路径，填零可控上传缓冲并终止 worker。JS 字符串和平台内存由运行时回收，不宣称所有物理副本瞬时擦除。
- 只在明确同意且额度预留成功后，将已处理页文字及可选背景发送给现有 `OPENAI_INTAKE_MODEL`。默认仍为 `gpt-6-luna`；后续分析仍沿用既有配置（原本地 `OPENAI_MODEL=gpt-6.1-sol`），未静默换模型。
- 使用 Responses 结构化输出、`store:false`、无工具、无搜索，不上传原 PDF，不创建 OpenAI Files 对象，因此没有服务端文件对象待删除。材料里的改规则、访问链接或外发指令只作为数据。`store:false` 不代表服务方零留存。[OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)
- PDF 整理不依赖 Brave。公开研究只接收既有受控词表，不包含材料全文、身份、文件名或自由背景。付费材料提取和含材料的后续分析均禁用共享结果缓存；仅用量、请求摘要和幂等状态进入原有 Redis 控制。
- 主动保存报告后，本浏览器保存案情笔记、所用片段、文件元数据、冲突核对和固定报告快照；不保存原 PDF 或逐页全文。另行同意刷新恢复也不包含 File 或逐页全文。原有保存期限、备份与删除机制保留。
- 历史界面只展示保存的片段，没有失效或公开的原文件链接；提示原 PDF 未保存，查看整页须重新提供原文件。本版未实现历史报告内重新挂载整页浏览器。
- 本案私有材料、正式案例库、国际资源和待核实公开网页分别标识。

## 验证记录

实际执行环境 Node 24，Next 16.4 production webpack build；本地服务仅监听 `127.0.0.1:3031`。

| 检查 | 结果与证据 |
| --- | --- |
| 全量 Vitest | 29 文件通过；370 项通过、2 项既有真实 provider 录制文件缺失而跳过。见 [tests-final.log](evidence/tests-final.log) |
| TypeScript | `npm run typecheck` 通过。见 [typecheck-final.log](evidence/typecheck-final.log) |
| 生产构建 | `npm run build` 通过。修复了单测不能暴露的 PDF.js ESM 路径被 webpack 重写问题。见 [build-final.log](evidence/build-final.log) |
| PDF 浏览器 / HTTP | 9 项通过：7 项交互回归（其中模型响应明确模拟）、2 项未 mock 的本地 PDF HTTP / 浏览器解析。见 [browser-final.log](evidence/browser-final.log) |
| 完整服务链 | 实际双 PDF → 模拟模型 transport / 计量 → 精确引文校验 → 冲突与授权 → 真实规则分析 → 快照。`tests/materials-journey.test.ts` |
| 真实 HTTP 细节 | 双文字 PDF：2+1 页均处理；scan→image_only；blank→blank；加密/损坏→INVALID_INPUT；31 页→PAYLOAD_TOO_LARGE；文本预算样本读 1–7 页，明确遗漏 8–10 页。见 [runtime-http.json](evidence/runtime-http.json) |
| 真实 AI | **未调用**。本地缺 OpenAI key、Redis、会话 secret、审核价格、预算、可信 IP 头。未读取账户凭据，余额未核验。调用数 0、实际花费 USD 0。见 [config-check.json](config-check.json) |

覆盖用户验收点：单份预填、同案双份与出处、日期冲突、多案选择、不可读/超限真实结果、已有信息不重复追问、目标/披露必确认、改写/移除/取消/重试隔离、未同意/配置不足零调用、默认不持久化/保存快照，以及原手动入口到规则结果。

真实调用的既有授权仍限定最多 1 次整理、2 次分析、总预留不超过 USD 2；本轮未使用，也未扩大预算。测试中的 `test-model`、`MOCKED-TEST-PROVIDER` 和模拟成本只能说明代码行为，不能当作真实 AI 质量或账单证据。未将旧 `journey.spec.ts` 中上一代自动保存断言当作本轮验收；本轮浏览器命令如下，回归范围可直接复现。

## 截图

全部来自虚构材料。前四张的 AI 提取响应由测试模拟；最后一张是真实 PDF.js 本地提取，不调用 AI。

- [双 PDF 预填及冲突](screenshots/two-pdf-source-review.png)
- [原文、页码、陈述主体和性质](screenshots/original-excerpt-detail.png)
- [核对后的行动参考](screenshots/action-reference.png)
- [保存并刷新重开的来源快照](screenshots/saved-material-snapshot.png)
- [实际文字 PDF 读取](screenshots/actual-local-text.png)

## 可复现演示

在当前集成 worktree 执行：

```sh
cd /Users/fenghao/.codex/worktrees/caselink-pdf-intake/hackhaton/caselink
export PATH=/Users/fenghao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
npm ci
npm test
npm run build
npm run typecheck
ANALYSIS_MODE=demo OPENAI_API_KEY= npm start -- --port 3031
```

另开终端执行不收费的完整交互演示：

```sh
TEST_BASE_URL=http://127.0.0.1:3031 npx playwright test tests/e2e/pdf-intake.spec.ts tests/e2e/pdf-runtime.spec.ts
# 可加 --headed 观看自动操作。运行机器需有测试配置中的 Chrome。
```

第一条浏览器测试自动完成：上传两个现场生成的虚构 PDF → 同意并明确点击整理 → 展示原文 → 尝试提交被冲突/缺口挡住 → 补充最新进展 → 处理回复日期冲突 → 填工作目标及内部律师披露范围并确认 → 改写一条指控笔记 → 生成规则行动参考 → 主动保存 → 刷新历史快照查看原引文。其他用例覆盖新文件追加、候选案件选择、取消/重试和手动流程。

手工查看真实解析：打开 `/new`，关闭 AI，选择 `tests/fixtures/pdf/expression-letter.pdf` 与 `expression-update.pdf`，点击“仅提取文字（不调用 AI）”，展开物理页文字。两份文件共 3 页，并故意记载不同收到日期。这条零配置路径不会自动预填。

配置满足后才可手工验证真实 AI：同样上传上述两份 PDF → 勾选材料处理同意 → 点击“读取材料并整理案情” → 查看每条来源 → 将收到日期冲突记为“待核实，保留两项” → 填写“准备内部律师会谈”和“仅内部研究人员及受委托律师，不公开身份全文” → 确认 → 选择规则参考或在剩余预算内明确调用 AI 分析。不要为了演示绕过预算与价格校验。

## 必要外部配置与剩余工作

真实 AI 需安全提供服务端 `OPENAI_API_KEY`、Redis REST URL/token、`USAGE_SESSION_SECRET`、已审核且包含实际模型 ID 的 `AI_MODEL_RATES_JSON`、授权范围内的 `AI_GLOBAL_DAILY_BUDGET_USD`，以及由可信反向代理覆盖的 `USAGE_TRUSTED_IP_HEADER`。开启 live 使用现有 `ANALYSIS_MODE=live`。Brave 只影响独立联网研究，上传提取不需要它。配置结构见 `.env.example` 与 `docs/research-usage.md`，不要在聊天或 Git 放密钥。

真实模型提取质量、多案划分与角色归因、实际 Redis/Lua 原子集成、部署平台请求体/断连/文件追踪均仍需有配置的预览验收。本机生产构建和实际请求已经覆盖，但不代表托管平台已经通过。没有扫描 OCR、印刷页码识别、复杂版面表格质量保证、原 PDF 长期库或整页历史重挂载；文件有文本层也可能存在提取缺字，重要日期/金额/否定词仍须用户核对。
