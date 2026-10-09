import { z } from 'zod';
import { reportMarker } from './report-marker';
import { AnalysisResultSchema, NewCaseInputSchema, type AnalysisResult, type NewCaseInput } from '../contracts';

export const HISTORY_PREFIX = 'caselink.report.v1.';
const base = { version: z.literal(1), id: z.string().min(1), savedAt: z.string(), title: z.string(), country: z.string(), createdAt: z.string(), expiresAt: z.string().datetime().nullable().optional() };
export const SavedReportSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('analysis'), input: NewCaseInputSchema, result: AnalysisResultSchema }),
  z.object({ ...base, kind: z.literal('markdown'), markdown: z.string().min(1).max(3_000_000) }),
]);
export type SavedReport = z.infer<typeof SavedReportSchema>;
export type AnalysisReport = Extract<SavedReport, { kind: 'analysis' }>;
export const MAX_BACKUP_BYTES = 3_000_000;
export const MAX_HISTORY_RECORDS = 500;
export const MAX_HISTORY_BYTES = 4_000_000;
const TOMBSTONE_PREFIX = 'caselink.deleted.v2.';
export const byteLength = (text: string): number => new TextEncoder().encode(text).byteLength;
const pending = new Map<string, SavedReport>();
let storageIssue = false;
let unreadable = false;

/** Each immutable report has its own key: concurrent tabs never replace a shared list. */
export function storeReport(report: SavedReport): boolean {
  const parsed = SavedReportSchema.safeParse(report);
  if (!parsed.success || typeof window === 'undefined') return false;
  const item = parsed.data;
  try {
    if (window.localStorage.getItem(TOMBSTONE_PREFIX + reportMarker(item.id)) !== null) { pending.delete(item.id); return false; }
    if (item.expiresAt && Date.parse(item.expiresAt) <= Date.now()) { pending.delete(item.id); return false; }
    if (byteLength(JSON.stringify(item)) > MAX_BACKUP_BYTES - 100) return false;
    const existing = window.localStorage.getItem(HISTORY_PREFIX + item.id);
    if (existing !== null) {
      const old = SavedReportSchema.safeParse(JSON.parse(existing));
      if (!old.success) throw new Error('Unreadable existing report');
      pending.delete(item.id);
      return true;
    }
    let count = 0; let bytes = 0;
    for (let i = 0; i < window.localStorage.length; i++) { const key = window.localStorage.key(i); if (key?.startsWith(HISTORY_PREFIX)) { count++; bytes += byteLength(window.localStorage.getItem(key) ?? ''); } }
    if (count >= MAX_HISTORY_RECORDS || bytes + byteLength(JSON.stringify(item)) > MAX_HISTORY_BYTES) throw new Error('History capacity');
    window.localStorage.setItem(HISTORY_PREFIX + item.id, JSON.stringify(item));
    // A concurrent deletion always wins, including when it occurred after our first check.
    if (window.localStorage.getItem(TOMBSTONE_PREFIX + reportMarker(item.id)) !== null) { window.localStorage.removeItem(HISTORY_PREFIX + item.id); return false; }
    pending.delete(item.id);
    return true;
  } catch {
    // Never evict another report to make room. Keep a downloadable in-memory copy.
    pending.set(item.id, item);
    storageIssue = true;
    return false;
  }
}

export function archiveAnalysis(input: NewCaseInput, result: AnalysisResult, expiresAt: string | null = null): boolean {
  return storeReport({ version: 1, kind: 'analysis', id: result.analysisId,
    savedAt: new Date().toISOString(), createdAt: result.createdAt, country: input.country, expiresAt,
    title: input.intake?.goalText.trim() || input.intake?.narrative.trim().slice(0, 80) || input.background.description.trim().slice(0, 80) || '',
    input: structuredClone(input), result: structuredClone(result) });
}

export function readHistory(): SavedReport[] {
  if (typeof window === 'undefined') return [];
  storageIssue = false; unreadable = false;
  for (const item of [...pending.values()]) storeReport(item);
  const reports = new Map(pending);
  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(HISTORY_PREFIX)) continue;
      try {
        const parsed = SavedReportSchema.safeParse(JSON.parse(storage.getItem(key) ?? 'null'));
        if (parsed.success && key === HISTORY_PREFIX + parsed.data.id) {
          if (storage.getItem(TOMBSTONE_PREFIX + reportMarker(parsed.data.id)) !== null) { reports.delete(parsed.data.id); continue; }
          if (parsed.data.expiresAt && Date.parse(parsed.data.expiresAt) <= Date.now()) { deleteSavedReport(parsed.data.id); reports.delete(parsed.data.id); i--; continue; }
          reports.set(parsed.data.id, parsed.data);
        }
        else unreadable = true;
      } catch { unreadable = true; }
    }
  } catch { storageIssue = true; }
  return [...reports.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.savedAt.localeCompare(a.savedAt));
}
export function getSavedReport(id: string): SavedReport | undefined { return readHistory().find(item => item.id === id); }
export function historyStatus() { return { storageIssue, unreadable, pendingCount: pending.size }; }
export function deleteSavedReport(id: string): boolean {
  try {
    // Only random report identifiers and deletion time; never original facts or a fact hash.
    window.localStorage.setItem(TOMBSTONE_PREFIX + reportMarker(id), new Date().toISOString());
    window.localStorage.removeItem(HISTORY_PREFIX + id); pending.delete(id);
    window.dispatchEvent(new Event('caselink:history')); return true;
  }
  catch { storageIssue = true; return false; }
}
export function historyBackup(reports = readHistory()): string {
  if (reports.length > MAX_HISTORY_RECORDS) throw new Error('Too many reports; export in smaller batches.');
  const text = JSON.stringify({ format: 'caselink-history', version: 1, reports });
  if (byteLength(text) > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 3 MB; export split backups.');
  return text;
}
export async function parseHistoryImport(text: string): Promise<SavedReport[]> {
  if (byteLength(text) > MAX_BACKUP_BYTES) throw new Error('size');
  if (text.trimStart().startsWith('{')) {
    const data = z.object({ format: z.literal('caselink-history'), version: z.literal(1), reports: z.array(SavedReportSchema).max(MAX_HISTORY_RECORDS) }).parse(JSON.parse(text));
    return data.reports;
  }
  if (!/^# CaseLink\b/m.test(text)) throw new Error('format');
  const line = (pattern: RegExp) => text.match(pattern)?.[1]?.trim() ?? '';
  const createdAt = line(/^(?:生成时间|Generated(?: at)?):?：?\s*(.+)$/mi);
  if (!createdAt || !Number.isFinite(Date.parse(createdAt))) throw new Error('date');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const id = 'import-' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return [{ version: 1, kind: 'markdown', id, savedAt: new Date().toISOString(), createdAt: new Date(createdAt).toISOString(),
    title: line(/^(?:主要目标|Main goal)\s*[:：]\s*(.+)$/mi) || line(/^# CaseLink\s*[·—-]?\s*(.+)$/m), country: line(/^(?:国家或地区|Country or region)\s*[:：]\s*(.+)$/mi), markdown: text }];
}

/** Every part is accepted by parseHistoryImport under exactly the same byte/record limits. */
export function splitHistoryBackups(reports = readHistory()): string[] {
  const parts: string[] = []; let batch: SavedReport[] = [];
  for (const report of reports) {
    historyBackup([report]); // A single oversized legacy record gets an explicit failure, never a bad backup.
    try { historyBackup([...batch, report]); batch.push(report); }
    catch { parts.push(historyBackup(batch)); batch = [report]; }
  }
  if (batch.length) parts.push(historyBackup(batch));
  return parts;
}
