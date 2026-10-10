# What’s Next 法律与机制增量核查

核查日为用户时区 2026-10-09。全部仅为 `agent_checked`；无真实团队或当地律师审查，`teamReviewedAt`、`teamReviewer` 保持空值。来源类别、正文读取与人工审查是独立维度。本记录和程序不对外传送任何案件资料；官方检索仅使用法律名称和条号。

## 已实现与接线

- `src/lib/issue-legal-selection.ts` 输出 `[resourceId, provisionId, claimKey]`，沿用原引用与快照契约；不创建第二套法条库，不读取 `exampleId`。当地引用必须同时满足法域、程序和具体问题；KZ审前规则、EAW诉前回应在阶段改变后相应变化。平台事项先整理决定者、通知、规则及申诉材料，不把私人决定直接写成ICCPR违反，亦不自动列国际机制卡。
- `src/lib/mechanism-eligibility.ts` 输出互相独立的 HRC、普通特别程序、WGAD 条件卡；仅在 GB 或 RU 有已核范围时增加 ECtHR 资格研究。`state` 最多表示初步门槛，不是可受理结论，现有输入均有待确认项。
- `data/resources/whats-next-conditions.json` 是8个目标国家／地区的有限人工策展状态表。没有查过的国家保留 `unknown`；它不是全球条约数据库。历史、持续违反、领土适用和事件时版本需另核。
- 保留现有22条资源，增加5个具体定位，共38个条款／段落定位；补充法律效力、原文语言和中文说明状态。GC为解释文件，未标为国内法律。所有旧快照由主负责人冻结，不从当前数据回填。

## 正文核查与支持边界

