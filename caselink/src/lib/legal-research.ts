import type {ModelAnalysisOutput,NewCaseInput,Resource} from './contracts';
import type {LegalBinding,LegalResearch} from './legal-contracts';
import {resources} from './corpus';
import {resolveJurisdiction} from './jurisdiction';
import scenarioJson from '../../data/resources/scenario-research.json';
import {DEMO_SCENARIOS,DEMO_SCENARIOS_EN} from '../../data/demo/fixtures';

type Locale='zh'|'en';
type Proceeding='criminal'|'civil'|'administrative'|'mixed'|'unknown';
type Scenario={scenarioId:string;jurisdiction:string;proceeding:Proceeding;coreQuestion:string;coverage:LegalResearch['coverage'];coverageNote:string;resourceIds:string[];gaps:string[]};
const scenarios=scenarioJson as Scenario[];
const internationalRefs:Record<string,Array<[string,string,string]>>={
 KZ:[['iccpr-article-9','art9-4','detention_review'],['iccpr-article-14','art14-3-b-d','criminal_defence'],['iccpr-article-19','art19-2-3','expression_restriction_test']],
 TN:[['iccpr-article-19','art19-2-3','expression_restriction_test'],['iccpr-article-14','art14-3-b-d','criminal_defence']],
 'GB-EAW':[['echr-article-10','art10-2','expression_restriction_test'],['echr-article-6','art6-1','civil_fair_hearing'],['hrc-general-comment-34','para47','defamation_safeguards']]
};
const pick=(locale:Locale,zh:string,en:string)=>locale==='en'?en:zh;
export function legalJurisdiction(input:NewCaseInput):string{
 const jurisdiction=resolveJurisdiction(input);
 return jurisdiction.countryCode==='GB'&&jurisdiction.jurisdictionCode==='england_wales'?'GB-EAW':jurisdiction.countryCode==='GB'?`GB-${jurisdiction.jurisdictionCode}`:jurisdiction.countryCode??'unknown';
}
/** Only explicit intake fields or the unchanged legacy fictional scenario contract establish procedure. */
export function legalProceeding(input:NewCaseInput):Proceeding{
 if(input.intake)return input.intake.caseKind;
 const originalExample=[...DEMO_SCENARIOS,...DEMO_SCENARIOS_EN].some(scenario=>scenario.id===input.exampleId&&scenario.input.country===input.country&&scenario.input.background.description===input.background.description);
 if(input.isExample&&originalExample&&((input.exampleId==='journalist-private-release'&&legalJurisdiction(input)==='KZ')||(input.exampleId==='blogger-public-charges'&&legalJurisdiction(input)==='TN')))return 'criminal';
 return 'unknown';
}
function resourceMatchesJurisdiction(resource:Resource,jurisdiction:string):boolean{
 const declared=resource.sourceAudit?.jurisdiction??[];
 if(resource.type==='domestic_law'||resource.type==='procedure_rule')return declared.includes(jurisdiction);
 // International scope is not evidence of treaty participation, direct effect or complaint eligibility.
 return declared.some(value=>['international','universal','all','global','UN member states','UN'].includes(value))||declared.includes(jurisdiction)||declared.includes(jurisdiction.startsWith('GB-')?'GB':jurisdiction)||jurisdiction==='GB-EAW'&&declared.some(value=>/europe|echr|council/i.test(value));
}
function resourceMatchesProceeding(resource:Resource,proceeding:Proceeding):boolean{
 const declared=resource.sourceAudit?.proceedings??[];
 return declared.includes('all')||(proceeding!=='unknown'&&proceeding!=='mixed'&&declared.includes(proceeding));
}
function factBasis(input:NewCaseInput):LegalBinding['factBasis']{
 // The intake contract has no verified file/page or judicial-finding metadata. Never manufacture either.
 const facts=input.intake?.facts.filter(f=>f.text.trim()).map(f=>f.text)??[];
 const texts=facts.length?facts:[input.intake?.narrative||input.background.description].filter(Boolean);
 return texts.map(text=>({text,origin:'user_statement' as const,fileName:null,page:null}));
}
function extraConditions(resource:Resource,input:NewCaseInput,locale:Locale):LegalBinding['conditions']{
 const domestic=resource.type==='domestic_law'||resource.type==='procedure_rule';
 const jurisdiction=legalJurisdiction(input);
 const jurisdictionChecks=resource.sourceAudit?.jurisdictionChecks?.filter(check=>check.jurisdiction===jurisdiction||jurisdiction==='GB-EAW'&&check.jurisdiction==='GB')??[];
 const conditions:LegalBinding['conditions']=jurisdictionChecks.map(check=>({label:check.topic==='participation'?pick(locale,'当前缔约状态（独立官方记录）','Current treaty participation (separate official record)'):pick(locale,'机制国家资格（不代表个案可受理）','Mechanism state eligibility (not individual admissibility)'),status:check.status,detail:check.detail}));
 if(domestic){
  conditions.push({label:pick(locale,'事件日期对应的法律版本','Law in force on the event date'),status:'unknown',detail:resource.sourceAudit?.eventVersionStatus??pick(locale,'尚未核对事件时间版本。','The event-time version has not been checked.')});
 }else if(resource.type==='treaty'||resource.type==='interpretation'){
  if(!jurisdictionChecks.some(check=>check.topic==='participation'))conditions.push({label:pick(locale,'当前缔约状态','Current treaty participation'),status:'unknown',detail:pick(locale,'本条来源记录没有独立的本国缔约核查。','This record has no separate participation check for this state.')});
  conditions.push({label:pick(locale,'事件时管辖、相关保留与国内援引','Event-time jurisdiction, relevant reservations and domestic effect'),status:'unknown',detail:pick(locale,'当前缔约情况与个案适用分别处理；仍须核对事件时管辖、相关保留/克减及国内援引方式。','Current participation is separate from case applicability; check event-time jurisdiction, relevant reservations/derogations and domestic effect.')});
 }
 if(resource.resourceId==='iccpr-article-9'||resource.resourceId==='kz-criminal-procedure-detention')conditions.push({label:pick(locale,'当前存在拘押','Current detention'),status:input.currentProblems.includes('detained')?'confirmed':'unknown',detail:input.currentProblems.includes('detained')?pick(locale,'用户报告正在被拘押；合法性和书面依据未经独立核实。','The user reports detention; lawfulness and the written basis are unverified.'):pick(locale,'尚无明确的当前拘押陈述，先确认是否已被剥夺自由。','Current detention is not established; first confirm whether liberty has been deprived.')});
 if(resource.resourceId==='ohchr-special-procedures')conditions.push({label:pick(locale,'本轮研究与披露边界','Research and disclosure boundaries for this review'),status:'confirmed',detail:input.publicity==='private'?pick(locale,'用户要求私下处理；此处只研究材料要求，不能对外递交或披露。','The user requires private handling. This reference is for researching material requirements only, not external submission or disclosure.'):pick(locale,'本模块仅进行内部研究；总体公开偏好不是针对收件者、材料和方式的具体外发同意。','This module conducts internal research only; a broad public preference is not specific consent for a recipient, material and channel.')});
 if(resource.resourceId==='tn-decree54-art24')conditions.push({label:pick(locale,'起诉是否援引第54号法令第24条','Whether Decree 54, Article 24 is actually charged'),status:'unknown',detail:pick(locale,'表达处罚主题不能证明具体罪名；需起诉书、传票及指控的原文。','An expression prosecution does not establish the charge; obtain the charge sheet, summons and alleged words.')});
 if(resource.resourceId==='ew-economic-crime-slapp')conditions.push({label:pick(locale,'经济犯罪相关法定范围与 SLAPP 要件','Economic-crime scope and statutory SLAPP conditions'),status:'unknown',detail:pick(locale,'公共采购报道或律师函本身不足以证明经济犯罪关联、行为目的及所有法定条件；不可扩大为全部诽谤案件保护。','Public-procurement reporting or a demand letter alone does not establish economic-crime relevance, purpose or every statutory condition; protection is not universal to defamation cases.')});
 for(const text of (resource.type==='treaty'||resource.type==='interpretation'?[]:resource.eligibility??[]))conditions.push({label:pick(locale,'条款条件：需逐项核实','Provision condition: verify separately'),status:'unknown',detail:text});
 return conditions;
}
/** Server-curated research references. No score is an applicability probability. */
export function buildLegalResearch(input:NewCaseInput,locale:Locale='zh'):LegalResearch{
 const jurisdiction=legalJurisdiction(input);const proceeding=legalProceeding(input);
 const scenario=scenarios.find(s=>s.jurisdiction===jurisdiction);
 if(!scenario||input.intake?.expression==='no'||(proceeding!=='unknown'&&proceeding!=='mixed'&&scenario.proceeding!==proceeding))return {coreQuestion:pick(locale,'先确认具体法域、程序和表达关联，再选择当地规则。','Confirm jurisdiction, procedure and expression nexus before selecting local rules.'),coverage:'gap',coverageNote:pick(locale,'本轮当地规则仅覆盖哈萨克斯坦刑事拘押、突尼斯表达追诉、英格兰和威尔士民事诽谤。没有将其他法域的规则套用到本案。','Local-rule coverage is limited to Kazakhstan criminal detention, Tunisia expression prosecutions and England and Wales civil defamation. Rules from another jurisdiction are not applied.'),bindings:[],gaps:[pick(locale,'需补充本案正确法域和程序的来源核查记录。','A source audit for this matter’s jurisdiction and procedure is required.')]};
 const requested:Array<[string,string,string]>=[...(internationalRefs[jurisdiction]??[])];
 if(jurisdiction==='KZ'||jurisdiction==='TN')requested.push(['ohchr-special-procedures','submission-criteria','special_procedures_submission'],['ohchr-special-procedures','consent-confidentiality','disclosure_consent']);
 for(const id of scenario.resourceIds){const resource=resources.find(r=>r.resourceId===id);for(const provision of resource?.sourceAudit?.provisions??[])if(provision.supports[0])requested.push([id,provision.provisionId,provision.supports[0]]);}
 const bindings:LegalBinding[]=[];const gaps=[...scenario.gaps];
 for(const [resourceId,provisionId,claimKey] of requested){
  const resource=resources.find(r=>r.resourceId===resourceId);const audit=resource?.sourceAudit;const provision=audit?.provisions.find(p=>p.provisionId===provisionId);
  if(!resource||!audit||!provision||!provision.supports.includes(claimKey)||!['full_text','partial_text'].includes(audit.readStatus)||!provision.quote.trim()||!provision.locator.trim()){
   gaps.push(pick(locale,`${resourceId} / ${provisionId} 未有可引用的正文核查记录，未据此作法律判断。`,`${resourceId} / ${provisionId} has no usable source-text audit; no legal conclusion relies on it.`));continue;
  }
  if(claimKey==='criminal_defence'&&proceeding!=='criminal'&&proceeding!=='unknown'&&proceeding!=='mixed')continue;
  if(!resourceMatchesJurisdiction(resource,jurisdiction)){gaps.push(pick(locale,`${resourceId} 的法域范围不匹配，未推荐。`,`${resourceId} does not match the jurisdiction and is not recommended.`));continue;}
  const procedureMatches=resourceMatchesProceeding(resource,proceeding);
  const procedureUnknown=proceeding==='unknown'||proceeding==='mixed';
  // Never turn criminal safeguards into a civil claim's procedural entitlement.
  if(!procedureMatches&&!procedureUnknown)continue;
  const conditions:LegalBinding['conditions']=[
   {label:pick(locale,'具体法域','Jurisdiction'),status:'confirmed',detail:pick(locale,`用户陈述法域：${jurisdiction}；仅确认研究范围。`,`User-stated jurisdiction: ${jurisdiction}; this confirms research scope only.`)},
   {label:pick(locale,'程序类型','Procedure'),status:procedureMatches?'confirmed':'unknown',detail:pick(locale,`当前记录：${proceeding}${!input.intake&&input.isExample?'（虚构示例的程序设定）':''}；来源范围：${audit.proceedings.join(' / ')}。`,`Recorded: ${proceeding}${!input.intake&&input.isExample?' (fictional scenario setup)':''}; source scope: ${audit.proceedings.join(' / ')}.`)},
   ...extraConditions(resource,input,locale)
  ];
  if(claimKey==='kz_detention_review')conditions.push({label:pick(locale,'第107条的审前调查阶段','Pretrial-investigation stage under Article 107'),status:input.stage==='trial'||input.stage==='appeal'||input.stage==='postjudgment'?'not_met':'unknown',detail:pick(locale,'候审的日常说法不能证明仍处于第107条所述审前调查程序；请律师核对决定机关及移送审判状态。','An ordinary description of awaiting trial does not establish the Article 107 pretrial-investigation stage; counsel should check the deciding authority and transfer-to-trial status.')});
  if(claimKey==='ew_slapp_procedural_route'){
   const account=[input.intake?.narrative??'',input.background.description].join('\n');
   const noClaim=/(?:尚未|还未|未)(?:收到)?法院(?:文件|文书)|\bno court (?:papers|documents)\b/i.test(account);
   conditions.push({label:pick(locale,'已核实存在可申请删除的法院诉状','A verified court pleading available for a strike-out review'),status:noClaim?'not_met':'unknown',detail:noClaim?pick(locale,'用户明确表示尚未收到法院文件，尚不具备针对具体诉状作程序准备的材料；这不证明对方尚未立案。先核对是否已起诉和送达，当前不推进删除诉状步骤。','The user reports no court papers, so the material needed to review a specific pleading is not available. This does not prove that no claim was issued. Check issue and service before advancing a strike-out step.'):pick(locale,'先核对是否已经起诉及送达；律师函本身不是诉状。','First establish whether a claim was issued and served; a demand letter is not a pleading.')});
  }
  const domestic=resource.type==='domestic_law'||resource.type==='procedure_rule';
  const nextChecks=[...resource.unknowns??[],...resource.requiredMaterials];
  if(!input.keyDates.some(d=>/^\d{4}-\d{2}-\d{2}$/.test(d.date)))nextChecks.unshift(pick(locale,'取得事件、送达、拘押或首次程序行动的准确日期；不得以演示中的“未来两周”计算法定期限。','Obtain exact event, service, detention or first procedural-action dates; do not calculate a legal deadline from a demo’s “within two weeks”.'));
  bindings.push({bindingId:`legal-${jurisdiction.toLowerCase()}-${resourceId}-${provisionId}`,issue:scenario.coreQuestion,claim:provision.explanation,claimKey,resourceId,provisionId,factBasis:factBasis(input),relevance:pick(locale,`本案所述${proceeding==='civil'?'民事表达争议':input.currentProblems.includes('detained')?'表达相关追诉与拘押':'表达相关追诉'}使“${provision.locator}”值得研究。该联系由策展规则提出；具体构成要件、文件和版本仍须核对。`,`The reported ${proceeding==='civil'?'civil expression dispute':input.currentProblems.includes('detained')?'expression prosecution and detention':'expression prosecution'} makes ${provision.locator} a research reference. This relationship is rule-curated; elements, documents and versions still need checking.`),conditions,nextChecks:[...new Set(nextChecks)],applicability:conditions.some(c=>c.status==='not_met')?'excluded':domestic?'conditional':'research_reference',factsAsOf:pick(locale,`本次用户陈述；独立事实截至日期未确认`, 'Current user account; independent factual cut-off not confirmed'),lawAsOf:`${audit.checkedAt} · ${audit.currentVersionStatus}`,relationOrigin:'curated_rule'});
 }
 const hasLocal=bindings.some(b=>scenario.resourceIds.includes(b.resourceId));
 return {coreQuestion:scenario.coreQuestion,coverage:hasLocal?(gaps.length||bindings.some(b=>b.conditions.some(c=>c.status==='unknown'))?'partial':scenario.coverage):'gap',coverageNote:scenario.coverageNote,bindings,gaps:[...new Set(gaps),...(hasLocal?[]:[pick(locale,'核心当地规则当前无法提供可靠正文引用；不输出依赖其适用的确定结论。','The core local rule has no reliable text citation; no definitive conclusion relies on its applicability.')])]};
}

