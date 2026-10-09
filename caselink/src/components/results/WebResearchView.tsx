import {ArrowUpRight,Globe2,Plus} from 'lucide-react';
import type {WebComparison,WebResearch} from '@/lib/research/contracts';
import type {AnalysisResult} from '@/lib/contracts';
import {useI18n} from '@/components/i18n/LocaleProvider';
import WebCitations from './WebCitations';
import {webSourceUrl,citationProvenance} from './web-sources';
import styles from './results.module.css';

export default function WebResearchView({research,comparisons,assessment}:{research?:WebResearch,comparisons:WebComparison[],assessment?:AnalysisResult['researchAssessment']}){
  const {t,locale}=useI18n();const w=t.web;
  return <>
    <div className={styles.sectionIntroduction}><span className="eyebrow"><Globe2 size={14}/> {w.tab}</span><h2>{w.title}</h2><p>{w.intro}</p></div>
    {assessment&&<div className={styles.researchAssessment} data-research-assessment={assessment.status}><strong>{assessment.status==='relevant_cases_found'?(locale==='en'?'Relevant comparisons selected':'已选出相关案例比较'):assessment.status==='no_relevant_cases'?(locale==='en'?'No suitable comparison selected':'尚未找到合适的案例比较'):assessment.status==='search_unavailable'?(locale==='en'?'Research incomplete':'联网研究未完成'):(locale==='en'?'No web research':'未进行联网研究')}</strong><p>{assessment.note}</p>{assessment.attempts>1&&<small>{locale==='en'?'The first pass found no suitable comparison; one additional research pass was attempted.':'首轮未形成合适比较，已尝试一轮补充检索。'}</small>}</div>}
    {!research?<div className={styles.researchNotice}><p>{w.none}</p></div>:<>
      {research.plan&&<details className={styles.researchReport}><summary><div><strong>{locale==='en'?'How this case guided the search':'这次搜索围绕哪些案件要点'}</strong><span>{locale==='en'?'AI research abstraction; not established facts':'AI 整理的研究方向，不代表事实已经确认'}</span></div><Plus size={20} className={styles.chevron}/></summary><div className={styles.researchReportBody}><dl className={styles.researchMetadata}>{[
        [locale==='en'?'Relationship':'双方关系',[research.plan.relationship]],
        [locale==='en'?'Disputed conduct':'争议行为',research.plan.disputedConduct],
        [locale==='en'?'Alleged harm':'所述损害',research.plan.harms],
        [locale==='en'?'Requested change':'希望解决的问题',research.plan.remedies],
        [locale==='en'?'Evidence questions':'需要核对的证据问题',research.plan.evidenceIssues],
        [locale==='en'?'Uncertainties':'尚未明确',research.plan.uncertainties],
      ].map(([label,items])=><div key={label as string}><dt>{label}</dt><dd><ul>{(items as string[]).map((item,index)=><li key={index}>{item}</li>)}</ul></dd></div>)}</dl></div></details>}
      <div className={styles.researchStatus} data-status={research.status}><span className={`tag ${research.status==='completed'?'tag-green':'tag-amber'}`}>{w.status[research.status]}</span><span>{w.searchedAt} · <time dateTime={research.searchedAt}>{research.searchedAt}</time></span></div>
      {research.status!=='completed'&&<div className={styles.researchNotice}><p>{research.status==='no_results'?w.noResults:w.unavailable}</p>{research.failureReason&&<small>{w.reason}：{w.reasons[research.failureReason]}</small>}</div>}
      {comparisons.map((c,index)=><article className={`${styles.comparisonCard} ${styles.webComparison}`} key={`${c.title}-${index}`}>
        <div className={styles.webComparisonTop}><span className={styles.caseIndex}>{String(index+1).padStart(2,'0')}</span><span className="tag tag-accent">{w.pending}</span></div>
        <h3>{c.title}</h3><div className={styles.webComparisonMeta}><span>{c.jurisdiction||w.jurisdictionUnknown}</span><span>{c.statusAsOf?`${w.asOf} ${c.statusAsOf}`:w.dateUnknown}</span></div>
        <p className={styles.webProse}>{c.summary}</p><WebCitations ids={c.sourceIds} sources={research.sources}/>
        <div className={styles.comparability}><div className={styles.similar}><strong>{w.similar}</strong>{c.similarities.length?<ul>{c.similarities.map((text,i)=><li key={i}>{text}</li>)}</ul>:<p>{w.noSimilar}</p>}</div><div className={styles.different}><strong>{w.different}</strong><ul>{c.differences.map((text,i)=><li key={i}>{text}</li>)}</ul></div></div>
      </article>)}
      {!comparisons.length&&research.status==='completed'&&<div className={styles.researchNotice}><h3>{w.noComparisons}</h3><p>{w.noComparisonsText}</p></div>}
      <details className={styles.researchReport} open={comparisons.length===0}><summary><div><strong>{w.report}</strong><span>{w.reportHint}</span></div><Plus size={20} className={styles.chevron}/></summary>
        <div className={styles.researchReportBody}><dl className={styles.researchMetadata}><div><dt>{w.searchedAt}</dt><dd>{research.searchedAt}</dd></div><div><dt>{w.searchCalls}</dt><dd>{research.attempts?.reduce((sum,attempt)=>sum+attempt.searchCallCount,0)??research.searchCallCount}</dd></div><div><dt>{w.searchTerms}</dt><dd>{research.searchTerms.length?<ul>{research.searchTerms.map((term,index)=><li key={index}>{term}</li>)}</ul>:w.noTerms}</dd></div></dl>
          {!!research.actualQueries?.length&&<div><h3>{locale==='en'?'Queries returned by the search tool':'搜索工具返回的实际查询'}</h3><ul>{research.actualQueries.map((query,index)=><li key={index}>{query}</li>)}</ul><small>{locale==='en'?'The tool may not report every query.':'工具可能未返回全部查询。'}</small></div>}
          {research.attempts&&research.attempts.length>1&&<div><h3>{locale==='en'?'Research attempts':'检索轮次记录'}</h3>{research.attempts.map(attempt=><p key={attempt.attempt}>{locale==='en'?`Pass ${attempt.attempt}`:`第 ${attempt.attempt} 轮`} · {w.status[attempt.status]} · {attempt.searchCallCount} {locale==='en'?'search calls':'次搜索'}{attempt.failureReason?` · ${w.reasons[attempt.failureReason]}`:''}</p>)}</div>}
          {research.passages.map((passage,index)=><div className={styles.researchPassage} key={index}><p className={styles.webProse}>{passage.text}</p><WebCitations ids={passage.sourceIds} sources={research.sources}/></div>)}
          {!research.passages.length&&<p className="muted">{w.noPassages}</p>}
          <div className={styles.webSourceIndex}><h3>{w.sources}</h3><p>{w.sourceNote}</p>{research.sources.map(source=>{const href=webSourceUrl(source);return <article key={source.sourceId}><span>{source.sourceId}</span><div>{href?<a href={href} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={14}/></a>:<strong>{source.title}</strong>}<small>{source.hostname}</small>{source.citationKind&&<small>{citationProvenance(source,locale)}</small>}{!href&&<small>{w.missingSource}</small>}</div></article>})}</div>
        </div>
      </details>
    </>}
  </>;
}
