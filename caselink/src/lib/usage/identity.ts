import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
import type {NextRequest} from 'next/server';
import type {UsageConfig} from './config';
import {usageUnavailable} from './config';
export const SESSION_COOKIE='caselink_usage';
const MAX_AGE_MS=86400000;
export const privateDigest=(secret:string,value:string)=>createHmac('sha256',secret).update(value).digest('hex');
export function anonymousSession(request:NextRequest,config:UsageConfig,now=Date.now()):{sessionId:string;cookie:string|null}{
 const raw=request.cookies.get(SESSION_COOKIE)?.value??'';const parts=raw.split('.');
 if(parts.length===3&&/^[a-f0-9-]{36}$/.test(parts[0])&&/^\d{13}$/.test(parts[1])&&/^[a-f0-9]{64}$/.test(parts[2])){
  const body=parts.slice(0,2).join('.'),expected=privateDigest(config.secret,body),age=now-Number(parts[1]);
  if(age>=0&&age<MAX_AGE_MS&&timingSafeEqual(Buffer.from(expected),Buffer.from(parts[2])))return {sessionId:privateDigest(config.secret,parts[0]),cookie:null};
 }
 const body=`${randomUUID()}.${now}`;return {sessionId:privateDigest(config.secret,body.split('.')[0]),cookie:`${body}.${privateDigest(config.secret,body)}`};
}
export function requestIpDigest(request:NextRequest,config:UsageConfig):string{
 if(!config.trustedIpHeader)throw usageUnavailable();
 // This header MUST be overwritten by the platform/proxy, never append/trust an arbitrary client header.
 const raw=request.headers.get(config.trustedIpHeader)?.trim()??'';
 if(!isIP(raw))throw usageUnavailable();
 return privateDigest(config.secret,raw);
}
