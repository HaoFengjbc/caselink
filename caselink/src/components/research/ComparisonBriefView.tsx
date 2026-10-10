import React from 'react';
import {FollowupTimeline} from '@/components/results/NextSteps';
import type {CaseRecord,ComparisonBrief,ReportSnapshot} from '@/lib/contracts';
import {labels} from '@/lib/i18n/en';
import {safeSourceUrl} from './comparison-data';
import {EvidenceLayers} from './EvidenceLayers';
import styles from './research.module.css';
/** Source locator, quote and metadata are all read from the immutable snapshot. */
export function SnapshotEvidence({ids,snapshot}:{ids:readonly string[];snapshot:ReportSnapshot}){
 const en=snapshot.locale==='en';const refs=[...new Set(ids)].map(id=>snapshot.evidence.find(e=>e.evidenceId===id));
 if(!refs.length)return <small className={styles.empty}>{en?'Evidence not recorded':'未记载对应证据'}</small>;
 return <details className={styles.sources}><summary>{en?'View original evidence':'查看原文证据'} ({refs.length})</summary>{refs.map((e,i)=>{
  if(!e)return <p className={styles.conflict} key={ids[i]}>{en?'Excerpt missing from snapshot':'快照中缺少引文'}: {ids[i]}</p>;
  const doc=snapshot.documents.find(d=>d.documentId===e.documentId);const base=safeSourceUrl(doc?.sourceUrl??e.sourceUrl);const url=base&&doc?.sourceFormat!=='web_print'?`${base.split('#')[0]}#page=${e.pdfPage}`:base;
  return <div key={e.evidenceId}><p><code>{e.evidenceId}</code> · {e.reviewStatus==='conflict'?<b className={styles.conflict}>{en?'Conflict retained':'保留冲突'}</b>:en?'Legacy review record':'原入库审核记录'} ({e.reviewStatus})</p><blockquote className={styles.quote}>{e.exactQuote}</blockquote><p>{e.explanation}</p><p>{doc?.title??e.documentId} · {doc?.sourceFormat==='web_print'?(en?'Archived print page':'存档打印页'):'PDF p.'} {e.pdfPage}{e.printedPage?` · ${en?'printed':'印刷页'} ${e.printedPage}`:''}</p>{url&&<a href={url} target="_blank" rel="noreferrer">{en?'Open original source':'打开原始来源'}</a>}{!doc&&<p className={styles.empty}>{en?'Document metadata missing':'文档元数据缺失'}</p>}</div>;
 })}</details>;
}
export function ComparisonBriefView({brief}:{brief:ComparisonBrief}){
 const {snapshot}=brief;const en=brief.locale==='en',L=labels[brief.locale];
 const notRecorded=en?'Not recorded':'未记载';
 const rows:Array<{title:string;cell:(c:CaseRecord)=>React.ReactNode}>=[
 {title:en?'Country / jurisdiction':'国家 / 具体法域',cell:c=><><p>{c.country}</p><p className={styles.empty}>{en?'Structured sub-jurisdiction: ':'结构化具体法域：'}{notRecorded}</p><SnapshotEvidence ids={c.evidenceIds} snapshot={snapshot}/></>},
 {title:en?'Expression activity':'表达活动',cell:c=><><p>{c.backgroundTags.map(x=>L.activities[x]).join(' · ')||notRecorded}</p><SnapshotEvidence ids={c.evidenceIds} snapshot={snapshot}/></>},
 {title:en?'Procedure':'程序类型 / 阶段',cell:c=><><p className={styles.empty}>{en?'Standardized procedure type: not recorded. Recorded stages below.':'标准化程序类型未记载；以下为已记载程序节点。'}</p>{c.events.map(e=><div key={e.eventId}><p><b>{L.stages[e.stageAtEvent]}</b> · {e.description}</p><SnapshotEvidence ids={e.evidenceIds} snapshot={snapshot}/></div>)}</>},
 {title:en?'Allegations / issues':'指控或争点',cell:c=><><p className={styles.note}>{en?'Recorded summary; a standardized charge field is not available.':'原入库摘要；尚无独立标准化罪名字段。'}</p><p>{c.summary||notRecorded}</p><SnapshotEvidence ids={c.evidenceIds} snapshot={snapshot}/></>},
 {title:en?'Procedural concerns':'程序问题',cell:c=><><p>{c.problems.map(x=>L.problems[x]).join(' · ')||notRecorded}</p><SnapshotEvidence ids={c.evidenceIds} snapshot={snapshot}/>{c.conflicts.map(x=><div key={x.description}><p className={styles.conflict}>{x.description}</p><SnapshotEvidence ids={x.evidenceIds} snapshot={snapshot}/></div>)}</>},
 {title:en?'Historical actions':'历史行动',cell:c=>c.interventions.length?c.interventions.map(a=><div key={a.interventionId}><p><b>{a.actor}</b> · {a.action}</p><p className={styles.note}>{en?'Recorded status':'实施记录'}: {a.executionStatus} · {a.date.value||a.date.originalText||notRecorded} · {en?'Outcome relationship':'与结果关系'}: {a.relationshipToOutcome}</p><SnapshotEvidence ids={a.evidenceIds} snapshot={snapshot}/></div>):notRecorded},
 {title:en?'Subsequent status':'后续状态',cell:c=><><p>{c.statusSummary}</p><p className={styles.note}>{en?'Known as of':'事实截至'} {c.lastKnownStatusAsOf}</p>{c.outcomes.map(o=><div key={o.outcomeId}><p>{o.description}</p><SnapshotEvidence ids={o.evidenceIds} snapshot={snapshot}/></div>)}</>},
 {title:en?'Follow-up actions, separate proceedings and later outcomes':'后续行动、另案与后来结果',cell:c=>snapshot.followups?.some(f=>f.caseId===c.caseId)?snapshot.followups.filter(f=>f.caseId===c.caseId).map(f=><FollowupTimeline key={f.caseId} followup={f} locale={brief.locale}/>):<p className={styles.empty}>{en?'No follow-up record in this snapshot. Current library updates are not backfilled.':'这份快照未保存后续记录，不使用当前库补写。'}</p>},
 {title:en?'Unknowns':'未知 / 缺失',cell:c=><ul>{c.unknowns.map(u=><li key={u}>{u}</li>)}</ul>}
 ];
 return <div className={styles.brief} id="comparison-brief"><section className={styles.panel}><span className={styles.eyebrow}>{en?'Internal handoff · public source snapshot':'内部交接 · 公开资料快照'}</span><h2>{brief.title}</h2><p>{brief.createdAt} · {snapshot.corpusVersion} · {brief.caseIds.length} {en?'selected records':'个所选案例'}</p><p className={styles.note}>{en?'No AI generation, web search, or live status update. Export this snapshot to preserve the comparison.':'没有调用 AI、联网搜索或更新最新案情。导出快照可保留本次比较内容。'}</p></section>
  <div className={styles.tableWrap} role="region" aria-label={en?'Side-by-side case comparison':'案件并排比较'} tabIndex={0}><table className={styles.table}><thead><tr><th>{en?'Comparison field':'比较字段'}</th>{snapshot.cases.map(c=><th key={c.caseId}>{c.title}<br/><small>{c.caseId}</small></th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.title}><th scope="row">{row.title}</th>{snapshot.cases.map(c=><td key={c.caseId}>{row.cell(c)}</td>)}</tr>)}</tbody></table></div>
  <section className={styles.panel}><h2>{en?'Shared themes, differences and unknowns':'共同问题、差异与未知项'}</h2>{brief.commonIssues.length?brief.commonIssues.map(i=><article key={i.label}><h3>{i.label}</h3><p>{en?'Supporting records':'支持案件'}: {i.supportingCaseIds.map(id=>snapshot.cases.find(c=>c.caseId===id)?.title??id).join(' · ')}</p><SnapshotEvidence ids={i.evidenceIds} snapshot={snapshot}/><details><summary>{en?'Differences and limits':'差异与限制'}</summary><ul>{i.differences.map(d=><li key={d}>{d}</li>)}</ul><ul>{i.unknowns.map(u=><li key={u}>{u}</li>)}</ul></details></article>):<p>{en?'No shared recorded problem labels. Do not infer a common legal issue.':'没有共同入库问题标签，不推断共同法律问题。'}</p>}</section>
  <section className={styles.panel}><h2>{en?'Preparation for internal handoff · suggestions':'内部交接准备 · 建议'}</h2><ul><li>{en?'Assign a reviewer to check the cited passages and factual differences.':'指定复核人核对所引段落与案件差异。'}</li><li>{en?'Keep unknown facts on a verification list; obtain instructions before external contact.':'把未知事实列入核对清单；对外联系前确认授权。'}</li><li>{en?'Record the local lawyer’s assessment of applicability separately from historical source facts.':'将当地律师的适用性判断与历史来源事实分开记录。'}</li></ul><p className={styles.note}>{en?'These workflow suggestions are not claims about historical outcomes and do not have artificial legal citations.':'这些材料整理建议不主张历史效果，也不强行附加不能支持它们的法律引文。'}</p></section>
  <EvidenceLayers snapshot={snapshot}/><section className={styles.panel}><h2>{en?'Limitations':'使用限制'}</h2><ul>{brief.limitations.map(x=><li key={x}>{x}</li>)}</ul></section>
 </div>;
}
