import {z} from 'zod';
import type {NewCaseInput} from '../contracts';

const abstractText=z.string().min(1).max(240);
const abstracts=z.array(abstractText).max(6);
export const ResearchPlanSchema=z.object({
 domain:z.enum(['civil_private_dispute','criminal_proceedings','administrative_dispute','employment','family','housing_property','consumer_services','business_contract','digital_services','expression_media','other','unknown']),
 relationship:abstractText,
 disputedConduct:abstracts,harms:abstracts,remedies:abstracts,evidenceIssues:abstracts,
 excludedIssues:abstracts,uncertainties:abstracts,
 searchQueries:z.array(z.string().min(1).max(240)).min(1).max(6),
 coverage:z.enum(['adequate','limited','insufficient']),
}).strict();
export type ResearchPlan=z.infer<typeof ResearchPlanSchema>;
// These private fields are validated locally and never returned or passed to web search.
export const ModelResearchPlanSchema=ResearchPlanSchema.extend({
 privateTerms:z.array(z.string().min(1).max(120)).max(40),
 groundingQuotes:z.array(z.string().min(1).max(400)).max(12),
}).strict();
export type ModelResearchPlan=z.infer<typeof ModelResearchPlanSchema>;
// Ephemeral local screening metadata: never an enumerable field, JSON value, cache or client payload.
const privatePlanTerms=new WeakMap<ResearchPlan,readonly string[]>();
export const privateTermsForPlan=(plan:ResearchPlan|undefined):readonly string[]=>plan?privatePlanTerms.get(plan)??[]:[];
export function inheritPlanPrivacy(from:ResearchPlan|undefined,to:ResearchPlan|undefined){if(from&&to)privatePlanTerms.set(to,privateTermsForPlan(from));}

