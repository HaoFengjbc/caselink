import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../src/components/i18n/LocaleProvider';
import { EvidenceButton } from '../src/components/results/EvidenceButton';
import { ReportSnapshotProvider } from '../src/components/results/SnapshotContext';
import { analysisMarkdown } from '../src/components/results/export';
import { comparisonMarkdown } from '../src/components/results/comparison-export';
import { captureCaseSnapshot, captureReportSnapshot, snapshotForResult } from '../src/lib/reports/snapshot';
import { analyzeInput } from '../src/lib/ai/service';
import { DEMO_SCENARIOS } from '../data/demo/fixtures';
import { cases, evidence, documents, resources } from '../src/lib/corpus';
import { EN_CONTENT } from '../src/lib/i18n/content';
import type { AnalysisResult, ComparisonBrief } from '../src/lib/contracts';
import { toClassicInput, withIntake } from '../src/components/intake/adaptive-state';
import { activeFailure, mayRetry, submissionIdentity } from '../src/components/intake/submission-state';
const input = () => withIntake(structuredClone(DEMO_SCENARIOS[0].input));
const config = { mode: 'demo' as const, configured: false, key: '', model: '', timeoutMs: 1000, reasoningEffort: 'low' as const, maxOutputTokens: 9000 };
async function report(locale: 'zh'|'en' = 'zh') {
 const draft = structuredClone(DEMO_SCENARIOS[0].input);
 const result = await analyzeInput(draft, { forceRule: true, config, locale });
 result.snapshot = captureReportSnapshot(result, locale); return { result, draft };
}
function evidenceHtml(result: AnalysisResult) {
 return renderToStaticMarkup(createElement(LocaleProvider, { initial: 'en', children: createElement(ReportSnapshotProvider, { snapshot: snapshotForResult(result), children: createElement(EvidenceButton, { ids: result.sources.map(e => e.evidenceId) }) }) }));
}
describe('complete facts and request version isolation', () => {
 it('retains every field and a 6000-character narrative across editor switches', () => {
  const draft = input(); draft.intake.narrative = '这是虚构记者案件。'.repeat(650).slice(0,6000); draft.intake.jurisdiction='england_wales'; draft.intake.goalText='只整理上诉材料'; draft.intake.disclosureDetails='只限内部，不公开姓名，不联系媒体'; draft.intake.answers=[{questionId:'prior',question:'已采取行动？',answer:'仅与律师讨论'}];
  const original = structuredClone(draft);
  expect(toClassicInput(draft)).toEqual(original); expect(withIntake(toClassicInput(draft))).toEqual(original);
  expect(toClassicInput(draft).intake?.narrative.length).toBe(original.intake.narrative.length);
 });
 it('edits clear terminal failures and exhausted retries, while unchanged retries remain bounded', () => {
  const draft=input(); const failure={code:'INVALID_MODEL_OUTPUT',retryable:false,inputIdentity:submissionIdentity(draft)};
  expect(activeFailure(failure,draft)).toEqual(failure); expect(mayRetry(failure)).toBe(false);
  const changed={...draft,intake:{...draft.intake,goalText:'New clarified goal',confirmed:true}};
  expect(activeFailure(failure,changed)).toBeNull();
  expect(mayRetry({code:'TIMEOUT'})).toBe(true);
  expect(activeFailure({...failure,code:'TIMEOUT'},changed)).toBeNull();
  expect(submissionIdentity({...draft,intake:{...draft.intake,confirmed:true}})).toBe(submissionIdentity(draft));
 });
});
describe('immutable report evidence', () => {
 it.each(['zh','en'] as const)('uses frozen %s cases, documents, resources and explanations in export and evidence modal', async locale => {
  const {result,draft}=await report(locale); const before=analysisMarkdown(result,draft,locale); const modalBefore=evidenceHtml(result);
  const oldCases=structuredClone(cases); const oldEvidence=structuredClone(evidence); const oldDocuments=structuredClone(documents); const oldResources=structuredClone(resources); const oldEnglish=structuredClone(EN_CONTENT);
  try {
   cases.forEach(c=>{c.title='MUTATED TODAY';c.statusSummary='NEW OUTCOME';c.interventions.forEach(i=>i.action='NEW ACTION');});
   evidence.forEach(e=>{e.exactQuote='NEW QUOTE';e.explanation='NEW EXPLANATION';}); documents.forEach(d=>d.author='NEW AUTHOR'); resources.forEach(r=>r.applicability='NEW CONDITIONS');
   Object.values(EN_CONTENT.cases).forEach(c=>{c.title='NEW ENGLISH TITLE';c.summary='NEW ENGLISH SUMMARY';});
   expect(analysisMarkdown(result,draft,locale)).toBe(before); expect(evidenceHtml(result)).toBe(modalBefore);
   expect(before).not.toContain('undefined'); expect(snapshotForResult(result).completeness).toBe('complete');
  } finally { cases.splice(0,cases.length,...oldCases); evidence.splice(0,evidence.length,...oldEvidence);documents.splice(0,documents.length,...oldDocuments);resources.splice(0,resources.length,...oldResources);Object.assign(EN_CONTENT,oldEnglish); }
 });
 it('does not claim completeness when a referenced document or evidence record is missing', async () => {
  const {result}=await report(); const missingEvidence={...result.sources[0],evidenceId:'missing-evidence',documentId:'missing-document'};
  const copy={...result,sources:[missingEvidence]}; expect(captureReportSnapshot(copy).completeness).toBe('legacy_partial');
  const old=cases[0].evidenceIds;cases[0].evidenceIds=[...old,'not-in-corpus'];try { expect(captureCaseSnapshot([cases[0].caseId]).completeness).toBe('legacy_partial'); } finally {cases[0].evidenceIds=old;}
 });
 it('legacy partial reports never fill missing case/document/resource content from the current corpus', async () => {
  const {result,draft}=await report(); delete result.snapshot; const snapshot=snapshotForResult(result);
  expect(snapshot).toMatchObject({completeness:'legacy_partial',cases:[],documents:[],resources:[]});
  const text=analysisMarkdown(result,draft); expect(text).toContain('旧版不完整记录'); expect(text).toContain(result.sources[0].exactQuote);
  expect(text).not.toContain(cases.find(c=>c.caseId===result.comparableCases[0].caseId)!.statusSummary);
  expect(evidenceHtml(result)).toContain('Legacy record');
 });
 it('comparison exports contain full evidence and stay fixed after the library changes', () => {
  const snapshot=captureCaseSnapshot(cases.slice(0,2).map(c=>c.caseId),'en');
  const brief:ComparisonBrief={briefId:'public-brief',title:'Public expression case comparison',createdAt:new Date().toISOString(),locale:'en',caseIds:snapshot.cases.map(c=>c.caseId),snapshot,commonIssues:[],limitations:['Selected cases only; not prevalence estimates.']};
  const text=comparisonMarkdown(brief); expect(text).toContain(snapshot.evidence[0].exactQuote);expect(text).toContain(snapshot.cases[0].interventions[0].action);expect(text).toContain('Not recorded');expect(text).toContain('legacy_recorded');
  const before=cases[0].statusSummary; cases[0].statusSummary='CHANGED';try { expect(comparisonMarkdown(brief)).toBe(text); } finally { cases[0].statusSummary=before; }
 });
});
