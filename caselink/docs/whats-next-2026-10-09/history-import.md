# 历史增量导入与核查记录

执行日期：2026-10-09（America/New_York）。本记录由 agent 编写，未获团队人工或当地律师复核。

## 实际导入

来源目录为用户提供的 `/Users/fenghao/Desktop/21个案件的后续/`。原始22个PDF（含总索引）和JSON按原字节独立保存在本目录的 `history-originals/`。PDF全文提取供核对，150条时间线的每条完整句子均与对应PDF实际页文本匹配，页码保存在导入映射；第04号的程序日期页另经渲染视觉核查。PDF与JSON是同一份研究的两种形式，未计为独立佐证。

21份后续报告映射至现有22个案件。第04号PECA共享法律背景在Asad Toor条目唯一存储，通过报告映射关联Bilal Ghauri；两人的2026新程序分别归属本人另案。不新增其余被提及人物的正式库案件。

| 结构 | 实际数量 | 含义 |
|---|---:|---|
| 后续报告 | 21 | 20案件更新、1法律专题 |
| PDF页数 | 154 | 含6页总索引 |
| 原输入混合时间线 | 150 | 裁判、行动、风险、出版、计划等，不是150次行动 |
| 逐报告来源记录 | 121 | 21原报告、100网页记录 |
| 独立网页URL | 96 | 不等于96个已核全文 |
| 本轮核查历史行动 | 8 | 7个独立底层URL；参照方法，不作效果排名 |
| 增量输出事件 | 155 | 150行加5条审核补充；3条审核行动直接丰富原输入行 |
| 人工审核通过 | 0 | agent核查不得升级 |

`data/followups/import-manifest.json` 保存逐报告映射、150个稳定importRowId、来源级原始URL与类型、精确PDF页、原研究日期、实际校验日期、SHA-256和旧事件合并ID。21个原始报告的SHA-256均与现有 `data/evidence/documents.json` 对应，不凭文件名猜测归属。Zolotova研究只写2019-07；既有2019-07-26截止保留。

## 可重复执行与保留

运行项目所用Python（需pypdf）执行 `scripts/import-followups.py`。默认从上述独立原件目录读取，覆盖生成同一增量JSON及manifest，绝不追加随机ID。`--check` 逐字节比较输出，不改文件。导入器不联网、不调用AI、不写原案/187引文/旧六案JSON。`data/followups/baseline-hashes.json` 冻结这些文件的SHA-256，发现改变即拒绝导入。

旧KZ/TN/MA三份JSON完整保留。包括Bribri律师用报告、Alnur联合催办与政府反馈、突尼斯UPR与非洲委员会材料。8个输入事件与旧事件相同，增量采用旧eventId，主集成按caseId+eventId合并来源，不能删除未被新研究提及的旧事件。5个补充审核事件中只有Alnur的2021 WGAD申请是旧后续JSON原来没有的独立事件；其余为给旧事件附新核查元数据。该2021申请早于2021-03原报告，明确为历史背景而非新后续。

## 分类规则与反例

所有150行有eventKind、scope、executionStatus、proceedingId、personIds、reportId、supportClaim、日期精度和unknowns。一般研究行的actors可为空，表示尚未逐项确认执行人；可进入匹配的8条行动均给出实际参与者、材料形式、当时后续/未知和可比差异。

- Alnur2026欺诈调查与原Article274追诉分开；WGAD意见、个人来文、国内落实分开。
- Radi I推文案与Radi II后案分开；2024赦免不自动清除推文案。
- Andreyeva另案叛国定罪与Chultsova原案服刑结束分开；各自释放日不共享。
- Zolotova的2025释放和Chekina的2026释放分别归属；2019 BeLTA罚金案不被后来12年刑覆盖。
- Malaysiakini公司被罚与Gan无罪分别标示；复审只归公司，排期不算裁判。
- Hajar2019特别程序提交、同月国内定罪/来函、10月赦免分别理解；未确认撤销定罪。概述称七项任务而时间线名单还含国内机构，不据此生成七个已确认国际程序。
- Piskin的2024观察员/2026作者身份属于职业活动，不是她获得无罪。
- Bwayo同名民事排期保留在研究缺口/来源清单；身份和关联未定，未创建个人行动或胜诉。
- Pichugin/Prokopyeva国际裁判赔偿金额不当成已付款；Prokopyeva另案行政上诉收件不当成胜诉。
- Dian的Section233修法及Quah诉讼仅作一般法律背景，不改变本人定罪。
- Bribri上诉及判决日期冲突保留月精度；9月听证和10月预定裁判仍为排期。

## 本轮实际底层核查（可进入方法比较）

每条短引文、定位和准确URL在 `data/followups/reviewed-actions.json`。核查结果是 `source_checked / agent_checked`，human字段为null。页面原文支持“发生过这项行动”，不证明因果效果、现时接案意愿或新案资格。

