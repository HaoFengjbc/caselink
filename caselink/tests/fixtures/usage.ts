import type {UsageConfig} from '../../src/lib/usage/config';
import type {RedisCommand} from '../../src/lib/usage/redis';
import {RESERVE_LUA,SETTLE_LUA} from '../../src/lib/usage/redis';
import {withMeter,executionFor} from '../../src/lib/usage/runtime';
export const fixtureUsageConfig:UsageConfig={url:'https://unused-test.upstash.io',token:'unused-fixture-token',secret:'fixture-only-secret-with-32-characters',dailyMicroUsd:100000000,sessionDaily:20,ipDaily:30,concurrency:3,sessionConcurrency:1,rates:{'test-model':{inputPerMillion:1,outputPerMillion:2,checkedAt:'2026-10-09'},'gpt-6-luna':{inputPerMillion:1,outputPerMillion:2,checkedAt:'2026-10-09'},'local-test':{inputPerMillion:1,outputPerMillion:2,checkedAt:'2026-10-09'}},searchMicroUsd:10000,trustedIpHeader:'x-fixture-ip'};
/** Explicit test meter for installed-SDK serialization tests, never production authorization. */
export const withTestMeter=<T>(work:()=>Promise<T>,model='test-model')=>withMeter({execution:executionFor({requestId:'fixture-request',inputVersion:1,operation:'initial'},1000000),config:fixtureUsageConfig,expectedModel:model,maxOutputTokens:16000,modelCalls:0,searchCalls:0,actualMicroUsd:0,unknownCost:false,pendingProviders:0,ambiguousFailure:false,deadline:Date.now()+300000},work);
/** Atomic protocol simulator: validates business behavior, NOT Redis/Lua integration. */
export class RedisProtocolSimulator{
 values=new Map<string,string>();records=new Map<string,Record<string,string>>();zsets=new Map<string,Map<string,number>>();expires=new Map<string,number>();commands:Array<Array<string|number>>=[];
 now=Date.now();
 expire(key:string){if((this.expires.get(key)??Infinity)<=this.now){this.values.delete(key);this.records.delete(key);this.zsets.delete(key);}}
 command:RedisCommand=async command=>{
  this.commands.push(command);const [verb,...raw]=command;
  if(verb==='GET'){const key=String(raw[0]);this.expire(key);return this.values.get(key)??null;}
  if(verb==='SET'){this.values.set(String(raw[0]),String(raw[1]));this.expires.set(String(raw[0]),this.now+Number(raw[3])*1000);return 'OK';}
  if(verb!=='EVAL')throw new Error('Unexpected Redis command');
  const script=raw[0],n=Number(raw[1]),keys=raw.slice(2,2+n).map(String),args=raw.slice(2+n).map(String);keys.forEach(k=>this.expire(k));
  if(script===RESERVE_LUA){
   const [fingerprint,now,end,lease,amount,globalMax,sessionMax,sessionDaily,ipDaily,budget]=args;const record=this.records.get(keys[0]);
   if(record&&record.fingerprint!==fingerprint)return ['conflict'];
   if(record?.state==='completed')return this.values.has(keys[6])?['cached',this.values.get(keys[6])]:['expired'];
   if(record&&Number(record.expires)>Number(now)&&(record.state==='running'||record.state==='failed'&&this.zsets.get(keys[1])?.has(record.lease)))return ['running',Math.ceil((Number(record.expires)-Number(now))/1000)];
   for(const key of [keys[1],keys[2]]){const map=this.zsets.get(key)??new Map();for(const [id,until] of map)if(until<=Number(now))map.delete(id);this.zsets.set(key,map);}
   if(this.zsets.get(keys[1])!.size>=Number(globalMax)||this.zsets.get(keys[2])!.size>=Number(sessionMax))return ['concurrency'];
   if(Number(this.values.get(keys[3])??0)>=Number(sessionDaily)||Number(this.values.get(keys[4])??0)>=Number(ipDaily))return ['quota'];
   if(Number(this.values.get(keys[5])??0)+Number(amount)>Number(budget))return ['budget'];
   for(const key of [keys[3],keys[4]])this.values.set(key,String(Number(this.values.get(key)??0)+1));
   this.values.set(keys[5],String(Number(this.values.get(keys[5])??0)+Number(amount)));
   this.zsets.get(keys[1])!.set(lease,Number(end));this.zsets.get(keys[2])!.set(lease,Number(end));
   this.records.set(keys[0],{fingerprint,state:'running',expires:end,lease,reserved:amount});return ['reserved'];
  }
  if(script===SETTLE_LUA){const [lease,charged,state,encrypted,parent,retainLease]=args;const record=this.records.get(keys[0]);if(record?.lease!==lease)return ['stale'];if(record.state!=='running')return ['settled'];this.values.set(keys[3],String(Number(this.values.get(keys[3])??0)+Number(charged)-Number(record.reserved)));if(retainLease!=='1'){this.zsets.get(keys[1])?.delete(lease);this.zsets.get(keys[2])?.delete(lease);}record.state=state;if(state==='completed'){this.values.set(keys[4],encrypted);this.expires.set(keys[4],this.now+120000);if(parent){this.values.set(keys[5],parent);this.expires.set(keys[5],this.now+86400000);}}return ['settled'];}
  throw new Error('Unexpected Lua program');
 };
}
