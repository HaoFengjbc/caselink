import { AnalysisError } from './errors';
export type ReasoningEffort='low'|'medium'|'high';
export type ServerConfig={mode:'demo'|'live';key:string;model:string;timeoutMs:number;reasoningEffort:ReasoningEffort;maxOutputTokens:number;configured:boolean};
export function readConfig(env:Readonly<Record<string,string|undefined>>=process.env):ServerConfig{
  const mode=env.ANALYSIS_MODE??'demo';
  if(mode!=='demo'&&mode!=='live')throw new AnalysisError('CONFIGURATION_ERROR','ANALYSIS_MODE 必须为 demo 或 live。请管理员检查服务端配置。',503);
  const timeoutMs=Number(env.AI_TIMEOUT_MS||90000);
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>90000)throw new AnalysisError('CONFIGURATION_ERROR','AI_TIMEOUT_MS 必须为 1000 至 90000 毫秒；同时受整次分析总时限约束。',503);
  const reasoningEffort=env.OPENAI_REASONING_EFFORT||'low';
  if(!['low','medium','high'].includes(reasoningEffort))throw new AnalysisError('CONFIGURATION_ERROR','OPENAI_REASONING_EFFORT 必须为 low、medium 或 high；默认 low 以控制响应时间。',503);
  const maxOutputTokens=Number(env.AI_MAX_OUTPUT_TOKENS||9000);
  if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<4000||maxOutputTokens>16000)throw new AnalysisError('CONFIGURATION_ERROR','AI_MAX_OUTPUT_TOKENS 必须为 4000 至 16000 的整数。',503);
  const key=env.OPENAI_API_KEY?.trim()??'';const model=env.OPENAI_MODEL?.trim()??'';
  return {mode,key,model,timeoutMs,reasoningEffort:reasoningEffort as ReasoningEffort,maxOutputTokens,configured:!!key&&!!model};
}
export function requireLiveConfiguration(config:ServerConfig){
  if(!config.configured)throw new AnalysisError('CONFIGURATION_ERROR','实时 AI 尚未完整配置：需要服务端 API 密钥和模型。可明确选择规则参考继续。',503);
}
