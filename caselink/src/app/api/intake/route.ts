import {runExecution} from '@/lib/ai/execution';
import {NextRequest,NextResponse} from 'next/server';
import {IntakeRequestSchema} from '@/lib/analysis-protocol';
import {analyzeIntake,readIntakeConfig} from '@/lib/intake/service';
import {AnalysisError} from '@/lib/ai/errors';
import {checkRequestOrigin,readLimitedJson,errorResponse,requestIdentifier,NO_STORE} from '@/lib/ai/http';
import {requireResearchScope,assessDomain} from '@/lib/research/domain';

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
  if(!forceManual&&config?.mode==='live'&&data.input.intake?.narrative.trim())requireResearchScope(data.input,data.locale??'zh');
  const result=await runExecution(data,'intake',analyze);
  return NextResponse.json(result,{headers:{...NO_STORE,'X-Request-Id':requestId}});
 }catch(error){return errorResponse(error,requestId);}
}
