import {AnalysisError} from '../ai/errors';

export const RESULT_TTL_SECONDS=120;
export const MODEL_INPUT_BYTE_LIMIT=131072;
// Text-only input: one token per UTF-8 byte + schema/chat framing allowance.
export const MODEL_INPUT_TOKEN_BOUND=262144;
export const LEASE_SECONDS=360;
export type ModelRate={inputPerMillion:number;outputPerMillion:number;checkedAt:string};
export type UsageConfig={url:string;token:string;secret:string;dailyMicroUsd:number;sessionDaily:number;ipDaily:number;concurrency:number;sessionConcurrency:number;rates:Record<string,ModelRate>;searchMicroUsd:number;trustedIpHeader:string|null};
const failure=()=>new AnalysisError('USAGE_CONTROL_UNAVAILABLE','付费用量保护尚未完整配置或暂不可用。可继续手动整理或明确选择规则参考。',503,{retryable:false});
export function readUsageConfig(env:Readonly<Record<string,string|undefined>>=process.env,options:{searchRequired?:boolean}={}):UsageConfig{
 const url=env.UPSTASH_REDIS_REST_URL??'',token=env.UPSTASH_REDIS_REST_TOKEN??'',secret=env.USAGE_SESSION_SECRET??'';
 if(!/^https:\/\/[a-z0-9.-]+(?::443)?\/?$/i.test(url)||!token||secret.length<32)throw failure();
 const positive=(name:string,fallback?:number)=>{const value=Number(env[name]??fallback);if(!Number.isFinite(value)||value<=0)throw failure();return value;};
 const integer=(name:string,fallback:number)=>{const value=positive(name,fallback);if(!Number.isSafeInteger(value))throw failure();return value;};
 let rates:Record<string,ModelRate>;try{rates=JSON.parse(env.AI_MODEL_RATES_JSON??'');}catch{throw failure();}
 if(!rates||typeof rates!=='object'||Array.isArray(rates)||!Object.keys(rates).length)throw failure();
 for(const [model,rate] of Object.entries(rates))if(!model||!rate||!Number.isFinite(rate.inputPerMillion)||rate.inputPerMillion<=0||!Number.isFinite(rate.outputPerMillion)||rate.outputPerMillion<=0||!/^\d{4}-\d{2}-\d{2}$/.test(rate.checkedAt))throw failure();
 const search=options.searchRequired!==false&&env.CONTROLLED_SEARCH_ENABLED==='true'?positive('BRAVE_SEARCH_MAX_COST_USD'):0;
 return {url,token,secret,dailyMicroUsd:Math.ceil(positive('AI_GLOBAL_DAILY_BUDGET_USD')*1e6),sessionDaily:integer('AI_SESSION_DAILY_REQUESTS',10),ipDaily:integer('AI_IP_DAILY_REQUESTS',30),concurrency:integer('AI_GLOBAL_CONCURRENCY',3),sessionConcurrency:integer('AI_SESSION_CONCURRENCY',1),rates,searchMicroUsd:Math.ceil(search*1e6),trustedIpHeader:env.VERCEL==='1'?'x-vercel-forwarded-for':env.USAGE_TRUSTED_IP_HEADER?.toLowerCase()??null};
}
export function usageConfigurationStatus(env:Readonly<Record<string,string|undefined>>=process.env):boolean{try{const c=readUsageConfig(env);const model=env.OPENAI_MODEL?.trim()??'',intake=env.OPENAI_INTAKE_MODEL?.trim()??'gpt-6-luna';return !!c.trustedIpHeader&&Object.hasOwn(c.rates,model)&&Object.hasOwn(c.rates,intake);}catch{return false;}}
export function reserveMicroUsd(config:UsageConfig,model:string,maxOutputTokens:number,searchCalls:number):number{
 const rate=Object.hasOwn(config.rates,model)?config.rates[model]:undefined;if(!rate)throw failure();
 return Math.ceil(MODEL_INPUT_TOKEN_BOUND*rate.inputPerMillion+maxOutputTokens*rate.outputPerMillion)+searchCalls*config.searchMicroUsd;
}
export {failure as usageUnavailable};

/** Extraction needs only its own model and shared budget; never a search-provider credential. */
export function materialUsageConfigured(env:Readonly<Record<string,string|undefined>>=process.env):boolean{try{const config=readUsageConfig(env,{searchRequired:false});return !!config.trustedIpHeader&&Object.hasOwn(config.rates,env.OPENAI_INTAKE_MODEL?.trim()||'gpt-6-luna');}catch{return false;}}
