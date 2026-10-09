import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {AnalysisError,publicError} from '@/lib/ai/errors';
import {NO_STORE,errorResponse,requestIdentifier} from '@/lib/ai/http';
import {readIntakeConfig} from '@/lib/intake/service';
import {paidRequestContext} from '@/lib/usage/api';
import {runPaidRequest} from '@/lib/usage/control';
import {MATERIAL_LIMITS,MaterialRequestSchema,type MaterialStreamEvent} from '@/lib/materials/contracts';
import {MATERIAL_OUTPUT_TOKENS} from '@/lib/materials/extract';
import {organizeMaterials} from '@/lib/materials/service';
import {releaseUploads,materialFileId,type MaterialUpload} from '@/lib/materials/parse';

export const runtime='nodejs';
export const maxDuration=60;

function checkMultipartOrigin(request:Request):void{
  const origin=request.headers.get('origin'),host=(request.headers.get('host')??new URL(request.url).host).toLowerCase();
  let valid=true;
  if(origin){try{const parsed=new URL(origin);valid=['http:','https:'].includes(parsed.protocol)&&parsed.origin===origin&&parsed.host.toLowerCase()===host;}catch{valid=false;}}
  if(!valid||request.headers.get('sec-fetch-site')==='cross-site')throw new AnalysisError('FORBIDDEN','仅允许从本站上传材料。',403);
  if(!/^multipart\/form-data;\s*boundary=/i.test(request.headers.get('content-type')??''))throw new AnalysisError('INVALID_INPUT','请选择 PDF 文件上传。',415);
}

export async function readLimitedMaterialForm(request:Request):Promise<FormData>{
  if(Number(request.headers.get('content-length'))>MATERIAL_LIMITS.maxRequestBytes)throw new AnalysisError('PAYLOAD_TOO_LARGE','上传请求超过 4,000,000 字节；请减少 PDF 大小。',413);
  const reader=request.body?.getReader();if(!reader)throw new AnalysisError('INVALID_INPUT','上传内容为空。');
  const chunks:Uint8Array[]=[];let total=0;
  let timeout:ReturnType<typeof setTimeout>|undefined;
  const timedOut=new Promise<never>((_,reject)=>{timeout=setTimeout(()=>{void reader.cancel();reject(new AnalysisError('TIMEOUT','上传读取超过 15 秒；请重试或减少材料。',504));},MATERIAL_LIMITS.parseTimeoutMs);});
  try{
    while(true){const {done,value}=await Promise.race([reader.read(),timedOut]);if(done)break;total+=value.length;if(total>MATERIAL_LIMITS.maxRequestBytes){await reader.cancel();throw new AnalysisError('PAYLOAD_TOO_LARGE','上传请求超过 4,000,000 字节；请减少 PDF 大小。',413);}chunks.push(value);}
    const bytes=Buffer.concat(chunks);
    try{return await new Request(request.url,{method:'POST',headers:{'content-type':request.headers.get('content-type')!},body:bytes}).formData();}
    catch{throw new AnalysisError('INVALID_INPUT','上传表单无法读取，请重新选择 PDF。');}
    finally{bytes.fill(0);}
  }finally{if(timeout)clearTimeout(timeout);for(const chunk of chunks)chunk.fill(0);reader.releaseLock();}
}

export async function POST(request:NextRequest){
  const startedAt=Date.now();
  let requestId=requestIdentifier(request);const files:MaterialUpload[]=[];
  try{
    checkMultipartOrigin(request);
    const form=await readLimitedMaterialForm(request),metadata=form.getAll('metadata');
    if(metadata.length!==1||typeof metadata[0]!=='string'||metadata[0].length>4000||[...form.keys()].some(key=>key!=='files'&&key!=='metadata'))throw new AnalysisError('INVALID_INPUT','请检查上传文件和材料整理参数。');
    let raw:unknown;try{raw=JSON.parse(metadata[0]);}catch{throw new AnalysisError('INVALID_INPUT','材料整理参数不是有效 JSON。');}
    const parsed=MaterialRequestSchema.safeParse(raw);if(!parsed.success||parsed.data.operation!=='initial')throw new AnalysisError('INVALID_INPUT','请检查材料整理参数、同意选项和输入版本。');
    const data=parsed.data;requestId=data.requestId;
    const uploads=form.getAll('files');
    if(!uploads.length||uploads.length>MATERIAL_LIMITS.maxFiles||uploads.some(file=>typeof file==='string'))throw new AnalysisError('INVALID_INPUT','每次请选择同案的 1–3 份 PDF。');
    for(const file of uploads as File[]){
      if(file.size>MATERIAL_LIMITS.maxFileBytes)throw new AnalysisError('PAYLOAD_TOO_LARGE','每份 PDF 不得超过 3 MiB。',413);
      files.push({name:file.name,type:file.type,bytes:new Uint8Array(await file.arrayBuffer())});
    }
    const config=data.aiConsent?readIntakeConfig():undefined;
    // The session cookie must be established before starting a streaming response.
    let context:Exclude<ReturnType<typeof paidRequestContext>,NextResponse>|undefined;
    if(config?.mode==='live'){
      if(!config.key)throw new AnalysisError('CONFIGURATION_ERROR','AI 材料整理尚未配置；可关闭 AI 查看本地提取文字。',503);
      const candidate=paidRequestContext(request,requestId,{searchRequired:false});
      if(candidate instanceof NextResponse){releaseUploads(files);return candidate;}
      context=candidate;
    }
    const inputHash=createHash('sha256').update(JSON.stringify({files:files.map(file=>({id:materialFileId(file.bytes),name:file.name})),background:data.background})).digest('hex');
    const controller=new AbortController(),onAbort=()=>controller.abort();request.signal.addEventListener('abort',onAbort,{once:true});if(request.signal.aborted)controller.abort();
    let closed=false,timedOut=false;
    const encoder=new TextEncoder();
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},Math.max(1,MATERIAL_LIMITS.requestTimeoutMs-(Date.now()-startedAt)));
    const stream=new ReadableStream<Uint8Array>({
      start(sink){
        const emit=(event:MaterialStreamEvent)=>{if(!closed){try{sink.enqueue(encoder.encode(JSON.stringify(event)+'\n'));}catch{closed=true;controller.abort();}}};
        void organizeMaterials(files,data,{config,signal:controller.signal,emit,...(context?{paid:work=>runPaidRequest({...data,sessionId:context!.sessionId,ipDigest:context!.ipDigest,inputHash,kind:'material'},{model:config!.model,maxOutputTokens:MATERIAL_OUTPUT_TOKENS,searchCalls:0},work,{config:context!.config,retainResult:false})}:{})}).then(result=>{emit({type:'result',result});}).catch(error=>{
          const failure=timedOut?new AnalysisError('TIMEOUT','材料处理超过 55 秒，已停止；请减少材料后重试。',504):publicError(error);
          emit({type:'error',code:failure.code,message:failure.message,...(failure.retryable!==undefined?{retryable:failure.retryable}:{}),...(failure.retryAfterSeconds!==undefined?{retryAfterSeconds:failure.retryAfterSeconds}:{})});
        }).finally(()=>{clearTimeout(timer);request.signal.removeEventListener('abort',onAbort);if(!closed){closed=true;sink.close();}});
      },
      cancel(){closed=true;controller.abort();},
    });
    return new Response(stream,{headers:{...NO_STORE,'Content-Type':'application/x-ndjson; charset=utf-8','X-Content-Type-Options':'nosniff','X-Request-Id':requestId}});
  }catch(error){releaseUploads(files);return errorResponse(error,requestId);}
}
