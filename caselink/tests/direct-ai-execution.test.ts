import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {POST as analyze} from '../src/app/api/analyze/route';
import {POST as intake} from '../src/app/api/intake/route';
import {GET as capabilities} from '../src/app/api/capabilities/route';
import {runExecution,recordModel,recordSearch,currentExecution} from '../src/lib/ai/execution';
import {DEMO_SCENARIOS} from '../data/demo/fixtures';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {AnalysisResultSchema,type NewCaseInput} from '../src/lib/contracts';
import type {RequestIdentity} from '../src/lib/workflow-contracts';
const input=():NewCaseInput=>({...structuredClone(DEMO_SCENARIOS[0].input),intake:{version:1,jurisdiction:'national',caseKind:'criminal',narrative:'FICTIONAL reporter was detained after a public-interest article.',goalText:'Prepare papers for release with a lawyer',disclosureDetails:'Internal only',answers:[],facts:[],confirmed:true,expression:'yes'}});
const identity=(extra:Partial<RequestIdentity>={}):RequestIdentity=>({requestId:'direct-test-request',inputVersion:1,operation:'initial',...extra});
const request=(route:string,value=input(),extra:Record<string,unknown>={})=>new NextRequest(`https://caselink.example${route}`,{method:'POST',headers:{origin:'https://caselink.example',host:'caselink.example','content-type':'application/json'},body:JSON.stringify({...identity(),input:value,...extra})});
function mockProvider(){
 const output=buildRuleReference(input());
 return vi.fn(async(url:unknown,options?:RequestInit)=>{
  expect(String(url)).toBe('https://api.openai.com/v1/responses');
  const body=JSON.parse(String(options?.body));expect(body.store).toBe(false);
  const value=body.text.format.name==='caselink_intake'?{facts:[],questions:[]}:output;
  return Response.json({id:'resp_mock',object:'response',created_at:0,status:'completed',model:'test-model',usage:{input_tokens:200,output_tokens:300},output:[{id:'msg_mock',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value),annotations:[]}]}]});
 });
}
beforeEach(()=>{
 for(const [key,value] of Object.entries({ANALYSIS_MODE:'live',OPENAI_API_KEY:'fixture-only-never-transmitted',OPENAI_MODEL:'test-model',OPENAI_INTAKE_MODEL:'test-model',CONTROLLED_SEARCH_ENABLED:'false',UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:'',USAGE_SESSION_SECRET:'',AI_MODEL_RATES_JSON:'invalid',AI_GLOBAL_DAILY_BUDGET_USD:'0',AI_SESSION_DAILY_REQUESTS:'0',AI_IP_DAILY_REQUESTS:'0',AI_GLOBAL_CONCURRENCY:'0',AI_SESSION_CONCURRENCY:'0'}))vi.stubEnv(key,value);
 vi.spyOn(console,'info').mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('direct AI route integration (mock provider; no real paid calls)',()=>{
 it('makes AI available with key/model only, without cookies, pricing, Redis or usage gates',async()=>{
  const response=await capabilities(new NextRequest('https://caselink.example/api/capabilities'));
  expect(await response.json()).toMatchObject({liveAvailable:true,paidProtectionEnabled:false,serverResultRetentionSeconds:0,idempotencyEnabled:false,webSearchAvailable:false});
  expect(response.headers.get('set-cookie')).toBeNull();
 });
 it('calls both live endpoints immediately and returns measured stages and a full report snapshot',async()=>{
  const provider=mockProvider();vi.stubGlobal('fetch',provider);
  const response=await analyze(request('/api/analyze'));expect(response.status).toBe(200);
  const result=AnalysisResultSchema.parse(await response.json());expect(result.mode).toBe('live_ai');expect(result.snapshot?.completeness).toBe('complete');
  expect(result.execution).toMatchObject({...identity(),reservedCostUsd:null,actualCostUsd:null,stages:[{stage:'synthesis',model:'test-model',inputTokens:200,outputTokens:300}]});
  const organized=await intake(request('/api/intake'));expect(organized.status).toBe(200);expect(await organized.json()).toMatchObject({mode:'live_ai',execution:{stages:[{stage:'intake'}]}});
  expect(provider).toHaveBeenCalledTimes(2);expect(response.headers.get('set-cookie')).toBeNull();
 });
 it('does not impose daily, per-IP, session or concurrent quotas',async()=>{
  const provider=mockProvider();vi.stubGlobal('fetch',provider);
  const responses=await Promise.all(Array.from({length:35},()=>intake(request('/api/intake'))));
  expect(responses.every(response=>response.status===200)).toBe(true);expect(provider).toHaveBeenCalledTimes(35);
 });
 it('does not cache results or failed requests; edited input and explicit supplements can run again',async()=>{
  const provider=mockProvider();vi.stubGlobal('fetch',provider);
  provider.mockImplementationOnce(async()=>Response.json({error:{type:'requests',code:'rate_limit_exceeded',message:'private diagnostic'}},{status:429}));
  const failed=await analyze(request('/api/analyze'));expect(failed.status).toBe(200);const fallback=await failed.json();expect(fallback.mode).toBe('rule_reference');expect(fallback.limitations.join(' ')).toContain('RATE_LIMITED');expect(fallback.whatsNext.documents).toHaveLength(3);
  const value=input();value.intake!.narrative+=' Fictional additional document.';
  for(const [version,operation] of [[2,'initial'],[2,'supplement'],[2,'supplement']] as const){
   const response=await analyze(request('/api/analyze',value,{inputVersion:version,operation,parentAnalysisId:'prior-report-id'}));expect(response.status).toBe(200);
  }
  expect(provider).toHaveBeenCalledTimes(4);
 });
 it('still honors AI-off, manual/rule mode and expression scope before model calls',async()=>{
  const provider=mockProvider();vi.stubGlobal('fetch',provider);
  for(const handler of [analyze,intake])for(const expression of ['no','unsure'] as const){const value=input();value.intake!.expression=expression;expect((await handler(request('/api/analyze',value))).status).toBe(422);}
  const extra={preferences:{aiEnabled:false,saveMode:'memory',refreshRecovery:false,expiresAt:null}};
  expect((await analyze(request('/api/analyze',input(),extra))).status).toBe(200);expect((await intake(request('/api/intake',input(),extra))).status).toBe(200);expect(provider).not.toHaveBeenCalled();
 });
});
describe('execution diagnostics without admission controls',()=>{
 it('permits transports without a diagnostics context and does not impose model/search call limits',async()=>{
  const invoke=vi.fn(async()=>({model:'any-model',usage:{input_tokens:1,output_tokens:2}}));
  await recordModel('intake','any-model',invoke);
  const result=await runExecution(identity(),'analysis',async()=>{
   for(let i=0;i<4;i++){await recordModel('synthesis','different-model',invoke);await recordSearch(async()=>true);}
   return {analysisId:'diagnostic-only'};
  },vi.fn());
  expect(invoke).toHaveBeenCalledTimes(5);expect(result.execution?.stages).toHaveLength(8);expect(currentExecution()).toBeUndefined();
 });
 it('isolates concurrent metadata and does not log raw results or errors',async()=>{
  const log=vi.fn();
  const work=(n:number)=>runExecution(identity({requestId:`request-${n}`}), 'intake',async()=>{
   await recordModel('intake',`model-${n}`,async()=>{await Promise.resolve();return {id:`response-${n}`};});return {privateText:`FICTIONAL_SECRET_${n}`};
  },log);
  const [a,b]=await Promise.all([work(1),work(2)]);
  expect(a.execution?.stages[0].model).toBe('model-1');expect(b.execution?.stages[0].model).toBe('model-2');
  await expect(runExecution(identity(),'intake',async()=>{await recordModel('intake','test-model',async()=>{throw new Error('FICTIONAL_PRIVATE_ERROR');});return {};},log)).rejects.toThrow();
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/FICTIONAL_SECRET|FICTIONAL_PRIVATE_ERROR/);expect(log.mock.calls.at(-1)?.[0]).toMatchObject({failureStage:'intake',state:'failed'});
 });
});
