import type {CaseRecord,ModelAnalysisOutput,NewCaseInput} from './contracts';
import type {CaseFollowup,LegalResearch,NextStep} from './legal-contracts';
import {cases,evidence} from './corpus';
import {recognizedJurisdiction} from './jurisdiction';
import {legalProceeding} from './legal-research';
import {hasDisclosureNotes} from './intake/analysis';

type Locale='zh'|'en';
const t=(locale:Locale,zh:string,en:string)=>locale==='en'?en:zh;
const shared=(left:string[],right:string[])=>left.some(id=>right.includes(id));
const sameCountry=(input:NewCaseInput,record:CaseRecord)=>{
 const country=recognizedJurisdiction([input.country]).countryCode;
 return !!country&&recognizedJurisdiction([record.country]).countryCode===country;
};
const causalLimit=(locale:Locale)=>t(locale,'行动与结果只保留时间关系；不能推断该行动导致结果。','Action and outcome are preserved as a sequence, not proof of causation.');
function matchesPurpose(action:ModelAnalysisOutput['actionOptions'][number],description:string):boolean{
 if(action.requiresPublicity)return /倡议|声明|监测|观察|联合|普遍定期审议|UPR|statement|advocacy|monitoring|observe/i.test(description);
 if(action.goal==='release')return /释放|保释|拘押|拘留|release|bail|detention/i.test(description);
 if(action.goal==='conditions')return /散步|健康|医疗|条件|health|walk|medical|condition/i.test(description);
 if(action.goal==='change_judgment')return /上诉|抗诉|appeal|review/i.test(description);
 if(action.goal==='drop_charges'||action.goal==='lawyer')return /辩护|律师|准备|延期|无罪|法律|defen[cs]e|lawyer|counsel|prepar|adjourn|legal/i.test(description);
 return false;
}
const followupPurposes:Record<string,Array<NewCaseInput['primaryGoal']|'external'>>={
 'aigul-followup-2022-04-27-hrc-filing-confirmed':['release','change_judgment','external'],
 'alnur-followup-2022-09-13-joint-letter':['release','change_judgment','external'],
 'myriam-followup-report-used-appeal':['drop_charges','lawyer','change_judgment'],
 'myriam-followup-defence-appeal':['change_judgment'],
 'myriam-followup-amnesty-advocacy':['external'],
 'emna-followup-hrw-upr':['external'],
 'emna-followup-hrw-achpr-publication':['external'],
 'hajar-followup-2022-07-28-hrw-report':['external'],
 'omar-ii-followup-2024-10-21-cpj-risk-check':['external']
};
function selectedFollowupAction(action:ModelAnalysisOutput['actionOptions'][number],eventId:string):boolean{
 const purposes=followupPurposes[eventId]??[];
 return purposes.includes(action.requiresPublicity?'external':action.goal);
}
function historyFor(action:ModelAnalysisOutput['actionOptions'][number],input:NewCaseInput,output:ModelAnalysisOutput,followups:CaseFollowup[],locale:Locale):NextStep['history']{
 if(action.actionId==='prepare-case-file'||action.actionId==='clarify-goal'||input.primaryGoal==='unknown'||input.primaryGoal==='other')return [];
 // The existing selected history is criminal. A civil example cannot inherit those procedural actions.
 if(legalProceeding(input)!=='criminal')return [];
 const selected=new Set([...output.comparableCases.map(c=>c.caseId),...followups.map(f=>f.caseId)]);
 const candidates=cases.filter(c=>selected.has(c.caseId)&&sameCountry(input,c));
 const direct=candidates.flatMap(record=>record.interventions.filter(intervention=>intervention.executionStatus==='implemented'&&shared(intervention.evidenceIds,action.supportingEvidenceIds)).map(intervention=>({record,intervention,direct:true})));
 const thematic=candidates.flatMap(record=>record.interventions.filter(intervention=>intervention.executionStatus==='implemented'&&matchesPurpose(action,`${intervention.action} ${intervention.actor}`)).map(intervention=>({record,intervention,direct:false})));
 const chosen:Array<(typeof direct)[number]>=[];
 // Prefer two different cases where available, including unsuccessful or unresolved requests.
 for(const candidate of [...direct,...thematic]){
  if(chosen.some(item=>item.record.caseId===candidate.record.caseId))continue;
  chosen.push(candidate);if(chosen.length===2)break;
 }
 const history:NextStep['history']=chosen.map(({record,intervention,direct})=>({
  caseId:record.caseId,interventionId:intervention.interventionId,followupEventId:null,actor:intervention.actor,action:intervention.action,executionStatus:intervention.executionStatus,date:intervention.date.value??intervention.date.originalText??t(locale,'日期未记载','Date not recorded'),
  outcome:intervention.observedOutcomeIds.map(id=>record.outcomes.find(outcome=>outcome.outcomeId===id)?.description).filter(Boolean).join('；')||t(locale,'原报告没有将具体结果对应到这项行动。','The original report does not link a specific outcome to this action.'),
  differences:[direct?t(locale,'直接对应本行动所列历史引文；可参考材料准备方式，不能移植个案结果。','Directly linked to this action’s historical excerpts; preparation may inform discussion, but outcomes cannot be transferred.'):t(locale,'这是同国刑事程序中的实际行动比较，不证明与新案罪名、阶段、证据或目标相同。','This is an actual action in a same-country criminal proceeding; charges, stage, evidence and goals may differ.'),t(locale,`原报告事实截至 ${record.lastKnownStatusAsOf}；新案仍以用户陈述为依据。`,`Original report facts as of ${record.lastKnownStatusAsOf}; the new matter remains user-reported.`),causalLimit(locale),t(locale,'历史参与者仅标为曾参与该案，不表示现在接案或与我们合作。','Historical actors participated in that case; current availability or a relationship with us is not established.')],
  evidenceIds:[...new Set([...intervention.evidenceIds,...intervention.observedOutcomeIds.flatMap(id=>record.outcomes.find(outcome=>outcome.outcomeId===id)?.evidenceIds??[])])],sourceIds:[]
 }));
 const ownedCases=new Set(chosen.map(item=>item.record.caseId));
 // New, sourced participation is shown as its own event, never silently merged into the old outcome.
 for(const record of followups.filter(f=>ownedCases.has(f.caseId))){
  const relevant=record.events.filter(event=>event.executionStatus==='implemented'&&selectedFollowupAction(action,event.eventId)&&event.sourceIds.length&&event.sourceIds.every(id=>record.sources.some(source=>source.sourceId===id&&['full_text','partial_text'].includes(source.readStatus)&&source.quote.trim()))).sort((a,b)=>Number(/使用.*报告|report.*use/i.test(b.action))-Number(/使用.*报告|report.*use/i.test(a.action))).slice(0,1);
  for(const event of relevant)history.push({caseId:record.caseId,interventionId:null,followupEventId:event.eventId,actor:event.actors.join('；'),action:event.action,executionStatus:event.executionStatus,date:event.eventDate??t(locale,'来源未明确事件日期','The source does not specify an event date'),outcome:event.outcome,differences:[t(locale,'该历史参与只证明资料中记载的工作曾发生；当前案件的机制资格、程序时点、披露授权与可能结果均须另行核对。','This historical participation establishes only the recorded work; the current matter’s mechanism eligibility, timing, disclosure permission and possible outcomes require separate review.'),t(locale,`新增后续记录的程序：${event.proceeding}；不能与同人其他案件合并。`,`Proceeding of this follow-up: ${event.proceeding}; do not merge another case involving the same person.`),causalLimit(locale),...(event.causalAttribution?[t(locale,`来源归属声明（未独立验证因果）：${event.causalAttribution}`,`Attributed source claim (causality not independently verified): ${event.causalAttribution}`)]:[]),...event.unknowns],evidenceIds:[],sourceIds:[...event.sourceIds]});
 }
 return history;
}
/** Server-owned work products. Nothing is sent, filed, contacted or automatically persisted. */
export function buildNextSteps(input:NewCaseInput,output:ModelAnalysisOutput,research:LegalResearch,followups:CaseFollowup[],locale:Locale='zh'):NextStep[]{
 const restricted=input.publicity!=='public'||hasDisclosureNotes(input);
 return output.actionOptions.map(action=>{
  const timeline=action.actionId==='prepare-case-file';const clarify=action.actionId==='clarify-goal';const civil=legalProceeding(input)==='civil';
  const history=historyFor(action,input,output,followups,locale);
  const legalBindingIds=(action.legalCitations??[]).map(citation=>research.bindings.find(binding=>binding.bindingId===citation.bindingId&&binding.resourceId===citation.resourceId&&binding.provisionId===citation.provisionId&&binding.claimKey===citation.claimKey&&binding.applicability!=='excluded'&&!binding.conditions.some(condition=>condition.status==='not_met'))?.bindingId).filter((id):id is string=>!!id);
  let materials:string[],deliverables:string[];
  if(timeline){materials=[t(locale,'原始叙述、已取得文件、已发出请求与实际回应；分别标明日期精度及来源位置。','Original account, available documents, requests already made and actual responses, with date precision and source locations.')];deliverables=[t(locale,'一份分列“用户陈述／对方指控／法院认定／待核事实”的案件时间线。','A case timeline separating user statements, opposing allegations, court findings and unverified facts.'),t(locale,'一份材料与来源索引：文件名、真实页码或网页定位、保管者、缺失项；未见原件不填页码。','A materials/source index with file names, actual pages or web locations, custodian and missing items; no invented page numbers.')];}
  else if(clarify){materials=[t(locale,'用户已经确认的目标与逐项披露限制；只补未回答的优先顺序。','The user’s confirmed goals and disclosure boundaries; ask only about priorities still unanswered.')];deliverables=[t(locale,'一页内部案件简报，列已知事实、用户目标、披露边界和仍需决策的问题。','A one-page internal brief recording known facts, user goals, disclosure boundaries and remaining decisions.')];}
  else if(action.requiresPublicity){materials=[t(locale,'按具体收件者、材料、方式划分的披露同意记录；脱敏副本与风险说明。','Consent recorded by recipient, material and channel; redacted copies and a risk note.'),t(locale,'候选机构或机制的现行资格、保密规则与送件要求；历史参与不代表当前接案。','Current eligibility, confidentiality and submission requirements of a candidate body; historical participation does not establish current availability.')];deliverables=[t(locale,'内部候选行动路径对照表：公开倡议／机制材料准备／继续内部处理，各自条件、差异与停止点。','An internal comparison of public advocacy, mechanism-material preparation and continued internal handling, with conditions, differences and stop points.'),t(locale,'一份待批准的脱敏摘要及同意范围表；保留为草稿。','A redacted draft summary and a consent-scope register awaiting approval.')];}
  else if(civil){materials=[t(locale,'已有律师函与收件记录、涉诉具体表述、对方损害主张及诉状是否已取得的记录。','The demand letter and receipt record, disputed words, alleged harm and the record of whether court pleadings are available.'),t(locale,'发表时的核验材料、编辑判断与公共利益理由；经济犯罪关联另列为待证事项。','Publication-time verification material, editorial reasoning and public-interest basis; keep economic-crime relevance as a separate unproven issue.')];deliverables=[t(locale,'给当地律师的事实与条件表：严重损害、公共利益抗辩、诉前回应和有限反SLAPP条件分别列证据与缺口。','A fact/condition matrix for local counsel separating serious harm, public-interest defence, pre-action response and limited anti-SLAPP conditions.'),t(locale,'内部函件回应问题清单与拟稿范围；由当地律师判断时限和是否对外回应。','An internal response-question list and drafting scope; local counsel determines timing and whether to respond externally.')];}
  else if(action.goal==='release'||action.goal==='conditions'){materials=[t(locale,'拘押或限制决定及宣告／送达记录；已有索取请求未获回应的，保留请求与实际回应记录。','Detention/restriction decisions and pronouncement/service records; where an existing document request is unanswered, preserve that request and any actual response.'),t(locale,'各项限制、替代安排和必要健康资料分项整理，由现有律师核实其程序用途。','A separated record of restrictions, alternatives and necessary health information for counsel to assess procedural use.')];deliverables=[t(locale,'当地律师问题单：决定依据、当前程序阶段、可用审查机关、文书与日期缺口及替代措施。','Questions for local counsel on the decision basis, current procedural stage, review authority, missing documents/dates and alternatives.'),t(locale,'一份内部候选路径与条件表，明确哪些仅可准备、哪些待律师确认；不推算新案期限。','An internal route/condition matrix distinguishing preparation from steps awaiting counsel; no new-case deadline calculation.')];}
  else{materials=[t(locale,'起诉／传唤或裁判文书、争议表达及上下文、收到的具体威胁与已有辩护准备。','Charge/summons or judgment documents, disputed expression in context, specific threats and defence preparation already undertaken.')];deliverables=[t(locale,'表达限制与指控要件问题表：每项区分已知事实、法律来源、尚未知的适用条件。','An expression-restriction and charge-elements question matrix separating known facts, legal sources and unknown conditions.'),t(locale,'内部法律研究简报与当地律师问题单；列清历史行动的关键差异及未解决结果。','An internal legal-research brief and counsel question list identifying differences from historical actions and unresolved outcomes.')];}
  const basisGaps:string[]=[];
  if(!history.length)basisGaps.push(t(locale,'未找到与本项准备直接对应且程序可比较的已实施历史行动；此项仍是一般工作准备，不冒充历史成功路径。','No directly corresponding, procedurally comparable implemented historical action was identified; this remains general preparation, not a historical success route.'));
  if(!legalBindingIds.length)basisGaps.push(t(locale,timeline||clarify?'一般时间线、来源整理或需求澄清无需硬配法条。':'本项没有直接支持的逐条法律／机制引用；在补齐前仅做材料准备。',timeline||clarify?'General chronology, indexing or goal clarification does not require a forced legal citation.':'This action has no directly supporting provision/mechanism citation; prepare materials only until that gap is resolved.'));
  if(action.basisType==='report_recommendation')basisGaps.push(t(locale,'原行动依据包含报告作者建议；建议数量不等于实际实施或成功数量。','The original action basis includes a report author’s recommendation; recommendations are not implemented actions or successes.'));
  for(const followup of followups.filter(item=>history.some(record=>record.caseId===item.caseId)&&item.searchStatus!=='updates_found'))basisGaps.push(t(locale,`${followup.caseId}：本轮未确认完整后续；“未找到”不等于没有变化。`,`${followup.caseId}: complete follow-up is not established; “not found” does not mean nothing changed.`));
  return {actionId:action.actionId,purpose:t(locale,`将“${action.title}”推进到可供内部讨论的材料；是否采用程序或对外路径仍由指定人员决定。`,`Prepare reviewable internal material for “${action.title}”; designated people still decide whether to use a procedure or external route.`),owner:timeline||clarify?t(locale,'TrialWatch 案件协调人与研究员准备；当事人确认目标、事实归属与披露边界。','TrialWatch coordinator/researcher prepares; the person confirms goals, factual attribution and disclosure boundaries.'):t(locale,`${action.leadRole}；TrialWatch 研究员整理材料，当地律师判断法律适用与程序，当事人决定披露。`,`${action.leadRole}; a TrialWatch researcher prepares materials, local counsel assesses law/procedure, and the person controls disclosure.`),materials,deliverables,stopConditions:[t(locale,'未经针对具体材料、接收者及方式的明确同意，不发送、联系、公开或递交；本模块只准备内部材料。','Without explicit consent for the material, recipient and channel, do not send, contact, publish or file; this module prepares internal material only.'),...(restricted?[t(locale,'现有私下／具体披露限制继续有效；公开倡议暂不推进，不把私下渠道当作绕过限制的许可。','Existing private/specific disclosure boundaries remain in force; pause public advocacy and do not treat a private channel as permission to bypass them.')]:[]),...(!timeline&&!clarify?[t(locale,'法律版本、资格、程序阶段或必要文书未核实时，暂不实施相关法律步骤；内部索引和问题准备可继续。','Do not take the related legal step until law versions, eligibility, procedural stage and necessary documents are checked; internal indexing and question preparation may continue.')]:[])],legalBindingIds:[...new Set(legalBindingIds)],history,basisGaps};
 });
}
/** Referential integrity and status checks; it does not infer causal effect. */
export function validateNextStepLinks(nextSteps:NextStep[],output:ModelAnalysisOutput,research:LegalResearch,followups:CaseFollowup[]):string[]{
 const errors:string[]=[];
 for(const step of nextSteps){
  if(!output.actionOptions.some(action=>action.actionId===step.actionId))errors.push(`${step.actionId}: action is not present.`);
  for(const id of step.legalBindingIds)if(!(output.actionOptions.find(action=>action.actionId===step.actionId)?.legalCitations??[]).some(citation=>citation.bindingId===id)||!research.bindings.some(binding=>binding.bindingId===id&&binding.applicability!=='excluded'&&!binding.conditions.some(condition=>condition.status==='not_met')))errors.push(`${step.actionId}: legal binding is absent or excluded.`);
  for(const history of step.history){
   const record=cases.find(item=>item.caseId===history.caseId);
   if(history.interventionId){
    const intervention=record?.interventions.find(item=>item.interventionId===history.interventionId);
    if(!intervention||intervention.executionStatus!==history.executionStatus||intervention.actor!==history.actor||intervention.action!==history.action)errors.push(`${step.actionId}: historical intervention owner, text or status mismatch.`);
    const outcomes=intervention?.observedOutcomeIds.map(id=>record?.outcomes.find(outcome=>outcome.outcomeId===id)).filter(item=>!!item)??[];
    const expectedOutcome=outcomes.map(outcome=>outcome.description).join('；');
    if(expectedOutcome&&history.outcome!==expectedOutcome)errors.push(`${step.actionId}: historical outcome was altered beyond its owned source.`);
    const allowedEvidence=new Set([...(intervention?.evidenceIds??[]),...outcomes.flatMap(outcome=>outcome.evidenceIds)]);
    if(!history.evidenceIds.length||history.evidenceIds.some(id=>evidence.find(item=>item.evidenceId===id)?.caseId!==history.caseId||!allowedEvidence.has(id)))errors.push(`${step.actionId}: historical evidence belongs to another case or action.`);
   }else if(history.followupEventId){
    const followup=followups.find(item=>item.caseId===history.caseId);const event=followup?.events.find(item=>item.eventId===history.followupEventId);
    if(!event||event.executionStatus!==history.executionStatus||event.action!==history.action||event.actors.join('；')!==history.actor||event.outcome!==history.outcome)errors.push(`${step.actionId}: follow-up owner, text, outcome or status mismatch.`);
    if(!history.sourceIds.length||history.sourceIds.some(id=>!event?.sourceIds.includes(id)||!followup?.sources.some(source=>source.sourceId===id&&['full_text','partial_text'].includes(source.readStatus))))errors.push(`${step.actionId}: follow-up source is missing, unread or belongs to another case.`);
   }else errors.push(`${step.actionId}: historical record has no owned intervention or follow-up event.`);
  }
 }
 return errors;
}
