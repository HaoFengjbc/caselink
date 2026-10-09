'use client';

import { useEffect, useState } from 'react';
import { DEMO_SCENARIOS, DEMO_SCENARIOS_EN } from '../../../data/demo/fixtures';
import { useI18n } from '@/components/i18n/LocaleProvider';
import { countryName } from '@/lib/i18n/content';
import styles from './home.module.css';

type Stat = { value: number; label: string };
/** Lower-cases the first letter of an English label used mid-sentence. */
export const midSentence = (text: string, locale: string) => locale === 'en' ? text.charAt(0).toLowerCase() + text.slice(1) : text;

/** Home hero card: a fill-in-the-blank case statement that cycles through the fictional examples. */
export default function StatementCard({ stats, caseCount }: { stats: Stat[]; caseCount: number }) {
  const { locale, t, L } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const scenarios = locale === 'en' ? DEMO_SCENARIOS_EN : DEMO_SCENARIOS;
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % scenarios.length), 4800);
    return () => window.clearInterval(timer);
  }, [paused, scenarios.length]);
  const input = scenarios[index]!.input;
  const fill = (text: string) => <span className={styles.fill}>{text}</span>;
  const person = midSentence(L.persons[input.background.personType], locale);
  const activity = midSentence(L.activities[input.background.activities[0] ?? 'unknown'], locale);
  const stage = midSentence(L.stages[input.stage], locale);
  const goal = midSentence(L.goals[input.primaryGoal], locale);
  const country = countryName(input.country, locale);
  return <div className={styles.statementCard} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    <div className={styles.cardTop}>
      <span className="number">{String(index + 1).padStart(2, '0')}/{String(scenarios.length).padStart(2, '0')}</span>
      <div className={styles.toggle} role="group" aria-label={t.statement.toggle}>
        {scenarios.map((item, i) => <button key={item.id} aria-pressed={i === index} onClick={() => { setIndex(i); setPaused(true); }}>{L.persons[item.input.background.personType]} · {countryName(item.input.country, locale)}</button>)}
      </div>
      <span className={styles.fictional}>{t.statement.fictional}</span>
    </div>
    {locale === 'en'
      ? <p className={styles.statement} key={`en-${index}`}>A {fill(person)} in {fill(country)}, in a case over {fill(activity)}. Stage: {fill(stage)}. Top priority: {fill(goal)}.</p>
      : <p className={styles.statement} key={`zh-${index}`}>一名{fill(person)}在{fill(country)}因{fill(activity)}处于{fill(stage)}阶段，眼下最希望{fill(goal)}。</p>}
    <p className={styles.statementNext}>{t.statement.next(caseCount)}</p>
    <dl className={styles.stats}>{stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd className="number">{stat.value}</dd></div>)}</dl>
  </div>;
}
