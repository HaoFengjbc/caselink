import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {NewCaseInputSchema} from '@/lib/contracts';
import {analyzeIntake} from '@/lib/intake/service';
import {AnalysisError} from '@/lib/ai/errors';
import {checkRequestOrigin,readLimitedJson,errorResponse,requestIdentifier,NO_STORE} from '@/lib/ai/http';

export const runtime='nodejs';
export const maxDuration=40;
const RequestSchema=z.object({input:NewCaseInputSchema,locale:z.enum(['zh','en']),forceManual:z.boolean().optional()}).strict();
export async function POST(request:NextRequest){
  const requestId=requestIdentifier(request);
  try{
    checkRequestOrigin(request);
    const parsed=RequestSchema.safeParse(await readLimitedJson(request,524288));
    if(!parsed.success)throw new AnalysisError('INVALID_INPUT','请检查地区、案情、问题答案及语言选项。');
    const result=await analyzeIntake(parsed.data.input,{locale:parsed.data.locale,forceManual:parsed.data.forceManual,signal:request.signal});
    return NextResponse.json(result,{headers:{...NO_STORE,'X-Request-Id':requestId}});
  }catch(error){return errorResponse(error,requestId);}
}
