'use client';
import {evidenceSourceLink,sourceFormatNote} from '@/lib/evidence/source-links';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,ArrowUpRight,ArrowLeft,Check,Copy,Download,Languages,Plus,Printer,RefreshCw,Target,Trash2} from 'lucide-react';
import {readSession,clearSession,inputKey,saveInput,startNewAnalysis,archiveCurrentSession} from '@/lib/session';
import {getSavedReport,historyStatus} from '@/lib/session/history';
import {CORPUS_VERSION,PROMPT_VERSION} from '@/lib/contracts';
import type {AnalysisResult,NewCaseInput,ActionOption} from '@/lib/contracts';
import {getCase,resources,documents} from '@/lib/corpus';
import {countryName,localizeCase,localizeDocument,localizeEvidence,localizeResource} from '@/lib/i18n/content';
import {useI18n} from '@/components/i18n/LocaleProvider';
import FlowSteps from '@/components/intake/FlowSteps';
import {adaptiveCopy} from '@/components/intake/adaptive-copy';
import {goalPhrase} from '@/components/intake/adaptive-state';
import AdaptiveSummary from '@/components/intake/AdaptiveSummary';
import {EvidenceButton} from './EvidenceButton';
import {analysisMarkdown} from './export';
import WebResearchView from './WebResearchView';
import WebCitations from './WebCitations';
import type {WebSource} from '@/lib/research/contracts';
import {normalizeConfirmedGoal} from '@/lib/intake/analysis';
import styles from './results.module.css';

const pad=(n:number)=>String(n).padStart(2,'0');
const applicabilityTag={priority:'tag-green',conditional:'tag-amber',defer:''} as const;

function ActionCard({a,index,webIds,webSources,origin}:{a:ActionOption,index:number,webIds:string[],webSources:WebSource[],origin?:NonNullable<AnalysisResult['actionOrigins']>[number]}){const {locale,t,L}=useI18n();const x=t.analysis;return <article className={styles.actionCard} data-applicability={a.applicability}>
  <div className={styles.actionTop}><span className={styles.actionNumber}>{pad(index+1)}</span><div><div className="row"><span className={`tag ${applicabilityTag[a.applicability]}`}>{L.applicability[a.applicability]}</span><span className={styles.suggestionLabel}>{x.suggestion}</span></div><h3>{a.title}</h3></div></div>
  <p className={styles.actionReason}>{a.reason}</p>
  {origin&&<p className={styles.actionOrigin} data-origin={origin.origin}><span>{origin.origin==='ai'?t.analysis.tiers.ai:origin.origin==='preset'?(locale==='en'?'Preset example':'预置示例'):(locale==='en'?'Fixed-rule preparation':'规则生成的一般准备')}</span>{origin.reason&&<small>{origin.reason}</small>}</p>}
  <dl className={styles.actionQuick}><div><dt>{x.lead}</dt><dd>{a.leadRole}</dd></div><div><dt>{x.timing}</dt><dd>{a.timing}</dd></div></dl>
  <details className={styles.actionDetails} open={index===0}><summary>{x.details}<Plus size={18} className={styles.chevron}/></summary><div className={styles.actionDetailBody}>
    <div className={styles.actionConditions}><strong>{x.before}</strong><ul>{a.prerequisites.map((p,i)=><li key={i}><Check size={14}/>{p}</li>)}</ul></div>
    <h4>{x.how}</h4><ol className={styles.steps}>{a.steps.map((s,i)=><li key={i}><span>{pad(i+1)}</span><p>{s}</p></li>)}</ol>
    <div className={styles.twoCol}><div><h4>{x.materials}</h4><ul>{a.materials.map((s,i)=><li key={i}>{s}</li>)}</ul></div><div><h4>{x.follow}</h4><ul>{a.followUp.map((s,i)=><li key={i}>{s}</li>)}</ul></div></div>
    <h4>{x.collaborators}</h4><p>{a.collaborators.join(locale==='en'?'; ':'；')||x.collaboratorsNone}</p>
    {a.resourceIds.map(id=>{const raw=resources.find(r=>r.resourceId===id);if(!raw)return null;const r=localizeResource(raw,locale);return <div className={styles.resource} key={id}><a className="text-link" href={r.officialUrl} target="_blank" rel="noreferrer">{r.name}<ArrowUpRight size={14}/></a><p>{r.applicability}</p><small>{x.resourceChecked(r.checkedAt)}</small></div>})}
    <div className={styles.limitations}><strong>{x.limitations}</strong><ul>{[...a.differences,...a.uncertainties].map((s,i)=><li key={i}>{s}</li>)}</ul></div>
  </div></details>
  <div className={styles.actionEvidence}><span>{x.basis(L.basis[a.basisType])}</span>{(a.supportingEvidenceIds.length>0||!webIds.length)&&<EvidenceButton ids={a.supportingEvidenceIds}/>}</div>{webIds.length>0&&<div className={styles.actionWebEvidence}><WebCitations ids={webIds} sources={webSources}/></div>}
</article>}

