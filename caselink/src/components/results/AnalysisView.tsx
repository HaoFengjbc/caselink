'use client';
import MaterialSnapshot from './MaterialSnapshot';
import WhatsNextWorkspace,{NextQuestions,OtherPaths} from './WhatsNextWorkspace';
import {evidenceSourceLink,sourceFormatNote} from '@/lib/evidence/source-links';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,ArrowUpRight,ArrowLeft,Check,Clock3,Copy,Download,Languages,Plus,Printer,RefreshCw,Target,Trash2,UserRound} from 'lucide-react';
import {readSession,clearSession,inputKey,saveInput,startNewAnalysis,saveCurrentReport,readPreferences} from '@/lib/session';
import {getSavedReport,historyStatus} from '@/lib/session/history';
import {CORPUS_VERSION,PROMPT_VERSION} from '@/lib/contracts';
import type {AnalysisResult,NewCaseInput,ActionOption} from '@/lib/contracts';
import {snapshotForResult} from '@/lib/reports/snapshot';
import {EvidenceLayers} from '@/components/research/EvidenceLayers';
import {ReportSnapshotProvider,useReportSnapshot} from './SnapshotContext';
import AnalysisSubmit from '@/components/intake/AnalysisSubmit';
import {countryName} from '@/lib/i18n/content';
import {useI18n} from '@/components/i18n/LocaleProvider';
import FlowSteps from '@/components/intake/FlowSteps';
import {adaptiveCopy} from '@/components/intake/adaptive-copy';
import {goalPhrase} from '@/components/intake/adaptive-state';
import AdaptiveSummary from '@/components/intake/AdaptiveSummary';
import {EvidenceButton} from './EvidenceButton';
import {analysisMarkdown} from './export';
import WebResearchView from './WebResearchView';
import {LegalResearchView,ActionLegalCitations} from './LegalResearch';
import {ActionNextSteps,FollowupTimeline} from './NextSteps';
import {workPackMarkdown} from './work-pack';
import WebCitations from './WebCitations';
import type {WebSource} from '@/lib/research/contracts';
import {normalizeConfirmedGoal} from '@/lib/intake/analysis';
import styles from './results.module.css';

const pad=(n:number)=>String(n).padStart(2,'0');
const applicabilityTag={priority:'tag-green',conditional:'tag-amber',defer:''} as const;

