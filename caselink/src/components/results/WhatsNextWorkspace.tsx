'use client';
import {useState,type ReactNode} from 'react';
import Link from 'next/link';
import {ArrowRight,ChevronDown,Copy,Download,FileText,PenLine,X} from 'lucide-react';
import type {AnalysisResult} from '@/lib/contracts';
import type {WhatsNextPlan,WorkingDocument,WorkKind} from '@/lib/whats-next-contracts';
import {useI18n} from '@/components/i18n/LocaleProvider';
import {updateWorkingDocument,setWorkingProgress,resolveWorkingDocument} from '@/lib/session';
import {safeSourceUrl} from '@/components/research/comparison-data';
import {workingDocumentMarkdown,workingLabels} from './working-documents';
import styles from './whats-next.module.css';

/** A deliberately small React-only renderer: arbitrary HTML is never executed. */
function inline(text:string):ReactNode[]{return text.split(/(https?:\/\/[^\s<>]+)/g).map((part,index)=>{const safe=safeSourceUrl(part);return safe?<a key={index} href={safe} target="_blank" rel="noreferrer">{part}</a>:part;});}
function MarkdownPreview({markdown}:{markdown:string}){
 const blocks:ReactNode[]=[];const lines=markdown.split('\n');
 for(let i=0;i<lines.length;i++){const line=lines[i];if(!line.trim())continue;
  if(line.startsWith('| ')){const table:string[][]=[];while(i<lines.length&&lines[i].startsWith('|')){if(!/^\|[\s:|\-]+\|$/.test(lines[i]))table.push(lines[i].split('|').slice(1,-1).map(x=>x.trim()));i++;}i--;blocks.push(<div className={styles.tableScroll} key={i}><table><thead><tr>{table[0]?.map((v,n)=><th key={n}>{inline(v)}</th>)}</tr></thead><tbody>{table.slice(1).map((row,n)=><tr key={n}>{row.map((v,k)=><td key={k}>{inline(v)}</td>)}</tr>)}</tbody></table></div>);continue;}
  if(line.startsWith('### '))blocks.push(<h5 key={i}>{inline(line.slice(4))}</h5>);
  else if(line.startsWith('## '))blocks.push(<h4 key={i}>{inline(line.slice(3))}</h4>);
  else if(line.startsWith('# '))blocks.push(<h3 key={i}>{inline(line.slice(2))}</h3>);
  else if(line.startsWith('> '))blocks.push(<blockquote key={i}>{inline(line.slice(2))}</blockquote>);
  else if(line==='---')blocks.push(<hr key={i}/>);
  else blocks.push(<p key={i}>{inline(line)}</p>);
 }
 return <div className={styles.preview}>{blocks}</div>;
}

/** Questions that change the next step, then the analysis' own gaps: at most four, one line each. */
export function NextQuestions({plan,missing,editHref,onEditFacts,children}:{plan?:WhatsNextPlan;missing:string[];editHref:string;onEditFacts:()=>void;children?:ReactNode}){
 const {locale}=useI18n(),en=locale==='en';
 const items=[...(plan?.questions??[]).map(q=>({key:q.questionId,question:q.question,reason:q.reason})),...[...new Set(missing)].map((item,index)=>({key:`missing-${index}`,question:item,reason:''}))].slice(0,4);
 if(!items.length&&!children)return null;
 return <section className={styles.questions} aria-label={en?'Still missing':'还缺这几条信息'}>
  <h2>{en?'Still missing':'还缺这几条信息'}</h2>
  {items.length>0&&<ul>{items.map(item=><li key={item.key}><span>{item.question}</span>{item.reason&&<small>{item.reason}</small>}</li>)}</ul>}
  <div className={styles.questionActions}><Link href={editHref} onClick={onEditFacts} className="text-link">{en?'Add details (unknown is fine)':'去补充（不知道也可以）'}<ArrowRight size={14}/></Link>{children}</div>
 </section>;
}

