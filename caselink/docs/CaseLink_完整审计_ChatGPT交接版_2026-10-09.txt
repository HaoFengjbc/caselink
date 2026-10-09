# CaseLink 完整审计交接包 · 供 ChatGPT 独立阅读

日期：2026-10-09。此文件包含项目背景、完整审计、关键代码、缺陷复现脚本和虚构样例的真实线上响应。无需访问审计者电脑，也无需此前对话上下文。

## 给接收文件的 ChatGPT

请阅读完整材料，协助项目负责人复核风险分级、安排下一轮迭代并定义验收标准。区分“已复现缺陷”“防护缺口”“未验证风险”，不要把测试通过理解为缺陷已修复。材料不是修复完成声明；没有提供完整仓库，不足以直接运行所有测试。建议应依据证据，不要推测未知部署配置。

## 项目背景

CaseLink 最初面向新闻报道、表达自由和人权倡议案件，以 TrialWatch/CFJ 报告为可追溯历史资料。用户希望摆脱少量正式库和固定刑事问卷的限制，当前已扩展到较一般的法律纠纷研究。

核心流程：选择地区并叙述事件 → AI 整理原话、事实片段和缺失信息 → 用户核对 → 系统生成研究计划、联网寻找公开可比案件、打开来源 → 结合相关正式库资料形成有依据的行动草稿。

AI 应帮助问对问题、整理案情和研究来源，避免凭记忆断言当地法律、期限、胜诉概率或用户未同意的披露行动。联网研究是主要来源，正式库作为补充。用户要求免内部密码访问，新分析从空白开始、旧结果可找回，并希望实际验证且如实报告。

此包不包含 API 密钥、环境变量内容、真实用户案情、旧报告正文或完整浏览器数据。线上测试的维修纠纷是专门编写的虚构样例。代码里的 apiKey 是变量名，没有密钥值。公共部署及来源链接保留。

正文的“项目内路径”只用于定位，不要求 ChatGPT 访问；关键证据已在附录内嵌。未附全部仓库，不能据此宣称重新完成全量源码审查。

---

# CaseLink 最新版本审计

审计日期：2026-10-09，美国东部时间。结论：**当前版本已经能完成真实 AI 案情整理、联网研究与行动建议，适合受控演示；在法域传递、案情保留和公开接口用量控制修复前，不建议扩大公开使用。** 本次发现 3 项 P1、5 项 P2，以及若干需要持续评测的质量缺口。

这次审计只增加报告、复现脚本和验证记录，没有修改业务源码、语料数据或重新部署网站。审计期间对 125 个源码、数据及依赖清单文件进行了哈希核对，未发现变化。

## 1. 审计对象与证据边界

