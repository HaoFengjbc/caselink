export type ErrorCode='INVALID_INPUT'|'PAYLOAD_TOO_LARGE'|'CONFIGURATION_ERROR'|'FORBIDDEN'|'TIMEOUT'|'CANCELLED'|'RATE_LIMITED'|'QUOTA_EXHAUSTED'|'MODEL_REFUSAL'|'INCOMPLETE_OUTPUT'|'INVALID_MODEL_OUTPUT'|'UPSTREAM_ERROR'|'INTERNAL_ERROR';
export class AnalysisError extends Error {
  constructor(public code:ErrorCode,message:string,public status=400){super(message);this.name='AnalysisError';}
}
const quotaCodes=new Set(['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded']);
export function publicError(error:unknown):AnalysisError{
  if(error instanceof AnalysisError)return error;
  const e=error as {name?:string;status?:number;code?:unknown;type?:unknown;error?:{code?:unknown;type?:unknown}};
  if([e?.code,e?.type,e?.error?.code,e?.error?.type].some(code=>typeof code==='string'&&quotaCodes.has(code)))return new AnalysisError('QUOTA_EXHAUSTED','AI 服务因可用额度或预算限制暂不可用。请联系管理员检查 OpenAI API 可用额度及组织或项目预算；也可以明确选择规则参考。',429);
  if(e?.status===429)return new AnalysisError('RATE_LIMITED','AI 服务当前临时限流。请稍后重试，或明确选择规则参考。',429);
  if(e?.name==='APIConnectionTimeoutError'||e?.name==='TimeoutError')return new AnalysisError('TIMEOUT','分析超时，尚未生成有效结果。可以重试或选择规则参考。',504);
  if(e?.name==='AbortError'||e?.name==='APIUserAbortError')return new AnalysisError('CANCELLED','本次分析已取消。',499);
  return new AnalysisError('UPSTREAM_ERROR','AI 服务暂时无法完成分析，未生成有效结果。请稍后重试或选择规则参考。',502);
}