/** Routes that need more conditions, or are paused, folded into one line until opened. */
export function OtherPaths({plan}:{plan?:WhatsNextPlan}){
 const {locale}=useI18n(),en=locale==='en';
 const paths=plan?.paths??[];
 if(!paths.length)return null;
 return <details className={styles.paths}><summary><strong>{en?'Other routes':'其他路径'}</strong><span>{en?`${paths.length} · consider only once conditions are met`:`${paths.length} 条 · 条件满足后再考虑`}</span><ChevronDown size={16} aria-hidden="true"/></summary>
  {paths.map(path=><div key={path.pathId} className={styles.path} data-path-state={path.state}><p><strong>{path.title}</strong><i>{path.state==='paused'?(en?'Paused':'暂不推进'):(en?'Conditional':'有条件')}</i></p><p>{path.reason}</p>{!!path.conditions.length&&<ul>{path.conditions.map((condition,index)=><li key={index}>{condition}</li>)}</ul>}</div>)}
 </details>;
}

/** The three case-filled working drafts: one line each, opened on demand. */
export default function WhatsNextWorkspace({result,reportId}:{result:AnalysisResult;reportId?:string}){
 const {locale}=useI18n(),en=locale==='en',tr=(zh:string,english:string)=>en?english:zh,W=workingLabels[locale];
 const snapshot=result.snapshot!,plan=snapshot?.whatsNext;
 const [active,setActive]=useState<WorkKind|null>(null),[editing,setEditing]=useState(false),[notice,setNotice]=useState(''),[revisions,setRevisions]=useState<WorkingDocument[]|null>(null);
 if(!plan)return null;
 const documents=reportId?(revisions??plan.documents):plan.documents;
 const document=active?documents.find(d=>d.kind===active):undefined;
 const update=(kind:WorkKind,markdown:string)=>{if(reportId)setRevisions(documents.map(d=>d.kind===kind?{...d,markdown,status:'user_edited',citationState:'needs_review'}:d));else updateWorkingDocument(kind,markdown);};
 const progress=(kind:WorkKind,value:WorkingDocument['progress'],note:string)=>{if(reportId)setRevisions(documents.map(d=>d.kind===kind?{...d,progress:value,progressNote:note}:d));else setWorkingProgress(kind,value,note);};
 const resolve=(kind:WorkKind,choice:'generated'|'edited')=>{if(reportId)setRevisions(documents.map(d=>d.kind===kind?{...d,markdown:choice==='generated'?d.generatedMarkdown:d.markdown,status:choice==='generated'?'generated':'user_edited',citationState:'needs_review',previousMarkdown:undefined}:d));else resolveWorkingDocument(kind,choice);};
 const copy=async()=>{if(!document)return;try{await navigator.clipboard.writeText(workingDocumentMarkdown(document,locale));setNotice(tr('已复制当前草稿及依据状态。','Current draft and citation state copied.'));}catch{setNotice(tr('复制未成功；可以改用下载。','Copy failed; use download.'));}};
 const download=(doc:WorkingDocument)=>{const url=URL.createObjectURL(new Blob([workingDocumentMarkdown(doc,locale)],{type:'text/markdown;charset=utf-8'}));const a=window.document.createElement('a');a.href=url;a.download=`CaseLink-${doc.kind}-${result.analysisId.slice(0,12)}${reportId?'-revision':''}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice(tr('已下载；实际行动进度没有改变。','Downloaded; action progress unchanged.'));};
 const show=(kind:WorkKind)=>{setActive(kind);setEditing(false);setNotice('');window.setTimeout(()=>window.document.getElementById('working-document-panel')?.scrollIntoView({behavior:'smooth',block:'nearest'}),0);};
 return <section className={styles.drafts} aria-label="What’s Next workspace" data-whats-next="1">
  <h2>{tr('三份工作草稿','Three working drafts')}</h2>
  <p className={styles.note}>{reportId?tr('已保存的报告：在这里的修改只生成内存中的修订稿，可下载，原报告不变。','Saved report: edits here create an in-memory revision you can download; the saved report is unchanged.'):tr('根据本案信息预先填好，可以修改后下载或复制。','Pre-filled from this case. Edit, then download or copy.')}</p>
  <div className={styles.draftGrid}>{documents.map(doc=>{const task=plan.priorities.find(t=>t.kind===doc.kind);return <article key={doc.kind} className={styles.draft} data-work-kind={doc.kind} data-active={active===doc.kind||undefined}>
   <h3><FileText size={16} aria-hidden="true"/>{doc.title}</h3>{task&&<p>{task.whyNow}</p>}{doc.status!=='generated'&&<span className={styles.flag}>{W.status[doc.status]}</span>}
   <div className={styles.draftActions}><button type="button" data-document-tab={doc.kind} aria-expanded={active===doc.kind} onClick={()=>show(doc.kind)}>{tr('预览','Preview')}</button><button type="button" data-download-kind={doc.kind} onClick={()=>download(doc)}><Download size={14}/>{tr('下载','Download')}</button></div>
  </article>;})}</div>
  {document&&<div className={styles.viewer} id="working-document-panel">
   <div className={styles.viewerBar}><strong>{document.title}</strong><span data-citation-state={document.citationState}>{document.citationState==='needs_review'?tr('依据待复核','Citations need rechecking'):tr('已连接来源 · 非人工核实','Source-linked · not human verified')}</span>
    <div className={styles.viewerTools}><button type="button" onClick={()=>setEditing(!editing)}><PenLine size={14}/>{editing?tr('预览当前草稿','Preview current draft'):tr('编辑本案草稿','Edit case draft')}</button><button type="button" onClick={copy}><Copy size={14}/>{tr('复制本份材料','Copy this document')}</button><button type="button" onClick={()=>download(document)}><Download size={14}/>{tr('下载本份 Markdown','Download this Markdown')}</button><button type="button" aria-label={tr('收起草稿','Close draft')} onClick={()=>{setActive(null);setEditing(false);}}><X size={15}/></button></div></div>
   {notice&&<p role="status" className={styles.note}>{notice}</p>}
   {document.status==='needs_merge'&&<div className={styles.warning} role="alert"><h4>{tr('案情已改变：人工稿需要合并','Facts changed: merge your edited draft')}</h4><p>{tr('新生成稿与旧人工稿都已保留。先比较后选择；保留人工稿仍须核对新事实与原引用。','Both the new generated draft and prior edited draft are retained. Compare before choosing; keeping the edited draft still requires checking facts and citations.')}</p><details><summary>{tr('查看保留的旧人工稿','View retained prior edit')}</summary><MarkdownPreview markdown={document.previousMarkdown??''}/></details><details><summary>{tr('查看根据新事实生成的稿件','View draft generated from new facts')}</summary><MarkdownPreview markdown={document.generatedMarkdown}/></details><div className={styles.viewerTools}><button type="button" onClick={()=>resolve(document.kind,'edited')}>{tr('保留人工稿继续核对','Keep edited draft for review')}</button><button type="button" onClick={()=>resolve(document.kind,'generated')}>{tr('采用新生成稿','Use newly generated draft')}</button></div></div>}
   {editing?<label className={styles.editorLabel}>{tr('修改后原引用会标为待复核；内容只在内存中，主动保存报告才会保留。','Edits mark the original citations for rechecking. Changes stay in memory until you save the report.')}<textarea aria-label={tr('本案材料正文','Case document text')} value={document.markdown} onChange={e=>update(document.kind,e.target.value)}/></label>:<MarkdownPreview markdown={document.markdown}/>}
   <details className={styles.progress}><summary>{tr('记录实际进度','Record actual progress')}</summary><p>{tr('只记录你已经做了什么，不会发送材料，也不改变来源核查状态。','This only records what you have done. It sends nothing and does not change source-review status.')}</p><label>{tr('实际进度','Actual progress')} <select aria-label={tr('实际进度','Actual progress')} value={document.progress} onChange={e=>progress(document.kind,e.target.value as WorkingDocument['progress'],document.progressNote)}>{(['draft','reviewed','completed','sent'] as const).map(value=><option key={value} value={value}>{W.progress[value]}</option>)}</select></label><label>{tr('进度说明（由谁、何时、做了什么）','Progress note (who, when, what)')}<textarea aria-label={tr('进度说明','Progress note')} value={document.progressNote} onChange={e=>progress(document.kind,document.progress,e.target.value)}/></label></details>
  </div>}
 </section>;
}
