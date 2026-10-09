import type {NewCaseInput} from '../contracts';
import type {Locale} from '../i18n/locale';
import type {IntakeQuestion,FixedIntakeQuestionId} from './contracts';
import {UK_JURISDICTION_SOURCE_ID} from './sources';

export type UKJurisdiction='england_wales'|'scotland'|'northern_ireland';
export type JurisdictionRoute={isUK:boolean;jurisdiction:UKJurisdiction|'unknown'};
const normalized=(value:string)=>value.trim().toLowerCase().replace(/[.,]/g,'').replace(/\s+/g,' ');
const jurisdictions:Record<string,UKJurisdiction>={
  england_wales:'england_wales','england and wales':'england_wales',england:'england_wales',wales:'england_wales','英格兰及威尔士':'england_wales','英格兰和威尔士':'england_wales','英格兰':'england_wales','威尔士':'england_wales',
  scotland:'scotland','苏格兰':'scotland',northern_ireland:'northern_ireland','northern ireland':'northern_ireland','北爱尔兰':'northern_ireland',
};
const ukNames=new Set(['uk','united kingdom','the united kingdom','great britain','britain','英国','英国（uk）','联合王国']);
export function jurisdictionRoute(input:NewCaseInput):JurisdictionRoute{
  const country=normalized(input.country);const jurisdiction=normalized(input.intake?.jurisdiction??'');
  const answer=normalized(input.intake?.answers.find(a=>a.questionId==='uk-jurisdiction')?.answer??'');
  const isUK=!!jurisdictions[country]||!!jurisdictions[jurisdiction]||ukNames.has(country)||ukNames.has(jurisdiction);
  // A retained answer from an earlier UK draft must not route a newly selected country back to the UK.
  const concrete=isUK?(jurisdictions[jurisdiction]??jurisdictions[answer]??jurisdictions[country]):undefined;
  return {isUK,jurisdiction:concrete??'unknown'};
}

type Copy={title:string;reason:string;options:string[]};
const catalog:Record<FixedIntakeQuestionId,{zh:Copy;en:Copy;sourceIds?:string[]}>= {
  'uk-jurisdiction':{
    zh:{title:'事情主要发生在英国的哪个地区？',reason:'英国有三个不同法系，需要先区分地区。目前仅核查了这一辖区划分，尚未检索个案适用法律。',options:['英格兰及威尔士','苏格兰','北爱尔兰','涉及多个地区','不清楚']},
    en:{title:'Which part of the UK is the matter mainly connected to?',reason:'The UK has three distinct legal systems. Only this jurisdictional distinction has been checked; the law relevant to your case has not been researched.',options:['England and Wales','Scotland','Northern Ireland','More than one area','Not sure']},sourceIds:[UK_JURISDICTION_SOURCE_ID],
  },
  'case-kind':{
    zh:{title:'现有文件或经办人员如何称呼这件事？',reason:'记录已有称呼，有助于区分需要补充的信息；系统不会替你作法律分类。',options:['刑事事项','民事争议','行政事项','涉及多种事项','尚无明确称呼','不清楚']},
    en:{title:'How do existing documents or people handling the matter describe it?',reason:'Recording the description already used helps identify information gaps. The tool does not make a legal classification for you.',options:['Criminal matter','Civil dispute','Administrative matter','Mixed matters','No description yet','Not sure']},
  },
  'current-stage':{
    zh:{title:'最近已经发生了什么，或收到什么通知？',reason:'根据实际事件确认当前进展，避免仅凭法律术语推断程序阶段。',options:['刚发现问题','已向相关人员或平台了解','已收到书面回应或通知','处理仍在进行','不清楚']},
    en:{title:'What most recently happened, or what notice did you receive?',reason:'Actual events help establish the current position without inferring a procedural stage from legal terms alone.',options:['The problem was just discovered','Contacted a person or platform involved','A written response or notice was received','The matter is still being handled','Not sure']},
  },
  'latest-document':{
    zh:{title:'最近一份相关通知或文件写了什么？',reason:'只摘录文件名称、事项与要求；无需填写身份号码或私人地址，也不会由此计算法律期限。',options:['可以说明文件名称和要点','只有口头通知','尚未收到文件','不清楚']},
    en:{title:'What does the most recent relevant notice or document say?',reason:'Record its title, subject and requests, without identity numbers or private addresses. No legal deadline is calculated from this answer.',options:['I can describe the title and key points','Only a verbal notice','No document received yet','Not sure']},
  },
  'key-dates':{
    zh:{title:'哪些事件日期或文件中已经写明的日期需要记录？',reason:'区分确定日期与大概时间。这里只记录你提供的日期，不推算或确认法定期限。',options:['有明确日期','只能说明大概时间','暂时没有日期','不清楚']},
    en:{title:'Which event dates or dates already written in documents should be recorded?',reason:'Distinguish exact from approximate dates. The tool records dates you provide; it does not calculate or verify legal deadlines.',options:['Exact dates are available','Only approximate dates','No dates to record yet','Not sure']},
  },
  'representation':{
    zh:{title:'目前是否有人协助了解文件或处理这件事？',reason:'了解现有支持及其实际参与情况，避免假设已有律师或代表。',options:['已有律师协助','有其他人协助','正在寻找协助','暂时没有','不清楚']},
    en:{title:'Is anyone helping you understand the documents or handle the matter?',reason:'Identify existing support and what that person is actually doing, without assuming you already have a lawyer or representative.',options:['A lawyer is helping','Someone else is helping','Looking for help','No one at present','Not sure']},
  },
  'prior-actions':{
    zh:{title:'已经尝试了哪些做法，收到过什么回应？',reason:'把已完成、等待回应与尚未尝试区分开，避免重复建议。',options:['已采取行动且收到回应','已采取行动，正在等回应','尚未采取行动','不清楚']},
    en:{title:'What has already been tried, and what response was received?',reason:'Separate completed steps, pending responses and steps not yet taken, so later references do not simply repeat them.',options:['Action taken and a response received','Action taken; awaiting a response','No action taken yet','Not sure']},
  },
  'immediate-concerns':{
    zh:{title:'目前最影响你的具体困难是什么？',reason:'先记录现实困难和需要确认的事实，不把你的描述转换为违法或侵权结论。',options:['经济或财产损失','服务或约定未履行','难以取得记录或说明','事情仍在持续','其他困难','不清楚']},
    en:{title:'What specific difficulty is affecting you most right now?',reason:'Record practical concerns and facts to check without turning your account into a finding that the law or a right has been violated.',options:['Financial or property loss','Service or agreement not fulfilled','Difficulty obtaining records or an explanation','The situation is ongoing','Another difficulty','Not sure']},
  },
  'source-material':{
    zh:{title:'哪些描述来自亲身经历，哪些来自文件或他人转述？',reason:'保留信息来源与不确定性。无需上传文件或透露第三人的姓名。',options:['主要是亲身经历','主要来自文件','主要是他人转述','多种来源','不清楚']},
    en:{title:'Which parts come from direct experience, documents or another person’s account?',reason:'Preserve where information came from and what remains uncertain. No document upload or third-party names are needed.',options:['Mainly direct experience','Mainly documents','Mainly another person’s account','Mixed sources','Not sure']},
  },
  'goal-details':{
    zh:{title:'你希望先改善的具体事情是什么？',reason:'用自己的话说明期待的变化。这个回答不会自动替换你选择的主目标。',options:['先弄清当前情况','先获得合适协助','希望改变某项具体安排','暂时说不清楚']},
    en:{title:'What would you most like to improve first?',reason:'Describe the change you want in your own words. This answer does not automatically replace your selected primary goal.',options:['Understand the current situation','Find suitable help','Change a particular arrangement','Not sure yet']},
  },
  'disclosure-details':{
    zh:{title:'有哪些信息不希望公开，或需要先征得同意？',reason:'补充具体公开边界。系统不会据此自动修改你选择的公开意愿，也不会发送材料。',options:['不公开身份信息','任何分享前都需确认','目前不希望公开','需要与当事人核对','不清楚']},
    en:{title:'What information should stay private or needs consent before sharing?',reason:'Clarify specific boundaries. The tool does not automatically change your selected disclosure preference or send any material.',options:['Keep identifying information private','Check before any sharing','No disclosure for now','Need to check with the person','Not sure']},
  },
};

