'use client';
import { useRef } from 'react';
import { ArrowUpRight, BookOpen, X } from 'lucide-react';
import { getEvidence, documents, getCase } from '@/lib/corpus';
import { localizeDocument, localizeEvidence, localizeCase } from '@/lib/i18n/content';
import { useI18n } from '@/components/i18n/LocaleProvider';
import styles from './results.module.css';
import {evidenceSourceLink,isWebPrint,sourceFormatNote} from '@/lib/evidence/source-links';
export function EvidenceButton({ids,label}:{ids:string[],label?:string}){
 const {locale,t,L}=useI18n();const v=t.evidence;
 const dialog=useRef<HTMLDialogElement>(null);const records=[...new Set(ids)].map(getEvidence).filter(e=>!!e).map(e=>localizeEvidence(e,locale));
 if(!records.length)return <span className={styles.noEvidence}>{v.none}</span>;
 return <><button className={`${styles.evidenceButton} no-print`} onClick={()=>dialog.current?.showModal()}><BookOpen size={14}/>{label??v.view}<span className={styles.refCount}>{records.length}</span></button><dialog ref={dialog} className={styles.evidenceDialog} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}>
  <div className={styles.drawerHead}><div><h2>{v.title[0]}<br/>{v.title[1]}</h2><i className="bar"/><p>{v.summary(records.length)}</p></div><button className={styles.iconButton} aria-label={v.close} onClick={()=>dialog.current?.close()}><X size={20} strokeWidth={2.4}/></button></div>
  <ol className={styles.drawerBody}>{records.map((e,i)=>{const raw=documents.find(d=>d.documentId===e.documentId);const doc=raw?localizeDocument(raw,locale):undefined;return <li className={styles.evidenceItem} key={e.evidenceId}>
   <div className={styles.evidenceTop}><span className={styles.evidenceIndex}>{String(i+1).padStart(2,'0')}</span><span className="tag">{(getCase(e.caseId)?localizeCase(getCase(e.caseId)!,locale).title:'')}</span><span className={`tag ${e.reviewStatus==='conflict'?'tag-accent':'tag-green'}`}>{e.reviewStatus==='conflict'?v.conflict:v.verified}</span></div>
   <blockquote lang="en">“{e.exactQuote}”</blockquote>
   <p className={styles.evidenceExplain}>{e.explanation}</p>
   <div className={styles.sourceMeta}><span>{v.page(e.pdfPage,e.printedPage)}</span><span>{L.origins[e.origin]}</span><span>{v.reportDate(doc?.publishedDate??'',doc?.checkedAt??'')}</span><span>{doc?.author}</span></div>
   {isWebPrint(e)&&<p className="muted">{sourceFormatNote(e,locale)}</p>}
   <a className="text-link" href={evidenceSourceLink(e)} target="_blank" rel="noreferrer">{isWebPrint(e)?(locale==='en'?'Open official source page':'打开官方原文网页'):v.open}<ArrowUpRight size={14}/></a>
  </li>})}</ol>
 </dialog></>;
}