| 对象 | 本次确认的状态 |
|---|---|
| 本地项目 | `<PROJECT_ROOT>` |
| 正式网站 | [caselink-eight.vercel.app](https://caselink-eight.vercel.app) |
| 正式部署 | `dpl_F2fcLzz69izrJ4y5GRkCh1cdaAdU`，Ready，创建于 2026-10-09 16:01:06 ET |
| 部署独立地址 | [caselink-5j3e8st60-hao-s-projects-2154e1c6.vercel.app](https://caselink-5j3e8st60-hao-s-projects-2154e1c6.vercel.app) |
| 业务版本标记 | schema `1.0`；corpus `2026-10-08.v2`；prompt `3.1`；package `0.1.0` |
| 主要依赖 | Next 16.4.0、React 19.3.0、TypeScript 7.0.2、OpenAI SDK 7.30.0 |

本地代码审查、隔离环境复现和正式站点验证分别记录。项目目录当前不是 Git 仓库，也没有把部署提交或源码哈希写入运行结果；因此，本次确认了线上部署身份及实际行为，**没有证明线上所有文件与本地逐字节一致**。下面每项发现均注明证据类型。

本次覆盖：新建与恢复分析、AI 整理和提交、联网检索与引用、正式语料、历史报告、导入导出、请求防护与成本控制、部署状态、桌面及窄屏关键流程。未进行生产压力测试、完整渗透测试、跨全部国家的法律质量评测或全部文档逐页语义复核。

## 2. 当前产品实际发生了什么变化

主流程已经变为「地区 → 叙述 → 可编辑的案情整理 → 行动结果」。案情整理页直接提交分析；AI 提取的片段有短摘要、分类和原话入口。自适应流程不再依赖原来的九题刑事问卷才能完成提交。

“是否与新闻或表达有关”现在有明确回答。当回答“无关”时，正式库中的新闻及表达类案件不会被强行推荐。本次普通维修纠纷实际返回 0 个正式库案例、1 个网页比较案例，说明这种区分已经生效。

结果页当前默认显示行动建议；历史报告有独立入口，支持搜索、重新打开、下载和导入。正常路径中，“开始新分析”确实清空了地区及旧草稿，已完成结果在历史列表中保留，刷新后仍可重新打开。用户此前反馈的两项问题，在本次正常路径中没有重现；但复杂状态下仍有第 5—8 项问题。

## 3. 必须优先修复的发现

严重度定义：P1 为扩大公开使用前应修复的问题；P2 为会影响恢复、记录可靠性或特定用户流程的问题。没有把未验证风险写成已经发生的事故。

### F1 · P1：英国法域选择没有正确传递给联网研究

**证据：本地复现 + 正式站点真实 AI 结果。** 前端保存 `england_wales`、`northern_ireland` 等枚举，研究查询层却按带空格的地名识别。实际结果为：

| 用户选择 | 查询层实际得到的法域 |
|---|---|
| 英格兰及威尔士 | `UK jurisdiction to confirm`，丢失已确认的具体法域 |
| 北爱尔兰 | `IE / Ireland`，误识别为爱尔兰共和国 |
| 苏格兰 | 正确识别为 Scotland，作为对照通过 |

本次正式站点维修纠纷输入已经选择英格兰及威尔士，保存下来的查询仍以 `UK jurisdiction to confirm civil` 开头。这会降低本地化检索质量；北爱尔兰的错误还会把研究引向另一个国家。

原因见 query.ts:32（项目内 `src/lib/research/query.ts:32`） 和 query.ts:70（项目内 `src/lib/research/query.ts:70`）。应先映射标准枚举，再处理自然语言地名，并对国家与法域矛盾进行校验。回归测试必须使用界面真正提交的值。

### F2 · P1：切换到原有逐题问卷会静默丢失案情和披露边界

**证据：本地函数复现。** `toClassicInput` 删除整个 `intake`，只在背景为空时保留叙述前 800 个字符。自定义目标、披露限制、追问答案和具体法域全部丢失；如果原背景已有内容，新叙述甚至不会被保留。

复现中，原案情写有“只限内部整理，不联系对方，不公开姓名”，切换后这些文字消失，但较宽泛的 `publicity: public` 仍保留。案情尾部的关键约定也被截断。这不是普通界面切换应产生的副作用。

原因见 adaptive-state.ts:68（项目内 `src/components/intake/adaptive-state.ts:68`）。两种问卷应共享完整案情记录；是否使用 AI 应作为单独设置，披露约束必须独立保留。超长内容应提示或完整保存，不应静默截断。

### F3 · P1：公开付费接口缺少应用层配额、并发和幂等控制

**证据：代码审查 + 本地请求守卫复现；未进行付费接口压测。** 当前 Origin 检查能阻挡常见跨站浏览器请求，但不构成用量授权。非浏览器 JSON 请求不带 Origin 也能通过这层检查；客户端还可以自行设置这些请求头。

`requestId` 被读取和回传，却没有用于服务端去重、锁定或结果复用。前端按钮防重复点击只能保护当前组件，无法限制多标签页、脚本或请求重放。完整成功路径通常包含规划、搜索发现、页面读取和综合 4 次模型响应调用；若进入第二轮研究和综合，可能增加到 7 次，案情整理另计。网页工具内部调用数量还需单独计量。

依据：请求守卫（项目内 `src/lib/ai/http.ts:6`）、分析入口（项目内 `src/app/api/analyze/route.ts:15`）、研究重试流程（项目内 `src/lib/ai/service.ts:46`）。没有检查账户或 Vercel 控制台是否另设预算、防火墙或配额，不能断言上游完全没有保护。

建议保留用户要求的免密码访问，增加服务端匿名会话/IP 配额、全局日预算、并发上限、请求幂等和明确的限额反馈。无需恢复内部密码，也不应以存储原始案情作为计费监控的前提。

### F4 · P2：部分 AI 失败后，修改案情仍无法重新提交

**证据：隔离浏览器注入失败响应，随后实际编辑案情复现。** 当返回 `INVALID_MODEL_OUTPUT` 时，提交按钮被隐藏；用户修改目标后仍只有规则参考入口。某些可重试错误达到两次尝试后，也会遇到同类问题。此次错误是本地模拟，用来检验恢复流程，不能写成线上模型本次实际出错。

原因见 AnalysisSubmit.tsx:111（项目内 `src/components/intake/AnalysisSubmit.tsx:111`）。失败状态和次数没有随输入变化重置，而新提交意图的重置逻辑又位于已经无法触发的提交函数内。

建议按输入标识绑定失败状态和尝试次数；修改后的案情允许重新提交，并保留清晰的重试入口。浏览器证据：失败后编辑仍缺少提交按钮（项目内 `test-results/audit-20261009/retry-dead-end.png`）。

### F5 · P2：删除旧报告可能同时删除正在修改的新草稿

**证据：按实际删除分支进行本地状态复现。** 完成报告 A → 修改当前案情为 B → 删除历史报告 A。由于 session 中仍保留 A 的旧结果，删除逻辑调用 `clearSession()`，把 B 的草稿一起清除。确认框只告知删除历史报告，没有说明会删除当前修改。

原因见 HistoryView.tsx:57（项目内 `src/components/results/HistoryView.tsx:57`）。删除报告应解除对应结果关联，同时保留已变化的草稿；只有明确的新建或清空操作才能删除当前草稿。

### F6 · P2：其他已打开标签页可能把删除的报告重新存回历史

**证据：本地模拟共享历史存储和保留的标签页会话。** 标签页 B 删除一份报告，但标签页 A 的 session 仍持有它；A 再触发归档，报告重新出现。当前删除只是移除 localStorage 条目，没有记录删除标记。

依据：history.ts:68（项目内 `src/lib/session/history.ts:68`）、index.ts:95（项目内 `src/lib/session/index.ts:95`）。建议增加持久删除标记并让归档尊重它，同时同步标签页状态。本次未删除任何用户正式浏览器里的报告。

### F7 · P2：系统导出的“全部备份”可能无法再次导入

**证据：本地导出—导入复现。** 导出不限制总大小，导入却限制 3,000,000 字符、最多 500 份记录；文件入口另限制 3,000,000 字节。两份各自合法的约 1.6 MB 报告可以生成约 3.2 MB 备份，但同一系统拒绝恢复它。中文内容还会放大字符数与字节数的差异。

依据：history.ts:72（项目内 `src/lib/session/history.ts:72`）、HistoryView.tsx:50（项目内 `src/components/results/HistoryView.tsx:50`）。应统一导入导出边界，支持拆分备份或受控大文件恢复；至少不能让“成功下载备份”给人可恢复的错误保证。

### F8 · P2：历史报告还不是完整固定的生成时快照

**证据：本地导出复现；测试中的内存数据修改已恢复。** 报告保存了原输入和分析结果，但展示、证据弹窗及导出的一部分内容仍从当前语料库读取。例如案例状态、历史行动、后续结果、文档元数据等。

复现中，报告及输入不变，仅改变内存中的当前案例状态，同一历史报告重新导出的内容就变化了。未来语料更新或删除条目后，旧报告可能变化或缺少部分内容。

依据：export.ts:50（项目内 `src/components/results/export.ts:50`）、EvidenceButton.tsx:11（项目内 `src/components/results/EvidenceButton.tsx:11`）。应保存报告实际使用的案例、引用、文档和资源快照，或严格按当时 corpusVersion 读取保留的版本；不能仅保存版本号却读取最新库。

## 4. AI 和联网研究的真实运行结果

本次对正式站点提交了自行编写的**虚构自行车维修纠纷**，不是用户真实案件。输入明确限定“只做内部整理，不联系媒体，不公开任何身份信息”，并确认尚未向维修方反馈。

| 环节 | 本次结果 |
|---|---|
| AI 案情整理 | HTTP 200；`live_ai`；返回模型标记 `gpt-6-luna`；耗时 3.618 秒 |
| 整理质量 | 4 项事实片段与原文一致；追问服务商是否收到反馈，符合案情缺口 |
| 完整研究与分析 | HTTP 200；`live_ai`；耗时 87.006 秒 |
| 输出 | 3 项行动、1 项网页比较、0 项正式库比较；记录 1 轮研究 |
| 边界执行 | 没有把未反馈写成已拒绝退款；没有擅自安排外部联系；保留内部整理限制 |
| 已确认缺陷 | 查询仍丢失英格兰及威尔士的具体法域，见 F1 |

网页案例来自 The Motor Ombudsman 的汽车维修争议。人工打开原网页后，核对到“退还首次两小时诊断费，但未退还后续五小时诊断费”的核心结论与输出一致；输出也列出了汽车与自行车、两次诊断与一次维修、已经裁决与尚未沟通等差异。[原始案例](https://www.themotorombudsman.org/case-studies/refund-for-diagnostics/)

因此，**AI 和联网搜索确实接入并产生了相关输出**。这一个样本不能证明全部案件都会正确，也不是模型选型对比实验。完整分析结果没有保存实际综合模型标识、各阶段响应 ID、token 用量和账单金额，本次不能据此报告真实费用或所有阶段的具体模型。

记录：AI 整理响应（项目内 `test-results/audit-20261009/live-intake.json`）、完整分析响应（项目内 `test-results/audit-20261009/live-analysis.json`）、对应虚构输入（项目内 `test-results/audit-20261009/confirmed-fictional-input.json`）。

## 5. 已执行检查

| 检查 | 结果 | 能证明什么 / 不能证明什么 |
|---|---|---|
| 原有单元测试 | 19 个文件；316 通过、2 跳过，共 318 项 | 当前测试通过；2 项依赖缺失样本的测试未执行 |
| 审计定向复现 | 10 项通过 | 断言“缺陷存在”的探针，包括对照及防护缺口；不代表 10 项问题已修复 |
| TypeScript | 通过，加入审计脚本后再次通过 | 类型检查无错误 |
| 生产构建 | 通过，34 个静态页面生成 | 应用可构建，不等同于所有运行路径无误 |
| 正式语料验证 | 21 份文档、22 个案件、187 条摘录通过 | 哈希、页码、引文和归属检查；不是全量语义或法律适用性核验 |
| 正式站点免费 HTTP 检查 | 7/7 通过，0 次模型请求 | 能力状态、非法输入、规则模式、跨站拒绝、3 个案例页正常 |
| 正式站点真实 AI | 整理和完整分析各 1 次成功 | 见上一节，不代表广泛质量或负载评测 |
| 生产依赖审计 | `npm audit --omit=dev`：0 个已知漏洞 | 当时依赖数据库没有报告已知问题，不代表不存在安全风险 |
| 客户端密钥模式扫描 | `src`、`public`、`.next/static` 未命中扫描的 OpenAI key 模式 | 没有发现该模式的密钥；不是对所有形式秘密的绝对保证 |
| 浏览器关键流程 | 新建空白、历史保存/刷新/重开、案例到结果、失败恢复复现 | 隔离 localhost 环境；没有清除用户站点数据 |
| 390px 窄屏 | 历史页和结果页宽度均为 390px，无页面横向溢出 | 两个页面的窄屏检查，不是全部设备兼容性认证 |

证据目录：audit-20261009（项目内 `test-results/audit-20261009`）。重要记录包括 单测日志（项目内 `test-results/audit-20261009/unit-tests.log`）、缺陷复现脚本（项目内 `test-results/audit-20261009/repro.test.ts`）、复现结果（项目内 `test-results/audit-20261009/reproductions.log`）、正式站点 HTTP 记录（项目内 `test-results/audit-20261009/production-http-receipt.json`）、源码完整性记录（项目内 `test-results/audit-20261009/source-integrity.json`）。

没有在本次运行完整 Playwright 套件；浏览器验证使用独立操作完成。原生文件选择器上传、真实断网恢复及生产并发没有在本次验证，不应合并计入“全部通过”。

## 6. 质量与运营缺口

### 摘要正确性不能仅靠“原话存在”保证

当前验证器会检查 quote 确实出现在用户叙述中，但不会可靠判断 summary 是否忠实。审计构造了“对方明确否认收到任何款项”配上“对方确认收到全部款项”的反义摘要，验证器仍接受。**这是验证缺口，不是本次真实模型输出中观察到的错误。**

应把否定、金额、日期、主体归属和“声称/确认”的变化作为固定评测集；高风险改写显示原话或要求重点核对。新增短摘要提升了可读性，也增加了一层需要核对的解释。

### 网页引用有效，不等于每句话已核实

代码记录了工具返回来源与打开页面的证据，并明确标记内容仍需人工核查，这是正确方向。但 `pageOpened: true` 本身不能证明模型读到了全部相关段落，更不能证明每句话都受页面支持。搜索、阅读摘要、综合结论之间仍需保持原文片段和可核验对应关系。本次只人工核对了有限样本，不应把系统所有网页比较标为“事实已验证”。[OpenAI Web search 文档](https://developers.openai.com/api/docs/guides/tools-web-search)

### 隐私告知和留存范围需要保持准确

历史记录目前保存在本设备浏览器中，界面已说明不跨设备同步；它不是账户级云备份。脱敏和私密词过滤是启发式方法，不能保证所有自由文本都完成匿名化。

模型请求使用 `store:false`，但这不等于组织已经启用 Zero Data Retention。OpenAI 官方说明，默认滥用监控日志可能保留客户内容最长 30 天，法律要求时可能更久；本次没有核验该组织是否获批特殊数据控制。因此不应向用户承诺“服务方完全不留存”。[OpenAI 数据控制说明](https://developers.openai.com/api/docs/guides/your-data)

### 测试样本和发布版本需要可追溯

两项联网回归测试因为 `test-results/web-search-provider-probe.json` 和 `test-results/semantic-rework/delta-search.json` 不存在而跳过。应将经过脱敏的固定样本迁到 `tests/fixtures`，必需样本缺失时让 CI 明确失败。当前 Playwright 已把输出目录隔离到 `test-results/playwright`，不应把旧目录清理风险当作尚未修复的问题。

建议结果记录增加非案情类运行元数据：真实模型标识、各阶段耗时、响应 ID、token/工具用量、失败阶段与去重键。发布应绑定源码提交或内容哈希；现在相同 promptVersion 可能对应不同实现，排查旧报告很困难。

### 基础防护与说明文档

抽查正式首页、`/new`、`/api/capabilities` 有 HSTS 和禁缓存响应；未观察到 CSP、X-Frame-Options、X-Content-Type-Options、Referrer-Policy。建议补充并测试合适的 CSP/嵌入限制等响应头。这是防护加固项，本次没有证明具体漏洞已可利用。

`docs/web-research.md` 仍描述默认打开联网案例，而当前结果页默认行动建议。应同步文档，避免后续开发和评审使用旧流程预期。

## 7. 建议的下一轮迭代

1. **先保住输入与研究方向。** 修复 F1、F2，锁定真实表单值、长案情、具体目标和披露限制的回归测试。
2. **让失败可恢复、记录可相信。** 修复 F4—F8，覆盖修改后重试、多标签页删除、草稿与报告分离、导出后可恢复、旧报告快照。
3. **补齐公开运行的成本边界。** F3 应在扩大流量前完成；先限额、幂等和并发，再考虑更大规模使用。
4. **用固定案例集评测 AI。** 纳入普通民事纠纷、记者案件、混合法域、否定叙述、已有行动、内部披露限制，以及找不到可靠案例的情况。记录错误事实、法域准确性、引用支持、行动适配、延迟和成本。

当前最有价值的投入是这些可靠性修复与评测。继续换模型或扩大案例数量，不能修复法域枚举、状态丢失和历史记录一致性问题。


## 附录 A：关键实现片段

以下是审计快照中的原始源码。行号以该快照为准，片段不是独立可运行的应用。

### `src/lib/research/query.ts`：32—98 行

```typescript
const UK_SYSTEMS=[
 {name:'Northern Ireland',test:/(?:\bnorthern ireland\b|北爱尔兰|北愛爾蘭)/iu},
 {name:'Scotland',test:/(?:\bscotland\b|\bscottish\b|苏格兰|蘇格蘭)/iu},
 {name:'England and Wales',test:/(?:\bengland\b|\bwales\b|\bwelsh\b|英格兰|英格蘭|威尔士|威爾斯)/iu},
] as const;

export type SafeResearchQuery={
 jurisdiction:{countryCode:string|null;country:string;legalSystem:string|null;recognized:boolean};
 caseKind:'criminal'|'civil'|'administrative'|'mixed'|'unknown';
 stage:NewCaseInput['stage'];
 topics:string[];searchTerms:string[];plan:ResearchPlan;attempt:1|2;
 strategy:'direct_comparison'|'broader_legal_analogy';
};

const unknownJurisdiction=():SafeResearchQuery['jurisdiction']=>({countryCode:null,country:'Jurisdiction unconfirmed; broad comparative research',legalSystem:null,recognized:false});
// Only affirmative clauses participate; a negated comparison cannot override a following actual location.
const affirmativeLocation=(raw:string)=>normal(raw).split(/[;；。!?\n]|,(?=\s*(?:but|rather|actually)\b)|\bbut\b/iu)
 .filter(clause=>!/(?:\b(?:not|never|outside|rather than)\b|不是|不在|并非|並非|非属|非屬)/iu.test(clause)).join(' ');
/** Canonical labels only. Unknown/ambiguous values remain broad, never raw text. */
export function recognizedJurisdiction(values:readonly string[]):SafeResearchQuery['jurisdiction']{
 for(const raw of values){
  const text=affirmativeLocation(raw);if(!text)continue;
  const exactCode=ISO_CODES.find(code=>text===code.toLowerCase());
  if(exactCode)return {countryCode:exactCode,country:EN.of(exactCode)??exactCode,legalSystem:exactCode==='GB'?'UK jurisdiction to confirm':null,recognized:true};
  const systems=UK_SYSTEMS.filter(s=>s.test.test(text));
  const exact=REGIONS.filter(r=>r.names.some(n=>normal(n)===text));
  const found=exact.length?exact:REGIONS.filter(r=>r.names.some(n=>matchesName(text,n)));
  // Northern Ireland is a UK system, not a mention of the Republic of Ireland.
  const regions=systems.length?found.filter(r=>!(r.code==='IE'&&systems.some(s=>s.name==='Northern Ireland'))):found;
  if(systems.length&&regions.some(r=>r.code!=='GB'))return unknownJurisdiction();
  if(systems.length)return {countryCode:'GB',country:'United Kingdom',legalSystem:systems.length===1?systems[0].name:'UK jurisdiction to confirm',recognized:true};
  if(regions.length===1)return {countryCode:regions[0].code,country:regions[0].name,legalSystem:regions[0].code==='GB'?'UK jurisdiction to confirm':null,recognized:true};
  if(regions.length>1)return unknownJurisdiction();
 }
 return unknownJurisdiction();
}

/** Build public queries from a validated abstraction; never mine free text using domain keywords. */
export function buildResearchQuery(input:NewCaseInput,abstractPlan:ResearchPlan=structuredResearchPlan(input),attempt:1|2=1):SafeResearchQuery{
 const country=recognizedJurisdiction([input.country]);
 const explicit=recognizedJurisdiction([input.intake?.jurisdiction??'']);
 const specific=(value:SafeResearchQuery['jurisdiction'])=>value.recognized&&(value.countryCode!=='GB'||value.legalSystem!=='UK jurisdiction to confirm');
 // A retained UK follow-up belongs to the earlier UK context. It cannot turn a
 // currently selected non-UK country back into Scotland (or another UK system).
 const ukAnswer=country.recognized&&country.countryCode!=='GB'?unknownJurisdiction():recognizedJurisdiction(
  (input.intake?.answers??[]).filter(a=>a.questionId==='uk-jurisdiction').map(a=>a.answer),
 );
 const jurisdiction=country.recognized&&country.countryCode!=='GB'?country
  :specific(explicit)?explicit
  :specific(country)?country
  :ukAnswer.countryCode==='GB'?ukAnswer
  :explicit.recognized?explicit:country;
 const plan=ResearchPlanSchema.parse(abstractPlan);
 const caseKind=input.intake?.caseKind??'unknown';
 const location=jurisdiction.recognized?(jurisdiction.legalSystem??jurisdiction.country):'international comparative';
 const prefix=`${location} ${caseKind==='unknown'?'legal dispute':caseKind}`;
 const fixed=structuredResearchPlan(input);
 // Structured primary goals and concrete problems are not lost to arbitrary topic-count truncation.
 const required=[...fixed.remedies,...fixed.disputedConduct,...fixed.evidenceIssues];
 const proposed=attempt===1?plan.searchQueries:[
  ...plan.remedies.map(remedy=>`${remedy} ${plan.relationship} decisions`),
  ...plan.evidenceIssues.map(issue=>`${issue} ${plan.disputedConduct[0]??plan.relationship} decisions`),
  ...plan.disputedConduct.map(conduct=>`${conduct} ${plan.harms[0]??''} liability judgments`),
 ];
 const queries=[...new Set([...required.map(term=>`${term} ${plan.relationship} judgments`),...proposed])];
 const searchTerms=(queries.length?queries:plan.searchQueries).slice(0,10).map(term=>`${prefix} ${term}`.slice(0,700));
 return {jurisdiction,caseKind,stage:input.stage,topics:[...new Set([...plan.disputedConduct,...plan.evidenceIssues])],searchTerms,plan,attempt,strategy:attempt===1?'direct_comparison':'broader_legal_analogy'};
```

### `src/components/intake/adaptive-state.ts`：68—73 行

```typescript
/** The step-by-step form keeps no AI record: the person's own words stay as background text, the rest is dropped. */
export function toClassicInput(input: NewCaseInput): NewCaseInput {
  if (!input.intake) return input;
  const { intake, ...rest } = input;
  return { ...rest, background: { ...input.background, description: input.background.description.trim() || intake.narrative.trim().slice(0, 800) } };
}
```

### `src/components/intake/AnalysisSubmit.tsx`：38—49 行

```typescript
  const router = useRouter();
  const { locale, t } = useI18n();
  const r = t.review;
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [capabilityFailed, setCapabilityFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastForcedRule, setLastForcedRule] = useState(false);
  const [submitted, setSubmitted] = useState<NewCaseInput | null>(null);
  const pending = useRef<{ token: string; controller: AbortController } | null>(null);
  const intent = useRef<{ key: string; requestId: string; attempts: number } | null>(null);
```

### `src/components/intake/AnalysisSubmit.tsx`：68—132 行

```typescript
  async function analyze(forceRule = false) {
    // Synchronous guard prevents even same-tick double clicks from starting a second paid request.
    if (pending.current || disabled) return;
    const input = prepare();
    if (!input) return;
    if (input.intake && !input.intake.confirmed) { setFailure({ code: 'INVALID_INPUT', message: locale === 'en' ? 'Review and confirm the updated case record first.' : '请先返回核对并确认修改后的案情记录。' }); return; }
    if (input.priorActions.status === 'described' && !input.priorActions.description.trim()) { setFailure({ code: 'INVALID_INPUT', message: t.q.errPrior }); return; }
    const parsed = NewCaseInputSchema.safeParse(input);
    if (!parsed.success) { setFailure({ code: 'INVALID_INPUT', message: t.clientErrors.INCOMPLETE_CASE }); return; }
    const capturedKey = inputKey(input);
    const capturedGeneration = sessionGeneration();
    const intentKey = `${capturedKey}:${forceRule ? 'rule' : 'default'}:${locale}`;
    if (intent.current?.key !== intentKey) intent.current = { key: intentKey, requestId: crypto.randomUUID(), attempts: 0 };
    if (intent.current.attempts >= 2) return;
    intent.current.attempts += 1;
    const requestId = intent.current.requestId;
    setAttemptCount(intent.current.attempts); setLastForcedRule(forceRule); setSubmitted(parsed.data);
    const token = crypto.randomUUID();
    const controller = new AbortController();
    pending.current = { token, controller };
    setBusy(true); setFailure(null);
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 290000);
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: controller.signal, body: JSON.stringify({ input: parsed.data, requestId, ...(forceRule ? { forceRule: true } : {}), ...(locale === 'zh' ? {} : { locale }) }) });
      const body = await response.json();
      if (pending.current?.token !== token) return;
      if (!response.ok) {
        setFailure({ code: body.code || 'REQUEST_ERROR', message: serverMessage(body.code, body.message, t.clientErrors.REQUEST_ERROR) }); return;
      }
      const result = AnalysisResultSchema.safeParse(body);
      if (!result.success) { setFailure({ code: 'INVALID_OUTPUT', message: t.clientErrors.INVALID_OUTPUT }); return; }
      if (!saveResult(result.data, capturedKey, capturedGeneration)) { setFailure({ code: 'STALE_RESPONSE', message: t.clientErrors.STALE_RESPONSE }); return; }
      router.push('/analysis');
    } catch (error) {
      if (pending.current?.token !== token) return;
      if (timedOut) setFailure({ code: 'TIMEOUT', message: t.clientErrors.TIMEOUT });
      else if (!(error instanceof DOMException && error.name === 'AbortError')) setFailure({ code: 'NETWORK_ERROR', message: t.clientErrors.NETWORK_ERROR });
    } finally {
      window.clearTimeout(timeout);
      if (pending.current?.token === token) { pending.current = null; setBusy(false); }
    }
  }
  const canRetry = !!failure && recoverableCodes.has(failure.code) && attemptCount < 2;
  const ruleOnly = lastForcedRule || capabilities?.mode === 'demo';
  const showRule = !lastForcedRule && (failure || !capabilities || capabilities.mode === 'live' && (!capabilities.configured || offerRule));
  // Staged loading: the reviewed library answers instantly, so its candidates are shown while the AI analysis runs.
  const preview = useMemo(() => {
    if (!busy || ruleOnly || !submitted || submitted.intake?.expression === 'no') return [];
    return (submitted.intake?.confirmed ? retrieveNarrativeCandidates(submitted, cases, locale) : retrieveCases(submitted, cases, locale)).slice(0, 3);
  }, [busy, ruleOnly, submitted, locale]);
  return <>
    <div className={styles.modeNotice}>
      <span className={styles.savedDot}/><div><strong>{capabilities?.mode === 'live' ? capabilities.configured ? r.mode.liveReady : r.mode.liveIncomplete : capabilities ? r.mode.demo : capabilityFailed ? r.mode.failed : r.mode.checking}</strong><p>{capabilities?.mode === 'live' ? r.mode.liveText : capabilities ? r.mode.demoText : r.mode.unknownText}</p></div>
    </div>
    {failure && <div className={styles.failureBox} role="alert"><strong>{failure.code === 'CANCELLED' ? r.cancelled : r.failed}</strong><p>{failure.message}</p>{attemptCount >= 2 && <p>{r.retried}</p>}{editHref && <Link href={editHref} className="text-link">{r.editCase}<ArrowRight size={14}/></Link>}</div>}
    {busy ? <div className={styles.busyBox} role="status">{!ruleOnly && <div className={styles.busyStages}>{r.busyStages.map(s => <span key={s}>{s}</span>)}</div>}<span className={styles.busyBar}><i/></span><strong>{ruleOnly ? t.web.ruleBusy : r.busyTitle}</strong><p>{ruleOnly ? t.web.ruleBusyText : r.busyText}</p><button className="text-link" onClick={cancel}><X size={14}/>{r.cancel}</button>
      {preview.length > 0 && <section className={styles.waitPreview} aria-label={r.previewTitle}><h3>{r.previewTitle}</h3><p>{r.previewNote}</p><ol>{preview.map(match => { const item = localizeCase(match.record, locale); return <li key={item.caseId}><a href={`/cases/${item.caseId}`} target="_blank" rel="noopener">{item.title}<ArrowUpRight size={14}/></a><div className={styles.waitMeta}><span className="tag">{countryName(item.country, locale)}</span><span className="tag tag-accent">{match.comparison.relevance === 'comparable' ? t.analysis.comparable : t.analysis.related}</span><span className={styles.waitTier}>{r.previewTier}</span></div><p>{item.summary}</p></li>; })}</ol></section>}
    </div> : <>
      {(!failure || canRetry || failure.code === 'CANCELLED') && <button className={`btn btn-primary ${styles.submitButton}`} disabled={disabled} onClick={() => analyze(failure ? lastForcedRule : false)}>{canRetry ? r.retry : failure?.code === 'CANCELLED' ? r.restart : submitLabel ?? r.submit}<ArrowRight size={17}/></button>}
      {showRule && <button className={styles.ruleButton} disabled={disabled} onClick={() => analyze(true)}>{r.rule}<ArrowRight size={14}/></button>}
      {hasResult && !stale && <Link href="/analysis" className={styles.existingResult}>{r.existing}</Link>}
    </>}
  </>;
}
```

### `src/components/results/HistoryView.tsx`：50—63 行

```typescript
  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 3_000_000) { setMessage(en ? 'The file must be 3 MB or smaller.' : '文件不能超过 3 MB。'); return; }
    try { await importText(await file.text()); }
    catch { setMessage(en ? 'Could not read this file. You can paste its text below.' : '无法读取此文件，也可以在下方粘贴报告内容。'); }
    if (upload.current) upload.current.value = '';
  }
  function remove(report: SavedReport) {
    if (!window.confirm(en ? 'Delete this saved report from this browser? Download a backup first if needed.' : '从本浏览器删除这份历史报告？如需保留，请先下载备份。')) return;
    if (deleteSavedReport(report.id)) {
      if (readSession().result?.analysisId === report.id) clearSession();
      refresh();
    } else setMessage(en ? 'The report could not be deleted.' : '未能删除，报告仍然保留。');
  }
```

### `src/lib/session/history.ts`：68—79 行

```typescript
export function deleteSavedReport(id: string): boolean {
  try { window.localStorage.removeItem(HISTORY_PREFIX + id); pending.delete(id); return true; }
  catch { storageIssue = true; return false; }
}
export function historyBackup(reports = readHistory()): string {
  return JSON.stringify({ format: 'caselink-history', version: 1, reports }, null, 2);
}
export async function parseHistoryImport(text: string): Promise<SavedReport[]> {
  if (text.length > 3_000_000) throw new Error('size');
  if (text.trimStart().startsWith('{')) {
    const data = z.object({ format: z.literal('caselink-history'), version: z.literal(1), reports: z.array(SavedReportSchema).max(500) }).parse(JSON.parse(text));
    return data.reports;
```

### `src/lib/session/index.ts`：60—105 行

```typescript

export function saveInput(input: NewCaseInput, step?: number): void {
  const current = readSession();
  archiveCurrentSession(current);
  persist({ ...current, input, step: step === undefined ? current.step : Math.max(0, Math.min(8, step)) });
}
export function saveStep(step: number): void { persist({ ...readSession(), step: Math.max(0, Math.min(8, step)) }); }
/** Returns false when a cancelled/old response belongs to a draft that has since changed. */
export function saveResult(result: AnalysisResult, expectedInputKey?: string, expectedGeneration?: number): boolean {
  if (expectedGeneration !== undefined && expectedGeneration !== generation) return false;
  const current = readSession();
  if (!current.input) return false;
  const key = inputKey(current.input);
  if (expectedInputKey !== undefined && key !== expectedInputKey) return false;
  const parsed = AnalysisResultSchema.safeParse(result);
  if (!parsed.success) return false;
  archiveCurrentSession(current);
  persist({ ...current, result: parsed.data, resultInputKey: key });
  archiveAnalysis(current.input, parsed.data);
  return true;
}
export function isResultStale(state: SessionState = readSession()): boolean {
  return !!state.result && (!state.input || state.resultInputKey !== inputKey(state.input) || state.result.corpusVersion!==CORPUS_VERSION || state.result.promptVersion!==PROMPT_VERSION);
}
export function clearSession(): void {
  generation += 1;
  memory = empty();
  for (const cleanup of cleanupCallbacks) cleanup();
  if (typeof window === 'undefined') return;
  for (const key of [STORAGE_KEY, ADAPTIVE_VIEW_STORAGE_KEY]) {
    try { window.sessionStorage.removeItem(key); } catch { storageUnavailable = true; }
  }
  window.dispatchEvent(new Event('caselink:session'));
}
/** Migrate the legacy single result before any draft edits, demo load or reset. */
export function archiveCurrentSession(state: SessionState = readSession()): boolean {
  if (!state.result || !state.resultInputKey) return true;
  try {
    // The old key contains the exact original input. Never attach a later edited draft.
    const original = NewCaseInputSchema.safeParse(JSON.parse(state.resultInputKey));
    return original.success && archiveAnalysis(original.data, state.result);
  } catch { return false; }
}
export function startNewAnalysis(): void { archiveCurrentSession(); clearSession(); }
export function newDraft(): NewCaseInput { return structuredClone(EMPTY_INPUT); }
export function isStorageAvailable(): boolean { return !storageUnavailable; }
```

### `src/components/results/export.ts`：48—54 行

```typescript
function chineseMarkdown(result:AnalysisResult,input:NewCaseInput){
 const lines=['# CaseLink · 当前行动参考','',`生成模式：${zh.modes[result.mode]}`,`生成时间：${result.createdAt}`,`历史库版本：${result.corpusVersion}`,`输入校验：${result.inputHash}`,input.isExample?'输入性质：虚构示例案件':'输入性质：使用者提供，未经独立核实','','## 案情与目标',...caseOverviewLines(input,'zh'),'','## 历史比较'];
 for(const m of result.comparableCases){const c=getCase(m.caseId);if(!c)continue;lines.push('',`### ${c.title} · ${c.country}`,`报告日期：${c.reportDate}；事实截至 ${c.lastKnownStatusAsOf}`,c.statusSummary,`身份：${c.personTypes.map(p=>zh.persons[p]).join('、')}`,`参考维度：${m.matchDimensions.join('、')}`,`相似点：${m.similarities.join('；')}`,`关键差异：${m.differences.join('；')}`);for(const h of result.historicalComparisons.filter(h=>h.caseId===c.caseId)){const a=c.interventions.find(a=>a.interventionId===h.interventionId);if(!a)continue;lines.push(`- 历史事实：${a.actor}；${zh.stages[a.stageAtAction]}；${a.date.value||a.date.originalText}；${a.action}`,`  后续结果：${a.observedOutcomeIds.map(id=>c.outcomes.find(o=>o.outcomeId===id)?.description).filter(Boolean).join('；')||'材料未记载对应结果'}`,`  联系：${a.relationshipToOutcome==='explicit'?'报告明确联系所列回应，不外推因果效果':a.relationshipToOutcome==='sequence_only'?'仅先后出现':'联系未知'}；证据：${[...new Set([...a.evidenceIds,...a.observedOutcomeIds.flatMap(id=>c.outcomes.find(o=>o.outcomeId===id)?.evidenceIds||[])])].join(', ')}`)}}
 lines.push('','## 当前行动参考（建议，不是历史事实）');for(const [i,a] of result.actionOptions.entries()){lines.push('',`### ${i+1}. ${a.title} · ${zh.applicability[a.applicability]}`,`目标：${a.goal==='other'&&input.intake?.goalText.trim()?input.intake.goalText:zh.goals[a.goal]}`,`理由：${a.reason}`,`牵头角色：${a.leadRole}`,`时机：${a.timing}`,`依据类型：${zh.basis[a.basisType]}`,`历史依据：${a.supportingEvidenceIds.join(', ')||'无个案证据'}`);lines.push(...actionWebMarkdown(result,a.actionId,'zh'));for(const [title,items] of [['前置条件',a.prerequisites],['执行步骤',a.steps],['准备材料',a.materials],['协作对象',a.collaborators],['跟进观察',a.followUp],['关键差异',a.differences],['待核实',a.uncertainties]] as const){lines.push('',`**${title}**`,...items.map((s,j)=>`${j+1}. ${s}`))}for(const rid of a.resourceIds){const r=resources.find(r=>r.resourceId===rid);if(r)lines.push(`官方资源：${r.name} — ${r.officialUrl}；核查 ${r.checkedAt}；适用：${r.applicability}`)}}
 lines.push('','## 缺失信息',...result.missingInformation.map(s=>`- ${s}`),'','## 使用限制',...result.limitations.map(s=>`- ${s}`),'','## 原文证据与来源');
 if(!input.intake||input.priorActions.date)lines.push(`用户已尝试行动的日期：${input.priorActions.date||'未提供'}`);for(const m of result.comparableCases){const c=getCase(m.caseId);c?.conflicts.forEach(f=>lines.push(`来源冲突（${c.title}）：${f.description}`));c?.unknowns.forEach(u=>lines.push(`历史资料未记载（${c.title}）：${u}`));}
 for(const e of result.sources.filter((e,i,a)=>a.findIndex(x=>x.evidenceId===e.evidenceId)===i)){const d=documents.find(d=>d.documentId===e.documentId);lines.push('',`### ${e.evidenceId} · ${getCase(e.caseId)?.title}`,`> ${e.exactQuote}`,e.explanation,`报告：${d?.title}；作者：${d?.author}`,`发布日期：${d?.publishedDate}；事实截至：${d?.factsAsOf}；核查：${d?.checkedAt}`,`PDF 第 ${e.pdfPage} 页${e.printedPage?`；印刷页 ${e.printedPage}`:''}；${zh.origins[e.origin]}`,sourceFormatNote(e,'zh'),`原报告：${evidenceSourceLink(e)}`)}
```

### `src/components/results/EvidenceButton.tsx`：1—18 行

```typescript
'use client';
import { useRef } from 'react';
import { ArrowUpRight, BookOpen, X } from 'lucide-react';
import { getEvidence, documents, getCase } from '@/lib/corpus';
import { localizeDocument, localizeEvidence, localizeCase } from '@/lib/i18n/content';
import { useI18n } from '@/components/i18n/LocaleProvider';
import styles from './results.module.css';
import {evidenceSourceLink,isWebPrint,sourceFormatNote} from '@/lib/evidence/source-links';
export function EvidenceButton({ids,label}:{ids:string[],label?:string}){
 const {locale,t,L}=useI18n();const v=t.evidence;
 const dialog=useRef<HTMLDialogElement>(null);const records=[...new Set(ids)].map(getEvidence).filter(e=>!!e).map(e=>localizeEvidence(e,locale));
 if(!records.length)return <span className={styles.noEvidence}>{v.none}</span>;
 return <><button className={`${styles.evidenceButton} no-print`} onClick={()=>dialog.current?.showModal()}><BookOpen size={14}/>{label??v.view}<span className={styles.refCount}>{records.length}</span></button><dialog ref={dialog} className={styles.evidenceDialog} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}>
  <div className={styles.drawerHead}><div><h2>{v.title[0]}<br/>{v.title[1]}</h2><i className="bar"/><p>{v.summary(records.length)}</p></div><button className={styles.iconButton} aria-label={v.close} onClick={()=>dialog.current?.close()}><X size={20} strokeWidth={2.4}/></button></div>
  <ol className={styles.drawerBody}>{records.map((e,i)=>{const raw=documents.find(d=>d.documentId===e.documentId);const doc=raw?localizeDocument(raw,locale):undefined;return <li className={styles.evidenceItem} key={e.evidenceId}>
   <div className={styles.evidenceTop}><span className={styles.evidenceIndex}>{String(i+1).padStart(2,'0')}</span><span className="tag">{(getCase(e.caseId)?localizeCase(getCase(e.caseId)!,locale).title:'')}</span><span className={`tag ${e.reviewStatus==='conflict'?'tag-accent':'tag-green'}`}>{e.reviewStatus==='conflict'?v.conflict:v.verified}</span></div>
   <blockquote lang="en">“{e.exactQuote}”</blockquote>
   <p className={styles.evidenceExplain}>{e.explanation}</p>
```

### `src/lib/ai/http.ts`：6—20 行

```typescript
export function checkRequestOrigin(request:Request){
  const origin=request.headers.get('origin');
  // Next may reconstruct request.url with its internal listening hostname.
  // The browser's public authority is the HTTP Host, not x-forwarded-host.
  const expectedHost=(request.headers.get('host')??new URL(request.url).host).toLowerCase();
  let validOrigin=true;
  if(origin){
    try{
      const parsed=new URL(origin);
      validOrigin=['http:','https:'].includes(parsed.protocol)&&parsed.origin===origin&&parsed.host.toLowerCase()===expectedHost;
    }catch{validOrigin=false;}
  }
  if(!validOrigin||request.headers.get('sec-fetch-site')==='cross-site')throw new AnalysisError('FORBIDDEN','仅允许从本站提交分析。',403);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new AnalysisError('INVALID_INPUT','请求必须使用 JSON 格式。',415);
}
```

### `src/app/api/analyze/route.ts`：9—21 行

```typescript
export const runtime='nodejs';
export const maxDuration=300;
const RequestSchema=z.object({input:NewCaseInputSchema,requestId:z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),forceRule:z.boolean().optional(),locale:z.enum(['zh','en']).optional()}).strict();
export async function POST(request:NextRequest){
  let requestId=requestIdentifier(request);
  try{
    checkRequestOrigin(request);const body=await readLimitedJson(request,524288);const parsed=RequestSchema.safeParse(body);
    if(!parsed.success)throw new AnalysisError('INVALID_INPUT','请检查必选状态、互斥选项和文字长度，再提交分析。');
    requestId=parsed.data.requestId;const config=parsed.data.forceRule?undefined:readConfig();
    const result=await analyzeInput(parsed.data.input,{forceRule:parsed.data.forceRule,config,signal:request.signal,locale:parsed.data.locale});
    return NextResponse.json(result,{headers:{...NO_STORE,'X-Request-Id':requestId}});
  }catch(error){return errorResponse(error,requestId);}
}
```

### `src/lib/ai/service.ts`：40—89 行

```typescript
  let mode:AnalysisResult['mode'];let output:ModelAnalysisOutput|WebModelAnalysisOutput;let webResearch:WebResearch|undefined;
  let attempts=0;let recovery:NonNullable<AnalysisResult['researchAssessment']>['recovery']='not_needed';
  if(options.forceRule){mode='rule_reference';output=buildRuleReference(input,matches,locale);}
  else if(config!.mode==='demo'){
    const preset=presetOutput(inputHash,locale);mode=preset?'preset_demo':'rule_reference';output=preset??buildRuleReference(input,matches,locale);
  }else{
    requireLiveConfiguration(config!);
    const researchOptions={plannerTransport:options.researchPlannerTransport,deadlineAt};
    webResearch=await researchWeb(input,config!,options.signal,options.researchTransport,locale,researchOptions);attempts=1;
    checkCancelled();
    const synthesize=async(research:WebResearch)=>{
      const remaining=deadlineAt-Date.now();
      if(remaining<1000)throw new AnalysisError('TIMEOUT','分析时间不足，未生成完整结果。',504);
      const boundedConfig={...config!,timeoutMs:Math.min(config!.timeoutMs,remaining)};
      return research.status==='completed'
        ?generateWebLive(input,context,matches,research,boundedConfig,options.signal,options.transport,locale)
        :generateLive(input,context,matches,boundedConfig,options.signal,options.transport,locale);
    };
    output=await synthesize(webResearch);
    // The model can reject irrelevant material. Act on that finding once rather
    // than treating any cited page as a successful case comparison.
    const adoptedWeb=webComparisonCount(output);
    if(webResearch.plan && webResearch.status!=='unavailable' && adoptedWeb===0){
      // Reserve a complete search window and at least 30s for reassessment.
      if(deadlineAt-Date.now()>=95_000){
        attempts=2;
        try{
          const refined=await researchWeb(input,config!,options.signal,options.researchTransport,locale,{...researchOptions,attempt:2,previousResearch:webResearch});
          checkCancelled();
          webResearch={...webResearch,attempts:refined.attempts};
          if(refined.status==='completed'){
            const refinedOutput=await synthesize(refined);
            checkCancelled();
            webResearch=refined;output=refinedOutput;
            recovery=webComparisonCount(output)?'found_cases':'no_relevant_cases';
          }else recovery=refined.status==='no_results'?'no_relevant_cases':'unavailable';
        }catch(error){
          checkCancelled();
          if(error instanceof AnalysisError&&error.code==='CANCELLED')throw error;
          recovery='unavailable';
        }
      }else recovery='budget_exhausted';
    }
    checkCancelled();mode='live_ai';
    // Matching labels and dimensions are deterministic, never upgraded by the model.
    output.comparableCases=output.comparableCases.map(c=>{const match=matches.find(m=>m.record.caseId===c.caseId);return match?{...c,relevance:match.comparison.relevance,matchDimensions:match.comparison.matchDimensions}:c;});
  }
  output=webResearch?.status==='completed'
    ?validateWebModelOutput(output,input,context,webResearch,locale)
    :validateModelOutput(output,input,context,locale);
```

### `src/lib/intake/service.ts`：51—78 行

```typescript
  if(!parsed.success||!input.intake)throw invalid();
  const output=parsed.data;
  if(new Set(output.facts.map(f=>f.quote)).size!==output.facts.length||output.facts.some(f=>!hasIntakeQuote(input.intake!,f.quote)))throw invalid();
  const material=[input.intake.narrative,...input.intake.answers.map(answer=>answer.answer)].join('\n');
  const facts:IntakeFact[]=output.facts.map((fact,index)=>{
    const summary=readableSummary(fact.summary,material,locale);
    return {id:`fact-${index+1}`,text:summary??fact.quote,quote:fact.quote,...(summary?{summary}:{}),...(fact.slot?{slot:fact.slot}:{})};
  });
  const required=availableIntakeQuestions(input,locale).find(q=>q.id==='uk-jurisdiction');
  const dynamic=contextualQuestions(output.questions,input);
  const questions=[...(required?[required]:[]),...dynamic].slice(0,Math.max(0,Math.min(3,40-input.intake.answers.length)));

  return IntakeResponseSchema.parse({mode:'live_ai',facts,questions,sources:intakeSources(questions.flatMap(q=>q.sourceIds),locale),model});
}

/** The short restatement is only a reading aid. Anything long, contact-like or unsupported falls back to the user's own words. */
function readableSummary(value:string|undefined,material:string,locale:Locale):string|undefined{
  const text=value?.replace(/\s+/g,' ').trim();
  if(!text||text.length>(locale==='en'?160:60))return undefined;
  if(/(?:\d[\s-]?){9,}/.test(text)||unsupportedSummary(text,material))return undefined;
  return text;
}

function localizedError(error:unknown,locale:Locale):AnalysisError{
  const result=publicError(error);
  const messages:Partial<Record<AnalysisError['code'],[string,string]>>={
    QUOTA_EXHAUSTED:['AI 整理因可用额度或预算限制暂不可用。请联系管理员检查 OpenAI API 可用额度及组织或项目预算，或继续手动填写。','AI intake is unavailable because of an API quota or budget limit. Ask the administrator to check OpenAI API availability and organization or project budgets, or continue manually.'],
    RATE_LIMITED:['AI 整理暂时限流，请稍后再试或继续手动填写。','AI intake is temporarily rate limited. Try later or continue manually.'],
```

### `src/lib/intake/question-validation.ts`：25—28 行

```typescript
/** A model restatement of an excerpt must not add advice, legal conclusions, secrets or a sensitive topic absent from the account. */
export function unsupportedSummary(summary:string,material:string):boolean{
 return unsafe.test(summary)||sensitiveTopics.some(pattern=>pattern.test(summary)&&!pattern.test(material));
}
```

## 附录 B：完整缺陷探针

这些测试刻意断言当前错误行为，修复后应改为期望行为。“10 项通过”是复现成功，不是问题解决。须放在原项目内执行；不调用真实 AI，也不操作用户浏览器存储。

```typescript
// Audit probes assert the observed bug, not desired behavior. No real AI calls.
import {beforeAll,beforeEach,afterEach,expect,it,vi} from 'vitest';
import {EMPTY_INPUT,NewCaseInputSchema,type NewCaseInput,type AnalysisResult} from '../../src/lib/contracts';
import {DEMO_SCENARIOS} from '../../data/demo/fixtures';
import {analyzeInput} from '../../src/lib/ai/service';
import {buildResearchQuery} from '../../src/lib/research/query';
import {toClassicInput} from '../../src/components/intake/adaptive-state';
import {hasDisclosureNotes,needsGoalClarification} from '../../src/lib/intake/analysis';
import {validateIntakeOutput} from '../../src/lib/intake/service';
import {analysisMarkdown} from '../../src/components/results/export';
import {cases} from '../../src/lib/corpus';
import {checkRequestOrigin} from '../../src/lib/ai/http';

let local:Map<string,string>,session:Map<string,string>,result:AnalysisResult;
const storage=(map:Map<string,string>)=>({get length(){return map.size;},key:(i:number)=>[...map.keys()][i]??null,getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)});
const input=():NewCaseInput=>({...structuredClone(EMPTY_INPUT),country:'英国',primaryGoal:'other',publicity:'public',intake:{version:1,jurisdiction:'england_wales',caseKind:'civil',narrative:'我委托了一家维修服务商，对方未按约完成维修。',goalText:'要求返还已支付的服务费',disclosureDetails:'只限内部整理，不联系对方，不公开姓名。',answers:[],facts:[],confirmed:true,expression:'no'}});
beforeAll(async()=>{result=await analyzeInput(DEMO_SCENARIOS[0].input,{forceRule:true});});
beforeEach(()=>{local=new Map();session=new Map();vi.stubGlobal('window',{localStorage:storage(local),sessionStorage:storage(session),dispatchEvent:vi.fn()});});
afterEach(()=>vi.unstubAllGlobals());

it('BUG: UI england_wales becomes unconfirmed in public research',()=>{
 const value=input();
 expect(NewCaseInputSchema.safeParse(value).success).toBe(true);
 expect(buildResearchQuery(value).jurisdiction.legalSystem).toBe('UK jurisdiction to confirm');
});
it('BUG: UI northern_ireland routes to the Republic of Ireland',()=>{
 const value=input();value.intake!.jurisdiction='northern_ireland';
 expect(buildResearchQuery(value).jurisdiction).toMatchObject({countryCode:'IE',country:'Ireland',legalSystem:null,recognized:true});
});
it('CONTROL: Scotland remains recognized',()=>{const value=input();value.intake!.jurisdiction='scotland';expect(buildResearchQuery(value).jurisdiction.legalSystem).toBe('Scotland');});

it('BUG: switch to classic silently discards goal, disclosure, answers and narrative tail',()=>{
 const value=input();value.intake!.narrative='案情。'.repeat(400)+'关键约定在末尾。';
 value.intake!.answers=[{questionId:'prior-actions',question:'已采取什么行动？',answer:'已获得书面退款承诺。'}];
 const next=toClassicInput(value);
 expect(NewCaseInputSchema.safeParse(value).success).toBe(true);
 expect(next.background.description.length).toBe(800);
 expect(JSON.stringify(next)).not.toContain('关键约定在末尾');
 expect(hasDisclosureNotes(value)).toBe(true);expect(hasDisclosureNotes(next)).toBe(false);
 expect(needsGoalClarification(value)).toBe(false);expect(needsGoalClarification(next)).toBe(true);
 expect(next.publicity).toBe('public');expect(next.intake).toBeUndefined();
});

it('BUG: valid reports can export a backup exceeding the import limit',async()=>{
 const history=await import('../../src/lib/session/history');
 const base={version:1 as const,kind:'markdown' as const,savedAt:'2026-10-09',createdAt:'2026-10-09',country:'GB',title:'Audit fixture',markdown:'a'.repeat(1_600_000)};
 expect(history.SavedReportSchema.safeParse({...base,id:'one'}).success).toBe(true);
 const backup=history.historyBackup([{...base,id:'one'},{...base,id:'two'}]);
 expect(backup.length).toBeGreaterThan(3_000_000);
 await expect(history.parseHistoryImport(backup)).rejects.toThrow('size');
});

it('BUG: a deleted report is resurrected by an open legacy session on archive',async()=>{
 const flow=await import('../../src/lib/session');const history=await import('../../src/lib/session/history');
 flow.saveInput(DEMO_SCENARIOS[0].input);flow.saveResult(result);
 // Another tab deletes the localStorage report; this tab retains its sessionStorage.
 expect(history.deleteSavedReport(result.analysisId)).toBe(true);expect(history.readHistory()).toHaveLength(0);
 flow.archiveCurrentSession();
 expect(history.readHistory().map(r=>r.id)).toContain(result.analysisId);
});

it('BUG: HistoryView deletion condition clears a subsequently edited draft',async()=>{
 const flow=await import('../../src/lib/session');const history=await import('../../src/lib/session/history');
 flow.saveInput(DEMO_SCENARIOS[0].input);flow.saveResult(result);
 flow.saveInput({...DEMO_SCENARIOS[0].input,country:'A new edited country'});
 expect(flow.isResultStale()).toBe(true);
 // Same branch as HistoryView.remove.
 if(history.deleteSavedReport(result.analysisId)&&flow.readSession().result?.analysisId===result.analysisId)flow.clearSession();
 expect(flow.readSession().input).toBeNull();
});

it('BUG: exporting an unchanged historical report pulls current mutable corpus content',()=>{
 const owner=cases.find(c=>result.comparableCases.some(m=>m.caseId===c.caseId))!;
 expect(owner).toBeDefined();
 const before=analysisMarkdown(result,DEMO_SCENARIOS[0].input);
 const saved=owner.statusSummary;
 try {owner.statusSummary='AUDIT_NEW_CORPUS_STATUS';const after=analysisMarkdown(result,DEMO_SCENARIOS[0].input);expect(after).not.toBe(before);expect(after).toContain('AUDIT_NEW_CORPUS_STATUS');}
 finally{owner.statusSummary=saved;}
});

it('GAP: exact quote check accepts a summary that reverses its meaning',()=>{
 const value=input();value.intake!.narrative='对方明确否认收到任何款项。';
 const checked=validateIntakeOutput({facts:[{quote:'对方明确否认收到任何款项。',summary:'对方确认收到全部款项',slot:'claim'}],questions:[]},value,'zh','mock');
 expect(checked.facts[0].text).toBe('对方确认收到全部款项');
});

it('GAP: a non-browser JSON request passes the origin guard without Origin',()=>{
 const request=new Request('https://caselink-eight.vercel.app/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
 expect(()=>checkRequestOrigin(request)).not.toThrow();
});

```

配置：
```typescript
import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 resolve:{alias:{'@':fileURLToPath(new URL('../../src',import.meta.url))}},
 test:{include:['test-results/audit-20261009/repro.test.ts']},
});

```

项目内执行：
```sh
npx vitest run --config test-results/audit-20261009/vitest.config.mts --reporter=verbose
```

本次记录：
```text

 RUN  v5.0.3 <PROJECT_ROOT>

 ✓ test-results/audit-20261009/repro.test.ts > BUG: UI england_wales becomes unconfirmed in public research 60ms
 ✓ test-results/audit-20261009/repro.test.ts > BUG: UI northern_ireland routes to the Republic of Ireland 30ms
 ✓ test-results/audit-20261009/repro.test.ts > CONTROL: Scotland remains recognized 1ms
 ✓ test-results/audit-20261009/repro.test.ts > BUG: switch to classic silently discards goal, disclosure, answers and narrative tail 0ms
 ✓ test-results/audit-20261009/repro.test.ts > BUG: valid reports can export a backup exceeding the import limit 2ms
 ✓ test-results/audit-20261009/repro.test.ts > BUG: a deleted report is resurrected by an open legacy session on archive 4ms
 ✓ test-results/audit-20261009/repro.test.ts > BUG: HistoryView deletion condition clears a subsequently edited draft 1ms
 ✓ test-results/audit-20261009/repro.test.ts > BUG: exporting an unchanged historical report pulls current mutable corpus content 1ms
 ✓ test-results/audit-20261009/repro.test.ts > GAP: exact quote check accepts a summary that reverses its meaning 1ms
 ✓ test-results/audit-20261009/repro.test.ts > GAP: a non-browser JSON request passes the origin guard without Origin 1ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  16:18:24
   Duration  390ms (transform 35%, tests 33%, import 31%)


```

## 附录 C：线上虚构样例及完整响应

下列为实际保存的输入和响应；不对应真实委托关系。耗时是客户端单次测量，不是性能分位数或 SLA。

### `confirmed-fictional-input.json`

```json
{
  "country": "英国",
  "stage": "unknown",
  "currentProblems": [
    "unknown"
  ],
  "background": {
    "personType": "unknown",
    "activities": [],
    "description": ""
  },
  "primaryGoal": "other",
  "keyDates": [],
  "resources": [
    "unknown"
  ],
  "resourceConstraints": "",
  "priorActions": {
    "status": "unknown",
    "description": "",
    "date": ""
  },
  "publicity": "private",
  "isExample": true,
  "exampleId": "audit-fictional-repair",
  "intake": {
    "version": 1,
    "jurisdiction": "england_wales",
    "caseKind": "civil",
    "expression": "no",
    "narrative": "虚构审计样例：我委托维修服务商修理自己的自行车，约定更换刹车。对方声称已经完成，但我发现刹车仍不能使用。我有付款记录和聊天记录。双方尚未起诉。",
    "goalText": "了解如何整理材料，与服务商讨论返还维修费。",
    "disclosureDetails": "只做内部整理，不联系媒体，不公开任何身份信息。",
    "facts": [
      {
        "id": "fact-1",
        "text": "委托服务商维修自行车并约定更换刹车",
        "quote": "我委托维修服务商修理自己的自行车，约定更换刹车。",
        "summary": "委托服务商维修自行车并约定更换刹车",
        "slot": "event"
      },
      {
        "id": "fact-2",
        "text": "服务商称已完成；用户发现刹车仍不能用",
        "quote": "对方声称已经完成，但我发现刹车仍不能使用。",
        "summary": "服务商称已完成；用户发现刹车仍不能用",
        "slot": "event"
      },
      {
        "id": "fact-3",
        "text": "持有付款记录和聊天记录",
        "quote": "我有付款记录和聊天记录。",
        "summary": "持有付款记录和聊天记录",
        "slot": "evidence"
      },
      {
        "id": "fact-4",
        "text": "双方尚未起诉",
        "quote": "双方尚未起诉。",
        "summary": "双方尚未起诉",
        "slot": "status"
      }
    ],
    "answers": [
      {
        "questionId": "dynamic-59d9c914b2a33de16f98",
        "question": "服务商如何回应刹车仍不能使用",
        "answer": "尚未向服务商反馈，想先整理材料再决定。",
        "anchorQuote": "对方声称已经完成，但我发现刹车仍不能使用。"
      }
    ],
    "confirmed": true
  },
  "schemaVersion": "1.0"
}
```

### `live-intake.json`

```json
{
  "httpStatus": 200,
  "elapsedMs": 3618,
  "result": {
    "mode": "live_ai",
    "facts": [
      {
        "id": "fact-1",
        "text": "委托服务商维修自行车并约定更换刹车",
        "quote": "我委托维修服务商修理自己的自行车，约定更换刹车。",
        "summary": "委托服务商维修自行车并约定更换刹车",
        "slot": "event"
      },
      {
        "id": "fact-2",
        "text": "服务商称已完成；用户发现刹车仍不能用",
        "quote": "对方声称已经完成，但我发现刹车仍不能使用。",
        "summary": "服务商称已完成；用户发现刹车仍不能用",
        "slot": "event"
      },
      {
        "id": "fact-3",
        "text": "持有付款记录和聊天记录",
        "quote": "我有付款记录和聊天记录。",
        "summary": "持有付款记录和聊天记录",
        "slot": "evidence"
      },
      {
        "id": "fact-4",
        "text": "双方尚未起诉",
        "quote": "双方尚未起诉。",
        "summary": "双方尚未起诉",
        "slot": "status"
      }
    ],
    "questions": [
      {
        "id": "dynamic-59d9c914b2a33de16f98",
        "title": "服务商如何回应刹车仍不能使用",
        "reason": "叙述说明服务商称已完成维修，但未说明其是否回应刹车仍不能使用或是否提出返还维修费。",
        "options": [
          "尚未告知服务商",
          "已告知，未回应",
          "已回应但未同意返还",
          "其他"
        ],
        "sourceIds": [],
        "anchorQuote": "对方声称已经完成，但我发现刹车仍不能使用。"
      }
    ],
    "sources": [],
    "model": "gpt-6-luna"
  }
}
```

### `live-analysis.json`

```json
{
  "httpStatus": 200,
  "elapsedMs": 87006,
  "result": {
    "comparableCases": [],
    "actionOptions": [
      {
        "actionId": "organize-repair-evidence",
        "goal": "other",
        "title": "内部整理约定、完工声明与刹车现状",
        "applicability": "priority",
        "reason": "应先区分“约定更换刹车”“服务商称已完成”与您观察到的故障，避免把尚未查明的维修原因写成确定事实。",
        "leadRole": "您本人",
        "prerequisites": [],
        "timing": "现在整理；目前不向服务商或其他外部接收者发送。",
        "steps": [
          "从聊天记录提取维修约定及完工声明，逐项标注日期和对应记录。",
          "记录刹车不能使用的具体表现，区分维修前已有问题与维修后观察。",
          "将每项争点对应到付款或聊天记录，并标出尚无材料支持的部分。"
        ],
        "materials": [
          "原始聊天记录及已有维修凭据",
          "付款记录与刹车现状记录"
        ],
        "collaborators": [],
        "followUp": [
          "能否确认更换的是哪些部件，以及是否约定恢复正常制动。",
          "现有记录能否区分实际更换、维修质量与其他故障原因。"
        ],
        "supportingEvidenceIds": [],
        "differences": [],
        "uncertainties": [
          "服务商实际完成的维修内容尚未查明。",
          "目前未提供独立检查意见，不能确定故障归因。"
        ],
        "basisType": "general_preparation",
        "requiresPublicity": false,
        "resourceIds": []
      },
      {
        "actionId": "itemize-refund-request",
        "goal": "other",
        "title": "逐项核对拟要求返还的维修费",
        "applicability": "priority",
        "reason": "网页案例区分了不同诊断与维修费用，提示退款准备应逐项说明费用对应的服务，而不是把全部支出直接视为应退金额。",
        "leadRole": "您本人",
        "prerequisites": [
          "以实际付款及约定内容为依据，不预设退款资格或金额。"
        ],
        "timing": "证据整理后，先形成仅供内部使用的金额明细。",
        "steps": [
          "按付款记录列出实际支付金额、收款对象及对应的维修项目。",
          "对每项拟退款费用注明约定内容、履行争议及现有证据。",
          "分别写出希望全额或部分返还的理由，标明无法拆分的费用。"
        ],
        "materials": [
          "付款明细及已有收费凭据",
          "维修项目与拟退款理由对照表"
        ],
        "collaborators": [],
        "followUp": [
          "付款能否与此次刹车维修明确对应。",
          "退款范围是否包含尚无履行争议或未明确约定的项目。"
        ],
        "supportingEvidenceIds": [],
        "differences": [
          "网页案例涉及汽车的两次诊断和维修；您描述的是自行车刹车更换。",
          "该案例有消费者指定部件的争议，您目前没有描述这一情形。"
        ],
        "uncertainties": [
          "实际支付金额及收费项目拆分尚未提供。",
          "网页裁决不能证明您有权获得相同或全部退款。"
        ],
        "basisType": "web_research",
        "requiresPublicity": false,
        "resourceIds": []
      },
      {
        "actionId": "prepare-private-discussion",
        "goal": "other",
        "title": "内部拟定协商稿，待确认后再决定是否发送",
        "applicability": "priority",
        "reason": "您尚未反馈故障且目前只允许内部整理，因此可以先准备事实说明与退款请求，但不能直接联系服务商或启动外部投诉。",
        "leadRole": "您本人",
        "prerequisites": [
          "本项仅限内部起草；任何对外发送前，须由您明确确认接收者和可分享内容。"
        ],
        "timing": "完成争点及费用明细后起草；是否发送留待您决定。",
        "steps": [
          "起草简短故障说明，分别写明维修约定、完工说法和您的观察。",
          "在草稿中列出拟退款项目，并提出请服务商说明实际维修内容的问题。",
          "设置回应记录表，分别记录对方承认、否认或提出其他处理方案的情况。"
        ],
        "materials": [
          "内部协商草稿及必要证据目录",
          "拟退款明细与回应记录表"
        ],
        "collaborators": [],
        "followUp": [
          "您是否明确允许向服务商发送哪些内容；未确认前不发送。",
          "若以后收到回应，是否需据实际维修说明调整争点与退款范围。"
        ],
        "supportingEvidenceIds": [],
        "differences": [
          "网页案例已进入裁决阶段，您与服务商尚未就故障开展沟通。",
          "汽车争议处理路径不能据此认定适用于自行车维修。"
        ],
        "uncertainties": [
          "服务商尚未收到您的故障反馈，不能推定其已拒绝处理。",
          "目前资料不足以确认任何外部争议处理机构的适用范围。"
        ],
        "basisType": "web_research",
        "requiresPublicity": false,
        "resourceIds": []
      }
    ],
    "missingInformation": [
      "维修费实际金额、收费项目，以及是否有报价单、发票或工单。",
      "更换刹车的具体约定，包括部件范围及是否明确约定恢复正常制动。",
      "维修前后刹车故障的具体表现，以及现有照片、视频或检查记录。",
      "若之后决定协商，允许向服务商分享的材料范围；当前仅限内部整理。"
    ],
    "limitations": [
      "本次已检索网页来源，其内容与本案适用性仍需人工核查；有引用不等于独立事实核实。",
      "你提供了自由填写的披露边界，系统不能确认已完整理解其中限制；总体可公开不等于同意某次具体披露。任何对外分享前，须与当事人逐项核实内容、接收者、方式和同意范围。",
      "这是您确认的虚构审计样例；付款、聊天及故障描述均为用户提供的信息，并非独立核实事实。",
      "本次只有一项网页案例，没有可用的正式库历史案例；比较仅用于识别争点，不证明本案责任或退款权利。",
      "研究不是本地法律意见，不能据此确定英格兰及威尔士的适用程序、资格或期限；本次不安排外部提交或公开传播。"
    ],
    "analysisId": "7d29f3a4-5de3-481f-9bf7-599a63bc7497",
    "schemaVersion": "1.0",
    "inputHash": "45ed17a422089736761cebbe8b5eed5f434fdc126e51f7eef8ac27a50049407f",
    "corpusVersion": "2026-10-08.v2",
    "promptVersion": "3.1",
    "createdAt": "2026-10-09T20:22:00.840Z",
    "mode": "live_ai",
    "webResearch": {
      "status": "completed",
      "searchedAt": "2026-10-09T20:20:33.962Z",
      "searchTerms": [
        "UK jurisdiction to confirm civil 自行车维修服务 更换刹车后仍不能使用 消费者合理技能与谨慎义务",
        "UK jurisdiction to confirm civil 消费者维修服务履行不符合约定 重新履行 价格减免 退还维修费 条件",
        "UK jurisdiction to confirm civil 维修费用退款协商 材料整理 付款凭证 聊天记录 合同内容证明",
        "UK jurisdiction to confirm civil 维修后故障 维修质量与故障因果关系 检查意见 退款范围"
      ],
      "passages": [
        {
          "text": "消费者称，汽车接受两小时诊断及首次维修后，原故障仍然存在；之后又付费接受五小时诊断及维修，故障才被解决。消费者要求退还第二次诊断费用及首次失败维修的费用。商家则称，首次更换电子控制单元是消费者坚持要求的，且违背其建议。裁决员最终仅支持退还首次两小时诊断费用，未支持退还成功查明故障的五小时诊断费用。页面未给出裁决日期，最后明确报告的阶段是该裁决；后续程序未获确认。**可比点**是维修后故障仍在及退款范围；**关键差异**是本案涉及两次诊断，而且首次更换部件据商家称由消费者指定，不能直接类推为约定维修未履行。来源：案件全文",
          "sourceIds": [
            "web-1"
          ]
        }
      ],
      "sources": [
        {
          "sourceId": "web-1",
          "url": "https://www.themotorombudsman.org/case-studies/refund-for-diagnostics/",
          "title": "来源：案件全文",
          "hostname": "www.themotorombudsman.org",
          "citationKind": "tool_returned_link",
          "pageOpened": true
        }
      ],
      "searchCallCount": 1,
      "failureReason": null,
      "plan": {
        "domain": "consumer_services",
        "relationship": "消费者委托维修服务商对其自行车进行刹车更换；目前处于材料整理阶段，尚未向服务商提出故障反馈。",
        "disputedConduct": [
          "服务商表示约定的维修已完成，但消费者称维修后刹车仍无法正常使用；是否实际更换及履行质量有待核实。"
        ],
        "harms": [
          "消费者称约定维修未恢复刹车功能，已支付费用对应的服务价值存在争议。"
        ],
        "remedies": [
          "整理交易及维修材料，为与服务商协商退还维修费用作准备。"
        ],
        "evidenceIssues": [
          "付款凭证可用于核对支付对象、费用及交易关联。",
          "沟通记录可用于确认更换刹车的约定、服务商的完工表示及双方沟通过程。",
          "需要区分消费者观察到的故障与维修履行情况，可整理维修前后状况及适当的检查材料。"
        ],
        "excludedIssues": [
          "双方尚未提起诉讼。",
          "材料仅供内部整理，不涉及媒体联系、公开传播或身份披露。",
          "尚无消费者反馈后服务商拒绝处理或拒绝退款的事实。"
        ],
        "uncertainties": [
          "刹车是否已更换、实际维修内容及故障原因尚不明确。",
          "维修约定的具体条款及服务商是否提供书面凭据尚不明确。",
          "服务商对故障反馈及退款协商将如何回应尚不明确。",
          "是否具备独立检查意见或其他维修质量证据尚不明确。"
        ],
        "searchQueries": [
          "自行车维修服务 更换刹车后仍不能使用 消费者合理技能与谨慎义务",
          "消费者维修服务履行不符合约定 重新履行 价格减免 退还维修费 条件",
          "维修费用退款协商 材料整理 付款凭证 聊天记录 合同内容证明",
          "维修后故障 维修质量与故障因果关系 检查意见 退款范围"
        ],
        "coverage": "adequate"
      },
      "planningMode": "semantic",
      "actualQueries": [
        "site.themotorombudsman.org case study repair refund failed repair",
        "UK bicycle repair negligence refund court case",
        "site.themotorombudsman.org case studies repair incorrect diagnosis refund"
      ],
      "attempts": [
        {
          "attempt": 1,
          "reason": "initial",
          "startedAt": "2026-10-09T20:20:33.962Z",
          "status": "completed",
          "searchTerms": [
            "UK jurisdiction to confirm civil 自行车维修服务 更换刹车后仍不能使用 消费者合理技能与谨慎义务",
            "UK jurisdiction to confirm civil 消费者维修服务履行不符合约定 重新履行 价格减免 退还维修费 条件",
            "UK jurisdiction to confirm civil 维修费用退款协商 材料整理 付款凭证 聊天记录 合同内容证明",
            "UK jurisdiction to confirm civil 维修后故障 维修质量与故障因果关系 检查意见 退款范围"
          ],
          "actualQueries": [
            "site.themotorombudsman.org case study repair refund failed repair",
            "UK bicycle repair negligence refund court case",
            "site.themotorombudsman.org case studies repair incorrect diagnosis refund"
          ],
          "searchCallCount": 1,
          "sourceCount": 1,
          "failureReason": null
        }
      ],
      "relevanceStatus": "not_assessed"
    },
    "webComparisons": [
      {
        "title": "汽车诊断及维修费用退款争议",
        "jurisdiction": "英国；所给段落未明确具体构成法域",
        "statusAsOf": null,
        "summary": "资料记载，消费者称首次两小时诊断及维修后故障仍在，第二次五小时诊断及维修后才解决。消费者要求退还第二次诊断及首次失败维修费用；商家称首次更换电子控制单元是消费者坚持要求且违背其建议。裁决员最终仅支持退还首次两小时诊断费用，未支持退还成功查明故障的五小时诊断费用。裁决日期未提供，资料未确认该裁决之后的程序。",
        "similarities": [
          "都涉及消费者认为维修后原问题仍未解决，以及支付费用与服务结果之间的争议。",
          "都需要将退款项目与对应的约定、实际服务及故障情况分别核对。"
        ],
        "differences": [
          "该案例涉及汽车的两次诊断和维修；您描述的是一次自行车刹车更换委托。",
          "商家对消费者指定部件提出异议，您目前没有描述此类争议。",
          "该案例已有裁决；据您的叙述，本案尚未反馈故障，也未起诉。"
        ],
        "sourceIds": [
          "web-1"
        ]
      }
    ],
    "actionWebSources": [
      {
        "actionId": "itemize-refund-request",
        "sourceIds": [
          "web-1"
        ]
      },
      {
        "actionId": "prepare-private-discussion",
        "sourceIds": [
          "web-1"
        ]
      }
    ],
    "actionOrigins": [
      {
        "actionId": "organize-repair-evidence",
        "origin": "ai",
        "reason": null
      },
      {
        "actionId": "itemize-refund-request",
        "origin": "ai",
        "reason": null
      },
      {
        "actionId": "prepare-private-discussion",
        "origin": "ai",
        "reason": null
      }
    ],
    "researchAssessment": {
      "status": "relevant_cases_found",
      "attempts": 1,
      "recovery": "not_needed",
      "note": "AI 从本次公开资料中选出可比较案件；事实与适用性仍需核查。"
    },
    "historicalComparisons": [],
    "sources": []
  }
}
```

## 附录 D：验证记录摘录

### `unit-tests.log`

```text

> caselink@0.1.0 test
> vitest run


 RUN  v5.0.3 <PROJECT_ROOT>


 Test Files  19 passed (19)
      Tests  316 passed | 2 skipped (318)
   Start at  16:16:02
   Duration  1.15s (tests 45%, import 37%, transform 18%, worker 1%)


```

### `typecheck-final.log`

```text

> caselink@0.1.0 typecheck
> tsc --noEmit


```

### `corpus-validation.log`

```text
{"status": "passed", "documents": 21, "cases": 22, "excerpts": 187, "scope": "hash, page, quotation and ownership; semantic support separately reviewed"}

```

### `production-http-receipt.json`

```text
{
  "status": "passed",
  "mode": "live",
  "anonymous": true,
  "modelRequests": 0,
  "latencyMs": 611,
  "checks": [
    {
      "name": "live_capabilities_no_password",
      "status": "passed",
      "latencyMs": 207,
      "httpStatus": 200,
      "mode": "live"
    },
    {
      "name": "invalid_input_rejected",
      "status": "passed",
      "latencyMs": 61,
      "httpStatus": 400,
      "errorCode": "INVALID_INPUT"
    },
    {
      "name": "explicit_force_rule_available",
      "status": "passed",
      "latencyMs": 123,
      "httpStatus": 200,
      "mode": "rule_reference",
      "counts": {
        "actions": 3,
        "cases": 3,
        "sources": 26
      }
    },
    {
      "name": "cross_site_analysis_rejected",
      "status": "passed",
      "latencyMs": 41,
      "httpStatus": 403,
      "errorCode": "FORBIDDEN"
    },
    {
      "name": "case_myriam-bribri",
      "status": "passed",
      "latencyMs": 118,
      "httpStatus": 200
    },
    {
      "name": "case_emna-chargui",
      "status": "passed",
      "latencyMs": 121,
      "httpStatus": 200
    },
    {
      "name": "case_aigul-utepova",
      "status": "passed",
      "latencyMs": 177,
      "httpStatus": 200
    }
  ]
}

```

### `source-integrity.json`

```text
{
  "checkedFiles": 125,
  "changedOrMissingFiles": [],
  "businessSourceUnchangedSinceManifest": true
}

```

## 附录 E：下一轮验收条件建议

这些是后续验收条件，尚未实施或宣称通过。

| 编号 | 最小验收条件 |
|---|---|
| F1 | 界面枚举 england_wales、northern_ireland、scotland 都保持 GB 及正确法域；改变国家后无旧法域残留。 |
| F2 | 切换问卷不丢失长叙述、目标、追问、法域和披露边界；AI 偏好独立于事实记录。 |
| F3 | 相同请求幂等复用；超限不触发模型；全局预算和并发约束在多实例下生效；清晰反馈。 |
| F4 | 失败后修改输入能再次提交；不会无限自动重试；取消和旧响应不覆盖新草稿。 |
| F5 | 删除 A 报告保留已修改的 B 草稿；提示与实际影响一致。 |
| F6 | 双标签页删除后，另一标签页刷新、归档、新建均不复活报告。 |
| F7 | 每份系统备份都可恢复；覆盖中文字节数、数量限制、拆分文件及存储配额。 |
| F8 | 语料更新后，旧报告显示、弹窗及导出保持当时内容；重新生成或迁移显式区分。 |

额外建立否定、金额、主体归属摘要评测，法域输入集，逐条网页来源支持检查，以及找不到相关案例的诚实输出测试。不要只检查字段合法或存在 URL。
