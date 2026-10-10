# 三个虚构场景的当地规则核查

核查日期：2026-10-09（用户时区日期）。范围为现有三个示例核心问题，不是全面国家法律库。沿用原输入，未改 PDF、录入或披露选择。6 个资源、10 个具体条款定位，见 `data/resources/local-rules.json`；场景映射见 `scenario-research.json`。

全部 `agent_checked`，`teamReviewedAt: null`，未填写人工审核人。`partial_text` 在这里表示已完整读所引条款，但未通读整部法典/宪法；不是只看摘要。来源类别与审核状态分开。中文为研究说明，原文适用由当地律师确认。

## 核查清单与覆盖

| 场景 / 核心问题 | 已读正式正文 | 支持的判断 | 覆盖结果与不能支持的结论 |
| --- | --- | --- | --- |
| 哈萨克斯坦记者：怎样取得拘押文书并研究正确审前复核？ | [Adilet 俄文刑诉法](https://old.adilet.zan.kz/rus/docs/K1400000231)第5、107、140、147、148条及相关脚注 | 文书载明理由并交付、审前法官决定的复核及时间起点、应研究更轻措施的理由 | **partial，有实质核查**。缺罪名、决定种类与宣告/送达日期，不能计算截止日、断言拘押违法、承诺释放或把预审路径套用审判阶段。 |
| 突尼斯博主：具体起诉依据是什么，怎样研究表达限制？ | [议会官方2022宪法扫描本](https://www.arp.tn/document/download/82535)第37条 PDF14–15/印刷12–13页，第55条 PDF18/印刷16页 | 表达保障与法律依据、必要性、目的和比例框架 | **partial，有实质核查**。起诉罪名及实体刑法当前/事件时版本未锁定；不假定54号法令，不输出处罚或具体撤诉程序。 |
| 英格兰和威尔士：收到诽谤函后怎样准备回应及候选抗辩？ | [Defamation Act 2013](https://www.legislation.gov.uk/ukpga/2013/26) ss1/4；[司法部诉前协议](https://www.justice.gov.uk/courts/procedure-rules/civil/protocol/prot_def) §§1.1–1.4、3.1–3.7 | 严重损害；公共利益抗辩条件；函件和回应所需信息 | **checked（核心来源检查）**，不表示事实满足抗辩。收件/发表日期与损害主张未知，不生成个案截止日。 |
| 同一英格兰和威尔士场景：是否存在有限反SLAPP路径？ | [ECCTA 2023 s195](https://www.legislation.gov.uk/ukpga/2023/56/section/195)、[CPR3.4](https://www.justice.gov.uk/courts/procedure-rules/civil/rules/part03-)、[SI2025/718 reg2](https://www.legislation.gov.uk/uksi/2025/718/pdfs/uksi_20250718_en.pdf) | 特定经济犯罪SLAPP定义及法院删除诉状条件 | 条款已核查，经济犯罪关联等要件未知；已知仅有律师函，当前不能说已有可删除诉状。公共采购报道不自动属于该定义。 |

## 版本、读取路径与修正

- **KZ**：新 Adilet 页面仅返回界面壳，改用同机构 `old.adilet.zan.kz`。Web 工具能发现全文，但后续定位报错；随后使用正常 TLS 的直接 GET 下载官方俄文 HTML 并读取具体条款和脚注。英文入口明示 unofficial translation，仅辅助比对。第107条列2025-07-16修订；第140条列2020-07-07修订及2026-06-10宪法法院注；第147条列2019-12-27修订。第5条要求按程序行为/决定时生效法研究，示例日期未知。没有把法典制定日当所有修订生效日。第107(2)条的三日从宣告起算，不从未来两周拟审查日推算。
- **TN**：议会“参考文本→宪法”真实链接指向扫描PDF。无可提取文本，使用已安装 PDF 依赖渲染并视觉核对相关完整页；另核对[总理府官方印本](https://pm.gov.tn/sites/default/files/2023-03/constitution-2022.pdf)入口。第37条不同于2014宪法第31条，不混用。PDF49–50页（印刷47–48）核对第141–142条及2022-08-17颁布信息；第142条把生效与公投最终结果公告连接，本次未独立核读选举机构该决定。不把官方页面仍提供旧文本当作全部2026配套法律未修订的证明。
- **TN覆盖缺口**：尝试官方 IORT 入口，正文读取失败；2026年近期修订的非官方线索仅用来提示需要查公报，不入库为修法已发生的事实。未新增 Decree54“已核查现行”资源，也未沿用2022罚则。议会2025-07-02[委员会听证记录](https://www.arp.tn/blog/1/post/54-2022-9112)只能证明当时讨论修法，不能证明最终制定结果。该缺口只影响具体罪名、处罚、溯及与对应程序，宪法研究仍可进行。
- **EAW**：legislation.gov.uk HTML 的部分 Web 请求报错，官方 `/section/1/data.xml`、`/section/4/data.xml`、`/section/195/data.xml` 均直接 GET 成功并读正文。原始 Act PDF 相关页交叉核对，当前版本结论取官方 revised XML，而非用 as-enacted PDF 假装当前合并法。2013法 ss1/4 的官方生效注记为2014-01-01。司法部现行诉前协议页标注2019-10-01更新，不把更新日写成所有条文生效日。
- **EAW有限SLAPP生效**：SI2025/718 reg2 明确 ss194/195 的未生效部分于2025-06-18生效；其解释注连接 CPR修订 SI2025/106 rr1(2)、4、9 同日生效。未使用汇总页“2025-04-06”概括该项生效。只研究已读特定机制，不声称英国全部反SLAPP立法已穷尽。

条约缔约状态、保留、国内地位、申诉资格属于国际资源独立审核，不由这些当地规则推定。

## 与结果接入的稳定标识

- KZ：`kz-criminal-procedure-detention` → `art140-2 / kz_detention_order_copy`、`art107-1-2 / kz_detention_review`、`art147-1-2 / kz_detention_alternatives`。
- TN：`tn-constitution-expression` → `art37 / tn_expression_guarantee`、`art55 / tn_expression_limit_test`。
- EAW：`ew-defamation-act-2013` → `s1 / ew_serious_harm`、`s4 / ew_public_interest_defence`；`ew-media-protocol` → `paras3-2-3-6-3-7 / ew_preaction_response`；`ew-economic-crime-slapp` → `s195 / ew_slapp_economic_crime_scope`；`ew-cpr-slapp-strikeout` → `rule3-4-2-d / ew_slapp_procedural_route`。

`sourceAudit.provisions[].explanation` 是服务器可引用的完整谨慎判断，`supports[]` 是允许的 claimKey；不要把同一条款主题相关解释成已满足其条件。原始事实仍来自虚构用户陈述；这里的法规 PDF 页码不是上传案情的页码。

## 最小当地律师确认问题

1. **KZ已有律师**：取得拘押决定及宣告/送达记录；确认是否仍审前调查、具体罪名与适用门槛，复核路径/时限及有无可申请恢复期限理由。带上现有索取文书记录、拘押理由及更轻措施材料，形成期限核对表与理由对照。
2. **TN已有律师**：带转发全文/语境、起诉/传唤文书和行为及程序日期，确认实际罪名、事件时与当前有效文本、修订或有利规则的影响，以及本程序中提出表达保障论点的方式。未取得这些前不拟具体刑期、撤诉或宪法程序结论。
3. **EAW尚无律师**：带完整函件和收件日、被指摘表述、报道依据与编辑核验记录，请媒体法律师判断严重损害和公共利益抗辩、回应内容与期限。仅在经济犯罪关联和其他要件有材料时另评估 s195；目前不把诉前函当法院诉状。先产出内部回应提纲，不对外发送。

全部问题服务于现有明确目标/披露选择，不重新追问已有律师、仅收到函件等已知事实；没有从职业推断公开同意。团队还需人工复核原文与中文说明，未发生的审核保持空值。

## 本分工验证

2026-10-09 使用项目 Vite loader 加载真实 `ResourceSchema`，6 条当地资源全部 parse 通过；3 个场景的所有资源 ID、具体法域和刑/民程序映射通过，10 条 provisions；人工审核日期计数为 0。此检查不替代主负责人的集成、浏览器和内容验收，也没有调用付费 AI。
