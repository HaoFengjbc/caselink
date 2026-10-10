import {describe,it,expect,vi} from 'vitest';
import {unavailableResearch} from './fixtures/research';
import {WHATS_NEXT_INPUTS} from './fixtures/whats-next';
import {EMPTY_INPUT,type NewCaseInput} from '../src/lib/contracts';
import type {ServerConfig} from '../src/lib/ai/config';
import {analyzeInput} from '../src/lib/ai/service';
import {retrieveCases} from '../src/lib/retrieval/match';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {contextFor,eligibleContext,dropIneligibleResources,validateModelOutput} from '../src/lib/evidence/validate';
import {defamationSignals,selectIssueLegalRefs} from '../src/lib/issue-legal-selection';
import {buildResearchQuery} from '../src/lib/research/query';
import {publicSearchPayload} from '../src/lib/research/openai-search';

const config:ServerConfig={mode:'live',configured:true,key:'unused-local-test-key',model:'local-mock',timeoutMs:1000,reasoningEffort:'low',maxOutputTokens:9000};
// The fictional Philippines case from the 2026-10-10 live check, as the manual form submits it: no person type and no structured problem.
const PH_NARRATIVE='（虚构案例）我是菲律宾宿务省一家地方新闻网站的记者。2023年4月12日，我们依据公开采购记录发表报道，指出一名市议员的亲属公司拿到了两份道路维修合同。2024年9月，这名议员以网络诽谤为由，依据《2012年网络犯罪预防法》向市检察官办公室提出控告。法院签发了逮捕令，我已缴纳保释金获释。';
const ph=():NewCaseInput=>({...structuredClone(EMPTY_INPUT),country:'菲律宾',currentProblems:['unknown'],primaryGoal:'other',publicity:'consent',intake:{version:1,jurisdiction:'unknown',caseKind:'criminal',narrative:PH_NARRATIVE,goalText:'弄清控告是否已超过追诉时效，并为律师整理一份事实清单。',disclosureDetails:'可以私下告诉记者保护组织；律师同意前不公开议员姓名，也不发布与本案有关的新报道。',answers:[],facts:[],confirmed:true,expression:'yes'}});

describe('an AI analysis is not discarded over one resource or one word',()=>{
 it('offers the model only resources this case can use',()=>{
  const input=ph();const ids=eligibleContext(contextFor(retrieveCases(input)),input).resources.map(r=>r.resourceId);
  expect(ids).not.toContain('cpj-emergency-help');
  expect(ids.filter(id=>/^(?:ew|kz|tn)-/.test(id))).toEqual([]);
  expect(ids).toContain('iccpr-article-19');
 });
 it('removes an ineligible resource from its action instead of rejecting everything, while the check itself still holds',()=>{
  const input=ph();const matches=retrieveCases(input);const full=contextFor(matches);
  const output=buildRuleReference(input,matches,'zh');output.actionOptions[0]!.resourceIds=['cpj-emergency-help'];
  expect(()=>validateModelOutput(structuredClone(output),input,full)).toThrow('记者协助入口');
  const kept=validateModelOutput(dropIneligibleResources(structuredClone(output),input),input,eligibleContext(full,input));
  expect(kept.actionOptions[0]!.resourceIds).toEqual([]);
 });
 it('reads “公开报道” as the published article, but still stops a step that publicises the case',()=>{
  const input=ph();const matches=retrieveCases(input);const context=eligibleContext(contextFor(matches),input);
  const noun=buildRuleReference(input,matches,'zh');noun.actionOptions[0]!.steps[0]='整理涉案的公开报道原文、发表时间和更正记录。';
  expect(()=>validateModelOutput(noun,input,context)).not.toThrow();
  const verb=buildRuleReference(input,matches,'zh');verb.actionOptions[0]!.steps[0]='律师同意后，争取公开报道本案。';
  expect(()=>validateModelOutput(verb,input,context)).toThrow('公开传播');
 });
 it('names the failed check when AI output is set aside, so finding it needs no paid rerun',async()=>{
  const input=ph();const output=buildRuleReference(input,[],'zh');output.actionOptions[0]!.goal='release';
  const transport=vi.fn(async()=>({status:'completed',output_parsed:output}));
  const result=await analyzeInput(input,{allowPreparationFallback:true,config,researchTransport:unavailableResearch,transport});
  expect(transport).toHaveBeenCalledOnce();expect(result.mode).toBe('rule_reference');
  expect(result.limitations.join(' ')).toContain('AI 整理未完成（INVALID_MODEL_OUTPUT）：生成方案更改了用户的当前目标');
 });
});

