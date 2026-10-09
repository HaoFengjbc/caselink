'use client';

import Link from 'next/link';
import {postWorkflow} from './workflow-request';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Globe2, Info, MessageSquareText, PencilLine, ShieldCheck, Sparkles, X } from 'lucide-react';
import { NewCaseInputSchema, type NewCaseInput, type IntakeRecord } from '@/lib/contracts';
import { IntakeResponseSchema, type IntakeResponse } from '@/lib/intake/contracts';
import { useI18n } from '@/components/i18n/LocaleProvider';
import { ADAPTIVE_VIEW_STORAGE_KEY, readPreferences, setPreferences, sessionInputVersion, readSession, saveInput, newDraft, inputKey, isResultStale, isStorageAvailable, registerSessionCleanup } from '@/lib/session';
import { adaptiveCopy } from './adaptive-copy';
import { changeIntake, confirmableIntake, mergeIntakeFacts, hasSourceQuote, intakeSourceKey, isUnitedKingdom, toClassicInput, withExpression, withIntake } from './adaptive-state';
import AdaptiveStatement from './AdaptiveStatement';
import AnalysisSubmit from './AnalysisSubmit';
import PrivacyPreferences from './PrivacyPreferences';
import styles from './adaptive.module.css';

type Draft = NewCaseInput & { intake: IntakeRecord };
type Expression = NonNullable<IntakeRecord['expression']>;
const EXPRESSION_ACTIVITIES = ['reporting', 'investigation_report', 'social_media', 'repost', 'other'] as const;
type View = { phase: number; response: IntakeResponse | null; sourceKey: string | null; locale: 'zh' | 'en' };
type StoredView = View & { version: 1; inputKey: string };
const VIEW_KEY = ADAPTIVE_VIEW_STORAGE_KEY;
let memoryView: StoredView | null = null;
registerSessionCleanup(() => { memoryView = null; });
function restoreView(input: NewCaseInput, locale: 'zh' | 'en'): View {
  const empty: View = { phase: input.intake?.confirmed ? 2 : 0, response: null, sourceKey: null, locale };
  try {
    const raw = readPreferences().refreshRecovery ? sessionStorage.getItem(VIEW_KEY) : null;
    if (raw) memoryView = JSON.parse(raw);
  } catch { /* The original draft has its own memory fallback. */ }
  const saved = memoryView;
  if (!saved || saved.version !== 1 || saved.inputKey !== inputKey(input)) return empty;
  const response = saved.response ? IntakeResponseSchema.safeParse(saved.response) : null;
  return { phase: Number.isInteger(saved.phase) ? Math.max(0, Math.min(2, saved.phase)) : 0, response: response?.success ? response.data : null, sourceKey: saved.sourceKey, locale: saved.locale === 'en' ? 'en' : 'zh' };
}
function persistView(input: NewCaseInput, view: View) {
  memoryView = { ...view, version: 1, inputKey: inputKey(input) };
  try { if (readPreferences().refreshRecovery) sessionStorage.setItem(VIEW_KEY, JSON.stringify(memoryView)); } catch { /* Keep in memory. */ }
}

