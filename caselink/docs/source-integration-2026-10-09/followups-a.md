# 第二阶段历史后续核查：A

核查日期：2026-10-09（客户端日期）。文件范围仅 `data/followups/kazakhstan.json`、`morocco.json` 和本文。原案件、原报告、原 evidence 未改写。4 案构成哈萨克斯坦 2 案与摩洛哥 2 案；与 B 的突尼斯组集成。

## 交付与时间边界

| 案件 ID | 保留原事实截至 | 本次实质增补 | 不能据此声称 |
| --- | --- | --- | --- |
| aigul-utepova | 2022-04（月精度） | 同月 CFJ/TrialWatch + Debevoise 已提交个人来文的公开确认；2025 会期 TrialWatch 提交材料记载 4903/2023 pending | 4月27日是实际递交日、比原报告所有事实更晚、委员会已实体裁决、2025 pending 必然仍为今天状态 |
| alnur-ilyashev | 2021-03 | 2022 WGAD 意见、独立记录的补救建议、2022 联合催办函、2023 年报政府反馈、2025 另一 HRC 来文待登记 | WGAD 意见自动撤销国内定罪、已赔偿、政府否认侵权等于WGAD意见被推翻、HRC/WGAD是同一程序 |
| hajar-raissouni | 2020-08 | 2020-11 / 2021-03 持续污名报道风险；HRW 2022 调查及访谈出版 | 2019 赦免或2020-07离境是报告后新结果；叔父2024赦免属于本人案件 |
| omar-radi-ii-2022 | 2022-07 | 2023 撤销审驳回、IFJ声明、2024赦免释放、IFJ/SNPM声明、CPJ获释后跟进 | 与2020推文案混同；赦免必然消除定罪；把其他记者的刑期、攻击方式或结果套给Omar |

共 15 个事件、13 条来源记录（12 个独立 URL，2025 年提交分别支持两个案件）。12 条记录已读正文，1 条仅搜索索引、未支撑任何事件；全部没有真实团队人工审核记录。`implemented` 只说明某项行为发生，不等于达成有利结果，也包含法院驳回、风险事件等。单列的 WGAD 补救行动为 `recommended_only`。

## 正文读取与精确位置

