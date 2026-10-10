import {describe,it,expect} from 'vitest';
import {analyzeInput} from '../src/lib/ai/service';
import {WHATS_NEXT_INPUTS} from './fixtures/whats-next';
import {buildWorkingDocuments,workingDocumentMarkdown} from '../src/components/results/working-documents';
import {workPackMarkdown} from '../src/components/results/work-pack';
import {analysisMarkdown} from '../src/components/results/export';
import {buildComparisonBrief,parseComparisonBrief,serializeComparisonBrief} from '../src/components/research/comparison-data';
import {comparisonMarkdown} from '../src/components/results/comparison-export';
import {resources,followups} from '../src/lib/corpus';

describe('case-filled working materials',()=>{
 for(const input of WHATS_NEXT_INPUTS)it(`three usable frozen drafts without exampleId: ${input.country}`,async()=>{
  const result=await analyzeInput(input,{forceRule:true});const docs=result.snapshot!.whatsNext!.documents;
  expect(docs.map(d=>d.kind)).toEqual(['timeline','issue_matrix','lawyer_brief']);
  for(const d of docs){expect(d.markdown).toContain(input.intake!.narrative);expect(d.markdown).toContain(input.intake!.disclosureDetails);expect(d.markdown).toContain(input.intake!.goalText);expect(d.markdown).toContain('冻结来源与命题定位');expect(d.markdown).toContain('未经独立核实');expect(d.progress).toBe('draft');expect(d.markdown.length).toBeGreaterThan(900);}
  expect(docs[0].markdown).toContain('本报告未保存新案材料的文件名/页码索引');
  expect(docs[2].markdown).toContain('以下为引用附件，独立于一页简报正文');
  expect(workPackMarkdown(result,input)).toContain(docs[1].markdown);
  expect(analysisMarkdown(result,input)).toContain(docs[2].markdown);
 });
 it('does not rebuild old reports or silently change documents after source edits',async()=>{
  const input=WHATS_NEXT_INPUTS[0],result=await analyzeInput(input,{forceRule:true});const before=buildWorkingDocuments(input,result);
  const old=resources[0].name;try{resources[0].name='A changed current resource';result.legalResearch!.bindings=[];expect(buildWorkingDocuments(input,result)).toEqual(before);}finally{resources[0].name=old;}
  const legacy=structuredClone(result);delete legacy.snapshot!.whatsNext;expect(buildWorkingDocuments(input,legacy)).toEqual([]);
 });
 it('exports user-edited text with a recheck marker without upgrading actual progress',async()=>{
  const result=await analyzeInput(WHATS_NEXT_INPUTS[0],{forceRule:true});const d=structuredClone(result.snapshot!.whatsNext!.documents[1]);d.markdown+='\n用户新增命题：仍待文书核对。';d.status='user_edited';d.citationState='needs_review';const md=workingDocumentMarkdown(d);
  expect(md).toContain('用户新增命题');expect(md).toContain('原引用与命题须重新核对');expect(md).toContain('draft');expect(md).toContain('不会将行动标记为');
 });
 it('marks missing or non-supporting binding metadata for rechecking',async()=>{
  const input=WHATS_NEXT_INPUTS[0],result=await analyzeInput(input,{forceRule:true});const snapshot=result.snapshot!,binding=snapshot.legalResearch!.bindings.find(b=>snapshot.whatsNext!.priorities.some(t=>t.legalBindingIds.includes(b.bindingId)))!;
  expect(binding).toBeTruthy();binding.claim='An altered proposition not supported by the frozen provision';expect(buildWorkingDocuments(input,result).every(d=>d.citationState==='needs_review')).toBe(true);
 });
 it('civil and information-poor documents differ substantially from the detention brief',async()=>{
  const results=await Promise.all(WHATS_NEXT_INPUTS.map(input=>analyzeInput(input,{forceRule:true})));const drafts=results.map(r=>r.snapshot!.whatsNext!.documents[2].markdown);
  expect(drafts[0]).toContain('被带走');expect(drafts[1]).toContain('律师函');expect(drafts[2]).toContain('采访许可');expect(drafts[2]).toContain('日期未确认');
  expect(results[1].snapshot!.whatsNext!.priorities.flatMap(t=>t.history)).toHaveLength(0);
  expect(results[2].snapshot!.whatsNext!.priorities.flatMap(t=>t.history)).toHaveLength(0);
 });
});
describe('frozen action follow-up comparison',()=>{
 it('captures separate follow-up records and exports actors, scope, source dates and unknowns',()=>{
  const brief=buildComparisonBrief(['aigul-utepova','alnur-ilyashev']);expect(brief.snapshot.followups?.length).toBe(2);
  const before=comparisonMarkdown(brief);expect(before).toContain('后续行动与结果比较');expect(before).toContain(brief.snapshot.followups![0].events[0].action);
  const old=followups[0].summary;try{followups[0].summary='Current catalog changed';expect(comparisonMarkdown(brief)).toBe(before);}finally{followups[0].summary=old;}
  expect(parseComparisonBrief(serializeComparisonBrief(brief)).snapshot.followups).toEqual(brief.snapshot.followups);
  const legacy=structuredClone(brief);delete legacy.snapshot.followups;expect(comparisonMarkdown(legacy)).toContain('此快照未保存后续记录');
 });
});
