# CaseLink What’s Next — 本轮交付与验收

> 上线状态（2026-10-09 20:57 补记）：本分支已与 PDF 整理页改版一起合并进 main（`be57309`）并部署到生产（`dpl_FadMKBRm8qX9HyXZjaGjsYtDWD8p`）。上线后 `tests/e2e/whats-next.spec.ts` 4 项在生产环境以规则参考运行通过；下文“未部署”指本轮交付当时的状态。真实 AI 与人工评价的验收缺口不变。

2026-10-09，America/New_York。工程实现已完成；真实AI与目标用户／当地律师人工评价仍未通过验收，准确状态见下文。

## 本地演示

- 已运行优化后的本地生产构建：[普通手动输入](http://127.0.0.1:3041/new)、[我的分析](http://127.0.0.1:3041/history)、[跨案比较](http://127.0.0.1:3041/compare)。模式为demo／规则，未部署。
- 快速查看本轮三宗完整虚构案件：在“我的分析”点击“导入旧报告”，选择本目录的 [demo-history.json](demo-history.json)。这是实际手动浏览器流程的完整输入和输出快照，并非占位数据。导入是用户主动保存动作，原本无有效期的报告按现有规则保存7天；本轮未向用户的日常浏览器预写这些数据。
- 导入备份已在独立浏览器对生产构建实际验证：3份报告、每份3项优先工作、零分析／整理API调用，见 [生产演示验证](verification/production-demo-import.json)。
- 重新启动：在仓库的 `caselink` 目录执行 `ANALYSIS_MODE=demo npm run start -- --port 3041`；如代码有改动，先 `npm run build`。本轮未改变凭据或预算。

## 当前仓库与边界

实际Git根目录 `/Users/fenghao/Desktop/hackhaton`，应用目录 `caselink`。从干净的 `main`、提交 `79f40cd` 开始，工作分支 `codex/whats-next-mvp`。完整读取附带279行计划文件；实际AGENTS、README、最新交接与代码作为实现基线。主负责人先确定 [共享契约与文件归属](ownership.md)，A/B/C按边界并行，共享schema、分析API、引用检查与快照由主负责人集成。

本轮复用原结果页、法律四元组绑定、历史库、导出、主动保存和隐私流程。PDF上传、OCR、原文件存储代码未修改；[受保护文件哈希](verification/protected-pdf-files.json)记录所检查路径。未push、部署、联系机构、公开案情或递交材料。

## 已实现的使用闭环

1. 普通手动输入独立生成最多三项优先资料工作，并展示本案事实、用户目标、建议角色、缺口及其影响、可比历史行动／结果／差异、条款支持和条件。没有专门依据的时间线明确属于一般准备。
2. 生成并预览、编辑、复制、下载本案时间线与材料索引、问题—证据—法律依据表、当地律师内部简报。简报正文按A4单页实检，完整引用另附；其他两份为可编辑Markdown表格／文本。
3. 仅补会改变下一步且尚未回答的问题，允许未知。纯手动叙述的“已找到律师”“被带走”可用于准备任务与研究候选；文字线索不升级为已核实的当前拘押。
4. 内部机制资格研究与对外提交分别处理。内部披露限制不阻挡内部研究；已知实质资格不符合的路径、无拘押事实的WGAD路径和未经授权的外发均说明暂停原因。
5. 人工编辑使引用进入待复核；改案情后保留人工稿与新生成稿供显式合并。恢复生成稿重新检查冻结的命题／来源绑定；一般进度勾选不能产生team_verified。旧已保存报告不回填新库或覆盖原快照。
6. 原`/compare`保留2–4案上限，增加后续时间线、实际行动／提交／计划、参与者、结果、来源日期、所属范围与差异，并可实际导出。

推荐不读取exampleId；它只可能参与原示例模式标识。规则材料由服务器核查后的输入和来源确定性填充；实时AI若运行，参与已有分析层，其成功不能冒充材料经过人工审查。

## 导入、来源与保留

|项目|本轮实际结果|
|---|---|
|原始资料|21份后续报告＋总索引，共154页；原JSON/PDF独立留存，视为同一研究成果的两种格式|
|原始结构|150条混合时间线；121条逐报告来源，其中100条网页记录、96个独立URL；这些不是150个成功行动|
|映射与增量|21报告明确映射22个既有case记录；导入155事件，包含150原行与5项补充记录|
|旧六案|原24事件全部保留，其中12条仅在旧记录中存在；合并后167事件；三个旧JSON文件逐字节未改|
|原案库|22案件、187证据引文及原始截止日／文档记录不变，哈希受检|
|可推荐行动|8项本轮底层正文核查的历史行动；其余147增量事件仍为research_reported，不自动变成已核行动|
|法律|沿用22条资源，具体条款／段落定位38处；核心ICCPR19/9/14与GC34/35/32、KZ/TN/EAW当地规则和独立机制条件接入|
|人工核实|本轮新增team_verified为0；所有来源检查最多agent_checked，无律师已审核标记|

[导入／保留清单](history-import.md)、[可重复导入清单](../../data/followups/import-manifest.json)、[底层行动来源核对表](../../data/followups/source-check-audit.json)、[法律核查表](legal-audit.md)、[官方正文下载字节及哈希](legal-retrieval-log.json)。重复执行 `python3 scripts/import-followups.py --check` 逐字节一致。公开网页并非96条全部重新核实；打不开或未核的记录保留研究线索等级。

PECA法律改革只作背景；Toor/Ghauri后续另案、Radi两案、共同被告分别归属。计划／排期不算已实施，提交不算已获救济，释放不算撤罪，国际意见不算国内执行。行动与结果最多保留时间关系或明确的来源归属，不给成功率或因果保证。

## 三宗陌生手动输入与真实产物

以下均经`/new`手动入口填写并调用真实本地分析API，关闭AI，仅使用规则；没有注入结果、mock响应或exampleId。每案实际下载并读回三份Markdown。

|案件|输入与完整输出|实际下载|页面证据|
|---|---|---|---|
|哈萨克斯坦 Q-47：被带走、现有律师、限内部|[实际输入](ui-evidence/case-1/ordinary-input.json) · [完整输出](ui-evidence/case-1/complete-output.json)|[时间线](ui-evidence/case-1/CaseLink-timeline-81cedbde-811.md) · [问题表](ui-evidence/case-1/CaseLink-issue_matrix-81cedbde-811.md) · [简报](ui-evidence/case-1/CaseLink-lawyer_brief-81cedbde-811.md)|[三卡截图](ui-evidence/case-1/priority-cards.png) · [手机](ui-evidence/case-1/whats-next-mobile.png)|
|英格兰 V-92：民事道歉函、尚无律师|[实际输入](ui-evidence/case-2/ordinary-input.json) · [完整输出](ui-evidence/case-2/complete-output.json)|[时间线](ui-evidence/case-2/CaseLink-timeline-5e347bbc-853.md) · [问题表](ui-evidence/case-2/CaseLink-issue_matrix-5e347bbc-853.md) · [简报](ui-evidence/case-2/CaseLink-lawyer_brief-5e347bbc-853.md)|[三卡截图](ui-evidence/case-2/priority-cards.png) · [手机](ui-evidence/case-2/whats-next-mobile.png)|
|日本 N-18：行政许可、事实不足|[实际输入](ui-evidence/case-3/ordinary-input.json) · [完整输出](ui-evidence/case-3/complete-output.json)|[时间线](ui-evidence/case-3/CaseLink-timeline-10c4ded4-7c1.md) · [问题表](ui-evidence/case-3/CaseLink-issue_matrix-10c4ded4-7c1.md) · [简报](ui-evidence/case-3/CaseLink-lawyer_brief-10c4ded4-7c1.md)|[三卡截图](ui-evidence/case-3/priority-cards.png) · [手机](ui-evidence/case-3/whats-next-mobile.png)|

简报打印文件： [Q-47正文与引用附件](../../output/pdf/case-1-counsel-brief.pdf)、[V-92正文与引用附件](../../output/pdf/case-2-counsel-brief.pdf)、[N-18正文与引用附件](../../output/pdf/case-3-counsel-brief.pdf)。每份正文1页，附件从第2页开始；[分页／文本检查](ui-evidence/brief-print-checks.json)，[打印源与记录](ui-evidence/brief-print-manifest.json)。打印脚本读取上述实际下载稿，不重新生成事实或引用。另提供单页正文：[Q-47](../../output/pdf/case-1-counsel-brief-one-page.pdf)、[V-92](../../output/pdf/case-2-counsel-brief-one-page.pdf)、[N-18](../../output/pdf/case-3-counsel-brief-one-page.pdf)。

## 验证证据

|验证|结果与证据|
|---|---|
|全套单元／集成|[550通过、2原有条件跳过](verification/tests-final.log)，39文件；跳过的是缺少既往真实provider样本的离线解析测试，不算真实AI通过|
|类型与生产构建|[typecheck通过](verification/typecheck-final.log)；[生产构建通过](verification/build-final.log)|
|真实浏览器|8项不同流程通过：三陌生手动案＋跨案比较＋四条旧法律／快照回归；[综合报告](ui-evidence/browser-results-full-regression.json)，[最终新流程再跑报告](ui-evidence/browser-results.json)|
|下载与移动端|9份三案真实下载＋比较表，逐份读回核对；390px无横向溢出；[下载检查](ui-evidence/download-checks.json)|
|输入变体|实际执行国家、子法域、刑民程序、上诉阶段、已有律师及具体披露变体；[输入与观察到的差异](verification/variation-checks.json)|
|引用／历史反例|错误四元组、修改命题、另案归属、研究报告冒充底层源、submitted状态、旧快照、用户编辑合并、平台／提示注入、AI失败降级均有测试；mock provider测试明确只属单元证据|
|真实AI|**blocked**：本地无OPENAI_API_KEY，未确认付费测试预算；真实AI请求0、增量AI费用0；[真实调用状态](verification/real-ai-status.json)|
|人工评价|**未执行／待目标用户或当地律师反馈**。未对外发送评审请求；不能称“律师审核通过”或全体验收完成|

本地测试使用现有Node v25.9.0，未更改系统运行时；仓库原engines仍为24.x。运行中发现并修复了手动叙述遗漏、unknown条件被升级、诽谤场景误套、内部授权与外发混淆、旧submitted细分丢失、最终引用检查不足及展开长来源的小屏溢出；早期失败未隐藏，最终日志为修正后的执行。

## 仍有的覆盖与专业复核缺口

- 条约国家／领土状态表只有本轮核对的8个目标法域；事件时生效、保留／克减、国内援引效果与个案受理仍需分别核对，未知不默认为成立。
- 精细当地法限KZ刑事程序、TN表达追诉、EAW民事诽谤。TN真实起诉法及当前版本、各案正式文书和实际程序需当地律师核对；未覆盖地区仍提供内部资料工作。
- 机制最新表格／全部后续规则未穷尽；候选内部研究不能视为可直接递交。历史参与机构未因此升级为当前可接案候选。
- ICCPR17／2(3)／7／10等进一步解释和更丰富法域属于后续增强，本轮不据未经核查的新命题生成结论。
- 真实AI与目标用户评价仍是独立验收缺口；当前可用本案规则材料，不以规则、demo或mock冒充这两项通过。
