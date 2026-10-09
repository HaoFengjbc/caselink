import type {UsageConfig} from './config';
import {usageUnavailable} from './config';
export type RedisCommand=(command:Array<string|number>)=>Promise<unknown>;
export function redisRest(config:UsageConfig):RedisCommand{
 return async command=>{
  try{
   const response=await fetch(config.url,{method:'POST',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(5000),cache:'no-store',redirect:'error'});
   if(!response.ok)throw usageUnavailable();
   const value=await response.json() as {error?:string;result?:unknown};if(value.error||!('result' in value))throw usageUnavailable();
   return value.result;
  }catch{throw usageUnavailable();}
 };
}
// All keys share one Redis cluster hash slot. No read-then-write races or instance-local locks.
export const RESERVE_LUA=`
local record=KEYS[1]
local fingerprint=ARGV[1]
local now=tonumber(ARGV[2])
local expires=tonumber(ARGV[3])
local lease=ARGV[4]
local amount=tonumber(ARGV[5])
local known=redis.call('HGET',record,'fingerprint')
if known and known~=fingerprint then return {'conflict'} end
local state=redis.call('HGET',record,'state')
if state=='completed' then
 local result=redis.call('GET',KEYS[7])
 if result then return {'cached',result} end
 -- A successful result has expired: never silently charge again under the old ID.
 return {'expired'}
end
local priorExpires=tonumber(redis.call('HGET',record,'expires') or '0')
local priorLease=redis.call('HGET',record,'lease')
if priorExpires>now and (state=='running' or (state=='failed' and priorLease and redis.call('ZSCORE',KEYS[2],priorLease))) then return {'running',math.ceil((priorExpires-now)/1000)} end
redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',now)
redis.call('ZREMRANGEBYSCORE',KEYS[3],'-inf',now)
if redis.call('ZCARD',KEYS[2])>=tonumber(ARGV[6]) or redis.call('ZCARD',KEYS[3])>=tonumber(ARGV[7]) then return {'concurrency'} end
if tonumber(redis.call('GET',KEYS[4]) or '0')>=tonumber(ARGV[8]) or tonumber(redis.call('GET',KEYS[5]) or '0')>=tonumber(ARGV[9]) then return {'quota'} end
if tonumber(redis.call('GET',KEYS[6]) or '0')+amount>tonumber(ARGV[10]) then return {'budget'} end
redis.call('INCR',KEYS[4]);redis.call('EXPIRE',KEYS[4],172800)
redis.call('INCR',KEYS[5]);redis.call('EXPIRE',KEYS[5],172800)
redis.call('INCRBY',KEYS[6],amount);redis.call('EXPIRE',KEYS[6],172800)
redis.call('ZADD',KEYS[2],expires,lease);redis.call('EXPIRE',KEYS[2],720)
redis.call('ZADD',KEYS[3],expires,lease);redis.call('EXPIRE',KEYS[3],720)
redis.call('HSET',record,'fingerprint',fingerprint,'state','running','expires',expires,'lease',lease,'reserved',amount)
redis.call('EXPIRE',record,86400)
return {'reserved'}
`;
export const SETTLE_LUA=`
if redis.call('HGET',KEYS[1],'lease')~=ARGV[1] then return {'stale'} end
if redis.call('HGET',KEYS[1],'state')~='running' then return {'settled'} end
local reserved=tonumber(redis.call('HGET',KEYS[1],'reserved') or '0')
local charged=tonumber(ARGV[2])
-- Unknown or failed provider costs are settled to the full reservation, never zero.
redis.call('INCRBY',KEYS[4],charged-reserved)
redis.call('EXPIRE',KEYS[4],172800)
if ARGV[6]~='1' then redis.call('ZREM',KEYS[2],ARGV[1]);redis.call('ZREM',KEYS[3],ARGV[1]) end
redis.call('HSET',KEYS[1],'state',ARGV[3])
if ARGV[3]=='completed' then
 if ARGV[4]~='' then redis.call('SET',KEYS[5],ARGV[4],'EX',120) end
 if ARGV[5]~='' then redis.call('SET',KEYS[6],ARGV[5],'EX',86400) end
end
redis.call('EXPIRE',KEYS[1],86400)
return {'settled'}
`;
