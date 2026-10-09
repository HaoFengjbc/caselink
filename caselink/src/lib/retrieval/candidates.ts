import {cases} from '../corpus';
import type {CaseRecord,NewCaseInput} from '../contracts';
import type {Locale} from '../i18n/locale';
import {narrativeForRetrieval} from '../intake/analysis';
import {retrieveCases,type MatchedCase} from './match';

export const MAX_NARRATIVE_CANDIDATES=6;
// These are recall signals, never established facts about the new case. In
// particular a mention may be negated. Outcomes and recommendations do not score.
const topics=[
  /诽谤|名誉|defamation|libel|reputation/i,
  /评论区|读者评论|用户评论|reader comments?|user comments?|subscriber comments?|contempt/i,
  /公开记录|登记|车牌|registry|register|licen[cs]e plate|public records/i,
  /抗议|示威|游行|protest|demonstration/i,
  /虚假信息|假新闻|false (?:news|information)|fake news/i,
  /恐怖|极端|terror|extremis/i,
  /洗钱|财务|金融|money laundering|financ/i,
  /侮辱|辱骂|insult|offen[cs]ive/i,
  /疫情|防疫|covid|pandemic/i,
  /网络|社交媒体|脸书|推特|online|social media|facebook|tweet|twitter/i,
];
const identitySignals=[
  {pattern:/记者|媒体|编辑|报道|journalis|reporter|editor|newsroom|reporting/i,types:['journalist'],tags:['reporting','investigation_report']},
  {pattern:/博主|博客|blogger|blogging/i,types:['blogger'],tags:[]},
  {pattern:/活动人士|行动者|activis/i,types:['activist'],tags:[]},
  {pattern:/转发|分享帖子|repost|shared? (?:a |the )?post/i,types:[],tags:['repost']},
];

/** Bounded narrative recall. The model may reject every candidate. */
export function retrieveNarrativeCandidates(input:NewCaseInput,corpus:CaseRecord[]=cases,locale:Locale='zh'):MatchedCase[]{
  const structured=retrieveCases(input,corpus,locale,corpus.length);
  const byId=new Map(structured.map(m=>[m.record.caseId,m]));
  const narrative=narrativeForRetrieval(input);
  const ranked=corpus.map(record=>{
    const match=byId.get(record.caseId);
    // Only descriptive text and tags provide keyword recall. No outcome date,
    // outcome type, success or intervention-to-outcome relationship is ranked.
    const description=[record.title,record.summary,...record.events.map(e=>e.description)].join(' ');
    let recall=topics.filter(topic=>topic.test(narrative)&&topic.test(description)).length*2;
    for(const signal of identitySignals)if(signal.pattern.test(narrative)&&(record.personTypes.some(t=>signal.types.includes(t))||record.backgroundTags.some(t=>signal.tags.includes(t))))recall++;
    const matched:MatchedCase=match??{record,score:0,comparison:{caseId:record.caseId,relevance:'related',matchDimensions:[],similarities:[],differences:[locale==='en'?'A candidate retrieved from words in your account, not a confirmed factual match. Check the original context, jurisdiction and procedural differences.':'根据叙述中的词语召回的候选，并非已确认的事实匹配；须核对原始上下文、辖区及程序差异。'],evidenceIds:record.evidenceIds}};
    return {matched,rank:(match?.score??0)*3+recall};
  });
  return ranked.filter(r=>r.rank>0).sort((a,b)=>b.rank-a.rank||a.matched.record.caseId.localeCompare(b.matched.record.caseId)).slice(0,MAX_NARRATIVE_CANDIDATES).map(r=>r.matched);
}
