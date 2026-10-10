import type {NewCaseInput} from './contracts';
import {resolveJurisdiction} from './jurisdiction';

export type IssueLegalRef=[resourceId:string,provisionId:string,claimKey:string];
type Locale='zh'|'en';

/** Lexical clues only identify a research question. They never verify custody or its duration. */
function libertySignals(text:string,explicitFlag:boolean,explicitlyNone:boolean){
 const detention=/(?:被带走|被帶走|拘押|拘留|逮捕|羁押|羈押|\bunder arrest\b|\bdetained\b|\barrested\b|\bin custody\b|\btaken (?:away|into custody)\b)/i;
 const clauses=text.split(/[。；;,.，.!?！？\n]+|\bbut\b|但是|但随后|但隨後/).map(value=>value.trim()).filter(Boolean);
 const current=/(?:目前|现在|現在|仍|还在|還在|至今|尚未获释|尚未獲釋|未获释|未獲釋|仍未释放|仍未釋放|\bcurrently\b|\bstill\b|\bremains?\b|\bnot (?:yet )?released\b)/i;
 const negated=/(?:并未|並未|从未|從未|没有|沒有|并没有|未曾|未|不曾|不是|並非|并非)(?:被|遭|遭到|受到|正在)?(?:带走|帶走|拘押|拘留|逮捕|羁押|羈押)|(?:不|未)(?:在|处于|處於)(?:拘押|拘留|羁押|羈押)|\b(?:not|never)(?:\s+(?:been|being|currently|now|placed|held))?\s+(?:detained|arrested|under arrest|in custody|taken away)\b/i;
 const historical=/(?:曾经|曾經|曾被|曾遭|此前|过去|過去|去年|多年前|\bpreviously\b|\bformerly\b|\bused to be\b|\bin the past\b|\byears? ago\b)/i;
 const futureOnly=/(?:可能会|可能會|将被|將被|担心会|擔心會|担心被|擔心被|可能被|恐遭|\bmay be\b|\bmight be\b|\bcould be\b|\bfears? (?:being|arrest)\b)/i;
 // Remove a negated release before checking the actual release statement: “尚未获释”
 // is not “已获释”. A reported release is a conflict guard, not a verified outcome.
 const released=clauses.some(c=>/(?:已(?:经|經)?获释|已(?:经|經)?獲釋|已经释放|已被释放|已被釋放|已释放|已釋放|现已释放|現已釋放|现已自由|現在自由|不再.{0,5}(?:拘押|拘留|羁押)|\b(?:has been|was|is now|now|already)\s+released\b|\bno longer (?:detained|under arrest|in custody)\b)/i.test(c.replace(/(?:尚未|未|没有|沒有|並未|并未)(?:获释|獲釋|释放|釋放)|\bnot (?:yet )?released\b/gi,'')));
 const activeClauses=clauses.filter(c=>detention.test(c)&&!negated.test(c)&&!(historical.test(c)&&!current.test(c))&&!futureOnly.test(c));
 const renewed=activeClauses.some(c=>/(?:再次|又被|重新).{0,10}(?:带走|帶走|拘押|拘留|逮捕)|\b(?:again|re-arrested|rearrested|re-detained)\b/i.test(c));
 const explicitlyDenied=clauses.some(c=>detention.test(c)&&negated.test(c));
 const libertyConcern=!explicitlyNone&&(explicitFlag||activeClauses.length>0)&&(!released||renewed)&&(!explicitlyDenied||activeClauses.length>0);
 // A narrative or extracted document never upgrades this fact condition to confirmed.
 // Contradictory release/denial language also prevents an old flag being carried forward.
 const detentionExplicit=!explicitlyNone&&explicitFlag&&!released&&!explicitlyDenied;
 return {libertyConcern,detentionExplicit,detained:libertyConcern};
}

/** Select research questions from confirmed fields, never from fixture IDs or nationality alone. */
export function issueSignals(input:NewCaseInput){
 const text=[input.background.description,input.intake?.narrative??'',...(input.intake?.facts.map(f=>f.text)??[]),...(input.intake?.materials?.items.map(item=>item.text)??[])].join('\n');
 let proceeding=input.intake?.caseKind??'unknown';
 if(!input.intake&&!/不清楚|未确认|尚不清楚|unknown|unclear/i.test(text)){
  if(/刑事|criminal/i.test(text)&&!/非刑事|不是刑事|not criminal/i.test(text))proceeding='criminal';
  else if(/民事|civil/i.test(text)&&!/非民事|不是民事|not civil/i.test(text))proceeding='civil';
 }
 const expression=input.intake?.expression!=='no'&&(input.intake?.expression==='yes'||input.currentProblems.includes('expression_restricted')||input.background.activities.some(a=>['reporting','investigation_report','social_media','repost'].includes(a)));
 const liberty=libertySignals(text,input.currentProblems.includes('detained'),input.currentProblems.includes('none'));
 const defamation=/(?:诽谤|誹謗|名誉|名譽|\bdefamation\b|\bdefamatory\b|\blibel\b|\bslander\b)/i.test(text);
 const defence=input.currentProblems.some(p=>['lawyer_access','file_access'].includes(p))||['trial','appeal','postjudgment'].includes(input.stage);
 return {text,proceeding,expression,...liberty,defamation,defence,jurisdiction:resolveJurisdiction(input)};
}

