import {describe,it,expect,vi} from 'vitest';
import {analyzeInput} from '../src/lib/ai/service';
import {EMPTY_INPUT,type NewCaseInput,type WebModelAnalysisOutput} from '../src/lib/contracts';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {normalizeConfirmedGoal} from '../src/lib/intake/analysis';
import {hashInput} from '../src/lib/ai/hash';
import type {ServerConfig} from '../src/lib/ai/config';
import type {ModelTransport} from '../src/lib/ai/adapter';
import type {WebSearchTransport} from '../src/lib/research/provider';
import type {ResearchPlannerTransport} from '../src/lib/research/planner';

const config:ServerConfig={mode:'live',key:'unused-local-test',model:'local-test',configured:true,timeoutMs:1000,reasoningEffort:'low',maxOutputTokens:9000};
const input=():NewCaseInput=>({...structuredClone(EMPTY_INPUT),country:'中国',primaryGoal:'unknown',publicity:'private',intake:{version:1,jurisdiction:'unknown',caseKind:'civil',narrative:'我三角洲的账号找人代练跑刀，代练的人开挂把我的账号封禁了',goalText:'代练的人赔偿我的账号损失',disclosureDetails:'',answers:[],facts:[],confirmed:true}});
const planner:ResearchPlannerTransport=async()=>({domain:'digital_services',relationship:'游戏玩家与受托服务者',disputedConduct:['受托操作被指使用违规程序'],harms:['账号使用受限'],remedies:['服务损害的金钱补偿'],evidenceIssues:['操作记录与处罚之间的关联'],excludedIssues:[],uncertainties:['违规实施者尚待查明'],searchQueries:['游戏账号代操作 违规软件 违约 损害补偿','游戏服务争议 处罚记录 价值认定'],coverage:'adequate',privateTerms:['三角洲'],groundingQuotes:['代练的人开挂']});
function searchResponse(index:number){const text=index===1?'A historical media publication dispute.':'A historical dispute about paid account services and alleged prohibited software.';return {status:'completed',output:[{type:'web_search_call',status:'completed',action:{type:'search',query:index===1?'public dispute records':'game account services damages court'}},{type:'message',content:[{type:'output_text',text,annotations:[{type:'url_citation',url:`https://example.org/case-${index}`,title:`Fixture ${index}`,start_index:0,end_index:text.length}]}]}]};}
function modelResult(raw=input(),relevant=false):WebModelAnalysisOutput{
 const normalized=normalizeConfirmedGoal(raw);const base=buildRuleReference(normalized,[],'zh');
 const action={...base.actionOptions[0],actionId:'record-dispute',goal:'other' as const,title:'核对受托操作与账号处罚的关联',reason:'分别记录目前主张、已有材料和待确认事项。',leadRole:'当事人',timing:'在决定进一步处理前',applicability:'conditional' as const,requiresPublicity:false,resourceIds:[],supportingEvidenceIds:[],basisType:relevant?'web_research' as const:'general_preparation' as const,steps:['保留原始委托约定及付款记录。','按实际先后整理操作和处罚通知。','区分已记录的事实与仍需核对的说法。'],materials:['委托与付款记录','原始处罚通知'],followUp:['是否补全材料出处','是否能够对应关键事件']};
 return {...base,comparableCases:[],actionOptions:[action],webComparisons:relevant?[{title:'Public account-service dispute',jurisdiction:'China',statusAsOf:null,summary:'A public source describes account services and disputed conduct.',similarities:['Both concern the conduct of a hired account-service provider.'],differences:['The public case has different evidence and parties.'],sourceIds:['web-1']}]:[],actionWebSources:relevant?[{actionId:action.actionId,sourceIds:['web-1']}]:[]};
}