export default function AnalysisView({reportId}:{reportId?:string}){const {locale,t,L}=useI18n();const x=t.analysis;const [state,setState]=useState<{input:NewCaseInput|null,result:AnalysisResult|null,stale:boolean}|null>(null);const [copied,setCopied]=useState(false);const [message,setMessage]=useState('');const [tab,setTab]=useState('actions');
 useEffect(()=>{archiveCurrentSession();if(reportId){const report=getSavedReport(reportId);setState(report?.kind==='analysis'?{input:report.input,result:report.result,stale:false}:{input:null,result:null,stale:false});return;}const s=readSession();setState({input:s.input,result:s.result,stale:!!s.result&&(!s.input||s.resultInputKey!==inputKey(s.input))})},[reportId]);
 useEffect(()=>{let collapsed:HTMLDetailsElement[]=[];const before=()=>{collapsed=Array.from(document.querySelectorAll<HTMLDetailsElement>('main details:not([open])'));collapsed.forEach(el=>{el.open=true})};const after=()=>{collapsed.forEach(el=>{el.open=false});collapsed=[]};window.addEventListener('beforeprint',before);window.addEventListener('afterprint',after);return()=>{window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after)}},[]);
 if(!state)return <main className="empty-state"><p>{x.loading}</p></main>;
 if(!state.input||!state.result)return <main className="empty-state"><span className="empty-icon"><Target size={30}/></span><span className="eyebrow">{x.emptyEyebrow}</span><h1>{x.emptyTitle}</h1><p className="muted">{x.emptyText}</p><Link href="/history" className="btn btn-primary">{locale==='en'?'My analyses':'查看历史分析'}<ArrowRight size={17}/></Link></main>;
 const {result}=state;const input=normalizeConfirmedGoal(state.input);
 if(state.stale)return <main className="empty-state"><span className="empty-icon"><RefreshCw size={28}/></span><h1>{x.staleTitle}</h1><p className="muted">{x.staleText}</p><Link href="/history" className="btn btn-primary">{locale==='en'?'View the saved report':'查看已保存的历史报告'}<ArrowRight size={16}/></Link><Link href={state.input.intake?'/new':'/review'} className="text-link">{x.staleCta}</Link></main>;
 const resultLocale=result.locale??'zh';
 const olderVersion=result.promptVersion!==PROMPT_VERSION||result.corpusVersion!==CORPUS_VERSION;
 const editSnapshot=()=>{if(reportId){startNewAnalysis();saveInput(structuredClone(state.input!));}};
 const storageWarning=historyStatus().pendingCount>0||historyStatus().storageIssue;
 const caseOf=(id:string)=>{const c=getCase(id);return c?localizeCase(c,locale):undefined;};
 const docOf=(id:string)=>{const d=documents.find(d=>d.documentId===id);return d?localizeDocument(d,locale):undefined;};
 const list=locale==='en'?', ':'、';
 const markdown=()=>analysisMarkdown(result,input,resultLocale);
 const copy=async()=>{try{await navigator.clipboard.writeText(markdown());setCopied(true);setTimeout(()=>setCopied(false),2500)}catch{setMessage(x.copyFailed)}};
 const download=()=>{const blob=new Blob([markdown()],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${resultLocale==='en'?'CaseLink-action-plan-':'CaseLink-行动参考-'}${result.createdAt.slice(0,10)}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 // Suggestions first, then reviewed library cases, then unverified web findings, then evidence and gaps.
 const tabs:[string,string,number,'ai'|'verified'|'web'|null][]=[['actions',x.tabs[0]!,result.actionOptions.length,'ai'],['comparison',x.tabs[1]!,result.comparableCases.length,'verified'],['web',x.tabs[2]!,result.webComparisons?.length??0,'web'],['gaps',x.tabs[3]!,result.missingInformation.length,null]];
 const counts:(number|string)[]=[result.actionOptions.length,result.comparableCases.length,result.webResearch?result.webComparisons?.length??0:'—',result.missingInformation.length];
 const editHref=input.intake?'/new':'/review';
 const outOfScope=input.intake?.expression==='no';
 const selectedGoal=input.primaryGoal==='other'&&input.intake?.goalText.trim()?goalPhrase(input.intake.goalText,locale):L.goals[input.primaryGoal];
 const jurisdictionNames=adaptiveCopy[locale].jurisdictions as Record<string,string>;
 const placeText=input.intake?[input.country==='unknown'?adaptiveCopy[locale].unknown:countryName(input.country,locale),input.intake.jurisdiction!=='unknown'?jurisdictionNames[input.intake.jurisdiction]??input.intake.jurisdiction:'',(adaptiveCopy[locale].kinds as Record<string,string>)[input.intake.caseKind]].filter(Boolean).join(' · '):'';
 const knownResources=input.resources.filter(resource=>resource!=='unknown');
 const supportText=input.intake?(knownResources.map(resource=>L.resources[resource]).join(list)||(locale==='en'?'See the original case record':'支持情况见原始记录')):(input.resources.map(resource=>L.resources[resource]).join(list)||x.notProvided);
 return <main data-top="dark" className={styles.analysisPage}>
  <section className={styles.hero}>
   <div className={`${styles.resultBreadcrumb} no-print`}><Link href={reportId?"/history":editHref}><ArrowLeft size={15}/>{reportId?(locale==='en'?'My analyses':'我的分析'):input.intake?x.backStatement:x.back}</Link>{input.intake?<FlowSteps current={3} steps={adaptiveCopy[locale].phases}/>:<FlowSteps current={2}/>}<div className={styles.exportButtons}><button onClick={copy}>{copied?<Check size={14}/>:<Copy size={14}/>}{copied?x.copied:x.copy}</button><button onClick={download}><Download size={14}/>{x.download}</button><button onClick={()=>window.print()} aria-label={x.print}><Printer size={15}/></button></div></div>
   <div className={`${styles.langNotice} no-print`}><span>{reportId?(locale==='en'?'Saved report · opening this report does not run AI again.':'历史报告 · 查看这份报告不会重新运行 AI。'):(locale==='en'?'This report is available in My analyses.':'本次结果可在「我的分析」中重新打开。')}</span><Link href="/history" className="text-link">{locale==='en'?'All analyses':'全部分析'}<ArrowRight size={14}/></Link></div>
   {storageWarning&&<p className="notice" role="alert">{locale==='en'?'Browser storage is unavailable or full. Download this report before closing or refreshing.':'浏览器存储不可用或空间不足，请在关闭或刷新前下载本报告。'}</p>}
   {olderVersion&&<p className="notice">{locale==='en'?'This report was generated with an earlier analysis or source version. The original result remains viewable; it has not been updated.':'这份报告使用较早的分析或资料版本生成，仍可查看当时的完整结果，内容尚未更新。'}</p>}
   {message&&<p role="status" className="notice">{message}</p>}
   {resultLocale!==locale&&<div className={`${styles.langNotice} no-print`}><Languages size={17}/><span>{t.analysis.langMismatch}</span><Link href={editHref} onClick={editSnapshot} className="text-link">{t.analysis.langRerun}<ArrowRight size={14}/></Link></div>}
   <div className={styles.heroCard}>
    <div className={styles.heroCardTop}><span className={styles.planLabel}>{x.label}</span><span>{x.generated(new Date(result.createdAt).toLocaleString(t.meta.dateLocale))}</span></div>
    <h1>{x.title}</h1>
    <p className={styles.heroStatement}>{input.intake&&input.primaryGoal!=='unknown'?x.heroGoal:input.intake?x.heroGoalUnknown:(locale==='en'?'Selected main goal: ':'已选定的主要目标：')}<Link onClick={editSnapshot} href={input.intake?"/new":"/new?step=4"} className={styles.fill}>{selectedGoal}</Link>{result.webResearch?result.webResearch.status==='completed'?t.web.hero(result.webComparisons?.length??0):t.web.heroUnavailable:t.web.heroNoSearch}</p>
    <div className={styles.heroMeta}><span className="tag tag-outline">{L.modes[result.mode]}</span>{input.isExample&&<span className="tag tag-accent">{x.exampleTag}</span>}{input.intake&&<span>{x.place}<b>{placeText}</b></span>}<span>{x.publicity}<b>{L.publicity[input.publicity]}</b><Link onClick={editSnapshot} className="no-print" href={input.intake ? "/new" : "/new?step=8"}>{x.editLimits}</Link></span>{!input.intake&&<span>{x.support}<b>{supportText}</b></span>}</div>
    <p className={styles.tierLegend}><span>{x.tiers.label}</span><i data-tier="verified">{x.tiers.verified}</i><i data-tier="web">{x.tiers.web}</i><i data-tier="ai">{x.tiers.ai}</i></p>
    {input.intake&&<details className={styles.recordDetails}><summary>{x.record}</summary><AdaptiveSummary input={input} locale={locale}/></details>}
    <dl className={styles.stats}>{counts.map((n,i)=><div key={i}><dt>{x.stats[i]}</dt><dd className="number">{n}</dd></div>)}</dl>
   </div>
  </section>
  <div className={styles.tabBar}><div className={styles.resultTabs} role="tablist" aria-label={x.tabsLabel}>{tabs.map(([id,label,n,tier])=><button key={id} id={`tab-${id}`} role="tab" aria-selected={tab===id} aria-controls={`panel-${id}`} onClick={()=>setTab(id)} className={tab===id?styles.activeTab:''}>{tier&&<i className={styles.tierDot} data-tier={tier} aria-hidden="true"/>}{label}<span>{n}</span></button>)}</div></div>
  <div className={styles.resultLayout}><div>
   <section id="panel-actions" role="tabpanel" aria-labelledby="tab-actions" className={`${styles.tabPanel} ${tab!=='actions'?styles.hiddenPanel:''}`}><div className={styles.sectionIntroduction}><h2>{x.actionsTitle}</h2><p>{x.actionsText}</p></div>{result.actionOptions.map((a,i)=><ActionCard key={a.actionId} a={a} index={i} webIds={(result.actionWebSources??[]).filter(ref=>ref.actionId===a.actionId).flatMap(ref=>ref.sourceIds)} webSources={result.webResearch?.sources??[]} origin={result.actionOrigins?.find(origin=>origin.actionId===a.actionId)}/>)}{!result.actionOptions.length&&<div className="panel"><h3>{x.noActionsTitle}</h3><p>{x.noActionsText}</p></div>}</section>
   <section id="panel-comparison" role="tabpanel" aria-labelledby="tab-comparison" className={`${styles.tabPanel} ${tab!=='comparison'?styles.hiddenPanel:''}`}><div className={styles.sectionIntroduction}><h2>{x.compareTitle}</h2><p>{x.compareText}</p></div>{outOfScope&&<p className={styles.scopeNotice}>{x.outOfScope}</p>}{result.comparableCases.map((m,ci)=>{const c=caseOf(m.caseId);if(!c)return null;return <article className={styles.comparisonCard} key={c.caseId}>
    <div className={styles.comparisonHead}><span className={styles.caseIndex}>{pad(ci+1)}</span><div><h3><Link href={`/cases/${c.caseId}`}>{c.title}<ArrowUpRight size={20}/></Link></h3><div className="row"><span className="tag">{countryName(c.country,locale)}</span>{c.personTypes.map(p=><span key={p} className="tag">{L.persons[p]}</span>)}<span className="tag tag-accent">{m.relevance==='comparable'?x.comparable:x.related}</span><span className={styles.tierTag} data-tier="verified">{x.tiers.verified}</span></div></div></div>
    <p className={styles.historicalSummary}>{c.summary}</p>
    <div className={styles.comparability}><div className={styles.similar}><strong>{x.similar}</strong><ul>{m.similarities.map((s,i)=><li key={i}>{s}</li>)}</ul></div><div className={styles.different}><strong>{x.different}</strong><ul>{m.differences.map((s,i)=><li key={i}>{s}</li>)}</ul></div></div>
    <EvidenceButton ids={m.evidenceIds}/>
    <div className={styles.historyTable}>{result.historicalComparisons.filter(h=>h.caseId===c.caseId).map(h=>{const a=c.interventions.find(a=>a.interventionId===h.interventionId);if(!a)return null;return <div key={a.interventionId} className={styles.historyRow}><div className={styles.historyWhen}><small>{a.date.value||x.dateUnknown}</small><p>{L.stages[a.stageAtAction]}</p><span className="tag">{L.categories[a.category]}</span></div><div><strong>{a.actor}</strong><p>{a.action}</p><div className={styles.historyOutcome}><span>{x.outcome}</span><p>{a.observedOutcomeIds.map(id=>c.outcomes.find(o=>o.outcomeId===id)?.description).filter(Boolean).join(locale==='en'?'; ':'；')||x.noOutcome}</p><small>{x.link[a.relationshipToOutcome]}</small></div><EvidenceButton ids={[...new Set([...a.evidenceIds,...a.observedOutcomeIds.flatMap(id=>c.outcomes.find(o=>o.outcomeId===id)?.evidenceIds||[])])]}/></div></div>})}</div>
    <p className={styles.historicalAsOf}>{c.statusSummary}</p>
   </article>})}{!result.comparableCases.length&&<div className="panel"><h3>{x.noMatchTitle}</h3><p>{x.noMatchText}</p><Link href="/cases" className="text-link">{x.browse}<ArrowRight size={15}/></Link></div>}</section>
   <section id="panel-web" role="tabpanel" aria-labelledby="tab-web" className={`${styles.tabPanel} ${tab!=='web'?styles.hiddenPanel:''}`}><WebResearchView research={result.webResearch} comparisons={result.webComparisons??[]} assessment={result.researchAssessment}/></section>
   <section id="panel-gaps" role="tabpanel" aria-labelledby="tab-gaps" className={`${styles.tabPanel} ${tab!=='gaps'?styles.hiddenPanel:''}`}><div className={styles.sectionIntroduction}><h2>{x.gapsTitle}</h2><p>{x.gapsText}</p></div>
    <div className={styles.gapGrid}><div className={styles.gapBlock}><h3>{x.missing}</h3><ol className={styles.gapList}>{result.missingInformation.map((s,i)=><li key={i}>{s}</li>)}</ol></div><div className={styles.gapBlock}><h3>{x.limits}</h3><ol className={styles.gapList}>{result.limitations.map((s,i)=><li key={i}>{s}</li>)}</ol></div></div>
    {result.comparableCases.flatMap(m=>caseOf(m.caseId)?.conflicts||[]).map((f,i)=><div className="notice" key={i} style={{marginTop:16}}><strong>{x.conflict}</strong><p>{f.description}</p><EvidenceButton ids={f.evidenceIds}/></div>)}
    <div className={styles.gapBlock} style={{marginTop:24}}><h3>{x.unrecorded}</h3>{result.comparableCases.map(m=>{const c=caseOf(m.caseId);return c?<div key={c.caseId} className={styles.unknownCase}><strong>{c.title}</strong><ul className={styles.gapList}>{c.unknowns.map((u,i)=><li key={i}>{u}</li>)}</ul></div>:null})}</div>
    <div className={styles.sourcesList}><h3>{x.sources}</h3>{result.sources.map((e,i)=><div key={e.evidenceId} className={styles.sourceRow}><span className={styles.sourceIndex}>{pad(i+1)}</span><div><strong>{caseOf(e.caseId)?.title}</strong><p>{localizeEvidence(e,locale).explanation}</p><small>{x.sourceLine(e.pdfPage,docOf(e.documentId)?.publishedDate??'')}</small></div><EvidenceButton ids={[e.evidenceId]} label={x.sourceButton}/></div>)}</div>
   </section>
  </div>
  <aside className={`${styles.resultAside} no-print`}>
   <div className={styles.nextStep}><span className="eyebrow">{x.asideEyebrow}</span><h3>{x.asideTitle}</h3><ul>{result.missingInformation.slice(0,3).map((s,i)=><li key={i}>{s}</li>)}</ul>{!result.missingInformation.length&&<p>{x.asideNone}</p>}<Link onClick={editSnapshot} href="/new" className="text-link">{x.asideEdit}<ArrowRight size={15}/></Link></div>
   <div className={styles.asideSourceNote}><strong>{x.noteTitle}</strong><p>{x.noteText}</p><Link href="/cases" className="text-link">{x.noteLink}<ArrowUpRight size={13}/></Link></div>
   {!reportId&&<button className={`${styles.clearButton} text-link`} onClick={()=>{if(window.confirm(x.clearConfirm)){clearSession();setState({input:null,result:null,stale:false})}}}><Trash2 size={13}/>{x.clear}</button>}
  </aside></div>
  <section className={styles.printSources}><h2>{x.printTitle}</h2>{result.sources.map(e=>{const d=docOf(e.documentId);return <article key={e.evidenceId}><h3>{caseOf(e.caseId)?.title} · {x.printPage(e.pdfPage)}</h3><blockquote>{e.exactQuote}</blockquote><p>{localizeEvidence(e,locale).explanation}</p><p>{x.printReport(d?.publishedDate??'',d?.factsAsOf??'',e.evidenceId)}</p><p>{x.printAuthor(d?.author??'',e.printedPage,d?.checkedAt??'',L.origins[e.origin])}</p><p>{sourceFormatNote(e,locale)}</p><a href={evidenceSourceLink(e)}>{x.printLink}</a></article>})}</section>
 </main>;
}
