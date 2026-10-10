import type {ModelAnalysisOutput,NewCaseInput} from '../contracts';
import type {LegalBinding,LegalResearch} from '../legal-contracts';
import type {WebResearch} from '../research/contracts';
import type {AnalysisContext} from '../evidence/validate';
import type {Locale} from '../i18n/locale';
import {resources} from '../corpus';
import {localizeResource} from '../i18n/content';
import {materialPages} from '../materials/pages';
import {quoteKey,verifyQuotes,type QuoteCheck} from '../research/verify-source';
import {CaseIssueSchema,type CaseIssue,type CaseIssueAuthority} from './contracts';

const tr=(locale:Locale,zh:string,en:string)=>locale==='en'?en:zh;
const NUMBERED=/第\s*[0-9一二三四五六七八九十百千]+(?:[（(][0-9一二三四五六七八九十]+[）)])?\s*[条條款项段]|\b(?:article|art\.|section|sec\.|rule|paragraph|para\.)\s*\d+/gi;
// Same bounded checks the action cards use: no definite findings of illegality and no promised outcomes.
const DEFINITE=/(?:本案|本次拘押|该拘押|该起诉|该限制|该判决|定罪)(?:当然|显然|明确|已|已经|必然|确定|属于|构成|是|已构成){0,3}(?:违法|非法|违宪|违反|无效)|\b(?:this|the current)\s+(?:detention|prosecution|restriction|case|conviction)\s+(?:is|clearly is|definitely is)\s+(?:unlawful|illegal|unconstitutional|void)\b/i;
const PROMISE=/(?:一定|必然|肯定|保证|确保)(?:会|能|可以)?(?:胜诉|无罪|撤销|撤诉|获释|成功)|\b(?:will|guarantee[sd]?|certainly)\s+(?:win|succeed|be (?:acquitted|released|overturned))\b/i;
const PUBLISH_NOW=/(?:立即|直接|现在就|马上)(?:向媒体|发布|公开|发帖|联系媒体)|\b(?:immediately|right away|now)\b[^.\n]{0,20}?\b(?:publish|post|go public|contact (?:the )?(?:media|press))\b/i;

function binding(research:LegalResearch,id:string|null):LegalBinding|undefined{return id?research.bindings.find(b=>b.bindingId===id&&b.applicability!=='excluded'&&!b.conditions.some(c=>c.status==='not_met')):undefined;}
function catalogAuthority(b:LegalBinding,point:string,locale:Locale):CaseIssueAuthority|null{
 const found=resources.find(r=>r.resourceId===b.resourceId),resource=found?localizeResource(found,locale):undefined,provision=resource?.sourceAudit?.provisions.find(p=>p.provisionId===b.provisionId);
 if(!resource||!provision)return null;
 const url=resource.sourceAudit?.readUrl||resource.officialUrl;
 return {kind:['domestic_law','procedure_rule'].includes(resource.type??'')?'local':'international',check:'catalog',title:resource.name,locator:provision.locator,point:point.slice(0,300),quote:provision.quote.slice(0,800),url,hostname:new URL(url).hostname,bindingId:b.bindingId,caseId:null,evidenceIds:[]};
}
/** Numbered provisions in the analysis must be ones this issue actually cites. */
function citesOnlyKnownProvisions(text:string,authorities:CaseIssueAuthority[]):boolean{
 const known=authorities.map(a=>`${a.locator??''} ${a.title}`).join(' ').toLowerCase();
 return [...text.matchAll(NUMBERED)].every(match=>{const number=match[0].match(/\d+|[一二三四五六七八九十百千]+/)?.[0]??'';return !!number&&known.includes(number.toLowerCase());});
}

/** Rule mode, or no usable AI issues: the curated research questions, each with its catalog provisions. */
export function ruleCaseIssues(research:LegalResearch|undefined,locale:Locale):CaseIssue[]{
 if(!research)return [];
 const groups=new Map<string,LegalBinding[]>();
 for(const b of research.bindings.filter(b=>b.applicability!=='excluded'&&!b.conditions.some(c=>c.status==='not_met')))groups.set(b.issue,[...(groups.get(b.issue)??[]),b]);
 return [...groups.values()].slice(0,3).map((bindings,index)=>{
  const facts=[...new Map(bindings.flatMap(b=>b.factBasis).map(f=>[f.text,f])).values()].slice(0,2).map(f=>({text:f.text.slice(0,240),origin:f.origin==='document'?'document' as const:'user' as const,pageLabel:f.page?tr(locale,`第 ${f.page} 页`,`p. ${f.page}`):null}));
  const authorities=bindings.slice(0,4).map(b=>catalogAuthority(b,b.claim,locale)).filter((a):a is CaseIssueAuthority=>!!a);
  return CaseIssueSchema.parse({issueId:`issue-${index+1}`,question:bindings[0]!.issue.slice(0,160),facts,authorities,application:null,nextStep:bindings[0]!.nextChecks[0]?.slice(0,200)??null,origin:'rule'});
 }).filter(issue=>issue.authorities.length>0);
}

