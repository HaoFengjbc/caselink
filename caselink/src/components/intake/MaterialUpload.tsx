'use client';

import {useEffect, useRef, useState} from 'react';
import {FileText, RotateCcw, Upload, X} from 'lucide-react';
import {MATERIAL_LIMITS, MaterialStreamEventSchema, type MaterialDocument, type MaterialResponse, type ParsedMaterial} from '@/lib/materials/contracts';
import {readPreferences, registerSessionCleanup, sessionInputVersion} from '@/lib/session';
import {useI18n} from '@/components/i18n/LocaleProvider';
import {currentMaterialResponse, selectionError, setFileStage, type SelectedMaterial} from './materials-client-state';
import styles from './materials.module.css';

export default function MaterialUpload({documents, locked, aiEnabled, awaitingSelection=false, onResult, onRemove, onBusyChange}: {
  documents: MaterialDocument[]; locked: boolean; aiEnabled: boolean; awaitingSelection?:boolean;
  onResult: (result: MaterialResponse, background: string) => void; onRemove: (fileId: string) => void; onBusyChange: (value: boolean) => void;
}) {
  const {locale} = useI18n(); const en = locale === 'en';
  const [files,setFiles]=useState<SelectedMaterial[]>([]); const filesRef=useRef(files); filesRef.current=files;
  const [background,setBackground]=useState(''); const [consent,setConsent]=useState(false);
  const [drag,setDrag]=useState(false); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState('');
  const [stage,setStage]=useState(''); const [localPages,setLocalPages]=useState<ParsedMaterial[]>([]);
  const lifecycle=useRef(0);
  const pending=useRef<{token:string;controller:AbortController;ids:string[]}|null>(null);
  const intent=useRef<{key:string;id:string;version:number}|null>(null);
  const changeBusy=useRef(onBusyChange); changeBusy.current=onBusyChange;
  const resultCallback=useRef(onResult); resultCallback.current=onResult;
  const localeRef=useRef(locale); localeRef.current=locale;
  const labels={selected:en?'Ready to check':'待检查',checking:en?'Checking file':'检查文件',reading:en?'Reading text':'正在读取',organizing:en?'Organizing case':'正在整理',review:en?'Waiting for review':'等待核对',error:en?'Could not process':'处理未完成',cancelled:en?'Cancelled':'已取消'};
  const errors={count:en?'Choose at most 3 PDFs for one case.':'同一个案件最多选择 3 份 PDF。',type:en?'This version accepts PDF files only.':'本版仅支持 PDF 文件。',size:en?'Each PDF must be nonempty and no larger than 3 MiB.':'单份 PDF 不可为空，且不得超过 3 MiB。',total:en?'The selected files exceed the total upload limit. Keep the combined file size below 3.9 MB.':'所选文件超过上传总量限制，请将文件合计控制在 390 万字节以内。'};
  function commit(next:SelectedMaterial[]){filesRef.current=next;setFiles(next);}
  function stop(message?:string){lifecycle.current++;const active=pending.current;active?.controller.abort();pending.current=null;intent.current=null;if(active)commit(setFileStage(filesRef.current,active.ids,'cancelled'));setBusy(false);changeBusy.current(false);setStage('');if(message)setNotice(message);}
  useEffect(()=>{const clear=()=>{lifecycle.current++;pending.current?.controller.abort();pending.current=null;filesRef.current=[];setFiles([]);setLocalPages([]);setBusy(false);changeBusy.current(false);};const unregister=registerSessionCleanup(clear);return()=>{lifecycle.current++;unregister();pending.current?.controller.abort();pending.current=null;changeBusy.current(false);};},[]);
  useEffect(()=>{if(!aiEnabled){setConsent(false);if(pending.current)stop(en?'AI permission was withdrawn.':'AI 授权已撤回。');}},[aiEnabled]);
  useEffect(()=>{if(pending.current)stop(en?'Language changed. Read the materials again when ready.':'语言已更改，请重新读取材料。');},[locale]);
  async function add(incoming:File[]){
    if(locked||busy||awaitingSelection)return;
    const generation=lifecycle.current;
    const absent=documents.filter(doc=>!filesRef.current.some(file=>file.id===doc.fileId));
    const all=[...filesRef.current.map(entry=>entry.file),...absent.map(doc=>({size:doc.size,name:doc.filename})),...incoming];
    const invalid=selectionError(all);if(invalid){setNotice(errors[invalid]);return;}
    setNotice('');intent.current=null;
    const additions=await Promise.all(incoming.map(async file=>({id:`pdf-${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join('')}`,file,state:'selected' as const})));
    if(lifecycle.current!==generation)return;
    const present=new Set([...filesRef.current.map(file=>file.id),...documents.map(doc=>doc.fileId)]);
    const unique=additions.filter(entry=>{if(present.has(entry.id))return false;present.add(entry.id);return true;});
    if(unique.length!==additions.length)setNotice(en?'Duplicate PDF content was skipped.':'已跳过内容相同的重复 PDF。');
    const recheck=selectionError([...filesRef.current.map(entry=>entry.file),...absent.map(doc=>({size:doc.size,name:doc.filename})),...unique.map(entry=>entry.file)]);
    if(recheck){setNotice(errors[recheck]);return;}
    commit([...filesRef.current,...unique]);
  }
  function remove(id:string){if(locked)return;stop();commit(filesRef.current.filter(file=>file.id!==id).map(file=>file.processed&&!documents.some(doc=>doc.fileId===file.id)?{...file,processed:false,state:'selected'}:file));setLocalPages(pages=>pages.filter(file=>file.fileId!==id));onRemove(id);setNotice(en?'Material removed. Review the remaining record again.':'已移除材料，请重新核对剩余案情。');}
  async function process(ai:boolean, onlyId?:string){
    if(pending.current||locked||awaitingSelection||ai&&(!aiEnabled||!consent||!readPreferences().aiEnabled))return;
    const selected=filesRef.current.filter(file=>onlyId?file.id===onlyId:!file.processed);if(!selected.length)return;
    const ids=selected.map(file=>file.id),token=crypto.randomUUID(),controller=new AbortController(),capturedLocale=locale;
    const previousDocuments=documents.filter(doc=>!ids.includes(doc.fileId));
    const existingPageCount=previousDocuments.reduce((sum,doc)=>sum+doc.pageCount,0),existingFileCount=previousDocuments.length;
    const identityKey=JSON.stringify([ids,background,ai,capturedLocale,existingPageCount,existingFileCount]);
    if(intent.current?.key!==identityKey)intent.current={key:identityKey,id:crypto.randomUUID(),version:sessionInputVersion()};
    const identity=intent.current;
    pending.current={token,controller,ids};setBusy(true);changeBusy.current(true);setNotice('');setStage(en?'Sending materials':'正在提交材料');
    const timeout=window.setTimeout(()=>controller.abort(),MATERIAL_LIMITS.requestTimeoutMs+5000);
    let ended=false;
    const current=()=>currentMaterialResponse(token,pending.current?.token??null,ids,filesRef.current)&&localeRef.current===capturedLocale;
    try{
      const form=new FormData();
      form.set('metadata',JSON.stringify({requestId:identity.id,inputVersion:identity.version,operation:'initial',locale:capturedLocale,aiConsent:ai,background,existingPageCount,existingFileCount}));
      selected.forEach(entry=>form.append('files',entry.file));
      const bodyBytes=await new Response(form).arrayBuffer();
      if(bodyBytes.byteLength>MATERIAL_LIMITS.maxRequestBytes)throw new Error(errors.total);
      if(!current())return;
      const response=await fetch('/api/materials',{method:'POST',body:form,signal:controller.signal,cache:'no-store'});
      if(!response.ok){const failure=await response.json();throw new Error(failure.message||(en?'Materials could not be processed.':'材料处理失败。'));}
      if(!response.body)throw new Error(en?'No processing response was received.':'未收到处理结果。');
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      const consume=(line:string)=>{
        if(!line.trim()||!current())return;
        const parsed=MaterialStreamEventSchema.safeParse(JSON.parse(line));
        if(!parsed.success)throw new Error(en?'The material response was invalid.':'材料响应格式不正确。');
        const event=parsed.data;
        if(event.type==='stage'){
          setStage(labels[event.stage]);commit(setFileStage(filesRef.current,event.fileId?[event.fileId]:ids,event.stage));
        }else if(event.type==='document'){
          const doc=event.document;commit(filesRef.current.map(file=>file.id===doc.fileId?{...file,pageCount:doc.pageCount,message:doc.unreadablePages.length?(en?`Some pages could not be read: ${doc.unreadablePages.join(', ')}`:`部分页面无法读取：${doc.unreadablePages.join('、')}`):undefined}:file));
        }else if(event.type==='error'){throw new Error(event.message);
        }else{
          ended=true;const result=event.result;
          commit(filesRef.current.map(file=>ids.includes(file.id)?{...file,state:'review',processed:result.mode==='live_ai',pageCount:result.documents.find(doc=>doc.fileId===file.id)?.pageCount}:file));
          if(result.mode==='local_text'){
            setLocalPages(previous=>[...previous.filter(doc=>!ids.includes(doc.fileId)),...result.documents]);
            setNotice(en?'Text was extracted locally on the application server. No model was called. You can copy it into the manual description.':'已在应用服务器本地提取文字，未调用模型。可复制文字到手动描述。');
          }else{resultCallback.current(result,background);setNotice(result.warnings.join(' '));}
          setStage(en?'Waiting for review':'等待核对');
        }
      };
      while(true){const{done,value}=await reader.read();if(done)break;if(!current()){await reader.cancel();return;}buffer+=decoder.decode(value,{stream:true});if(buffer.length>2_000_000)throw new Error(en?'The response exceeded its limit.':'响应超过限制。');const lines=buffer.split('\n');buffer=lines.pop()??'';for(const line of lines)consume(line);}
      buffer+=decoder.decode();if(buffer.trim())consume(buffer);if(!ended&&current())throw new Error(en?'Processing ended before a result was received. Retry the file.':'处理在返回结果前结束，请重试文件。');
    }catch(error){if(current()){const message=controller.signal.aborted?(en?'Processing timed out or was cancelled. You can retry.':'处理超时或已取消，可以重试。'):error instanceof Error?error.message:(en?'Processing failed.':'材料处理失败。');setNotice(message);commit(filesRef.current.map(file=>ids.includes(file.id)?{...file,state:'error',message}:file));setStage('');}}
    finally{window.clearTimeout(timeout);if(current()){pending.current=null;setBusy(false);changeBusy.current(false);}}
  }
  const restored=documents.filter(doc=>!files.some(file=>file.id===doc.fileId));
  const pendingFiles=files.filter(file=>!file.processed);
  return <section className={styles.panel} aria-label={en?'Case materials':'案件材料'}>
    <h2>{en?'Upload case materials':'上传案件材料'}</h2>
    <p className={styles.help}>{en?'1–3 PDFs for one case · embedded text supported · 3 MiB per file, 3.9 MB combined, 30 pages in total. Scanned/image-only PDFs require pasted text in this version.':'同案 1–3 份 PDF · 支持可提取文字的 PDF · 单份 3 MiB、合计 390 万字节、总计 30 页。本版扫描或纯图片 PDF 需粘贴文字。'}</p>
    <label className={styles.drop} data-drag={drag} onDragOver={event=>{event.preventDefault();if(!locked&&!busy)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={event=>{event.preventDefault();setDrag(false);add(Array.from(event.dataTransfer.files));}}>
      <Upload size={28}/><strong>{en?'Drop PDFs here or choose files':'拖拽 PDF 到这里，或点击选择'}</strong><span>{en?'Choosing files does not call AI.':'选择文件不会自动调用 AI。'}</span>
      <input className={styles.hiddenInput} type="file" accept="application/pdf,.pdf" multiple disabled={locked||busy||awaitingSelection} aria-label={en?'Choose case PDFs':'选择案件 PDF'} onChange={event=>{add(Array.from(event.target.files??[]));event.target.value='';}}/>
    </label>
    {(files.length>0||restored.length>0)&&<ul className={styles.files}>{files.map(entry=><li className={styles.file} key={entry.id} data-file-id={entry.id}><FileText size={20}/><div className={styles.fileBody}><strong className={styles.fileName}>{entry.file.name}</strong><p className={styles.fileMeta}>{(entry.file.size/1024).toFixed(1)} KB · {entry.pageCount!==undefined?(en?`${entry.pageCount} PDF pages`:`${entry.pageCount} 个 PDF 物理页`):(en?'Page count available after checking':'检查后显示页数')}</p><p className={styles.fileState}>{labels[entry.state]}</p>{entry.message&&<p className={styles.fileMeta}>{entry.message}</p>}</div><div className={styles.fileActions}>{(entry.state==='error'||entry.state==='cancelled')&&<button className="text-link" disabled={locked||busy||!consent||!aiEnabled} onClick={()=>process(true,entry.id)}><RotateCcw size={13}/>{en?'Retry':'重试'}</button>}<button className="text-link" disabled={locked} aria-label={`${en?'Remove':'移除'} ${entry.file.name}`} onClick={()=>remove(entry.id)}><X size={14}/>{en?'Remove':'移除'}</button></div></li>)}{restored.map(doc=><li className={styles.file} key={doc.fileId}><FileText size={20}/><div className={styles.fileBody}><strong className={styles.fileName}>{doc.filename}</strong><p className={styles.fileMeta}>{doc.pageCount} {en?'PDF pages · original PDF needs to be supplied again to view a full page.':'个 PDF 物理页 · 原 PDF 未保存；查看整页需重新提供文件。'}</p></div><button className="text-link" disabled={locked} onClick={()=>remove(doc.fileId)}>{en?'Remove':'移除'}</button></li>)}</ul>}
    <label className={styles.label} htmlFor="material-background">{en?'One sentence of context (optional)':'补充一句背景（可选）'}</label><textarea id="material-background" className="field" rows={2} maxLength={800} value={background} disabled={busy||locked} onChange={event=>setBackground(event.target.value)} placeholder={en?'Anything the documents do not explain. No need to repeat their contents.':'材料之外需要知道的背景，不必重复材料已有信息。'}/>
    <p className={styles.scope}>{en?'Private working materials for this case. PDF bytes are processed temporarily in this application server’s memory; extracted text is sent to the configured OpenAI service only with permission. Files are not added to the case library or published. PDFs are not saved with reports; saved reports retain cited excerpts and source details. Service retention follows the provider’s policy.':'文件是本案的私有工作材料。PDF 在本应用服务器内存临时处理；仅在授权后将提取文字发送给已配置的 OpenAI 服务。文件不进入案例库、不公开发布。保存报告只保留引用片段与来源信息，不保存 PDF；模型服务留存仍以服务商政策为准。'}</p>
    <label className={styles.consent}><input type="checkbox" checked={consent&&aiEnabled} disabled={!aiEnabled||busy||locked} onChange={event=>setConsent(event.target.checked)}/><span>{en?'I agree to send the extracted text to AI to organize this case. This does not authorize public disclosure or web searches.':'我同意将提取文字交给 AI 整理本案。这不代表允许公开披露或将材料用于联网搜索。'}</span></label>
    {!aiEnabled&&<p className={styles.warning}>{en?'AI is disabled in your privacy settings. Local text extraction and manual entry remain available.':'隐私设置已关闭 AI。仍可仅提取文字或手动录入。'}</p>}
    {notice&&<p className={styles.error} role="alert">{notice}</p>}{stage&&<div className={styles.status} role="status">{busy&&<span className="loading-ring"/>}{stage}</div>}
    <div className={styles.toolbar}>{busy?<button className="btn btn-ghost" onClick={()=>stop(en?'Cancelled. No late result will be applied.':'已取消，后续返回不会写入案情。')}><X size={15}/>{en?'Cancel':'取消'}</button>:<><button className="btn btn-primary" disabled={locked||awaitingSelection||!pendingFiles.length||!consent||!aiEnabled} onClick={()=>process(true)}><Upload size={16}/>{en?'Read materials and organize case':'读取材料并整理案情'}</button><button className="text-link" disabled={locked||awaitingSelection||!pendingFiles.length} onClick={()=>process(false)}>{en?'Extract text only (no AI)':'仅提取文字（不调用 AI）'}</button></>}</div>
    {localPages.map(doc=><details key={doc.fileId}><summary>{doc.filename} · {en?'Local extracted text':'本地提取文字'}</summary>{doc.pages.map(page=><div key={page.pdfPage}><p className={styles.fileMeta}>PDF {page.pdfPage} · {page.status}</p><pre className={styles.localText}>{page.text||(en?'No extractable text on this page.':'此页无可提取文字。')}</pre></div>)}</details>)}
  </section>;
}
