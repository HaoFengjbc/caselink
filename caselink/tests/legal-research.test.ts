import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEMO_SCENARIOS} from '../data/demo/fixtures';
import {buildLegalResearch,attachRuleLegalCitations,validateLegalCitations,legalProceeding} from '../src/lib/legal-research';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {resources} from '../src/lib/corpus';
import {AnalysisResultSchema,type NewCaseInput} from '../src/lib/contracts';
import {analyzeInput} from '../src/lib/ai/service';
import {snapshotForResult} from '../src/lib/reports/snapshot';
import {LegalResearchView} from '../src/components/results/LegalResearch';
import {analysisMarkdown} from '../src/components/results/export';
const demo=(index:number)=>structuredClone(DEMO_SCENARIOS[index].input);
const cited=(input:NewCaseInput)=>{const research=buildLegalResearch(input);return {research,output:attachRuleLegalCitations(buildRuleReference(input),research)};};
const config={mode:'demo' as const,configured:false,key:'',model:'',timeoutMs:1000,reasoningEffort:'low' as const,maxOutputTokens:9000};

describe('case-specific legal research',()=>{
 it.each([0,1,2])('fictional demo %i has a concrete fact-to-provision chain and a linked action',index=>{
  const input=demo(index);const {research,output}=cited(input);
  expect(research.bindings.length).toBeGreaterThan(2);
  expect(research.bindings.some(binding=>resources.some(resource=>resource.resourceId===binding.resourceId&&(resource.type==='domestic_law'||resource.type==='procedure_rule')))).toBe(true);
  expect(research.bindings.every(binding=>binding.factBasis.some(fact=>fact.origin==='user_statement'&&fact.page===null&&fact.fileName===null))).toBe(true);
  const refs=output.actionOptions.flatMap(action=>action.legalCitations??[]);expect(refs.length).toBeGreaterThan(0);
  expect(validateLegalCitations(output,input,research)).toEqual([]);
  expect(output.actionOptions.find(action=>action.actionId==='prepare-case-file')?.legalCitations).toBeUndefined();
  const html=renderToStaticMarkup(createElement(LegalResearchView,{research,resources,locale:'zh'}));
  expect(html).toContain('相关事实与来源归属');expect(html).toContain('原文与准确定位');expect(html).toContain('适用条件与未知项');expect(html).toContain('下一步需核实或准备');
 });
 it('does not infer criminal procedure merely from a retained example ID after narrative edits',()=>{
  const input=demo(1);input.background.description='用户改写：尚不清楚是民事还是行政程序。';
  expect(legalProceeding(input)).toBe('unknown');
  expect(buildLegalResearch(input).bindings.every(binding=>binding.conditions.some(condition=>condition.label==='程序类型'&&condition.status==='unknown')||resources.find(resource=>resource.resourceId===binding.resourceId)?.sourceAudit?.proceedings.includes('all'))).toBe(true);
 });
 it('does not reuse England and Wales law for Scotland, even with the example ID retained',()=>{
  const input=demo(2);input.intake!.jurisdiction='scotland';
  const research=buildLegalResearch(input);expect(research.bindings).toEqual([]);expect(research.coverage).toBe('gap');
 });
 it('never imports criminal defence or detention procedure into a civil input',()=>{
  const civil=demo(2);const research=buildLegalResearch(civil);
  expect(research.bindings.some(binding=>binding.claimKey==='criminal_defence'||binding.resourceId==='iccpr-article-9')).toBe(false);
  const changed=demo(0);changed.intake={...civil.intake!,jurisdiction:'',narrative:'虚构民事纠纷，未记载刑事指控。'};
  expect(buildLegalResearch(changed).bindings).toEqual([]);
 });
 it('preserves unknown elements and explicitly excludes a premature strike-out step',()=>{
  const research=buildLegalResearch(demo(2));
  const defence=research.bindings.find(binding=>binding.claimKey==='ew_public_interest_defence')!;
  expect(defence.applicability).toBe('conditional');expect(defence.conditions.some(condition=>condition.status==='unknown')).toBe(true);
  const strikeout=research.bindings.find(binding=>binding.claimKey==='ew_slapp_procedural_route')!;
  expect(strikeout.applicability).toBe('excluded');expect(strikeout.conditions.some(condition=>condition.status==='not_met')).toBe(true);
  expect(strikeout.conditions.find(condition=>condition.status==='not_met')!.detail).toContain('这不证明对方尚未立案');
 });
 it('distinguishes checked treaty participation from unconfirmed domestic effect',()=>{
  const research=buildLegalResearch(demo(0));const iccpr=research.bindings.find(binding=>binding.resourceId==='iccpr-article-9')!;
  expect(iccpr.conditions.some(condition=>condition.label.includes('当前缔约状态')&&condition.status==='confirmed')).toBe(true);
  expect(iccpr.conditions.some(condition=>condition.label.includes('国内援引')&&condition.status==='unknown')).toBe(true);
 });
});

