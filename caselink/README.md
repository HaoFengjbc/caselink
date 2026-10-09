# CaseLink

从真实诉求出发，检索公共案件并梳理可核查的下一步。中英文、桌面优先的独立黑客松原型；支持自由描述不同争议，不再要求先套入记者、公共表达或刑事案件选项。

当前生产版本为语义研究 **v3.1**（`PROMPT_VERSION=3.1`）：自由填写的诉求默认成为主目标，Luna 根据完整案情生成动态事实补问，Sol 先做公共研究规划、再搜索与综合；没有合适比较时最多补查一次。已完成306项自动化检查、类型检查、生产构建及真实模型样本验收；正式网站已重跑原始代练案例并验证下载。执行范围与已知限制见 [实际验收](docs/verification.md)。本地默认演示模式无需密钥。

正式站点：[caselink-eight.vercel.app](https://caselink-eight.vercel.app)，当前已发布 v3.1。2026-10-07的 Sol 接入、2026-10-08的自由案情与取消密码等批次保留在 [AI接入记录](docs/ai-integration.md) 和 [实际验收](docs/verification.md)，仅代表各自当时的验证范围。

## 界面版本

当前目录持续迭代；两个早期界面快照保留，未同步本轮自由案情与双模型功能：

- **v3 海报风格（当前目录）**：奶白与米色、大字距、珊瑚色强调，页头可切换**中文 / English**。默认入口为三步自由案情流程，主要诉求直接填写、快捷目标可选，动态补问保留原话依据；经典逐题问卷仍保留。视觉基础见 [docs/design-v3.md](docs/design-v3.md)，新流程见 [docs/adaptive-intake.md](docs/adaptive-intake.md)。
- **v2 现代卡片版**：`../caselink-v2-modern`，图标卡片式选项与右侧案情轮廓，说明见其中的 `V2_VERSION.md`。
- **v1 经典版**：`../caselink-v1-classic`，重构前的原始界面，说明见其中的 `CLASSIC_VERSION.md`。其生产部署 ID 记录在 [部署记录](docs/deployment.md)，可用于回退。

## 本地启动

使用 Node.js **24 LTS** 和 npm。项目有锁文件，依赖安装在项目内。

```sh
cd /Users/fenghao/Desktop/hackhaton/caselink
npm ci
npm run dev
```

浏览器打开 http://127.0.0.1:3000 。默认演示模式无需 API key，无需数据库。生产模式：

```sh
npm run typecheck
npm test
npm run build
npm start
```

浏览器验收在已启动的服务器上运行 `npm run test:e2e`，使用本机 Chrome；其他测试机器可改 Playwright 的 channel 或安装相应浏览器。`TEST_BASE_URL` 可指定服务地址。请求竞态与错误恢复可另外运行 `npm run test:browser-guards`（本地模拟响应，不调用模型）。实际执行结果见 [验收记录](docs/verification.md)。

生产构建命令使用 Next.js 的 webpack 模式，沿用早期批次对本环境 Turbopack CSS worker 端口权限问题的处理。本轮构建与生产启动结果须见新的验收记录，不能由历史成功推断。

当前这台 Mac 附带 Node 24：`/Users/fenghao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`。系统 Node 25 不在本项目所选 Vitest 的支持范围，执行测试与构建请使用 Node 24。没有修改系统 Node 或全局安装依赖。

## 功能与路由

- `/`：产品入口、两个虚构示例、真实历史资料概览。
- `/new`：地区与司法辖区、自由案情与主要诉求、AI 原话整理及最多三道动态事实补问、人工核对；可直接手动继续。`?mode=classic`保留原九题问卷。
- `/review`：确认摘要，点击后才发起分析。
- `/history`：本浏览器的「我的分析」，按时间保存完成报告，支持搜索、打开快照、下载全部 JSON 备份、导入 JSON／旧 Markdown 报告。查看历史不重新调用 AI。
- `/analysis`：默认联网发现，显示研究计划、资料状态、案例相关性与引用；最多三项行动逐项标注 AI／规则／预置来源。正式库比较、信息缺口、英文原文与页码另行保留，支持复制、Markdown、打印／浏览器另存 PDF。
- `/cases`、`/cases/[id]`：按国家、身份、材料标签筛选，时间线、实际行动、结果、报告建议分别展示。
- `/api/analyze`：校验输入、无工具语义规划、公开抽象搜索、无工具综合；未采用合适网页比较时最多补查一次，正式库候选至多3个，服务端检查引用并装配状态。
- `/api/intake`：使用 GPT-6 Luna 读取完整叙述与已有回答，提取原话并生成带原话依据的动态事实问题；服务器分配稳定 ID、检查边界，保留英国辖区固定补问。不会替用户选择公开意愿或生成法律建议。
- `/api/capabilities`：只暴露可用模式和配置状态；实时分析无需密码或授权Cookie。

当前草稿保存在本标签页的 sessionStorage；完成的报告以独立快照保存在本浏览器 localStorage，包含当时的输入、结果、引用与版本，关闭标签页后仍可查看。没有跨设备或多人共享历史，清除网站数据会删除本地记录。「开始新分析」清空当前草稿和 AI 整理状态，保留历史报告；「编辑」保留案情。旧版本报告仍可查看，明确显示版本提示，不会自动重跑。存储不足时不删除旧报告，显示下载备份提示。旧单结果按原始输入标识迁移，不能恢复已经被覆盖且未导出的结果。页面不要求真实姓名、地址或证件号码。

## 三种生成状态

1. **预置演示**：只对应两个固定虚构输入，不调用模型。改动输入后不再套用固定演示身份。
2. **规则参考**：根据输入确定性检索与生成参考卡，展示证据与条件，明确未调用实时 AI。
3. **实时 AI**：只有 `ANALYSIS_MODE=live` 且 key、model 均有效配置后可调用。使用 OpenAI 官方 SDK、Responses API、Zod Structured Outputs。模型不拥有库内来源原文、模式、报告日期、页码或服务器元数据的写入权。整体实时状态不代表一定找到相关案例，也不代表每项行动由模型生成；`actionOrigins`逐项标明来源。

`ANALYSIS_MODE=demo` 即使存在 key 也不会调用模型。首轮综合错误不会悄悄转为成功，使用者可显式选择规则参考。规划／搜索失败可继续生成带明确限制的一般准备；补充研究失败只保留此前已通过校验的配对结果，并披露失败。没有模型配置时不声称已做真实 AI 实测。

## 开启实时模式

将 `.env.example` 复制为项目内 `.env.local`，自行在本机或部署平台安全填写；不要把 API key 放聊天、网页或 Git。

```dotenv
ANALYSIS_MODE=live
OPENAI_API_KEY=由你安全填写
OPENAI_MODEL=gpt-6.1-sol
OPENAI_INTAKE_MODEL=gpt-6-luna
OPENAI_REASONING_EFFORT=low
AI_MAX_OUTPUT_TOKENS=9000
AI_TIMEOUT_MS=90000
AI_INTAKE_TIMEOUT_MS=30000
```

案情整理使用 GPT-6 Luna；Sol 的无工具语义规划最多25秒，每轮网页研究分发现与原文读取，两阶段共享65秒、合计最多6次工具调用，每轮综合分析默认90秒。首轮没有合适比较且时间足够时，仅补充搜索和综合一次，不重新规划。完整分析共享270秒预算，Route Handler声明300秒，浏览器等待290秒。整理为独立请求，默认30秒、Route Handler40秒、浏览器35秒。实际模型可用性和平台时限仍需该 API 项目及部署环境验证。无需站内密码；SDK 自动重试关闭，应用的一次补充检索不等同于 SDK 重试。

模型取舍、当前准备状态与密钥填写步骤见 [AI 接入记录](docs/ai-integration.md)。

当前未实现跨实例的持久化限流。项目不会自动提交申请、联系机构或向第三方发消息。

## 数据与证据

当前正式语料版本为 `2026-10-08.v2`：**21 份独立来源、22 条案件记录、14 个地区、187 条引文**，由 20 份 CFJ PDF 和 1 份 ABA 网页打印件组成。本轮从三个资料目录的 26 个原始文件（24 个 PDF、2 个 sources.json）去重整理，18 份新增文档已生成 19 条新增案件记录；Pakistan 专题中的两案共享一个来源，Omar Radi 同一人的两起程序分别保留。详见[新资料盘点](docs/new-corpus-inventory.md)。

入库核查针对选定引文、对应页码及必要上下文，不代表对 804 页完成全部精读或对事件进行独立调查。实时且已确认的自由案情以结构化字段和叙述关键词召回最多 3 个候选；没有命中信号时可为 0，模型也可全部排除。关键词不是已确认案情。实时分析已接入 OpenAI 原生 `web_search`，以联网发现为主、正式库补充。完整案情会交给无搜索工具的语义规划与综合分析。公开搜索接收规范化地区和经过筛查的关系、争议行为、损害、诉求及证据问题等自然语言抽象，不再只靠固定标签；私有核对摘录和标识列表不进入搜索载荷。此类筛查是有限启发式，不能保证完全匿名或完整法律理解。网页引用、研究关键词、工具返回的实际查询、查询时间、轮次、比较差异与失败状态均展示并导出。资料获取状态与案例相关性分别记录；有引用不等于相关或已核实，网页发现不会自动进入正式库。详见 [联网研究说明](docs/web-research.md)。

首批历史语料（`2026-10-07.v1`）包含三份独立报告：Aigul Utepova（64页，2022-04）、Emna Chargui（35页，2021-06）、Myriam Bribri（16页，2021-06）。记者、博主、活动人士身份分别记录。官方 PDF 与提供的文件哈希一致，页面使用已核实的官方链接，不把原始报告纳入 public。报告时期不等于今天。该首批保留记录不代表当前仅有三案。

原始文件可放 `.local-sources/`（被 Git 忽略），提取工具只在开发阶段运行：

```sh
python3 scripts/extract_pdfs.py --help
python3 scripts/check_evidence.py --help
```

提取按 SHA-256 去重、保留物理页码；ABA 网页打印件的页码只用于本地归档核对，不生成官方 PDF 跳页链接。运行网站只读 `data/cases/cases.json`、`data/evidence/evidence.json`、`data/evidence/documents.json`、`data/resources/resources.json`，不需要 Python，不现场解析或爬取 PDF。正式入库计数与来源映射记录在 `data/evidence/ingestion.json`。核对方法、可复制命令和资料问题见 [数据说明](docs/data-notes.md)。

Emna 判决日期的报告内部冲突同时保留；获庇护不代表撤销定罪。Aigul 出院与撤案、完全解除限制分别记录。Myriam 报告时程序未决。报告作者建议不是已实施行动；材料未记载不是没有发生。

## 工程与交付文档

- [架构与边界](docs/architecture.md)
- [Vercel 部署](docs/deployment.md)
- [两分钟演示](docs/demo-script.md)
- [实际测试与未执行项](docs/verification.md)
- [数据来源与局限](docs/data-notes.md)

Vercel 项目、当前部署与历史版本见 [部署记录](docs/deployment.md)。本轮真实模型样本、浏览器下载、失败发现与修复记录见 [verification.md](docs/verification.md)。补充检索可能接近5分钟；有限场景验收不证明所有案件均能找到合适比较。

项目沿用现有 Hobby 配置；本说明不表示本轮执行了部署、购买套餐或修改云端资源。

## 许可与第三方材料

这是独立原型，不是 TrialWatch 官方产品，未使用其官方标识，也不声称获得认可。原报告及摘录的权利属于原作者／机构，与项目源代码的权利分开。正式开源前由项目所有者确认源代码许可证，并复核第三方引用与再分发条件；当前未擅自为第三方 PDF 授权。

实现参考：[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)、[Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)。
