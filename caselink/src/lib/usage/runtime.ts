import {AsyncLocalStorage} from 'node:async_hooks';
import type {ResearchExecution,RequestIdentity} from '../workflow-contracts';
import {usageUnavailable,MODEL_INPUT_BYTE_LIMIT,type UsageConfig} from './config';
import {AnalysisError} from '../ai/errors';
export type ProviderUsage={id?:string;model?:string;usage?:{input_tokens?:number;output_tokens?:number}};
type Stage=ResearchExecution['stages'][number]['stage'];
export type Meter={execution:ResearchExecution;config:UsageConfig;expectedModel:string;maxOutputTokens:number;modelCalls:number;searchCalls:number;actualMicroUsd:number;unknownCost:boolean;pendingProviders:number;ambiguousFailure:boolean;deadline:number};
const storage=new AsyncLocalStorage<Meter>();
export function executionFor(identity:RequestIdentity,reservedMicroUsd:number,round=1):ResearchExecution{return {requestId:identity.requestId,inputVersion:identity.inputVersion,operation:identity.operation,round,stages:[],failureStage:null,controlledSearch:false,reservedCostUsd:reservedMicroUsd/1e6,actualCostUsd:null};}
export function withMeter<T>(meter:Meter,work:()=>Promise<T>):Promise<T>{return storage.run(meter,work);}
export function currentExecution():ResearchExecution|undefined{return storage.getStore()?.execution;}
/** Production transports cannot be invoked without a successfully reserved distributed lease. */
export async function meteredModel<T extends ProviderUsage>(stage:Stage,model:string,maxOutputTokens:number,input:string,invoke:()=>Promise<T>):Promise<T>{
 const meter=storage.getStore();
 if(!meter||Date.now()>=meter.deadline||model!==meter.expectedModel||maxOutputTokens>meter.maxOutputTokens||meter.modelCalls>=1)throw usageUnavailable();
 if(Buffer.byteLength(input,'utf8')>MODEL_INPUT_BYTE_LIMIT)throw new AnalysisError('PAYLOAD_TOO_LARGE','送往模型的材料超过本轮安全预算，请减少材料或使用规则参考。',413,{retryable:false});
 meter.modelCalls++;meter.pendingProviders++;const priorUnknown=meter.unknownCost;meter.unknownCost=true;const started=Date.now();
 try{
  const response=await invoke(),inputTokens=response.usage?.input_tokens,outputTokens=response.usage?.output_tokens;
  const actualModel=response.model??null,rate=actualModel&&Object.hasOwn(meter.config.rates,actualModel)?meter.config.rates[actualModel]:undefined;
  if(rate&&Number.isInteger(inputTokens)&&Number.isInteger(outputTokens)&&(inputTokens??-1)>=0&&(outputTokens??-1)>=0){meter.actualMicroUsd+=Math.ceil(inputTokens!*rate.inputPerMillion+outputTokens!*rate.outputPerMillion);meter.unknownCost=priorUnknown;}
  else meter.unknownCost=true;
  meter.execution.stages.push({stage,elapsedMs:Date.now()-started,model:actualModel,responseId:response.id??null,inputTokens:inputTokens??null,outputTokens:outputTokens??null,toolCalls:0,status:'completed'});
  return response;
 }catch(error){meter.unknownCost=true;meter.ambiguousFailure=!(typeof (error as {status?:unknown})?.status==='number');meter.execution.failureStage=stage;meter.execution.stages.push({stage,elapsedMs:Date.now()-started,model,responseId:null,inputTokens:null,outputTokens:null,toolCalls:0,status:'failed'});throw error;}finally{meter.pendingProviders--;}
}
export async function meteredSearch<T>(invoke:()=>Promise<T>):Promise<T>{
 const meter=storage.getStore();if(!meter||meter.searchCalls>=2||Date.now()>=meter.deadline)throw usageUnavailable();
 meter.searchCalls++;meter.pendingProviders++;const started=Date.now();meter.execution.controlledSearch=true;
 // Each actual search request is charged at the configured contractual maximum.
 // The provider does not return a per-call invoice, so actual monetary cost stays unknown.
 meter.unknownCost=true;
 try{const value=await invoke();meter.execution.stages.push({stage:'search',elapsedMs:Date.now()-started,model:null,responseId:null,inputTokens:null,outputTokens:null,toolCalls:1,status:'completed'});return value;}
 catch(error){meter.ambiguousFailure=!(typeof (error as {status?:unknown})?.status==='number');meter.execution.failureStage='search';meter.execution.stages.push({stage:'search',elapsedMs:Date.now()-started,model:null,responseId:null,inputTokens:null,outputTokens:null,toolCalls:1,status:'failed'});throw error;}finally{meter.pendingProviders--;}
}
