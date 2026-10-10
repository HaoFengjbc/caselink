import React from 'react';
import type {ReportSnapshot,Resource} from '@/lib/contracts';
import {safeSourceUrl} from './comparison-data';
import styles from './research.module.css';
const reviewCopy={zh:{unreviewed:'待核实',agent_checked:'Agent 已检查来源 · 待团队复核',team_verified:'团队已人工复核',legacy_recorded:'保留原入库记录',conflict:'有冲突'},en:{unreviewed:'Unreviewed',agent_checked:'Agent source check · team review pending',team_verified:'Team reviewed',legacy_recorded:'Legacy review record',conflict:'Conflicting evidence'}};
const kinds={zh:{treaty:'条约条文',interpretation:'解释文件',un_mechanism:'联合国机制',regional_mechanism:'区域机制',assistance:'援助机构',general_resource:'一般资源',domestic_law:'国内法',procedure_rule:'当地程序规则'},en:{treaty:'Treaty provision',interpretation:'Interpretation',un_mechanism:'UN mechanism',regional_mechanism:'Regional mechanism',assistance:'Assistance organization',general_resource:'General resource',domestic_law:'Domestic law',procedure_rule:'Local procedural rule'}};
export function ResourceCard({resource:r,locale='zh'}:{resource:Resource;locale?:'zh'|'en'}){
 const en=locale==='en',url=safeSourceUrl(r.officialUrl);
 return <article className={styles.resource} id={`resource-${r.resourceId}`}>
  <span className={styles.badge}>{kinds[locale][r.type??'general_resource']}</span><span className={`${styles.badge} ${styles.pending}`}>{reviewCopy[locale][r.reviewStatus??'unreviewed']}</span>
  <h3>{r.name}</h3><p>{r.summary??r.applicability}</p>
  <dl><dt>{en?'Source ID':'来源 ID'}</dt><dd><code>{r.resourceId}</code></dd><dt>{en?'Official source':'官方来源'}</dt><dd>{url?<a href={url} target="_blank" rel="noreferrer">{url}</a>:en?'Invalid URL':'链接格式不可用'}</dd><dt>{en?'Locator':'条文 / 定位'}</dt><dd>{r.locator??(en?'Not recorded':'未记载')}</dd><dt>{en?'Applicability':'适用范围'}</dt><dd>{r.applicability}</dd><dt>{en?'Conditions':'资格 / 程序条件'}</dt><dd><ul>{(r.eligibility??[en?'Not recorded; check before use.':'未记载，使用前需核对。']).map(x=><li key={x}>{x}</li>)}</ul></dd><dt>{en?'Preparation':'材料准备'}</dt><dd><ul>{r.requiredMaterials.map(x=><li key={x}>{x}</li>)}</ul></dd><dt>{en?'Check dates':'核查日期'}</dt><dd>{en?'Original record':'条目日期'} {r.checkedAt} · Agent {r.agentCheckedAt??'—'} · {en?'Team':'团队'} {r.teamReviewedAt??(en?'Pending':'未人工复核')}</dd><dt>{en?'Open questions':'待确认'}</dt><dd><ul>{(r.unknowns??[]).map(x=><li key={x}>{x}</li>)}</ul></dd></dl>
  {r.sourceAudit&&<details><summary>{en?'Source reading and version audit':'查看原文复核与版本记录'}</summary><dl>
   <dt>{en?'Issuing body / version':'发布机构 / 版本'}</dt><dd>{r.sourceAudit.issuer} · {r.sourceAudit.version}</dd>
   <dt>{en?'Publication / effective information':'发布 / 生效信息'}</dt><dd>{r.sourceAudit.publishedOrEffective}</dd>
   <dt>{en?'Reading status':'正文读取状态'}</dt><dd>{r.sourceAudit.readStatus} · {r.sourceAudit.checkedAt} · <a href={safeSourceUrl(r.sourceAudit.readUrl)??undefined} target="_blank" rel="noreferrer">{en?'Read source':'实际读取入口'}</a></dd>
   <dt>{en?'Current / event-time version':'当前 / 事件时版本'}</dt><dd>{r.sourceAudit.currentVersionStatus}<br/>{r.sourceAudit.eventVersionStatus}</dd>
   <dt>{en?'Jurisdiction / proceeding':'法域 / 程序'}</dt><dd>{r.sourceAudit.jurisdiction.join(' · ')} / {r.sourceAudit.proceedings.join(' · ')}</dd>
  </dl>{r.sourceAudit.provisions.map(p=><section key={p.provisionId}><strong>{p.locator}</strong><blockquote>{p.quote}</blockquote><p>{p.explanation}</p><small>{en?'Supports':'支持判断'}: {p.supports.join(', ')}</small></section>)}<h4>{en?'Confirmed / corrected':'确认 / 修改'}</h4><ul>{[...r.sourceAudit.confirmed,...r.sourceAudit.corrections].map((item,i)=><li key={i}>{item}</li>)}</ul><h4>{en?'Remaining gaps':'仍缺什么'}</h4><ul>{r.sourceAudit.gaps.map((item,i)=><li key={i}>{item}</li>)}</ul></details>}
 </article>;
}
/** All content comes from the passed generation-time snapshot, including resource metadata. */
export function EvidenceLayers({snapshot}:{snapshot:ReportSnapshot}){
 const en=snapshot.locale==='en';
 return <section className={styles.panel} aria-label={en?'Three evidence layers':'三层依据'}>
  <h2>{en?'Three evidence layers':'三层依据与审核状态'}</h2>
  <div className={styles.layerGrid}>
   <article><span className={styles.badge}>01</span><h3>{en?'Curated case corpus':'正式案例库与原文证据'}</h3><p>{en?`${snapshot.cases.length} cases · ${snapshot.evidence.length} excerpts`:`${snapshot.cases.length} 案 · ${snapshot.evidence.length} 条引文`}</p><p className={styles.note}>{en?'Legacy excerpt-review records are preserved. They do not establish independent verification of underlying events or later developments.':'保留原入库引文审核记录，不等于对原案事实或最新进展作独立核实。'}</p></article>
   <article><span className={styles.badge}>02</span><h3>{en?'Standards, local rules and resources':'标准、当地规则与资源'}</h3><p>{snapshot.resources.length} {en?'resources in this snapshot':'条快照资源'}</p><p className={styles.note}>{en?'Check eligibility and local legal effect. Source checks and team review are shown separately; a listing does not promise acceptance.':'适用条件与当地法律地位须核对。来源检查和团队复核分开标记；列入资源不代表必然接案。'}</p></article>
   <article><span className={`${styles.badge} ${styles.pending}`}>03 · {en?'Unverified':'待核实'}</span><h3>{en?'Public web supplements':'公开网页补充'}</h3><p>{snapshot.webResearch?.sources.length??0} {en?'web sources':'个网页来源'}</p><p className={styles.note}>{en?'Tool-returned links and opened pages require factual and applicability review. General preparation advice is a suggestion, not a historical fact or legal conclusion.':'工具返回链接或读取网页仍需核对事实与适用性。一般材料整理建议属于建议，不是历史事实或法律结论。'}</p></article>
  </div>
  {!!snapshot.followups?.length&&<p className={styles.note}>{en?`${snapshot.followups.length} separately curated historical follow-ups are saved in this report. Their source-reading status is shown on each timeline; they are distinct from this request’s unverified search snippets.`:`本报告另存 ${snapshot.followups.length} 案策展研究的 Agent 核查后续；每条时间线单列正文读取与审核状态，区别于本次自动搜索的待核片段。`}</p>}
  {snapshot.completeness==='legacy_partial'&&<p className={styles.message}>{en?'This legacy report lacks a complete historical snapshot. Missing content is not backfilled from the current corpus.':'这份旧报告缺少完整历史快照。缺失内容不会从当前案例库补填。'}</p>}
  {snapshot.resources.length>0&&<details><summary>{en?'Review resource conditions and source status':'查看资源适用条件与审核状态'}</summary>{snapshot.resources.map(r=><ResourceCard key={r.resourceId} resource={r} locale={snapshot.locale}/>)}</details>}
 </section>;
}