describe('semantic research recovery and action provenance',()=>{
 it('adopts a confirmed written remedy without mutating the draft; retries irrelevant research once with fresh citations',async()=>{
  const record=input();const before=structuredClone(record);let searches=0;let syntheses=0;
  const research:WebSearchTransport=vi.fn(async({query})=>{expect(JSON.stringify(query)).not.toMatch(/journalist|freedom of expression|fair trial|三角洲/);return searchResponse(++searches);});
  const plan=vi.fn(planner);
  const model:ModelTransport=vi.fn(async({data})=>{const context=JSON.parse(data);expect(context.userProvidedCase.primaryGoal).toBe('other');expect(context.userProvidedCase.intake.goalText).toBe(record.intake!.goalText);return {status:'completed',output_parsed:modelResult(record,++syntheses===2)};});
  const result=await analyzeInput(record,{config,transport:model,researchTransport:research,researchPlannerTransport:plan});
  expect(record).toEqual(before);expect(result.inputHash).toBe(hashInput(record));expect(plan).toHaveBeenCalledTimes(1);expect(research).toHaveBeenCalledTimes(2);expect(model).toHaveBeenCalledTimes(2);
  expect(result.researchAssessment).toMatchObject({status:'relevant_cases_found',attempts:2,recovery:'found_cases'});
  expect(result.webResearch!.sources.map(source=>source.url)).toEqual(['https://example.org/case-2']);
  expect(result.webResearch!.attempts).toHaveLength(2);expect(result.actionWebSources).toEqual([{actionId:'record-dispute',sourceIds:['web-1']}]);
  expect(result.actionOptions[0].title).toContain('账号');expect(result.actionOrigins).toEqual([{actionId:'record-dispute',origin:'ai',reason:null}]);
 });
 it('keeps the prior valid report and discloses a failed second search, without inventing comparisons',async()=>{
  let calls=0;const research:WebSearchTransport=async()=>{if(++calls===2)throw new Error('temporary upstream failure');return searchResponse(1);};
  const model:ModelTransport=async()=>({status:'completed',output_parsed:modelResult()});
  const result=await analyzeInput(input(),{config,transport:model,researchTransport:research,researchPlannerTransport:planner});
  expect(calls).toBe(2);expect(result.researchAssessment).toMatchObject({status:'no_relevant_cases',attempts:2,recovery:'unavailable'});expect(result.researchAssessment!.note).toContain('保留此前有效结果');
  expect(result.webResearch!.sources[0].url).toBe('https://example.org/case-1');expect(result.webResearch!.attempts?.[1].status).toBe('unavailable');expect(result.webComparisons).toEqual([]);
 });
 it('stops after two unhelpful passes and never presents source availability as relevance',async()=>{
  const research=vi.fn(async()=>searchResponse(1));const model=vi.fn(async()=>({status:'completed',output_parsed:modelResult()}));
  const result=await analyzeInput(input(),{config,transport:model,researchTransport:research,researchPlannerTransport:planner});
  expect(research).toHaveBeenCalledTimes(2);expect(result.webResearch!.status).toBe('completed');expect(result.researchAssessment).toMatchObject({status:'no_relevant_cases',recovery:'no_relevant_cases'});
 });
 it('distinguishes a completed second search without citations from an unavailable search',async()=>{
  let calls=0;
  const research:WebSearchTransport=async()=>++calls===1?searchResponse(1):{status:'completed',output:[{type:'web_search_call',status:'completed',action:{type:'search',query:'underlying service dispute'}}]};
  const result=await analyzeInput(input(),{config,researchTransport:research,researchPlannerTransport:planner,transport:async()=>({status:'completed',output_parsed:modelResult()})});
  expect(result.researchAssessment).toMatchObject({attempts:2,recovery:'no_relevant_cases'});
  expect(result.researchAssessment!.note).not.toContain('未完成');
  expect(result.webResearch!.attempts?.[1].status).toBe('no_results');
  expect(result.webResearch!.sources[0].url).toBe('https://example.org/case-1');
 });
 it('cancels during the additional search instead of silently returning the first result',async()=>{
  const controller=new AbortController();let calls=0;
  const research:WebSearchTransport=async()=>{if(++calls===2)controller.abort();return searchResponse(calls);};
  await expect(analyzeInput(input(),{config,signal:controller.signal,transport:async()=>({status:'completed',output_parsed:modelResult()}),researchTransport:research,researchPlannerTransport:planner})).rejects.toMatchObject({code:'CANCELLED'});
 });
 it('labels genuinely unspecified rule actions honestly and keeps explicit rule mode offline',async()=>{
  const record=input();record.intake!.goalText='';const research=vi.fn(async()=>searchResponse(1));
  const result=await analyzeInput(record,{config,forceRule:true,researchTransport:research,researchPlannerTransport:planner});
  expect(research).not.toHaveBeenCalled();expect(result.actionOrigins?.every(origin=>origin.origin==='rule')).toBe(true);expect(result.researchAssessment?.status).toBe('not_searched');
  expect(JSON.stringify(result.actionOptions)).not.toMatch(/释放、律师、撤诉|人身限制/);
 });
});
