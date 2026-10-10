import {buildLegalResearch,validateLegalCitations,legalJurisdiction,legalProceeding} from '../legal-research';
import { cases, documents, evidence, resources } from '../corpus';
import { ActionOptionSchema, ModelAnalysisOutputSchema, WebModelAnalysisOutputSchema, type WebModelAnalysisOutput, type ModelAnalysisOutput, type NewCaseInput, type Evidence, type CaseRecord } from '../contracts';
import { AnalysisError } from '../ai/errors';
import { type MatchedCase } from '../retrieval/match';
import { buildRuleReference } from '../retrieval/rules';
import type { Locale } from '../i18n/locale';
import { needsGoalClarification,hasDisclosureNotes,normalizeConfirmedGoal } from '../intake/analysis';
import {supportedUserOutcome} from './user-claims';
import {WebResearchSchema,type WebResearch} from '../research/contracts';
import {supportedHistoricalOutcome,mentionsCase} from './historical-claims';

export type AnalysisContext={cases:CaseRecord[];evidence:Evidence[];resources:typeof resources};
export function contextFor(matches:MatchedCase[]):AnalysisContext{
  const caseIds=new Set(matches.map(m=>m.record.caseId));
  const selected=evidence.filter(e=>caseIds.has(e.caseId)&&e.reviewStatus!=='draft'&&e.origin!=='unverified_footnote');
  selected.forEach(validateEvidenceRecord);
  return {cases:matches.map(m=>m.record),evidence:selected,resources};
}
export function validateEvidenceRecord(item:Evidence){
  const owner=cases.find(c=>c.caseId===item.caseId);const doc=documents.find(d=>d.documentId===item.documentId);
  if(!owner||!doc||!owner.sourceDocumentIds.includes(item.documentId)||item.pdfPage>doc.pageCount||item.sourceUrl!==doc.sourceUrl||item.pdfPage<1)
    throw new AnalysisError('INVALID_MODEL_OUTPUT','证据的案件、文件或页码归属不一致，已停止显示该结果。',502);
}
const allText=(value:unknown):string=>Array.isArray(value)?value.map(allText).join('\n'):value&&typeof value==='object'?Object.entries(value).filter(([k])=>!['supportingEvidenceIds','evidenceIds','resourceIds','caseId','actionId'].includes(k)).map(([,v])=>allText(v)).join('\n'):typeof value==='string'?value:'';
function fail(message:string):never {throw new AnalysisError('INVALID_MODEL_OUTPUT',message,502);}
/** A web citation can support a public comparison, never establish an outcome for the user's new case. */
function externalWebClaim(text:string,index:number,match:string):boolean{
  const clauseStart=Math.max(text.lastIndexOf('\n',index-1),text.lastIndexOf('。',index-1),text.lastIndexOf('.',index-1),text.lastIndexOf(';',index-1))+1;
  const subjectContext=text.slice(Math.max(clauseStart,index-120),index+match.length);
  return !/\b(?:you|your|the (?:new|current|user['’]s) case)\b|你|您|用户|本案|新案|当前案件/i.test(subjectContext);
}
function checkClaimText(text:string,input:NewCaseInput,records:CaseRecord[]=[],refs:Evidence[]=[],locale:Locale='zh',webBacked=false){
  if(/https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+\d[\d ()-]{7,}\d)/i.test(text))fail('生成内容包含未经核实的联系方式或链接；请使用证据和资源区域中的官方入口。');
  if(/(?:成功率|胜诉率|胜率|获释率|成功概率|胜诉概率|置信度)[^。\n]{0,24}(?:\d+(?:\.\d+)?\s*[%％]|百分之)|(?:\d+(?:\.\d+)?\s*[%％]|百分之[^，。\n]{1,6})[^。\n]{0,24}(?:成功|胜诉|获释|撤诉|把握)|(?:保证|必定|确保|一定)(?:会)?(?:成功|胜诉|获释|撤诉)/.test(text))fail('生成内容含成功概率或结果保证，未作为有效结果显示。');
  if(/(?:必须|法定期限|最迟|应在)[^\n。]{0,15}\d+\s*(?:天|日|小时|周|个月)/.test(text))fail('生成内容推算了未经确认的期限，未作为有效结果显示。');
  if(webBacked)for(const outcome of text.matchAll(/(?:已|已经|被)(?:撤销|撤回|驳回|终结|结案)|(?:已|已经)(?:获释|释放|胜诉)/g)){
    if(!externalWebClaim(text,outcome.index??0,outcome[0])){
      const before=text.slice(Math.max(0,(outcome.index??0)-14),outcome.index);
      if(!/(?:不|未|不能|并非|不等于|是否|没有)[^。\n]{0,12}$/.test(before)&&!supportedUserOutcome(text,outcome.index??0,outcome[0],input))fail('网页中的其他案件结果不能证明用户新案已有终局结果。');
    }
  }
  const unsupported=/(?:已|成功|最终|因此|导致|使其)[^。\n]{0,10}(?:撤诉|撤案|撤销(?:定罪|判决)|无罪|完全获释|全面获释)|(?:被判|获判|裁定为?)[^。\n]{0,8}无罪|(?:使|令)[^。\n]{0,12}(?:免于定罪|免于追诉|获得无罪)/g;
  for(const m of text.matchAll(unsupported)){
    const before=text.slice(Math.max(0,(m.index??0)-14),m.index).replace(/不仅|不只是|不但|并非仅/g,'');
    if(!/(?:不|未|不能|并非|不等于|是否|没有)[^。\n]{0,12}$/.test(before)&&!supportedUserOutcome(text,m.index??0,m[0],input)&&!(webBacked&&externalWebClaim(text,m.index??0,m[0]))&&!supportedHistoricalOutcome(text,m.index??0,m[0],records,refs,locale))fail('生成内容作出了历史材料不支持的终局结果判断。');
  }
  for(const m of text.matchAll(/(?:联合国|特别报告员)[^。\n]{0,12}(?:已介入|已经介入|已受理|已经受理|承诺受理)/g)){
    const before=text.slice(Math.max(0,(m.index??0)-16),m.index);
    if(!/(?:不|未|不能|不是|是否|没有)[^。\n]{0,14}$/.test(before)&&!/(?:不|未|否)/.test(m[0]))fail('材料没有证明联合国机制已介入或承诺受理，结果已拒绝。');
  }
  if(!webBacked&&/(?:Aigul|Utepova|乌特波娃)[^。\n]{0,25}(?:上诉成功|上诉获准|推翻.{0,4}定罪)/i.test(text))fail('历史材料记载Aigul定罪上诉被驳回，不支持该判断。');
  if(!webBacked&&/(?:Myriam|Bribri|Emna|Chargui)[^。\n]{0,25}(?:已撤诉|已撤案|已无罪|上诉获准|上诉成功)/i.test(text))fail('历史材料未记载该终局结果，不支持该判断。');
  if(!webBacked)for(const sentence of text.split(/[。\n]/))if(/Emna|Chargui/i.test(sentence)&&/宣判|判决|定罪|verdict|convict/i.test(sentence)&&/(?:2020[-/.]0?7[-/.](?:03|13)|2020年7月(?:3|13)日|July (?:3|13),? 2020)/i.test(sentence)&&!/(?:冲突|不一致|两个|两种|未解决|conflict|inconsisten|discrepan|two (?:different )?dates|both dates|unresolved|disputed)/i.test(sentence))fail('Emna宣判日期存在冲突，不能把其中一个日期当成已确定事实。');
  checkClaimTextEnglish(text,input,(index,match)=>(webBacked&&externalWebClaim(text,index,match))||supportedHistoricalOutcome(text,index,match,records,refs,locale),webBacked);
}

/* English mirrors of the checks above, so English output (rule-based or live AI) meets the same bar. */
const NEGATION=/\b(?:no|not|never|nor|cannot|without|whether|neither|unless|avoid|instead of)\b|n['’]t\b/i;
/** True when the clause just before `index`, or the matched text itself, is negated. */
function negated(text:string,index:number,match=''){const clause=(text.slice(Math.max(0,index-60),index).split(/[.!?;\n]|\bbut\b/i).pop()??'').replace(/\bnot (?:only|merely|just)\b/gi,'');return NEGATION.test(clause)||NEGATION.test(match);}
function failUnlessNegated(text:string,pattern:RegExp,message:string,userInput?:NewCaseInput,historical?:(index:number,match:string)=>boolean){for(const m of text.matchAll(pattern))if(!negated(text,m.index??0,m[0])&&!(userInput&&supportedUserOutcome(text,m.index??0,m[0],userInput))&&!historical?.(m.index??0,m[0]))fail(message);}
function checkClaimTextEnglish(text:string,input:NewCaseInput,historical:(index:number,match:string)=>boolean,webBacked=false){
  if(/\b\d+(?:\.\d+)?\s*(?:percent|per cent|%)[^.\n]{0,32}\b(?:chance|probability|confidence|success|win|winning|victory|release|acquittal)\b|\b(?:chance|probability|confidence|success rate|win rate)\b[^.\n]{0,32}\d+(?:\.\d+)?\s*(?:percent|per cent|%)/i.test(text))fail('生成内容含成功概率或结果保证，未作为有效结果显示。');
  failUnlessNegated(text,/\b(?:guarantee[sd]?|guaranteeing|ensures?|certain to|sure to|definitely|certainly)\b[^.\n]{0,20}?\b(?:succeed|success|win|victory|released?|acquitt(?:ed|al)|dismiss(?:ed|al)|dropped)\b/gi,'生成内容含成功概率或结果保证，未作为有效结果显示。');
  if(/\b(?:must|deadline|no later than|at the latest|within)\b[^.\n]{0,24}\b\d+\s*(?:days?|hours?|weeks?|months?)\b/i.test(text))fail('生成内容推算了未经确认的期限，未作为有效结果显示。');
  const finalOutcome='生成内容作出了历史材料不支持的终局结果判断。';
  // A citation to a different proceeding cannot establish dismissal of the
  // user's case. Preserve the narrow, attributed user-account exception.
  if(webBacked)for(const outcome of text.matchAll(/\bcase\s+(?:was|has been|had been)\s+dismissed\b/gi)){
    const index=outcome.index??0;
    if(!externalWebClaim(text,index,outcome[0])&&!negated(text,index,outcome[0])&&!supportedUserOutcome(text,index,outcome[0],input))fail('网页中的其他案件结果不能证明用户新案已有终局结果。');
  }
  failUnlessNegated(text,/\b(?:has been|have been|had been|was|were|successfully|finally|ultimately|therefore|thus|led to|leading to|resulted in|caused)\b[^.\n]{0,25}?\b(?:charges? (?:were |was |being |been )?(?:dropped|withdrawn|dismissed)|(?:conviction|verdict|judgment) (?:was |being |been )?(?:overturned|quashed|annulled|reversed)|acquitted|acquittal|fully released|full release|released in full)\b/gi,finalOutcome,input,historical);
  failUnlessNegated(text,/\b(?:conviction|verdict)\s+(?:was|has been|had been|got)\s+(?:overturned|quashed|annulled|reversed)\b|\bcharges?\s+(?:were|was|have been|has been|had been|got)\s+(?:dropped|withdrawn|dismissed)\b|\b(?:was|were|has been|have been|got)\s+acquitted\b|\b(?:fully|completely)\s+released\b|\bfull release\b/gi,finalOutcome,input,historical);
  failUnlessNegated(text,/\b(?:UN|United Nations|Special Rapporteurs?|OHCHR|Special Procedures)\b[^.\n]{0,30}?\b(?:has|have|had)\s+(?:already\s+)?(?:been\s+)?(?:intervened|taken up|accepted|agreed to take|committed to|registered)\b|\b(?:UN|United Nations|Special Rapporteurs?)\b[^.\n]{0,20}?\b(?:is|are)\s+(?:now\s+)?(?:involved|handling|examining)\b/gi,'材料没有证明联合国机制已介入或承诺受理，结果已拒绝。');
  if(!webBacked)failUnlessNegated(text,/(?:Aigul|Utepova)[^.\n]{0,40}?(?:won (?:her|the) appeal|appeal (?:was |has been )?(?:granted|successful|upheld|accepted)|conviction (?:was |has been )?(?:overturned|quashed|reversed))/gi,'历史材料记载Aigul定罪上诉被驳回，不支持该判断。');
  if(!webBacked)failUnlessNegated(text,/(?:Myriam|Bribri|Emna|Chargui)[^.\n]{0,40}?(?:charges? (?:were |was |have been |has been )?(?:dropped|withdrawn|dismissed)|case (?:was |has been )?dismissed|(?:was|has been) acquitted|won (?:her|the) appeal|appeal (?:was |has been )?(?:granted|successful|upheld|accepted))/gi,'历史材料未记载该终局结果，不支持该判断。');
}

/** Formal procedural filings need eligibility/representation checks; ordinary private disputes do not. */
function proposesFormalFiling(title:string,steps:string[]):boolean {
  const pattern=/(?:提起|提交|提出|申请|递交|启动)[^。；;\n]{0,16}(?:诉讼|起诉|上诉|再审|保释|取保候审|司法审查|撤诉|停止追诉|拘押措施)|(?:向法院|向检察院)[^。；;\n]{0,16}(?:提交|提出|申请|递交)|\b(?:file|lodge|submit|bring|seek|apply for)\b[^.\n;]{0,40}\b(?:lawsuit|court claim|judicial review|bail|retrial|court appeal|criminal appeal)\b/gi;
  return [title,...steps].some(text=>[...text.matchAll(pattern)].some(m=>!negated(text,m.index??0,m[0])&&!/(?:不|勿|暂不|不要|不能)[^。\n]{0,8}$/.test(text.slice(Math.max(0,(m.index??0)-10),m.index))));
}

/** Do not turn an explicit internal-only/no-contact boundary into a private-channel exception. */
function checkPrivateContactBoundary(steps:string[],input:NewCaseInput){
  const notes=[input.intake?.disclosureDetails??'',...(input.intake?.answers??[]).filter(a=>a.questionId==='disclosure-details').map(a=>a.answer)].join('\n');
  const internalOnly=/(?:仅|只)(?:限)?内部(?:整理|使用|查看|处理)|\b(?:internal use only|internal preparation only|only internal preparation|do not contact anyone)\b/i.test(notes);
  const noPlatform=/(?:不|勿|禁止|不要)(?:向平台(?:提交|发送|分享)|联系平台|联系平台客服)|\bdo not (?:contact|send[^.\n]{0,15}to) (?:the )?platform\b/i.test(notes);
  const noOtherParty=/(?:不|勿|禁止|不要)(?:向(?:交易)?对方(?:提交|发送|分享)|联系(?:交易)?对方)|\bdo not contact (?:the )?(?:other party|seller|trader)\b/i.test(notes);
  if(!internalOnly&&!noPlatform&&!noOtherParty)return;
  const actions=/(?:联系|向|给)(?:平台(?:客服)?|交易对方|对方|商家)[^。\n]{0,15}(?:提交|发送|分享|协商|申诉|申请|赔偿)|联系(?:平台(?:客服)?|交易对方|对方|商家)|\b(?:contact|send|submit|negotiate)\b[^.\n]{0,30}\b(?:platform|other party|seller|trader)\b/gi;
  for(const step of steps)for(const match of step.matchAll(actions)){
    const index=match.index??0;const before=step.slice(Math.max(0,index-18),index);
    if(negated(step,index,match[0])||/(?:不|勿|禁止|暂缓|不要|是否)[^。\n]{0,12}$/.test(before))continue;
    if(internalOnly||(noPlatform&&/平台|platform/i.test(match[0]))||(noOtherParty&&/对方|商家|other party|seller|trader/i.test(match[0])))fail('行动步骤超出了用户明确限定的内部处理或不联系范围；私下渠道也不能覆盖这些限制。');
  }
}

/** Strict structural and deterministic constraints. Narrative entailment is not fully automated. */
function validateModelCore(raw:unknown,input:NewCaseInput,context:AnalysisContext,locale:Locale='zh',webActions:ReadonlySet<string>=new Set()):ModelAnalysisOutput{
  input=normalizeConfirmedGoal(input);
  const parsed=ModelAnalysisOutputSchema.safeParse(raw);
  if(!parsed.success)fail('AI 返回格式不合法或内容不完整，未生成有效结果。');
  const result=parsed.data;
  const legalErrors=validateLegalCitations(result,input,buildLegalResearch(input,locale));
  if(legalErrors.length)fail(legalErrors.join('；'));
  if(needsGoalClarification(input)){
    const allowed=buildRuleReference(input,undefined,locale).actionOptions.map(a=>ActionOptionSchema.parse(a));
    if(JSON.stringify(result.actionOptions)!==JSON.stringify(allowed))fail('目标未确定时，行动仅限服务器提供的需求澄清与材料梳理模板，不能生成具体程序目标。');
  }
  const contextEvidence=new Map(context.evidence.map(e=>[e.evidenceId,e]));const contextCases=new Map(context.cases.map(c=>[c.caseId,c]));
  const resolve=(ids:string[],owner?:string)=>{if(new Set(ids).size!==ids.length)fail('生成内容含重复引用。');return ids.map(id=>{const item=contextEvidence.get(id);if(!item)fail('生成内容引用了不存在或本次未提供的证据。');validateEvidenceRecord(item);if(owner&&item.caseId!==owner)fail('生成内容存在串案引用，已拒绝显示。');return item;});};
  if(new Set(result.comparableCases.map(c=>c.caseId)).size!==result.comparableCases.length)fail('同一历史案被重复列为多个案例。');
  for(const c of result.comparableCases){
    if(!contextCases.has(c.caseId)||!c.evidenceIds.length)fail('生成内容使用了本次未提供的案例或缺少事实依据。');
    const refs=resolve(c.evidenceIds,c.caseId);const text=allText(c);
    for(const other of cases)if(other.caseId!==c.caseId&&mentionsCase(text,other,cases))fail('可比性说明混入了其他案件的事实归属。');
    checkClaimText(text,input,context.cases,refs,locale);
  }
  if(new Set(result.actionOptions.map(a=>a.actionId)).size!==result.actionOptions.length)fail('行动标识重复。');
  if(!result.actionOptions.length)fail('生成结果没有可用的行动或信息梳理参考。');
  const disclosureNotes=hasDisclosureNotes(input);
  const publicityRestricted=input.publicity!=='public'||disclosureNotes;
  const privateScope=input.publicity==='private'||disclosureNotes;
  for(const action of result.actionOptions){
    const refs=resolve(action.supportingEvidenceIds);const text=allText(action);
    checkPrivateContactBoundary(action.steps,input);
    if(action.goal!==input.primaryGoal)fail('生成方案更改了用户的当前目标。');
    if(action.resourceIds.some(id=>!context.resources.some(r=>r.resourceId===id)))fail('生成方案引用了未经提供的机构入口。');
    for(const id of action.resourceIds){
      const resource=context.resources.find(r=>r.resourceId===id)!;
      const ineligible=resourceIneligibility(resource,input);if(ineligible)fail(ineligible);
      if(['domestic_law','procedure_rule','treaty','interpretation'].includes(resource.type??'')&&!(action.legalCitations??[]).some(c=>c.resourceId===id))fail('法律依据必须对应本行动中的具体判断和条款，不能仅附资源ID。');
    }

    if(action.requiresPublicity&&publicityRestricted&&action.applicability==='priority')fail(disclosureNotes?'你提供了具体披露说明或补充回答；总体可公开不能覆盖这些边界。请先逐项确认可披露内容、接收对象、方式与同意范围。':'生成方案违反了当前公开限制。');
    if(privateScope&&action.requiresPublicity&&action.applicability!=='defer')fail('具体披露边界尚未核实时，公开传播必须暂缓；只能先内部梳理并确认同意范围。');
    if(publicityRestricted&&/(?:立即|直接|现在就|马上)(?:向媒体|发布|公开|发帖|联系媒体)/.test(text))fail('生成步骤要求立即公开，违反了用户的公开限制。');
    if(publicityRestricted)failUnlessNegated(text,/\b(?:immediately|right away|right now|at once|straight away)\b[^.\n]{0,20}?\b(?:publish|post|go public|contact (?:the )?(?:media|press|journalists)|announce)\b|\b(?:publish|post|go public|contact the media|issue a press release)\b[^.\n]{0,15}?\b(?:immediately|right away|right now|at once)\b/gi,'生成步骤要求立即公开，违反了用户的公开限制。');
    if(publicityRestricted&&(!action.requiresPublicity||disclosureNotes)){
      for(const m of action.steps.join('\n').matchAll(/(?:向媒体发布|对外发布|发布声明|公开传播|媒体传播|发布案情|联系媒体|公开报道|公开.{0,6}(?:姓名|名字|身份|联系方式))/g)){
        const before=action.steps.join('\n').slice(Math.max(0,(m.index??0)-12),m.index);
        if(m[0]==='公开报道'&&publishedReportNoun(action.steps.join('\n'),m.index??0))continue;
        if(!/(?:不|勿|禁止|暂缓)[^。\n]{0,10}$/.test(before))fail('行动步骤包含未标识的公开传播，违反当前公开限制。');
      }
      failUnlessNegated(action.steps.join('\n'),/\b(?:press release|public statement|publish(?:ing)? (?:the )?(?:case|story|details|statement|names?|identit(?:y|ies)|contact details)|go(?:ing)? public|media outreach|contact(?:ing)? (?:the )?(?:media|press|journalists)|public campaign|publici[sz]e|social media campaign)\b/gi,'行动步骤包含公开传播，具体披露边界尚未核实，不能据此实施。');
    }
    if(action.basisType==='web_research'&&!webActions.has(action.actionId))fail('联网行动缺少本次搜索的有效来源引用。');
    if(!['general_preparation','web_research'].includes(action.basisType)&&!refs.length)fail('历史行动或报告建议必须提供已核对证据。');
    if(action.basisType==='report_recommendation'&&!context.cases.some(c=>c.reportRecommendations.some(r=>r.evidenceIds.some(id=>action.supportingEvidenceIds.includes(id)))))fail('该行动没有报告建议依据。');
    if(action.basisType==='historical_action'&&!context.cases.some(c=>c.interventions.some(i=>i.executionStatus==='implemented'&&i.evidenceIds.some(id=>action.supportingEvidenceIds.includes(id)))))fail('该行动没有已实施的历史行动依据。');
    if(action.applicability==='priority'&&action.basisType!=='general_preparation'&&(
      (input.primaryGoal==='change_judgment'&&!['appeal','postjudgment'].includes(input.stage))||
      (input.primaryGoal==='drop_charges'&&!['investigation','pretrial','trial'].includes(input.stage))||
      (['release','conditions'].includes(input.primaryGoal)&&!input.currentProblems.includes('detained'))
    ))fail('行动目标与目前已知阶段或拘押状态不一致，应先核实适用条件。');
    if(needsGoalClarification(input)&&(action.basisType!=='general_preparation'||action.requiresPublicity))fail('目标未具体确定时只能先梳理需求与信息，不能替用户选择具体行动。');
    if(!input.resources.includes('lawyer')&&proposesFormalFiling(action.title,action.steps)&&action.applicability==='priority'){
      if(input.intake?.confirmed&&!input.resources.includes('none')&&!needsGoalClarification(input)){
        action.applicability='conditional';
        const prerequisite=locale==='en'?'Before making this formal filing, check the competent forum, eligibility and whether local rules require representation. If a lawyer is already involved, confirm their mandate; do not assume a lawyer is required for private negotiation or a platform request.':'在正式提交司法程序申请前，核实受理机关、提出资格与当地代理要求；已有律师时核对委托范围。私下协商和平台申诉不因此被认定必须聘请律师。';
        const uncertainty=locale==='en'?'The applicability and representation requirements of this formal procedure remain to be checked. This does not mean no lawyer is already assisting or that every dispute needs one.':'本项正式程序的适用条件与代理要求仍待核对，不表示你没有律师，也不表示每类纠纷均须律师介入。';
        action.prerequisites=[prerequisite,...action.prerequisites.filter(item=>item!==prerequisite)].slice(0,8);
        action.uncertainties=[uncertainty,...action.uncertainties.filter(item=>item!==uncertainty)].slice(0,8);
      }else fail('需要律师执行的程序行动缺少法律支持前提。');
    }
    for(const c of cases){if(action.basisType!=='web_research'&&mentionsCase(text,c,cases)&&!refs.some(e=>e.caseId===c.caseId))fail('方案提到历史案，但引用没有支持该案件的归属。');}
    if(action.steps.length<3||action.materials.length<2||action.followUp.length<2)fail('行动参考缺少具体步骤、材料或跟进点，未达到完整方案要求。');
    checkClaimText(text,input,context.cases,refs,locale,webActions.has(action.actionId));
    if(disclosureNotes&&action.requiresPublicity){
      const prerequisite=locale==='en'?'First review every disclosure note with the person: exactly what may be shared, with whom, by which channel, and whose specific consent is required. Until that is confirmed, prepare internally only.':'先与当事人逐条核对披露说明：哪些内容可分享、给谁、用什么方式、需谁明确同意；确认之前仅做内部准备。';
      action.prerequisites=[prerequisite,...action.prerequisites.filter(item=>item!==prerequisite)].slice(0,8);
    }
  }
  checkClaimText(result.missingInformation.join('\n')+'\n'+result.limitations.join('\n'),input);
  if(disclosureNotes){
    const note=locale==='en'?'You supplied free-form disclosure boundaries. The system has not established that it fully understands them; a broad public preference is not consent to a specific disclosure. Review the exact content, recipients, channel and consent with the person before any external sharing.':'你提供了自由填写的披露边界，系统不能确认已完整理解其中限制；总体可公开不等于同意某次具体披露。任何对外分享前，须与当事人逐项核实内容、接收者、方式和同意范围。';
    result.limitations=[note,...result.limitations.filter(item=>item!==note)].slice(0,12);
  }
  return result;
}

/** In a reporting case “公开报道” is often the article already published (涉案的公开报道、报道原文), not a step that publishes anything. */
function publishedReportNoun(text:string,index:number):boolean{
  return /(?:涉案|原|该|这篇|那篇|此篇|本篇|这份|那份|此前|已经|已|相关|被诉|被控|争议|所涉|上述|前述)的?$/.test(text.slice(Math.max(0,index-6),index))
    ||/^的?(?:原文|全文|截图|链接|内容|文本|发表时间|发表日期|标题|存档|网页|版本)/.test(text.slice(index+4,index+12));
}

/** Whether this case can use a catalog resource at all, judged from the confirmed case alone. The same rule screens what the model is offered and what it may return. */
export function resourceIneligibility(resource:AnalysisContext['resources'][number],input:NewCaseInput):string|null{
  const audit=resource.sourceAudit;
  const jurisdiction=legalJurisdiction(input),country=jurisdiction.startsWith('GB-')?'GB':jurisdiction;
  if(audit?.jurisdictionChecks?.some(c=>c.jurisdiction===country&&c.status==='not_met'))return '本案不满足该资源的国家或机制资格，不能推荐为适用依据。';
  if(['domestic_law','procedure_rule'].includes(resource.type??'')&&!audit?.jurisdiction.includes(jurisdiction))return '当地规则与本案具体法域不匹配。';
  if(audit&&legalProceeding(input)==='civil'&&!audit.proceedings.includes('civil')&&!audit.proceedings.includes('all'))return '不能将仅刑事或拘押程序资源推荐为民事案件依据。';
  if(resource.resourceId==='cpj-emergency-help'&&input.background.personType!=='journalist'&&!input.background.activities.some(a=>a==='reporting'||a==='investigation_report'))return '当前资料没有确认新闻工作背景，不能默认适用记者协助入口。';
  return null;
}
/** The model is offered only resources this case could use, so it cannot pick another country's law or an entry the person does not qualify for. */
export function eligibleContext(context:AnalysisContext,input:NewCaseInput):AnalysisContext{
  return {...context,resources:context.resources.filter(resource=>!resourceIneligibility(resource,input))};
}
/** A catalog link the case cannot use is removed from that action instead of discarding the whole analysis. Unknown ids are left for validation to reject. */
export function dropIneligibleResources(raw:unknown,input:NewCaseInput):unknown{
  if(!raw||typeof raw!=='object'||!Array.isArray((raw as {actionOptions?:unknown}).actionOptions))return raw;
  const usable=(id:unknown)=>{const resource=resources.find(r=>r.resourceId===id);return !resource||!resourceIneligibility(resource,input);};
  const actionOptions=(raw as {actionOptions:unknown[]}).actionOptions.map(action=>{
    const value=action as {resourceIds?:unknown;legalCitations?:unknown};
    if(!value||typeof value!=='object'||!Array.isArray(value.resourceIds)||value.resourceIds.every(usable))return action;
    return {...value,resourceIds:value.resourceIds.filter(usable),...(Array.isArray(value.legalCitations)?{legalCitations:value.legalCitations.filter(c=>usable((c as {resourceId?:unknown}|null)?.resourceId))}:{})};
  });
  return {...raw,actionOptions};
}

export function collectSources(output:ModelAnalysisOutput,context:AnalysisContext):Evidence[]{
  const ids=new Set([...output.comparableCases.flatMap(c=>c.evidenceIds),...output.actionOptions.flatMap(a=>a.supportingEvidenceIds)]);
  return context.evidence.filter(e=>ids.has(e.evidenceId));
}

/** Unknown goals leave no model discretion over action selection or wording. */
export function lockUnspecifiedGoalActions(raw:unknown,input:NewCaseInput,locale:Locale='zh'):unknown{
  if(!needsGoalClarification(input))return raw;
  const parsed=ModelAnalysisOutputSchema.safeParse(raw);
  if(!parsed.success)fail('AI 返回格式不合法或内容不完整，未生成有效结果。');
  return {...parsed.data,actionOptions:buildRuleReference(input,undefined,locale).actionOptions};
}


/** Corpus-only callers retain every original historical claim constraint. */
export function validateModelOutput(raw:unknown,input:NewCaseInput,context:AnalysisContext,locale:Locale='zh'):ModelAnalysisOutput{
  return validateModelCore(raw,input,context,locale);
}

type DatedMention={key:string;start:number;end:number};
/** Narrow full-date recognition, not a general event-date or narrative entailment parser. */
function datedMentions(text:string):DatedMention[]{
  const mentions:DatedMention[]=[];
  const add=(match:RegExpMatchArray,year:string,month:string|number,day:string)=>mentions.push({key:`${year}-${Number(month)}-${Number(day)}`,start:match.index??0,end:(match.index??0)+match[0].length});
  for(const m of text.matchAll(/\b(\d{4})(?:[-/.](\d{1,2})[-/.](\d{1,2})|年\s*(\d{1,2})月\s*(\d{1,2})日)/g))add(m,m[1],m[2]??m[4],m[3]??m[5]);
  const months='January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';
  const monthNumber=(month:string)=>['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(month.toLowerCase().slice(0,3))+1;
  for(const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${months})\\.?[,]?\\s+(\\d{4})\\b`,'gi')))add(m,m[3],monthNumber(m[2]),m[1]);
  for(const m of text.matchAll(new RegExp(`\\b(${months})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(\\d{4})\\b`,'gi')))add(m,m[3],monthNumber(m[1]),m[2]);
  return mentions;
}
function publicationOnlyStatusDate(comparison:WebModelAnalysisOutput['webComparisons'][number],research:WebResearch):boolean{
  if(!comparison.statusAsOf)return false;
  const dates=datedMentions(comparison.statusAsOf);if(dates.length!==1)return false;
  let publication=false,procedural=false;
  for(const passage of research.passages.filter(p=>p.sourceIds.some(id=>comparison.sourceIds.includes(id)))){
    for(const date of datedMentions(passage.text).filter(d=>d.key===dates[0].key)){
      const before=passage.text.slice(Math.max(0,date.start-100),date.start);
      const after=passage.text.slice(date.end,date.end+100);
      publication ||= /(?:发布|刊载|刊登|发表|报道|转载)(?:日期|时间)?(?:为|是|于|在|：|:)?\s*$|\b(?:published|posted|reported|publication(?: date)?|(?:article|report) (?:dated|date))\s*(?:on|as of|:)?\s*$/i.test(before)
        || /^\s*(?:首次)?(?:发布|刊载|刊登|发表|报道|转载)|^\s*[,，]?\s*(?:(?:the )?(?:court|website)\s+)?(?:published|posted|reported)\b/i.test(after);
      // Require the date to attach directly to an event, not merely to a report
      // whose later sentence mentions a judgment or settlement on an unknown day.
      procedural ||= /(?:作出(?:了)?(?:判决|裁定)|宣判|开庭|达成(?:和解|调解协议)|和解|裁判日期|判决日期)(?:为|是|发生于|发生在|于|在|：|:)?\s*$|\b(?:judgment|judgement|decision|ruling|hearing|settlement)\s*(?:(?:was|is|dated|of|on|issued|delivered|entered|reached|held|made)\s+)*[,，:]?\s*$|\b(?:settled|held the hearing)\s+(?:on\s+)?$/i.test(before)
        || /^\s*[,，]?\s*(?:法院)?(?:作出(?:了)?(?:判决|裁定)|宣判|开庭|达成(?:和解|调解协议))|^\s*[,，]?\s*(?:(?:the )?court\s+)?(?:issued|delivered|handed down|rendered|entered|made)\s+(?:(?:a|the)\s+)?(?:judgment|judgement|decision|ruling)\b|^\s*[,，]?\s*(?:the )?parties\s+(?:settled|reached (?:a )?settlement)\b/i.test(after);
    }
  }
  return publication&&!procedural;
}
function clarifyPublicationDate(comparison:WebModelAnalysisOutput['webComparisons'][number],result:WebModelAnalysisOutput,locale:Locale){
  comparison.statusAsOf=null;
  const note=locale==='en'?'The cited passages identify only a publication or reporting date, not the date of a judgment or other procedural event; the case-status date is unconfirmed.':'引用段落仅明确资料发布或报道日期，未明确该日为裁判或其他程序事件日期；状态日期未确认。';
  if(comparison.differences.includes(note))return;
  if(comparison.differences.length<5){comparison.differences.push(note);return;}
  const room=comparison.differences.findIndex(text=>text.length+note.length+1<=800);
  if(room>=0){comparison.differences[room]+=`\n${note}`;return;}
  // Preserve all original content even if every per-comparison field is full.
  if(result.limitations.length<12&&!result.limitations.includes(note))result.limitations.push(note);
}

/** Web source IDs are owned by this request's citation annotations, never the model. */
export function validateWebModelOutput(raw:unknown,input:NewCaseInput,context:AnalysisContext,research:WebResearch,locale:Locale='zh'):WebModelAnalysisOutput{
  const parsed=WebModelAnalysisOutputSchema.safeParse(raw);
  const checked=WebResearchSchema.safeParse(research);
  if(!parsed.success||!checked.success)fail('联网分析或来源格式不合法，未显示结果。');
  if(checked.data.status!=='completed'||checked.data.failureReason!==null||checked.data.searchCallCount<1||!checked.data.sources.length)fail('本次没有可用的联网研究，不能生成联网引用。');
  const sourceIds=new Set(checked.data.sources.map(source=>source.sourceId));
  if(sourceIds.size!==checked.data.sources.length)fail('本次联网来源标识重复。');
  if(!checked.data.passages.length||checked.data.passages.some(passage=>!passage.sourceIds.length||new Set(passage.sourceIds).size!==passage.sourceIds.length||passage.sourceIds.some(id=>!sourceIds.has(id))))fail('联网段落与来源的引用关系不完整。');
  const citedPassageIds=new Set(checked.data.passages.flatMap(passage=>passage.sourceIds));
  const checkSources=(ids:string[])=>{
    if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!sourceIds.has(id)||!citedPassageIds.has(id)))fail('联网比较或行动引用了空、重复或本次未提供的来源。');
  };
  const result=parsed.data;
  const webActions=new Set<string>();
  for(const link of result.actionWebSources){
    const action=result.actionOptions.find(item=>item.actionId===link.actionId);
    if(webActions.has(link.actionId)||!action||action.basisType!=='web_research')fail('联网行动来源映射重复或没有对应的联网行动。');
    checkSources(link.sourceIds);webActions.add(link.actionId);
  }
  for(const comparison of result.webComparisons){
    checkSources(comparison.sourceIds);
    if(publicationOnlyStatusDate(comparison,checked.data))clarifyPublicationDate(comparison,result,locale);
    // Only this cited web section may describe external outcomes. Common guards
    // (links, promises, deadlines) still apply; corpus comparisons stay strict.
    const comparisonText=allText(comparison);
    checkClaimText(comparisonText,input,[],[],locale,true);
    if(input.publicity!=='public'||hasDisclosureNotes(input)){
      if(/(?:立即|直接|现在就|马上)(?:向媒体|发布|公开|发帖|联系媒体)/.test(comparisonText))fail('联网比较包含立即公开的指令，违反当前披露限制。');
      failUnlessNegated(comparisonText,/\b(?:immediately|right away|right now|at once)\b[^.\n]{0,20}?\b(?:publish|post|go public|contact (?:the )?(?:media|press|journalists))\b/gi,'联网比较包含立即公开的指令，违反当前披露限制。');
    }
  }
  if(new Set(result.webComparisons.map(item=>item.title.trim().toLocaleLowerCase())).size!==result.webComparisons.length)fail('同一联网案例被重复列出。');
  const {webComparisons,actionWebSources,...base}=result;
  const core=validateModelCore(base,input,context,locale,webActions);
  return {...core,webComparisons,actionWebSources};
}

export function lockWebUnspecifiedGoalActions(raw:unknown,input:NewCaseInput,locale:Locale='zh'):unknown{
  if(!needsGoalClarification(input))return raw;
  const parsed=WebModelAnalysisOutputSchema.safeParse(raw);
  if(!parsed.success)fail('AI 返回联网结构不合法或内容不完整。');
  return {...parsed.data,actionOptions:buildRuleReference(input,undefined,locale).actionOptions,actionWebSources:[]};
}
