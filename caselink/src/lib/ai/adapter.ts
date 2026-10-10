import {recordModel,type ProviderUsage} from './execution';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { ModelAnalysisOutputSchema, WebModelAnalysisOutputSchema, type WebModelAnalysisOutput, type NewCaseInput, type ModelAnalysisOutput } from '../contracts';
import { type AnalysisContext, validateModelOutput, lockUnspecifiedGoalActions, validateWebModelOutput, lockWebUnspecifiedGoalActions, dropIneligibleResources, keepValidActions } from '../evidence/validate';
import { type MatchedCase } from '../retrieval/match';
import { type ServerConfig } from './config';
import { AnalysisError, publicError } from './errors';
import { SYSTEM_PROMPT, buildPromptData, systemPrompt, buildWebPromptData, webSystemPrompt, CONTROLLED_SNIPPET_NOTICE } from './prompt';
import type { Locale } from '../i18n/locale';
import type {WebResearch} from '../research/contracts';
import {normalizeConfirmedGoal} from '../intake/analysis';

export type ProviderResponse=ProviderUsage&{status?:string;output_parsed:unknown;output?:Array<{type?:string;content?:Array<{type?:string}>}>};
export type ModelTransport=(args:{config:ServerConfig;data:string;signal:AbortSignal;instructions?:string;outputMode?:'corpus'|'web'})=>Promise<ProviderResponse>;
export const openAITransport:ModelTransport=async({config,data,signal,instructions=SYSTEM_PROMPT,outputMode='corpus'})=>{
  const client=new OpenAI({apiKey:config.key,maxRetries:0,timeout:config.timeoutMs});
  return recordModel('synthesis',config.model,()=>client.responses.parse({model:config.model,store:false,instructions,input:[{role:'user',content:data}],reasoning:{effort:config.reasoningEffort},text:{verbosity:'low',format:outputMode==='web'?zodTextFormat(WebModelAnalysisOutputSchema,'caselink_web_analysis'):zodTextFormat(ModelAnalysisOutputSchema,'caselink_analysis')},max_output_tokens:config.maxOutputTokens},{signal}));
};

export async function generateLive(input:NewCaseInput,context:AnalysisContext,matches:MatchedCase[],config:ServerConfig,signal?:AbortSignal,transport:ModelTransport=openAITransport,locale:Locale='zh'):Promise<ModelAnalysisOutput>{
  input=normalizeConfirmedGoal(input);
  const raw=await generateStructured(config,buildPromptData(input,context,matches,locale),systemPrompt(locale),'corpus',signal,transport);
  return keepValidActions(lockUnspecifiedGoalActions(dropIneligibleResources(raw,input),input,locale),value=>validateModelOutput(value,input,context,locale),locale);
}

export async function generateWebLive(input:NewCaseInput,context:AnalysisContext,matches:MatchedCase[],research:WebResearch,config:ServerConfig,signal?:AbortSignal,transport:ModelTransport=openAITransport,locale:Locale='zh'):Promise<WebModelAnalysisOutput>{
  input=normalizeConfirmedGoal(input);
  const raw=await generateStructured(config,buildWebPromptData(input,context,matches,research,locale),webSystemPrompt(locale)+(research.sources.every(source=>!source.pageOpened)?'\n'+CONTROLLED_SNIPPET_NOTICE:''),'web',signal,transport);
  return keepValidActions(lockWebUnspecifiedGoalActions(dropIneligibleResources(raw,input),input,locale),value=>validateWebModelOutput(value,input,context,research,locale),locale);
}

async function generateStructured(config:ServerConfig,data:string,instructions:string,outputMode:'corpus'|'web',signal:AbortSignal|undefined,transport:ModelTransport):Promise<unknown>{
  const controller=new AbortController();let timedOut=false;
  const cancel=()=>controller.abort();
  if(signal?.aborted)throw new AnalysisError('CANCELLED','本次分析已取消。',499);
  signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},config.timeoutMs);
  let abortListener:()=>void=()=>{};
  const aborted=new Promise<never>((_,reject)=>{abortListener=()=>reject(new AnalysisError(timedOut?'TIMEOUT':'CANCELLED',timedOut?'分析超时，尚未生成有效结果。可重试或明确选择规则参考。':'本次分析已取消。',timedOut?504:499));controller.signal.addEventListener('abort',abortListener,{once:true});});
  try{
    const response=await Promise.race([transport({config,data,signal:controller.signal,instructions,outputMode}),aborted]);
    if(response.output?.some(item=>item.content?.some(content=>content.type==='refusal')))throw new AnalysisError('MODEL_REFUSAL','AI 未能提供本次参考。可以调整必要描述或明确选择规则参考。',422);
    if(response.status!=='completed')throw new AnalysisError('INCOMPLETE_OUTPUT','AI 输出未完整完成，未作为有效分析显示。可重试或选择规则参考。',502);
    if(!response.output_parsed)throw new AnalysisError('INVALID_MODEL_OUTPUT','AI 未返回有效结构化内容。可重试或选择规则参考。',502);
    return response.output_parsed;
  }catch(error){
    if(timedOut)throw new AnalysisError('TIMEOUT','分析超时，尚未生成有效结果。可重试或选择规则参考。',504);
    if(controller.signal.aborted)throw new AnalysisError('CANCELLED','本次分析已取消。',499);
    if(error instanceof SyntaxError||(error as {name?:string})?.name==='ZodError')throw new AnalysisError('INVALID_MODEL_OUTPUT','AI 返回内容未通过结构校验。可重试或选择规则参考。',502);
    throw publicError(error);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.signal.removeEventListener('abort',abortListener);}
}
