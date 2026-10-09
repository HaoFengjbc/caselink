import type {Locale} from '../i18n/locale';
import type {NewCaseInput} from '../contracts';
import type {DomainAssessment} from '../workflow-contracts';
import {AnalysisError} from '../ai/errors';

/** User-confirmed scope wins. Neither a profession nor a word in prose proves a nexus. */
export function assessDomain(input:NewCaseInput,locale:Locale='zh'):DomainAssessment{
 if(locale==='en'){const value=assessDomain(input,'zh');const messages={in_scope:'The recorded activity is linked to journalism or expression; facts and legal applicability still need review.',out_of_scope:'The user confirms that this matter is unrelated to journalism or expression. Consult a local bar association, legal-aid body or existing adviser to identify suitable assistance; acceptance is not guaranteed.',needs_clarification:'The connection to journalism or expression is unclear. A profession or keyword alone does not decide scope.'};return {...value,reason:messages[value.status],clarification:value.status==='needs_clarification'?'Was the legal problem triggered by reporting, speaking, posting, reposting or another public expression activity?':null};}
 if(input.intake?.expression==='no')return {status:'out_of_scope',reason:'用户确认事项与新闻或表达活动无关。本工具聚焦由新闻和表达活动引发的法律问题。可从当地律师协会、法律援助机构或既有顾问核对合资格协助入口；不保证机构接案。',clarification:null,resourceIds:[]};
 if(input.intake?.expression==='yes')return {status:'in_scope',reason:'用户确认法律事项与新闻或表达活动相关；具体事实与法律适用仍须核对。',clarification:null,resourceIds:[]};
 if(!input.intake&&input.background.activities.some(a=>['reporting','investigation_report','social_media','repost'].includes(a)))return {status:'in_scope',reason:'逐题记录明确选择了新闻或公开表达活动；研究只描述用户提供的关联。',clarification:null,resourceIds:[]};
 return {status:'needs_clarification',reason:'现有记录不足以确认法律事项与新闻或表达活动的关联。不会仅凭职业或关键词排除案件。',clarification:'该法律事项是否因报道、发言、发帖、转发或其他公开表达活动引发？请确认关联，或说明尚不清楚。',resourceIds:[]};
}
export function requireResearchScope(input:NewCaseInput,locale:Locale='zh'):DomainAssessment{
 const domain=assessDomain(input,locale);
 if(domain.status!=='in_scope')throw new AnalysisError(domain.status==='out_of_scope'?'OUT_OF_SCOPE':'SCOPE_CLARIFICATION_REQUIRED',domain.reason,422,{retryable:false,domain});
 return domain;
}