- [CFJ Aigul 声明](https://cfj.org/news/journalist-convicted-under-unfair-anti-extremism-law-in-kazakhstan-should-have-conviction-overturned/)：2022-04-27，正文第2段确认参与者已向 HRC 挑战定罪，末段列所请求补救。是参与机构的已实施行动记录，不是委员会裁决；与原报告同月的精确先后没有据日期推断。
- [TrialWatch 2025 国家审议提交（OHCHR收录）](https://tbinternet.ohchr.org/_layouts/15/TreatyBodyExternal/DownloadDraft.aspx?key=%2FW1BdNOMQJqYFDxKkXnFg7rBZQX3gFf8jEXJQUmT2Dqbi1Yv8ZoyEzV9yKgDy6m4)：PDF第1页、脚注4。Aigul pending / Alnur awaiting registration；标题仅给2025年6–7月第144届会期，确切提交日未载，因此事件只有年精度、publishedAt=null。发布主体是NGO，官方托管不使其变为联合国决定。
- [WGAD Opinion No.2/2022](https://documents.un.org/api/symbol/access?l=en&s=A/HRC/WGAD/2022/2&t=pdf)：第16页100–108段，第17页记通过于2022-03-30，文件首页为2022-05-13分发。web几条官方入口失败后，普通curl从同一官方UN入口成功获取PDF，pypdf读取；未依靠搜索摘要。Freedom Now副本另作同文交叉检查。意见发布/转交已发生；国内补救仍是请求。
- [Freedom Now / CFJ 联合函](https://www.freedom-now.org/wp-content/uploads/Ilyashev-Letter-Final-Draft-signed.pdf)：第1页日期与收发主体，第2–3页5项实施问题，第4页署名。部分PDF字形抽取损坏；可读问题及署名足以支撑催办动作，[CFJ同日说明](https://cfj.org/news/kazakhstan-should-comply-with-un-decision-and-quash-activists-conviction/)交叉确认发送。声明说明Freedom Now担任国际律师、CFJ监测/报告及amicus，另说明2021-02-12 WGAD申请由Freedom Now与McKool Smith提交。该申请早于原报告，不计新的报告后行动。
- [WGAD 2023 年报 A/HRC/54/51](https://documents.un.org/api/symbol/access?l=en&s=A/HRC/54/51&t=pdf)：第6页2/2022行、脚注7。政府2022-06-08迟延答复；反馈否认侵权、称没有上诉/申请赔偿，原文明确归属政府。该“未上诉”表述与旧报告有表面冲突，未取得完整回复且可能指不同程序，不用它覆盖旧记录。
- [HRW 2022 调查](https://www.hrw.org/report/2022/07/28/theyll-get-you-no-matter-what/moroccos-playbook-crush-dissent)：第3节 Hajar Raissouni / Sentence and Pardon 末三段、脚注97–99，明确2020年11月与2021年3月持续风险。只保存发生攻击的事实及归属，不复制隐私侮辱用语，也不认可攻击文中的指控。
- [IFJ 2023 声明](https://www.ifj.org/media-centre/news/detail/article/maroc-le-pourvoi-en-cassation-de-deux-journalistes-a-ete-rejete)：2023-07-20发布，导语/首段明确撤销审于7月18日被驳回，Omar六年刑。记录来源级别：倡议者公开报告，未获取裁定原文。
- [IFJ 2024 声明](https://www.ifj.org/media-centre/news/detail/article/morocco-journalists-omar-radi-taoufik-bouachrine-and-soulaimane-raissouni-released-after-royal-pardon)：2024-07-30发布、7月29日释放；IFJ与SNPM声明在释放之后，不能倒置为促成释放。
- [CPJ 获释后采访](https://cpj.org/2024/10/moroccos-pardoned-journalists-face-smears-threats-after-prison/)：2024-10-21，赦免法律效果不清段、向两部发信未获回复段、Threatening phone calls中Radi专属段。采访对象对记者资质的说明保留归属，未冒充本轮核实的摩洛哥法律；CPJ明确区分Radi的跟踪/威胁与另两人的污名攻击。文章日期不当成采访或发信的确切日期。

## 未采用与隔离的线索

- CPJ Aigul人物档案的“尚未提交联合国”只截至2021-10；新增CFJ2022及2025材料已有不同阶段信息。近期抓取时间不是案情更新。
- Marie Colvin Journalists’ Network 的2022-11-02 Hajar采访仅搜索索引可见；web失败、普通curl返回404。护照更新/迁居线索保存为待核，`search_only / unreviewed`，没有用作确定事件。
- 欧洲议会2023-01-19 Omar决议多个官方语言及EUR-Lex入口停在验证页，虽索引有全文样式片段，也未记原文核实、未建立事件。
- PEN2025 Omar概述返回CPJ原采访进一步核对后发现个别叙述范围不一致，因此事件采用CPJ对Omar的专属说法，未扩大为所有记者同一遭遇。
- 同名人员、Alnur2026公投另案、他案引用Alnur的WGAD先例、旧报告2023上传目录、Hajar叔父案件均排除。
- 对2025个人来文后续、2024-10 Omar后续与Hajar2022之后新裁决，本次限定检索未获得可靠正文。未找到更新不等于没有变化。

## 可供 What’s Next 复用的实际行动

- `aigul-followup-2022-04-27-hrc-filing-confirmed`：参与者与材料/具体请求可供机制准备研究，不能省略新案自身资格与披露核对。
- `alnur-followup-2022-09-13-joint-letter`：五项实施问题可供准备内部执行核对表；不是要求自动对外发函。
- `hajar-followup-2022-07-28-hrw-report`：访谈、时间线、引用记录的工作形式，可作材料索引与持续风险档案参考。
- `omar-ii-followup-2024-10-21-cpj-risk-check`：把释放文件、刑事记录、工作限制及具体威胁分开核对。其采访归属与未获政府回应是模板应保留的限制。

Hajar的两条smear-report是风险事件，不用于推荐攻击行动。所有历史参与机构均只是曾参与该案，未核实当前接案意愿，不声称与新案件合作。

## 验证与最小待确认项

已运行共享 `CaseFollowupSchema` 对4案严格解析，并检查每条事件的sourceIds都在本案sources中。仅索引来源没有被事件引用。短引文每个独立来源累计不超过25个英文词；没有人工审核人/日期。UI、快照及整体测试由主负责人/C集成验证。

团队或当地律师最小补充：取得Aigul/Alnur个人来文最新登记与进展材料；Alnur国内补救及政府反馈所指程序；Hajar当前风险与原文受阻线索；Omar本人赦免文书、刑事记录、职业资格及最新风险。它们均不阻断已核实历史行动的材料准备，但阻断确定性结果或现行适用断言。
