'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, X } from 'lucide-react';
import { AnalysisResultSchema, NewCaseInputSchema, type NewCaseInput } from '@/lib/contracts';
import { inputKey, saveResult, sessionGeneration, registerSessionCleanup } from '@/lib/session';
import { cases } from '@/lib/corpus';
import { retrieveCases } from '@/lib/retrieval/match';
import { retrieveNarrativeCandidates } from '@/lib/retrieval/candidates';
import { countryName, localizeCase } from '@/lib/i18n/content';
import { useI18n } from '@/components/i18n/LocaleProvider';
import styles from './intake.module.css';

type Capabilities = { mode: 'demo' | 'live'; liveAvailable: boolean; configured: boolean };
type Failure = { code: string; message: string };
const recoverableCodes = new Set(['TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMITED', 'UPSTREAM_ERROR', 'INTERNAL_ERROR']);

/**
 * Submits a confirmed case for analysis: one request at a time, cancel, one retry and an explicit rule-only choice.
 * `prepare` returns the input to send, or null after showing its own validation message.
 * Shared by /review (step-by-step form) and the adaptive case statement.
 */
export default function AnalysisSubmit({ prepare, hasResult, stale, editHref, submitLabel, offerRule = false, disabled = false, onBusyChange }: {
  prepare: () => NewCaseInput | null;
  hasResult: boolean;
  stale: boolean;
  /** Where to edit the case after a failure; omitted when the case is already on the same page. */
  editHref?: string;
  submitLabel?: string;
  /** Keep the no-AI rule reference visible even when live AI is ready. */
  offerRule?: boolean;
  /** Another request on the page (such as AI organizing) must finish first. */
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const r = t.review;
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [capabilityFailed, setCapabilityFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastForcedRule, setLastForcedRule] = useState(false);
  const [submitted, setSubmitted] = useState<NewCaseInput | null>(null);
  const pending = useRef<{ token: string; controller: AbortController } | null>(null);
  const intent = useRef<{ key: string; requestId: string; attempts: number } | null>(null);
  const busyListener = useRef(onBusyChange);
  busyListener.current = onBusyChange;
  /** Server messages are written in Chinese; in English show the matching English text for the code. */
  const serverMessage = (code: string | undefined, message: string | undefined, fallback: string) => (code && t.serverErrors[code]) || message || fallback;
  useEffect(() => {
    const controller = new AbortController();
    const unregister = registerSessionCleanup(() => { pending.current?.controller.abort(); pending.current = null; });
    fetch('/api/capabilities', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('capabilities');
      setCapabilities(await response.json());
    }).catch(error => { if (error.name !== 'AbortError') setCapabilityFailed(true); });
    return () => { unregister(); controller.abort(); pending.current?.controller.abort(); pending.current = null; };
  }, []);
  useEffect(() => { busyListener.current?.(busy); }, [busy]);
  function cancel() {
    pending.current?.controller.abort(); pending.current = null; intent.current = null; setAttemptCount(0); setBusy(false);
    setFailure({ code: 'CANCELLED', message: t.clientErrors.CANCELLED });
  }
  async function analyze(forceRule = false) {
    // Synchronous guard prevents even same-tick double clicks from starting a second paid request.
    if (pending.current || disabled) return;
    const input = prepare();
    if (!input) return;
    if (input.intake && !input.intake.confirmed) { setFailure({ code: 'INVALID_INPUT', message: locale === 'en' ? 'Review and confirm the updated case record first.' : '请先返回核对并确认修改后的案情记录。' }); return; }
    if (input.priorActions.status === 'described' && !input.priorActions.description.trim()) { setFailure({ code: 'INVALID_INPUT', message: t.q.errPrior }); return; }
    const parsed = NewCaseInputSchema.safeParse(input);
    if (!parsed.success) { setFailure({ code: 'INVALID_INPUT', message: t.clientErrors.INCOMPLETE_CASE }); return; }
    const capturedKey = inputKey(input);
    const capturedGeneration = sessionGeneration();
    const intentKey = `${capturedKey}:${forceRule ? 'rule' : 'default'}:${locale}`;
    if (intent.current?.key !== intentKey) intent.current = { key: intentKey, requestId: crypto.randomUUID(), attempts: 0 };
    if (intent.current.attempts >= 2) return;
    intent.current.attempts += 1;
    const requestId = intent.current.requestId;
    setAttemptCount(intent.current.attempts); setLastForcedRule(forceRule); setSubmitted(parsed.data);
    const token = crypto.randomUUID();
    const controller = new AbortController();
    pending.current = { token, controller };
    setBusy(true); setFailure(null);
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 290000);
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: controller.signal, body: JSON.stringify({ input: parsed.data, requestId, ...(forceRule ? { forceRule: true } : {}), ...(locale === 'zh' ? {} : { locale }) }) });
      const body = await response.json();
      if (pending.current?.token !== token) return;
      if (!response.ok) {
        setFailure({ code: body.code || 'REQUEST_ERROR', message: serverMessage(body.code, body.message, t.clientErrors.REQUEST_ERROR) }); return;
      }
      const result = AnalysisResultSchema.safeParse(body);
      if (!result.success) { setFailure({ code: 'INVALID_OUTPUT', message: t.clientErrors.INVALID_OUTPUT }); return; }
      if (!saveResult(result.data, capturedKey, capturedGeneration)) { setFailure({ code: 'STALE_RESPONSE', message: t.clientErrors.STALE_RESPONSE }); return; }
      router.push('/analysis');
    } catch (error) {
      if (pending.current?.token !== token) return;
      if (timedOut) setFailure({ code: 'TIMEOUT', message: t.clientErrors.TIMEOUT });
      else if (!(error instanceof DOMException && error.name === 'AbortError')) setFailure({ code: 'NETWORK_ERROR', message: t.clientErrors.NETWORK_ERROR });
    } finally {
      window.clearTimeout(timeout);
      if (pending.current?.token === token) { pending.current = null; setBusy(false); }
    }
  }
  const canRetry = !!failure && recoverableCodes.has(failure.code) && attemptCount < 2;
  const ruleOnly = lastForcedRule || capabilities?.mode === 'demo';
  const showRule = !lastForcedRule && (failure || !capabilities || capabilities.mode === 'live' && (!capabilities.configured || offerRule));
  // Staged loading: the reviewed library answers instantly, so its candidates are shown while the AI analysis runs.
  const preview = useMemo(() => {
    if (!busy || ruleOnly || !submitted || submitted.intake?.expression === 'no') return [];
    return (submitted.intake?.confirmed ? retrieveNarrativeCandidates(submitted, cases, locale) : retrieveCases(submitted, cases, locale)).slice(0, 3);
  }, [busy, ruleOnly, submitted, locale]);
  return <>
    <div className={styles.modeNotice}>
      <span className={styles.savedDot}/><div><strong>{capabilities?.mode === 'live' ? capabilities.configured ? r.mode.liveReady : r.mode.liveIncomplete : capabilities ? r.mode.demo : capabilityFailed ? r.mode.failed : r.mode.checking}</strong><p>{capabilities?.mode === 'live' ? r.mode.liveText : capabilities ? r.mode.demoText : r.mode.unknownText}</p></div>
    </div>
    {failure && <div className={styles.failureBox} role="alert"><strong>{failure.code === 'CANCELLED' ? r.cancelled : r.failed}</strong><p>{failure.message}</p>{attemptCount >= 2 && <p>{r.retried}</p>}{editHref && <Link href={editHref} className="text-link">{r.editCase}<ArrowRight size={14}/></Link>}</div>}
    {busy ? <div className={styles.busyBox} role="status">{!ruleOnly && <div className={styles.busyStages}>{r.busyStages.map(s => <span key={s}>{s}</span>)}</div>}<span className={styles.busyBar}><i/></span><strong>{ruleOnly ? t.web.ruleBusy : r.busyTitle}</strong><p>{ruleOnly ? t.web.ruleBusyText : r.busyText}</p><button className="text-link" onClick={cancel}><X size={14}/>{r.cancel}</button>
      {preview.length > 0 && <section className={styles.waitPreview} aria-label={r.previewTitle}><h3>{r.previewTitle}</h3><p>{r.previewNote}</p><ol>{preview.map(match => { const item = localizeCase(match.record, locale); return <li key={item.caseId}><a href={`/cases/${item.caseId}`} target="_blank" rel="noopener">{item.title}<ArrowUpRight size={14}/></a><div className={styles.waitMeta}><span className="tag">{countryName(item.country, locale)}</span><span className="tag tag-accent">{match.comparison.relevance === 'comparable' ? t.analysis.comparable : t.analysis.related}</span><span className={styles.waitTier}>{r.previewTier}</span></div><p>{item.summary}</p></li>; })}</ol></section>}
    </div> : <>
      {(!failure || canRetry || failure.code === 'CANCELLED') && <button className={`btn btn-primary ${styles.submitButton}`} disabled={disabled} onClick={() => analyze(failure ? lastForcedRule : false)}>{canRetry ? r.retry : failure?.code === 'CANCELLED' ? r.restart : submitLabel ?? r.submit}<ArrowRight size={17}/></button>}
      {showRule && <button className={styles.ruleButton} disabled={disabled} onClick={() => analyze(true)}>{r.rule}<ArrowRight size={14}/></button>}
      {hasResult && !stale && <Link href="/analysis" className={styles.existingResult}>{r.existing}</Link>}
    </>}
  </>;
}
