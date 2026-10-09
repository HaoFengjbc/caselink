'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarDays, CornerDownLeft, Plus, RotateCcw, X } from 'lucide-react';
import { NewCaseInputSchema, type NewCaseInput } from '@/lib/contracts';
import { clearSession, isResultStale, isStorageAvailable, newDraft, readSession, saveInput } from '@/lib/session';
import { cases } from '@/lib/corpus';
import { countryKey, EN_CONTENT } from '@/lib/i18n/content';
import { inputSummary, unknownSteps } from '@/lib/i18n/intake';
import { useI18n } from '@/components/i18n/LocaleProvider';
import { DEMO_SCENARIOS, DEMO_SCENARIOS_EN } from '../../../data/demo/fixtures';
import Choices from './Choices';
import FlowSteps from './FlowSteps';
import { toClassicInput } from './adaptive-state';
import styles from './intake.module.css';

function toggle<T extends string>(items: T[], value: T): T[] {
  if (value === 'unknown' || value === 'none') return [value];
  const filtered = items.filter(item => item !== 'unknown' && item !== 'none');
  const next = filtered.includes(value) ? filtered.filter(item => item !== value) : [...filtered, value];
  return next.length ? next : ['unknown' as T];
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function Questionnaire() {
  const router = useRouter();
  const { locale, t, L, copy } = useI18n();
  const q = t.q;
  const [input, setInput] = useState<NewCaseInput>(newDraft);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [showClear, setShowClear] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [stale, setStale] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<() => void>(() => {});
  useEffect(() => {
    const session = readSession();
    const requested = new URLSearchParams(window.location.search).get('step');
    const requestedStep = requested !== null && /^\d$/.test(requested) ? Number(requested) : session.step;
    setStep(Math.max(0, Math.min(8, requestedStep)));
    // A draft started in the adaptive intake continues here without its AI record.
    const current = session.input ? toClassicInput(session.input) : newDraft();
    if (session.input && current !== session.input) saveInput(current);
    setInput(current);
    setStale(isResultStale(session));
    setLoaded(true);
  }, []);
  // Enter advances unless focus is on something that already handles Enter itself.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Enter' || event.isComposing || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement || target instanceof HTMLSelectElement) return;
      if (target instanceof HTMLInputElement && !['radio', 'checkbox'].includes(target.type) && target.id !== 'country') return;
      event.preventDefault(); nextRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  function update(next: NewCaseInput) { if(next.intake)next={...next,intake:{...next.intake,confirmed:false}};setInput(next); saveInput(next, step); setStale(isResultStale()); setError(''); }
  function go(next: number) {
    saveInput(input, next); setStep(next); setError(''); setShowExample(false);
    window.history.replaceState(null, '', '/new?mode=classic');
    window.scrollTo({ top: 0 });
    window.setTimeout(() => heading.current?.focus({ preventScroll: true }), 0);
  }
  function next() {
    if (step === 0 && !input.country.trim()) { setError(q.errCountry); return; }
    if ((step === 7 || step === 8) && input.priorActions.status === 'described' && !input.priorActions.description.trim()) { setError(q.errPrior); return; }
    if (step < 8) { go(step + 1); return; }
    if (!input.country.trim()) { setError(q.errCountryFinal); return; }
    const parsed = NewCaseInputSchema.safeParse({ ...input, country: input.country.trim() });
    if (!parsed.success) { setError(q.errInvalid); return; }
    saveInput(parsed.data, step); router.push('/review');
  }
  useEffect(() => { nextRef.current = next; });
  if (!loaded) return <main className="page"><p className="muted">{q.loading}</p></main>;
  const current = copy.steps[step];
  const summaries = inputSummary(input, locale);
  const unknown = unknownSteps(input);
  const phase = copy.phases.find(p => p.steps.includes(step));
  // Quick-pick countries are stored in the language they were picked in; match either spelling.
  const countryOptions = Object.fromEntries([...copy.countries.map(name => [name, name]), ['unknown', L.persons.unknown]]);
  const canonical = countryKey(input.country);
  const countryValue = input.country === 'unknown' ? 'unknown' : locale === 'en' ? EN_CONTENT.countries[canonical] ?? input.country : canonical;
  const countryHints = Object.fromEntries(copy.countries.map(name => [name, q.countryHint(cases.filter(c => c.country === countryKey(name)).length)]));
  const examples = (locale === 'en' ? DEMO_SCENARIOS_EN : DEMO_SCENARIOS).map(s => ({ title: s.title, answer: inputSummary(s.input, locale)[step] }));
  return <main className={styles.intakePage}>
    <div className={styles.flowTop}>
      <Link href="/" className={styles.backLink}><ArrowLeft size={15}/>{q.back}</Link>
      <FlowSteps current={0}/>
      <button className={styles.resetButton} onClick={() => setShowClear(!showClear)}><RotateCcw size={14}/>{q.reset}</button>
    </div>
    {showClear && <div className={styles.clearNotice}><span>{q.clearText}</span><button className="btn btn-small" onClick={() => setShowClear(false)}>{q.keep}</button><button className="btn btn-small btn-primary" onClick={() => { clearSession(); setInput(newDraft()); setStep(0); setStale(false); setShowClear(false); setError(''); }}>{q.confirmClear}</button></div>}
    {input.isExample && <div className={styles.exampleBanner}><span className="tag tag-accent">{q.fictional}</span>{copy.exampleNotice}</div>}
    {!isStorageAvailable() && <p className="notice">{q.storage}</p>}
    {stale && <p className={styles.staleNote}>{q.stale}</p>}

    <nav className={styles.stepNav} aria-label={q.nav}>
      <ol>{copy.steps.map((item, index) => {
        const state = index === step ? styles.navCurrent : unknown[index] ? styles.navUnknown : styles.navKnown;
        return <li key={index}><button onClick={() => go(index)} className={state} aria-current={index === step ? 'step' : undefined} title={`${item.short}: ${summaries[index]}`}><i/><span>{item.short}</span></button></li>;
      })}</ol>
    </nav>

    <section className={styles.questionStage} aria-labelledby="question-title">
      <div className={styles.counter} key={`c-${step}`}><b className="number">{pad(step + 1)}</b><span className="number">/ 09</span><small>{phase?.title} · {current.optional ? q.optional : q.required}</small></div>
      <h1 id="question-title" ref={heading} tabIndex={-1} key={`h-${step}-${locale}`} className={styles.question}>{current.title}</h1>

      {step === 0 ? <div className={styles.slot}>
        <label className="screen-reader" htmlFor="country">{q.countryLabel}</label>
        <input id="country" className={styles.slotInput} autoComplete="off" value={input.country === 'unknown' ? '' : input.country} placeholder={q.countryPlaceholder} maxLength={100} onChange={e => update({ ...input, country: e.target.value })} size={Math.max(8, (input.country === 'unknown' ? '' : input.country).length + 2)}/>
      </div> : <p className={`${styles.slot} ${unknown[step] ? styles.slotUnknown : ''}`} key={`s-${step}-${summaries[step]}`} aria-live="polite"><span className="screen-reader">{q.currentAnswer}</span><span className={styles.slotText}>{summaries[step]}</span></p>}

      <p className={styles.hint}>{current.hint}<button className={styles.exampleLink} onClick={() => setShowExample(!showExample)} aria-expanded={showExample}>{showExample ? q.hideExample : q.example}</button></p>
      {showExample && <div className={styles.examplePanel}>{examples.map(e => <p key={e.title}><span>{e.title}</span>{e.answer}</p>)}<button aria-label={q.hideExample} onClick={() => setShowExample(false)}><X size={15}/></button></div>}

      <div className={styles.answerArea} key={`a-${step}`}>
        {step === 0 && <Choices name={q.groups[0]!} options={countryOptions} value={countryValue} onChange={value => update({ ...input, country: value })} descriptions={countryHints} layout="compact" escapeHint={q.escape.country}/>}
        {step === 1 && <Choices name={q.groups[1]!} options={{ ...L.stages, pretrial: q.pretrialLong }} value={input.stage} onChange={value => update({ ...input, stage: value as NewCaseInput['stage'] })} descriptions={t.optionNotes.stage} layout="timeline" escapeHint={q.escape.stage} hotkeys/>}
        {step === 2 && <Choices name={q.groups[2]!} options={L.problems} value={input.currentProblems} multiple onChange={value => update({ ...input, currentProblems: toggle(input.currentProblems, value as NewCaseInput['currentProblems'][number]) })} escapeKeys={['none', 'unknown']} escapeHint={q.escape.problems} hotkeys/>}
        {step === 3 && <>
          <span className={styles.label}>{q.activities} <span>{q.activitiesNote}</span></span>
          <Choices name={q.groups[3]!} options={L.activities} value={input.background.activities} multiple layout="compact" onChange={value => update({ ...input, background: { ...input.background, activities: toggle(input.background.activities, value as NewCaseInput['background']['activities'][number]) } })}/>
          <span className={styles.label}>{q.person} <span>{q.personNote}</span></span>
          <Choices name={q.groups[4]!} options={L.persons} value={input.background.personType} layout="compact" onChange={value => update({ ...input, background: { ...input.background, personType: value as NewCaseInput['background']['personType'] } })}/>
          <label htmlFor="background" className={styles.label}>{q.background} <span>{q.optionalNote}</span></label>
          <textarea id="background" className="field" maxLength={800} rows={3} value={input.background.description} placeholder={q.backgroundPlaceholder} onChange={e => update({ ...input, background: { ...input.background, description: e.target.value } })}/>
          <span className={styles.charCount}>{input.background.description.length} / 800</span>
        </>}
        {step === 4 && <Choices name={q.groups[5]!} options={L.goals} value={input.primaryGoal} onChange={value => update({ ...input, primaryGoal: value as NewCaseInput['primaryGoal'] })} descriptions={t.optionNotes.goal} escapeHint={q.escape.goal} hotkeys/>}
        {step === 5 && <>
          {input.keyDates.length === 0 && <div className={styles.dateEmpty}><CalendarDays size={26}/><strong>{q.datesEmpty}</strong><p>{q.datesEmptyText}</p></div>}
          <div className={styles.dateList}>{input.keyDates.map((item, index) => <div className={styles.dateRow} key={index}>
            <span className={styles.dateIndex}>{pad(index + 1)}</span>
            <div className={styles.dateField}><label htmlFor={`date-${index}`}>{q.dateLabel}</label><input id={`date-${index}`} className="field" placeholder={q.datePlaceholder} maxLength={40} value={item.date} onChange={e => update({ ...input, keyDates: input.keyDates.map((value, i) => i === index ? { ...value, date: e.target.value } : value) })}/></div>
            <div className={styles.dateField}><label htmlFor={`event-${index}`}>{q.eventLabel}</label><input id={`event-${index}`} className="field" placeholder={q.eventPlaceholder} maxLength={120} value={item.event} onChange={e => update({ ...input, keyDates: input.keyDates.map((value, i) => i === index ? { ...value, event: e.target.value } : value) })}/></div>
            <label className={styles.switchLine}><input type="checkbox" checked={item.approximate} onChange={e => update({ ...input, keyDates: input.keyDates.map((value, i) => i === index ? { ...value, approximate: e.target.checked } : value) })}/><span className={styles.switch} aria-hidden="true"/>{q.approximate}</label>
            <button className={styles.iconButton} aria-label={q.removeDate(index + 1)} onClick={() => update({ ...input, keyDates: input.keyDates.filter((_, i) => i !== index) })}><X size={18}/></button>
          </div>)}</div>
          <div className={styles.dateActions}><button className={styles.addDate} disabled={input.keyDates.length >= 5} onClick={() => update({ ...input, keyDates: [...input.keyDates, { date: '', event: '', approximate: true }] })}><Plus size={18}/>{q.addDate}<small>{input.keyDates.length} / 5</small></button>{input.keyDates.length > 0 && <button className="text-link" onClick={() => update({ ...input, keyDates: [] })}>{q.skipDates}</button>}</div>
        </>}
        {step === 6 && <>
          <Choices name={q.groups[6]!} options={L.resources} value={input.resources} multiple onChange={value => update({ ...input, resources: toggle(input.resources, value as NewCaseInput['resources'][number]) })} escapeKeys={['none', 'unknown']} escapeHint={q.escape.resources} hotkeys/>
          <label htmlFor="constraints" className={styles.label}>{q.constraints} <span>{q.optionalNote}</span></label>
          <textarea id="constraints" className="field" rows={3} maxLength={800} value={input.resourceConstraints} placeholder={q.constraintsPlaceholder} onChange={e => update({ ...input, resourceConstraints: e.target.value })}/>
          <span className={styles.charCount}>{input.resourceConstraints.length} / 800</span>
        </>}
        {step === 7 && <>
          <Choices name={q.groups[7]!} options={copy.priorStatuses} value={input.priorActions.status} onChange={value => update({ ...input, priorActions: { ...input.priorActions, status: value as NewCaseInput['priorActions']['status'], ...(value !== 'described' ? { description: '', date: '' } : {}) } })} descriptions={t.optionNotes.prior} escapeHint={q.escape.prior} hotkeys/>
          {input.priorActions.status === 'described' && <div className={styles.revealPanel}>
            <label htmlFor="prior" className={styles.label}>{q.prior}</label>
            <textarea id="prior" className="field" rows={4} maxLength={800} value={input.priorActions.description} placeholder={q.priorPlaceholder} onChange={e => update({ ...input, priorActions: { ...input.priorActions, description: e.target.value } })}/>
            <span className={styles.charCount}>{input.priorActions.description.length} / 800</span>
            <label className={styles.label} htmlFor="prior-date">{q.priorDate} <span>{q.optionalNote}</span></label>
            <input id="prior-date" className="field" maxLength={40} value={input.priorActions.date} onChange={e => update({ ...input, priorActions: { ...input.priorActions, date: e.target.value } })} placeholder={q.priorDatePlaceholder}/>
          </div>}
        </>}
        {step === 8 && <Choices name={q.groups[8]!} options={L.publicity} value={input.publicity} onChange={value => update({ ...input, publicity: value as NewCaseInput['publicity'] })} descriptions={t.optionNotes.publicity} layout="spectrum" escapeHint={q.escape.publicity} hotkeys/>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>

    <div className={styles.actionBar}>
      <div className={styles.actionInner}>
        <button className="btn btn-ghost" disabled={step === 0} onClick={() => go(step - 1)}><ArrowLeft size={16}/>{q.prev}</button>
        <span className={styles.localNote}><i className={styles.savedDot}/>{q.localNote}</span>
        <span className={styles.actionRight}>
          {current.optional && <button className={styles.skipButton} onClick={() => go(step + 1)}>{q.skip}</button>}
          <button className={`btn ${step === 8 ? 'btn-accent' : 'btn-primary'}`} onClick={next}>{step === 8 ? q.confirm : q.next}<ArrowRight size={16}/></button>
          <span className={styles.enterHint} aria-hidden="true"><CornerDownLeft size={13}/>Enter</span>
        </span>
      </div>
    </div>
  </main>;
}
