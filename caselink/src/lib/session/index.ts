import { AnalysisResultSchema, EMPTY_INPUT, NewCaseInputSchema, CORPUS_VERSION, PROMPT_VERSION, type AnalysisResult, type NewCaseInput } from '../contracts';
import { archiveAnalysis } from './history';

const STORAGE_KEY = 'caselink.session.v1';
export const ADAPTIVE_VIEW_STORAGE_KEY = 'caselink.adaptive.view.v1';
export type SessionState = { version: 1; input: NewCaseInput | null; result: AnalysisResult | null; step: number; resultInputKey: string | null };
const empty = (): SessionState => ({ version: 1, input: null, result: null, step: 0, resultInputKey: null });
let memory: SessionState = empty();
let storageUnavailable = false;
let generation = 0;
export function sessionGeneration(): number { return generation; }
const cleanupCallbacks = new Set<() => void>();

/** Module-level draft caches remain clearable after their owning page unmounts. */
export function registerSessionCleanup(callback: () => void): () => void {
  cleanupCallbacks.add(callback);
  return () => { cleanupCallbacks.delete(callback); };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

/** All fields participate, including free text, dates, goal and publicity. Never put this key in a URL. */
export function inputKey(input: NewCaseInput): string { return JSON.stringify(canonical(input)); }

export function readSession(): SessionState {
  if (typeof window === 'undefined') return empty();
  if (storageUnavailable) return memory;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return memory;
    const stored = JSON.parse(raw);
    if (stored.version !== 1) return empty();
    // An unfinished country field is a valid local draft, but never a valid API submission.
    const draft = stored.input ? NewCaseInputSchema.safeParse({ ...stored.input, country: stored.input.country || 'unknown' }) : null;
    const result = AnalysisResultSchema.safeParse(stored.result);
    memory = {
      version: 1,
      input: draft?.success ? { ...draft.data, country: stored.input.country ?? '' } : null,
      result: result.success ? result.data : null,
      step: Number.isInteger(stored.step) ? Math.max(0, Math.min(8, stored.step)) : 0,
      resultInputKey: typeof stored.resultInputKey === 'string' ? stored.resultInputKey : null,
    };
    return memory;
  } catch { storageUnavailable = true; return memory; }
}

function persist(state: SessionState) {
  if (typeof window === 'undefined') return;
  memory = state;
  if (!storageUnavailable) {
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { storageUnavailable = true; }
  }
  window.dispatchEvent(new Event('caselink:session'));
}

export function saveInput(input: NewCaseInput, step?: number): void {
  const current = readSession();
  archiveCurrentSession(current);
  persist({ ...current, input, step: step === undefined ? current.step : Math.max(0, Math.min(8, step)) });
}
export function saveStep(step: number): void { persist({ ...readSession(), step: Math.max(0, Math.min(8, step)) }); }
/** Returns false when a cancelled/old response belongs to a draft that has since changed. */
export function saveResult(result: AnalysisResult, expectedInputKey?: string, expectedGeneration?: number): boolean {
  if (expectedGeneration !== undefined && expectedGeneration !== generation) return false;
  const current = readSession();
  if (!current.input) return false;
  const key = inputKey(current.input);
  if (expectedInputKey !== undefined && key !== expectedInputKey) return false;
  const parsed = AnalysisResultSchema.safeParse(result);
  if (!parsed.success) return false;
  archiveCurrentSession(current);
  persist({ ...current, result: parsed.data, resultInputKey: key });
  archiveAnalysis(current.input, parsed.data);
  return true;
}
export function isResultStale(state: SessionState = readSession()): boolean {
  return !!state.result && (!state.input || state.resultInputKey !== inputKey(state.input) || state.result.corpusVersion!==CORPUS_VERSION || state.result.promptVersion!==PROMPT_VERSION);
}
export function clearSession(): void {
  generation += 1;
  memory = empty();
  for (const cleanup of cleanupCallbacks) cleanup();
  if (typeof window === 'undefined') return;
  for (const key of [STORAGE_KEY, ADAPTIVE_VIEW_STORAGE_KEY]) {
    try { window.sessionStorage.removeItem(key); } catch { storageUnavailable = true; }
  }
  window.dispatchEvent(new Event('caselink:session'));
}
/** Migrate the legacy single result before any draft edits, demo load or reset. */
export function archiveCurrentSession(state: SessionState = readSession()): boolean {
  if (!state.result || !state.resultInputKey) return true;
  try {
    // The old key contains the exact original input. Never attach a later edited draft.
    const original = NewCaseInputSchema.safeParse(JSON.parse(state.resultInputKey));
    return original.success && archiveAnalysis(original.data, state.result);
  } catch { return false; }
}
export function startNewAnalysis(): void { archiveCurrentSession(); clearSession(); }
export function newDraft(): NewCaseInput { return structuredClone(EMPTY_INPUT); }
export function isStorageAvailable(): boolean { return !storageUnavailable; }
