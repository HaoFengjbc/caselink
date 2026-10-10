import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEMO_SCENARIOS} from '../data/demo/fixtures';
import {cases,followups} from '../src/lib/corpus';
import {buildLegalResearch,attachRuleLegalCitations} from '../src/lib/legal-research';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {buildNextSteps,validateNextStepLinks} from '../src/lib/next-steps';
import {analyzeInput} from '../src/lib/ai/service';
import {snapshotForResult} from '../src/lib/reports/snapshot';
import {analysisMarkdown} from '../src/components/results/export';
import {workPackMarkdown} from '../src/components/results/work-pack';
import {ActionNextSteps,FollowupTimeline} from '../src/components/results/NextSteps';
import {LocaleProvider} from '../src/components/i18n/LocaleProvider';
import {ReportSnapshotProvider} from '../src/components/results/SnapshotContext';
import type {AnalysisResult} from '../src/lib/contracts';
const config={mode:'demo' as const,configured:false,key:'',model:'',timeoutMs:1000,reasoningEffort:'low' as const,maxOutputTokens:9000};
function prepared(index:number){const input=structuredClone(DEMO_SCENARIOS[index].input);const research=buildLegalResearch(input);const output=attachRuleLegalCitations(buildRuleReference(input),research);return {input,research,output,steps:buildNextSteps(input,output,research,followups)};}
const stepHtml=(result:AnalysisResult)=>renderToStaticMarkup(createElement(LocaleProvider,{initial:'zh',children:createElement(ReportSnapshotProvider,{snapshot:snapshotForResult(result),children:createElement(ActionNextSteps,{actionId:result.actionOptions[0].actionId})})}));

describe('evidence-linked work products under existing actions',()=>{
 it('preserves private handling and gives concrete products, responsibility and boundaries',()=>{
  const {input,research,output,steps}=prepared(0);
  expect(steps.map(step=>step.actionId)).toEqual(output.actionOptions.map(action=>action.actionId));
  const primary=steps.find(step=>step.actionId==='primary-release')!;
  expect(primary.deliverables.join(' ')).toContain('当地律师问题单');expect(primary.owner).toContain('当地律师判断');expect(primary.stopConditions.join(' ')).toContain('不发送、联系、公开或递交');
  expect(primary.history.some(history=>history.caseId==='alnur-ilyashev'&&`${history.action} ${history.outcome}`.includes('拒绝'))).toBe(true);
  const external=steps.find(step=>step.actionId==='external-advocacy')!;
  expect(output.actionOptions.find(action=>action.actionId===external.actionId)!.applicability).toBe('defer');expect(external.stopConditions.join(' ')).toContain('公开倡议暂不推进');
  expect(external.legalBindingIds.some(id=>id.includes('ohchr-special-procedures'))).toBe(true);
  expect(validateNextStepLinks(steps,output,research,followups)).toEqual([]);expect(input.publicity).toBe('private');
 });
 it('shows new sourced participation without transferring another proceeding or inferring causality',()=>{
  const kz=prepared(0);const primary=kz.steps.find(step=>step.actionId==='primary-release')!;
  expect(primary.history.map(history=>history.followupEventId)).toContain('aigul-followup-2022-04-27-hrc-filing-confirmed');
  expect(primary.history.every(history=>['aigul-utepova','alnur-ilyashev'].includes(history.caseId))).toBe(true);
  expect(primary.history.every(history=>history.differences.some(difference=>difference.includes('不能推断')))).toBe(true);
  const tn=prepared(1);const reportUse=tn.steps.flatMap(step=>step.history).find(history=>history.followupEventId==='myriam-followup-report-used-appeal')!;
  expect(reportUse).toBeDefined();expect(reportUse.date).toBe('来源未明确事件日期');expect(reportUse.differences.join(' ')).toContain('来源归属声明');
  expect(tn.steps.flatMap(step=>step.history).every(history=>history.followupEventId!=='myriam-followup-scheduled-hearing')).toBe(true);
 });
 it('does not count recommendations, planned hearings or unconfirmed actions as implemented history',()=>{
  const {input,research,output}=prepared(1);const modified=structuredClone(followups);const record=modified.find(item=>item.caseId==='myriam-bribri')!;
  record.events.find(event=>event.eventId==='myriam-followup-report-used-appeal')!.executionStatus='planned';
  const steps=buildNextSteps(input,output,research,modified);
  expect(steps.flatMap(step=>step.history).some(history=>history.followupEventId==='myriam-followup-report-used-appeal')).toBe(false);
  expect(steps.flatMap(step=>step.history).every(history=>history.executionStatus==='implemented')).toBe(true);
  expect(steps.find(step=>step.actionId==='primary-drop_charges')!.basisGaps.join(' ')).toContain('建议数量不等于实际实施或成功数量');
 });
 it('keeps civil England and Wales separate and does not force history or law onto chronology preparation',()=>{
  const {steps}=prepared(2);expect(steps.every(step=>step.history.length===0)).toBe(true);
  expect(steps[0].materials.join(' ')).toContain('已有律师函');expect(steps[0].deliverables.join(' ')).toContain('严重损害');
  expect(steps[0].basisGaps.join(' ')).toContain('未找到');expect(steps[0].legalBindingIds.every(id=>!id.includes('criminal'))).toBe(true);
  const timeline=steps.find(step=>step.actionId==='prepare-case-file')!;expect(timeline.legalBindingIds).toEqual([]);expect(timeline.history).toEqual([]);expect(timeline.deliverables.join(' ')).toContain('真实页码');
 });
});

