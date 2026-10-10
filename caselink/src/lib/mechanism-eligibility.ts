import type {NewCaseInput} from './contracts';
import type {MechanismAssessment} from './legal-contracts';
import conditionsJson from '../../data/resources/whats-next-conditions.json';
import {issueSignals} from './issue-legal-selection';

type Locale='zh'|'en';
type Condition=MechanismAssessment['conditions'][number];
const pick=(locale:Locale,zh:string,en:string)=>locale==='en'?en:zh;
const condition=(label:string,status:Condition['status'],detail:string):Condition=>({label,status,detail});
const state=(conditions:Condition[]):MechanismAssessment['state']=>conditions.some(c=>c.status==='not_met')?'not_met':conditions.some(c=>c.status==='unknown')?'unknown':'preliminary';

/** Curated state participation is never a finding of admissibility or domestic direct effect. */
export function treatyConditions(input:NewCaseInput,locale:Locale='zh'):Condition[]{
 const country=issueSignals(input).jurisdiction.countryCode;
 const record=conditionsJson.countries.find(row=>row.countryCode===country);
 return [
  condition(pick(locale,'ICCPR国家／领土适用','ICCPR State / territorial application'),(record?.participation??'unknown') as Condition['status'],record?pick(locale,record.detailZh,record.detailEn):pick(locale,'本轮未核查该法域的缔约及领土安排；未知不能作成立。','Participation and territorial arrangements for this jurisdiction have not been checked; unknown is not satisfied.')),
  condition(pick(locale,'事件时适用、保留及克减','Event-time application, reservations and derogations'),'unknown',pick(locale,'当前国家参与状态不确认具体事件时间、管辖、相关保留或克减；核对各受影响事实发生日期及原文。','Current participation does not establish event-time jurisdiction, relevant reservations or derogations. Verify each relevant event and the source text.')),
  condition(pick(locale,'当地直接援引及法律效果','Domestic direct invocation and legal effect'),'unknown',pick(locale,'国内宪法、实施法、法院权限及适用方式由当地律师核对；ICCPR及委员会解释不直接提供当地程序或期限。','Local counsel must check constitutional and implementing law, court competence and manner of invocation. The Covenant and General Comments do not supply local procedures or deadlines.'))
 ];
}

function disclosureConditions(input:NewCaseInput,locale:Locale):Condition[]{
 const details=input.intake?.disclosureDetails??'';
 // Broad privacy/publicity preferences are not recipient-specific authorization. Preserve the
 // user's actual words and do not treat counsel-only sharing as submission consent.
 const restricted=/(?:仅|只)(?:限)?(?:内部|与.*律师|向.*律师)|(?:不同意|禁止|不要|不得).{0,12}(?:外传|传送|提交|其他组织|机构)|internal only|only.{0,20}(?:lawyer|counsel)|no external|do not (?:send|submit|share)/i.test(details);
 const status:Condition['status']=restricted?'not_met':'unknown';
 return [
  condition(pick(locale,'指定机制、材料与用途的提交授权','Authorization for the selected mechanism, material and purpose'),status,restricted?pick(locale,`现有披露范围限制外发：${details}。内部资格研究和三份内部草稿仍可继续。`,`Current disclosure limits external transmission: ${details}. Internal eligibility research and all three internal drafts can continue.`):pick(locale,`尚未记录对本机制及具体材料的明确提交授权；总体偏好为${input.publicity}。${details}`,`Specific submission authorization is not recorded; broad preference is ${input.publicity}. ${details}`)),
  condition(pick(locale,'向政府等接收方披露姓名','Name disclosure to governments or other recipients'),'unknown',pick(locale,'须单独记录同意或不同意及风险；允许向律师分享不包含政府或机构。','Record a separate consent/refusal and risk assessment; permission to share with counsel does not include governments or mechanisms.')),
  condition(pick(locale,'公开报告披露姓名','Name disclosure in public reports'),'unknown',input.publicity==='private'?pick(locale,'当前不公开；不能据此自动排除内部研究或所有机制。须与机制实际公开及安全例外安排核对，不能承诺全程保密。','Current preference is non-public; this does not rule out internal research or every mechanism. Check actual publication and safety exceptions; complete confidentiality cannot be promised.'):pick(locale,'一般公开偏好不等于此程序公开姓名同意，需按用途单独核对。','A general publicity preference is not consent to publication of names in this procedure.'))
 ];
}