/** Exact binding + exact supported sentence, independently checked against current audited metadata. */
export function validateLegalCitations(output:ModelAnalysisOutput,input:NewCaseInput,research:LegalResearch):string[]{
 const errors:string[]=[];const jurisdiction=legalJurisdiction(input);const proceeding=legalProceeding(input);
 for(const action of output.actionOptions){
  const text=[action.reason,...action.prerequisites,...action.uncertainties].join('\n');
  const allowedClaims:string[]=[];
  for(const citation of action.legalCitations??[]){
   const prefix=`${action.actionId}: legal citation ${citation.bindingId}`;
   const binding=research.bindings.find(b=>b.bindingId===citation.bindingId);
   if(!binding||binding.resourceId!==citation.resourceId||binding.provisionId!==citation.provisionId||binding.claimKey!==citation.claimKey){errors.push(`${prefix} does not match a supplied binding.`);continue;}
   const resource=resources.find(r=>r.resourceId===citation.resourceId);const audit=resource?.sourceAudit;const provision=audit?.provisions.find(p=>p.provisionId===citation.provisionId);
   if(!resource||!audit||!['full_text','partial_text'].includes(audit.readStatus)||!provision?.supports.includes(citation.claimKey)||!provision.quote.trim()||!provision.locator.trim()){errors.push(`${prefix} has no supporting audited provision.`);continue;}
   allowedClaims.push(binding.claim);
   if(binding.claim!==provision.explanation||!text.includes(binding.claim))errors.push(`${prefix} does not support an exact curated claim sentence in this action.`);
   if(!resourceMatchesJurisdiction(resource,jurisdiction))errors.push(`${prefix} has a jurisdiction mismatch.`);
   if((citation.claimKey==='criminal_defence'&&proceeding!=='criminal'&&proceeding!=='unknown'&&proceeding!=='mixed')||(!resourceMatchesProceeding(resource,proceeding)&&proceeding!=='unknown'&&proceeding!=='mixed'))errors.push(`${prefix} has a procedure mismatch.`);
   if(binding.applicability==='excluded'||binding.conditions.some(c=>c.status==='not_met'))errors.push(`${prefix} is excluded by an unmet condition.`);
  }
  // Bounded negative check: reject newly asserted numbered provisions or definite violations
  // outside the exact sourced sentences. This is not a natural-language entailment proof.
  let remainder=[action.title,action.reason,...action.prerequisites,...action.steps,...action.materials,...action.followUp,...action.differences,...action.uncertainties].join('\n');
  for(const claim of allowedClaims)remainder=remainder.split(claim).join('');
  if(/第\s*[0-9一二三四五六七八九十百千]+(?:[（(][0-9一二三四五六七八九十]+[）)])?\s*[条條款]|\b(?:article|section|rule)\s+\d+(?:[.(]\d+)?/i.test(remainder))errors.push(`${action.actionId}: a new numbered legal proposition has no exact supported citation.`);
  if(/(?:本案|本次拘押|该拘押|该起诉|该限制)(?:当然|显然|明确|已|已经|必然|确定|属于|构成|是|已构成){0,3}(?:违法|非法|违宪|违反)|\b(?:this|the current)\s+(?:detention|prosecution|restriction|case)\s+(?:is|clearly is|definitely is)\s+(?:unlawful|illegal|unconstitutional)\b/i.test(remainder))errors.push(`${action.actionId}: an unsourced definitive legal conclusion is not accepted.`);
 }
 return errors;
}

/** Attach only issue-specific legal references; general chronology preparation receives no law citation. */
export function attachRuleLegalCitations<T extends ModelAnalysisOutput>(output:T,research:LegalResearch):T{
 const copy=structuredClone(output);
 for(const action of copy.actionOptions){
  const keys=action.actionId==='primary-release'||action.actionId==='primary-conditions'?['kz_detention_order_copy','kz_detention_review','detention_review']:
   action.actionId==='primary-drop_charges'?['tn_expression_guarantee','expression_restriction_test']:
   action.actionId==='primary-lawyer'?['ew_serious_harm','civil_fair_hearing','criminal_defence']:
   action.actionId==='external-advocacy'?['special_procedures_submission','disclosure_consent']:[];
  const selected=keys.map(key=>research.bindings.find(binding=>binding.claimKey===key&&binding.applicability!=='excluded'&&!binding.conditions.some(c=>c.status==='not_met'))).filter((binding):binding is LegalBinding=>!!binding).slice(0,2);
  if(!selected.length)continue;
  action.legalCitations=selected.map(({bindingId,claimKey,resourceId,provisionId})=>({bindingId,claimKey,resourceId,provisionId}));
  action.prerequisites=[...action.prerequisites,...selected.map(binding=>binding.claim)].slice(0,8);
  action.resourceIds=[...new Set([...action.resourceIds,...selected.map(binding=>binding.resourceId)])];
 }
 return copy;
}
