'use client';
import {ArrowUpRight,ChevronDown} from 'lucide-react';
import type {CaseIssue,CaseIssueAuthority} from '@/lib/issues/contracts';
import {useI18n} from '@/components/i18n/LocaleProvider';
import {EvidenceButton} from './EvidenceButton';
import styles from './case-issues.module.css';

type Locale='zh'|'en';
const text=(locale:Locale,zh:string,en:string)=>locale==='en'?en:zh;
/** Which layer an authority comes from, in the page's own words. */
function tier(a:CaseIssueAuthority,locale:Locale):{label:string;tone:'local'|'international'|'case'}{
 if(a.kind==='case')return {label:text(locale,'已核实案例','Reviewed case'),tone:'case'};
 if(a.kind==='international')return {label:text(locale,'国际标准','International standard'),tone:'international'};
 return {label:a.check==='quote_matched'?text(locale,'本地法 · 原文已核对','Local law · wording matched'):text(locale,'本地法 · 资料库','Local law · catalog'),tone:'local'};
}
/** Opens a question's card and brings it into view; used by the action cards' links. */
export function openIssue(issueId:string){const card=document.getElementById(issueId);if(card instanceof HTMLDetailsElement)card.open=true;card?.scrollIntoView({behavior:'smooth',block:'start'});}

export default function CaseIssues({issues}:{issues:CaseIssue[]}){
 const {locale}=useI18n();
 if(!issues.length)return null;
 const ruleOnly=issues.every(issue=>issue.origin==='rule');
 const local=issues.flatMap(issue=>issue.authorities.filter(a=>a.kind==='local'));
 // Say only what this result actually contains about local law.
 const localNote=local.some(a=>a.check==='quote_matched')?text(locale,'标“原文已核对”的本地法条，服务器已打开原网页逐字核对。','Local law marked “wording matched” was checked word for word against the source page.')
  :local.length?text(locale,'本地法条来自 CaseLink 资料库。','Local law comes from the CaseLink catalog.')
  :text(locale,'这次没有找到本地法律依据，本地法请当地律师确认。','No local law was found this time; a local lawyer should confirm the local law.');
 return <section className={styles.issues} aria-label={text(locale,'本案的关键问题','Key questions in this case')}>
  <h2>{text(locale,`本案的 ${issues.length} 个关键问题`,issues.length===1?'The key question in this case':`${issues.length} key questions in this case`)}</h2>
  <p className={styles.note}>{ruleOnly?text(locale,'规则参考：只列出可能相关的问题和条文，没有针对本案事实的分析。','Rule-based: possibly relevant questions and provisions only, without analysis of this case’s facts.'):`${text(locale,'每个问题写明事实、依据、对本案的意义和下一步。','Each question sets out the facts, the basis, what it means here and the next step. ')}${localNote}`}</p>
  {issues.map((issue,index)=>{
   const counts=[['local',text(locale,'本地法','local law')],['international',text(locale,'国际标准','international')],['case',text(locale,'案例','cases')]] as const;
   return <details key={issue.issueId} id={issue.issueId} className={styles.issue} open={index===0}>
    <summary><span className={styles.number}>{index+1}</span><span className={styles.question}>{issue.question}</span><span className={styles.counts}>{counts.flatMap(([kind,label])=>{const n=issue.authorities.filter(a=>a.kind===kind).length;return n?[`${label} ${n}`]:[];}).join(' · ')}</span><ChevronDown size={18} className={styles.toggle} aria-hidden="true"/></summary>
    <div className={styles.body}>
     {issue.facts.length>0&&<div className={styles.row}><span className={styles.label}>{text(locale,'事实','Facts')}</span><ul>{issue.facts.map((fact,i)=><li key={i}>{fact.text}<span className={styles.tag}>{fact.pageLabel??text(locale,'用户陈述','User account')}</span></li>)}</ul></div>}
     {issue.authorities.length>0&&<div className={styles.row}><span className={styles.label}>{text(locale,'依据','Basis')}</span><ul>{issue.authorities.map((authority,i)=>{const layer=tier(authority,locale);return <li key={i} className={styles.authority}>
      <p><b>{authority.title}{authority.locator?` · ${authority.locator}`:''}</b><span className={styles.tier} data-tone={layer.tone}>{layer.label}</span></p>
      <p className={styles.point}>{authority.point}</p>
      {authority.quote&&<blockquote lang="und">{authority.quote}</blockquote>}
      <div className={styles.links}>{authority.url&&<a href={authority.url} target="_blank" rel="noreferrer">{authority.kind==='local'&&authority.check==='quote_matched'?text(locale,`打开原文 · ${authority.hostname??''}`,`Open source · ${authority.hostname??''}`):text(locale,'打开原文','Open source')}<ArrowUpRight size={13}/></a>}{authority.kind==='case'&&<EvidenceButton ids={authority.evidenceIds}/>}</div>
     </li>;})}</ul></div>}
     {issue.application&&<div className={styles.row}><span className={styles.label}>{text(locale,'对本案','For this case')}</span><p>{issue.application}<span className={styles.ai}>{text(locale,'AI 分析','AI analysis')}</span></p></div>}
     {!issue.application&&issue.origin==='ai'&&<div className={styles.row}><span className={styles.label}>{text(locale,'对本案','For this case')}</span><p className={styles.muted}>{text(locale,'没有可核对的依据支撑分析，请当地律师判断。','No checkable basis supports an analysis here; a local lawyer should judge.')}</p></div>}
     {issue.nextStep&&<div className={styles.row}><span className={styles.label}>{text(locale,'下一步','Next step')}</span><p>{issue.nextStep}</p></div>}
    </div>
   </details>;
  })}
 </section>;
}
