import {describe,expect,it} from 'vitest';
import {EMPTY_INPUT,type NewCaseInput,ResourceSchema} from '../src/lib/contracts';
import {MechanismAssessmentSchema} from '../src/lib/legal-contracts';
import {issueSignals,selectIssueLegalRefs} from '../src/lib/issue-legal-selection';
import {buildMechanismAssessments,treatyConditions} from '../src/lib/mechanism-eligibility';
import resourcesJson from '../data/resources/resources.json';
import localJson from '../data/resources/local-rules.json';

const resources=[...resourcesJson,...localJson];
function input(country='Kazakhstan',kind:NonNullable<NewCaseInput['intake']>['caseKind']='criminal'):NewCaseInput{
 const narrative='虚构记者林川称报道公共采购后被拘押，律师尚未会面；文书未提供。';
 return {...structuredClone(EMPTY_INPUT),country,stage:'investigation',currentProblems:['detained','lawyer_access'],background:{personType:'journalist',activities:['reporting'],description:narrative},resources:['lawyer'],publicity:'private',intake:{version:1,jurisdiction:'',caseKind:kind,narrative,goalText:'整理资料给已有律师',disclosureDetails:'仅内部与指定律师分享，不向其他组织传送。',answers:[],facts:[{id:'fact-a',text:narrative,quote:narrative}],confirmed:true,expression:'yes'}};
}
const keys=(i:NewCaseInput)=>selectIssueLegalRefs(i).map(r=>r[2]);
const mechanism=(i:NewCaseInput,id:string)=>buildMechanismAssessments(i).find(m=>m.mechanismId===id)!;

function manualLiberty(narrative:string):NewCaseInput{
 const i=input();i.currentProblems=['unknown'];i.resources=[];i.stage='unknown';i.intake!.caseKind='unknown';
 i.background.description=narrative;i.intake!.narrative=narrative;i.intake!.facts=[];
 return i;
}

describe('manual narrative liberty concerns stay unverified',()=>{
 it.each(['家属称记者昨天被带走，机关和地点尚未确认。','The family says the journalist was detained yesterday.','The journalist is under arrest.'])('researches a plausible liberty issue without silently confirming detention: %s',narrative=>{
  const i=manualLiberty(narrative);const s=issueSignals(i);
  expect(s.libertyConcern).toBe(true);expect(s.detained).toBe(true);expect(s.detentionExplicit).toBe(false);
  expect(keys(i)).toEqual(expect.arrayContaining(['detention_basis_notice','detention_review']));
  expect(keys(i)).not.toContain('criminal_detention_review');expect(keys(i)).not.toContain('pretrial_detention_alternatives');
  expect(mechanism(i,'wgad-submission').conditions[0].status).toBe('unknown');
 });
 it.each(['记者没有被带走，未被拘留。','记者尚未被拘押。','当事人从未遭到拘留。','The person is not under arrest.','The person has never been detained.','The reporter was not detained.'])('does not read negation as current detention: %s',narrative=>{
  const i=manualLiberty(narrative);expect(issueSignals(i).libertyConcern).toBe(false);expect(keys(i)).not.toContain('detention_review');
 });
 it.each(['记者曾被拘押。','记者去年曾因报道被拘留，当前在家。','The journalist was previously detained.','记者被带走后已经获释。','记者已获释，不再被拘押。','The journalist was detained and was released.','The person is no longer in custody.'])('does not promote past or ended detention into a current concern: %s',narrative=>{
  const i=manualLiberty(narrative);expect(issueSignals(i).detained).toBe(false);expect(keys(i)).not.toContain('detention_review');
 });
 it('does not mistake a negated release for release, but still leaves duration unconfirmed',()=>{
  const i=manualLiberty('记者昨天被带走，目前仍未获释。');expect(issueSignals(i).libertyConcern).toBe(true);expect(issueSignals(i).detentionExplicit).toBe(false);
 });
 it('reported release invalidates a retained explicit detention flag',()=>{
  const i=manualLiberty('记者已获释，现在没有被拘押。');i.currentProblems=['detained'];
  expect(issueSignals(i).detentionExplicit).toBe(false);expect(issueSignals(i).libertyConcern).toBe(false);
 });
 it('stale historical text cannot override an explicit no-current-problem choice',()=>{
  const i=manualLiberty('记者曾被拘押，后来获释。');i.currentProblems=['none'];expect(issueSignals(i).libertyConcern).toBe(false);
 });
 it('stage confirmation alone does not turn a vague narrative into current criminal custody',()=>{
  const i=manualLiberty('家属称记者被带走，地点不清楚。');i.intake!.caseKind='criminal';i.stage='pretrial';
  expect(keys(i)).toContain('detention_review');expect(keys(i)).not.toContain('criminal_detention_review');
  i.currentProblems=['detained'];expect(keys(i)).toContain('criminal_detention_review');
 });
 it('material-item clues select research without importing source nature as independent verification',()=>{
  const i=manualLiberty('正在整理记者林川的材料。');i.intake!.materials={version:1,documents:[],selectedCaseId:'fictional',selectedCaseLabel:'虚构材料',items:[{id:'item-1',field:'restriction',text:'材料记载记者被带走，现状不明。',subject:'记者',nature:'court_finding',dateKind:'none',date:null,sources:[],uncertainty:'需核对是否当前仍拘押',status:'confirmed',originalText:'材料记载记者被带走，现状不明。'}],conflicts:[],missing:[],reviewNeeded:false,goalConfirmed:true,disclosureConfirmed:true,latestConfirmed:false};
  const s=issueSignals(i);expect(s.libertyConcern).toBe(true);expect(s.detentionExplicit).toBe(false);expect(keys(i)).toContain('detention_review');
  expect(mechanism(i,'wgad-submission').conditions[0].status).toBe('unknown');
 });
 it('possible future arrest is not present custody',()=>{
  expect(issueSignals(manualLiberty('记者担心会被拘押。')).libertyConcern).toBe(false);
 });
});

