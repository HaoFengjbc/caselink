import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_SCENARIOS } from '../data/demo/fixtures';
import type { AnalysisResult } from '../src/lib/contracts';
import { analyzeInput } from '../src/lib/ai/service';
import { analysisMarkdown } from '../src/components/results/export';

let result: AnalysisResult;
let local: Map<string, string>; let session: Map<string, string>; let failWrite = false;
const input = () => structuredClone(DEMO_SCENARIOS[0].input);
function storage(data: Map<string, string>, persistent = false) {
  return { get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { if (persistent && failWrite) throw new Error('QuotaExceededError'); data.set(key, value); },
    removeItem: (key: string) => data.delete(key) };
}
beforeAll(async () => { result = await analyzeInput(input(), { forceRule: true, config: { mode: 'demo', configured: false, key: '', model: '', timeoutMs: 1000, reasoningEffort: 'low', maxOutputTokens: 9000 } }); });
beforeEach(() => {
  vi.resetModules(); local = new Map(); session = new Map(); failWrite = false;
  vi.stubGlobal('window', { localStorage: storage(local, true), sessionStorage: storage(session), dispatchEvent: vi.fn() });
});
afterEach(() => { vi.unstubAllGlobals(); });
async function setup() { return { flow: await import('../src/lib/session'), history: await import('../src/lib/session/history') }; }
describe('independent drafts and durable report history', () => {
  it('starts empty, clears adaptive state and leaves all finished reports intact', async () => {
    const { flow, history } = await setup(); flow.saveInput(input(), 8); flow.saveResult(result);
    session.set(flow.ADAPTIVE_VIEW_STORAGE_KEY, 'private AI intake');
    const cleanup = vi.fn(); flow.registerSessionCleanup(cleanup);
    flow.startNewAnalysis();
    expect(flow.readSession()).toMatchObject({ input: null, result: null, step: 0, resultInputKey: null });
    expect(session.has(flow.ADAPTIVE_VIEW_STORAGE_KEY)).toBe(false); expect(cleanup).toHaveBeenCalledOnce();
    expect(history.readHistory()).toHaveLength(1); expect(history.readHistory()[0]).toMatchObject({ input: input(), result });
  });
  it('persists multiple reports after the original tab closes without restoring its old draft', async () => {
    let { flow, history } = await setup(); flow.saveInput(input()); flow.saveResult(result); flow.startNewAnalysis();
    flow.saveInput({ ...input(), country: 'United Kingdom' }); flow.saveResult({ ...result, analysisId: 'second', createdAt: '2099-10-09T17:00:00.000Z' });
    session.clear(); vi.resetModules(); ({ flow, history } = await setup());
    expect(flow.readSession().input).toBeNull(); expect(history.readHistory().map(item => item.id)).toEqual(['second', result.analysisId]);
  });
  it('migrates the legacy report using its original input, not a newer draft', async () => {
    const { flow, history } = await setup();
    session.set('caselink.session.v1', JSON.stringify({ version: 1, input: { ...input(), country: 'New case country' }, result: { ...result, promptVersion: '1.0' }, resultInputKey: flow.inputKey(input()), step: 3 }));
    expect(flow.archiveCurrentSession()).toBe(true); flow.archiveCurrentSession();
    const saved = history.getSavedReport(result.analysisId);
    expect(history.readHistory()).toHaveLength(1); expect(saved).toMatchObject({ input: input(), result: { promptVersion: '1.0' } });
    expect(flow.readSession().input?.country).toBe('New case country');
  });
  it('refuses to attach an old result to an unknown original input', async () => {
    const { flow, history } = await setup();
    expect(flow.archiveCurrentSession({ version: 1, input: input(), result, resultInputKey: 'broken-key', step: 0 })).toBe(false);
    expect(history.readHistory()).toEqual([]);
  });
  it('keeps an immutable input/result pair when editing and rerunning the same case', async () => {
    const { flow, history } = await setup(); flow.saveInput(input()); flow.saveResult(result);
    flow.saveInput({ ...input(), country: 'Other country' });
    expect(history.getSavedReport(result.analysisId)).toMatchObject({ input: input() });
    flow.saveResult({ ...result, analysisId: 'revised' });
    expect(history.readHistory()).toHaveLength(2);
    expect(history.getSavedReport('revised')).toMatchObject({ input: { country: 'Other country' } });
  });
  it('rejects an in-flight result from an earlier analysis even if the new answers are identical', async () => {
    const { flow, history } = await setup(); flow.saveInput(input());
    const generation = flow.sessionGeneration(); const key = flow.inputKey(input());
    flow.startNewAnalysis(); flow.saveInput(input());
    expect(flow.saveResult(result, key, generation)).toBe(false);
    expect(history.readHistory()).toEqual([]); expect(flow.readSession().result).toBeNull();
  });
  it('does not overwrite a report written by another tab or import with the same ID', async () => {
    const first = await setup(); first.history.archiveAnalysis(input(), result);
    vi.resetModules(); const second = await setup(); second.history.archiveAnalysis(input(), { ...result, analysisId: 'second' });
    first.history.archiveAnalysis({ ...input(), country: 'wrong replacement' }, result);
    expect(first.history.readHistory()).toHaveLength(2); expect(second.history.getSavedReport(result.analysisId)).toMatchObject({ input: input() });
  });
  it('retains earlier reports and exposes a backup when browser quota is exhausted', async () => {
    const { history, flow } = await setup(); history.archiveAnalysis(input(), result); failWrite = true;
    flow.saveInput(input()); flow.saveResult({ ...result, analysisId: 'pending' }); flow.startNewAnalysis();
    expect(history.readHistory()).toHaveLength(2); expect(history.historyStatus()).toMatchObject({ storageIssue: true, pendingCount: 1 });
    expect(history.historyBackup()).toContain('pending'); expect(local.size).toBe(1);
    failWrite = false; expect(history.readHistory()).toHaveLength(2); expect(history.historyStatus().pendingCount).toBe(0); expect(local.size).toBe(2);
  });
  it('keeps unreadable old data without blocking good reports or overwriting it', async () => {
    const { history } = await setup(); local.set(history.HISTORY_PREFIX + 'broken', '{corrupt');
    history.archiveAnalysis(input(), result);
    expect(history.readHistory()).toHaveLength(1); expect(history.historyStatus().unreadable).toBe(true);
    expect(local.get(history.HISTORY_PREFIX + 'broken')).toBe('{corrupt');
  });
  it('round trips full report backups and keeps Markdown exports in their original form', async () => {
    const { history } = await setup(); history.archiveAnalysis(input(), result);
    const imported = await history.parseHistoryImport(history.historyBackup()); expect(imported).toEqual(history.readHistory());
    for (const locale of ['zh', 'en'] as const) {
      const markdown = analysisMarkdown(result, input(), locale);
      const [report] = await history.parseHistoryImport(markdown);
      expect(report).toMatchObject({ kind: 'markdown', markdown, createdAt: result.createdAt });
      history.storeReport(report); history.storeReport(report);
    }
    expect(history.readHistory()).toHaveLength(3);
  });
  it('rejects unsupported imports before writing anything', async () => {
    const { history } = await setup();
    await expect(history.parseHistoryImport('{"format":"not-caselink"}')).rejects.toThrow();
    await expect(history.parseHistoryImport('# A different document')).rejects.toThrow();
    await expect(history.parseHistoryImport('# CaseLink\n生成时间：invalid')).rejects.toThrow();
    expect(local.size).toBe(0);
  });
});