/** One action: what, why, who and when on the card; the full steps, history and provisions behind "details". */
function ActionCard({a,index,webIds,webSources,origin}:{a:ActionOption,index:number,webIds:string[],webSources:WebSource[],origin?:NonNullable<AnalysisResult['actionOrigins']>[number]}){const {locale,t,L}=useI18n();const x=t.analysis;const snapshot=useReportSnapshot();const prepare=a.materials.slice(0,3);
 const resources=a.resourceIds.filter(id=>!(a.legalCitations??[]).some(citation=>citation.resourceId===id));
 const limits=[...a.differences,...a.uncertainties];
 return <article className={styles.actionCard} data-applicability={a.applicability}>
  <div className={styles.actionTop}><span className={styles.actionNumber}>{pad(index+1)}</span><div>
   <h3>{a.title}</h3><p className={styles.actionReason}>{a.reason}</p>
   <p className={styles.actionMeta}><span><UserRound size={14} aria-hidden="true"/><span className="screen-reader">{x.lead}: </span>{a.leadRole}</span><span><Clock3 size={14} aria-hidden="true"/><span className="screen-reader">{x.timing}: </span>{a.timing}</span>{a.applicability!=='priority'&&<span className={`tag ${applicabilityTag[a.applicability]}`}>{L.applicability[a.applicability]}</span>}</p>
  </div></div>
  {prepare.length>0&&<div className={styles.actionPrep}><strong>{x.prepare}</strong><ul>{prepare.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}
  <div className={styles.actionEvidence}><span className={styles.basisTags}>{origin&&<i data-origin={origin.origin}>{origin.origin==='ai'?x.origin.ai:origin.origin==='preset'?x.origin.preset:x.origin.rule}</i>}<i>{L.basis[a.basisType]}</i>{!!a.legalCitations?.length&&<i>{x.provisions(a.legalCitations.length)}</i>}</span>{(a.supportingEvidenceIds.length>0||!webIds.length)&&<EvidenceButton ids={a.supportingEvidenceIds}/>}</div>
  {webIds.length>0&&<div className={styles.actionWebEvidence}><WebCitations ids={webIds} sources={webSources}/></div>}
  <details className={styles.actionDetails}><summary>{x.details}<Plus size={18} className={styles.chevron}/></summary><div className={styles.actionDetailBody}>
   {origin?.reason&&<p className={styles.originNote}>{origin.reason}</p>}
   {a.prerequisites.length>0&&<div className={styles.actionConditions}><strong>{x.before}</strong><ul>{a.prerequisites.map((p,i)=><li key={i}><Check size={14}/>{p}</li>)}</ul></div>}
   <h4>{x.how}</h4><ol className={styles.steps}>{a.steps.map((s,i)=><li key={i}><span>{pad(i+1)}</span><p>{s}</p></li>)}</ol>
   <div className={styles.twoCol}><div><h4>{x.materials}</h4><ul>{a.materials.map((s,i)=><li key={i}>{s}</li>)}</ul></div><div><h4>{x.follow}</h4><ul>{a.followUp.map((s,i)=><li key={i}>{s}</li>)}</ul></div></div>
   {a.collaborators.length>0&&<><h4>{x.collaborators}</h4><p>{a.collaborators.join(locale==='en'?'; ':'；')}</p></>}
   {resources.map(id=>{const r=snapshot?.resources.find(r=>r.resourceId===id);return r?<div className={styles.resource} key={id}><a className="text-link" href={r.officialUrl} target="_blank" rel="noreferrer">{r.name}<ArrowUpRight size={14}/></a><p>{r.applicability}</p><small>{x.resourceChecked(r.checkedAt)}</small></div>:null;})}
   <ActionNextSteps actionId={a.actionId}/><ActionLegalCitations action={a}/>
   {limits.length>0&&<div className={styles.limitations}><strong>{x.limitations}</strong><ul>{limits.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
  </div></details>
 </article>}

export default function AnalysisView({reportId}:{reportId?:string}){const {locale,t,L}=useI18n();const x=t.analysis;const [state,setState]=useState<{input:NewCaseInput|null,result:AnalysisResult|null,stale:boolean}|null>(null);const [copied,setCopied]=useState(false);const [message,setMessage]=useState('');const [tab,setTab]=useState('actions');const [saveDays,setSaveDays]=useState(7);const [supplement,setSupplement]=useState(false);
 useEffect(()=>{if(reportId){const report=getSavedReport(reportId);setState(report?.kind==='analysis'?{input:report.input,result:report.result,stale:false}:{input:null,result:null,stale:false});return;}const s=readSession();setState({input:s.input,result:s.result,stale:!!s.result&&(!s.input||s.resultInputKey!==inputKey(s.input))})},[reportId]);
 useEffect(()=>{if(reportId)return;const refresh=()=>{const current=readSession();setState({input:current.input,result:current.result,stale:!!current.result&&(!current.input||current.resultInputKey!==inputKey(current.input))});setSupplement(false);};window.addEventListener('caselink:session',refresh);return()=>window.removeEventListener('caselink:session',refresh);},[reportId]);
 useEffect(()=>{let collapsed:HTMLDetailsElement[]=[];const before=()=>{collapsed=Array.from(document.querySelectorAll<HTMLDetailsElement>('main details:not([open])'));collapsed.forEach(el=>{el.open=true})};const after=()=>{collapsed.forEach(el=>{el.open=false});collapsed=[]};window.addEventListener('beforeprint',before);window.addEventListener('afterprint',after);return()=>{window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after)}},[]);
 if(!state)return <main className="empty-state"><p>{x.loading}</p></main>;
 if(!state.input||!state.result)return <main className="empty-state"><span className="empty-icon"><Target size={30}/></span><span className="eyebrow">{x.emptyEyebrow}</span><h1>{x.emptyTitle}</h1><p className="muted">{x.emptyText}</p><Link href="/history" className="btn btn-primary">{locale==='en'?'My analyses':'查看历史分析'}<ArrowRight size={17}/></Link></main>;
 const {result:storedResult}=state;const snapshot=snapshotForResult(storedResult);const result={...storedResult,legalResearch:snapshot.legalResearch,followups:snapshot.followups,nextSteps:snapshot.nextSteps,webResearch:snapshot.webResearch,sources:storedResult.sources.map(e=>snapshot.evidence.find(item=>item.evidenceId===e.evidenceId)??e)};const input=normalizeConfirmedGoal(state.input);
 if(state.stale)return <main className="empty-state"><span className="empty-icon"><RefreshCw size={28}/></span><h1>{x.staleTitle}</h1><p className="muted">{x.staleText}</p><Link href="/history" className="btn btn-primary">{locale==='en'?'View the saved report':'查看已保存的历史报告'}<ArrowRight size={16}/></Link><Link href={state.input.intake?'/new':'/review'} className="text-link">{x.staleCta}</Link></main>;
 const resultLocale=result.locale??'zh';
 const olderVersion=result.promptVersion!==PROMPT_VERSION||result.corpusVersion!==CORPUS_VERSION;
 const editSnapshot=()=>{if(reportId){startNewAnalysis();saveInput(structuredClone(state.input!));}};
 const storageWarning=historyStatus().pendingCount>0||historyStatus().storageIssue;
 const caseOf=(id:string)=>snapshot.cases.find(c=>c.caseId===id);
 const docOf=(id:string)=>snapshot.documents.find(d=>d.documentId===id);
 const list=locale==='en'?', ':'、';
 const markdown=()=>analysisMarkdown(result,input,resultLocale);
 const copy=async()=>{try{await navigator.clipboard.writeText(markdown());setCopied(true);setTimeout(()=>setCopied(false),2500)}catch{setMessage(x.copyFailed)}};
 const download=()=>{const blob=new Blob([markdown()],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${resultLocale==='en'?'CaseLink-action-plan-':'CaseLink-行动参考-'}${result.createdAt.slice(0,10)}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const downloadWorkPack=()=>{const blob=new Blob([workPackMarkdown(result,input,resultLocale)],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`CaseLink-internal-working-pack-${result.createdAt.slice(0,10)}.md`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const webCount=result.webComparisons?.length??0;
 // Suggestions first, then reviewed library cases, then web findings (only when there are any), then evidence and gaps.
 const tabs:[string,string,number,'ai'|'verified'|'web'|null][]=[['actions',x.tabs[0]!,result.actionOptions.length,'ai'],['comparison',x.tabs[1]!,result.comparableCases.length,'verified'],...(webCount?[['web',x.tabs[2]!,webCount,'web'] as [string,string,number,'web']]:[]),['gaps',x.tabs[3]!,result.missingInformation.length,null]];
 const editHref=input.intake?'/new':'/review';
 const outOfScope=result.domain?.status==='out_of_scope'||input.intake?.expression==='no';
 const selectedGoal=input.primaryGoal==='other'&&input.intake?.goalText.trim()?goalPhrase(input.intake.goalText,locale):L.goals[input.primaryGoal];
 const jurisdictionNames=adaptiveCopy[locale].jurisdictions as Record<string,string>;
 const placeText=input.intake?[input.country==='unknown'?adaptiveCopy[locale].unknown:countryName(input.country,locale),result.jurisdiction?.jurisdictionCode&&result.jurisdiction.jurisdictionCode!=='unknown'&&result.jurisdiction.jurisdictionCode!=='national'?jurisdictionNames[result.jurisdiction.jurisdictionCode]??result.jurisdiction.legalSystem:'',(adaptiveCopy[locale].kinds as Record<string,string>)[input.intake.caseKind]].filter(Boolean).join(' · '):'';
 const knownResources=input.resources.filter(resource=>resource!=='unknown');
 const supportText=input.intake?(knownResources.map(resource=>L.resources[resource]).join(list)||(locale==='en'?'See the original case record':'支持情况见原始记录')):(input.resources.map(resource=>L.resources[resource]).join(list)||x.notProvided);
 const webChip=result.webResearch?(result.webResearch.status==='completed'&&webCount?x.webChip(webCount):t.web.status[result.webResearch.status]):'';
 return <ReportSnapshotProvider snapshot={snapshot}><main data-top="dark" className={styles.analysisPage}>
  <section className={styles.hero}>
   <div className={`${styles.resultBreadcrumb} no-print`}><Link href={reportId?"/history":editHref}><ArrowLeft size={15}/>{reportId?(locale==='en'?'My analyses':'我的分析'):input.intake?x.backStatement:x.back}</Link>{input.intake?<FlowSteps current={3} steps={adaptiveCopy[locale].phases}/>:<FlowSteps current={2}/>}<div className={styles.exportButtons}><button onClick={copy}>{copied?<Check size={14}/>:<Copy size={14}/>}{copied?x.copied:x.copy}</button><button onClick={download}><Download size={14}/>{x.download}</button><button onClick={downloadWorkPack}><Download size={14}/>{locale==='en'?'Working pack':'下载内部材料包'}</button><button onClick={()=>window.print()} aria-label={x.print}><Printer size={15}/></button></div></div>
   {snapshot.completeness==='legacy_partial'&&<p className="notice">{locale==='en'?'Partial evidence record. Missing case, document or resource details are not reconstructed from the current corpus.':'证据记录不完整，缺失案例、文档或资源内容未从当前案例库回填。'}</p>}
   {result.domain&&result.domain.status!=='in_scope'&&<div className="notice"><p>{result.domain.reason} {result.domain.clarification}</p><Link href="/resources">{locale==='en'?'Resources and applicability':'查看资源与适用条件'}</Link></div>}
   {storageWarning&&<p className="notice" role="alert">{locale==='en'?'Browser storage is unavailable or full. Download this report before closing or refreshing.':'浏览器存储不可用或空间不足，请在关闭或刷新前下载本报告。'}</p>}
   {olderVersion&&<p className="notice">{locale==='en'?'This report was generated with an earlier analysis or source version. The stored result remains viewable; evidence completeness is stated separately.':'这份报告使用较早的分析或资料版本生成，仍可查看已存结果；证据完整性另行标注。'}</p>}
   {message&&<p role="status" className="notice">{message}</p>}
   {resultLocale!==locale&&<div className={`${styles.langNotice} no-print`}><Languages size={17}/><span>{t.analysis.langMismatch}</span><Link href={editHref} onClick={editSnapshot} className="text-link">{t.analysis.langRerun}<ArrowRight size={14}/></Link></div>}
   <div className={styles.summary}>
    <div className={styles.summaryTop}><span className={styles.planLabel}>{x.label}</span><span>{x.generated(new Date(result.createdAt).toLocaleString(t.meta.dateLocale))}</span></div>
    <h1>{x.title}</h1>
    <p className={styles.summaryLine}><span>{x.heroGoal}<Link onClick={editSnapshot} href={input.intake?"/new":"/new?step=4"} className={styles.fill}>{selectedGoal}</Link></span>{input.intake&&placeText&&<span>{x.place}<b>{placeText}</b></span>}<span>{x.publicity}<b>{L.publicity[input.publicity]}</b><Link onClick={editSnapshot} className="no-print" href={input.intake ? "/new" : "/new?step=8"}>{x.editLimits}</Link></span>{!input.intake&&<span>{x.support}<b>{supportText}</b></span>}</p>
    <p className={styles.summaryChips}><span className="tag tag-outline">{L.modes[result.mode]}</span>{input.isExample&&<span className="tag tag-accent">{x.exampleTag}</span>}{result.comparableCases.length>0&&<span className="tag tag-green">{x.casesChip(result.comparableCases.length)}</span>}{webChip&&<span className="tag tag-amber">{webChip}</span>}</p>
    {reportId?<p className={`${styles.saveRow} no-print`}><span>{locale==='en'?'Saved report · opening it does not run AI again.':'历史报告 · 查看这份报告不会重新运行 AI。'}</span><Link href="/history" className="text-link">{locale==='en'?'All analyses':'全部分析'}<ArrowRight size={14}/></Link></p>
     :<div className={`${styles.saveRow} no-print`}><span>{locale==='en'?'Kept in memory until you save it.':'结果默认只在内存中。'}</span><label>{locale==='en'?'Keep for ':'保存'}<select value={saveDays} onChange={event=>setSaveDays(Number(event.target.value))}>{[1,7,30].map(days=><option value={days} key={days}>{days}{locale==='en'?' days':' 天'}</option>)}</select></label><button className="btn btn-small" title={locale==='en'?'Only this report is saved, not later drafts. Existing saved reports keep their original expiry.':'仅保存本报告，不自动保存后续草稿。已保存报告保留原有效期。'} onClick={()=>{const ok=saveCurrentReport(new Date(Date.now()+saveDays*86400000).toISOString());setMessage(ok?(locale==='en'?'Saved on this browser. Expired records are removed on the next visit; clearing site data also deletes them.':'已保存到本浏览器；到期后下次访问会清理，清除网站数据也会删除。'):(locale==='en'?'Not saved (storage unavailable, capacity or deletion restriction). Download the report to retain a copy.':'未保存（存储不可用、容量或删除限制），请下载报告保留。'));}}>{locale==='en'?'Save report to history':'主动保存到历史'}</button></div>}
    {input.intake&&<details className={styles.recordDetails}><summary>{x.record}</summary><AdaptiveSummary input={input} locale={locale}/></details>}
   </div>
  </section>
  <div className={styles.tabBar}><div className={styles.resultTabs} role="tablist" aria-label={x.tabsLabel}>{tabs.map(([id,label,n,tier])=><button key={id} id={`tab-${id}`} role="tab" aria-selected={tab===id} aria-controls={`panel-${id}`} onClick={()=>setTab(id)} className={tab===id?styles.activeTab:''}>{tier&&<i className={styles.tierDot} data-tier={tier} aria-hidden="true"/>}{label}<span>{n}</span></button>)}</div></div>
  <div className={styles.resultLayout}>
   <section id="panel-actions" role="tabpanel" aria-labelledby="tab-actions" className={`${styles.tabPanel} ${tab!=='actions'?styles.hiddenPanel:''}`}>
    <h2 className={styles.panelTitle}>{x.actionsTitle(result.actionOptions.length)}</h2>
    {result.actionOptions.map((a,i)=><ActionCard key={a.actionId} a={a} index={i} webIds={(result.actionWebSources??[]).filter(ref=>ref.actionId===a.actionId).flatMap(ref=>ref.sourceIds)} webSources={result.webResearch?.sources??[]} origin={result.actionOrigins?.find(origin=>origin.actionId===a.actionId)}/>)}{!result.actionOptions.length&&<div className="panel"><h3>{x.noActionsTitle}</h3><p>{x.noActionsText}</p></div>}
    <NextQuestions plan={snapshot.whatsNext} missing={result.missingInformation} editHref={editHref} onEditFacts={editSnapshot}>{!reportId&&<span className={`${styles.supplement} no-print`}><button className="text-link" disabled={supplement||!readPreferences().aiEnabled} onClick={()=>setSupplement(true)}>{locale==='en'?'Run one more research round':'主动补查一轮'}</button><small>{locale==='en'?'May use extra quota':'可能产生额外用量'}</small></span>}</NextQuestions>
    {supplement&&<div className={styles.supplementForm}><AnalysisSubmit currentInput={input} operation="supplement" parentAnalysisId={result.analysisId} prepare={()=>input} hasResult={false} stale={false} offerRule submitLabel={locale==='en'?'Submit additional research':'确认发起补查'}/></div>}
    {snapshot.whatsNext&&<WhatsNextWorkspace key={result.analysisId} result={{...result,snapshot}} reportId={reportId}/>}
    <LegalResearchView research={snapshot.legalResearch} resources={snapshot.resources} locale={locale}/>
    <OtherPaths plan={snapshot.whatsNext}/>
    <p className={styles.footnote}>{x.footnote}</p>
   </section>
   <section id="panel-comparison" role="tabpanel" aria-labelledby="tab-comparison" className={`${styles.tabPanel} ${tab!=='comparison'?styles.hiddenPanel:''}`}><div className={styles.sectionIntroduction}><h2>{x.compareTitle}</h2><p>{x.compareText}</p></div>{outOfScope&&<p className={styles.scopeNotice}>{x.outOfScope}</p>}{result.comparableCases.map((m,ci)=>{const c=caseOf(m.caseId);if(!c)return <article className={styles.comparisonCard} key={m.caseId}><h3>{m.caseId}</h3><p className="notice">{locale==='en'?'Case details were not included in this historical snapshot. Only the saved comparison and excerpts are shown.':'此历史快照未包含案例详情，仅展示已保存的比较与原文。'}</p><p>{m.similarities.join('；')}</p><p>{m.differences.join('；')}</p><EvidenceButton ids={m.evidenceIds}/></article>;return <article className={styles.comparisonCard} key={c.caseId}>
    <div className={styles.comparisonHead}><span className={styles.caseIndex}>{pad(ci+1)}</span><div><h3><Link href={`/cases/${c.caseId}`} title={locale==='en'?'Open current library entry; it may differ from this snapshot':'打开当前案例库条目，可能与本快照不同'}>{c.title}<ArrowUpRight size={20}/></Link></h3><div className="row"><span className="tag">{countryName(c.country,locale)}</span>{c.personTypes.map(p=><span key={p} className="tag">{L.persons[p]}</span>)}<span className="tag tag-accent">{m.relevance==='comparable'?x.comparable:x.related}</span><span className={styles.tierTag} data-tier="verified">{x.tiers.verified}</span></div></div></div>
    <p className={styles.historicalSummary}>{c.summary}</p>
    <div className={styles.comparability}><div className={styles.similar}><strong>{x.similar}</strong><ul>{m.similarities.map((s,i)=><li key={i}>{s}</li>)}</ul></div><div className={styles.different}><strong>{x.different}</strong><ul>{m.differences.map((s,i)=><li key={i}>{s}</li>)}</ul></div></div>
    <EvidenceButton ids={m.evidenceIds}/>
    <div className={styles.historyTable}>{result.historicalComparisons.filter(h=>h.caseId===c.caseId).map(h=>{const a=c.interventions.find(a=>a.interventionId===h.interventionId);if(!a)return null;return <div key={a.interventionId} className={styles.historyRow}><div className={styles.historyWhen}><small>{a.date.value||x.dateUnknown}</small><p>{L.stages[a.stageAtAction]}</p><span className="tag">{L.categories[a.category]}</span></div><div><strong>{a.actor}</strong><p>{a.action}</p><div className={styles.historyOutcome}><span>{x.outcome}</span><p>{a.observedOutcomeIds.map(id=>c.outcomes.find(o=>o.outcomeId===id)?.description).filter(Boolean).join(locale==='en'?'; ':'；')||x.noOutcome}</p><small>{x.link[a.relationshipToOutcome]}</small></div><EvidenceButton ids={[...new Set([...a.evidenceIds,...a.observedOutcomeIds.flatMap(id=>c.outcomes.find(o=>o.outcomeId===id)?.evidenceIds||[])])]}/></div></div>})}</div>
    <p className={styles.historicalAsOf}>{c.statusSummary}</p>{snapshot.followups?.filter(followup=>followup.caseId===c.caseId).map(followup=><FollowupTimeline key={followup.caseId} followup={followup} locale={locale}/>)}
   </article>})}{!result.comparableCases.length&&<div className="panel"><h3>{x.noMatchTitle}</h3><p>{x.noMatchText}</p><Link href="/cases" className="text-link">{x.browse}<ArrowRight size={15}/></Link></div>}</section>
   {webCount>0&&<section id="panel-web" role="tabpanel" aria-labelledby="tab-web" className={`${styles.tabPanel} ${tab!=='web'?styles.hiddenPanel:''}`}><WebResearchView research={result.webResearch} comparisons={result.webComparisons??[]} assessment={result.researchAssessment}/></section>}
   <section id="panel-gaps" role="tabpanel" aria-labelledby="tab-gaps" className={`${styles.tabPanel} ${tab!=='gaps'?styles.hiddenPanel:''}`}><div className={styles.sectionIntroduction}><h2>{x.gapsTitle}</h2><p>{x.gapsText}</p></div>
    <div className={styles.gapGrid}><div className={styles.gapBlock}><h3>{x.missing}</h3><ol className={styles.gapList}>{result.missingInformation.map((s,i)=><li key={i}>{s}</li>)}</ol></div><div className={styles.gapBlock}><h3>{x.limits}</h3><ol className={styles.gapList}>{result.limitations.map((s,i)=><li key={i}>{s}</li>)}</ol></div></div>
    {result.comparableCases.flatMap(m=>caseOf(m.caseId)?.conflicts||[]).map((f,i)=><div className="notice" key={i} style={{marginTop:16}}><strong>{x.conflict}</strong><p>{f.description}</p><EvidenceButton ids={f.evidenceIds}/></div>)}
    <div className={styles.gapBlock} style={{marginTop:24}}><h3>{x.unrecorded}</h3>{result.comparableCases.map(m=>{const c=caseOf(m.caseId);return c?<div key={c.caseId} className={styles.unknownCase}><strong>{c.title}</strong><ul className={styles.gapList}>{c.unknowns.map((u,i)=><li key={i}>{u}</li>)}</ul></div>:null})}</div>
    <div className={styles.sourcesList}><h3>{x.sources}</h3>{result.sources.map((e,i)=><div key={e.evidenceId} className={styles.sourceRow}><span className={styles.sourceIndex}>{pad(i+1)}</span><div><strong>{caseOf(e.caseId)?.title}</strong><p>{e.explanation}</p><small>{x.sourceLine(e.pdfPage,docOf(e.documentId)?.publishedDate??'')}</small></div><EvidenceButton ids={[e.evidenceId]} label={x.sourceButton}/></div>)}</div>
   </section>
   {snapshot.uploadedMaterials&&<MaterialSnapshot materials={snapshot.uploadedMaterials} locale={locale}/>}
   <details className={styles.sourcesDetails}><summary>{x.sourcesSummary(snapshot.cases.length,snapshot.evidence.length,snapshot.resources.length)}<Plus size={16} className={styles.chevron}/></summary><EvidenceLayers snapshot={snapshot}/></details>
   {!reportId&&<button className={`${styles.clearButton} text-link no-print`} onClick={()=>{if(window.confirm(x.clearConfirm)){clearSession();setState({input:null,result:null,stale:false})}}}><Trash2 size={13}/>{x.clear}</button>}
  </div>
  <section className={styles.printSources}><h2>{x.printTitle}</h2>{result.sources.map(e=>{const d=docOf(e.documentId);return <article key={e.evidenceId}><h3>{caseOf(e.caseId)?.title} · {x.printPage(e.pdfPage)}</h3><blockquote>{e.exactQuote}</blockquote><p>{e.explanation}</p><p>{x.printReport(d?.publishedDate??'',d?.factsAsOf??'',e.evidenceId)}</p><p>{x.printAuthor(d?.author??'',e.printedPage,d?.checkedAt??'',L.origins[e.origin])}</p><p>{sourceFormatNote(e,locale)}</p><a href={evidenceSourceLink(e)}>{x.printLink}</a></article>})}</section>
 </main></ReportSnapshotProvider>;
}
