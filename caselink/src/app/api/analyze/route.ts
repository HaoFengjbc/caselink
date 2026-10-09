import {NextRequest,NextResponse} from 'next/server';
import {AnalysisRequestSchema} from '@/lib/analysis-protocol';
import {analyzeInput} from '@/lib/ai/service';
import {readConfig} from '@/lib/ai/config';
import {AnalysisError} from '@/lib/ai/errors';
import {checkRequestOrigin,readLimitedJson,errorResponse,requestIdentifier,NO_STORE} from '@/lib/ai/http';
import {requireResearchScope} from '@/lib/research/domain';
import {controlledSearchConfigured} from '@/lib/research/controlled-search';
import {paidRequestContext} from '@/lib/usage/api';
import {runPaidRequest} from '@/lib/usage/control';
import {hashInput} from '@/lib/ai/hash';

export const runtime='nodejs';
export const maxDuration=300;
export async function POST(request:NextRequest){
 let requestId=requestIdentifier(request);
 try{
  checkRequestOrigin(request);const parsed=AnalysisRequestSchema.safeParse(await readLimitedJson(request,524288));
  if(!parsed.success)throw new AnalysisError('INVALID_INPUT','请检查案情、输入版本和研究操作，再提交分析。');
  const data=parsed.data;requestId=data.requestId;
  const forceRule=data.forceRule||data.preferences?.aiEnabled===false;
  const config=forceRule?undefined:readConfig();
  const analyze=()=>analyzeInput(data.input,{forceRule,config,signal:request.signal,locale:data.locale,identity:data});
  let result;
  if(!forceRule&&config?.mode==='live'){
   // Domain validation precedes ALL budget or provider calls.
   requireResearchScope(data.input,data.locale??'zh');
   const context=paidRequestContext(request,requestId);if(context instanceof NextResponse)return context;
   result=await runPaidRequest({...data,sessionId:context.sessionId,ipDigest:context.ipDigest,inputHash:hashInput(data.input),locale:data.locale??'zh',kind:'analysis'}, {model:config.model,maxOutputTokens:config.maxOutputTokens,searchCalls:controlledSearchConfigured()?2:0},analyze,{config:context.config});
  }else result=await analyze();
  return NextResponse.json(result,{headers:{...NO_STORE,'X-Request-Id':requestId}});
 }catch(error){return errorResponse(error,requestId);}
}
