import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {NewCaseInputSchema} from '@/lib/contracts';
import {analyzeInput} from '@/lib/ai/service';
import {readConfig} from '@/lib/ai/config';
import {AnalysisError} from '@/lib/ai/errors';
import {checkRequestOrigin,readLimitedJson,errorResponse,requestIdentifier,NO_STORE} from '@/lib/ai/http';

export const runtime='nodejs';
export const maxDuration=300;
const RequestSchema=z.object({input:NewCaseInputSchema,requestId:z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),forceRule:z.boolean().optional(),locale:z.enum(['zh','en']).optional()}).strict();
export async function POST(request:NextRequest){
  let requestId=requestIdentifier(request);
  try{
    checkRequestOrigin(request);const body=await readLimitedJson(request,524288);const parsed=RequestSchema.safeParse(body);
    if(!parsed.success)throw new AnalysisError('INVALID_INPUT','请检查必选状态、互斥选项和文字长度，再提交分析。');
    requestId=parsed.data.requestId;const config=parsed.data.forceRule?undefined:readConfig();
    const result=await analyzeInput(parsed.data.input,{forceRule:parsed.data.forceRule,config,signal:request.signal,locale:parsed.data.locale});
    return NextResponse.json(result,{headers:{...NO_STORE,'X-Request-Id':requestId}});
  }catch(error){return errorResponse(error,requestId);}
}