| 行动 | 打开的底层来源与定位 | 核查结果与限制 |
|---|---|---|
| Bribri辩护使用报告 | [CFJ Testimonials](https://cfj.org/testimonials/)，Myriam Bribri段 | 辩护团队在上诉听证使用报告；时间及终局结果未给。本人关于压力的评价未转为独立因果结论。 |
| Bribri辩方上诉 | [Amnesty 2022-09-28](https://www.amnesty.org/fr/latest/news/2022/09/tunisia-drop-bogus-charges-against-activist-myriam-bribri/)，Informations complémentaires | 律师已上诉，检方也上诉；与联合国来函的22/23日有冲突。不是上诉胜诉。 |
| Bribri公开声明 | 同上，开头声明 | Amnesty确实发表撤销定罪的呼吁；声明已实施，所要求撤罪未证实。只在公开授权路径比较。 |
| Utepova个人来文 | [CFJ 2022-04-27](https://cfj.org/news/journalist-convicted-under-unfair-anti-extremism-law-in-kazakhstan-should-have-conviction-overturned/)，正文第二段与末段 | TrialWatch/Debevoise已提交；4月27为公开确认日，真实递交日未知。请求补救不等于获准。 |
| Alnur WGAD申请 | [CFJ 2022-09-13](https://cfj.org/news/kazakhstan-should-comply-with-un-decision-and-quash-activists-conviction/)，Background首段 | Freedom Now/McKool Smith于2021-02-12提交；早于原报告，后来意见不等于国内执行。 |
| Alnur落实询问 | [联合函PDF](https://www.freedom-now.org/wp-content/uploads/Ilyashev-Letter-Final-Draft-signed.pdf)，第1页日期，第2–3页五项问题，第4页签名 | 本轮读取四页并视觉核查第2页；分项询问判刑、犯罪记录、赔偿、调查及改革。回函与执行结果未知。 |
| Hajar特别程序提交 | [MENA Rights Group](https://menarights.org/en/caseprofile/la-journaliste-marocaine-hajar-raissouni-poursuivie-en-violation-de-son-droit-la-vie)，首段与2019-09-12时间线 | 2019真实提交先于原报告；9月来函与10月赦免只作先后关系。不是HRC个人来文或WGAD实体意见。 |
| Radi II获释后询问 | [CPJ 2024-10-21](https://cpj.org/2024/10/moroccos-pardoned-journalists-face-smears-threats-after-prison/)，CPJ emailed段与Radi专属电话威胁段 | CPJ向两部询问且未收到答复；发信确切日期未知，文章日不是发信日。不得混用另外两记者遭遇。 |

另外打开了[AL TUN 2/2022](https://spcommreports.ohchr.org/TMResultsBase/DownLoadPublicCommunicationFile?gId=27078)四页，确认上诉日冲突及其为特别报告员来函而非判决；也打开HRW突尼斯UPR正文作旧材料保留检查。这些补充读取未自动提升同页所有命题。

## 尚未完成与来源状态

除上述实际核查的明确命题外，100条网页来源记录仍以 `research_reported / unreviewed` 保留。兼容旧契约的 `readStatus: search_only` 在此表示“只有上传清单提供的线索；本轮未开底层”，定位文字明确这一点，并不假称执行过搜索。对未读取来源不伪造摘录。研究报告的 `last_verified_event` 只保存在作者字段，不覆盖当前状态。

起初请求的Hajar错误路径返回工具不可访问；随后使用原manifest准确URL成功阅读全文，已解决该单点失败。未以错误路径失败判定正确来源不可用。Marie Colvin访谈新研究称已读，但本轮未重读，仍不提升；旧六案保留的blocked/search_only状态也未改变。

未全量核查96个URL，未取得多数法院签署文书、现时案卷、赦免个别文书或付款凭证；未完成团队人工/当地律师审查。一般未知不会阻挡内部材料整理。

## 验证证据

`npx vitest run tests/followup-incremental.test.ts`：12/12通过。覆盖计数/全映射/来源层级/基线哈希/PECA/另案和共被告/计划与实施/职业身份/日期冲突/赔付与执行/行动匹配限制。

独立集成复核发现并由主负责人修复两个问题：合并原记录时丢失已核实的submitted细分状态；最终历史引用检查原先只查ID/已读状态而没有再次要求底层来源及同案范围。新增4项回归使用普通手动输入的虚构哈萨克斯坦上诉案A-84，实际调用规则模式analyzeInput：最终结果和快照保留submitted，旧JSON及旧对象不变；正确原始来源通过；替换为已读上传研究段落被拒绝；改为同人另案也被拒绝。未进行模型调用。

导入完成后重新执行 `scripts/import-followups.py --check` 逐字节一致。未修改旧三份JSON、原22案、187条引文或原报告元数据。未调用AI、未提交git、未部署或发送任何对外材料；由主负责人集成并统一提交。
