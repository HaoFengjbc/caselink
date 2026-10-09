import {describe,it,expect} from 'vitest';
import {EMPTY_INPUT,type NewCaseInput} from '../src/lib/contracts';
import {hasDisclosureNotes} from '../src/lib/intake/analysis';
import {contextFor,validateModelOutput} from '../src/lib/evidence/validate';
import {buildRuleReference} from '../src/lib/retrieval/rules';

function draft(narrative='The editor was acquitted while the organization was convicted.'):NewCaseInput{
  return {...structuredClone(EMPTY_INPUT),country:'United Kingdom',primaryGoal:'other',publicity:'public',intake:{version:1,jurisdiction:'england_wales',caseKind:'unknown',narrative,goalText:'Organize the records.',disclosureDetails:'',answers:[],facts:[],confirmed:true}};
}
const outputFor=(input:NewCaseInput)=>buildRuleReference(input,[],'en');

describe('specific disclosure notes remain conservative',()=>{
  it('does not treat positive-sounding free text as machine-understood consent',()=>{
    const input=draft();input.intake!.disclosureDetails='Sharing is fine, subject to the arrangement we discussed.';
    expect(hasDisclosureNotes(input)).toBe(true);
    const output=outputFor(input);Object.assign(output.actionOptions[0],{requiresPublicity:true,applicability:'priority'});
    expect(()=>validateModelOutput(output,input,contextFor([]),'en')).toThrow(/披露/);
  });
  it.each([true,false])('does not permit prohibited steps through requiresPublicity=%s or defer labels',requiresPublicity=>{
    const input=draft();input.intake!.answers=[{questionId:'disclosure-details',question:'Boundaries?',answer:'Keep names private; do not contact the media.'}];
    for(const step of ['Contact the media and publish the names.','联系媒体并公开姓名。']){
      const output=outputFor(input);Object.assign(output.actionOptions[0],{requiresPublicity,applicability:'defer'});output.actionOptions[0].steps[0]=step;
      expect(()=>validateModelOutput(output,input,contextFor([]),'en')).toThrow(/公开|披露/);
    }
  });
  it('adds an idempotent scope checklist to a safe deferred preparation card',()=>{
    const input=draft();input.intake!.disclosureDetails='Any sharing needs confirmation with the person.';
    const output=outputFor(input);Object.assign(output.actionOptions[0],{requiresPublicity:true,applicability:'defer'});
    const first=validateModelOutput(output,input,contextFor([]),'en');const second=validateModelOutput(first,input,contextFor([]),'en');
    expect(second).toEqual(first);expect(first.actionOptions[0].prerequisites[0]).toContain('exactly what may be shared');
    expect(first.limitations[0]).toContain('not established that it fully understands');
    expect(first.actionOptions[0].prerequisites.filter(text=>text.includes('First review every disclosure note'))).toHaveLength(1);
  });
});

describe('user outcome attribution is narrow and subject-preserving',()=>{
  it('allows supported Chinese and English user accounts including material in answers',()=>{
    for(const [narrative,claim] of [['The editor was acquitted while the organization was convicted.','Your account says the editor was acquitted while the organization was convicted.'],['该编辑已被宣告无罪，而机构被定罪。','根据你的描述，该编辑已被宣告无罪。']]){
      const input=draft(narrative);const output=outputFor(input);output.actionOptions[0].reason=claim;
      expect(()=>validateModelOutput(output,input,contextFor([]),'en')).not.toThrow();
      input.intake!.narrative='The documents are available.';input.intake!.answers=[{questionId:'latest-document',question:'Document?',answer:narrative}];
      expect(()=>validateModelOutput(output,input,contextFor([]),'en')).not.toThrow();
    }
  });
  it('rejects swapped subjects, invented outcomes, un-attributed claims and claims across a sentence boundary',()=>{
    const input=draft();
    for(const claim of ['Your account says the organization was acquitted.','Your account says the defendant was fully released.','The editor was acquitted.','Your account says the documents exist; the editor was acquitted.','Your account says the editor was acquitted. Emna Chargui was acquitted.']){
      const output=outputFor(input);output.actionOptions[0].reason=claim;
      expect(()=>validateModelOutput(output,input,contextFor([]),'en'),claim).toThrow();
    }
    const negative=draft('The editor was not acquitted.');const output=outputFor(negative);output.actionOptions[0].reason='Your account says the editor was acquitted.';
    expect(()=>validateModelOutput(output,negative,contextFor([]),'en')).toThrow();
  });
  it('does not extend the user-outcome exception to deadlines or guarantees',()=>{
    for(const claim of ['Your account says you must file within 14 days.','Your account says the lawyer guarantees success.']){
      const input=draft(claim);const output=outputFor(input);output.actionOptions[0].reason=claim;
      expect(()=>validateModelOutput(output,input,contextFor([]),'en')).toThrow();
    }
  });
});

describe('confirmed narratives and legacy lawyer-resource choices',()=>{
  it('does not downgrade ordinary review just because its title mentions an existing lawyer',()=>{
    for(const locale of ['zh','en'] as const){
      const input=draft(locale==='en'?'I have instructed a lawyer to review the demand letter.':'我已委托律师审阅这封来函。');const original=structuredClone(input);
      const output=buildRuleReference(input,[],locale);Object.assign(output.actionOptions[0],{title:locale==='en'?'Organize the letter with the instructed lawyer':'与已委托律师核对来函和讨论要点',applicability:'priority'});
      const result=validateModelOutput(output,input,contextFor([]),locale);expect(result.actionOptions[0].applicability).toBe('priority');expect(input).toEqual(original);expect(input.resources).toEqual([]);
      expect(result.actionOptions[0].prerequisites).toEqual(output.actionOptions[0].prerequisites);
      expect(validateModelOutput(result,input,contextFor([]),locale)).toEqual(result);
    }
  });
  it('keeps the previous rejection for legacy input and explicit no-support selections',()=>{
    const legacy=draft();delete legacy.intake;legacy.primaryGoal='lawyer';
    const none=draft();none.resources=['none'];
    for(const input of [legacy,none]){
      const output=outputFor(input);Object.assign(output.actionOptions[0],{title:'File a court claim',applicability:'priority'});
      expect(()=>validateModelOutput(output,input,contextFor([]),'en')).toThrow(/法律支持/);
    }
  });
  it('does not alter the server template for an unspecified goal',()=>{
    const input=draft();input.primaryGoal='unknown';input.intake!.goalText='';const output=buildRuleReference(input,undefined,'en');
    expect(validateModelOutput(output,input,contextFor([]),'en').actionOptions).toEqual(output.actionOptions);
  });
});