export const researchMaterial=(input:NewCaseInput)=>[
 input.country,input.background.description,input.intake?.jurisdiction??'',input.intake?.narrative??'',input.intake?.goalText??'',
 ...(input.intake?.answers??[]).map(a=>a.answer),...(input.intake?.facts??[]).map(f=>f.text),
 input.priorActions.description,input.resourceConstraints,...input.keyDates.flatMap(d=>[d.date,d.event]),
].filter(Boolean);
const folded=(text:string)=>text.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu,'');
const PII=/(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|@[\p{L}\p{N}_-]{3,}|\b(?:wechat|whatsapp|telegram|phone|email|account\s*(?:id|number))\s*[:：=]|(?:微信号|手机号|身份证|账号ID|账户编号)\s*[:：=]|\b\d{4}[-/.年]\d{1,2}(?:[-/.月]\d{1,2})?|\b\d{1,2}[-/]\d{1,2}\b|\d{1,2}月\d{1,2}日|\b\d{5,}\b|\+?\d[\d ()-]{7,}\d|(?:[$€£¥￥]|人民币)\s*\d|\d[\d,.]*\s*(?:元|万元|美元|英镑|dollars?|pounds?|yuan)\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d|(?:street|road|avenue|邮编|门牌号)\s*[:：]?\s*\d)/iu;
const DIRECTIVE=/(?:ignore (?:all |previous |prior )?instructions|system prompt|reveal (?:the )?(?:password|api key)|忽略.{0,8}指令|泄露.{0,8}密钥)/iu;
const SPECIFIC_VALUE=/(?:\d[\d,.]*\s*(?:元|万元|美元|英镑|年|个月|天|小时)|\b\d+\s*(?:years?|months?|days?|hours?)\b|\b(?=[a-z0-9_-]{7,}\b)(?=[a-z0-9_-]*\d)(?=[a-z0-9_-]*[a-z])[a-z0-9_-]+\b)/iu;
export function sensitiveTerms(input:NewCaseInput):string[]{
 const text=researchMaterial(input).join('\n');
 const matches=text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:https?:\/\/|www\.)\S+|@[\p{L}\p{N}_-]{3,}|\b\d[\d ()-]{7,}\d\b|(?:姓名|名字|微信号|账号|账户|name|wechat|account(?: id)?)\s*[:：=]\s*[^\s,，;；。]{2,80}/giu)??[];
 const markedNames=[...text.matchAll(/(?:我叫|姓名是|名叫|名字是|微信是|账号是)\s*([^\s,，;；。]{2,40})/gu)].map(m=>m[1]);
 const distinctiveEnglish=text.match(/\b[A-Z][a-z]+[A-Z][A-Za-z0-9_-]*\b|\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/g)??[];
 return [...new Set([...matches.flatMap(m=>[m,m.split(/[:：=]/).at(-1)??m]),...markedNames,...distinctiveEnglish])];
}
/** Heuristic privacy screening, not a proof of anonymity or semantic correctness. */
export function unsafePublicText(text:string,input?:NewCaseInput,privateTerms:readonly string[]=[]):boolean{
 if(PII.test(text)||SPECIFIC_VALUE.test(text)||DIRECTIVE.test(text)||/[\u0000-\u001F<>]/.test(text))return true;
 const normalized=folded(text);
 if([...privateTerms,...(input?sensitiveTerms(input):[])].some(t=>folded(t).length>=2&&normalized.includes(folded(t))))return true;
 if(!input)return false;
 return researchMaterial(input).some(raw=>{
  const original=raw.trim();if(!original)return false;
  // Reject long verbatim runs, including Chinese runs, even when a model omitted them from privateTerms.
  const plain=folded(original);
  const run=/[\p{Script=Han}]/u.test(original)?18:64;
  if(plain.length>=run){for(let start=0;start<=plain.length-run;start++)if(normalized.includes(plain.slice(start,start+run)))return true;}
  // Entire short private sentences are not safe abstractions either. Generic one-word labels remain usable.
  if(plain.length>=8&&original.length<=40&&normalized.includes(plain)&&(/[我你他她]|\b(?:i|my|we|our)\b/iu.test(original)))return true;
  return false;
 });
}
const unique=(items:string[])=>[...new Set(items)];
export function structuredResearchPlan(input:NewCaseInput):ResearchPlan{
 const conduct:string[]=[];const remedies:string[]=[];const evidence:string[]=[];
 if(input.currentProblems.includes('detained'))conduct.push('detention');
 if(input.currentProblems.includes('lawyer_access'))conduct.push('denial of access to legal representation');
 if(input.currentProblems.includes('expression_restricted'))conduct.push('restriction of expression');
 if(input.currentProblems.includes('threats'))conduct.push('threats or intimidation');
 if(input.currentProblems.includes('file_access'))evidence.push('access to case records');
 const goals:Partial<Record<NewCaseInput['primaryGoal'],string>>={release:'release from detention',lawyer:'access to legal representation',conditions:'improvement of detention conditions',drop_charges:'withdrawal of charges',change_judgment:'review of a judgment'};
 if(goals[input.primaryGoal])remedies.push(goals[input.primaryGoal]!);
 if(input.stage==='appeal')remedies.push('appeal review');
 return {domain:'unknown',relationship:'relationship not established',disputedConduct:conduct,harms:[],remedies:unique(remedies),evidenceIssues:evidence,excludedIssues:[],uncertainties:['Narrative has not been semantically planned.'],searchQueries:unique([...remedies,...conduct,...evidence]).map(t=>`${t} comparable decisions`).slice(0,6).concat(conduct.length+remedies.length+evidence.length?[]:['legal dispute comparable decisions']),coverage:'limited'};
}
export function validateResearchPlan(raw:unknown,input:NewCaseInput):ResearchPlan{
 const parsed=ModelResearchPlanSchema.parse(raw);
 const {privateTerms,groundingQuotes,...candidate}=parsed;
 const material=researchMaterial(input);
 if(groundingQuotes.some(q=>!material.some(s=>s.includes(q))))throw new Error('ungrounded_plan');
 if(material.some(t=>t.trim())&&!groundingQuotes.length)throw new Error('ungrounded_plan');
 const texts=[candidate.relationship,...candidate.disputedConduct,...candidate.harms,...candidate.remedies,...candidate.evidenceIssues,...candidate.excludedIssues,...candidate.uncertainties,...candidate.searchQueries];
 if(texts.some(t=>unsafePublicText(t,input,privateTerms)))throw new Error('unsafe_plan');
 // Confirmed structured problems and selected primary goal are never displaced by model guesses.
 const fixed=structuredResearchPlan(input);
 const result={...candidate,disputedConduct:unique([...fixed.disputedConduct,...candidate.disputedConduct]).slice(0,6),remedies:unique([...fixed.remedies,...candidate.remedies]).slice(0,6),evidenceIssues:unique([...fixed.evidenceIssues,...candidate.evidenceIssues]).slice(0,6)};
 // An excluded topic must not become a positive search term. Fail closed instead of guessing its polarity.
 if(result.excludedIssues.some(issue=>result.searchQueries.some(query=>folded(query).includes(folded(issue)))))throw new Error('contradictory_plan');
 const validated=ResearchPlanSchema.parse(result);
 privatePlanTerms.set(validated,privateTerms);
 return validated;
}
