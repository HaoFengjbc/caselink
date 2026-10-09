import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {AnalysisError,publicError} from './errors';

export const NO_STORE={'Cache-Control':'no-store, max-age=0'};
export function checkRequestOrigin(request:Request){
  const origin=request.headers.get('origin');
  // Next may reconstruct request.url with its internal listening hostname.
  // The browser's public authority is the HTTP Host, not x-forwarded-host.
  const expectedHost=(request.headers.get('host')??new URL(request.url).host).toLowerCase();
  let validOrigin=true;
  if(origin){
    try{
      const parsed=new URL(origin);
      validOrigin=['http:','https:'].includes(parsed.protocol)&&parsed.origin===origin&&parsed.host.toLowerCase()===expectedHost;
    }catch{validOrigin=false;}
  }
  if(!validOrigin||request.headers.get('sec-fetch-site')==='cross-site')throw new AnalysisError('FORBIDDEN','仅允许从本站提交分析。',403);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new AnalysisError('INVALID_INPUT','请求必须使用 JSON 格式。',415);
}
export async function readLimitedJson(request:Request,maxBytes=24576):Promise<unknown>{
  if(Number(request.headers.get('content-length'))>maxBytes)throw new AnalysisError('PAYLOAD_TOO_LARGE','提交内容过长，请缩短补充说明。',413);
  const reader=request.body?.getReader();if(!reader)throw new AnalysisError('INVALID_INPUT','请求正文为空。');
  const chunks:Uint8Array[]=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>maxBytes){await reader.cancel();throw new AnalysisError('PAYLOAD_TOO_LARGE','提交内容过长，请缩短补充说明。',413);}chunks.push(value);}}finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AnalysisError('INVALID_INPUT','请求正文不是有效 JSON。');}
}
export function requestIdentifier(request:NextRequest){const value=request.headers.get('x-request-id');return value&&/^[A-Za-z0-9_-]{8,100}$/.test(value)?value:randomUUID();}
export function errorResponse(error:unknown,requestId:string){const e=publicError(error);return NextResponse.json({code:e.code,message:e.message,requestId,...(e.retryable!==undefined?{retryable:e.retryable}:{}),...(e.retryAfterSeconds!==undefined?{retryAfterSeconds:e.retryAfterSeconds}:{}),...(e.domain?{domain:e.domain}:{})},{status:e.status,headers:{...NO_STORE,...(e.retryAfterSeconds!==undefined?{'Retry-After':String(e.retryAfterSeconds)}:{})}});}
