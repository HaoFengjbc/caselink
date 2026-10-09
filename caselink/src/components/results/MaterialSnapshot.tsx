import {type MaterialRecord} from '@/lib/materials/contracts';
import {materialsCopy} from '@/lib/i18n/materials';

/** Snapshot text only: never creates an expired or public link to a private original. */
export default function MaterialSnapshot({materials,locale}:{materials:MaterialRecord;locale:'zh'|'en'}){
 const c=materialsCopy[locale],en=locale==='en';
 return <section className="panel" style={{margin:'24px auto',maxWidth:1120}} aria-label={c.privateSource} data-testid="material-snapshot">
  <h2>{c.privateSource}</h2><p>{c.historical}</p>
  <p>{en?'Selected case: ':'处理对象：'}{materials.selectedCaseLabel}</p>
  {materials.documents.map(d=><p key={d.fileId}>{d.filename} · {d.pageCount} {en?'PDF pages':'页 PDF'} · {en?'Text read on pages':'已读文字页'} {d.processedPages.join(', ')||'—'}{d.unreadablePages.length>0&&<> · {en?'Unreadable':'不可读页'} {d.unreadablePages.join(', ')}</>}{d.omittedPages.length>0&&<> · {en?'Omitted':'未处理页'} {d.omittedPages.join(', ')}</>}</p>)}
  {materials.conflicts.map(conflict=><div className="notice" key={conflict.id}><strong>{en?'Source conflict':'来源冲突'}</strong><p>{conflict.description}</p><p>{en?'User review: ':'用户核对：'}{conflict.resolution||'—'}</p></div>)}
  {materials.items.map(item=><details key={item.id} style={{padding:'12px 0',borderBottom:'1px solid #ddd'}}><summary>{c.fields[item.field]} · {item.text} — {c.source}</summary>
   <p>{item.subject} · {c.natures[item.nature]}{item.date&&<> · {c.dates[item.dateKind]}: {item.date}</>}</p>
   {item.status==='edited'&&<p>{en?'Edited user note; the original excerpt below is unchanged.':'此项为用户改写笔记；下方原文保持不变。'}</p>}
   {item.uncertainty&&<p className="notice">{item.uncertainty}</p>}
   {item.sources.map((source,index)=><figure key={`${source.fileId}-${source.pdfPage}-${index}`}><figcaption>{source.filename} · PDF {source.pdfPage}{source.printedPage?` · ${en?'PDF page label (not verified print numbering)':'PDF 页面标签（非已核实印刷页码）'} ${source.printedPage}`:''}</figcaption><blockquote style={{whiteSpace:'pre-wrap'}}>{source.quote}</blockquote></figure>)}
  </details>)}
 </section>;
}
