'use client';

import Link from 'next/link';
import {postWorkflow} from './workflow-request';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, X } from 'lucide-react';
import { AnalysisResultSchema, NewCaseInputSchema, type NewCaseInput } from '@/lib/contracts';
import { inputKey, saveResult, sessionGeneration, registerSessionCleanup, readPreferences, sessionInputVersion } from '@/lib/session';
import type { DomainAssessment, ResearchOperation } from '@/lib/workflow-contracts';
import { cases } from '@/lib/corpus';
import { retrieveCases } from '@/lib/retrieval/match';
import { retrieveNarrativeCandidates } from '@/lib/retrieval/candidates';
import { countryName, localizeCase } from '@/lib/i18n/content';
import { useI18n } from '@/components/i18n/LocaleProvider';
import styles from './intake.module.css';
import {submissionIdentity,activeFailure,mayRetry} from './submission-state';

type Capabilities = { mode: 'demo' | 'live'; liveAvailable: boolean; configured: boolean; controlledSearchConfigured?: boolean; webSearchAvailable?: boolean; progressEvents?: boolean };
type Failure = { code: string; message: string; retryable?: boolean; retryAfterSeconds?: number; domain?: DomainAssessment };

/**
 * Submits a confirmed case for analysis: one request at a time, cancel, explicit retries and an explicit rule-only choice.
 * `prepare` returns the input to send, or null after showing its own validation message.
 * Shared by /review (step-by-step form) and the adaptive case statement.
 */
