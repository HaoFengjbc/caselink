import { EMPTY_INPUT, type NewCaseInput } from '../../src/lib/contracts';

/** Entirely fictional intakes. These are never inserted into the historical corpus. */
export const DEMO_SCENARIOS: Array<{id:string; title:string; description:string; input:NewCaseInput}> = [
  {id:'journalist-private-release', title:'记者受限：先私下争取释放', description:'虚构场景：哈萨克斯坦记者候审并被拘押，已有律师，先私下处理。', input:{
    ...structuredClone(EMPTY_INPUT), country:'哈萨克斯坦', stage:'pretrial', currentProblems:['detained','expression_restricted'],
    background:{activities:['investigation_report','social_media'],personType:'journalist',description:'【虚构演示】一名调查记者在发布公共事务报道后受到刑事指控，现被拘押候审。具体法条与拘押文书需要律师核实。'},
    primaryGoal:'release', keyDates:[{date:'未来两周内，具体日期待确认',event:'拟进行下一次程序审查',approximate:true}], resources:['lawyer'],resourceConstraints:'仅有一名本地律师，尚未确定国际合作资源。',
    priorActions:{status:'described',description:'律师已要求取得拘押决定副本，尚未收到书面回应。',date:''},publicity:'private',isExample:true,exampleId:'journalist-private-release'
  }},
  {id:'blogger-public-charges',title:'博主被诉：考虑公开倡导',description:'虚构场景：突尼斯博主因转发内容受审，希望停止起诉，可考虑公开。',input:{
    ...structuredClone(EMPTY_INPUT),country:'突尼斯',stage:'trial',currentProblems:['threats','expression_restricted'],
    background:{activities:['social_media','repost'],personType:'blogger',description:'【虚构演示】一名博主因转发公共议题讽刺内容受到起诉，庭审正在进行。收到网络威胁，尚未获知终局判决。'},
    primaryGoal:'drop_charges',keyDates:[],resources:['lawyer','local_ngo'],resourceConstraints:'当地公益组织可协助材料整理，但没有确认媒体合作方。',
    priorActions:{status:'none',description:'',date:''},publicity:'public',isExample:true,exampleId:'blogger-public-charges'
  }}
];

/** The same two fictional cases written in English, shown when the interface is in English. */
export const DEMO_SCENARIOS_EN: Array<{id:string; title:string; description:string; input:NewCaseInput}> = [
  {id:'journalist-private-release', title:'Journalist detained: seek release privately first', description:'Fictional scenario: a journalist in Kazakhstan is detained awaiting trial, has a lawyer, and wants to handle things privately first.', input:{
    ...structuredClone(EMPTY_INPUT), country:'Kazakhstan', stage:'pretrial', currentProblems:['detained','expression_restricted'],
    background:{activities:['investigation_report','social_media'],personType:'journalist',description:'[Fictional demo] An investigative journalist faces criminal charges after publishing a report on public affairs and is detained awaiting trial. The exact charges and detention documents need to be checked by a lawyer.'},
    primaryGoal:'release', keyDates:[{date:'Within two weeks, date TBC',event:'Planned next procedural review',approximate:true}], resources:['lawyer'],resourceConstraints:'Only one local lawyer; no international partners confirmed yet.',
    priorActions:{status:'described',description:'The lawyer has requested a copy of the detention decision; no written response yet.',date:''},publicity:'private',isExample:true,exampleId:'journalist-private-release'
  }},
  {id:'blogger-public-charges',title:'Blogger charged: consider public advocacy',description:'Fictional scenario: a blogger in Tunisia is on trial over shared content, wants the prosecution stopped, and is open to going public.',input:{
    ...structuredClone(EMPTY_INPUT),country:'Tunisia',stage:'trial',currentProblems:['threats','expression_restricted'],
    background:{activities:['social_media','repost'],personType:'blogger',description:'[Fictional demo] A blogger is prosecuted for sharing satirical content about a public issue, and the trial is ongoing. They have received online threats; no final judgment is known yet.'},
    primaryGoal:'drop_charges',keyDates:[],resources:['lawyer','local_ngo'],resourceConstraints:'A local NGO can help organize material, but no media partner is confirmed.',
    priorActions:{status:'none',description:'',date:''},publicity:'public',isExample:true,exampleId:'blogger-public-charges'
  }}
];
