import {ArrowUpRight} from 'lucide-react';
import type {WebSource} from '@/lib/research/contracts';
import {useI18n} from '@/components/i18n/LocaleProvider';
import {webSourceUrl,webSourcesFor} from './web-sources';
import styles from './results.module.css';

export default function WebCitations({ids,sources}:{ids:string[],sources:WebSource[]}){
  const {t}=useI18n();
  const resolved=webSourcesFor(ids,sources);
  if(!ids.length)return null;
  return <div className={styles.webCitations} aria-label={t.web.citations}>
    <span>{t.web.citations}</span>
    {resolved.map(source=>{const url=webSourceUrl(source);return url?<a key={source.sourceId} href={url} target="_blank" rel="noopener noreferrer" title={source.title}><b>{source.sourceId.replace('web-','')}</b><span>{source.title}</span><ArrowUpRight size={13}/></a>:<span key={source.sourceId}>{source.title} · {t.web.missingSource}</span>})}
    {resolved.length<new Set(ids).size&&<span>{t.web.missingSource}</span>}
  </div>;
}
