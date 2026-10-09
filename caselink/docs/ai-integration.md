> 历史版本记录：本文件保留先前实现或验收事实，不代表 2026-10-09 本轮代码。当前定位、隐私和研究控制以 [README](../README.md) 与 [本轮验收](iteration-2026-10-09/acceptance.md) 为准；本轮尚未部署。

# AI 接入记录

首轮模型与价格核对日期：2026-10-07；语料接入说明更新于2026-10-08。当前选择 **GPT-6.1 Sol**（API ID：`gpt-6.1-sol`）。这是针对本项目的工程选择，尚不是实际案例质量评测胜出结论。

## 模型选择

CaseLink 需要对照历史案件、区分已经发生的行动与作者建议、解释当前目标和公开限制，并返回有引用的结构化行动卡。首轮选型时仅有三个案件，主要挑战是理解差异与遵循证据边界；这是历史选型背景。当前正式库已扩至22条案件记录，使用最多3个候选控制上下文，不将全部报告全文发送给模型。

官方将 Sol 定位于兼顾复杂专业工作能力和成本，支持 Responses API 与 Structured Outputs。Luna 更适合集中、量大的任务；Astra 定位于更困难的工作。本次先用 Sol 完成真实任务评测，后续是否换模型由引用正确性、拒绝／截断率和响应时间决定，不凭模型名称承诺案件分析质量。

首轮记录的标准价格（2026-10-07，每百万 token、短上下文；本次文档更新未重新核价）：

| 模型 | 输入 | 输出 |
|---|---:|---:|
| GPT-6.1 Sol | $2.00 | $10.00 |
| GPT-6 Luna | $0.10 | $0.50 |
| GPT-6 Astra | $10.00 | $50.00 |

例如10,000输入 + 3,000计费输出 token，Sol约为 **$0.05**；这是算术示例，未计缓存等差异，不是实测单次费用。推理 token 也占输出预算，实际账单应以API使用量为准。

