'use client';
import {useState} from 'react';
import Link from 'next/link';
import {resources} from '@/lib/corpus';
import {localizeResource} from '@/lib/i18n/content';
import {useI18n} from '@/components/i18n/LocaleProvider';
import {ResourceCard} from './EvidenceLayers';
import styles from './research.module.css';
export default function ResourceLibrary(){
 const {locale}=useI18n();const en=locale==='en';const [kind,setKind]=useState('all');
 const options=[['all','全部类型','All types'],['treaty','条约条文','Treaty provisions'],['interpretation','解释文件','Interpretations'],['un_mechanism','联合国机制','UN mechanisms'],['regional_mechanism','区域机制','Regional mechanisms'],['assistance','援助机构','Assistance']];
 const shown=resources.filter(r=>kind==='all'||r.type===kind);
 return <main className={styles.page} data-top="light"><span className={styles.eyebrow}>{en?'Conditions before conclusions':'先核对条件，再考虑使用'}</span><h1>{en?'International standards and resources':'国际标准、机制与援助资源'}</h1><p className={styles.intro}>{en?`${resources.length} source records support expression-case research. They are distinct from the historical case corpus and unverified web supplements. Agent checks are not team review. Treaty provisions are not automatically local law; assistance listings do not promise acceptance.`:`${resources.length} 条来源记录，供表达案件研究。与历史案例库、待核实网页补充分别展示。Agent 检查不等于团队人工审核；国际条文不是自动适用的当地法律，机构名录不承诺接案。`}</p><div className={styles.toolbar}><Link href="/cases">{en?'Case library':'案例库'}</Link><Link href="/compare">{en?'Compare cases':'多案比较'}</Link><label>{en?'Type':'类型'} <select aria-label={en?'Resource type':'资源类型'} value={kind} onChange={e=>setKind(e.target.value)}>{options.map(([id,zh,english])=><option value={id} key={id}>{en?english:zh}</option>)}</select></label></div><section className={styles.panel}>{shown.map(r=><ResourceCard key={r.resourceId} resource={localizeResource(r,locale)} locale={locale}/>)}</section></main>;
}
