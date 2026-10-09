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

/** English fictional inputs, shown when the interface is in English. */
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


// A fictional UK civil-expression matter. A legal threat is not labeled a proven SLAPP.
DEMO_SCENARIOS.push({id:'uk-expression-civil',title:'英国调查报道：民事诽谤威胁',description:'虚构场景：英格兰和威尔士记者收到民事索赔威胁；尚未起诉，需核对法域和覆盖不足。',input:{
 ...structuredClone(EMPTY_INPUT),country:'英国',stage:'unknown',currentProblems:['expression_restricted'],
 background:{activities:['investigation_report'],personType:'journalist',description:'【虚构演示】一名记者就公共采购发布调查报道后，收到要求撤稿并威胁提起民事诽谤诉讼的函件。尚未收到法院文件。'},primaryGoal:'lawyer',resources:['press_association'],resourceConstraints:'尚无当地律师；编辑部能整理报道依据。',priorActions:{status:'described',description:'编辑部保留了函件和报道资料，尚未对外回应。',date:''},publicity:'private',isExample:true,exampleId:'uk-expression-civil',
 intake:{version:1,jurisdiction:'england_wales',caseKind:'civil',expression:'yes',narrative:'【虚构演示】一名记者在英格兰和威尔士发布公共采购调查报道后，收到要求撤稿、道歉并威胁提起民事诽谤诉讼的律师函。尚未收到法院文件。编辑部怀疑对方试图阻止公共参与，但是否构成 SLAPP 需要当地律师核实。已保留报道依据和函件。',goalText:'',disclosureDetails:'仅内部研究；未经当事人和编辑部同意，不公开身份、不联络媒体或对方。',answers:[],facts:[],confirmed:true}
}});
DEMO_SCENARIOS_EN.push({id:'uk-expression-civil',title:'UK investigative reporting: civil defamation threat',description:'Fictional scenario: an England and Wales journalist receives a civil claim threat; no court papers, jurisdiction and coverage need checking.',input:{
 ...structuredClone(EMPTY_INPUT),country:'United Kingdom',stage:'unknown',currentProblems:['expression_restricted'],
 background:{activities:['investigation_report'],personType:'journalist',description:'[Fictional demo] After reporting on public procurement, a journalist receives a demand to remove the article and a threat of civil defamation litigation. No court papers have arrived.'},primaryGoal:'lawyer',resources:['press_association'],resourceConstraints:'No local lawyer yet; the newsroom can organize the reporting material.',priorActions:{status:'described',description:'The newsroom retained the letter and reporting material without an external response.',date:''},publicity:'private',isExample:true,exampleId:'uk-expression-civil',
 intake:{version:1,jurisdiction:'england_wales',caseKind:'civil',expression:'yes',narrative:'[Fictional demo] A journalist in England and Wales receives a lawyer letter demanding removal and an apology, with a threat of civil defamation litigation, after reporting on public procurement. No court papers have arrived. The newsroom suspects an attempt to suppress public participation, but a local lawyer must assess whether it is a SLAPP. The letter and reporting material are retained.',goalText:'',disclosureDetails:'Internal research only. Do not reveal identity or contact the media or the other party without the journalist and newsroom consent.',answers:[],facts:[],confirmed:true}
}});
