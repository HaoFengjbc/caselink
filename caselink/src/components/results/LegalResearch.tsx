'use client';
import {ArrowUpRight,Plus} from 'lucide-react';
import type {ActionOption,Resource} from '@/lib/contracts';
import type {LegalBinding,LegalResearch} from '@/lib/legal-contracts';
import {useI18n} from '@/components/i18n/LocaleProvider';
import {safeSourceUrl} from '@/components/research/comparison-data';
import {workingLabels} from './working-documents';
import {useReportSnapshot} from './SnapshotContext';
import styles from './legal-research.module.css';

type Locale='zh'|'en';
const text=(locale:Locale,zh:string,en:string)=>locale==='en'?en:zh;
/** Short source tag for a fact a provision relies on. */
function factSource(fact:LegalBinding['factBasis'][number],locale:Locale):string{
 if(fact.origin==='document'&&fact.fileName&&fact.page)return `${fact.fileName} ${text(locale,`第 ${fact.page} 页`,`p. ${fact.page}`)}`;
 return fact.origin==='opposing_allegation'?text(locale,'对方指控','Opposing allegation'):fact.origin==='court_finding'?text(locale,'法院认定','Court finding'):text(locale,'用户陈述','User statement');
}
function reviewOf(resource:Resource|undefined,locale:Locale):string{
 if(!resource)return text(locale,'来源记录缺失','Source record missing');
 const W=workingLabels[locale],status=resource.reviewStatus==='team_verified'&&(!resource.teamReviewer||!resource.teamReviewedAt)?'unreviewed':resource.reviewStatus??'unreviewed';
 return [resource.sourceAudit?.checkedAt??resource.checkedAt,resource.sourceAudit?W.read[resource.sourceAudit.readStatus]:'',W.review[status]].filter(Boolean).join(' · ');
}
/** One provision: the proposition, the original words, open conditions, and where the facts come from. */
function BindingDetail({binding,resource,locale}:{binding:LegalBinding;resource?:Resource;locale:Locale}){
 const audit=resource?.sourceAudit,provision=audit?.provisions.find(p=>p.provisionId===binding.provisionId);
 const supported=!!provision?.supports.includes(binding.claimKey)&&provision.explanation===binding.claim;
 const W=workingLabels[locale],url=safeSourceUrl(audit?.readUrl??resource?.officialUrl??'');
 return <div className={styles.binding} data-binding-id={binding.bindingId}>
  <p className={styles.claim}><span className={styles.locator}>{provision?.locator??binding.provisionId}</span>{binding.claim}</p>
  {supported&&provision?<blockquote lang="und">{provision.quote}</blockquote>:<p className={styles.warning}>{text(locale,'快照里没有支持这句判断的原文，不能当作已核实的依据。','The snapshot has no source text for this proposition; do not treat it as verified.')}</p>}
  {binding.relevance&&<p className={styles.why}>{binding.relevance}</p>}
  {!!binding.conditions.length&&<ul className={styles.conditions}>{binding.conditions.map((condition,index)=><li key={index} data-condition={condition.status}><span>{W.condition[condition.status]}</span><strong>{condition.label}</strong>{condition.detail}</li>)}</ul>}
  {!!binding.factBasis.length&&<div className={styles.facts}><h4>{text(locale,'相关事实','Related facts')}</h4><ul>{binding.factBasis.slice(0,3).map((fact,index)=><li key={index}>{fact.text}<small>{factSource(fact,locale)}</small></li>)}</ul>{binding.factBasis.length>3&&<small>{text(locale,`另有 ${binding.factBasis.length-3} 条，见工作草稿`,`${binding.factBasis.length-3} more in the working drafts`)}</small>}</div>}
  {!!binding.nextChecks.length&&<div className={styles.facts}><h4>{text(locale,'下一步核对','Check next')}</h4><ul>{binding.nextChecks.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
  <p className={styles.meta}>{url&&<a href={url} target="_blank" rel="noreferrer">{text(locale,'打开原文','Open source')}<ArrowUpRight size={13}/></a>}<span>{reviewOf(resource,locale)}</span></p>
 </div>;
}
/** Bindings grouped by source document, so several paragraphs of one text read as one line. */
function groups(bindings:LegalBinding[]){const map=new Map<string,LegalBinding[]>();for(const b of bindings)map.set(b.resourceId,[...(map.get(b.resourceId)??[]),b]);return [...map.values()];}
const openLabels=(bindings:LegalBinding[])=>[...new Set(bindings.flatMap(b=>b.conditions.filter(c=>c.status==='unknown').map(c=>c.label)))];
/** One source per line; conditions most sources share are stated once above the list instead. */
function LawRow({bindings,resources,locale,shared}:{bindings:LegalBinding[];resources:Resource[];locale:Locale;shared:Set<string>}){
 const first=bindings[0]!,resource=resources.find(r=>r.resourceId===first.resourceId);
 const unconfirmed=openLabels(bindings).filter(label=>!shared.has(label));
 const excluded=bindings.every(b=>b.applicability==='excluded');
 return <details className={styles.row} data-resource-id={first.resourceId}>
  <summary><span className={styles.name}>{resource?.name??first.resourceId}</span><span className={styles.summaryClaim}>{first.claim}</span>
   <span className={styles.chips}>{bindings.length>1&&<i data-tone="muted">{text(locale,`共 ${bindings.length} 处`,`${bindings.length} passages`)}</i>}{excluded&&<i data-tone="muted">{text(locale,'已排除','Excluded')}</i>}{unconfirmed.slice(0,2).map(label=><i key={label}>{text(locale,`待确认：${label}`,`To confirm: ${label}`)}</i>)}{unconfirmed.length>2&&<i>+{unconfirmed.length-2}</i>}</span><Plus size={16} className={styles.toggle} aria-hidden="true"/></summary>
  <div className={styles.body}>{bindings.map(binding=><BindingDetail key={binding.bindingId} binding={binding} resource={resource} locale={locale}/>)}</div>
 </details>;
}
export function LegalResearchView({research,resources,locale}:{research?:LegalResearch;resources:Resource[];locale:Locale}){
 if(!research)return <section className={styles.research}><h2>{text(locale,'法律依据','Legal basis')}</h2><p className={styles.note}>{text(locale,'这份历史报告没有保存逐条法律研究；不从当前资料库补齐。','This saved report has no provision-level research; it is not rebuilt from the current catalog.')}</p></section>;
 const rows=groups(research.bindings);
 // A condition most sources share is said once above the list rather than on every line.
 const counts=new Map<string,number>();for(const bindings of rows)for(const label of openLabels(bindings))counts.set(label,(counts.get(label)??0)+1);
 const shared=new Set(rows.length>1?[...counts].filter(([,n])=>n>=2&&n*2>=rows.length).map(([label])=>label):[]);
 return <section className={styles.research} aria-label={text(locale,'本案法律研究链','Matter-specific legal research chain')}>
  <h2>{text(locale,'法律依据','Legal basis')}</h2>{(research.coverageNote||shared.size>0)&&<p className={styles.note}>{research.coverageNote}{shared.size>0&&text(locale,`多数条文还需确认：${[...shared].join('、')}。`,` Most of them still need: ${[...shared].join(', ')}.`)}</p>}
  {rows.length?rows.map(bindings=><LawRow key={bindings[0]!.resourceId} bindings={bindings} resources={resources} locale={locale} shared={shared}/>):<p className={styles.note}>{text(locale,'没有找到可直接对应的条文；不强配法条。','No directly matching provision; none is forced.')}</p>}
  {!!research.gaps.length&&<details className={styles.gaps}><summary>{text(locale,'覆盖缺口','Coverage gaps')} · {research.gaps.length}</summary><ul>{research.gaps.map((gap,index)=><li key={index}>{gap}</li>)}</ul></details>}
 </section>;
}
/** The provisions behind one action, as plain lines inside that action's details. */
export function ActionLegalCitations({action}:{action:ActionOption}){
 const {locale}=useI18n();const snapshot=useReportSnapshot();const refs=action.legalCitations??[];
 if(!refs.length)return null;
 return <div className={styles.actionCitations}><h4>{text(locale,'相关条文','Related provisions')}</h4><ul>{refs.map(ref=>{const binding=snapshot?.legalResearch?.bindings.find(b=>b.bindingId===ref.bindingId&&b.claimKey===ref.claimKey&&b.resourceId===ref.resourceId&&b.provisionId===ref.provisionId);const resource=snapshot?.resources.find(r=>r.resourceId===ref.resourceId);const provision=resource?.sourceAudit?.provisions.find(p=>p.provisionId===ref.provisionId);return binding?<li key={ref.bindingId}><b>{resource?.name??ref.resourceId} · {provision?.locator??ref.provisionId}</b>{binding.claim}</li>:<li key={ref.bindingId} className={styles.warning}>{text(locale,'这份快照没有保留这条引用的完整依据；不从当前目录补齐。','This snapshot does not keep the full support for this citation; it is not backfilled.')}</li>;})}</ul></div>;
}