export function questionById(id:FixedIntakeQuestionId,locale:Locale):IntakeQuestion{
  const entry=catalog[id];return {id,...entry[locale],options:[...entry[locale].options],sourceIds:[...(entry.sourceIds??[])]};
}
export function availableIntakeQuestions(input:NewCaseInput,locale:Locale):IntakeQuestion[]{
  const route=jurisdictionRoute(input);const record=input.intake;
  const answered=new Set(record?.answers.filter(a=>a.answer.trim()).map(a=>a.questionId)??[]);
  const eligible:Record<FixedIntakeQuestionId,boolean>={
    'uk-jurisdiction':route.isUK&&route.jurisdiction==='unknown','case-kind':!record||record.caseKind==='unknown',
    'current-stage':input.stage==='unknown','latest-document':true,'key-dates':input.keyDates.length===0,
    representation:!input.resources.includes('lawyer'),'prior-actions':input.priorActions.status==='unknown',
    'immediate-concerns':!input.currentProblems.includes('none'),'source-material':true,
    'goal-details':(input.primaryGoal==='unknown'||input.primaryGoal==='other')&&!record?.goalText.trim(),
    'disclosure-details':(input.publicity==='unknown'||input.publicity==='consent')&&!record?.disclosureDetails.trim(),
  };
  const order:FixedIntakeQuestionId[]=['uk-jurisdiction','case-kind','current-stage','immediate-concerns','goal-details','key-dates','latest-document','representation','prior-actions','source-material','disclosure-details'];
  return order.filter(id=>eligible[id]&&!answered.has(id)).map(id=>questionById(id,locale));
}

export function selectIntakeQuestions(input:NewCaseInput,locale:Locale,questionIds?:readonly FixedIntakeQuestionId[]):IntakeQuestion[]{
  const available=availableIntakeQuestions(input,locale);
  if(!questionIds)return available.slice(0,3);
  // An unresolved UK jurisdiction is a required clarification, not a model-selected legal conclusion.
  const required=available.find(q=>q.id==='uk-jurisdiction');
  const selected=questionIds.map(id=>available.find(q=>q.id===id)).filter((q):q is IntakeQuestion=>!!q);
  return [...(required?[required]:[]),...selected.filter(q=>q.id!==required?.id)].slice(0,3);
}
