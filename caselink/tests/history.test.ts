import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_SCENARIOS } from '../data/demo/fixtures';
import type { AnalysisResult } from '../src/lib/contracts';
import { analyzeInput } from '../src/lib/ai/service';
import { analysisMarkdown } from '../src/components/results/export';
import { reportMarker } from '../src/lib/session/report-marker';
import { captureReportSnapshot } from '../src/lib/reports/snapshot';

let result: AnalysisResult;
let local: Map<string, string>; let session: Map<string, string>; let failWrite = false;
const input = () => structuredClone(DEMO_SCENARIOS[0].input);
const expiry = () => new Date(Date.now() + 7 * 86400000).toISOString();
function storage(data: Map<string, string>, persistent = false) {
  return { get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { if (persistent && failWrite) throw new Error('QuotaExceededError'); data.set(key, value); },
    removeItem: (key: string) => data.delete(key) };
}
beforeAll(async () => { result = await analyzeInput(input(), { forceRule: true, config: { mode: 'demo', configured: false, key: '', model: '', timeoutMs: 1000, reasoningEffort: 'low', maxOutputTokens: 9000 } }); result.snapshot = captureReportSnapshot(result); });
beforeEach(() => {
  vi.resetModules(); local = new Map(); session = new Map(); failWrite = false;
  vi.stubGlobal('window', { localStorage: storage(local, true), sessionStorage: storage(session), dispatchEvent: vi.fn() });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
async function setup() { return { flow: await import('../src/lib/session'), history: await import('../src/lib/session/history') }; }
describe('consent-based memory workflow and history', () => {
  it('stores only SHA-256 report markers, including for untrusted imported IDs', async () => {
    expect(reportMarker('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const { history } = await setup(); history.deleteSavedReport('Private alleged act involving a named person');
    expect([...local.keys()].join('')).not.toContain('Private');
  });
  it('never writes facts to either browser storage by default, including result/history visits and edits', async () => {
    const { flow, history } = await setup(); flow.saveInput(input(), 8); flow.saveResult(result); flow.archiveCurrentSession();
    flow.saveInput({ ...input(), country: 'United Kingdom' });
    expect(local.size).toBe(0); expect(session.size).toBe(0); expect(history.readHistory()).toEqual([]);
    flow.startNewAnalysis(); expect(flow.readSession().input).toBeNull(); expect(history.readHistory()).toEqual([]);
  });
  it('memory disappears on refresh unless separate recovery consent was given', async () => {
    let { flow } = await setup(); flow.saveInput(input()); vi.resetModules(); ({ flow } = await setup()); expect(flow.readSession().input).toBeNull();
    flow.setPreferences({ refreshRecovery: true, expiresAt: expiry() }); flow.saveInput(input(), 6); flow.saveResult(result);
    vi.resetModules(); ({ flow } = await setup()); expect(flow.readSession()).toMatchObject({ input: input(), step: 6, result });
    flow.setPreferences({ refreshRecovery: false }); expect(session.size).toBe(0); expect(flow.readSession().input).toEqual(input());
  });
  it('removes opted-in recovery at expiry without affecting legacy data', async () => {
    let { flow } = await setup(); session.set('caselink.session.v1', 'preserve this legacy draft');
    flow.setPreferences({ refreshRecovery: true, expiresAt: expiry() }); flow.saveInput(input());
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 8 * 86400000); vi.resetModules(); ({ flow } = await setup());
    expect(flow.readSession().input).toBeNull(); expect([...session.keys()]).toEqual(['caselink.session.v1']);
  });
  it('saves only the selected report and resets persistence preferences for a new case', async () => {
    const { flow, history } = await setup(); flow.saveInput(input()); flow.saveResult(result); expect(flow.saveCurrentReport(expiry())).toBe(true);
    flow.startNewAnalysis(); flow.saveInput({ ...input(), country: 'Other country' }); flow.saveResult({ ...result, analysisId: 'unsaved-second' });
    expect(history.readHistory()).toHaveLength(1); expect(history.getSavedReport(result.analysisId)).toMatchObject({ input: input(), expiresAt: expect.any(String) });
    expect(flow.readPreferences()).toMatchObject({ saveMode: 'memory', refreshRecovery: false });
  });
  it('keeps old saved reports and draft untouched until explicit restore or delete', async () => {
    const { flow, history } = await setup(); const legacy = JSON.stringify({ version: 1, input: input(), result, resultInputKey: flow.inputKey(input()), step: 3 });
    session.set('caselink.session.v1', legacy); history.archiveAnalysis(input(), result);
    expect(flow.legacyDraftAvailable()).toBe(true); expect(flow.readSession().input).toBeNull(); flow.startNewAnalysis();
    expect(session.get('caselink.session.v1')).toBe(legacy); expect(history.readHistory()).toHaveLength(1);
    expect(flow.restoreLegacyDraft()).toBe(true); expect(flow.readSession().input).toEqual(input());
    flow.clearLegacyDraft(); expect(session.has('caselink.session.v1')).toBe(false);
  });
  it('deleting A never clears the later draft B and an older tab cannot resurrect A', async () => {
    const first = await setup(); first.flow.saveInput(input()); first.flow.saveResult(result); first.flow.saveCurrentReport(expiry());
    const savedA = first.history.getSavedReport(result.analysisId)!; const later = { ...input(), country: 'New draft B' }; first.flow.saveInput(later);
    vi.resetModules(); const second = await setup(); expect(second.history.deleteSavedReport(result.analysisId)).toBe(true);
    first.flow.detachResult(result.analysisId); expect(first.flow.readSession()).toMatchObject({ input: later, result: null });
    expect(first.history.storeReport(savedA)).toBe(false); expect(first.history.readHistory()).toEqual([]);
    const deletionData = [...local.entries()].filter(([key]) => key.startsWith('caselink.deleted.')).map(([, value]) => value).join('');
    expect(deletionData).not.toContain('New draft B'); expect(deletionData).not.toContain(input().country);
  });
  it('expires only consented reports, keeps legacy records with no expiry, and cannot restore expired content from another tab', async () => {
    const { history } = await setup(); history.archiveAnalysis(input(), result, expiry()); const expiring = history.getSavedReport(result.analysisId)!;
    history.archiveAnalysis(input(), { ...result, analysisId: 'legacy' });
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 8 * 86400000);
    expect(history.readHistory().map(r => r.id)).toEqual(['legacy']); expect(history.storeReport(expiring)).toBe(false);
  });
  it('rejects cancelled generation and changed-input late responses in memory and rule mode', async () => {
    const { flow, history } = await setup(); flow.saveInput(input()); const generation = flow.sessionGeneration(); const key = flow.inputKey(input());
    flow.startNewAnalysis(); flow.saveInput(input()); expect(flow.saveResult(result, key, generation)).toBe(false);
    flow.saveInput({ ...input(), country: 'changed' }); expect(flow.saveResult(result, key)).toBe(false); expect(history.readHistory()).toEqual([]);
  });
  it('retains explicitly saved pending reports when storage fills and does not overwrite existing records', async () => {
    const { history, flow } = await setup(); history.archiveAnalysis(input(), result); failWrite = true;
    flow.saveInput(input()); flow.saveResult({ ...result, analysisId: 'pending' }); expect(flow.saveCurrentReport(expiry())).toBe(false);
    expect(history.readHistory()).toHaveLength(2); expect(history.historyStatus()).toMatchObject({ storageIssue: true, pendingCount: 1 });
    failWrite = false; expect(history.readHistory()).toHaveLength(2); expect(history.historyStatus().pendingCount).toBe(0);
    history.archiveAnalysis({ ...input(), country: 'wrong replacement' }, result); expect(history.getSavedReport(result.analysisId)).toMatchObject({ input: input() });
  });
  it('round trips byte-bounded backups and splits multibyte reports instead of emitting unrestorable files', async () => {
    const { history } = await setup(); history.archiveAnalysis(input(), result);
    expect(await history.parseHistoryImport(history.historyBackup())).toEqual(history.readHistory());
    const reports = [1, 2].map(i => ({ version: 1 as const, kind: 'markdown' as const, id: `large-${i}`, savedAt: result.createdAt, title: '测试', country: '公开案例', createdAt: result.createdAt, markdown: '中'.repeat(550000) }));
    expect(() => history.historyBackup(reports)).toThrow(); const parts = history.splitHistoryBackups(reports); expect(parts).toHaveLength(2);
    for (const part of parts) { expect(history.byteLength(part)).toBeLessThanOrEqual(history.MAX_BACKUP_BYTES); expect(await history.parseHistoryImport(part)).toHaveLength(1); }
    await expect(history.parseHistoryImport('中'.repeat(1_000_001))).rejects.toThrow('size');
  });
  it('keeps unreadable legacy data and original Markdown exports without enrichment', async () => {
    const { history } = await setup(); local.set(history.HISTORY_PREFIX + 'broken', '{corrupt'); history.archiveAnalysis(input(), result);
    expect(history.readHistory()).toHaveLength(1); expect(history.historyStatus().unreadable).toBe(true); expect(local.get(history.HISTORY_PREFIX + 'broken')).toBe('{corrupt');
    const markdown = analysisMarkdown(result, input()); const [report] = await history.parseHistoryImport(markdown); expect(report).toMatchObject({ kind: 'markdown', markdown });
  });
});
