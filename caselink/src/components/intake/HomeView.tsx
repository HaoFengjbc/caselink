'use client';

import Link from 'next/link';
import NewAnalysisButton from '@/components/intake/NewAnalysisButton';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import DemoPicker from './DemoPicker';
import StatementCard from './StatementCard';
import { useI18n } from '@/components/i18n/LocaleProvider';
import { cases, documents, evidence } from '@/lib/corpus';
import { countryName, localizeCase } from '@/lib/i18n/content';
import styles from './home.module.css';
import {materialsCopy} from '@/lib/i18n/materials';

export default function HomeView() {
  const { locale, t, L, copy } = useI18n();
  const h = t.home;
  const counts = [cases.length, documents.length, cases.reduce((n, c) => n + c.interventions.length, 0), evidence.length];
  const stats = counts.map((value, i) => ({ value, label: h.stats[i]! }));
  const list = locale === 'en' ? ', ' : '、';
  return <main data-top="dark" className={styles.home}>
    <section className={styles.hero}>
      <div className={styles.heroHead}>
        <div>
          <span className="eyebrow">{copy.home.eyebrow}</span>
          <h1>{h.heroLine1}<br/>{h.heroLine2}<span className={styles.heroFill}>{h.heroFill}</span>{h.heroEnd}</h1>
          <i className="bar"/>
        </div>
        <div className={styles.heroAside}>
          <p>{copy.home.description}</p>
          <div className={styles.heroActions}><NewAnalysisButton  className="btn btn-primary">{materialsCopy[locale].title}<ArrowRight size={17}/></NewAnalysisButton><Link href="/new?entry=manual" className="text-link">{materialsCopy[locale].manual}<ArrowRight size={15}/></Link><DemoPicker/><Link href="/history" className="text-link">{locale==='en'?'My analyses →':'我的分析 →'}</Link></div>
        </div>
      </div>
      <StatementCard stats={stats} caseCount={cases.length}/>
      <p className={styles.scope}>{copy.home.scope} · {h.scopeSuffix}</p>
    </section>

    <section id="approach" className={styles.approach}>
      <div className={styles.sectionTitle}><h2>{h.approachTitle[0]}<br/>{h.approachTitle[1]}</h2><i className="bar"/></div>
      <ol className={styles.steps}>{h.steps.map((step, i) => <li key={step.title}>
        <span className={styles.stepNumber}>{String(i + 1).padStart(2, '0')}<small>/ 03</small></span>
        <h3>{step.title}</h3><p>{step.text}</p><span className={styles.stepMeta}>{step.meta}</span>
      </li>)}</ol>
    </section>

    <section className={styles.library}>
      <div className={styles.libraryHead}><div className={styles.sectionTitle}><h2>{h.libraryTitle[0]}<br/>{h.libraryTitle[1]}</h2><i className="bar"/></div><p>{h.libraryIntro}</p><Link href="/cases" className="btn btn-small">{h.browseAll}<ArrowUpRight size={15}/></Link></div>
      <ol className={styles.caseIndex}>{cases.slice(0,6).map((raw, index) => { const record = localizeCase(raw, locale); return <li key={record.caseId}><Link href={`/cases/${record.caseId}`}>
        <span className={styles.caseNumber}>{String(index + 1).padStart(2, '0')}</span>
        <span className={styles.caseMain}><strong>{record.title}</strong><span className={styles.caseMeta}>{countryName(record.country, locale)} · {record.personTypes.map(type => L.persons[type]).join(list)} · {h.report(record.reportDate)}</span><span className={styles.caseSummary}>{record.summary}</span></span>
        <span className={styles.caseGo}>{h.seeEvidence}<ArrowUpRight size={18}/></span>
      </Link></li>; })}</ol>
      <p className={styles.libraryNote}>{h.libraryNote}</p>
    </section>

    <section className={styles.bottomCta}>
      <p className={styles.bottomStatement}>{h.bottom[0]}<span>{h.bottom[1]}</span>{h.bottom[2]}</p>
      <p className={styles.bottomSub}>{h.bottomSub}</p>
      <NewAnalysisButton  className="btn btn-primary">{materialsCopy[locale].title}<ArrowRight size={17}/></NewAnalysisButton>
    </section>
  </main>;
}