describe('What’s Next issue-bound legal references',()=>{
 it('selects only existing, audited, claim-supporting tuples and retains human-review gaps',()=>{
  for(const i of [input(),input('Tunisia'),input('England and Wales','civil')])for(const [rid,pid,key] of selectIssueLegalRefs(i)){
   const resource=ResourceSchema.parse(resources.find(r=>r.resourceId===rid));
   expect(resource.sourceAudit?.provisions.find(p=>p.provisionId===pid)?.supports).toContain(key);
   expect(resource.reviewStatus).toBe('agent_checked');expect(resource.teamReviewedAt??null).toBeNull();expect(resource.teamReviewer??null).toBeNull();
   expect(resource.sourceAudit?.legalEffect).toBeTruthy();expect(resource.sourceAudit?.translationStatus).toBeTruthy();
  }
 });
 it('selects core 19/9/14 and explanations for a new criminal detention with no example ID',()=>{
  expect(input().exampleId).toBeNull();
  expect(keys(input())).toEqual(expect.arrayContaining(['expression_restriction_test','expression_legality_test','expression_necessity_proportionality','detention_basis_notice','detention_review','pretrial_detention_alternatives','criminal_defence','kz_detention_order_copy']));
  const changed=input();changed.exampleId='invented-example';changed.isExample=true;
  expect(selectIssueLegalRefs(changed)).toEqual(selectIssueLegalRefs(input()));
 });
 it('a same-country civil matter cannot acquire criminal safeguards or the KZ criminal code',()=>{
  const civil=input('Kazakhstan','civil');civil.currentProblems=['none'];
  expect(keys(civil)).not.toContain('criminal_defence');expect(keys(civil)).not.toContain('detention_review');
  expect(selectIssueLegalRefs(civil).some(([id])=>id.startsWith('kz-'))).toBe(false);
 });
 it('does not manufacture criminal charges from unknown or mixed procedure',()=>{
  expect(keys(input('Kazakhstan','unknown'))).not.toContain('criminal_defence');
  expect(keys(input('Kazakhstan','mixed'))).not.toContain('criminal_defence');
  expect(keys(input('Kazakhstan','unknown'))).toContain('detention_review');
 });
 it('pretrial alternatives and KZ pretrial-review routes do not persist after judgment',()=>{
  const i=input();i.stage='postjudgment';
  expect(keys(i)).not.toContain('pretrial_detention_alternatives');expect(keys(i)).not.toContain('kz_detention_review');
 });
 it('EAW defamation rules need the precise legal system, civil procedure and an actual defamation issue',()=>{
  const i=input('United Kingdom','civil');i.intake!.jurisdiction='england_wales';i.currentProblems=['expression_restricted'];
  i.intake!.narrative=i.background.description='虚构作者收到诽谤律师函，涉及公共采购报道，尚未收到法院文件。';i.intake!.facts=[];
  expect(keys(i)).toEqual(expect.arrayContaining(['ew_serious_harm','ew_public_interest_defence','ew_preaction_response','defamation_safeguards']));
  expect(keys(i)).not.toContain('criminal_defence');expect(keys(i)).not.toContain('detention_review');
  i.intake!.jurisdiction='scotland';expect(selectIssueLegalRefs(i).some(([id])=>id.startsWith('ew-'))).toBe(false);
  i.intake!.jurisdiction='england_wales';i.intake!.narrative=i.background.description='虚构记者申请租约解除。';i.intake!.facts=[];
  expect(selectIssueLegalRefs(i).some(([id])=>id.startsWith('ew-'))).toBe(false);
 });
 it('civil hearing safeguards require a court stage and do not turn a letter into a proceeding',()=>{
  const i=input('United Kingdom','civil');i.currentProblems=['none'];
  expect(keys(i)).not.toContain('civil_fair_hearing');i.stage='trial';expect(keys(i)).toContain('civil_fair_hearing');
 });
 it('private platform notices get fact collection rather than asserted treaty violations',()=>{
  expect(selectIssueLegalRefs(input('Kazakhstan','platform'))).toEqual([]);
  expect(buildMechanismAssessments(input('Kazakhstan','platform'))).toEqual([]);
 });
 it('non-covered jurisdictions can still obtain conditional international research',()=>{
  const i=input('Uruguay');expect(keys(i)).toContain('detention_review');
  expect(selectIssueLegalRefs(i).some(([id])=>id.startsWith('kz-')||id.startsWith('tn-'))).toBe(false);
 });
});

