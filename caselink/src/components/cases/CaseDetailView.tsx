'use client';
import Link from 'next/link';
import NewAnalysisButton from '@/components/intake/NewAnalysisButton';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {cases,getCase,documents,evidence} from '@/lib/corpus';
import {countryName,localizeCase,localizeDocument} from '@/lib/i18n/content';
import {useI18n} from '@/components/i18n/LocaleProvider';
import {EvidenceButton} from '@/components/results/EvidenceButton';
import styles from './cases.module.css';
const pad=(n:number)=>String(n).padStart(2,'0');
const SECTION_IDS=['timeline','actions','outcomes','recommendations'];
export default function CaseDetailView({caseId}:{caseId:string}){
 const {locale,t,L}=useI18n();const v=t.detail;const list=locale==='en'?', ':'、';
 const raw=getCase(caseId);if(!raw)return null;const c=localizeCase(raw,locale);
 const docs=documents.filter(d=>c.sourceDocumentIds.includes(d.documentId)).map(d=>localizeDocument(d,locale));const caseEvidence=evidence.filter(e=>e.caseId===c.caseId).length;
 const lower=(s:string)=>locale==='en'?s.charAt(0).toLowerCase()+s.slice(1):s;const space=locale==='en'?' ':'';
 return <main data-top="dark" className={styles.detailPage}>
  <section className={styles.detailHero}>
   <Link className={styles.backLink} href="/cases"><ArrowLeft size={14}/>{v.back}</Link>
   <div className={styles.detailCard}>
    <div className={styles.cardTop}><span className="number">{pad(cases.indexOf(raw)+1)}/{pad(cases.length)}</span><span className={styles.cardTags}>{c.personTypes.map(p=>L.persons[p]).join(' · ')} · {v.report(c.reportDate)}</span><span className={styles.archiveLabel}>{v.archive}</span></div>
    <h1>{c.title}</h1>
    <p className={styles.cardStatement}>{t.library.statement[0]}{space}<span>{countryName(c.country,locale)}</span>{t.library.statement[1]}{space}<span>{c.backgroundTags.map(tag=>lower(L.activities[tag])).join(list)}</span>{t.library.statement[2]}{space}<span>{c.problems.map(p=>lower(L.problems[p])).join(list)}</span>{t.library.statement[3]}</p>
    <p className={styles.detailSummary}>{c.summary}</p>
    <EvidenceButton ids={c.evidenceIds}/>
    <dl className={styles.cardStats}>{[c.events.length,c.interventions.length,c.outcomes.length,caseEvidence].map((n,k)=><div key={k}><dt>{v.stats[k]}</dt><dd className="number">{n}</dd></div>)}</dl>
   </div>
  </section>
  <div className={styles.detailBody}>
   <div className="notice">{c.statusSummary}</div>
   <nav className={styles.sectionNav} aria-label={v.nav}>{SECTION_IDS.map((id,i)=><a key={id} href={`#${id}`}><span>{pad(i+1)}</span>{v.sections[i]}</a>)}</nav>
   <div className={styles.detailGrid}><div>
    <section id="timeline" className={styles.detailSection}><span className="eyebrow">{v.timelineEyebrow}</span><h2>{v.timelineTitle}</h2><div className={styles.timeline}>{c.events.map(e=><article key={e.eventId}><div className={styles.timelineDate}>{e.date.value||v.dateUnknown}<span>{L.stages[e.stageAtEvent]}</span></div><div className={styles.timelineBody}><p>{e.description}</p><EvidenceButton ids={e.evidenceIds}/></div></article>)}</div></section>
    <section id="actions" className={styles.detailSection}><span className="eyebrow">{v.actionsEyebrow}</span><h2>{v.actionsTitle}</h2>{c.interventions.map((a,i)=><article className={styles.intervention} key={a.interventionId}><span className={styles.interventionIndex}>{pad(i+1)}</span><div><div className="row"><span className={`tag ${a.executionStatus==='implemented'?'tag-green':'tag-amber'}`}>{a.executionStatus==='implemented'?v.implemented:locale==='en'?'Completion not confirmed':'尚未确认完成'}</span><span className="tag">{L.categories[a.category]}</span></div><h3>{a.action}</h3><div className={styles.actionMeta}><span>{a.actor}</span><span>{L.stages[a.stageAtAction]}</span><span>{a.date.value||v.dateNotListed}</span></div><div className={styles.observedOutcome}><span>{v.outcome}</span>{a.observedOutcomeIds.length?a.observedOutcomeIds.map(oid=><p key={oid}>{c.outcomes.find(o=>o.outcomeId===oid)?.description}</p>):<p>{v.noOutcome}</p>}<small>{v.link[a.relationshipToOutcome]}</small></div><EvidenceButton ids={[...new Set([...a.evidenceIds,...a.observedOutcomeIds.flatMap(id=>c.outcomes.find(o=>o.outcomeId===id)?.evidenceIds||[])])]}/></div></article>)}</section>
    <section id="outcomes" className={styles.detailSection}><span className="eyebrow">{v.outcomesEyebrow}</span><h2>{v.outcomesTitle}</h2>{c.outcomes.map(o=><div className={styles.outcomeRow} key={o.outcomeId}><span className={`tag ${o.type==='specific'?'tag-green':o.type==='partial'?'tag-blue':o.type==='pending'?'tag-amber':''}`}>{L.outcomes[o.type]}</span><div><p>{o.description}</p><small className="muted">{v.asOf(o.statusAsOf)}</small><div><EvidenceButton ids={o.evidenceIds}/></div></div></div>)}<div className={styles.unknownPanel}><h3>{v.notProvided}</h3><ul>{c.unknowns.map(u=><li key={u}>{u}</li>)}</ul></div>{c.conflicts.map((f,i)=><div className="notice" style={{marginTop:16}} key={i}><strong>{v.conflict}</strong><p>{f.description}</p><EvidenceButton ids={f.evidenceIds} label={v.conflictButton}/></div>)}</section>
    <section id="recommendations" className={styles.detailSection}><span className="eyebrow">{v.recsEyebrow}</span><h2>{v.recsTitle}</h2><p className="muted">{v.recsText}</p>{!c.reportRecommendations.length&&<p className="muted">{locale==='en'?'No separately citable author action recommendation was entered in this review.':'本次核验未单列可独立引用的作者行动建议。'}</p>}{c.reportRecommendations.map(r=><article className={styles.recommendation} key={r.recommendationId}><span className="tag tag-accent">{v.recTag}</span><p>{r.description}</p><p className={styles.recommendationActor}>{v.recActor(r.actor)}</p><EvidenceButton ids={r.evidenceIds}/></article>)}</section>
   </div>
   <aside className={styles.detailAside}><div className={styles.sourceCard}><span className="eyebrow">{v.sourceEyebrow}</span>{docs.map(d=><div key={d.documentId}><h3>{d.title}</h3><p className="muted">{d.author}</p><dl className={styles.sourceDl}><dt>{v.sourceFields[0]}</dt><dd>{d.publishedDate}</dd><dt>{v.sourceFields[1]}</dt><dd>{v.pages(d.pageCount)}</dd><dt>{v.sourceFields[2]}</dt><dd>{d.checkedAt}</dd><dt>{v.sourceFields[3]}</dt><dd>{v.excerpts(caseEvidence)}</dd></dl><a href={d.sourceUrl} className="btn btn-primary" target="_blank" rel="noreferrer">{v.read}<ArrowUpRight size={15}/></a></div>)}</div><div className={styles.asideTip}><h3>{v.tipTitle}</h3><p>{v.tipText}</p><NewAnalysisButton className="text-link" >{v.tipLink}<ArrowUpRight size={14}/></NewAnalysisButton></div></aside>
   </div>
  </div>
 </main>;
}
