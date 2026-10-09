import {describe,it,expect,vi} from 'vitest';
import {analyzeInput} from '../src/lib/ai/service';
import {EMPTY_INPUT,type NewCaseInput} from '../src/lib/contracts';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {normalizeConfirmedGoal} from '../src/lib/intake/analysis';
import {hashInput} from '../src/lib/ai/hash';
import type {ServerConfig} from '../src/lib/ai/config';
import type {WebSearchTransport} from '../src/lib/research/provider';
const config:ServerConfig={mode:'live',key:'unused-local-test',model:'local-test',configured:true,timeoutMs:1000,reasoningEffort:'low',maxOutputTokens:9000};
const input=():NewCaseInput=>({...structuredClone(EMPTY_INPUT),country:'英国',primaryGoal:'unknown',publicity:'private',intake:{version:1,jurisdiction:'england_wales',caseKind:'civil',narrative:'虚构记者发表公共利益报道后收到诽谤诉讼威胁，尚未起诉。',goalText:'整理给当地律师的案件材料',disclosureDetails:'仅限内部，不联系媒体',answers:[],facts:[],confirmed:true,expression:'yes'}});
const searchResponse=()=>{const text='Fictional public report of an expression dispute. Its relevance is unknown.';return {status:'completed',output:[{type:'web_search_call',status:'completed',action:{type:'search',query:'approved expression comparison'}},{type:'message',content:[{type:'output_text',text,annotations:[{type:'url_citation',url:'https://example.org/public-fixture',title:'Fictional fixture',start_index:0,end_index:text.length}]}]}]};};
const modelResult=(record=input())=>({...buildRuleReference(normalizeConfirmedGoal(record),[],'zh'),webComparisons:[],actionWebSources:[]});
describe('one user intent, one research round with honest action provenance',()=>{
 it('preserves confirmed goal and disclosure without automatically re-searching rejected comparisons',async()=>{
  const record=input(),before=structuredClone(record),search=vi.fn(async()=>searchResponse()),planner=vi.fn();
  const model=vi.fn(async({data}:{data:string})=>{const context=JSON.parse(data);expect(context.userProvidedCase.primaryGoal).toBe('other');expect(context.userProvidedCase.intake.disclosureDetails).toBe(before.intake!.disclosureDetails);return {status:'completed',output_parsed:modelResult(record)};});
  const result=await analyzeInput(record,{config,transport:model,researchTransport:search,researchPlannerTransport:planner});
  expect(record).toEqual(before);expect(result.inputHash).toBe(hashInput(record));expect(search).toHaveBeenCalledOnce();expect(model).toHaveBeenCalledOnce();expect(planner).not.toHaveBeenCalled();expect(result.researchAssessment).toMatchObject({status:'no_relevant_cases',attempts:1,recovery:'not_needed'});expect(result.snapshot?.completeness).toBe('complete');
 });
 it('does not retry a failed first search and transparently falls back to corpus synthesis',async()=>{
  const search=vi.fn(async()=>{throw new Error('unavailable');});const result=await analyzeInput(input(),{config,researchTransport:search,transport:async()=>({status:'completed',output_parsed:buildRuleReference(normalizeConfirmedGoal(input()),[])})});expect(search).toHaveBeenCalledOnce();expect(result.researchAssessment).toMatchObject({status:'search_unavailable',attempts:1,recovery:'not_needed'});
 });
 it('performs a supplement only from the explicit request identity',async()=>{
  const search:WebSearchTransport=vi.fn(async({query})=>{expect(query.attempt).toBe(2);return searchResponse();});
  const result=await analyzeInput(input(),{config,identity:{requestId:'supplement-0001',inputVersion:1,operation:'supplement',parentAnalysisId:'parent-0001'},researchTransport:search,transport:async()=>({status:'completed',output_parsed:modelResult()})});expect(search).toHaveBeenCalledOnce();expect(result.webResearch?.attempts?.[0].reason).toBe('manual_supplement');
 });
 it('cancellation stops the single round before synthesis',async()=>{
  const controller=new AbortController(),model=vi.fn();const search:WebSearchTransport=async()=>{controller.abort();return searchResponse();};await expect(analyzeInput(input(),{config,signal:controller.signal,transport:model,researchTransport:search})).rejects.toMatchObject({code:'CANCELLED'});expect(model).not.toHaveBeenCalled();
 });
 it('retains the explicit offline rule entry point, including for out-of-domain notes',async()=>{
  const record=input();record.intake!.expression='no';const search=vi.fn();const result=await analyzeInput(record,{config,forceRule:true,researchTransport:search});expect(search).not.toHaveBeenCalled();expect(result.mode).toBe('rule_reference');expect(result.domain?.status).toBe('out_of_scope');expect(result.comparableCases).toEqual([]);
 });
});
