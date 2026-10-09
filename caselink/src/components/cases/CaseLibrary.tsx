'use client';
import {useState} from 'react';
import Link from 'next/link';
import NewAnalysisButton from '@/components/intake/NewAnalysisButton';
import {ArrowRight,ArrowUpRight,ChevronDown,X} from 'lucide-react';
import {cases,documents,evidence} from '@/lib/corpus';
import {countryName,localizeCase} from '@/lib/i18n/content';
import {useI18n} from '@/components/i18n/LocaleProvider';
import styles from './cases.module.css';
const pad=(n:number)=>String(n).padStart(2,'0');
export default function CaseLibrary(){
 const {locale,t,L}=useI18n();const v=t.library;const list=locale==='en'?', ':'、';
 const [country,setCountry]=useState('all');const [person,setPerson]=useState('all');const [tag,setTag]=useState('all');const [query,setQuery]=useState('');
 const queryWords=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const filtered=cases.filter(c=>(country==='all'||c.country===country)&&(person==='all'||c.personTypes.some(p=>p===person))&&(tag==='all'||c.backgroundTags.some(t=>t===tag))&&queryWords.every(word=>[c.title,c.summary,localizeCase(c,'en').summary,c.country,countryName(c.country,'en')].join(' ').toLocaleLowerCase().includes(word)));
 const active=[country,person,tag].some(v=>v!=='all')||!!query.trim();
 const reset=()=>{setCountry('all');setPerson('all');setTag('all');setQuery('')};
 const lower=(s:string)=>locale==='en'?s.charAt(0).toLowerCase()+s.slice(1):s;
 return <main data-top="dark" className={styles.libraryPage}>
  <div className={styles.libraryInner}>
   <div className={styles.libraryHero}><div><h1>{v.title[0]}<br/>{v.title[1]}</h1><i className="bar"/></div><div className={styles.libraryIntro}><p>{v.intro[0]}<strong>{v.intro[1]}</strong>{v.intro[2]}</p><span className={styles.libraryCount}><b className="number">{pad(cases.length)}</b>{v.count(documents.length)}</span></div></div>
   <div className={styles.filters}>
    <label className={styles.librarySearch}><span className="screen-reader">{locale==='en'?'Search the reviewed library':'搜索已入库资料'}</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={locale==='en'?'Search case name or keywords':'搜索案件名称或关键词'}/></label>
    <span className={styles.filterTitle}>{v.filter}</span>
    <label className={styles.select}><span className="screen-reader">{v.country}</span><select aria-label={v.country} value={country} onChange={e=>setCountry(e.target.value)} data-active={country!=='all'}><option value="all">{v.allCountries}</option>{[...new Set(cases.map(c=>c.country))].map(c=><option key={c} value={c}>{countryName(c,locale)}</option>)}</select><ChevronDown size={15}/></label>
    <label className={styles.select}><span className="screen-reader">{v.person}</span><select aria-label={v.person} value={person} onChange={e=>setPerson(e.target.value)} data-active={person!=='all'}><option value="all">{v.allPersons}</option>{Object.entries(L.persons).filter(([k])=>k!=='unknown').map(([k,label])=><option value={k} key={k}>{label}</option>)}</select><ChevronDown size={15}/></label>
    <label className={styles.select}><span className="screen-reader">{v.tag}</span><select aria-label={v.tag} value={tag} onChange={e=>setTag(e.target.value)} data-active={tag!=='all'}><option value="all">{v.allTags}</option>{Object.entries(L.activities).filter(([k])=>!['unknown','other'].includes(k)).map(([k,label])=><option value={k} key={k}>{label}</option>)}</select><ChevronDown size={15}/></label>
    <span className={styles.filterCount}><b className="number">{filtered.length}</b> {locale==='en'?(filtered.length===1?'result':'results'):v.resultsWord}{active&&<button onClick={reset} aria-label={v.reset}><X size={13}/></button>}</span>
   </div>
   <div className={styles.caseList}>{filtered.map((raw,i)=>{const c=localizeCase(raw,locale);return <Link href={`/cases/${c.caseId}`} key={c.caseId} className={styles.caseCard}>
    <div className={styles.cardTop}><span className="number">{pad(i+1)}/{pad(filtered.length)}</span><span className={styles.cardTags}>{c.personTypes.map(p=>L.persons[p]).join(' · ')}</span>{c.conflicts.length>0?<span className={styles.conflictFlag}>{v.conflict}</span>:<span/>}</div>
    <h2>{c.title}</h2>
    <p className={styles.cardStatement}>{v.statement[0]}{locale==='en'?' ':''}<span>{countryName(c.country,locale)}</span>{v.statement[1]}{locale==='en'?' ':''}<span>{c.backgroundTags.map(t=>lower(L.activities[t])).join(list)}</span>{v.statement[2]}{locale==='en'?' ':''}<span>{c.problems.map(p=>lower(L.problems[p])).join(list)}</span>{v.statement[3]}</p>
    <p className={styles.cardSummary}>{c.summary}</p>
    <span className={styles.cardCta}>{v.open}<ArrowUpRight size={16}/></span>
    <dl className={styles.cardStats}>{[c.events.length,c.interventions.length,evidence.filter(e=>e.caseId===c.caseId).length].map((n,k)=><div key={k}><dt>{v.stats[k]}</dt><dd className="number">{n}</dd></div>)}<div><dt>{v.stats[3]}</dt><dd className="number">{c.reportDate}</dd></div></dl>
   </Link>})}</div>
   {!filtered.length&&<div className={styles.emptyFilter}><h3>{v.emptyTitle}</h3><p>{v.emptyText}</p><button className="btn" onClick={reset}>{v.clear}</button></div>}
   <div className={styles.libraryBottom}><span>{v.bottom}</span><NewAnalysisButton  className="btn btn-primary btn-small">{v.bottomCta}<ArrowRight size={15}/></NewAnalysisButton></div>
  </div>
 </main>
}