export function selectIssueLegalRefs(input:NewCaseInput,_locale:Locale='zh'):IssueLegalRef[]{
 const s=issueSignals(input);const refs:IssueLegalRef[]=[];
 // A private platform notice requires authority/rule/appeal fact collection first.
 // This MVP has no verified state-attribution field; it cannot assert an ICCPR violation.
 if(s.proceeding==='platform')return refs;
 if(s.expression){
  refs.push(['iccpr-article-19','art19-2-3','expression_restriction_test'],['hrc-general-comment-34','para22','expression_restriction_test'],['hrc-general-comment-34','para25','expression_legality_test'],['hrc-general-comment-34','paras33-35','expression_necessity_proportionality']);
  if(s.defamation)refs.push(['hrc-general-comment-34','para47','defamation_safeguards']);
 }
 if(s.detained){
  refs.push(['iccpr-article-9','art9-1-2','detention_basis_notice'],['iccpr-article-9','art9-4','detention_review'],['hrc-general-comment-35','paras39-40','detention_review']);
  if(s.detentionExplicit&&s.proceeding==='criminal'&&['investigation','pretrial','trial'].includes(input.stage))refs.push(['iccpr-article-9','art9-3','criminal_detention_review'],['hrc-general-comment-35','para38','pretrial_detention_alternatives']);
 }
 if(s.proceeding==='criminal'&&(s.defence||s.detained||s.expression))refs.push(['iccpr-article-14','art14-3-b-d','criminal_defence'],['hrc-general-comment-32','paras32-34','criminal_defence']);
 if(s.proceeding==='civil'&&['trial','appeal','postjudgment'].includes(input.stage))refs.push(['iccpr-article-14','art14-1','civil_fair_hearing']);
 if(s.jurisdiction.countryCode==='KZ'&&s.proceeding==='criminal'&&s.detained){
  refs.push(['kz-criminal-procedure-detention','art140-2','kz_detention_order_copy']);
  if(['investigation','pretrial','unknown'].includes(input.stage))refs.push(['kz-criminal-procedure-detention','art107-1-2','kz_detention_review'],['kz-criminal-procedure-detention','art147-1-2','kz_detention_alternatives']);
 }
 if(s.jurisdiction.countryCode==='TN'&&s.proceeding==='criminal'&&s.expression)refs.push(['tn-constitution-expression','art37','tn_expression_guarantee'],['tn-constitution-expression','art55','tn_expression_limit_test']);
 if(s.jurisdiction.countryCode==='GB'&&s.jurisdiction.jurisdictionCode==='england_wales'&&s.proceeding==='civil'&&s.defamation){
  refs.push(['ew-defamation-act-2013','s1','ew_serious_harm'],['ew-defamation-act-2013','s4','ew_public_interest_defence']);
  if(!['trial','appeal','postjudgment'].includes(input.stage))refs.push(['ew-media-protocol','paras3-2-3-6-3-7','ew_preaction_response']);
  if(/公共采购|腐败|诈骗|经济犯罪|procurement|corruption|fraud|economic crime|slapp/i.test(s.text)){
   refs.push(['ew-economic-crime-slapp','s195','ew_slapp_economic_crime_scope']);
   // Presence here remains only a condition checklist; the binding's separate court-document
   // gate excludes advancing a strike-out step when no pleading has been supplied.
   refs.push(['ew-cpr-slapp-strikeout','rule3-4-2-d','ew_slapp_procedural_route']);
  }
 }
 // Migration/travel restrictions are selected only when stated. Other expansion topics
 // await verified provisions; absence never fabricates a supporting resource.
 if(/出境限制|限制出境|禁止离境|travel ban|exit ban|passport confiscat/i.test(s.text))refs.push(['iccpr-article-12','art12-2-3','travel_restriction_review']);
 return refs.filter((ref,index)=>refs.findIndex(other=>other.join('/')===ref.join('/'))===index);
}
