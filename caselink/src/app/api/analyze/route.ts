import {NextRequest,NextResponse} from 'next/server';
import {AnalysisRequestSchema} from '@/lib/analysis-protocol';
import {analyzeInput} from '@/lib/ai/service';
import {readConfig} from '@/lib/ai/config';
import {AnalysisError} from '@/lib/ai/errors';
import {checkRequestOrigin,readLimitedJson,errorResponse,requestIdentifier,NO_STORE} from '@/lib/ai/http';
import {requireResearchScope} from '@/lib/research/domain';
import {runExecution} from '@/lib/ai/execution';

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
  if(!forceRule&&config?.mode==='live')requireResearchScope(data.input,data.locale??'zh');
  const result=await runExecution(data,'analysis',()=>analyzeInput(data.input,{forceRule,config,signal:request.signal,locale:data.locale,identity:data}));
  return NextResponse.json(result,{headers:{...NO_STORE,'X-Request-Id':requestId}});
 }catch(error){return errorResponse(error,requestId);}
}
