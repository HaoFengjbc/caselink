import { AnalysisResultSchema, EMPTY_INPUT, NewCaseInputSchema, CORPUS_VERSION, PROMPT_VERSION, type AnalysisResult, type NewCaseInput } from '../contracts';
import { DEFAULT_PREFERENCES, UsePreferencesSchema, type UsePreferences } from '../workflow-contracts';
import { archiveAnalysis } from './history';

const LEGACY_KEY = 'caselink.session.v1';
const RECOVERY_KEY = 'caselink.recovery.v2';
const PREFERENCES_KEY = 'caselink.preferences.v2';
export const ADAPTIVE_VIEW_STORAGE_KEY = 'caselink.adaptive.view.v2';
export type SessionState = { version: 1; input: NewCaseInput | null; result: AnalysisResult | null; step: number; resultInputKey: string | null };
const empty = (): SessionState => ({ version: 1, input: null, result: null, step: 0, resultInputKey: null });
let memory: SessionState = empty();
let preferences: UsePreferences = { ...DEFAULT_PREFERENCES };
let initialized = false;
let storageUnavailable = false;
let generation = 0;
let inputVersion = 1;
export function sessionGeneration(): number { return generation; }
export function sessionInputVersion(): number { return inputVersion; }
const cleanupCallbacks = new Set<() => void>();
export function registerSessionCleanup(callback: () => void): () => void {
  cleanupCallbacks.add(callback); return () => { cleanupCallbacks.delete(callback); };
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
/** Contains private facts. Never put this key in a URL, telemetry or deletion marker. */
export function inputKey(input: NewCaseInput): string { return JSON.stringify(canonical(input)); }
function parseState(raw: string): SessionState | null {
  try {
    const stored = JSON.parse(raw); if (stored.version !== 1) return null;
    const draft = stored.input ? NewCaseInputSchema.safeParse({ ...stored.input, country: stored.input.country || 'unknown' }) : null;
    const result = AnalysisResultSchema.safeParse(stored.result);
    return { version: 1, input: draft?.success ? { ...draft.data, country: stored.input.country ?? '' } : null,
      result: result.success ? result.data : null, step: Number.isInteger(stored.step) ? Math.max(0, Math.min(8, stored.step)) : 0,
      resultInputKey: typeof stored.resultInputKey === 'string' ? stored.resultInputKey : null };
  } catch { return null; }
}
function initialize() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  try {
    const raw = window.sessionStorage.getItem(PREFERENCES_KEY);
    const parsed = raw ? UsePreferencesSchema.safeParse(JSON.parse(raw)) : null;
    if (parsed?.success && parsed.data.refreshRecovery && parsed.data.expiresAt && Date.parse(parsed.data.expiresAt) > Date.now()) {
      preferences = parsed.data;
      memory = parseState(window.sessionStorage.getItem(RECOVERY_KEY) ?? '') ?? empty();
    } else if (raw) clearRecovery();
    // v1 data belongs to the user. It is never silently restored, copied or deleted.
  } catch { storageUnavailable = true; }
}
function notify() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('caselink:session')); }
function clearRecovery() {
  if (typeof window === 'undefined') return;
  try { for (const key of [RECOVERY_KEY, PREFERENCES_KEY, ADAPTIVE_VIEW_STORAGE_KEY]) window.sessionStorage.removeItem(key); }
  catch { storageUnavailable = true; }
}
export function readPreferences(): UsePreferences { initialize(); return { ...preferences }; }
export function setPreferences(changes: Partial<UsePreferences>): void {
  initialize();
  const next = UsePreferencesSchema.parse({ ...preferences, ...changes });
  if ((next.refreshRecovery || next.saveMode === 'local') && (!next.expiresAt || Date.parse(next.expiresAt) <= Date.now())) throw new Error('A future expiry is required for opted-in storage.');
  preferences = next;
  if (!next.refreshRecovery) clearRecovery();
  persist(memory);
}
export function readSession(): SessionState {
  if (typeof window === 'undefined') return empty();
  initialize();
  if (preferences.refreshRecovery && preferences.expiresAt && Date.parse(preferences.expiresAt) <= Date.now()) {
    preferences = { ...preferences, refreshRecovery: false, saveMode: 'memory', expiresAt: null }; clearRecovery();
  }
  return memory;
}
function persist(state: SessionState) {
  memory = state;
  if (typeof window === 'undefined') return;
  if (preferences.refreshRecovery) {
    try { window.sessionStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); window.sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(state)); }
    catch { storageUnavailable = true; }
  }
  notify();
}
export function saveInput(input: NewCaseInput, step?: number): void {
  const current = readSession();
  if (!current.input || inputKey(input) !== inputKey(current.input)) inputVersion += 1;
  persist({ ...current, input, step: step === undefined ? current.step : Math.max(0, Math.min(8, step)) });
}
export function saveStep(step: number): void { persist({ ...readSession(), step: Math.max(0, Math.min(8, step)) }); }
export function saveResult(result: AnalysisResult, expectedInputKey?: string, expectedGeneration?: number): boolean {
  if (expectedGeneration !== undefined && expectedGeneration !== generation) return false;
  const current = readSession(); if (!current.input) return false;
  const key = inputKey(current.input); if (expectedInputKey !== undefined && key !== expectedInputKey) return false;
  const parsed = AnalysisResultSchema.safeParse(result); if (!parsed.success) return false;
  persist({ ...current, result: parsed.data, resultInputKey: key });
  // Persistence is a separate, explicit user preference, never a side effect of analysis.
  if (preferences.saveMode === 'local') archiveAnalysis(current.input, parsed.data, preferences.expiresAt);
  return true;
}
export function isResultStale(state: SessionState = readSession()): boolean {
  return !!state.result && (!state.input || state.resultInputKey !== inputKey(state.input) || state.result.corpusVersion !== CORPUS_VERSION || state.result.promptVersion !== PROMPT_VERSION);
}
/** Delete only the result association, never the active draft. */
export function detachResult(id: string): void {
  const current = readSession(); if (current.result?.analysisId === id) persist({ ...current, result: null, resultInputKey: null });
}
export function clearSession(): void {
  generation += 1; inputVersion += 1; memory = empty(); preferences = { ...DEFAULT_PREFERENCES };
  initialized = true; for (const cleanup of cleanupCallbacks) cleanup(); clearRecovery(); notify();
}
export function archiveCurrentSession(state: SessionState = readSession()): boolean {
  if (readPreferences().saveMode !== 'local') return true;
  if (!state.result || !state.resultInputKey) return true;
  try { const original = NewCaseInputSchema.safeParse(JSON.parse(state.resultInputKey)); return original.success && archiveAnalysis(original.data, state.result, preferences.expiresAt); }
  catch { return false; }
}
export function saveCurrentReport(expiresAt: string): boolean {
  const current = readSession();
  if (!current.result || !current.resultInputKey || Date.parse(expiresAt) <= Date.now()) return false;
  try { const original = NewCaseInputSchema.parse(JSON.parse(current.resultInputKey)); return archiveAnalysis(original, current.result, expiresAt); }
  catch { return false; }
}
export function legacyDraftAvailable(): boolean {
  try { return typeof window !== 'undefined' && window.sessionStorage.getItem(LEGACY_KEY) !== null; } catch { return false; }
}
export function restoreLegacyDraft(): boolean {
  if (typeof window === 'undefined') return false;
  const legacy = parseState(window.sessionStorage.getItem(LEGACY_KEY) ?? '');
  if (!legacy) return false; generation += 1; inputVersion += 1; persist(legacy); return true;
}
export function clearLegacyDraft(): void {
  if (typeof window !== 'undefined') for (const key of [LEGACY_KEY, 'caselink.adaptive.view.v1']) window.sessionStorage.removeItem(key);
  notify();
}
export function startNewAnalysis(): void { clearSession(); }
export function newDraft(): NewCaseInput { return structuredClone(EMPTY_INPUT); }
export function isStorageAvailable(): boolean { return !storageUnavailable; }