describe('owned references and unchanged historical meaning',()=>{
 it('rejects cross-case references, status upgrades and changed historical outcomes',()=>{
  const {steps,output,research}=prepared(0);
  const crossed=structuredClone(steps);crossed[0].history[0].caseId='emna-chargui';expect(validateNextStepLinks(crossed,output,research,followups).join(' ')).toContain('owner');
  const altered=structuredClone(steps);altered[0].history[0].outcome='该律师行动导致无罪获释';expect(validateNextStepLinks(altered,output,research,followups).join(' ')).toContain('outcome was altered');
  const upgraded=structuredClone(steps);upgraded[0].history[0].executionStatus='recommended_only';expect(validateNextStepLinks(upgraded,output,research,followups).join(' ')).toContain('status mismatch');
  const sourceSwap=structuredClone(steps);const history=sourceSwap.flatMap(step=>step.history).find(history=>history.followupEventId)!;history.sourceIds=[followups.find(item=>item.caseId==='emna-chargui')!.sources[0].sourceId];expect(validateNextStepLinks(sourceSwap,output,research,followups).join(' ')).toContain('another case');
 });
 it('does not turn an implemented risk event into an action recommendation merely because words match',()=>{
  const {input,output,research}=prepared(0);const copied=structuredClone(followups);const kz=copied.find(item=>item.caseId==='aigul-utepova')!;
  const risk={...structuredClone(kz.events[0]),eventId:'new-harassment-risk',action:'律师收到监测和公开倡议相关恐吓；已发生风险',executionStatus:'implemented' as const};kz.events.unshift(risk);
  const steps=buildNextSteps(input,output,research,copied);expect(steps.flatMap(step=>step.history).some(history=>history.followupEventId===risk.eventId)).toBe(false);
 });
 it('sorts dated follow-ups with unknown dates last and does not mark a planned hearing as completed',()=>{
  const record=followups.find(item=>item.caseId==='myriam-bribri')!;const html=renderToStaticMarkup(createElement(FollowupTimeline,{followup:record,locale:'zh'}));
  const eventHeadings=[...html.matchAll(/<summary><span>(.*?)<\/span>/g)].map(match=>match[1]);
  expect(html).toContain('计划中，未证实实施');expect(eventHeadings.findIndex(heading=>heading.includes('2022-03-30'))).toBeLessThan(eventHeadings.findIndex(heading=>heading.includes('2022-09-28')));expect(eventHeadings.at(-1)).toContain('事件日期未明确');
  expect(html).toContain('追加的公开追踪记录');expect(html).toContain('未独立验证');
 });
});

describe('snapshot and export preserve working-plan support',()=>{
 it('freezes follow-up text, source quotes and work products for the page and both downloads',async()=>{
  const input=structuredClone(DEMO_SCENARIOS[0].input);const result=await analyzeInput(input,{forceRule:true,config});
  const snapshot=snapshotForResult(result);expect(snapshot.nextSteps?.length).toBeGreaterThan(0);expect(snapshot.followups?.length).toBeGreaterThan(0);expect(snapshot.completeness).toBe('complete');
  const reportBefore=analysisMarkdown(result,input);const packBefore=workPackMarkdown(result,input);const htmlBefore=stepHtml(result);expect(reportBefore).toContain('What’s Next');expect(reportBefore).toContain('aigul-followup-2022-04-27-hrc-filing-confirmed');
  const prior=structuredClone(followups);const originalCases=structuredClone(cases);
  try{
   followups.forEach(record=>{record.summary='UPDATED FOLLOWUP';record.sources.forEach(source=>source.quote='UPDATED QUOTE');record.events.forEach(event=>event.outcome='UPDATED OUTCOME');});cases.forEach(record=>record.interventions.forEach(intervention=>intervention.action='UPDATED INTERVENTION'));
   expect(analysisMarkdown(result,input)).toBe(reportBefore);expect(workPackMarkdown(result,input)).toBe(packBefore);expect(stepHtml(result)).toBe(htmlBefore);
  }finally{followups.splice(0,followups.length,...prior);cases.splice(0,cases.length,...originalCases);}
 });
 it('does not backfill old reports from new follow-up records or working-plan templates',async()=>{
  const input=structuredClone(DEMO_SCENARIOS[0].input);const result=await analyzeInput(input,{forceRule:true,config});delete result.snapshot;
  expect(snapshotForResult(result).followups).toBeUndefined();expect(snapshotForResult(result).nextSteps).toBeUndefined();expect(stepHtml(result)).toBe('');expect(analysisMarkdown(result,input)).toContain('本历史报告没有保存后续追踪快照');expect(workPackMarkdown(result,input)).toContain('本报告没有保存本轮行动材料记录');
 });
});
