import {AsyncLocalStorage} from 'node:async_hooks';
import type {ResearchExecution,RequestIdentity} from '../workflow-contracts';
import {publicError} from './errors';

export type ProviderUsage={id?:string;model?:string;usage?:{input_tokens?:number;output_tokens?:number}};
type Stage=ResearchExecution['stages'][number]['stage'];
const storage=new AsyncLocalStorage<ResearchExecution>();
export function executionFor(identity:RequestIdentity,round=identity.operation==='supplement'?2:1):ResearchExecution{
 return {requestId:identity.requestId,inputVersion:identity.inputVersion,operation:identity.operation,round,stages:[],failureStage:null,controlledSearch:false,reservedCostUsd:null,actualCostUsd:null};
}
export function withExecution<T>(execution:ResearchExecution,work:()=>Promise<T>):Promise<T>{return storage.run(execution,work);}
export function currentExecution():ResearchExecution|undefined{return storage.getStore();}
const tokenCount=(value:number|undefined)=>Number.isInteger(value)&&(value??-1)>=0?value!:null;

/** Per-request diagnostics only: no admission checks, quotas, locks, cache or pricing dependency. */
export async function runExecution<T extends object>(identity:RequestIdentity,kind:'analysis'|'intake'|'material',work:()=>Promise<T>,log:(value:unknown)=>void=value=>console.info(JSON.stringify(value))):Promise<T & {execution:ResearchExecution}>{
 const execution=executionFor(identity);
 const report=(state:'completed'|'failed',errorCode:string|null)=>{
  execution.actualCostUsd=execution.stages.length?null:0;
  // Never log case facts, prompts, generated text, credentials, IPs or cookies.
  try{log({event:'caselink_execution',requestId:identity.requestId,inputVersion:identity.inputVersion,kind,operation:identity.operation,state,stages:execution.stages,failureStage:execution.failureStage,errorCode});}catch{/* Logging must not block a request. */}
 };
 return storage.run(execution,async()=>{
  try{const result=await work();report('completed',null);return Object.assign(result,{execution:structuredClone(execution)});}
  catch(error){execution.failureStage??=execution.stages.at(-1)?.stage??'before_model';report('failed',publicError(error).code);throw error;}
 });
}

export async function recordModel<T extends ProviderUsage>(stage:Stage,model:string,invoke:()=>Promise<T>):Promise<T>{
 const execution=storage.getStore(),started=Date.now();
 try{
  const response=await invoke();
  execution?.stages.push({stage,elapsedMs:Date.now()-started,model:response.model??model,responseId:response.id??null,inputTokens:tokenCount(response.usage?.input_tokens),outputTokens:tokenCount(response.usage?.output_tokens),toolCalls:0,status:'completed'});
  return response;
 }catch(error){
  if(execution){execution.failureStage=stage;execution.stages.push({stage,elapsedMs:Date.now()-started,model,responseId:null,inputTokens:null,outputTokens:null,toolCalls:0,status:'failed'});}
  throw error;
 }
}
export async function recordSearch<T>(invoke:()=>Promise<T>):Promise<T>{
 const execution=storage.getStore(),started=Date.now();
 if(execution)execution.controlledSearch=true;
 try{const result=await invoke();execution?.stages.push({stage:'search',elapsedMs:Date.now()-started,model:null,responseId:null,inputTokens:null,outputTokens:null,toolCalls:1,status:'completed'});return result;}
 catch(error){if(execution){execution.failureStage='search';execution.stages.push({stage:'search',elapsedMs:Date.now()-started,model:null,responseId:null,inputTokens:null,outputTokens:null,toolCalls:1,status:'failed'});}throw error;}
}
