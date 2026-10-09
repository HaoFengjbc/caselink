import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from 'node:crypto';
import type {RequestIdentity,ResearchExecution} from '../workflow-contracts';
import {AnalysisError,publicError} from '../ai/errors';
import {readUsageConfig,reserveMicroUsd,LEASE_SECONDS,usageUnavailable,type UsageConfig} from './config';
import {redisRest,RESERVE_LUA,SETTLE_LUA,type RedisCommand} from './redis';
import {privateDigest} from './identity';
import {executionFor,withMeter,type Meter} from './runtime';
export type PaidIdentity=RequestIdentity&{sessionId:string;ipDigest:string;inputHash:string;locale:string;kind:'analysis'|'intake'};
const prefix='caselink:{usage}:v1:';
const encryptionKey=(secret:string)=>createHash('sha256').update(`caselink-result-v1:${secret}`).digest();
function seal(value:unknown,secret:string,aad:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(secret),iv);cipher.setAAD(Buffer.from(aad));const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');}
function open(value:string,secret:string,aad:string):unknown{const bytes=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',encryptionKey(secret),bytes.subarray(0,12));decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));}
const fail=(code:AnalysisError['code'],message:string,retryable:boolean,retryAfterSeconds?:number,status=429)=>new AnalysisError(code,message,status,{retryable,retryAfterSeconds});
/** No raw input is persisted. Reports may contain input-derived text; only their session-bound ciphertext is retained for 120 seconds. */
export async function runPaidRequest<T extends {execution?:ResearchExecution;analysisId?:string}>(identity:PaidIdentity,plan:{model:string;maxOutputTokens:number;searchCalls:number},work:()=>Promise<T>,options:{config?:UsageConfig;redis?:RedisCommand;now?:()=>number;log?:(value:unknown)=>void}={}):Promise<T>{
 const config=options.config??readUsageConfig(),redis=options.redis??redisRest(config),now=options.now??Date.now;
 const requestKey=`${prefix}request:${identity.sessionId}:${identity.requestId}`;
 const resultKey=`${prefix}result:${identity.sessionId}:${identity.requestId}`;
 const fingerprint=privateDigest(config.secret,JSON.stringify([identity.inputHash,identity.inputVersion,identity.operation,identity.parentAnalysisId??null,identity.kind,identity.locale]));
 let round=1;
 if(identity.operation==='supplement'){
  if(identity.kind!=='analysis'||!identity.parentAnalysisId)throw fail('INVALID_INPUT','主动补查需要同一会话中的上一份报告标识。',false,undefined,400);
  const raw=await redis(['GET',`${prefix}parent:${identity.sessionId}:${identity.parentAnalysisId}`]);
  let parent:{inputHash:string;round:number}|undefined;try{parent=typeof raw==='string'?JSON.parse(raw):undefined;}catch{/* Fail closed. */}
  if(!parent||parent.inputHash!==identity.inputHash||!Number.isInteger(parent.round)||parent.round<1)throw fail('INVALID_INPUT','原报告不属于当前会话、已过期或输入已改变。请先以新请求生成首次研究。',false,undefined,400);
  round=parent.round+1;
 }
 const instant=now(),day=new Date(instant).toISOString().slice(0,10),lease=randomUUID(),reserved=reserveMicroUsd(config,plan.model,plan.maxOutputTokens,plan.searchCalls);
 const keys=[requestKey,`${prefix}running`,`${prefix}running:${identity.sessionId}`,`${prefix}session:${day}:${identity.sessionId}`,`${prefix}ip:${day}:${identity.ipDigest}`,`${prefix}budget:${day}`,resultKey];
 const decision=await redis(['EVAL',RESERVE_LUA,keys.length,...keys,fingerprint,instant,instant+LEASE_SECONDS*1000,lease,reserved,config.concurrency,config.sessionConcurrency,config.sessionDaily,config.ipDaily,config.dailyMicroUsd]);
 if(!Array.isArray(decision))throw usageUnavailable();
 switch(decision[0]){
  case 'cached':try{return open(String(decision[1]),config.secret,`${identity.sessionId}:${identity.requestId}:${fingerprint}`) as T;}catch{throw usageUnavailable();}
  case 'conflict':throw fail('IDEMPOTENCY_CONFLICT','此请求标识已绑定不同输入、版本或操作。请创建新的请求标识。',false,undefined,409);
  case 'expired':throw fail('IDEMPOTENCY_CONFLICT','该请求已完成，短期结果已清理。请使用新请求标识明确发起新研究。',false,undefined,409);
  case 'running':throw fail('REQUEST_IN_PROGRESS','同一请求正在处理，未增加模型调用。请稍后使用原请求标识重试。',true,Math.max(1,Math.min(LEASE_SECONDS,Number(decision[1])||5)),409);
  case 'concurrency':throw fail('CONCURRENCY_LIMIT','当前并发研究已达上限，请稍后重试。',true,10);
  case 'quota':throw fail('RATE_LIMITED','当前匿名会话或网络地址的日请求额度已用尽。仍可使用规则参考。',true,Math.ceil((Date.parse(day+'T00:00:00Z')+86400000-instant)/1000));
  case 'budget':throw fail('QUOTA_EXHAUSTED','全站本日付费预算已被使用或预留，未调用模型。仍可使用规则参考。',true,Math.ceil((Date.parse(day+'T00:00:00Z')+86400000-instant)/1000));
  case 'reserved':break;
  default:throw usageUnavailable();
 }
 const execution=executionFor(identity,reserved,round);
 const meter:Meter={execution,config,expectedModel:plan.model,maxOutputTokens:plan.maxOutputTokens,modelCalls:0,searchCalls:0,actualMicroUsd:0,unknownCost:false,pendingProviders:0,ambiguousFailure:false,deadline:instant+300000};
 const settle=async(state:'completed'|'failed',result?:T)=>{
  // Provider rejection/abort/unknown usage keeps the reservation. No-cost local failure may release it.
  const actual=meter.unknownCost?null:meter.actualMicroUsd;
  execution.actualCostUsd=actual===null?null:actual/1e6;
  const charged=actual??reserved;
  if(result)result.execution={...execution};
  const encrypted=result?seal(result,config.secret,`${identity.sessionId}:${identity.requestId}:${fingerprint}`):'';
  const parentKey=result?.analysisId?`${prefix}parent:${identity.sessionId}:${result.analysisId}`:`${prefix}unused`;
  const settlement=await redis(['EVAL',SETTLE_LUA,6,requestKey,keys[1],keys[2],keys[5],resultKey,parentKey,lease,charged,state,encrypted,result?.analysisId?JSON.stringify({inputHash:identity.inputHash,round}):'',meter.pendingProviders>0||meter.ambiguousFailure?'1':'0']);
  if(!Array.isArray(settlement)||settlement[0]==='stale')throw fail('REQUEST_IN_PROGRESS','此执行租约已过期；迟到结果未返回，也不会覆盖较新的执行。',true,10,409);
  (options.log??(value=>console.info(JSON.stringify(value))))({event:'caselink_paid_execution',requestId:identity.requestId,kind:identity.kind,operation:identity.operation,round,state,stages:execution.stages,failureStage:execution.failureStage,reservedCostUsd:execution.reservedCostUsd,actualCostUsd:execution.actualCostUsd,chargedCostUsd:charged/1e6});
 };
 try{
  const result=await withMeter(meter,work);
  await settle('completed',result);
  return result;
 }catch(error){
  execution.failureStage??=execution.stages.at(-1)?.stage??'before_model';
  try{await settle('failed');}catch{/* Reservation remains spent and lease expires; never fail open. */}
  if(meter.pendingProviders>0||meter.ambiguousFailure){const classified=publicError(error);classified.retryable=true;classified.retryAfterSeconds=Math.max(1,Math.ceil((instant+LEASE_SECONDS*1000-now())/1000));throw classified;}
  throw error;
 }
}