describe('legal citation rejection',()=>{
 it('rejects nonexistent IDs, a real but wrong provision, and a valid citation with an unsupported sentence',()=>{
  const input=demo(0);const {research,output}=cited(input);const base=structuredClone(output);
  output.actionOptions[0].legalCitations![0].bindingId='invented';expect(validateLegalCitations(output,input,research).join(' ')).toContain('does not match');
  const swapped=structuredClone(base);swapped.actionOptions[0].legalCitations![0].provisionId='art19-2-3';expect(validateLegalCitations(swapped,input,research).join(' ')).toContain('does not match');
  const unsupported=structuredClone(base);unsupported.actionOptions[0].prerequisites=['本案当然违法，必定应释放。'];unsupported.actionOptions[0].reason='A citation is not support for an unrelated claim.';
  expect(validateLegalCitations(unsupported,input,research).join(' ')).toContain('exact curated claim');
 });
 it('rejects a valid citation bundled with an additional invented law or definitive violation',()=>{
  const input=demo(0);const {research,output}=cited(input);
  output.actionOptions[0].reason+=' 第999条保证本案必须获释。';
  expect(validateLegalCitations(output,input,research).join(' ')).toContain('new numbered legal proposition');
  output.actionOptions[0].reason='本案当然违法';
  expect(validateLegalCitations(output,input,research).join(' ')).toContain('unsourced definitive legal conclusion');
 });
 it('independently rejects jurisdiction and criminal/civil mismatches even if a supplied research object is stale',()=>{
  const {research,output}=cited(demo(0));const errors=validateLegalCitations(output,demo(2),research).join(' ');
  expect(errors).toContain('jurisdiction mismatch');expect(errors).toContain('procedure mismatch');
 });
 it('rejects a referenced rule whose known stage condition is not met',()=>{
  const input=demo(2);const {research,output}=cited(input);const binding=research.bindings.find(item=>item.claimKey==='ew_slapp_procedural_route')!;
  output.actionOptions[0].legalCitations=[{bindingId:binding.bindingId,claimKey:binding.claimKey,resourceId:binding.resourceId,provisionId:binding.provisionId}];output.actionOptions[0].prerequisites=[binding.claim];
  expect(validateLegalCitations(output,input,research).join(' ')).toContain('excluded');
 });
});

describe('frozen legal sources and honest review state',()=>{
 it('page and export preserve law text, conditions and review state after catalog updates',async()=>{
  const input=demo(2);const result=await analyzeInput(input,{forceRule:true,config});
  const snapshot=snapshotForResult(result);expect(snapshot.legalResearch?.bindings.length).toBeGreaterThan(0);
  const binding=snapshot.legalResearch!.bindings[0];const source=resources.find(resource=>resource.resourceId===binding.resourceId)!;
  const before=analysisMarkdown(result,input);const html=()=>renderToStaticMarkup(createElement(LegalResearchView,{research:snapshotForResult(result).legalResearch,resources:snapshotForResult(result).resources,locale:'zh'}));const beforeHtml=html();
  expect(before).toContain(binding.claim);expect(beforeHtml).toContain('团队未人工复核');expect(before).toContain('尚未进行或未记录；Agent 检查不等于团队人工复核');
  const original=structuredClone(source);
  try{
   source.name='UPDATED RESOURCE';source.sourceAudit!.provisions[0].quote='NEW TEXT';source.sourceAudit!.provisions[0].explanation='NEW CLAIM';source.reviewStatus='team_verified';source.teamReviewer='Fictitious new catalog entry';source.teamReviewedAt='2027-01-01';
   expect(analysisMarkdown(result,input)).toBe(before);expect(html()).toBe(beforeHtml);
   const restored=AnalysisResultSchema.parse(JSON.parse(JSON.stringify(result)));expect(analysisMarkdown(restored,input)).toBe(before);
  }finally{Object.keys(source).forEach(key=>delete (source as Record<string,unknown>)[key]);Object.assign(source,original);}
 });
 it('legacy reports do not invent legal references from the current catalog',async()=>{
  const input=demo(0);const result=await analyzeInput(input,{forceRule:true,config});delete result.snapshot;
  expect(snapshotForResult(result).legalResearch).toBeUndefined();
  expect(analysisMarkdown(result,input)).toContain('本报告未保存逐条法律研究记录');
 });
});
