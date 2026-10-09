import type {ResearchExecution} from '../src/lib/workflow-contracts';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {NextRequest} from 'next/server';
import {runPaidRequest,type PaidIdentity} from '../src/lib/usage/control';
import {meteredModel} from '../src/lib/usage/runtime';
import {readUsageConfig,reserveMicroUsd} from '../src/lib/usage/config';
import {anonymousSession,requestIpDigest,SESSION_COOKIE} from '../src/lib/usage/identity';
import {RedisProtocolSimulator,fixtureUsageConfig as config} from './fixtures/usage';
import {POST as analyze} from '../src/app/api/analyze/route';
import {POST as intake} from '../src/app/api/intake/route';
import {GET as capabilities} from '../src/app/api/capabilities/route';
import {EMPTY_INPUT,type NewCaseInput} from '../src/lib/contracts';
const plan={model:'test-model',maxOutputTokens:9000,searchCalls:0};
const identity=(extra:Partial<PaidIdentity>={}):PaidIdentity=>({requestId:'request-0001',inputVersion:1,operation:'initial',sessionId:'session-a',ipDigest:'ip-a',inputHash:'hash-a',locale:'en',kind:'analysis',...extra});
const result=():{analysisId:string;privateText:string;execution?:ResearchExecution}=>({analysisId:'analysis-0001',privateText:'FICTIONAL PRIVATE NOTE'});
const paid=async()=>{await meteredModel('synthesis','test-model',9000,'synthetic fixture',async()=>({id:'response-fixture',model:'test-model',usage:{input_tokens:100,output_tokens:200}}));return result();};
const options=(redis:RedisProtocolSimulator,overrides:Partial<typeof config>={})=>({config:{...config,...overrides},redis:redis.command,now:()=>redis.now,log:vi.fn()});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('distributed usage protocol (atomic simulator, not live Redis)',()=>{
 it('requires Redis credentials, a secret, explicit budget and model rates; unknown prices fail closed',()=>{
  expect(()=>readUsageConfig({})).toThrow(/用量保护/);expect(()=>reserveMicroUsd(config,'unknown-model',4000,0)).toThrow(/用量保护/);
 });
 it('deduplicates concurrent same-session requests before a second model call',async()=>{
  const redis=new RedisProtocolSimulator();let finish!:()=>void;const gate=new Promise<void>(r=>finish=r),work=vi.fn(async()=>{await gate;return paid();});
  const first=runPaidRequest(identity(),plan,work,options(redis));await Promise.resolve();
  await expect(runPaidRequest(identity(),plan,work,options(redis))).rejects.toMatchObject({code:'REQUEST_IN_PROGRESS',retryable:true});finish();await first;
  const cached=await runPaidRequest(identity(),plan,work,options(redis));expect(work).toHaveBeenCalledOnce();expect(cached.privateText).toBe('FICTIONAL PRIVATE NOTE');
 });
 it('rejects same ID with different input/version/operation and isolates sessions',async()=>{
  const redis=new RedisProtocolSimulator(),work=vi.fn(paid);await runPaidRequest(identity(),plan,work,options(redis));
  for(const extra of [{inputHash:'changed'},{inputVersion:2},{locale:'zh'}])await expect(runPaidRequest(identity(extra),plan,work,options(redis))).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  await runPaidRequest(identity({sessionId:'session-b'}),plan,work,options(redis));expect(work).toHaveBeenCalledTimes(2);
 });
 it('reserves worst-case money before execution, and reconciles known token usage',async()=>{
  const redis=new RedisProtocolSimulator();let reserved=0;
  const report=await runPaidRequest(identity(),plan,async()=>{reserved=Number([...redis.values].find(([k])=>k.includes(':budget:'))![1]);return paid();},options(redis));
  expect(reserved).toBe(reserveMicroUsd(config,'test-model',9000,0));expect(report.execution?.actualCostUsd).toBe(0.0005);expect(Number([...redis.values].find(([k])=>k.includes(':budget:'))![1])).toBe(500);
 });
 it('returns quota/budget/concurrency errors with zero additional provider calls',async()=>{
  const redis=new RedisProtocolSimulator(),work=vi.fn(paid);await expect(runPaidRequest(identity(),plan,work,options(redis,{dailyMicroUsd:1}))).rejects.toMatchObject({code:'QUOTA_EXHAUSTED'});expect(work).not.toHaveBeenCalled();
  await runPaidRequest(identity(),plan,work,options(redis,{sessionDaily:1}));await expect(runPaidRequest(identity({requestId:'request-0002'}),plan,work,options(redis,{sessionDaily:1}))).rejects.toMatchObject({code:'RATE_LIMITED'});expect(work).toHaveBeenCalledOnce();
  let finish!:()=>void;const gate=new Promise<void>(r=>finish=r);const pending=runPaidRequest(identity({sessionId:'b',requestId:'concurrent-a'}),plan,async()=>{await gate;return paid();},options(redis,{concurrency:1}));await Promise.resolve();
  await expect(runPaidRequest(identity({sessionId:'c',requestId:'concurrent-b'}),plan,work,options(redis,{concurrency:1}))).rejects.toMatchObject({code:'CONCURRENCY_LIMIT'});finish();await pending;expect(work).toHaveBeenCalledOnce();
 });
 it('binds IP quota across different anonymous sessions',async()=>{
  const redis=new RedisProtocolSimulator(),work=vi.fn(paid);await runPaidRequest(identity(),plan,work,options(redis,{ipDaily:1}));await expect(runPaidRequest(identity({sessionId:'session-b',requestId:'new-request'}),plan,work,options(redis,{ipDaily:1}))).rejects.toMatchObject({code:'RATE_LIMITED'});expect(work).toHaveBeenCalledOnce();
 });
 it('retains the reservation when failed/unknown provider cost is not known, and permits retry',async()=>{
  const redis=new RedisProtocolSimulator();const error=new Error('provider timed out');
  await expect(runPaidRequest(identity(),plan,async()=>{await meteredModel('synthesis','test-model',9000,'fixture',async()=>{throw error;});return result();},options(redis))).rejects.toMatchObject({code:'UPSTREAM_ERROR',retryAfterSeconds:360});
  expect(Number([...redis.values].find(([k])=>k.includes(':budget:'))![1])).toBe(reserveMicroUsd(config,'test-model',9000,0));
  await expect(runPaidRequest(identity(),plan,paid,options(redis))).rejects.toMatchObject({code:'REQUEST_IN_PROGRESS',retryAfterSeconds:360});
  redis.now+=361000;
  const retry=await runPaidRequest(identity(),plan,paid,options(redis));expect(retry.analysisId).toBe('analysis-0001');
 });
 it('encrypts only the short-lived result and never stores the narrative or a plaintext report',async()=>{
  const redis=new RedisProtocolSimulator();await runPaidRequest(identity(),plan,paid,options(redis));
  const stored=JSON.stringify([...redis.values]);expect(stored).not.toContain('FICTIONAL PRIVATE');const key=[...redis.expires.keys()].find(k=>k.includes(':result:'))!;expect(redis.expires.get(key)!-redis.now).toBe(120000);
  redis.now+=120001;await expect(runPaidRequest(identity(),plan,paid,options(redis))).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});expect(redis.values.has(key)).toBe(false);
 });
 it('rejects a replayed result copied into another session because AEAD associated data differs',async()=>{
  const redis=new RedisProtocolSimulator();await runPaidRequest(identity(),plan,paid,options(redis));
  const oldKey=[...redis.records.keys()][0],newKey=oldKey.replace('session-a','session-b');redis.records.set(newKey,{...redis.records.get(oldKey)!});
  const oldResult=[...redis.values.keys()].find(k=>k.includes(':result:'))!;redis.values.set(oldResult.replace('session-a','session-b'),redis.values.get(oldResult)!);
  await expect(runPaidRequest(identity({sessionId:'session-b'}),plan,paid,options(redis))).rejects.toMatchObject({code:'USAGE_CONTROL_UNAVAILABLE'});
 });
 it('accepts explicit supplements only with same-session parent metadata, increments round and binds input',async()=>{
  const redis=new RedisProtocolSimulator();await runPaidRequest(identity(),plan,paid,options(redis));
  const supplement=identity({requestId:'supplement-0002',operation:'supplement',parentAnalysisId:'analysis-0001'});
  expect((await runPaidRequest(supplement,plan,paid,options(redis))).execution?.round).toBe(2);
  await expect(runPaidRequest({...supplement,sessionId:'other'},plan,paid,options(redis))).rejects.toMatchObject({code:'INVALID_INPUT'});
  await expect(runPaidRequest({...supplement,inputHash:'edited'},plan,paid,options(redis))).rejects.toMatchObject({code:'INVALID_INPUT'});
 });
 it('never refunds zero when the caller cancels before a provider promise settles',async()=>{
  const redis=new RedisProtocolSimulator();let finish!:(v:{id:string;model:string;usage:{input_tokens:number;output_tokens:number}})=>void;
  const outstanding=new Promise<{id:string;model:string;usage:{input_tokens:number;output_tokens:number}}>(r=>finish=r);
  await expect(runPaidRequest(identity(),plan,async()=>{
   const call=meteredModel('synthesis','test-model',9000,'fictional input',()=>outstanding);
   await Promise.race([call,Promise.reject(new Error('cancelled by caller'))]);return result();
  },options(redis))).rejects.toMatchObject({code:'UPSTREAM_ERROR',retryAfterSeconds:360});
  expect(Number([...redis.values].find(([k])=>k.includes(':budget:'))![1])).toBe(reserveMicroUsd(config,'test-model',9000,0));
  await expect(runPaidRequest(identity({requestId:'after-cancel'}),plan,paid,options(redis))).rejects.toMatchObject({code:'CONCURRENCY_LIMIT'});
  finish({id:'late-provider',model:'test-model',usage:{input_tokens:1,output_tokens:1}});await Promise.resolve();
  expect([...redis.values.values()].join(' ')).not.toContain('FICTIONAL PRIVATE NOTE');
 });
 it('recovers the completed cache after a lost settlement acknowledgement without spending again',async()=>{
  const redis=new RedisProtocolSimulator(),work=vi.fn(paid);let once=true;
  const connection:typeof redis.command=async command=>{const result=await redis.command(command);if(once&&String(command[1]).includes("local reserved=tonumber")){once=false;throw new Error('lost acknowledgement');}return result;};
  await expect(runPaidRequest(identity(),plan,work,{...options(redis),redis:connection})).rejects.toThrow('lost acknowledgement');
  const retry=await runPaidRequest(identity(),plan,work,options(redis));expect(retry.privateText).toBe('FICTIONAL PRIVATE NOTE');expect(work).toHaveBeenCalledOnce();
 });
 it('rejects paid transports outside a reserved context',async()=>{const invoke=vi.fn();await expect(meteredModel('intake','test-model',4000,'fixture',invoke)).rejects.toMatchObject({code:'USAGE_CONTROL_UNAVAILABLE'});expect(invoke).not.toHaveBeenCalled();});
});

