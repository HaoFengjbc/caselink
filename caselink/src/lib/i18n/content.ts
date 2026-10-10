import enContent from '../../../data/i18n/en.json';
import type { CaseRecord, Evidence, SourceDocument } from '../contracts';
import type { resources } from '../corpus';
import type { Locale } from './locale';

type Resource = (typeof resources)[number];
type CaseText = {
  title?: string; summary: string; statusSummary: string;
  events: Record<string, string>;
  interventions: Record<string, { actor: string; action: string }>;
  outcomes: Record<string, string>;
  recommendations: Record<string, { actor: string; description: string }>;
  unknowns: string[]; conflicts: string[];
};
type EnglishContent = {
  countries: Record<string, string>;
  cases: Record<string, CaseText>;
  evidence: Record<string, string>;
  resources: Record<string, { name: string; applicability: string; requiredMaterials: string[]; summary?: string; eligibility?: string[]; unknowns?: string[] }>;
  documents: Record<string, { author: string }>;
};

/**
 * English overlay for the Chinese corpus. Review status belongs to each source; translations do
 * not upgrade it. The canonical data and its validation stay in
 * Chinese; this only swaps display text, keyed by stable IDs, and falls back to Chinese if missing.
 */
export const EN_CONTENT = enContent as EnglishContent;

const COUNTRY_ALIASES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(EN_CONTENT.countries).map(([zh,en])=>[en.toLowerCase(),zh])),
  'hong kong sar':'中国香港', 'hong kong':'中国香港', '香港':'中国香港',
  'türkiye':'土耳其', 'turkiye':'土耳其',
};
/** Canonical (Chinese) key for a country typed in either language. */
export const countryKey = (value: string) => COUNTRY_ALIASES[value.trim().toLowerCase()] ?? value.trim();
export function countryName(value: string, locale: Locale): string {
  if (locale === 'zh') return COUNTRY_ALIASES[value.trim().toLowerCase()] ?? value;
  return EN_CONTENT.countries[countryKey(value)] ?? value;
}

export function localizeCase(record: CaseRecord, locale: Locale): CaseRecord {
  if (locale === 'zh') return record;
  const t = EN_CONTENT.cases[record.caseId];
  if (!t) return record;
  const localized: CaseRecord = {
    ...record,
    title: t.title || record.title,
    summary: t.summary || record.summary,
    statusSummary: t.statusSummary || record.statusSummary,
    events: record.events.map(e => ({ ...e, description: t.events[e.eventId] ?? e.description })),
    interventions: record.interventions.map(i => ({ ...i, actor: t.interventions[i.interventionId]?.actor ?? i.actor, action: t.interventions[i.interventionId]?.action ?? i.action })),
    outcomes: record.outcomes.map(o => ({ ...o, description: t.outcomes[o.outcomeId] ?? o.description })),
    reportRecommendations: record.reportRecommendations.map(r => ({ ...r, actor: t.recommendations[r.recommendationId]?.actor ?? r.actor, description: t.recommendations[r.recommendationId]?.description ?? r.description })),
    unknowns: t.unknowns.length === record.unknowns.length ? t.unknowns : record.unknowns,
    conflicts: record.conflicts.map((f, i) => ({ ...f, description: t.conflicts[i] ?? f.description })),
  };
  return localized;
}

export function localizeEvidence(item: Evidence, locale: Locale): Evidence {
  return locale === 'zh' ? item : { ...item, explanation: EN_CONTENT.evidence[item.evidenceId] ?? item.explanation };
}

export function localizeResource(item: Resource, locale: Locale): Resource {
  const t = locale === 'en' ? EN_CONTENT.resources[item.resourceId] : undefined;
  return t && !item.sourceAudit ? { ...item, name: t.name, applicability: t.applicability, requiredMaterials: t.requiredMaterials,
    summary: t.summary ?? item.summary,
    eligibility: t.eligibility ?? item.eligibility,
    unknowns: t.unknowns ?? item.unknowns,
  } : item;
}

export function localizeDocument(item: SourceDocument, locale: Locale): SourceDocument {
  const t = locale === 'en' ? EN_CONTENT.documents[item.documentId] : undefined;
  return t ? { ...item, author: t.author } : item;
}
