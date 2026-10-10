import type {NewCaseInput} from '../contracts';
import {resolveJurisdiction} from '../jurisdiction';
import {issueSignals} from '../issue-legal-selection';
import type {CanonicalJurisdiction} from '../workflow-contracts';
import {structuredResearchPlan,type ResearchPlan} from './plan';
export {recognizedJurisdiction} from '../jurisdiction';

/** Only server-owned labels are ever serialized to a public search provider. */
export const APPROVED_ISSUES={
 detention:'detention',lawyer_access:'access to legal representation',file_access:'access to case records',
 threats:'threats against journalists',expression_restricted:'restrictions on expression',
 defamation:'defamation',online_defamation:'online defamation cyber libel',slapp:'strategic litigation against public participation',
 travel_restriction:'travel restrictions',platform_penalty:'platform penalties for expression',
 fair_trial:'fair trial safeguards',press_freedom:'journalism freedom of expression',
} as const;
const APPROVED_STAGES:Record<NewCaseInput['stage'],string>={investigation:'investigation',pretrial:'pretrial proceedings',trial:'trial',appeal:'appeal',postjudgment:'post judgment',unknown:''};
const APPROVED_KINDS={criminal:'criminal',civil:'civil',administrative:'administrative',platform:'platform decision',mixed:'mixed proceedings',unknown:'legal proceedings'} as const;
const APPROVED_REMEDIES:Record<NewCaseInput['primaryGoal'],string>={release:'release from detention',lawyer:'access to legal representation',conditions:'detention conditions',drop_charges:'charges',change_judgment:'review of judgment',other:'documented legal response',unknown:'legal safeguards'};
export type SafeResearchQuery={jurisdiction:CanonicalJurisdiction;caseKind:keyof typeof APPROVED_KINDS;stage:NewCaseInput['stage'];topics:string[];searchTerms:string[];plan:ResearchPlan;attempt:1|2;strategy:'direct_comparison'|'broader_legal_analogy'};
export function approvedIssueLabels(input:NewCaseInput,proposal?:ResearchPlan):string[]{
 const labels=new Set<string>([APPROVED_ISSUES.press_freedom]);
 const problemTags:Partial<Record<NewCaseInput['currentProblems'][number],keyof typeof APPROVED_ISSUES>>={detained:'detention',lawyer_access:'lawyer_access',file_access:'file_access',threats:'threats',expression_restricted:'expression_restricted'};
 for(const problem of input.currentProblems){const tag=problemTags[problem];if(tag)labels.add(APPROVED_ISSUES[tag]);}
 // After the confirmed problems: the narrative may name a legal subject no structured field records. Only the
 // server's own label is sent, and a negated mention (“也不是诽谤”) does not count.
 const signals=issueSignals(input);
 if(signals.defamation)labels.add(signals.online?APPROVED_ISSUES.online_defamation:APPROVED_ISSUES.defamation);
 // A model may suggest only an EXACT approved identifier/label. Its prose,
 // relationships, names and original searchQueries are never sent to search.
 for(const value of [...(proposal?.disputedConduct??[]),...(proposal?.evidenceIssues??[])]){
  if(Object.hasOwn(APPROVED_ISSUES,value))labels.add(APPROVED_ISSUES[value as keyof typeof APPROVED_ISSUES]);
  else if(Object.values(APPROVED_ISSUES).includes(value as never))labels.add(value);
 }
 return [...labels].slice(0,6);
}
export function buildResearchQuery(input:NewCaseInput,abstractPlan:ResearchPlan=structuredResearchPlan(input),attempt:1|2=1):SafeResearchQuery{
 const jurisdiction=resolveJurisdiction(input),caseKind=input.intake?.caseKind??'unknown';
 const location=jurisdiction.recognized?(jurisdiction.legalSystem??jurisdiction.country):'international comparative';
 const topics=approvedIssueLabels(input,abstractPlan);
 const subject=topics.filter(x=>x!==APPROVED_ISSUES.press_freedom).slice(0,2).join(' ')||APPROVED_ISSUES.press_freedom;
 const prefix=[location,APPROVED_KINDS[caseKind],APPROVED_STAGES[input.stage]].filter(Boolean).join(' ');
 const focus=subject===APPROVED_ISSUES.press_freedom?subject:`journalism ${subject}`;
 const suffix=attempt===1?'case judgment':'comparative legal safeguards case report';
 // A recognized jurisdiction also gets one search for the governing legal text itself, so the analysis can quote local law.
 const lawSubject=subject===APPROVED_ISSUES.press_freedom?`${caseKind==='unknown'?'':`${APPROVED_KINDS[caseKind]} `}freedom of expression`:subject;
 const lawTerm=jurisdiction.recognized?`${location} ${lawSubject} law official legislation text`:null;
 const searchTerms=[`${prefix} ${focus} ${suffix}`,`${location} journalism expression ${APPROVED_REMEDIES[input.primaryGoal]} ${suffix}`,...(lawTerm?[lawTerm]:[])];
 const plan:ResearchPlan={domain:'expression_media',relationship:'journalist or public speaker and legal authority or claimant',disputedConduct:topics,harms:[],remedies:[APPROVED_REMEDIES[input.primaryGoal]],evidenceIssues:[],excludedIssues:[],uncertainties:['Search labels are broad approved categories, not legal findings.'],searchQueries:searchTerms,coverage:'limited'};
 return {jurisdiction,caseKind,stage:input.stage,topics,searchTerms:[...new Set(searchTerms)],plan,attempt,strategy:attempt===1?'direct_comparison':'broader_legal_analogy'};
}
