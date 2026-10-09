'use client';
import { useRef } from 'react';
import { ArrowUpRight, BookOpen, X } from 'lucide-react';
import { getEvidence, documents, getCase } from '@/lib/corpus';
import { localizeDocument, localizeEvidence, localizeCase } from '@/lib/i18n/content';
import { useI18n } from '@/components/i18n/LocaleProvider';
import styles from './results.module.css';
import {useReportSnapshot} from './SnapshotContext';
import type {ReportSnapshot} from '@/lib/contracts';
import {evidenceSourceLink,isWebPrint,sourceFormatNote} from '@/lib/evidence/source-links';
export function EvidenceButton({ids,label,snapshot:provided}:{ids:string[],label?:string,snapshot?:ReportSnapshot}){
 const context=useReportSnapshot(); const snapshot=provided??context;
 const {locale,t,L}=useI18n();const v=t.evidence;
 const dialog=useRef<HTMLDialogElement>(null);const records=[...new Set(ids)].map(id=>snapshot?snapshot.evidence.find(e=>e.evidenceId===id):getEvidence(id)).filter(e=>!!e).map(e=>snapshot?e:localizeEvidence(e,locale));
 if(!records.length)return <span className={styles.noEvidence}>{v.none}</span>;
 return <><button className={`${styles.evidenceButton} no-print`} onClick={()=>dialog.current?.showModal()}><BookOpen size={14}/>{label??v.view}<span className={styles.refCount}>{records.length}</span></button><dialog ref={dialog} className={styles.evidenceDialog} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}>
  <div className={styles.drawerHead}><div><h2>{v.title[0]}<br/>{v.title[1]}</h2><i className="bar"/><p>{v.summary(records.length)}</p></div><button className={styles.iconButton} aria-label={v.close} onClick={()=>dialog.current?.close()}><X size={20} strokeWidth={2.4}/></button></div>
  <ol className={styles.drawerBody}>{records.map((e,i)=>{const raw=(snapshot?.documents??documents).find(d=>d.documentId===e.documentId);const doc=raw?(snapshot?raw:localizeDocument(raw,locale)):undefined;const record=snapshot?snapshot.cases.find(c=>c.caseId===e.caseId):getCase(e.caseId);const descriptor=snapshot?.sourceDescriptors.find(s=>s.sourceId===e.evidenceId);return <li className={styles.evidenceItem} key={e.evidenceId}>
   <div className={styles.evidenceTop}><span className={styles.evidenceIndex}>{String(i+1).padStart(2,'0')}</span><span className="tag">{record?(snapshot?record.title:localizeCase(record,locale).title):(locale==='en'?'Case metadata not recorded':'案例元数据未记载')}</span><span className={`tag ${e.reviewStatus==='conflict'?'tag-accent':'tag-green'}`}>{e.reviewStatus==='conflict'?v.conflict:descriptor?.reviewStatus==='team_verified'?(locale==='en'?'Team reviewed':'团队已审核'):(locale==='en'?'Recorded source excerpt':'已记录原文摘录')}</span></div>
   {snapshot?.completeness==='legacy_partial'&&<p className="notice">{locale==='en'?'Legacy record: missing metadata has not been backfilled from the current library.':'旧版记录：缺失元数据未从当前案例库补填。'}</p>}
   <blockquote lang="en">“{e.exactQuote}”</blockquote>
   <p className={styles.evidenceExplain}>{e.explanation}</p>
   <div className={styles.sourceMeta}><span>{v.page(e.pdfPage,e.printedPage)}</span><span>{L.origins[e.origin]}</span><span>{v.reportDate(doc?.publishedDate??'',doc?.checkedAt??'')}</span><span>{doc?.author}</span></div>
   {isWebPrint(e)&&<p className="muted">{sourceFormatNote(e,locale)}</p>}
   <a className="text-link" href={evidenceSourceLink(e)} target="_blank" rel="noreferrer">{isWebPrint(e)?(locale==='en'?'Open official source page':'打开官方原文网页'):v.open}<ArrowUpRight size={14}/></a>
  </li>})}</ol>
 </dialog></>;
}