|来源及读取结果|本轮核对的准确定位|支持的研究／材料|仍不能证明|
|---|---|---|---|
|[ICCPR及OP正式英文正文](https://treaties.un.org/doc/publication/unts/volume%20999/volume-999-i-14668-english.pdf)，官方PDF可读|ICCPR19(2)–(3)、9(1)–(4)、14(1)/(3)；OP1–5、9、12|分别整理表达限制、剥夺自由理由/告知/审查、刑事辩护、来文资格和时间资料|国内直接效力、具体违法结论、当地保释条件或个案期限|
|[GC34](https://documents.un.org/api/symbol/access?l=en&s=CCPR/C/GC/34&t=pdf)，所引段落及上下文已读|22（PDF6）；25（6–7）；33–35（8）；47（12）|公开可及和明确的规则、法定目的、必要性、比例、威胁与表达关联、诽谤抗辩与处罚的研究|第47段不使国内指控自动无效；时间先后不证明因果|
|[GC35](https://documents.un.org/api/symbol/access?l=en&s=CCPR/C/GC/35&t=pdf)，核心段落已读|38（PDF12）；39–40（12–13）；保留原4/12|候审拘押的个别理由与替代措施表；一般司法审查资料|第38段不可套用普通民事；39–40有已判固定刑期范围限制；不能推出当地期限|
|[GC32](https://documents.un.org/api/symbol/access?l=en&s=CCPR/C/GC/32&t=pdf)，31–34及刑民范围已读|31（PDF9）；32–34（10）|刑事辩护时间、材料接触、保密律师沟通；31用于核对刑事指控阶段范围|未知／混合程序不默认刑事；普通民事律师函不获得14(3)保障|
|[普通特别程序现行提交页](https://spsubmission.ohchr.org/)，正文可读|criteria、what happens、consent/confidentiality|独立任务范围与详细可靠资料；条约／用尽救济不是共同前提；政府姓名和公开姓名两项选择|回执不证明行动；不承诺全程私密或机构必接案；WGAD另核|
|[WGAD A/HRC/36/38](https://documents.un.org/api/symbol/access?l=en&s=A/HRC/36/38&t=pdf)，正文核心及上下文已读|8–12（PDF3–4）；15–20（4–5）；22–23（5）|实际剥夺自由、法律理由、国内及国际已行步骤、结果和更新；紧急事实与普通程序分开|紧急呼吁不是任意拘留意见，意见不是国内落实；当前表格／后续更新仍未完整核查|
|[UNTC ICCPR当前页](https://treaties.un.org/pages/ViewDetails.aspx?src=TREATY&mtdsg_no=IV-4&chapter=4&clang=_en)，页面状态2026-10-09|参与方表及香港脚注6|KZ/TN/GB/RU/BY参与；CN仅签署；MY未列；香港延续适用|国家参与不确认国内效果；本轮未穷尽所有国家、保留及克减|
|[UNTC OP当前页](https://treaties.un.org/Pages/ViewDetails.aspx?src=TREATY&mtdsg_no=IV-5&chapter=4&clang=_en)，全参与表与所引声明/脚注已读|KZ/TN/RU参与及KZ/RU时间声明；BY脚注6；GB/CN/MY无参加、HK无扩展|OP与ICCPR分离；BY退出2023-02-08生效、旧提交另核|旧案存在不能让新案受理；不能把早于退出的事件直接当今天仍可新提交|
|[ECtHR全院决议](https://www.echr.coe.int/documents/d/echr/resolution_echr_cessation_membership_russia_coe_eng)，2页已读|2022-03-22决议第1–2项，PDF2|俄罗斯停止欧洲公约缔约与此前事件余留管辖分别研究|不把ECtHR称ICCPR法院；未完成全部个案受理审查|

## 当地规则再次读取

直接HTTPS下载记录、字节数和SHA-256保存在同目录 `legal-retrieval-log.json`。部分网站的Web解析器报错；使用正常TLS直接GET取回官方正文，没有关闭TLS、没有依赖搜索摘要作结论。

1. **KZ刑事程序**：[官方俄文合并文本](https://old.adilet.zan.kz/rus/docs/K1400000231)第5、107、140、147条及注记已重读，第148条作上下文。第5条要求按程序行为/决定时法律；107条限审前调查、所示最后修订为2025-07-16；140条含2026-06-10宪法法院注记；147条需研究较轻措施。本轮保留谨慎原解释，不计算第107条期限。罪名、决定种类及宣告/送达时间未确认，研究表要由当地律师定位。
2. **TN表达追诉**：[议会官方2022宪法扫描](https://www.arp.tn/document/download/82535)已重新下载；用PDF技能渲染并视觉核对14–15/18页（印刷12–13/16，第37/55条）。中文只是研究说明。正式公报中真实起诉法律及其当前/事件时版本仍有缺口；不假定第54号法令，不新增未经核查的罚则或撤诉程序。旧交接对公报受阻的记录保留，本轮没有假称重验成功。
3. **EAW民事诽谤**：[Defamation Act s1](https://www.legislation.gov.uk/ukpga/2013/26/section/1/data.xml)、[s4](https://www.legislation.gov.uk/ukpga/2013/26/section/4/data.xml)官方现行XML及生效注记已读；[司法部诉前协议](https://www.justice.gov.uk/courts/procedure-rules/civil/protocol/prot_def)已打开。[ECCTA s195](https://www.legislation.gov.uk/ukpga/2023/56/section/195/data.xml)现行XML、[CPR3.4](https://www.justice.gov.uk/courts/procedure-rules/civil/rules/part03-)及[SI2025/718](https://www.legislation.gov.uk/uksi/2025/718/pdfs/uksi_20250718_en.pdf)reg2/解释注已读。仅经济犯罪定义下的有限SLAPP路径；公共采购主题不是满足条件的证据。s194/195未生效部分于2025-06-18生效，不能以别项CPR通用日期代替。仅律师函时不推进删除诉状步骤；苏格兰不继承EAW法。

## 日期与披露模型的保守界限

`keyDates` 是混合事件日期，尚无确定的“所诉违反日期”和“机制递交日期”字段，故程序不会只凭某个日期晚于OP生效就把时间资格标成立。KZ/TN等生效日期由官方交存日和条约规则得出，明示不等于个案期限。BY旧提交是否存续需记录真实提交日期另核。

现有输入保留 `publicity` 与 `disclosureDetails` 原文。明确“仅内部／仅指定律师／不向组织传送”会暂停机制提交授权。概括public、已有律师、生成草稿都不产生授权。政府接收姓名和公开报告姓名分别待核；不公开本身不关闭全部内部机制研究。没有新增自动邮件、API提交或默认持久化。

## 验证与剩余事项

本worker `npm run typecheck` 通过；`npm test -- tests/whats-next-legal.test.ts` 41/41通过。测试覆盖每个选择三元组真实存在并支持claim、无exampleId、KZ同国刑民变化、未知/混合程序、阶段变化、EAW子法域/具体问题、平台、覆盖外国家、GB/CN/HK/BY、特别程序/WGAD分立、细项披露和俄罗斯时间边界。与旧法律两组测试合跑时35通过/2旧断言失败：旧测试要求覆盖外／刑民改变后所有bindings为空，与本轮仍可提供条件国际研究的范围冲突。已报主负责人调整为不混用当地法或刑事专用保障，不能把此结果称全套通过。主负责人另执行全套整合、真实AI和浏览器下载，不以此单元测试替代。

需要专业确认的部分：各案事件时保留/克减与国内效力、TN具体指控当前有效法律、KZ决定及阶段、EAW个案要件及适用判例、各机制提交前的最新规则和授权风险。援助机构本轮没有新升级为“可联系候选”；原机构范围资料不能证明愿意接本案。扩展17/2(3)/7/10的解释尚未补齐，因此没有输出依赖它们的新法律命题。

## 手动录入增量回归

浏览器发现仅填写叙述时`currentProblems`可能仍为unknown。已将叙述、事实笔记和既有`materials.items.text`纳入保守的人身自由问题线索；未改上传/提取/存储。`libertyConcern`只决定9(1)/9(4)资料研究，`detentionExplicit`仅来自无获释/否定冲突的原结构化拘押选择；文件nature或文字不产生独立核实。刑事9(3)/GC35第38段还需要明确程序及阶段。WGAD线索显示unknown并要求核对当前状况。新增否定、曾经、已获释、尚未获释、未来风险、旧flag冲突及材料性质反例；最终类型检查和41项专项测试通过。