/**
 * Turn the model's issues into checked records. Facts must point at the uploaded material or the user's
 * notes; authorities must be a curated binding, a library case with its own excerpts, or a public page
 * whose quoted words the server finds itself. Analysis text that names a provision the issue does not
 * cite, asserts illegality or promises an outcome is withheld. Without usable issues, rule issues are used.
 */
export async function buildCaseIssues(output:ModelAnalysisOutput,options:{input:NewCaseInput;research?:LegalResearch;context:AnalysisContext;webResearch?:WebResearch;locale:Locale;mode:'live_ai'|'rule_reference'|'preset_demo';signal?:AbortSignal;budgetMs?:number;verify?:typeof verifyQuotes}):Promise<{issues:CaseIssue[];actionIssueIds:Map<string,string[]>}>{
 const {input,research,context,webResearch,locale}=options;
 const fallback=()=>({issues:ruleCaseIssues(research,locale),actionIssueIds:new Map<string,string[]>()});
 const drafts=options.mode==='live_ai'?(output.issues??[]).filter((issue,index,all)=>all.findIndex(other=>other.issueId===issue.issueId)===index).slice(0,3):[];
 if(!drafts.length)return fallback();
 const materials=input.intake?.materials,documents=materials?.documents??[];
 const sources=webResearch?.status==='completed'?new Map(webResearch.sources.map(source=>[source.sourceId,source])):new Map();
 const checks:QuoteCheck[]=[];
 for(const issue of drafts)for(const a of issue.authorities){const source=a.kind==='local'&&!a.bindingId&&a.sourceId?sources.get(a.sourceId):undefined;if(source&&a.quote)checks.push({url:source.url,quote:a.quote.trim()});}
 const matched=checks.length?await (options.verify??verifyQuotes)(checks,{signal:options.signal,budgetMs:options.budgetMs}):new Map<string,string|null>();
 const issues:CaseIssue[]=[];
 for(const issue of drafts){
  const facts=issue.facts.flatMap((fact):CaseIssue['facts']=>{
   if(fact.materialItemId){const item=materials?.items.find(i=>i.id===fact.materialItemId);return item?[{text:fact.text,origin:'document' as const,pageLabel:materialPages(item,documents,locale)}]:[];}
   if(fact.factId)return input.intake?.facts.some(f=>f.id===fact.factId)?[{text:fact.text,origin:'user' as const,pageLabel:null}]:[];
   return [{text:fact.text,origin:'user' as const,pageLabel:null}];
  });
  const authorities:CaseIssueAuthority[]=[];
  for(const a of issue.authorities){
   if(a.kind==='case'){
    const record=context.cases.find(c=>c.caseId===a.caseId),evidenceIds=[...new Set(a.evidenceIds)].filter(id=>context.evidence.some(e=>e.evidenceId===id&&e.caseId===a.caseId));
    if(record&&evidenceIds.length)authorities.push({kind:'case',check:'library',title:record.title,locator:null,point:a.point,quote:null,url:null,hostname:null,bindingId:null,caseId:record.caseId,evidenceIds});
    continue;
   }
   const curated=research?binding(research,a.bindingId):undefined;
   if(curated){const authority=catalogAuthority(curated,a.point,locale);if(authority)authorities.push(authority);continue;}
   const source=a.kind==='local'&&a.sourceId?sources.get(a.sourceId):undefined;
   const quote=source&&a.quote?matched.get(quoteKey({url:source.url,quote:a.quote.trim()})):null;
   if(source&&quote)authorities.push({kind:'local',check:'quote_matched',title:source.title,locator:a.locator,point:a.point,quote,url:source.url,hostname:source.hostname,bindingId:null,caseId:null,evidenceIds:[]});
  }
  if(!facts.length&&!authorities.length)continue;
  const application=issue.application.trim();
  const usable=authorities.length>0&&application&&!DEFINITE.test(application)&&!PROMISE.test(application)&&citesOnlyKnownProvisions(application,authorities);
  const nextStep=issue.nextStep.trim();
  const restricted=input.publicity!=='public'||!!input.intake?.disclosureDetails.trim();
  issues.push(CaseIssueSchema.parse({issueId:issue.issueId,question:issue.question,facts,authorities:authorities.map(a=>({...a,point:DEFINITE.test(a.point)||PROMISE.test(a.point)?tr(locale,'与本问题相关；具体适用须由律师判断。','Relevant to this question; a lawyer must judge how it applies.'):a.point})),application:usable?application:null,nextStep:nextStep&&!(restricted&&PUBLISH_NOW.test(nextStep))?nextStep:null,origin:'ai'}));
 }
 if(!issues.some(issue=>issue.authorities.length))return fallback();
 const kept=new Set(issues.map(issue=>issue.issueId));
 return {issues,actionIssueIds:new Map(output.actionOptions.map(action=>[action.actionId,(action.issueIds??[]).filter(id=>kept.has(id))]))};
}