describe('independent international-mechanism conditions',()=>{
 it('validates every mechanism and never announces admissibility',()=>{
  for(const country of ['Kazakhstan','Tunisia','United Kingdom','Hong Kong','China','Malaysia','Belarus','Russia','Uruguay']){
   for(const m of buildMechanismAssessments(input(country))){expect(MechanismAssessmentSchema.safeParse(m).success).toBe(true);expect(m.state).not.toBe('preliminary');expect(m.conditions.some(c=>c.status==='unknown')).toBe(true);}
  }
 });
 it('ICCPR participation does not give the UK OP1 competence or domestic direct effect',()=>{
  const i=input('United Kingdom');expect(treatyConditions(i)[0].status).toBe('confirmed');expect(treatyConditions(i)[2].status).toBe('unknown');
  expect(mechanism(i,'hrc-individual-communications').conditions[0].status).toBe('not_met');
 });
 it('handles Hong Kong separately from mainland China without inventing OP1 territorial coverage',()=>{
  expect(treatyConditions(input('Hong Kong'))[0].status).toBe('confirmed');
  expect(treatyConditions(input('China'))[0].status).toBe('not_met');
  expect(mechanism(input('Hong Kong'),'hrc-individual-communications').conditions[0].status).toBe('not_met');
 });
 it('non-parties and unknown states are not confirmed by topic similarity',()=>{
  expect(treatyConditions(input('Malaysia'))[0].status).toBe('not_met');
  expect(treatyConditions(input('Uruguay'))[0].status).toBe('unknown');
  expect(mechanism(input('Uruguay'),'hrc-individual-communications').conditions[0].status).toBe('unknown');
 });
 it('keeps Belarus withdrawal separate from continuing Covenant participation and old pending communications',()=>{
  const i=input('Belarus');expect(treatyConditions(i)[0].status).toBe('confirmed');
  const h=mechanism(i,'hrc-individual-communications');expect(h.conditions[0].status).toBe('not_met');
  expect(JSON.stringify(h)).toContain('2023-02-08');expect(JSON.stringify(h)).toContain('旧提交另核');
 });
 it('does not inherit HRC exhaustion or treaty gates for general Special Procedures',()=>{
  const sp=mechanism(input('China'),'ohchr-special-procedures');expect(sp.conditions[0].status).toBe('confirmed');
  expect(sp.conditions[0].detail).toContain('不以两者为共同前提');
  expect(sp.conditions.find(c=>c.label.includes('可信详细事实'))?.status).toBe('unknown');
 });
 it('WGAD requires deprivation of liberty and uses its own urgent-action conditions',()=>{
  const civil=input('United Kingdom','civil');civil.currentProblems=['none'];
  const wg=mechanism(civil,'wgad-submission');expect(wg.conditions[0].status).toBe('not_met');
  expect(JSON.stringify(wg)).toContain('紧急呼吁不预断');expect(JSON.stringify(wg)).toContain('独立工作方法');
 });
 it('retains exact disclosure limits; public preference and existing counsel do not supply consent',()=>{
  const i=input();const h=mechanism(i,'hrc-individual-communications');
  expect(h.conditions.find(c=>c.label.includes('提交授权'))?.status).toBe('not_met');
  expect(JSON.stringify(h)).toContain(i.intake!.disclosureDetails);
  i.publicity='public';i.intake!.disclosureDetails='希望公开表达关切。';
  const sp=mechanism(i,'ohchr-special-procedures');
  expect(sp.conditions.filter(c=>/提交授权|披露姓名/.test(c.label)).every(c=>c.status==='unknown')).toBe(true);
 });
 it('non-public preference alone does not rule out all internal mechanism research',()=>{
  const i=input();i.intake!.disclosureDetails='不公开姓名，具体机制和材料待律师讨论。';
  expect(mechanism(i,'ohchr-special-procedures').state).toBe('unknown');
 });
 it('regional references identify their own treaty and Russia event-time boundary',()=>{
  const ru=mechanism(input('Russia'),'ecthr-applicants');expect(JSON.stringify(ru)).toContain('2022-09-16');expect(JSON.stringify(ru)).toContain('不是ICCPR法院');
  expect(buildMechanismAssessments(input('Kazakhstan')).some(m=>m.mechanismId==='ecthr-applicants')).toBe(false);
 });
});