export default function AdaptiveQuestionnaire() {
  const router = useRouter();
  const { locale, L, t } = useI18n();
  const c = adaptiveCopy[locale];
  const [input, setInput] = useState<Draft>(() => withIntake(newDraft()));
  const [view, setView] = useState<View>({ phase: 0, response: null, sourceKey: null, locale });
  const [loaded, setLoaded] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const inputRef = useRef(input);
  const viewRef = useRef(view);
  const localeRef = useRef(locale);
  const pending = useRef<{ token: string; controller: AbortController } | null>(null);
  const previousLocale = useRef(locale);
  const organizeIntent = useRef<{ key: string; requestId: string; inputVersion: number } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  localeRef.current = locale;

  useEffect(() => {
    const unregister = registerSessionCleanup(() => { pending.current?.controller.abort(); pending.current = null; });
    const current = readSession().input;
    const next = confirmableIntake(current ?? newDraft());
    const saved = current ? restoreView(current, localeRef.current) : { phase: 0, response: null, sourceKey: null, locale: localeRef.current };
    inputRef.current = next; viewRef.current = saved;
    setInput(next); setView(saved); setLoaded(true);
    saveInput(next); persistView(next, saved);
    return () => { unregister(); pending.current?.controller.abort(); pending.current = null; };
  }, []);
  useEffect(() => {
    if (previousLocale.current === locale) return;
    previousLocale.current = locale;
    setConsentOpen(false);
    if (pending.current) {
      pending.current.controller.abort(); pending.current = null; setBusy(false); setNotice(adaptiveCopy[locale].languageChanged);
    }
  }, [locale]);

  function commit(next: Draft, nextView: View = viewRef.current) {
    inputRef.current = next; viewRef.current = nextView;
    setInput(next); setView(nextView); saveInput(next); persistView(next, nextView);
  }
  function update(next: Draft) {
    if (pending.current) { pending.current.controller.abort(); pending.current = null; setBusy(false); }
    setConsentOpen(false); setNotice('');
    commit({ ...next, intake: { ...next.intake, confirmed: false } });
  }
  function updateRecord(changes: Partial<IntakeRecord>) { update(changeIntake(inputRef.current, changes)); }
  function go(phase: number) {
    if (analysisBusy) return;
    if (phase > 0 && !inputRef.current.country.trim()) { setNotice(c.countryError); return; }
    setConsentOpen(false); setNotice('');
    commit(inputRef.current, { ...viewRef.current, phase });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => heading.current?.focus({ preventScroll: true }), 0);
  }
  function cancel() {
    pending.current?.controller.abort(); pending.current = null; setBusy(false); setNotice(c.cancelled);
  }
  function requestConsent() {
    if (!inputRef.current.country.trim()) { setNotice(c.countryError); return; }
    setNotice(''); setConsentOpen(true);
  }
  async function organize() {
    if (pending.current) return;
    const capturedInput = { ...inputRef.current, country: inputRef.current.country.trim() };
    const parsed = NewCaseInputSchema.safeParse(capturedInput);
    if (!parsed.success) { setNotice(c.inputError); return; }
    const capturedKey = inputKey(inputRef.current);
    const capturedLocale = localeRef.current;
    const intentKey = `${capturedKey}:${capturedLocale}:${readPreferences().aiEnabled}`;
    if (organizeIntent.current?.key !== intentKey) organizeIntent.current = { key: intentKey, requestId: crypto.randomUUID(), inputVersion: sessionInputVersion() };
    const identity = organizeIntent.current;
    const token = crypto.randomUUID();
    const controller = new AbortController();
    pending.current = { token, controller };
    setConsentOpen(false); setNotice(''); setBusy(true);
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 35000);
    try {
      const { response, body } = await postWorkflow('/api/intake', { input: parsed.data, locale: capturedLocale, requestId: identity.requestId, inputVersion: identity.inputVersion, operation: 'initial', preferences: readPreferences(), ...(!readPreferences().aiEnabled ? { forceManual: true } : {}) }, controller.signal);
      if (pending.current?.token !== token || localeRef.current !== capturedLocale || inputKey(inputRef.current) !== capturedKey) return;
      if (!response.ok) {
        const known = typeof body.code === 'string' && t.serverErrors[body.code];
        setNotice(known || body.message || c.requestFailed); return;
      }
      const result = IntakeResponseSchema.safeParse(body);
      if (!result.success) { setNotice(c.invalidResponse); return; }
      const next = changeIntake(inputRef.current, { facts: result.data.mode === 'manual' ? inputRef.current.intake.facts : mergeIntakeFacts(inputRef.current.intake.facts,result.data.facts) });
      commit(next, { phase: 2, response: result.data, sourceKey: intakeSourceKey(next), locale: capturedLocale });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.setTimeout(() => heading.current?.focus(), 0);
    } catch {
      if (pending.current?.token === token) setNotice(timedOut ? c.timeout : c.requestFailed);
    } finally {
      window.clearTimeout(timeout);
      if (pending.current?.token === token) { pending.current = null; setBusy(false); }
    }
  }
  function answerQuestion(question: NonNullable<View['response']>['questions'][number], answer: string) {
    const answers = inputRef.current.intake.answers;
    const item = { questionId: question.id, question: question.title, answer, ...(question.anchorQuote ? {anchorQuote:question.anchorQuote} : {}) };
    if (!answers.some(existing=>existing.questionId===question.id) && answers.length>=40) {setNotice(c.answerLimit);return;}
    updateRecord({ answers: answers.some(existing => existing.questionId === question.id) ? answers.map(existing => existing.questionId === question.id ? item : existing) : [...answers, item] });
  }
  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => noticeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
  }
  /** Confirms the statement as reviewed and returns the record to analyze; null after explaining what is missing. */
  function prepareAnalysis(): NewCaseInput | null {
    const current = inputRef.current;
    if (busy) return null;
    if (!current.intake.narrative.trim()) { showNotice(c.needsNarrative); return null; }
    if (current.intake.facts.some(fact => !fact.text.trim())) { showNotice(c.emptyFact); return null; }
    if (current.primaryGoal === 'other' && !current.intake.goalText.trim()) { showNotice(c.missingGoal); return null; }
    if (current.intake.facts.some(fact => !hasSourceQuote(current.intake, fact.quote))) { showNotice(c.invalidQuote); return null; }
    const next = { ...confirmableIntake(current), country: current.country.trim(), intake: { ...current.intake, confirmed: true } };
    if (!NewCaseInputSchema.safeParse(next).success) { showNotice(c.inputError); return null; }
    setNotice(''); setConsentOpen(false);
    commit(next);
    return next;
  }

  if (!loaded) return <main className="page"><p>{c.loading}</p></main>;
  const record = input.intake;
  const uk = isUnitedKingdom(input.country);
  const rawChanged = !!view.response && view.sourceKey !== intakeSourceKey(input);
  const session = readSession();
  const resultReady = !!session.result && !isResultStale(session);
  const expression = record.expression;
  const pad = (n: number) => String(n).padStart(2, '0');
  const titles = [c.title, c.narrativeTitle, c.statementTitle];
  // A reopened record keeps the AI excerpts but not the earlier questions, so excerpts alone also count as organized.
  const organized = view.response ? view.response.mode === 'live_ai' : record.facts.length > 0;
  const intros = [c.intro, c.narrativeHint, organized ? c.statementIntro : c.manualIntro];
  const noticeBox = notice && <p ref={noticeRef} className={styles.notice} role="alert">{notice}</p>;
  const sendBox = consentOpen && <section className={styles.consent} role="region" aria-label={c.disclosureTitle}><ShieldCheck size={22}/><div><h3>{c.disclosureTitle}</h3><p>{c.disclosureText}</p>{record.facts.length > 0 && <p className={styles.small}>{c.replaceNotice}</p>}<div className="row"><button className="btn btn-primary" onClick={organize}>{c.send}<ArrowRight size={16}/></button><button className="btn btn-ghost" onClick={() => setConsentOpen(false)}>{c.notYet}</button></div></div></section>;
  const busyBox = busy && <div className={styles.busy} role="status"><span className="loading-ring"/><div><strong>{c.busy}</strong><p>{c.busyText}</p></div><button className="btn btn-ghost" onClick={cancel}><X size={16}/>{c.cancel}</button></div>;
  // On the statement screen the analysis is the main action, so organizing again is secondary.
  const organizeButton = <button className={`btn ${view.phase === 2 ? 'btn-ghost' : 'btn-accent'}`} disabled={busy || analysisBusy} onClick={requestConsent}><Sparkles size={16}/>{view.response ? c.reorganize : c.organize}</button>;
  /** Leaving for the step-by-step form keeps the person's own words, without the AI record. */
  const toClassic = () => { const next = toClassicInput(inputRef.current); saveInput(next); router.push('/new?mode=classic'); };

  return <main className={styles.page}>
    <div className={styles.top}><Link href="/" className={styles.back}><ArrowLeft size={15}/>{c.back}</Link><span><i/>{c.saved}</span></div>
    <header className={`${styles.header} ${view.phase === 2 ? styles.headerStatement : ''}`}>
      {view.phase === 2 ? <p className={styles.mode}><Sparkles size={14}/>{organized ? c.aiMode : c.manualMode}</p> : <p className={styles.eyebrow}>{c.label}</p>}
      <h1 ref={heading} tabIndex={-1}>{titles[view.phase]}</h1><p>{intros[view.phase]}</p>
    </header>
    <nav className={styles.steps} aria-label={c.label}>{c.phases.map((phase, index) => index < 3
      ? <button key={phase} disabled={analysisBusy} onClick={() => go(index)} aria-current={view.phase === index ? 'step' : undefined}><span>{pad(index + 1)}</span>{phase}<ArrowRight size={14}/></button>
      : <button key={phase} disabled={!resultReady || analysisBusy} onClick={() => router.push('/analysis')}><span>{pad(index + 1)}</span>{phase}</button>)}</nav>
    {!isStorageAvailable() && <p className="notice">{c.storage}</p>}
    <PrivacyPreferences onRestore={() => { const restored = readSession().input; if (restored) commit(withIntake(restored), { phase: 0, response: null, sourceKey: null, locale }); }}/>{view.phase < 2 && noticeBox}

    {view.phase === 0 && <section className={styles.location}>
      <div className={styles.locationIntro}><span className={styles.roundIcon}><Globe2 size={30}/></span><h2>{c.locationTitle}</h2><p>{c.locationText}</p><div className={styles.mapLines} aria-hidden="true"><i/><i/><i/><span>＋</span></div></div>
      <div className={styles.locationFields}><label className={styles.label} htmlFor="adaptive-country">{c.country}</label><input id="adaptive-country" className="field" maxLength={100} autoComplete="country-name" value={input.country === 'unknown' ? '' : input.country} placeholder={c.countryPlaceholder} onChange={event => { const country = event.target.value; update({ ...input, country, intake: { ...record, jurisdiction: isUnitedKingdom(country) && uk ? record.jurisdiction : 'unknown', confirmed: false } }); }}/><button className={`${styles.shortcut} ${input.country === 'unknown' ? styles.active : ''}`} onClick={() => update({ ...input, country: 'unknown', intake: { ...record, jurisdiction: 'unknown', confirmed: false } })}>{c.unknown}</button>
        {uk && <fieldset className={styles.fieldset}><legend>{c.jurisdiction}</legend><p>{c.jurisdictionText}</p><div className={styles.choiceGrid}>{Object.entries(c.jurisdictions).map(([key, text]) => <label key={key} className={record.jurisdiction === key ? styles.choiceSelected : styles.choice}><input type="radio" name="jurisdiction" value={key} checked={record.jurisdiction === key} onChange={() => updateRecord({ jurisdiction: key })}/><span>{text}</span></label>)}</div></fieldset>}
        <fieldset className={styles.fieldset}><legend>{c.kind}</legend><p>{c.kindHint}</p><div className={styles.chips}>{Object.entries(c.kinds).map(([key, text]) => <label key={key} className={record.caseKind === key ? styles.chipSelected : styles.chip}><input type="radio" name="case-kind" value={key} checked={record.caseKind === key} onChange={() => updateRecord({ caseKind: key as IntakeRecord['caseKind'] })}/>{text}</label>)}</div></fieldset>
        <fieldset className={styles.fieldset}><legend>{c.expression}</legend><p>{c.expressionHint}</p><div className={styles.chips}>{(Object.entries(c.expressions) as [Expression, string][]).map(([key, text]) => <label key={key} className={expression === key ? styles.chipSelected : styles.chip}><input type="radio" name="expression" value={key} checked={expression === key} onChange={() => update(withExpression(input, key))}/>{text}</label>)}</div>
          {expression === 'yes' && <div className={styles.subChoice}><p>{c.expressionActivities}</p><div className={styles.chips}>{EXPRESSION_ACTIVITIES.map(key => { const on = input.background.activities.includes(key); return <label key={key} className={on ? styles.chipSelected : styles.chip}><input type="checkbox" checked={on} onChange={() => update(withExpression(input, 'yes', on ? input.background.activities.filter(item => item !== key) : [...input.background.activities.filter(item => item !== 'unknown'), key]))}/>{L.activities[key]}</label>; })}</div></div>}
          {expression === 'no' && <div className={styles.scopeNote} role="note"><Info size={18}/><div><strong>{c.outOfScopeTitle}</strong><p>{c.outOfScopeText}</p></div></div>}
        </fieldset>
      </div>
    </section>}

    {view.phase === 1 && <>
      <div className={styles.aiHint}><ShieldCheck size={18}/><div><strong>{c.aiHintTitle}</strong><p>{c.aiHintText}</p></div><button type="button" className="text-link" onClick={() => { setPreferences({ aiEnabled: false }); toClassic(); }}>{c.noAi}<ArrowRight size={13}/></button></div>
      <section className={styles.storyLayout}>
      <div className={styles.storyMain}><label className={styles.label} htmlFor="adaptive-narrative"><MessageSquareText size={19}/>{c.narrative}</label><textarea id="adaptive-narrative" className={`field ${styles.narrative}`} maxLength={6000} value={record.narrative} placeholder={c.narrativePlaceholder} onChange={event => updateRecord({ narrative: event.target.value })}/><span className={styles.count}>{record.narrative.length} / 6000</span><label className={styles.label} htmlFor="adaptive-goal">{c.goalText}</label><textarea id="adaptive-goal" className="field" maxLength={800} rows={3} value={record.goalText} placeholder={c.goalPlaceholder} onChange={event => updateRecord({ goalText: event.target.value })}/><span className={styles.count}>{record.goalText.length} / 800</span><p className={styles.small}>{c.goalDefault}</p><label className={styles.label} htmlFor="adaptive-disclosure">{c.disclosure}</label><textarea id="adaptive-disclosure" className="field" maxLength={800} rows={3} value={record.disclosureDetails} placeholder={c.disclosurePlaceholder} onChange={event => updateRecord({ disclosureDetails: event.target.value })}/><span className={styles.count}>{record.disclosureDetails.length} / 800</span></div>
      <aside className={styles.preferences}><span className={styles.roundIcon}><PencilLine size={23}/></span><h3>{c.goal}</h3><p>{input.primaryGoal === 'other' || input.primaryGoal === 'unknown' && record.goalText.trim() ? record.goalText || c.unknown : L.goals[input.primaryGoal]}</p><details><summary>{c.goalShortcuts}</summary><label className={styles.label} htmlFor="adaptive-priority">{c.goalHint}</label><select id="adaptive-priority" className="field" value={input.primaryGoal} onChange={event => update({ ...input, primaryGoal: event.target.value as NewCaseInput['primaryGoal'] })}>{Object.entries(L.goals).filter(([value])=>value===input.primaryGoal||value==='other'||value==='lawyer'||value==='unknown'&&!record.goalText.trim()||record.caseKind==='criminal'||record.caseKind==='mixed').map(([value,label])=><option value={value} key={value}>{value==='other'?c.customGoal:label}</option>)}</select></details><label className={styles.label} htmlFor="adaptive-publicity">{c.publicity}</label><p>{c.publicityHint}</p><select id="adaptive-publicity" className="field" value={input.publicity} onChange={event => update({ ...input, publicity: event.target.value as NewCaseInput['publicity'] })}>{Object.entries(L.publicity).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><div className={styles.preferenceFoot}><ShieldCheck size={17}/>{c.ready}</div></aside>
      </section>
      {sendBox}{busyBox}
    </>}

    {view.phase === 2 && <>
      {rawChanged && <p className={styles.softNotice}>{c.changed}</p>}{view.response && view.locale !== locale && <p className={styles.softNotice}>{c.oldLanguage}</p>}
      <AdaptiveStatement input={input} response={view.response} locked={analysisBusy || busy} onChange={update} onRecord={updateRecord} onAnswer={answerQuestion} onGo={go} onNotice={showNotice}>
        <div className={styles.organizeRow}>{organizeButton}</div>
        {sendBox}{busyBox}
      </AdaptiveStatement>
      <section className={styles.submit} aria-label={c.submit}>
        {noticeBox}
        <AnalysisSubmit currentInput={input} prepare={prepareAnalysis} hasResult={!!session.result} stale={isResultStale(session)} submitLabel={c.submit} offerRule disabled={busy} onBusyChange={setAnalysisBusy}/>
        <p className={styles.submitNote}>{c.submitNote}</p>
        <p className={styles.footnote}>{c.footnote}</p>
      </section>
    </>}

    <div className={styles.actions}><button className="btn btn-ghost" disabled={view.phase === 0 || analysisBusy} onClick={() => go(view.phase - 1)}><ArrowLeft size={16}/>{c.prev}</button><div>{view.phase === 0 ? <button className="btn btn-primary" onClick={() => go(1)}>{c.next}<ArrowRight size={17}/></button> : view.phase === 1 ? <><button className="btn btn-ghost" disabled={busy} onClick={() => go(2)}>{c.manual}</button>{organizeButton}</> : null}</div></div>
    <p className={styles.classicLink}><button type="button" className="text-link" onClick={toClassic}>{c.classic}<ArrowRight size={12}/></button></p>
  </main>;
}