describe('local law is found from the legal subject the case names',()=>{
 it('recognises defamation, including a demand letter asking for an apology, but not a negated mention',()=>{
  expect(defamationSignals('没有被逮捕，不涉及国家安全，也不是诽谤。已有律师，收到律师函。').defamation).toBe(false);
  expect(defamationSignals(WHATS_NEXT_INPUTS[1]!.intake!.narrative).defamation).toBe(true);
  expect(defamationSignals(PH_NARRATIVE)).toEqual({defamation:true,online:true});
  expect(defamationSignals('We received a demand letter asking us to retract the story.').defamation).toBe(true);
 });
 it('binds the England and Wales defamation provisions to the V-92 demand letter',()=>{
  expect(selectIssueLegalRefs(WHATS_NEXT_INPUTS[1]!).map(ref=>ref[0])).toContain('ew-defamation-act-2013');
 });
 it('searches for the legal subject without placeholders or repeated words, and the public payload check accepts it',()=>{
  const q=buildResearchQuery(ph());
  expect(q.searchTerms.join(' | ')).not.toMatch(/unconfirmed|journalism expression journalism/);
  expect(q.searchTerms).toContain('Philippines online defamation cyber libel law official legislation text');
  expect(JSON.stringify(q)).not.toMatch(/宿务|议员|2023|网络犯罪预防法/);
  expect(()=>publicSearchPayload(q)).not.toThrow();
  const uk=buildResearchQuery(WHATS_NEXT_INPUTS[1]!);
  expect(uk.searchTerms.some(term=>/^England and Wales .*defamation law official legislation text$/.test(term))).toBe(true);
  expect(()=>publicSearchPayload(uk)).not.toThrow();
 });
});

describe('one failing action does not discard the rest of a live analysis',()=>{
 const twoActions=(second:string)=>{
  const input=ph();const output=buildRuleReference(input,[],'zh');const first=output.actionOptions[0]!;
  output.actionOptions=[first,{...structuredClone(first),actionId:'second-action',title:'第二项准备',steps:[second,...first.steps.slice(1)]}];
  return {input,output};
 };
 it('keeps the actions that pass on their own and says what was removed; direct validation stays strict',async()=>{
  const {input,output}=twoActions('参考 Asad Ali Toor 案的做法整理材料。');
  expect(()=>validateModelOutput(structuredClone(output),input,eligibleContext(contextFor([]),input))).toThrow('方案提到历史案');
  const transport=vi.fn(async()=>({status:'completed',output_parsed:output}));
  const result=await analyzeInput(input,{config,researchTransport:unavailableResearch,transport});
  expect(result.mode).toBe('live_ai');expect(result.actionOptions.map(action=>action.actionId)).toEqual([output.actionOptions[0]!.actionId]);
  expect(result.limitations.join(' ')).toContain('AI 生成的 1 条行动建议未通过校验，已去掉（方案提到历史案');
 });
 it('still sets the analysis aside when no action passes on its own',async()=>{
  const {input,output}=twoActions('参考 Asad Ali Toor 案的做法整理材料。');output.actionOptions[0]!.steps[0]='参考 Aigul Utepova 案的做法整理材料。';
  const transport=vi.fn(async()=>({status:'completed',output_parsed:output}));
  await expect(analyzeInput(input,{config,researchTransport:unavailableResearch,transport})).rejects.toMatchObject({code:'INVALID_MODEL_OUTPUT'});
 });
});
