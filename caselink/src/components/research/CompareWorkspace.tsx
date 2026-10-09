'use client';
import {useState} from 'react';
import Link from 'next/link';
import {cases} from '@/lib/corpus';
import type {ComparisonBrief} from '@/lib/contracts';
import {countryName,localizeCase} from '@/lib/i18n/content';
import {useI18n} from '@/components/i18n/LocaleProvider';
import {comparisonMarkdown} from '@/components/results/comparison-export';
import {buildComparisonBrief,parseComparisonBrief,serializeComparisonBrief,COMPARISON_MAX_BYTES} from './comparison-data';
import {ComparisonBriefView} from './ComparisonBriefView';
import styles from './research.module.css';
function download(text:string,filename:string,type:string){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function CompareWorkspace(){
 const {locale}=useI18n();const en=locale==='en';const [selected,setSelected]=useState<string[]>([]),[query,setQuery]=useState(''),[brief,setBrief]=useState<ComparisonBrief|null>(null),[error,setError]=useState('');
 const filtered=cases.map(c=>localizeCase(c,locale)).filter(c=>`${c.title} ${c.country} ${countryName(c.country,'en')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const capture=()=>{try{setBrief(buildComparisonBrief(selected,locale));setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}};
 const exportAs=(json:boolean)=>{if(!brief)return;try{const canonical=serializeComparisonBrief(brief);download(json?canonical:comparisonMarkdown(brief,brief.locale),`CaseLink-comparison-${brief.briefId}.${json?'json':'md'}`,json?'application/json':'text/markdown');setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}};
 const importFile=async(file?:File)=>{if(!file)return;try{if(file.size>COMPARISON_MAX_BYTES)throw new Error(en?'The file exceeds 3 MB.':'文件超过 3 MB。');const value=parseComparisonBrief(await file.text());setBrief(value);setSelected(value.caseIds);setError('');}catch(e){setError(en?'Cannot open comparison: '+String(e):'无法打开比较快照：'+String(e));}};
 return <main className={styles.page} data-top="light"><span className={styles.eyebrow}>{en?'TrialWatch research workspace':'TrialWatch 研究工作区'}</span><h1>{en?'Compare the record. Keep the evidence.':'并排比较案件，保留证据差异。'}</h1><p className={styles.intro}>{en?'Select 2–4 public cases for an internal handoff brief. The comparison uses the curated corpus, with no model-generated facts or web research. It stays in this page’s memory until you export a file.':'选取 2–4 个公开案例，形成内部交接简报。使用已入库资料，不由模型补齐事实，也不执行联网研究。默认仅留在此页面内存；需要保留时请主动导出文件。'}</p>
 <div className={styles.toolbar}><Link href="/cases">{en?'Case library':'返回案例库'}</Link><Link href="/resources">{en?'International resources':'国际资源与条件'}</Link><input type="search" aria-label={en?'Filter public cases':'筛选公开案例'} placeholder={en?'Case name or country':'案件名称或国家'} value={query} onChange={e=>setQuery(e.target.value)}/></div>
 <div className={styles.picker}>{filtered.map(c=><label key={c.caseId} className={styles.choice}><input type="checkbox" checked={selected.includes(c.caseId)} disabled={!selected.includes(c.caseId)&&selected.length>=4} onChange={e=>setSelected(prev=>e.target.checked?[...prev,c.caseId]:prev.filter(id=>id!==c.caseId))}/><span>{c.title}<small>{countryName(c.country,locale)} · {c.reportDate}</small></span></label>)}</div>
 <div className={styles.toolbar}><button disabled={selected.length<2||selected.length>4} onClick={capture}>{en?'Create comparison snapshot':'生成比较快照'} ({selected.length}/4)</button><button onClick={()=>{setSelected([]);setBrief(null);setError('');}}>{en?'Clear this page':'清除此页'}</button><label className={styles.file}>{en?'Open exported JSON snapshot':'打开已导出的 JSON 快照'}<input type="file" accept="application/json,.json" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value='';}}/></label></div>
 {error&&<p className={styles.message} role="alert">{error}</p>}
 {brief&&<><p className={styles.note}>{en?'The comparison below is frozen. Changing the selection does not change it until you create another snapshot. Imported files contain public source material supplied by their author; no signature authenticates them.':'以下内容已经固定。改变勾选项后，需再次生成才会更新比较。导入文件按提供者保存的内容展示，文件没有签名认证。'}</p><div className={styles.toolbar}><button onClick={()=>exportAs(false)}>{en?'Export handoff Markdown':'导出交接简报 Markdown'}</button><button onClick={()=>exportAs(true)}>{en?'Export restorable JSON snapshot':'导出可恢复 JSON 快照'}</button><span className={styles.note}>{en?'3 MB maximum; stored wherever you download the file.':'最大 3 MB；文件保存在你选择的下载位置。'}</span></div><ComparisonBriefView brief={brief}/></>}
 </main>;
}