实际读取的官方来源：[模型目录](https://developers.openai.com/api/docs/models)、[GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol)、[GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)、[GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)、[价格](https://developers.openai.com/api/docs/pricing)。

## 既有双模型部署配置与首轮验收（语料扩展前）

Production与Preview已保存以下服务端环境变量：

```dotenv
OPENAI_MODEL=gpt-6.1-sol
OPENAI_REASONING_EFFORT=low
AI_MAX_OUTPUT_TOKENS=9000
AI_TIMEOUT_MS=90000
```

2026-10-08按用户要求取消站内密码；`DEMO_ACCESS_PASSWORD`已从Vercel和本地环境移除，前端不再解锁，服务端不再签发或校验访问Cookie。旧密码文件不再被应用读取。

用户随后明确指定桌面的 `key.txt`。已通过标准输入将该文件中的密钥写入Vercel **Secret**，Production和Preview均已配置，`ANALYSIS_MODE=live`。未把密钥复制到项目、参数、聊天或日志。原文件保留，权限改为600。

线上首次真实分析因OpenAI HTTP429未成功；一次独立最小请求确认 `error.type=insufficient_quota`。用户随后完成充值。充值后重新验收，生产端真实分析返回 **HTTP200 / live_ai**：2个可比案件、3项行动、27条来源记录，其中15个唯一证据标识被模型的比较或行动引用，引用归属与原文内容均通过共享契约和本地证据库检查。分析接口实测44,943毫秒；这一单次结果不是稳定时延或通用质量保证。

SDK使用 `responses.parse` + 严格Zod输出、`store:false`、关闭自动重试。默认低推理与50秒deadline用于控制交互等待，但尚不能保证实际请求在此时限内完成。服务端继续检查引用存在性、归属、公开限制及行动类别。输出最低步骤、材料、跟进数量与校验规则对齐，该批提示版本为1.1；当前版本见下文扩展记录。

## 运行与故障处理

1. 额度错误映射为 `QUOTA_EXHAUSTED`，与临时 `RATE_LIMITED` 分开。前者不展示重试按钮；账户持有人应在 [API账单](https://platform.openai.com/settings/organization/billing)、[组织限制](https://platform.openai.com/settings/organization/limits) 和项目设置中检查额度。根据 [官方错误说明](https://developers.openai.com/api/docs/guides/error-codes#api-errors)，额度错误不会通过重试恢复。本任务没有购买额度、增加预算或改变账单设置。
2. 更换密钥时更新Vercel Secret并重新部署；相同密钥充值无需重新写入密钥。站内无需访问密码。
3. 真实错误不会自动降级并冒充实时结果。可明确选择规则参考；完整重复验收会产生API调用，按需执行下方命令。

验收命令（仅在明确要进行一次付费请求时执行）：

```bash
node scripts/verify-live-ai.mjs https://caselink-eight.vercel.app --run-paid-smoke
```

脚本无需任何本地凭据；OpenAI Key留在Vercel服务端。先检查`capabilities`确认无密码实时模式，再以不带Cookie的请求调用一次分析。汇总保存到 `test-results/live-ai-smoke.json`，不保存案情全文、Cookie、密码或完整模型输出。只做输入检查可执行 `node scripts/verify-live-ai.mjs --check-inputs`，不发网络请求。

## 首轮验收状态（历史批次）

代码与密钥配置已发布；充值后真实模型分析 **通过**。`test-results/live-ai-smoke.json`为成功记录，`test-results/live-ai-smoke-before-credit.json`保留最初失败；`test-results/openai-connection-check.json`保留充值前安全诊断摘要。后者仅有HTTP状态和允许的错误类别，无密钥和原始错误正文。其前一次Python诊断未获得有效API响应，不算成功API调用。

初次密码版本免费线上检查7/7通过，其中包含匿名付费请求被拒。该访问策略已于2026-10-08按用户要求取消；最新检查改为无密码能力、无效输入拒绝、显式规则参考、跨站拒绝和案例页。本地39项测试及类型检查通过；最终云端生产构建成功，部署与浏览器实测记录见 `docs/verification.md`。

第二个虚构场景已在Chrome真实操作完成：公开倡导方向的博主案生成2个历史参考案例与3项行动，页面显示“实时AI生成”，原文证据弹窗与官方PDF页码链接已核对。两个场景的成功不能代表全部输入，仍保留失败与未知的明确状态。

## 2026-10-08无密码版本实测

无Cookie复测完整通过：HTTP200，`mode=live_ai`，分析耗时46853ms，2个可比案例、3项行动、27条来源、14个引用证据标识。共享契约及真实证据库校验通过，未读取任何本地密码、未调用`/api/access`、未发送Cookie。成功记录为`test-results/live-ai-smoke.json`。先前一次超时仍单独保留，未承诺稳定50秒内完成。


## 2026-10-08自由案情双模型更新

案情整理新增GPT-6 Luna（OPENAI_INTAKE_MODEL=gpt-6-luna），从用户原话中摘录并选择服务器批准的补问。最终比较仍用GPT-6.1 Sol。Production与Preview均已设置整理模型，不新增密钥副本。官方定位参考：[Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)、[Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol)。这是职责分工的工程选择，不是多模型盲测的优胜结论；本轮未重新核对上文历史价格表，不据此承诺当前费用。

两次英文Luna HTTP实测与一次中文浏览器整理通过；修复旧字段误杀后，中文自定义目标的Sol完整流程通过，明确返回零历史匹配及两项一般准备。失败、修复、100项测试、构建、实际下载和最终部署状态均记录在[验收记录](verification.md)。该批promptVersion=1.2；英国支持仅限辖区澄清，没有按国家自动检索当地法律。

## 2026-10-08正式语料扩展

当前本地运行时`corpusVersion=2026-10-08.v2`、`promptVersion=1.3`。正式库包含21份独立来源、22条案件记录、14个地区和187条引文，来源为20份CFJ PDF及1份ABA网页打印件。18份新增文档整理为19条新增案件记录；Pakistan两案共享专题来源，Omar Radi的两起程序分别保留。旧段落中的三个案件与既往调用数字是当时批次的验收记录，不代表扩展后语料已经完成同等真实调用验收。

已确认自由案情的实时分析按结构化字段和叙述关键词召回最多3个候选；没有命中信号时可返回0个，模型也可全部排除。关键词不等于已确认的新案事实。服务器只发布实际采用案例及行动所需证据，历史结果须与有证据支持的完整结果表述对应，不跨主体或跨程序拼接。

当前已为实时分析增加独立Sol联网研究阶段，使用Responses原生`web_search`；随后无搜索工具的结构化综合分析优先采用有引用的网页案例，正式库补充。真实调用记录见验收文档，数据边界见[联网研究说明](web-research.md)。入库核查是选定引文及上下文核对，不是804页完整精读或独立事实调查。本轮本地全量测试108项通过；生产部署与真实调用状态以[验收记录](verification.md)另行确认。