describe('paid API boundary with no external configuration',()=>{
 const record=(expression:'yes'|'no'|'unsure'):NewCaseInput=>({...structuredClone(EMPTY_INPUT),country:'英国',intake:{version:1,jurisdiction:'england_wales',caseKind:'civil',narrative:'虚构记者收到与其报道有关的函件。',goalText:'整理争议材料',disclosureDetails:'仅内部使用',facts:[],answers:[],confirmed:true,expression}});
 const request=(path:string,input=record('yes'),extra:Record<string,unknown>={})=>new NextRequest('https://caselink.example'+path,{method:'POST',headers:{'content-type':'application/json',origin:'https://caselink.example',host:'caselink.example'},body:JSON.stringify({input,requestId:'fixture-request',inputVersion:1,operation:'initial',locale:'en',...extra})});
 const live=()=>{vi.stubEnv('ANALYSIS_MODE','live');vi.stubEnv('OPENAI_API_KEY','fake-never-transmitted');vi.stubEnv('OPENAI_MODEL','test-model');vi.stubEnv('UPSTASH_REDIS_REST_URL',undefined);};
 it('blocks out of domain/uncertain requests for both paid endpoints before any external call',async()=>{
  live();const network=vi.fn();vi.stubGlobal('fetch',network);
  for(const handler of [analyze,intake])for(const value of ['no','unsure'] as const){const response=await handler(request('/api/analyze',record(value)));expect(response.status).toBe(422);expect(await response.json()).toMatchObject({domain:{status:value==='no'?'out_of_scope':'needs_clarification'}});}expect(network).not.toHaveBeenCalled();
 });
 it('closes paid paths without Redis while explicit rule/manual paths still work',async()=>{
  live();const network=vi.fn();vi.stubGlobal('fetch',network);
  for(const handler of [analyze,intake]){const response=await handler(request('/api/analyze'));expect(response.status).toBe(503);expect(await response.json()).toMatchObject({code:'USAGE_CONTROL_UNAVAILABLE'});}
  expect((await analyze(request('/api/analyze',record('yes'),{forceRule:true}))).status).toBe(200);expect((await intake(request('/api/intake',record('yes'),{forceManual:true}))).status).toBe(200);expect(network).not.toHaveBeenCalled();
 });
 it('capabilities does not report configured keys as live readiness',async()=>{live();const response=await capabilities(new NextRequest('https://caselink.example/api/capabilities'));expect(await response.json()).toMatchObject({configured:true,liveAvailable:false,usageControlConfigured:false,ruleAvailable:true,idempotencyResultRetentionSeconds:120,progressEvents:false});});
 it('signs a session cookie, rejects tampering, and only trusts the explicit platform IP header',()=>{
  const fresh=anonymousSession(new NextRequest('https://caselink.example'),config);expect(fresh.cookie).toBeTruthy();
  const request=new NextRequest('https://caselink.example',{headers:{cookie:`${SESSION_COOKIE}=${fresh.cookie}`,'x-fixture-ip':'203.0.113.12'}});expect(anonymousSession(request,config)).toEqual({sessionId:fresh.sessionId,cookie:null});expect(requestIpDigest(request,config)).not.toContain('203.0.113.12');
  expect(()=>requestIpDigest(new NextRequest('https://caselink.example',{headers:{'x-forwarded-for':'203.0.113.12'}}),config)).toThrow(/用量保护/);
 });
});
