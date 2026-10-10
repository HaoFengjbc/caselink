import {FileText} from 'lucide-react';
import {type MaterialRecord} from '@/lib/materials/contracts';
import {materialsCopy} from '@/lib/i18n/materials';
import {materialPages,pageRange} from '@/lib/materials/pages';
import styles from './results.module.css';

/** Snapshot text only: never creates an expired or public link to a private original. Folded to one line until opened. */
export default function MaterialSnapshot({materials,locale}:{materials:MaterialRecord;locale:'zh'|'en'}){
 const c=materialsCopy[locale],en=locale==='en';
 return <section className={styles.materialSnapshot} aria-label={c.privateSource} data-testid="material-snapshot"><details className={styles.materialFold}>
  <summary><span>{c.privateSource}</span><small>{en?`${materials.documents.length} PDF · ${materials.items.length} points with pages`:`${materials.documents.length} 份 PDF · ${materials.items.length} 条要点（带页码）`}</small></summary>
  <p className={styles.materialNote}>{c.historical} {en?'Case: ':'处理对象：'}{materials.selectedCaseLabel}</p>
  {materials.documents.map(d=>{const all=d.processedPages.length===d.pageCount;return <p key={d.fileId} className={styles.materialFile}><FileText size={15} aria-hidden="true"/><b>{d.filename}</b><span>{en?`${d.pageCount} pages · ${all?'all read':`read p. ${pageRange(d.processedPages,locale)}`}`:`${d.pageCount} 页 · ${all?'已全部读取':`已读第 ${pageRange(d.processedPages,locale)} 页`}`}</span>{d.unreadablePages.length>0&&<span className={styles.materialIssue}>{en?`p. ${pageRange(d.unreadablePages,locale)} unreadable`:`第 ${pageRange(d.unreadablePages,locale)} 页无法读取`}</span>}{d.omittedPages.length>0&&<span className={styles.materialIssue}>{en?`p. ${pageRange(d.omittedPages,locale)} not processed`:`第 ${pageRange(d.omittedPages,locale)} 页未处理`}</span>}</p>;})}
  {materials.conflicts.map(conflict=><p key={conflict.id} className={styles.materialConflict}><strong>{en?'Records differ':'记载不一致'}</strong>{conflict.description}<span>{en?'Recorded: ':'已记录：'}{conflict.resolution||'—'}</span></p>)}
  <ul className={styles.materialItems}>{materials.items.map(item=><li key={item.id}><details><summary>{item.text}<span className={styles.pageTag}>{materialPages(item,materials.documents,locale)}</span>{item.status==='edited'&&<span className={styles.editedTag}>{en?'edited':'已改写'}</span>}</summary>
   {item.uncertainty&&<p className={styles.materialIssue}>{item.uncertainty}</p>}
   {item.sources.map((source,index)=><blockquote key={`${source.fileId}-${source.pdfPage}-${index}`}><span>{source.filename} · {en?`p. ${source.pdfPage}`:`第 ${source.pdfPage} 页`}</span>{source.quote}</blockquote>)}
  </details></li>)}</ul>
 </details></section>;
}
