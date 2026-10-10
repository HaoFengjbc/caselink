import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {GET as capabilities} from '../src/app/api/capabilities/route';
import {POST as analyze} from '../src/app/api/analyze/route';
import {DEMO_SCENARIOS} from '../data/demo/fixtures';
import {AnalysisResultSchema,type NewCaseInput} from '../src/lib/contracts';
import {readConfig} from '../src/lib/ai/config';
import {runExecution} from '../src/lib/ai/execution';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {buildResearchQuery} from '../src/lib/research/query';
import {openAIWebSearchConfigured,publicSearchPayload} from '../src/lib/research/openai-search';
import {openAIWebSearchTransport,researchWeb} from '../src/lib/research/provider';

const url='https://www.judiciary.uk/judgments/fixture-case/';
const otherUrl='https://www.judiciary.uk/judgments/unopened/';
const input=():NewCaseInput=>({...structuredClone(DEMO_SCENARIOS[0].input),country:'GB',stage:'trial',currentProblems:['unknown'],primaryGoal:'other',isExample:false,exampleId:null,intake:{version:1,jurisdiction:'england_wales',caseKind:'civil',narrative:'Fictional private name Violet Hush, PRIVATE_NARRATIVE_921.',goalText:'PRIVATE_GOAL_922',disclosureDetails:'Internal only PRIVATE_DISCLOSURE_923',answers:[],facts:[],confirmed:true,expression:'yes'}});
const identity={requestId:'openai-search-test',inputVersion:1,operation:'initial' as const};
const tool=(type:'search'|'open_page',source=url)=>({type:'web_search_call',id:`ws_${type}`,status:'completed',action:type==='search'?{type,queries:['England and Wales expression civil judgment'],sources:[{type:'url',url:source}]}:{type,url:source}});
const message=(text:string,source=url)=>({type:'message',role:'assistant',status:'completed',id:'msg',content:[{type:'output_text',text,annotations:[{type:'url_citation',url:source,title:'Fictional court judgment',start_index:0,end_index:text.length}]}]});
const response=(output:unknown[])=>({id:'resp_mock',object:'response',created_at:0,status:'completed',model:'test-model',usage:{input_tokens:12,output_tokens:20},output});
const discovery=()=>response([tool('search'),message('Discovery candidate only, do not retain this summary.')]);
const reading=()=>response([tool('open_page'),message('A fictional civil claim proceeded to trial. The appeal later reversed the judgment; the appeal date is not stated.')]);
function mockProvider(){
 return vi.fn().mockResolvedValueOnce(Response.json(discovery())).mockResolvedValueOnce(Response.json(reading()));
}
beforeEach(()=>{
 vi.stubEnv('ANALYSIS_MODE','live');vi.stubEnv('OPENAI_API_KEY','offline-fixture-key');vi.stubEnv('OPENAI_MODEL','test-model');
 vi.stubEnv('OPENAI_WEB_SEARCH_ENABLED','true');vi.stubEnv('BRAVE_SEARCH_API_KEY','');vi.stubEnv('CONTROLLED_SEARCH_ENABLED','false');
 vi.spyOn(console,'info').mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('OpenAI search restoration (mocked SDK HTTP, no real provider calls)',()=>{
 it('uses the existing live model configuration with no Brave or extra mandatory switch',async()=>{
  expect(openAIWebSearchConfigured(readConfig(),{})).toBe(true);
  expect(openAIWebSearchConfigured(readConfig(),{OPENAI_WEB_SEARCH_ENABLED:'false'})).toBe(false);
  expect(openAIWebSearchConfigured({...readConfig(),mode:'demo'},{})).toBe(false);
  expect(openAIWebSearchConfigured({...readConfig(),key:''},{})).toBe(false);
  const result=await capabilities(new NextRequest('https://caselink.example/api/capabilities'));
  expect(await result.json()).toMatchObject({liveAvailable:true,webSearchAvailable:true,webSearchProvider:'openai',controlledSearchConfigured:false});
  expect(result.headers.get('cache-control')).toContain('no-store');
 });
 it('sends only canonical public topics, then reads selected sources and records real tool metadata',async()=>{
  const http=mockProvider();vi.stubGlobal('fetch',http);
  const value=await runExecution(identity,'analysis',()=>researchWeb(input(),readConfig()));
  expect(value.status).toBe('completed');expect(http).toHaveBeenCalledTimes(2);
  expect(value.sources).toMatchObject([{url,pageOpened:true,citationKind:'url_annotation'}]);
  expect(value.passages[0].text).toContain('appeal later reversed');expect(JSON.stringify(value.passages)).not.toContain('Discovery candidate');
  expect(value.actualQueries).toEqual(['England and Wales expression civil judgment']);expect(value.searchCallCount).toBe(1);
  expect(value.execution).toMatchObject({controlledSearch:false,stages:[{stage:'search',toolCalls:1,inputTokens:12},{stage:'reading',toolCalls:1,outputTokens:20}]});
  for(const [target,options] of http.mock.calls){
   expect(String(target)).toBe('https://api.openai.com/v1/responses');const body=JSON.parse(options.body);
   expect(body).toMatchObject({model:'test-model',store:false,tool_choice:'required',tools:[{type:'web_search',external_web_access:true}]});
   expect(JSON.stringify(body)).not.toMatch(/Violet Hush|PRIVATE_|offline-fixture-key/);
  }
  expect(JSON.parse(http.mock.calls[0][1].body).max_tool_calls).toBe(4);expect(JSON.parse(http.mock.calls[1][1].body).max_tool_calls).toBe(8);
  expect(JSON.parse(http.mock.calls[1][1].body).input[0].content).toContain(url);
 });
 it('excludes injected planner prose and rejects query tampering before any request',async()=>{
  const query=buildResearchQuery(input());query.plan.relationship='PRIVATE_PLAN_NAME';query.plan.searchQueries=['PRIVATE_PLAN_QUERY'];
  expect(JSON.stringify(publicSearchPayload(query))).not.toContain('PRIVATE_');
  query.searchTerms=['PRIVATE_NAME exact address'];const http=vi.fn();vi.stubGlobal('fetch',http);
  await expect(openAIWebSearchTransport({config:readConfig(),query,locale:'en',signal:new AbortController().signal})).rejects.toThrow('unapproved_search_query');expect(http).not.toHaveBeenCalled();
 });
 it.each([
  ['KZ','national','criminal','pretrial','release',['detained']],
  ['TN','national','criminal','appeal','drop_charges',['file_access']],
  ['GB','scotland','civil','trial','other',[]],
  ['unknown','unknown','unknown','unknown','unknown',[]],
 ] as const)('keeps canonical country/procedure/stage for %s', (country,jurisdiction,kind,stage,goal,problems)=>{
  const value=input();value.country=country;value.intake!.jurisdiction=jurisdiction;value.intake!.caseKind=kind;value.stage=stage;value.primaryGoal=goal;value.currentProblems=[...problems];
  expect(publicSearchPayload(buildResearchQuery(value))).toMatchObject({caseKind:kind,stage});
 });
 it('does not promote discovery snippets if the reading request never opens a candidate',async()=>{
  const http=vi.fn().mockResolvedValueOnce(Response.json(discovery())).mockResolvedValueOnce(Response.json(response([tool('search'),message('A later search snippet is not source reading.')])));vi.stubGlobal('fetch',http);
  const result=await researchWeb(input(),readConfig());expect(result).toMatchObject({status:'no_results',failureReason:'no_citations',sources:[]});expect(http).toHaveBeenCalledTimes(2);
 });
 it('rejects citations to pages that were not selected in discovery',async()=>{
  const http=vi.fn().mockResolvedValueOnce(Response.json(discovery())).mockResolvedValueOnce(Response.json(response([tool('open_page',otherUrl),message('A different page must not become a selected citation.',otherUrl)])));vi.stubGlobal('fetch',http);
  expect(await researchWeb(input(),readConfig())).toMatchObject({status:'no_results',sources:[]});
 });
 it('accepts four reading tool actions but still rejects a response beyond the reading budget',async()=>{
  for(const [count,status] of [[4,'completed'],[9,'unavailable']] as const){
   const http=vi.fn().mockResolvedValueOnce(Response.json(discovery())).mockResolvedValueOnce(Response.json(response([...Array.from({length:count},()=>tool('open_page')),message('The selected judgment states the outcome of this fictional proceeding.')])));vi.stubGlobal('fetch',http);
   expect((await researchWeb(input(),readConfig())).status).toBe(status);expect(http).toHaveBeenCalledTimes(2);
  }
 });
 it('does not search without explicit AI/live availability and never retries provider failures',async()=>{
  const http=vi.fn(async()=>Response.json({error:{message:'PRIVATE_PROVIDER_DIAGNOSTIC',type:'requests',code:'rate_limit_exceeded'}},{status:429}));vi.stubGlobal('fetch',http);
  vi.stubEnv('OPENAI_WEB_SEARCH_ENABLED','false');expect(await researchWeb(input(),readConfig())).toMatchObject({failureReason:'web_search_disabled'});expect(http).not.toHaveBeenCalled();
  vi.stubEnv('OPENAI_WEB_SEARCH_ENABLED','true');const result=await researchWeb(input(),readConfig());expect(result).toMatchObject({status:'unavailable',failureReason:'search_failed'});expect(http).toHaveBeenCalledOnce();expect(JSON.stringify(result)).not.toContain('PRIVATE_PROVIDER');
 });
 it('cancellation after discovery prevents the reading request',async()=>{
  const controller=new AbortController();const http=vi.fn(async()=>{controller.abort();return Response.json(discovery());});vi.stubGlobal('fetch',http);
  await expect(researchWeb(input(),readConfig(),controller.signal)).rejects.toMatchObject({code:'CANCELLED'});expect(http).toHaveBeenCalledOnce();
 });
 it('preserves the actual completed search when source reading fails',async()=>{
  const http=vi.fn().mockResolvedValueOnce(Response.json(discovery())).mockResolvedValueOnce(Response.json({error:{message:'fixture failure',type:'requests',code:'rate_limit_exceeded'}},{status:429}));vi.stubGlobal('fetch',http);
  const result=await researchWeb(input(),readConfig());expect(result).toMatchObject({status:'unavailable',failureReason:'search_failed',searchCallCount:1,actualQueries:['England and Wales expression civil judgment'],sources:[]});expect(http).toHaveBeenCalledTimes(2);
 });
 it('retains valid retrieved sources if synthesis fails and the route falls back to rule drafts',async()=>{
  const http=mockProvider();http.mockResolvedValueOnce(Response.json(response([message('{"invalid":"fixture"}')])));vi.stubGlobal('fetch',http);
  const request=new NextRequest('https://caselink.example/api/analyze',{method:'POST',headers:{origin:'https://caselink.example',host:'caselink.example','content-type':'application/json'},body:JSON.stringify({...identity,input:input()})});
  const result=await analyze(request);expect(result.status).toBe(200);const report=AnalysisResultSchema.parse(await result.json());expect(report.mode).toBe('rule_reference');expect(report.whatsNext?.documents).toHaveLength(3);expect(report.webResearch?.status).toBe('completed');expect(report.limitations.join(' ')).toContain('INVALID_MODEL_OUTPUT');
 });
 it('runs the default analyze route through search, reading, synthesis, citation checks and snapshot',async()=>{
  const http=mockProvider();http.mockResolvedValueOnce(Response.json(response([message(JSON.stringify({...buildRuleReference(input(),[]),webComparisons:[],actionWebSources:[]}))])));vi.stubGlobal('fetch',http);
  const request=(forceRule=false)=>new NextRequest('https://caselink.example/api/analyze',{method:'POST',headers:{origin:'https://caselink.example',host:'caselink.example','content-type':'application/json'},body:JSON.stringify({...identity,input:input(),forceRule,preferences:{aiEnabled:true,saveMode:'memory',refreshRecovery:false,expiresAt:null}})});
  const result=await analyze(request());expect(result.status,JSON.stringify(await result.clone().json())).toBe(200);const report=AnalysisResultSchema.parse(await result.json());
  expect(report.mode).toBe('live_ai');expect(report.webResearch?.status).toBe('completed');expect(report.snapshot?.webResearch).toEqual(report.webResearch);
  expect(report.execution?.stages.map(stage=>stage.stage)).toEqual(['search','reading','synthesis']);expect(report.limitations.join(' ')).toContain('联网工具已打开');
  expect(report.limitations.join(' ')).not.toContain('未读取完整网页');expect(http).toHaveBeenCalledTimes(3);
  expect((await analyze(request(true))).status).toBe(200);expect(http).toHaveBeenCalledTimes(3);
 });
});
