import {executionFor} from '@/lib/usage/runtime';
import {NextRequest,NextResponse} from 'next/server';
import {IntakeRequestSchema} from '@/lib/analysis-protocol';
import {analyzeIntake,readIntakeConfig} from '@/lib/intake/service';
import {AnalysisError} from '@/lib/ai/errors';
import {checkRequestOrigin,readLimitedJson,errorResponse,requestIdentifier,NO_STORE} from '@/lib/ai/http';
import {requireResearchScope,assessDomain} from '@/lib/research/domain';
import {paidRequestContext} from '@/lib/usage/api';
import {runPaidRequest} from '@/lib/usage/control';
import {hashInput} from '@/lib/ai/hash';

export const runtime='nodejs';
export const maxDuration=40;
export async function POST(request:NextRequest){
 let requestId=requestIdentifier(request);
 try{
  checkRequestOrigin(request);const parsed=IntakeRequestSchema.safeParse(await readLimitedJson(request,524288));
  if(!parsed.success)throw new AnalysisError('INVALID_INPUT','请检查地区、案情、输入版本及语言选项。');
  const data=parsed.data;requestId=data.requestId;
  if(data.operation!=='initial')throw new AnalysisError('INVALID_INPUT','案情整理使用 initial 操作；主动补查属于报告研究。');
  const forceManual=data.forceManual||data.preferences?.aiEnabled===false,config=forceManual?undefined:readIntakeConfig();
  const analyze=async()=>({...await analyzeIntake(data.input,{locale:data.locale??'zh',forceManual,signal:request.signal,config}),domain:assessDomain(data.input,data.locale??'zh')});
  let result;
  if(!forceManual&&config?.mode==='live'&&data.input.intake?.narrative.trim()){
   requireResearchScope(data.input,data.locale??'zh');
   const context=paidRequestContext(request,requestId);if(context instanceof NextResponse)return context;
   result=await runPaidRequest({...data,sessionId:context.sessionId,ipDigest:context.ipDigest,inputHash:hashInput(data.input),locale:data.locale??'zh',kind:'intake'}, {model:config.model,maxOutputTokens:4000,searchCalls:0},analyze,{config:context.config});
  }else{result=await analyze();Object.assign(result,{execution:{...executionFor(data,0),actualCostUsd:0}});}
  return NextResponse.json(result,{headers:{...NO_STORE,'X-Request-Id':requestId}});
 }catch(error){return errorResponse(error,requestId);}
}
