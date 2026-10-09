import type {WorkflowErrorCode,DomainAssessment} from '../workflow-contracts';
export type ErrorCode=WorkflowErrorCode;
export class AnalysisError extends Error {
  retryable?:boolean;
  retryAfterSeconds?:number;
  domain?:DomainAssessment;
  constructor(public code:ErrorCode,message:string,public status=400,options:{retryable?:boolean;retryAfterSeconds?:number;domain?:DomainAssessment}={}){super(message);this.name='AnalysisError';Object.assign(this,options);}
}
const quotaCodes=new Set(['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded']);
export function publicError(error:unknown):AnalysisError{
  if(error instanceof AnalysisError)return error;
  const e=error as {name?:string;status?:number;code?:unknown;type?:unknown;error?:{code?:unknown;type?:unknown}};
  if([e?.code,e?.type,e?.error?.code,e?.error?.type].some(code=>typeof code==='string'&&quotaCodes.has(code)))return new AnalysisError('QUOTA_EXHAUSTED','OpenAI API 返回额度或账户预算错误。请管理员检查 OpenAI API 的可用额度及组织或项目预算；也可以明确选择规则参考。',429);
  if(e?.status===429)return new AnalysisError('RATE_LIMITED','OpenAI API 当前返回临时限流。请稍后重试，或明确选择规则参考。',429);
  if(e?.name==='APIConnectionTimeoutError'||e?.name==='TimeoutError')return new AnalysisError('TIMEOUT','分析超时，尚未生成有效结果。可以重试或选择规则参考。',504);
  if(e?.name==='AbortError'||e?.name==='APIUserAbortError')return new AnalysisError('CANCELLED','本次分析已取消。',499);
  return new AnalysisError('UPSTREAM_ERROR','AI 服务暂时无法完成分析，未生成有效结果。请稍后重试或选择规则参考。',502);
}
