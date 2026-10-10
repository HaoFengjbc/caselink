import {describe,it,expect,beforeAll} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {CaseFollowupSchema} from '../src/lib/legal-contracts';
import incrementalJson from '../data/followups/incremental.json';
import manifest from '../data/followups/import-manifest.json';
import reviewed from '../data/followups/reviewed-actions.json';
import baseline from '../data/followups/baseline-hashes.json';
import kz from '../data/followups/kazakhstan.json';
import tn from '../data/followups/tunisia.json';
import ma from '../data/followups/morocco.json';
import cases from '../data/cases/cases.json';
import {mergeFollowups} from '../src/lib/followup-merge';
import {analyzeInput} from '../src/lib/ai/service';
import {validateNextStepLinks} from '../src/lib/next-steps';
import {WHATS_NEXT_INPUTS} from './fixtures/whats-next';

const imported=CaseFollowupSchema.array().parse(incrementalJson);
const row=(report:number,index:number)=>{
 const id=`followup-report-${String(report).padStart(2,'0')}-row-${String(index).padStart(2,'0')}`;
 const mapping=manifest.rows.find(r=>r.importRowId===id)!;
 return imported.find(f=>f.caseId===mapping.caseId)!.events.find(e=>e.eventId===mapping.eventId)!;
};
describe('21-report incremental historical evidence import',()=>{
 it('maps all reports to existing cases and preserves every mixed input row exactly once',()=>{
  expect(manifest.reports.map(r=>r.number)).toEqual(Array.from({length:21},(_,i)=>i+1));
  expect(imported).toHaveLength(22);
  expect(manifest.rows).toHaveLength(150);
  expect(new Set(manifest.rows.map(r=>r.importRowId)).size).toBe(150);
  expect(manifest.counts).toMatchObject({inputSourceRecords:121,webSourceRecords:100,uniqueWebUrls:96,pdfPages:154,teamVerified:0});
  for(const f of imported){
   expect(f.originalFactsAsOf).toBe(cases.find(c=>c.caseId===f.caseId)?.lastKnownStatusAsOf);
   expect(new Set(f.events.map(e=>e.eventId)).size).toBe(f.events.length);
  }
  for(const r of manifest.rows){
   const event=imported.find(f=>f.caseId===r.caseId)?.events.find(e=>e.eventId===r.eventId);
   expect(event).toBeDefined();expect(r.pdfPages.length).toBeGreaterThan(0);
  }
 });
 it('protects baseline cases, 187 evidence entries and all old six-case files byte-for-byte',()=>{
  for(const p of baseline)expect(createHash('sha256').update(readFileSync(p.path)).digest('hex')).toBe(p.sha256);
  expect([...kz,...tn,...ma]).toHaveLength(6);
  expect(tn.flatMap(f=>f.events).some(e=>e.eventId==='myriam-followup-report-used-appeal')).toBe(true);
  expect(kz.flatMap(f=>f.events).some(e=>e.eventId==='alnur-followup-2022-09-13-joint-letter')).toBe(true);
  expect(kz.flatMap(f=>f.events).some(e=>e.eventId==='alnur-followup-2023-07-31-government-position')).toBe(true);
  expect(tn.flatMap(f=>f.events).some(e=>e.eventId==='emna-followup-hrw-upr')).toBe(true);
 });
 it('keeps research authorship, underlying-source reading, and human review distinct',()=>{
  const all=imported.flatMap(f=>f.events);
  expect(all.filter(e=>e.verification==='source_checked')).toHaveLength(8);
  expect(all.filter(e=>e.eventKind==='historical_action').length).toBeLessThan(40);
  for(const f of imported)for(const e of f.events){
   expect(e.reportId).toBeTruthy();expect(e.proceedingId).toBeTruthy();expect(e.researchCutoff).toBe('2026-10-09');
   const sources=e.sourceIds.map(id=>f.sources.find(s=>s.sourceId===id)!);
   expect(sources.every(Boolean)).toBe(true);
   if(e.verification==='research_reported')expect(sources.some(s=>s.sourceKind==='uploaded_research'&&s.readStatus==='full_text'&&s.quote)).toBe(true);
   else expect(sources.some(s=>s.sourceKind==='underlying_source'&&s.supportLevel==='source_checked'&&s.readStatus==='full_text'&&s.quote&&s.locator)).toBe(true);
   for(const s of sources){expect(s.teamReviewer).toBeNull();expect(s.teamReviewedAt).toBeNull();}
  }
 });
 it('does not turn PECA shared reform or new proceedings into original-case disposals',()=>{
  expect(manifest.reports.find(r=>r.number===4)?.caseIds).toEqual(['asad-ali-toor','bilal-ghauri']);
  for(const i of [1,2,3,4])expect(row(4,i).scope).toBe('general_legal_background');
  expect(row(4,5).scope).toBe('same_person_other_case');
  expect(row(4,5).subjects).toEqual(['Asad Ali Toor']);
  expect(row(4,6).subjects).toEqual(['Bilal Ghauri']);
  expect(row(4,6).outcome).toContain('未确认');
  expect(row(4,6).verification).toBe('research_reported');
 });
 it('separates Radi I/II, Zolotova/Chekina, Wuth co-defendants and Malaysiakini/Gan',()=>{
  expect(row(16,6).scope).toBe('same_person_other_case');
  expect(row(15,6).scope).toBe('same_case');
  expect(row(13,3).scope).toBe('same_person_other_case');
  expect(row(13,6).scope).toBe('co_defendant');
  expect(row(13,6).subjects).toEqual(['Liudmila Chekina']);
  expect(row(1,4).subjects).toEqual(['Wuth Boonlert','Suracha Boonyeim']);
  expect(row(12,5).subjects).toEqual(['Malaysiakini (company)']);
  expect(row(12,2).outcome).toContain('Gan无罪');
 });
 it('never promotes bylines, schedules, same-name leads, or awards to success',()=>{
  for(const i of [4,5])expect(row(18,i).scope).toBe('professional_activity');
  expect(row(18,5).eventKind).toBe('publication');
  expect(row(19,10).scope).toBe('professional_activity');
  const bwayo=imported.find(f=>f.caseId==='moses-bwayo')!;
  expect(bwayo.unknowns.join(' ')).toContain('HCT-00-CV-MC-0019-2022');
  expect(bwayo.events.some(e=>e.proceedingId?.includes('0019-2022'))).toBe(false);
  expect(row(12,3).executionStatus).toBe('planned');
  expect(row(21,6).executionStatus).toBe('scheduled');
  expect(row(21,7).executionStatus).toBe('scheduled');
  expect(row(17,8).outcome).toContain('不等于实际付款');
  expect(imported.find(f=>f.caseId==='alexander-pichugin')!.unknowns.join(' ')).toContain('paid');
 });
 it('preserves conflicts and never fills precise days or current state from cutoff',()=>{
  expect(row(7,3).datePrecision).toBe('month');
  expect(row(17,9).datePrecision).toBe('month');
  expect(row(21,2).datePrecision).toBe('month');
  expect(row(21,3).datePrecision).toBe('month');
  expect(imported.every(f=>f.originalFactsAsOf!=='2026-10-09')).toBe(true);
  expect(imported.find(f=>f.caseId==='marina-zolotova')?.originalFactsAsOf).toBe('2019-07-26');
  expect(manifest.reports.find(r=>r.number===13)?.sourceOriginalFactsAsOf).toBe('2019-07');
 });
 it('only gives checked criminal action methods and explicit differences to matching',()=>{
  expect(reviewed.actions).toHaveLength(8);
  for(const a of reviewed.actions){
   const e=a.event;expect(e.verification).toBe('source_checked');expect(e.eventKind).toBe('historical_action');
   expect(e.scope).toBe('same_case');expect(['submitted','implemented']).toContain(e.executionStatus);
   expect(e.matching.proceedings).toEqual(['criminal']);expect(e.matching.differences.length).toBeGreaterThan(0);
   expect(e.matching.materialForm).toBeTruthy();expect(e.relationshipToOutcome).not.toBe('attributed_claim');
  }
 });
});

