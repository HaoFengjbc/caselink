import { cases } from '../corpus';
import { type CaseRecord, type NewCaseInput, type ModelAnalysisOutput } from '../contracts';
import { labels } from '../i18n/en';
import { countryName, countryKey } from '../i18n/content';
import type { Locale } from '../i18n/locale';

// Heuristic ordering, not empirical confidence or probability. Outcomes never enter the score.
export const MATCH_WEIGHTS = {country:2,identity:1,expression:2,stage:1,problem:2} as const;
type Dimension = keyof typeof MATCH_WEIGHTS;
const unknown = new Set(['unknown','不清楚','未知','不确定','']);
export const knownCountry = (value:string) => !unknown.has(value.trim().toLowerCase());

type MatchText = {
  dimensions: Record<Dimension, string>;
  list: string;
  sameCountry: (country: string) => string; otherCountry: (country: string) => string; unknownCountry: string;
  sameIdentity: (person: string) => string; otherIdentity: (persons: string) => string; unknownIdentity: string;
  sharedExpression: (activities: string) => string;
  sameStage: (stage: string) => string; unknownStage: string; noStage: (stage: string) => string;
  sharedProblems: (problems: string) => string;
  statusOnly: (asOf: string) => string;
};
const TEXT: Record<Locale, MatchText> = {
  zh: {
    dimensions: { country: '国家或地区', identity: '当事人身份', expression: '表达活动', stage: '历史介入阶段', problem: '现实困难' },
    list: '、',
    sameCountry: c => `同为${c}，仍需核对适用法律和时间差异。`, otherCountry: c => `历史案发生于${c}；新案所在地不同，程序与法律不能直接移用。`, unknownCountry: '新案所在地未知，未用于匹配。',
    sameIdentity: p => `资料明确记载${p}身份。`, otherIdentity: p => `历史身份为${p}；与新案身份不同。`, unknownIdentity: '新案当事人身份未知或仅填写“其他”，具体身份未用于匹配。',
    sharedExpression: a => `共同涉及${a}；具体内容和指控仍有差异。`,
    sameStage: s => `历史行动或事件中有“${s}”记录，并非使用报告最终阶段匹配。`, unknownStage: '新案程序阶段未知，未用于匹配。', noStage: s => `资料未提供同为“${s}”的行动或事件依据。`,
    sharedProblems: p => `共同记录的困难：${p}。`,
    statusOnly: d => `历史状态仅截至${d}，不是目前个案状态；记录不证明行动导致后续结果。`,
  },
  en: {
    dimensions: { country: 'Country or region', identity: 'Identity', expression: 'Expression', stage: 'Historical stage', problem: 'Difficulties' },
    list: ', ',
    sameCountry: c => `Also in ${c}; applicable law and differences in time still need checking.`, otherCountry: c => `The historical case took place in ${c}; the new case is elsewhere, so procedures and law cannot be reused directly.`, unknownCountry: 'The new case’s location is unknown and was not used for matching.',
    sameIdentity: p => `The record explicitly gives the identity “${p}”.`, otherIdentity: p => `Historical identity: ${p} — different from the new case.`, unknownIdentity: 'The new case’s identity is unknown or only “Other”, so identity was not used for matching.',
    sharedExpression: a => `Both involve ${a}; the specific content and charges still differ.`,
    sameStage: s => `The historical actions or events include a “${s}” record; matching does not use the report’s final stage.`, unknownStage: 'The new case’s stage is unknown and was not used for matching.', noStage: s => `The material has no action or event at the same “${s}” stage.`,
    sharedProblems: p => `Difficulties recorded in both: ${p}.`,
    statusOnly: d => `Historical status only runs to ${d} and is not the current status; the record does not show that any action caused later outcomes.`,
  },
};

export type MatchedCase = {record:CaseRecord; score:number; comparison:ModelAnalysisOutput['comparableCases'][number]};
export function retrieveCases(input:NewCaseInput, corpus:CaseRecord[]=cases, locale:Locale='zh',limit=3):MatchedCase[]{
  const T=TEXT[locale];const L=labels[locale];
  return corpus.map(record=>{
    let score=0;const keys:Dimension[]=[];const dimensions:string[]=[];const similarities:string[]=[];const differences:string[]=[];const ids=new Set<string>();
    const add=(key:Dimension,reason:string,evidenceIds:string[])=>{score+=MATCH_WEIGHTS[key];keys.push(key);dimensions.push(T.dimensions[key]);similarities.push(reason);evidenceIds.forEach(id=>ids.add(id));};
    const country=locale==='zh'?record.country:countryName(record.country,locale);
    if(knownCountry(input.country)){
      if(countryKey(input.country)===countryKey(record.country))add('country',T.sameCountry(country),record.evidenceIds);
      else differences.push(T.otherCountry(country));
    } else differences.push(T.unknownCountry);
    if(input.background.personType!=='unknown'&&input.background.personType!=='other'){
      if(record.personTypes.includes(input.background.personType))add('identity',T.sameIdentity(L.persons[input.background.personType]),record.evidenceIds);
      else differences.push(T.otherIdentity(record.personTypes.map(p=>L.persons[p]).join(T.list)));
    } else differences.push(T.unknownIdentity);
    const activities=input.background.activities.filter(a=>a!=='unknown'&&a!=='other'&&record.backgroundTags.includes(a));
    if(activities.length)add('expression',T.sharedExpression(activities.map(a=>L.activities[a]).join(T.list)),record.evidenceIds);
    const atStage=record.interventions.filter(i=>i.executionStatus==='implemented'&&i.stageAtAction===input.stage&&input.stage!=='unknown');
    const events=record.events.filter(e=>e.stageAtEvent===input.stage&&input.stage!=='unknown');
    if(atStage.length||events.length)add('stage',T.sameStage(L.stages[input.stage]),[...atStage.flatMap(i=>i.evidenceIds),...events.flatMap(e=>e.evidenceIds)]);
    else differences.push(input.stage==='unknown'?T.unknownStage:T.noStage(L.stages[input.stage]));
    const problems=input.currentProblems.filter(p=>!['unknown','none','other'].includes(p)&&record.problems.includes(p));
    if(problems.length)add('problem',T.sharedProblems(problems.map(p=>L.problems[p]).join(T.list)),record.evidenceIds);
    differences.push(T.statusOnly(record.lastKnownStatusAsOf));
    // A shared historical stage alone never makes a case relevant.
    const substantive=keys.some(k=>k!=='stage');
    return {record,score:substantive?score:0,comparison:{caseId:record.caseId,relevance:dimensions.length>=3&&activities.length>0?'comparable' as const:'related' as const,matchDimensions:dimensions,similarities,differences: differences.slice(0,6),evidenceIds:[...ids]}};
  }).filter(m=>m.score>0).sort((a,b)=>b.score-a.score||a.record.caseId.localeCompare(b.record.caseId)).slice(0,limit);
}
