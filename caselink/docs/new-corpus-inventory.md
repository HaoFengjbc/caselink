# 新增来源资料盘点

核查与正式入库日期：2026-10-08。当前运行时语料版本为 `2026-10-08.v2`，已将本轮 18 份新增文档中的选定案例与证据正式入库。此文件同时保留最初的来源盘点及问卷验收设计；选定证据核对不代表全部页面精读或独立事实调查。

## 规模与范围

| 目录 | PDF | 来源清单 |
|---|---:|---:|
| CFJ_Criminalizing_Reporting | 15 | 1 个 sources.json |
| CFJ_Online_Speech | 5 | 1 个 sources.json |
| Citizen Journalism | 4 | 无独立清单 |

合计 26 个文件：24 个 PDF、2 个 JSON。按 SHA-256 去重后为 **21 份独立文档、804 个物理 PDF 页**，涉及 14 个国家或地区，报告日期从 2019-07 至 2026-01。其中 3 份与首批正式库完全相同，剩余 **18 份新增文档**现已整理为 **19 条新增案件记录**。当前正式库合计 **21 份独立来源、22 条案件记录、14 个地区、187 条引文**。来源包括 20 份 CFJ PDF 和 1 份 ABA 网页打印件；文件数、文档数和案件记录数不能互换。Pakistan 专题提取两条具体案件记录、共享一份来源；Omar Radi 两份报告分别记录同一人的不同程序。

全部 21 份均有可提取文字层，本次未发现需要整本 OCR 的纯扫描 PDF。机械检查按每页非空白文字量定位低文字页，不能证明逐页排版或语义无误。最初盘点已对四个验收样例的引用页、两份日期有疑义的封面及泰国报告两张低文字页做视觉复核；正式入库又对选定证据及相关上下文进行核对，并保留各批次审阅记录。泰国 PDF 第 18、23 页分别是短段落与附件目录，字少不是提取失败。

提取器在 Shahidul Alam 文档记录 1 个无效对象指针警告，在 Svetlana Prokopyeva 文档记录 4 个；没有阻止提取。警告按文件写入 `catalog.json.parserWarnings`，这些警告未被当作语义核验通过的依据；正式引文另行对照所在页与必要上下文。

## 来源验证

两个 `sources.json` 仅作为待核实的 URL 候选，不因文件中写了官方地址就认定可信。20 份 CFJ PDF 均重新从 `https://cfj.org/` 读取到内存，SHA-256 与用户本地文件完全一致；校验记录含 URL、最终 URL、UTC 时间、大小与远程哈希。未上传任何本地报告。

Dian Abdullah 是 ABA 官方网页的浏览器打印件：已打开官方网页，核对标题、2021-03-24 发布日期、执行摘要和程序经过；没有声称找到可做字节对照的官方 PDF。其页眉的 2026/10/8 10:21 是打印时间，1/25 等页码只属于这个本地打印件，不是 ABA 出版物的固定页码。

以下日期取 PDF 第 1 页封面或网页标题日期，不取上传目录、文件名或下载日期。`可提取`仅说明文字层存在。

## 去重后的文档目录