/** These are independent internal eligibility checklists, never a submission or acceptance. */
export function buildMechanismAssessments(input:NewCaseInput,locale:Locale='zh'):MechanismAssessment[]{
 const s=issueSignals(input);const record=conditionsJson.countries.find(row=>row.countryCode===s.jurisdiction.countryCode);
 // The decision-maker and any government instruction are not yet established for a
 // platform intake. Notifications, rules and appeals can be organized without treating
 // the private notice as a State act or offering an ungrounded international route.
 if(s.proceeding==='platform')return [];
 const disclosure=disclosureConditions(input,locale);
 const result:MechanismAssessment[]=[];
 const opStatus=(record?.optionalProtocol??'unknown') as Condition['status'];
 const op:Condition[]=[
  condition(pick(locale,'第一任择议定书的国家／领土资格','OP1 State / territorial competence'),opStatus,record?pick(locale,record.detailZh,record.detailEn):pick(locale,'本轮无可靠OP1参与核查，不默认受理国资格成立。','No verified OP1 participation check is available; competence is not assumed.')),
  condition(pick(locale,'本人／代理资格及权利范围','Victim / representative standing and rights scope'),'unknown',pick(locale,'确认受国家管辖的受害人、代理授权及具体ICCPR权利；不能用历史案件当本案证明。','Confirm the victim under State jurisdiction, representative authority and specific Covenant rights; historical cases are not proof of this matter.')),
  condition(pick(locale,'国内救济及可主张例外','Domestic remedies and potentially applicable exceptions'),'unknown',pick(locale,'列出每项已使用和未使用救济、决定及日期，再核对不可获得、无效或不合理拖延等可主张例外。','List used and unused remedies, decisions and dates; assess any claimed unavailability, ineffectiveness or unreasonable delay.')),
  condition(pick(locale,'其他国际程序、保留和事件时间','Other international procedures, reservations and event dates'),'unknown',pick(locale,`核对是否正在其他国际调查／解决程序审查、国家保留和事件时间。${record?.opEffectiveFrom?`OP生效起点：${record.opEffectiveFrom}。`:''}${record?.opWithdrawal?`退出生效：${record.opWithdrawal}；不能据事件早于退出就断言今天仍可新递交，旧提交另核。`:''}`,`Check parallel international examination, reservations and event timing.${record?.opEffectiveFrom?` OP effective from ${record.opEffectiveFrom}.`:''}${record?.opWithdrawal?` Denunciation effective ${record.opWithdrawal}; an earlier event does not by itself permit a new submission today. Prior submissions require separate review.`:''}`)),
  ...disclosure
 ];
 // Intake dates include many kinds of events. Without a designated violation date, even
 // an apparently post-entry date cannot establish temporal competence.
 result.push({mechanismId:'hrc-individual-communications',title:pick(locale,'联合国人权事务委员会：个人来文资格研究','UN Human Rights Committee: individual-communication eligibility'),state:state(op),conditions:op,resourceIds:['hrc-individual-communications'],disclosure:[pick(locale,'这是人权事务委员会（条约机构），不是人权理事会；不得把内部材料标为已递交。','This is the Human Rights Committee treaty body, not the Human Rights Council. Internal drafts are not submissions.')],nextChecks:[pick(locale,'取得国内决定、救济时序、代理授权、其他国际程序记录及可主张例外的依据。','Obtain domestic decisions, remedy chronology, representative authority, other international-procedure records and evidence for any claimed exception.')]});

 const sp:Condition[]=[
  condition(pick(locale,'条约缔约和用尽国内救济','Treaty participation and exhaustion of domestic remedies'),'confirmed',pick(locale,'一般特别程序来函不以两者为共同前提；此项只说明门槛不存在，不表示个案获接纳。','Neither is a common prerequisite for ordinary Special Procedures communications. This confirms absence of that gate, not acceptance of the case.')),
  condition(pick(locale,'具体任务范围与可信详细事实','Specific mandate and credible, detailed facts'),'unknown',pick(locale,'按具体事实核对表达自由或人权维护者等任务范围，材料不能只依赖媒体报道；专家自行决定是否行动。','Check the mandate, such as freedom of expression or human rights defenders, against detailed facts. Material cannot rely exclusively on media; experts decide whether to act.')),
  ...disclosure
 ];
 result.push({mechanismId:'ohchr-special-procedures',title:pick(locale,'特别程序：任务与披露条件研究','Special Procedures: mandate and disclosure research'),state:state(sp),conditions:sp,resourceIds:['ohchr-special-procedures'],disclosure:[pick(locale,'政府等接收方通常收到姓名；公开报告姓名是另一项选择。安全例外需明确提出并核对；回执不是已行动。','Names normally reach government or other recipients; publication is a separate choice. Raise and verify safety exceptions; acknowledgement is not action.')],nextChecks:[pick(locale,'确认具体任务、希望机制提出的请求、可靠佐证及两项姓名披露选择。','Confirm the mandate, requested intervention, reliable supporting material and both name-disclosure choices.')]});

 const wg:Condition[]=[
  condition(pick(locale,'剥夺自由事实','Deprivation of liberty'),s.detentionExplicit?'confirmed':!s.libertyConcern&&input.currentProblems.includes('none')?'not_met':'unknown',s.detentionExplicit?pick(locale,'用户明确报告当前拘押，尚未独立核实，也未认定任意。','The user explicitly reports current detention; it is unverified and not a finding of arbitrariness.'):s.libertyConcern?pick(locale,'叙述或材料存在被带走／人身自由线索；当前是否仍受限制、时间地点和正式决定未知，只准备核对材料。','The account or materials raise a liberty concern; continuing custody, dates, location and formal decisions remain unknown. Prepare verification material only.'):pick(locale,'尚无本案当前剥夺自由的充分记录；历史拘押、已获释或一般民事压力不能证明目前被拘押。','No sufficient record of current deprivation of liberty; past detention, reported release or ordinary civil pressure does not establish current detention.')),
  condition(pick(locale,'普通程序材料及任意性研究','Regular procedure material and arbitrariness analysis'),'unknown',pick(locale,'按A/HRC/36/38第8–12段整理拘押时间地点、机关、理由、法律、国内与其他国际步骤、结果及最新情况。','Use A/HRC/36/38 paragraphs 8–12 to collect dates, location, authorities, reasons, law, domestic and international steps, outcomes and updates.')),
  condition(pick(locale,'独立工作方法与紧急行动','Separate methods and urgent action'),'unknown',pick(locale,'第22–23段要求具体紧急情形；紧急呼吁不预断任意拘留意见。不能机械套用HRC用尽救济条件或一般特别程序全部规则。','Paragraphs 22–23 require specific urgency; an urgent appeal does not prejudge an opinion. Do not import HRC exhaustion requirements or every general Special Procedures rule.')),
  ...disclosure
 ];
 result.push({mechanismId:'wgad-submission',title:pick(locale,'任意拘留问题工作组：独立程序研究','Working Group on Arbitrary Detention: separate procedure research'),state:state(wg),conditions:wg,resourceIds:['wgad-submission'],disclosure:[pick(locale,'向政府传送、意见公开及安全安排需逐项复核；意见不等于国内执行、释放或赔付。','Review government transmission, publication and safety separately. An opinion is not domestic implementation, release or compensation.')],nextChecks:[pick(locale,'查现用问卷、独立方法后续修订、实际紧急事实和其他机制协调；本轮只准备内部材料。','Check the current questionnaire, any methods revisions, actual urgency and coordination with other mechanisms; prepare internal material only.')]});

 if(s.jurisdiction.countryCode==='GB'||s.jurisdiction.countryCode==='RU'){
  const regional:Condition[]=[condition(pick(locale,'欧洲公约国家与事件时间','ECHR State and event-time scope'),s.jurisdiction.countryCode==='GB'?'confirmed':'unknown',s.jurisdiction.countryCode==='GB'?pick(locale,'英国为欧洲公约缔约方；具体领土、事件、权利和程序仍须另核。','The UK is an ECHR party; territory, event, right and procedure still require separate review.'):pick(locale,'俄罗斯于2022-09-16停止为欧洲公约缔约方；此前事件的余留管辖须个案核对，新事件不能照搬历史路径。','Russia ceased to be an ECHR party on 2022-09-16. Residual jurisdiction for earlier events requires individual review; historical paths cannot be transferred to new events.')),condition(pick(locale,'区域机制个案受理条件','Regional individual admissibility'),'unknown',pick(locale,'欧洲人权法院属于欧洲公约体系，不是ICCPR法院。国内救济、最终决定日期、时限及重复程序未完整核查，当前仅资格研究。','The ECtHR belongs to the European Convention system, not the ICCPR. Remedies, final-decision dates, time limits and duplicate proceedings are not fully reviewed; eligibility research only.')),...disclosure];
  result.push({mechanismId:'ecthr-applicants',title:pick(locale,'欧洲人权法院：候选资格研究','European Court of Human Rights: candidate eligibility research'),state:state(regional),conditions:regional,resourceIds:['ecthr-applicants'],disclosure:[pick(locale,'不生成可直接递交成稿；公开及匿名安排需按法院规则另核。','No submission-ready application; publication and anonymity need separate Court-rule review.')],nextChecks:[pick(locale,'请具备该体系经验的律师核对国家、事件日期、最终国内决定、资格及完整受理规则。','Counsel familiar with the system should review the State, events, final domestic decision, standing and full admissibility rules.')]});
 }
 return result;
}