export default function AnalysisSubmit({ prepare, currentInput, operation = 'initial', parentAnalysisId, hasResult, stale, editHref, submitLabel, offerRule = false, disabled = false, onBusyChange }: {
  currentInput: NewCaseInput;
  operation?: ResearchOperation;
  parentAnalysisId?: string;
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
  const [failureRecord, setFailureRecord] = useState<(Failure & { inputIdentity: string }) | null>(null);
  const failure = activeFailure(failureRecord, currentInput);
  const setFailure = (value: Failure | null) => setFailureRecord(value ? { ...value, inputIdentity: submissionIdentity(currentInput) } : null);
  const [lastForcedRule, setLastForcedRule] = useState(false);
  const [submitted, setSubmitted] = useState<NewCaseInput | null>(null);
  const pending = useRef<{ token: string; controller: AbortController } | null>(null);
  const intent = useRef<{ key: string; requestId: string; inputVersion: number } | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const sourceKey = submissionIdentity(currentInput);
  useEffect(() => { setFailure(null); setRetryAt(0); intent.current = null; }, [sourceKey, operation, parentAnalysisId]);
  useEffect(() => { if (!retryAt) return; const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, [retryAt]);
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
    pending.current?.controller.abort(); pending.current = null; intent.current = null; setBusy(false);
    setFailure({ code: 'CANCELLED', message: t.clientErrors.CANCELLED });
  }
  async function analyze(forceRule = false) {
    // Synchronous guard prevents even same-tick double clicks from starting a second paid request.
    if (pending.current || disabled || !forceRule && readPreferences().aiEnabled && Date.now() < retryAt) return;
    forceRule = forceRule || !readPreferences().aiEnabled;
    const input = prepare();
    if (!input) return;
    if (input.intake && !input.intake.confirmed) { setFailure({ code: 'INVALID_INPUT', message: locale === 'en' ? 'Review and confirm the updated case record first.' : '请先返回核对并确认修改后的案情记录。' }); return; }
    if (input.priorActions.status === 'described' && !input.priorActions.description.trim()) { setFailure({ code: 'INVALID_INPUT', message: t.q.errPrior }); return; }
    const parsed = NewCaseInputSchema.safeParse(input);
    if (!parsed.success) { setFailure({ code: 'INVALID_INPUT', message: t.clientErrors.INCOMPLETE_CASE }); return; }
    const capturedKey = inputKey(input);
    const capturedGeneration = sessionGeneration();
    const intentKey = `${capturedKey}:${forceRule ? 'rule' : 'default'}:${locale}:${operation}:${parentAnalysisId ?? ''}`;
    if (intent.current?.key !== intentKey) intent.current = { key: intentKey, requestId: crypto.randomUUID(), inputVersion: sessionInputVersion() };
    const requestId = intent.current.requestId; const inputVersion = intent.current.inputVersion;
    setLastForcedRule(forceRule); setSubmitted(parsed.data);
    const token = crypto.randomUUID();
    const controller = new AbortController();
    pending.current = { token, controller };
    setBusy(true); setFailure(null);
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 290000);
    try {
      const { response, body } = await postWorkflow('/api/analyze', { input: parsed.data, requestId, inputVersion, operation, ...(parentAnalysisId ? { parentAnalysisId } : {}), preferences: readPreferences(), ...(forceRule ? { forceRule: true } : {}), ...(locale === 'zh' ? {} : { locale }) }, controller.signal);
      if (pending.current?.token !== token) return;
      if (!response.ok) {
        setFailure({ code: body.code || 'REQUEST_ERROR', message: serverMessage(body.code, body.message, t.clientErrors.REQUEST_ERROR), retryable: body.retryable, retryAfterSeconds: body.retryAfterSeconds, domain: body.domain });
        if (Number.isFinite(body.retryAfterSeconds)) setRetryAt(Date.now() + body.retryAfterSeconds * 1000); return;
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
  const canRetry = mayRetry(failure);
  const ruleOnly = lastForcedRule || capabilities?.mode === 'demo';
  const showRule = !lastForcedRule && (failure || !capabilities || capabilities.mode === 'live' && (!capabilities.configured || offerRule));
  // Staged loading: the reviewed library answers instantly, so its candidates are shown while the AI analysis runs.
  const preview = useMemo(() => {
    if (!busy || ruleOnly || !submitted || submitted.intake?.expression === 'no') return [];
    return (submitted.intake?.confirmed ? retrieveNarrativeCandidates(submitted, cases, locale) : retrieveCases(submitted, cases, locale)).slice(0, 3);
  }, [busy, ruleOnly, submitted, locale]);
  return <>
    <p className="muted">{locale === 'en' ? 'CaseLink does not cache case details or report results on the server. Reports are saved in your browser only when you choose to save them.' : 'CaseLink 不在服务端缓存案情或报告结果。只有你主动保存的报告才会进入浏览器历史。'}</p>
    <div className={styles.modeNotice}>
      <span className={styles.savedDot}/><div><strong>{capabilities?.mode === 'live' ? capabilities.liveAvailable ? r.mode.liveReady : r.mode.liveIncomplete : capabilities ? r.mode.demo : capabilityFailed ? r.mode.failed : r.mode.checking}</strong><p>{capabilities?.mode === 'live' ? r.mode.liveText : capabilities ? r.mode.demoText : r.mode.unknownText}</p></div>
    </div>
    {capabilities?.mode === 'live' && (capabilities.webSearchAvailable ?? capabilities.controlledSearchConfigured) === false && <p className="notice">{locale === 'en' ? 'Web search is unavailable or disabled. Analysis can still use the case corpus.' : '联网搜索不可用或已关闭，仍可使用正式案例库分析。'}</p>}
    {failure && <div className={styles.failureBox} role="alert"><strong>{failure.code === 'CANCELLED' ? r.cancelled : r.failed}</strong><p>{failure.message}</p>{failure.domain && <p>{failure.domain.reason} {failure.domain.clarification}<Link className="text-link" href="/resources">{locale === 'en' ? 'General resources and applicability' : '查看通用资源与适用条件'}</Link></p>}{retryAt > clock && <p>{locale === 'en' ? 'Retry available in ' : '可重试等待秒数：'}{Math.ceil((retryAt - clock) / 1000)}</p>}{editHref && <Link href={editHref} className="text-link">{r.editCase}<ArrowRight size={14}/></Link>}</div>}
    {busy ? <div className={styles.busyBox} role="status"><strong>{ruleOnly ? t.web.ruleBusy : r.busyTitle}</strong><p>{ruleOnly ? t.web.ruleBusyText : r.busyText}</p><button className="text-link" onClick={cancel}><X size={14}/>{r.cancel}</button>
      {preview.length > 0 && <section className={styles.waitPreview} aria-label={r.previewTitle}><h3>{r.previewTitle}</h3><p>{r.previewNote}</p><ol>{preview.map(match => { const item = localizeCase(match.record, locale); return <li key={item.caseId}><a href={`/cases/${item.caseId}`} target="_blank" rel="noopener">{item.title}<ArrowUpRight size={14}/></a><div className={styles.waitMeta}><span className="tag">{countryName(item.country, locale)}</span><span className="tag tag-accent">{match.comparison.relevance === 'comparable' ? t.analysis.comparable : t.analysis.related}</span><span className={styles.waitTier}>{r.previewTier}</span></div><p>{item.summary}</p></li>; })}</ol></section>}
    </div> : <>
      {(!failure || canRetry || failure.code === 'CANCELLED') && <button className={`btn btn-primary ${styles.submitButton}`} disabled={disabled || retryAt > clock} onClick={() => analyze(failure ? lastForcedRule : false)}>{canRetry ? r.retry : failure?.code === 'CANCELLED' ? r.restart : submitLabel ?? r.submit}<ArrowRight size={17}/></button>}
      {showRule && <button className={styles.ruleButton} disabled={disabled} onClick={() => analyze(true)}>{r.rule}<ArrowRight size={14}/></button>}
      {hasResult && !stale && <Link href="/analysis" className={styles.existingResult}>{r.existing}</Link>}
    </>}
  </>;
}