describe('reviewed follow-up merge and final citation gate regressions',()=>{
 let result:Awaited<ReturnType<typeof analyzeInput>>;
 const filingId='aigul-followup-2022-04-27-hrc-filing-confirmed';
 beforeAll(async()=>{
  const input=structuredClone(WHATS_NEXT_INPUTS[0]);
  input.stage='appeal';input.primaryGoal='change_judgment';input.currentProblems=['expression_restricted'];
  input.intake!.narrative='【虚构回归案 A-84】记者岚渝因采购报道被定罪。当地律师已经提交上诉，案件处于上诉阶段。本人只同意内部法律研究与现有律师沟通。';
  input.background.description=input.intake!.narrative;
  input.intake!.goalText='整理上诉材料并核对可能改变判决的研究依据。';
  input.keyDates=[{date:'2026-09-30',event:'用户称作出一审定罪，判决原件待核',approximate:false}];
  result=await analyzeInput(input,{forceRule:true});
 });
 const checkedHistory=()=>{
  const h=result.whatsNext!.priorities.flatMap(t=>t.history).find(h=>h.followupEventId===filingId);
  expect(h).toBeDefined();return structuredClone(h!);
 };
 const stepsWithFiling=()=>{
  const steps=structuredClone(result.nextSteps!);expect(steps.length).toBeGreaterThan(0);
  // Exercise the final integrity boundary independently of upstream selection.
  steps[0].history=[checkedHistory()];return steps;
 };
 it('keeps source-checked submitted status while leaving old JSON and old objects byte-identical',()=>{
  const legacy=CaseFollowupSchema.array().parse([...kz,...tn,...ma]);
  const before=JSON.stringify(legacy),merged=mergeFollowups(legacy,imported);
  for(const id of [filingId,'myriam-followup-defence-appeal']){
   expect(legacy.flatMap(f=>f.events).find(e=>e.eventId===id)?.executionStatus).toBe('implemented');
   expect(merged.flatMap(f=>f.events).find(e=>e.eventId===id)?.executionStatus).toBe('submitted');
  }
  expect(checkedHistory().executionStatus).toBe('submitted');
  expect(JSON.stringify(legacy)).toBe(before);
  for(const p of baseline)expect(createHash('sha256').update(readFileSync(p.path)).digest('hex')).toBe(p.sha256);
  expect(result.snapshot?.followups?.flatMap(f=>f.events).find(e=>e.eventId===filingId)?.executionStatus).toBe('submitted');
 });
 it('accepts the actual underlying source selected for a checked appeal-stage method',()=>{
  const steps=stepsWithFiling();
  expect(steps[0].history[0].sourceIds).toContain('checked-utepova-hrc-filing');
  expect(validateNextStepLinks(steps,result,result.legalResearch!,result.followups!)).toEqual([]);
 });
 it('rejects replacing a checked action source with its readable uploaded research passage',()=>{
  const steps=stepsWithFiling(),history=steps[0].history[0];
  const followup=result.followups!.find(f=>f.caseId===history.caseId)!;
  const event=followup.events.find(e=>e.eventId===filingId)!;
  const researchSource=followup.sources.find(s=>event.sourceIds.includes(s.sourceId)&&s.sourceKind==='uploaded_research'&&s.readStatus==='full_text')!;
  expect(researchSource).toBeDefined();expect(researchSource.quote).not.toBe('');
  history.sourceIds=[researchSource.sourceId];
  expect(validateNextStepLinks(steps,result,result.legalResearch!,result.followups!).some(e=>e.includes('follow-up source'))).toBe(true);
 });
 it('rejects a same-person-other-case record even when the event and source IDs still resolve',()=>{
  const steps=stepsWithFiling(),followups=structuredClone(result.followups!);
  const event=followups.find(f=>f.caseId===steps[0].history[0].caseId)!.events.find(e=>e.eventId===filingId)!;
  event.scope='same_person_other_case';
  expect(validateNextStepLinks(steps,result,result.legalResearch!,followups).some(e=>e.includes('scope is ineligible'))).toBe(true);
 });
});
