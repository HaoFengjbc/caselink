'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, FileCheck2 } from 'lucide-react';
import type { NewCaseInput } from '@/lib/contracts';
import { isResultStale, readSession, saveInput } from '@/lib/session';
import {normalizeConfirmedGoal} from '@/lib/intake/analysis';
import { inputSummary, unknownSteps } from '@/lib/i18n/intake';
import { useI18n } from '@/components/i18n/LocaleProvider';
import { midSentence } from './StatementCard';
import FlowSteps from './FlowSteps';
import AdaptiveSummary from './AdaptiveSummary';
import PrivacyPreferences from './PrivacyPreferences';
import AnalysisSubmit from './AnalysisSubmit';
import styles from './intake.module.css';

export default function Review() {
  const router = useRouter();
  const { locale, t, L, copy } = useI18n();
  const r = t.review;
  const [input, setInput] = useState<NewCaseInput | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [stale, setStale] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  useEffect(() => {
    const session = readSession();
    // The adaptive flow confirms and submits from its own case statement; /review stays for the step-by-step form.
    // Classic and free-form views share the complete record, including intake.
    const normalized=session.input?normalizeConfirmedGoal(session.input):null;
    if(normalized&&normalized!==session.input)saveInput(normalized);
    setInput(normalized); setStale(isResultStale({...session,input:normalized})); setHasResult(!!session.result); setLoaded(true);
  }, [router]);
  if (!loaded) return <main className="page"><p className="muted">{r.loading}</p></main>;
  if (!input) return <main className="empty-state"><span className="empty-icon"><FileCheck2 size={30}/></span><h1>{r.emptyTitle}</h1><p className="muted">{r.emptyText}</p><Link href="/new" className="btn btn-primary">{r.emptyCta}<ArrowRight size={16}/></Link></main>;
  const summary = inputSummary(input, locale);
  const unknown = unknownSteps(input);
  const unknownCount = unknown.filter(Boolean).length;
  /** One editable blank in the case statement; unknown answers are marked rather than filled in. */
  const blank = (step: number, text: string, gap = unknown[step]) => <Link href={`/new?mode=classic&step=${step}`} className={gap ? styles.blankUnknown : styles.blank} aria-label={r.edit(copy.steps[step].short, text)}>{text}</Link>;
  const word = (text: string) => midSentence(text, locale);
  const knownActivities = input.background.activities.filter(a => a !== 'unknown');
  const activities = knownActivities.map(a => word(L.activities[a])).join(locale === 'en' ? ', ' : '、');
  const activitiesGap = locale === 'en' ? (input.background.activities.length ? 'not sure' : 'not filled in') : (input.background.activities.length ? '不清楚' : '未填写');
  const problems = input.currentProblems;
  const prior = input.priorActions;
  const personGap = input.background.personType === 'unknown';
  // Free text sits mid-sentence, so its own closing punctuation would double up.
  const priorText = summary[7]!.replace(/[。.!！?？\s]+$/u, '') || summary[7]!;
  const resourcesUnknown = input.resources.length === 0 || input.resources.includes('unknown');
  const statement = locale === 'en'
    ? <>The case is in {blank(0, summary[0]!)}. Stage: {blank(1, word(summary[1]!))}.
        {['unknown', 'other'].includes(input.background.personType) ? <> Identity: {blank(3, word(L.persons[input.background.personType]), personGap)}</> : <> The person is {/^[aeiou]/i.test(L.persons[input.background.personType]) ? 'an' : 'a'} {blank(3, word(L.persons[input.background.personType]), false)}</>}, {knownActivities.length ? <>in a case over {blank(3, activities, false)}</> : <>expression involved: {blank(3, activitiesGap, true)}</>}.
        {' '}Difficulties: {blank(2, word(summary[2]!))}. Top priority: {blank(4, word(summary[4]!))}.
        {' '}Support: {blank(6, word(summary[6]!))}; so far: {blank(7, prior.status === 'described' ? priorText : word(summary[7]!))}. On going public: {blank(8, word(summary[8]!))}.</>
    : <>案件发生在{blank(0, summary[0]!)}，程序阶段为{blank(1, summary[1]!)}。
        当事人身份为{blank(3, L.persons[input.background.personType], personGap)}，{activities ? <>与{blank(3, activities, false)}有关</> : <>相关表达活动{blank(3, activitiesGap, true)}</>}；
        {problems.includes('none') ? <>目前{blank(2, summary[2]!)}</> : problems.includes('unknown') ? <>目前的困难{blank(2, summary[2]!)}</> : <>目前面临{blank(2, summary[2]!)}</>}。
        {input.primaryGoal === 'unknown' ? <>眼下的目标{blank(4, summary[4]!)}</> : <>眼下最希望{blank(4, summary[4]!)}</>}。
        {resourcesUnknown ? <>可用支持{blank(6, summary[6]!)}</> : input.resources.includes('none') ? <>目前{blank(6, summary[6]!)}可用支持</> : <>可以依靠{blank(6, summary[6]!)}</>}，
        {prior.status === 'unknown' ? <>此前的行动{blank(7, summary[7]!)}</> : <>此前{blank(7, prior.status === 'described' ? priorText : summary[7]!)}</>}。
        对外公开方面，{blank(8, summary[8]!)}。</>;
  return <main data-top="dark" className={styles.reviewPage}>
    <div className={`${styles.flowTop} ${styles.flowTopDark}`}><Link href="/new?mode=classic&step=8" className={styles.backLink}><ArrowLeft size={15}/>{r.back}</Link><FlowSteps current={1}/><span className={styles.reviewComplete}><Check size={14}/>{r.complete}</span></div>
    <section className={styles.statementStage}>
      <h1 className={styles.statementTitle}>{r.title}</h1>
      {input.isExample && <div className={styles.exampleBannerDark}><span className="tag tag-accent">{t.q.fictional}</span>{copy.exampleNotice}</div>}
      {stale && <p className={styles.staleDark}>{r.stale}</p>}
      <p className={styles.statementText} lang={locale === 'en' ? 'en' : 'zh-CN'}>{statement}</p>
      <dl className={styles.statementExtras}>
        <div><dt>{r.extras.dates}</dt><dd>{blank(5, summary[5]!)}</dd></div>
        {input.background.description && <div><dt>{r.extras.background}</dt><dd>{input.background.description}</dd></div>}
        {input.resourceConstraints && <div><dt>{r.extras.constraints}</dt><dd>{input.resourceConstraints}</dd></div>}
        {prior.date && <div><dt>{r.extras.priorDate}</dt><dd>{prior.date}</dd></div>}
      </dl>
      <p className={styles.statementNote}>{unknownCount > 0 ? <><b>{r.gaps(unknownCount)}</b>{r.gapsTail}</> : r.allKnown}{r.clickToEdit}</p>
    </section>
    <section className={styles.submitStage}>
      {input.intake && <AdaptiveSummary input={input} locale={locale}/>}
      <PrivacyPreferences/>
      <AnalysisSubmit currentInput={input} prepare={() => { const confirmed = input.intake ? { ...input, intake: { ...input.intake, confirmed: true } } : input; saveInput(confirmed); return confirmed; }} hasResult={hasResult} stale={stale} editHref="/new?mode=classic" offerRule/>
      <p className={styles.submitFootnote}>{r.footnote[0]}<br/>{r.footnote[1]}</p>
    </section>
  </main>;
}