| 报告标题与核实来源 | 地区 | 报告日期 | 页数 | 可读性 | 本轮处理 |
|---|---|---|---:|---|---|
| [Bangladesh v. Shahidul Alam](https://cfj.org/wp-content/uploads/2023/07/Shahidul-Alam-Fairness-Report_January-2023.pdf) | 孟加拉国 | 2023-01 | 27 | 可提取 | 已正式入库（选定证据） |
| [Belarus v. Katsiaryna Andreyeva and Daria Chultsova](https://cfj.org/wp-content/uploads/2023/07/belarus-journalists.pdf) | 白俄罗斯 | 2021-10 | 71 | 可提取 | 已正式入库（选定证据） |
| [Georgia v. Mzia Amaglobeli](https://cfj.org/wp-content/uploads/2026/01/2025.01-Fairness-Report_Georgia-Mzia-Amaglobeli.pdf) | 格鲁吉亚 | 2026-01 | 85 | 可提取 | 已正式入库（选定证据） |
| [Guatemala v. José Rubén Zamora](https://cfj.org/wp-content/uploads/2024/02/guatemala-v-zamora-report.pdf) | 危地马拉 | 2024-02 | 95 | 可提取 | 已正式入库（选定证据） |
| [Hong Kong Special Administrative Region v. Bao Choy Yuk-ling](https://cfj.org/wp-content/uploads/2023/07/Bao-Choy_July-2021_Fairness-Report-1.pdf) | 中国香港特别行政区 | 2021-07 | 34 | 可提取 | 已正式入库（选定证据） |
| [Kazakhstan v. Aigul Utepova](https://cfj.org/wp-content/uploads/2023/07/EN-Aigul-Utepova-Fairness-Report-April-2022.pdf) | 哈萨克斯坦 | 2022-04 | 64 | 可提取 | 首批已入库，重复文件不新增来源 |
| [Malaysia v. Malaysiakini and Steven Gan](https://cfj.org/wp-content/uploads/2023/07/Malaysiakini-and-Steven-Gan_October-2021_Malaysia_Fairness-Report.pdf) | 马来西亚 | 2021-10 | 42 | 可提取 | 已正式入库（选定证据） |
| [Monitoring of the Trial of Marina Zolotova (Belarus)](https://cfj.org/wp-content/uploads/2023/07/fair-trial-report-belarus-marina-zolotova.pdf) | 白俄罗斯 | 2019-07 | 17 | 可提取 | 已正式入库（选定证据） |
| [Morocco v. Hajar Raissouni et al.](https://cfj.org/wp-content/uploads/2023/07/Fairness-Report-on-the-Trail-of-Morocco-v.-Hajar-Raissouni.pdf) | 摩洛哥 | 2020-08 | 28 | 可提取 | 已正式入库（选定证据） |
| [Morocco v. Omar Radi II](https://cfj.org/wp-content/uploads/2023/07/Omar-Radi-Fairness-Report-July-2022.pdf) | 摩洛哥 | 2022-07 | 45 | 可提取 | 已正式入库（选定证据） |
| [Morocco v. Omar Radi](https://cfj.org/wp-content/uploads/2023/07/Fairness-Report-on-the-Trial-of-Omar-Radi-in-Morocco.pdf) | 摩洛哥 | 2020-09 | 24 | 可提取 | 已正式入库（选定证据） |
| [Russian Federation vs. Svetlana Prokopyeva](https://cfj.org/wp-content/uploads/2023/07/Svetlana-Prokopyeva-February-2021.pdf) | 俄罗斯 | 2021-01 | 33 | 可提取 | 已正式入库（选定证据） |
| [Section 20 of Pakistan’s Prevention of Electronic Crimes Act: Urgent Reforms Needed](https://cfj.org/wp-content/uploads/2023/10/Pakistan_PECA-Report_September-2023.pdf) | 巴基斯坦 | 2023-09 | 22 | 可提取 | 已入库 2 案，共享专题来源 |
| [Trial Monitoring of People v. Cansu Pişkin (Turkey 2019)](https://cfj.org/wp-content/uploads/2023/07/Turkey-Piskin-Fairness-Report.pdf) | 土耳其 | 2019-07 | 18 | 可提取 | 已正式入库（选定证据） |
| [Uganda v. Moses Bwayo](https://cfj.org/wp-content/uploads/2023/07/fair_trial_report_uganda_moses_bwayo.pdf) | 乌干达 | 2021-01 | 25 | 可提取 | 已正式入库（选定证据） |
| [Government of Thailand & Chaiwat Limlikhitaksorn v. Wuth Boonlert & Samak Donnapee](https://cfj.org/wp-content/uploads/2023/07/Fairness-Report-on-the-Trials-of-Wut-Boonlert-and-Samak-Donnapee-in-Thailand.pdf) | 泰国 | 2020-07 | 24 | 可提取 | 已正式入库（选定证据） |
| [Kazakhstan v. Alnur Ilyashev](https://cfj.org/wp-content/uploads/2023/07/fair-trial-report-kazakhstan-alnur-ilyashev.pdf) | 哈萨克斯坦 | 2021-03 | 46 | 可提取 | 已正式入库（选定证据） |
| [Russian Federation vs. Alexander Pichugin](https://cfj.org/wp-content/uploads/2023/06/ENG-Pichugin-Fairness-Report-April-2022.pdf) | 俄罗斯 | 2022-04 | 28 | 可提取 | 已正式入库（选定证据） |
| [Tunisia vs. Emna Chargui](https://cfj.org/wp-content/uploads/2023/07/Emna-Chargui_June-2021_Fairness-Report.pdf) | 突尼斯 | 2021-06 | 35 | 可提取 | 首批已入库，重复文件不新增来源 |
| [Malaysia: A Preliminary Report on Criminal Proceedings Against Blogger Dian Abdullah](https://www.americanbar.org/groups/human_rights/reports/malaysia--a-preliminary-report-on-criminal-proceedings-against-b/) | 马来西亚 | 2021-03-24 | 25 | 可提取 | 已正式入库（选定证据） |
| [Tunisia vs. Myriam Bribri](https://cfj.org/wp-content/uploads/2021/06/Myriam-Bribri_June-2021_Fairness-Report.pdf) | 突尼斯 | 2021-06 | 16 | 可提取 | 首批已入库，重复文件不新增来源 |

## 重复与容易混淆的边界

- Pakistan Section 20 专题报告在两个 CFJ 目录各有一份，字节相同。它讨论多份 FIR 和传唤，不能一份文件直接计一个被告或一个结果。
- Aigul Utepova 与 Emna Chargui 在 CFJ/Citizen Journalism 目录分别重复，且各自与正式库原文哈希一致。Myriam Bribri 虽在本次目录只出现一次，也与正式库相同。
- Omar Radi（2020-09）和 Omar Radi II（2022-07）是不同文档，后者 PDF 第 4 页明确引用前案。不能按人名丢弃第二份，也不能把同一人当作两个互不相关的人；正式记录已区分人物与程序，保留两个不同 caseId。
- Mzia Amaglobeli 官方文件名含 `2025.01`，但封面为 **January 2026**；本目录记录 2026-01，并保留文件名差异。
- Svetlana Prokopyeva 官方文件名含 `February-2021`，但封面为 **January 2021**；本目录记录 2021-01，并保留差异。
- Emna 原报告内部宣判日期冲突仍然存在；得到同一 PDF 的新副本不等于冲突已解决。
- 多主体材料要逐人/逐机构记录结果：Malaysiakini 与 Steven Gan 的结果不同；泰国材料中原帖作者与转发者身份不同；Bwayo 报告虽聚焦一人，但说明共同程序另有其他被告。
- 报告作者的合法性评价、TrialWatch 等级、撤诉呼吁和改革建议不是法院已经作出的事实认定或已实施介入。

## 首轮盘点的四个问卷验收情境（历史批次）

以下使用报告中的历史快照检查问卷能否如实表达复杂情境，不是把历史人物当作新的真实委托人。**目标、公开意愿、资源和模拟操作者身份均为测试假设**；未由材料支持的字段留为未知。完整机器可读定义见 `data/research/acceptance-scenarios.json`，不被应用引用。

### 1. 博主已交保、案件仍在审理

来源：[Malaysia: A Preliminary Report on Criminal Proceedings Against Blogger Dian Abdullah](https://www.americanbar.org/groups/human_rights/reports/malaysia--a-preliminary-report-on-criminal-proceedings-against-b/)，本地 PDF 第 1、10 页。2021-03-24报告时点；不是当前实时状态。

**报告直接记载**

- 报告称Dian Abdullah为博主，起诉与两篇博客有关。
- 报告记载出庭并缴纳保释金，审理已经开始；预计3月25日恢复审理。

**评价与未知**

- 作者认为起诉侵犯表达自由，并提出撤诉或无罪方向；该评价与建议不等于法院结果。
- 报告不能证明后来听证实际发生或最终裁判。
- 当前可用律师、合作组织、当事人愿望及公开同意未由已查页确认。

**字段映射与解释**

- 将已开始trial映射为问卷“审判中”属于产品字段映射；不能仅凭曾交保断言报告之后任何时点均未拘押。

**测试假设**

- primaryGoal：先核对下次庭审所需材料
- publicity：unknown
- currentSupport：unknown

**验收预期**

- 允许“审判中”与“目前未被拘押/拘押状态未知”独立表达；不可从被起诉自动勾选被拘押。
- 身份为博主，不自动归成记者；博客表达不同于职业新闻报道。
- 主要目标与公开同意来自测试者，不从报告作者要求撤诉反推当事人当前目标。
- 日期缺年份时要求结合明确报告时点确认，不生成今天的期限。

### 2. 调查采访引发程序、判后上诉未决

来源：[Hong Kong Special Administrative Region v. Bao Choy Yuk-ling](https://cfj.org/wp-content/uploads/2023/07/Bao-Choy_July-2021_Fairness-Report-1.pdf)，本地 PDF 第 3、4 页。2021-07报告时点；不声称今天仍在上诉。

**报告直接记载**

- 报告称Bao Choy为记者、RTHK自由纪录片制作人；查询车辆登记资料服务于调查。
- 报告记载虚假陈述指控、定罪罚款与已提出上诉；报告时上诉未决。

**评价与未知**

- 是否属于选择性起诉、是否侵害表达自由是报告作者分析，不直接变成已由法院认定事实。
- 报告时点后的上诉结果未在本次盘点补查。
- 当前拘押状态、资源、公开意愿不能从过去曾被捕推定。

**字段映射与解释**

- “上诉”字段依据报告明确的appeal pending；“采访调查/信息获取”是对原文活动的中文分类。

**测试假设**

- primaryGoal：核对改变原判所需材料
- publicity：consent
- currentSupport：unknown

**验收预期**

- 可以描述采访调查、信息获取活动，不把被指行为简化为发表有争议言论。
- 阶段选择上诉，不能因为历史曾被捕自动切回侦查或拘押。
- 支持结构化记录指控文本与用户否认/报告评价的不同来源。
- 尚未取得公开同意时不把公开倡导设为立即执行。

### 3. 拍摄纪录片被诉，从保释到撤案的阶段转换

来源：[Uganda v. Moses Bwayo](https://cfj.org/wp-content/uploads/2023/07/fair_trial_report_uganda_moses_bwayo.pdf)，本地 PDF 第 3、4 页。报告2021-01，程序时间线涉及2020年；两个历史时点分别验收。

**报告直接记载**

- 报告将Moses Bwayo称为记者和电影制作者，涉案活动是拍摄纪录片场景；非法集会是当局指控。
- 报告记载3月6日保释，8月10日在原拟开庭日因检方未提出证人而撤案。
- 该程序有九名被告，报告明确聚焦Bwayo。

**评价与未知**

- 关于表达、集会、拘押与律师权利被侵犯的判断属于报告作者评价。
- 撤案并不自动证明再无其他程序或所有安全风险消失。
- 不能从监测与撤案时间先后推出监测导致撤案。

**字段映射与解释**

- 3月/8月程序的2020年份结合PDF第3页2020年程序语境读取；引文自身只有月日。
- 撤案后的问卷阶段属于产品设计问题，不把dismissed机械映射为某个现有枚举。

**测试假设**

- phaseA：冻结在报告描述的2020-03-04羁押听证后，用户希望释放
- phaseB：冻结在2020-08-10撤案后，用户希望整理结案与后续风险
- publicity：private

**验收预期**

- 拘押状态与程序阶段分开；从phaseA切换phaseB必须重新确认当前目标。
- 已撤案不能强制映射为“判决后未上诉”或“审前”；如现契约不支持结案，应清楚记录缺口而不是编造阶段。
- 保释是中间程序变化，不能归为无罪或撤诉。
- 切换历史时点后旧分析必须过期，不继续推荐保释申请。

### 4. 平台第三方评论与机构、个人的不同结果

来源：[Malaysia v. Malaysiakini and Steven Gan](https://cfj.org/wp-content/uploads/2023/07/Malaysiakini-and-Steven-Gan_October-2021_Malaysia_Fairness-Report.pdf)，本地 PDF 第 3 页。2021-10报告时点；审理与裁判日期来自报告叙述。

**报告直接记载**

- 报告同时讨论新闻机构Malaysiakini及总编辑Steven Gan，争议来自订阅者评论。
- 报告记载2021-02-19媒体机构被判藐视法庭并罚款，Gan无罪。

**评价与未知**

- 作者要求推翻相关裁判属于报告建议；不能当成复核已经成功。
- 不能仅凭该段给组织套用个人身份、拘押或律师会见字段。
- 计划复核日期不证明复核实际举行或结果改变。

**字段映射与解释**

- “媒体机构/第三方平台责任”是对news outlet与subscriber comments的问卷分类，不把该分类当成法院实体法结论。

**测试假设**

- primaryGoal：先确认本轮讨论机构还是编辑个人及相应目标
- publicity：unknown
- currentSupport：unknown

**验收预期**

- 先明确主体，机构与个人不能共用一个最终结果或当前困难。
- 允许第三方评论/平台编辑责任的背景描述，不能写成编辑本人发表了评论。
- 如果问卷只支持个人，明确其范围并保留组织案件限制；不要静默映射为记者。
- 一份报告、两个不同结果，不能统计为两个独立成功案例或全案无罪。

## 本地产物与复现

- `data/research/inventory.json`：26 个源文件及21份文档的机械索引、完整哈希、原始路径、文字层统计、重复组。
- `data/research/catalog.json`：加上人工核对的报告标题、地区、封面日期、文档类型、注意事项和来源验证记录。
- `data/research/source-verification.json`：20份官方 PDF 与本地副本的字节一致性记录。
- `data/research/acceptance-scenarios.json`：4个研究用验收样例、7段短引文定位、事实/评价/未知/假设拆分。
- `data/research/extracted/<sha256>.pages.json` 与 `.txt`：本地完整提取文字，不是已验证引文库；该目录被本地 `.gitignore` 忽略。
- `data/research/rendered/`：页图 QA 中间件，同样被忽略，不是产品公开资源。
- `data/research/curated/*-group.json`：本轮三组人工整理的案件、选定引文、中英文解释及 reviewNotes，作为入库工作材料。
- `data/cases/cases.json`、`data/evidence/evidence.json`、`data/evidence/documents.json`、`data/i18n/en.json`：经审阅后合并的运行时记录；不包含报告全文或本地源文件路径。
- `data/evidence/ingestion.json`：`2026-10-08.v2` 入库收据，包含计数、哈希、来源与案件映射；共享来源不重复计数。

首轮盘点使用已具备 `pypdf` 的独立环境，执行以下历史流程。`write_inventory_doc.py` 生成的是初始盘点模板；正式入库后的本文件已人工更新，不应被该旧模板覆盖：

```bash
python3 data/research/extract_inventory.py
python3 data/research/verify_sources.py
python3 data/research/build_catalog.py
python3 data/research/build_acceptance_scenarios.py
python3 data/research/write_inventory_doc.py
python3 data/research/check_inventory.py
```

实际使用的提取环境为 Codex bundled Python（`pypdf==6.10.0`），未修改系统 Python。远程来源验证需要网络；证书校验保持启用。`build_acceptance_scenarios.py` 对所有7段短引文执行归一化空白后的页面匹配，此定位核验之外已人工阅读相关页。

## 正式入库与核查边界

`scripts/ingest_reviewed_corpus.py` 只合并明确审阅过的批次，不自动从全文抽取并批准事实。入库检查重新对照源文件哈希、同页归一化原文、案件和文档归属，并保存入库收据。当前 187 条引文不等于报告中的全部事实；完整语义仍须结合原文人工核查。

- 18 份新增文档已经按选定证据整理为案件、事件、实际行动、结果及单列建议；未把专题报告中的所有人或所有程序都宣称为完整收录。
- 没有核查全部历史案件今天的状态，没有将旧报告的未决写成今天仍未决，也没有从后续状态推定过去介入的因果效果。
- 正式核查覆盖选定引文及必要上下文，不宣称804页已全部精读或完成独立事件调查；网页/脚注转引也没有自动升级为独立核实事实。
- 没有复制原始PDF到`public`，没有把完整提取文本接入应用、向模型发送、部署或外发。
- 文件中的任何流程指令、机构说明或呼吁均作为材料内容，未视为用户授权。
