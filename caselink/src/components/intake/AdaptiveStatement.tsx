'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, PencilLine, RotateCcw, Trash2 } from 'lucide-react';
import type { NewCaseInput, IntakeRecord } from '@/lib/contracts';
import { INTAKE_SLOTS, type IntakeResponse, type IntakeSlot } from '@/lib/intake/contracts';
import { useI18n } from '@/components/i18n/LocaleProvider';
import { midSentence } from './StatementCard';
import { adaptiveCopy } from './adaptive-copy';
import { appendShortcutAnswer, hasSourceQuote, isUnitedKingdom, withExpression } from './adaptive-state';
import styles from './adaptive.module.css';

type Draft = NewCaseInput & { intake: IntakeRecord };
type Fact = IntakeRecord['facts'][number];
type Question = IntakeResponse['questions'][number];
/** What one phrase of the sheet stands for; facts, answers and gaps carry the id of their item. */
type Target = { kind: 'place' | 'kind' | 'expression' | 'narrative' | 'goal' | 'publicity' } | { kind: 'fact' | 'answer' | 'gap'; id: string };
type Tip = { key: string; label: string; text: string; warn?: string; left: number; top?: number; bottom?: number };
const keyOf = (target: Target) => 'id' in target ? `${target.kind}:${target.id}` : target.kind;
const pad = (n: number) => String(n).padStart(2, '0');
/** One line of free text without closing punctuation, shortened only when there is no summary to show instead. */
function phraseText(text: string, max: number) {
  const flat = text.replace(/\s*\n+\s*/g, ' / ').replace(/[。．.!！?？;；,，:：\s]+$/u, '').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/**
 * Screen ③: the AI's organization of the user's own words as a case sheet, one section per kind of point.
 * Red phrases are the AI's short summaries (or the user's choices) and open an editor; hovering shows the original words.
 * Amber dashed phrases are follow-up questions still unanswered and jump to their card below.
 */
export default function AdaptiveStatement({ input, response, locked, onChange, onRecord, onAnswer, onGo, onNotice, children }: {
  input: Draft;
  response: IntakeResponse | null;
  locked: boolean;
  onChange: (next: Draft) => void;
  onRecord: (changes: Partial<IntakeRecord>) => void;
  onAnswer: (question: Question, answer: string) => void;
  onGo: (phase: number) => void;
  onNotice: (text: string) => void;
  /** Rendered under the follow-up questions: the request-to-organize controls. */
  children?: ReactNode;
}) {
  const { locale, L } = useI18n();
  const c = adaptiveCopy[locale];
  const en = locale === 'en';
  const record = {...input.intake, facts:input.intake.facts.filter(fact=>!fact.materialItemId)};
  const [active, setActive] = useState<Target | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const activeKey = active ? keyOf(active) : null;
  useEffect(() => {
    if (!activeKey) return;
    const panel = editor.current;
    panel?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    panel?.querySelector<HTMLElement>('textarea, input, select, button')?.focus({ preventScroll: true });
  }, [activeKey]);
  useEffect(() => { if (locked) { setActive(null); setTip(null); } }, [locked]);
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, { passive: true }); window.addEventListener('resize', hide);
    return () => { window.removeEventListener('scroll', hide); window.removeEventListener('resize', hide); };
  }, [tip]);

  const questions = response?.questions ?? [];
  const answerOf = (id: string) => record.answers.find(answer => answer.questionId === id)?.answer ?? '';
  const answered = record.answers.filter(answer => answer.answer.trim());
  const gaps = questions.filter(question => !answerOf(question.id).trim());
  const uk = isUnitedKingdom(input.country);
  const jurisdictions = c.jurisdictions as Record<string, string>;
  const placeKnown = !!input.country.trim() && input.country !== 'unknown';
  const place = placeKnown ? `${input.country.trim()}${uk ? ` · ${jurisdictions[record.jurisdiction] ?? record.jurisdiction}` : ''}` : c.gap.place;
  const expression = record.expression ?? 'unsure';
  const activities = input.background.activities.filter(activity => activity !== 'unknown').map(activity => L.activities[activity]);
  const expressionText = expression === 'yes' && activities.length ? `${c.expressionPhrase.yes}${en ? ` (${activities.join(', ').toLowerCase()})` : `（${activities.join('、')}）`}` : c.expressionPhrase[expression];
  const customGoal = input.primaryGoal === 'other' && !!record.goalText.trim();
  const goalText = customGoal ? record.goalText.trim() : input.primaryGoal === 'unknown' ? '' : L.goals[input.primaryGoal];
  const sectioned = record.facts.some(fact => fact.slot);
  const factOf = (id: string) => record.facts.find(fact => fact.id === id);
  const original = (fact: Fact) => fact.summary ?? fact.quote;

  function open(target: Target) {
    if (locked) return;
    setTip(null);
    if (target.kind === 'gap') {
      const field = document.getElementById(`answer-${target.id}`);
      field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      field?.focus({ preventScroll: true });
      return;
    }
    setActive(current => current && keyOf(current) === keyOf(target) ? null : target);
  }
  /** Where a phrase comes from, shown beside it on hover or keyboard focus. */
  function sourceOf(target: Target): Omit<Tip, 'key' | 'left' | 'top' | 'bottom'> | null {
    if (target.kind === 'fact') {
      const fact = factOf(target.id);
      return fact ? { label: c.tip.quote, text: fact.quote, warn: hasSourceQuote(record, fact.quote) ? undefined : c.tip.brokenQuote } : null;
    }
    if (target.kind === 'answer') {
      const answer = record.answers.find(item => item.questionId === target.id);
      return answer ? { label: c.tip.answer, text: answer.question } : null;
    }
    if (target.kind === 'gap') {
      const question = questions.find(item => item.id === target.id);
      return question ? { label: c.tip.gap, text: question.reason } : null;
    }
    return null;
  }
  function showTip(target: Target, element: HTMLElement) {
    const source = sourceOf(target);
    if (!source) return;
    const rects = element.getClientRects();
    const rect = rects[rects.length - 1] ?? element.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const below = rect.bottom + 10;
    setTip({ key: keyOf(target), ...source, left, ...(below + 150 > window.innerHeight ? { bottom: window.innerHeight - rect.top + 10 } : { top: below }) });
  }
  /** A sheet phrase: a keyboard-operable inline control, so long text still wraps line by line. */
  function phrase(target: Target, text: string, tone: 'filled' | 'gap' | 'broken' = 'filled', mark?: string) {
    const key = keyOf(target);
    const className = [styles.phrase, tone === 'gap' ? styles.phraseGap : tone === 'broken' ? styles.phraseBroken : '', activeKey === key ? styles.phraseActive : ''].filter(Boolean).join(' ');
    return <span key={key} role="button" tabIndex={locked ? -1 : 0} aria-disabled={locked || undefined} aria-expanded={target.kind === 'gap' ? undefined : activeKey === key} aria-describedby={tip?.key === key ? 'sheet-tip' : undefined} className={className}
      onClick={() => open(target)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(target); } }}
      onMouseEnter={event => showTip(target, event.currentTarget)} onMouseLeave={() => setTip(null)} onFocus={event => showTip(target, event.currentTarget)} onBlur={() => setTip(null)}>{text}{mark && <sup className={styles.phraseMark}>{mark}</sup>}</span>;
  }
  const factPhrase = (fact: Fact) => phrase({ kind: 'fact', id: fact.id }, fact.text.trim() ? (fact.summary || fact.text !== fact.quote ? fact.text.trim() : phraseText(fact.text, en ? 140 : 56)) : c.gap.emptyFact,
    !fact.text.trim() || !hasSourceQuote(record, fact.quote) ? 'broken' : 'filled', fact.text !== original(fact) && fact.text !== fact.quote ? c.edited : undefined);
  const editButton = (target: Target) => <button type="button" className={styles.rowEdit} aria-expanded={activeKey === keyOf(target)} onClick={() => open(target)}><PencilLine size={13}/>{c.editRow}</button>;

  function editorBody(target: Target): ReactNode {
    switch (target.kind) {
      case 'place': return <button type="button" className="btn btn-ghost" onClick={() => onGo(0)}><ArrowLeft size={15}/>{c.editor.place}</button>;
      case 'kind': return <fieldset className={styles.fieldset}><legend>{c.kind}</legend><div className={styles.chips}>{Object.entries(c.kinds).map(([key, text]) => <label key={key} className={record.caseKind === key ? styles.chipSelected : styles.chip}><input type="radio" name="sheet-kind" value={key} checked={record.caseKind === key} onChange={() => onRecord({ caseKind: key as IntakeRecord['caseKind'] })}/>{text}</label>)}</div></fieldset>;
      case 'expression': return <fieldset className={styles.fieldset}><legend>{c.expression}</legend><div className={styles.chips}>{(Object.entries(c.expressions) as [NonNullable<IntakeRecord['expression']>, string][]).map(([key, text]) => <label key={key} className={expression === key ? styles.chipSelected : styles.chip}><input type="radio" name="sheet-expression" value={key} checked={expression === key} onChange={() => onChange(withExpression(input, key))}/>{text}</label>)}</div>{expression === 'no' && <p className={styles.small}>{c.outOfScopeText}</p>}</fieldset>;
      case 'narrative': return <button type="button" className="btn btn-ghost" onClick={() => onGo(1)}><ArrowLeft size={15}/>{c.editor.narrative}</button>;
      case 'goal': return <><label className={styles.label} htmlFor="sheet-goal">{c.editor.goal}</label><textarea id="sheet-goal" className="field" rows={3} maxLength={800} value={record.goalText} placeholder={c.goalPlaceholder} onChange={event => onRecord({ goalText: event.target.value })}/></>;
      case 'publicity': return <><label className={styles.label} htmlFor="sheet-publicity">{c.editor.publicity}</label><select id="sheet-publicity" className="field" value={input.publicity} onChange={event => onChange({ ...input, publicity: event.target.value as NewCaseInput['publicity'] })}>{Object.entries(L.publicity).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        <label className={styles.label} htmlFor="sheet-disclosure">{c.editor.disclosure}</label><textarea id="sheet-disclosure" className="field" rows={2} maxLength={800} value={record.disclosureDetails} placeholder={c.disclosurePlaceholder} onChange={event => onRecord({ disclosureDetails: event.target.value })}/></>;
      case 'fact': {
        const fact = factOf(target.id);
        if (!fact) return null;
        const set = (text: string) => onRecord({ facts: record.facts.map(item => item.id === fact.id ? { ...item, text } : item) });
        return <><label className={styles.label} htmlFor="sheet-fact">{c.editor.fact}</label><textarea id="sheet-fact" className="field" rows={2} maxLength={800} value={fact.text} onChange={event => set(event.target.value)}/>
          <blockquote className={styles.editorQuote}><span>{c.editor.quote}</span>{fact.quote}</blockquote>
          {!hasSourceQuote(record, fact.quote) && <p className={styles.editorWarn}>{c.tip.brokenQuote}</p>}
          <div className={styles.editorTools}>{fact.summary && fact.text !== fact.summary && <button type="button" className="text-link" onClick={() => set(fact.summary!)}><RotateCcw size={13}/>{c.editor.restoreSummary}</button>}{fact.text !== fact.quote && <button type="button" className="text-link" onClick={() => set(fact.quote)}><RotateCcw size={13}/>{c.editor.useQuote}</button>}<button type="button" className="text-link" onClick={() => { onRecord({ facts: record.facts.filter(item => item.id !== fact.id) }); setActive(null); }}><Trash2 size={13}/>{c.editor.remove}</button></div></>;
      }
      case 'answer': {
        const answer = record.answers.find(item => item.questionId === target.id);
        if (!answer) return null;
        return <><label className={styles.label} htmlFor="sheet-answer">{answer.question}</label><textarea id="sheet-answer" className="field" rows={3} maxLength={800} value={answer.answer} onChange={event => onRecord({ answers: record.answers.map(item => item.questionId === answer.questionId ? { ...item, answer: event.target.value } : item) })}/></>;
      }
      case 'gap': return null;
    }
  }
  /** The editor opens inside the section that holds the phrase being edited. */
  const editorFor = (targets: Target[]) => active && targets.some(target => keyOf(target) === activeKey) && <div ref={editor} className={styles.editor} role="group" aria-label={c.editor.title}>
    {editorBody(active)}
    <div className={styles.editorActions}><button type="button" className="btn btn-primary" onClick={() => setActive(null)}>{c.editor.done}</button></div>
  </div>;

  type Row = { key: string; label: string; body: ReactNode; targets: Target[]; edit?: Target };
  const rows: Row[] = [];
  const basics: Target[] = [{ kind: 'place' }, { kind: 'kind' }, { kind: 'expression' }];
  rows.push({ key: 'basics', label: c.sheet.basics, targets: basics, body: <p className={styles.inline}>
    {phrase(basics[0]!, place, placeKnown && !(uk && record.jurisdiction === 'unknown') ? 'filled' : 'gap')}<span className={styles.sep}>{en ? ', ' : '，'}</span>
    {phrase(basics[1]!, record.caseKind === 'unknown' ? c.gap.kind : (c.kinds as Record<string, string>)[record.caseKind]!, record.caseKind === 'unknown' ? 'gap' : 'filled')}<span className={styles.sep}>{en ? ', ' : '，'}</span>
    {phrase(basics[2]!, expressionText, expression === 'unsure' ? 'gap' : 'filled')}</p> });
  if (record.facts.length) {
    const sections: (IntakeSlot | 'points')[] = sectioned ? [...INTAKE_SLOTS] : ['points'];
    for (const section of sections) {
      const facts = section === 'points' ? record.facts : record.facts.filter(fact => (fact.slot ?? 'other') === section);
      if (!facts.length) continue;
      rows.push({ key: section, label: c.sheet[section], targets: facts.map(fact => ({ kind: 'fact', id: fact.id })), body: <ul className={`${styles.points} ${section === 'event' ? styles.timeline : ''}`}>{facts.map(fact => <li key={fact.id}>{factPhrase(fact)}</li>)}</ul> });
    }
  } else if(!record.materials) {
    const story = record.narrative.trim();
    rows.push({ key: 'account', label: c.sheet.account, targets: [{ kind: 'narrative' }], edit: { kind: 'narrative' }, body: story
      ? <><p className={`${styles.plain} ${storyOpen ? '' : styles.clamped}`}>{story}</p>{story.length > 160 && <button type="button" className={styles.more} onClick={() => setStoryOpen(open => !open)}>{storyOpen ? c.collapse : c.expand}<ChevronDown size={13}/></button>}</>
      : <p className={styles.inline}>{phrase({ kind: 'narrative' }, c.gap.narrative, 'gap')}</p> });
  }
  if (answered.length) rows.push({ key: 'answers', label: c.sheet.answers, targets: answered.map(answer => ({ kind: 'answer', id: answer.questionId })), body: <ul className={styles.points}>{answered.map(answer => <li key={answer.questionId}><span className={styles.question}>{answer.question}</span>{phrase({ kind: 'answer', id: answer.questionId }, phraseText(answer.answer, en ? 160 : 70))}</li>)}</ul> });
  rows.push({ key: 'goal', label: c.sheet.goal, targets: [{ kind: 'goal' }], edit: { kind: 'goal' }, body: goalText ? <p className={styles.plain}>{customGoal ? goalText : midSentence(goalText, locale)}</p> : <p className={styles.inline}>{phrase({ kind: 'goal' }, c.gap.goal, 'gap')}</p> });
  rows.push({ key: 'publicity', label: c.sheet.publicity, targets: [{ kind: 'publicity' }], edit: { kind: 'publicity' }, body: <>
    <p className={styles.inline}>{phrase({ kind: 'publicity' }, en ? midSentence(L.publicity[input.publicity], locale) : L.publicity[input.publicity], input.publicity === 'unknown' ? 'gap' : 'filled')}</p>
    {record.disclosureDetails.trim() && <p className={`${styles.plain} ${styles.note}`}>{record.disclosureDetails.trim()}</p>}</> });
  if (gaps.length) rows.push({ key: 'gaps', label: c.sheet.gaps, targets: [], body: <ul className={`${styles.points} ${styles.gapPoints}`}>{gaps.map(question => <li key={question.id}>{phrase({ kind: 'gap', id: question.id }, phraseText(question.title, en ? 160 : 70), 'gap')}</li>)}</ul> });

  return <>
    <section className={styles.stage} aria-label={c.statementTitle} inert={locked}>
      <div className={styles.sheet} lang={en ? 'en' : 'zh-CN'}>{rows.map((row, index) => <div key={row.key} className={styles.sheetRow}>
        <div className={styles.sheetLabel}><span>{pad(index + 1)}</span>{row.label}</div>
        <div className={styles.sheetBody}>{row.body}{row.edit && editButton(row.edit)}{editorFor(row.targets)}</div>
      </div>)}</div>
      {record.facts.length > 0 && record.narrative.trim() && <details className={styles.rawStory}><summary>{c.rawSummary}<ChevronDown size={14}/></summary><p>{record.narrative}</p></details>}
    </section>
    {tip && <div id="sheet-tip" role="tooltip" className={styles.tip} style={{ left: tip.left, top: tip.top, bottom: tip.bottom }}><strong>{tip.label}</strong><p>{tip.text}</p>{tip.warn && <p className={styles.tipWarn}>{tip.warn}</p>}</div>}

    <section className={styles.followups} aria-labelledby="followups-title" inert={locked}>
      <div className={styles.followupsHead}><h2 id="followups-title">{c.questions}</h2><p>{response?.mode === 'manual' ? c.manualQuestions : c.questionsNote}</p></div>
      {questions.length > 0 ? <div className={styles.followupGrid}>{questions.map((question, index) => {
        const value = answerOf(question.id);
        return <article className={styles.followup} key={question.id} data-answered={value.trim() ? 'true' : undefined}>
          <span className={styles.followupNumber}>{pad(index + 1)}</span>
          <h3>{question.title}</h3>
          <p className={styles.reason}>{c.reason} · {question.reason}</p>
          {question.anchorQuote && <details className={styles.anchor}><summary>{c.questionAnchor}<ChevronDown size={13}/></summary><blockquote>{question.anchorQuote}</blockquote></details>}
          {question.options.length > 0 && <div className={styles.quickAnswers}>{question.options.map(option => <button type="button" key={option} onClick={() => { const next = appendShortcutAnswer(value, option); if (next === null) { onNotice(c.answerFull); return; } onAnswer(question, next); }}>{option}</button>)}</div>}
          <label className="screen-reader" htmlFor={`answer-${question.id}`}>{c.answer} · {question.title}</label>
          <textarea id={`answer-${question.id}`} className="field" rows={3} maxLength={800} value={value} placeholder={c.answerPlaceholder} onChange={event => onAnswer(question, event.target.value)}/>
          {question.sourceIds.length > 0 && <div className={styles.sourceLinks}>{question.sourceIds.map(id => { const source = response?.sources.find(item => item.id === id); return source ? <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowRight size={12}/></a> : null; })}</div>}
        </article>;
      })}</div> : <p className={styles.small}>{response ? c.noQuestions : record.facts.length ? c.restored : c.notOrganized}</p>}
      {children}
      {(response?.sources.length ?? 0) > 0 && <details className={styles.references}><summary>{c.sources}<ChevronDown size={14}/></summary><p className={styles.small}>{c.sourceNote}</p>{response!.sources.map(source => <div key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowRight size={13}/></a><p>{source.scope}</p><small>{c.checked} {source.checkedAt}</small></div>)}</details>}
    </section>
  </>;
}
