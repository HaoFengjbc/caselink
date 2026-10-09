import {NextRequest,NextResponse} from 'next/server';
import {readUsageConfig,type UsageConfig} from './config';
import {anonymousSession,requestIpDigest,SESSION_COOKIE} from './identity';
import {AnalysisError} from '../ai/errors';
import {errorResponse} from '../ai/http';
export function setAnonymousCookie(response:NextResponse,cookie:string,request:NextRequest){response.cookies.set(SESSION_COOKIE,cookie,{httpOnly:true,sameSite:'strict',secure:new URL(request.url).protocol==='https:',path:'/',maxAge:86400});return response;}
export function paidRequestContext(request:NextRequest,requestId:string):{config:UsageConfig;sessionId:string;ipDigest:string}|NextResponse{
 const config=readUsageConfig(),identity=anonymousSession(request,config);
 if(identity.cookie){
  return setAnonymousCookie(errorResponse(new AnalysisError('REQUEST_IN_PROGRESS','匿名用量会话已准备，请使用相同请求标识重试；本次没有调用模型。',409,{retryable:true,retryAfterSeconds:0}),requestId),identity.cookie,request);
 }
 return {config,sessionId:identity.sessionId,ipDigest:requestIpDigest(request,config)};
}
