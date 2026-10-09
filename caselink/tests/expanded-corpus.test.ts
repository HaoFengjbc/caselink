import {describe,it,expect} from 'vitest';
import {cases,documents,evidence} from '../src/lib/corpus';
import {EMPTY_INPUT,type NewCaseInput} from '../src/lib/contracts';
import {countryKey,countryName,localizeCase} from '../src/lib/i18n/content';
import {retrieveCases} from '../src/lib/retrieval/match';
import {retrieveNarrativeCandidates,MAX_NARRATIVE_CANDIDATES} from '../src/lib/retrieval/candidates';
import {supportedHistoricalOutcome,mentionsCase} from '../src/lib/evidence/historical-claims';
import {evidenceSourceLink,sourceFormatNote} from '../src/lib/evidence/source-links';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {contextFor,validateModelOutput} from '../src/lib/evidence/validate';

const input=(country:string,narrative:string):NewCaseInput=>({...structuredClone(EMPTY_INPUT),country,intake:{version:1,jurisdiction:'',caseKind:'unknown',narrative,goalText:'',disclosureDetails:'',facts:[],answers:[],confirmed:true}});

describe('expanded reviewed corpus',()=>{
  it('imports all unique source hashes without merging distinct proceedings',()=>{
    expect(documents).toHaveLength(21);expect(new Set(documents.map(d=>d.hash)).size).toBe(21);
    expect(cases).toHaveLength(22);expect(new Set(cases.map(c=>c.country)).size).toBe(14);
    const radi=cases.filter(c=>c.caseId.startsWith('omar-radi'));
    expect(radi).toHaveLength(2);expect(radi[0].sourceDocumentIds).not.toEqual(radi[1].sourceDocumentIds);
    const pakistan=cases.filter(c=>c.country==='巴基斯坦');expect(pakistan).toHaveLength(2);
    expect(new Set(pakistan.flatMap(c=>c.sourceDocumentIds)).size).toBe(1);
  });
  it('maps every corpus country between both languages and retrieves its own records',()=>{
    for(const c of cases){const en=countryName(c.country,'en');expect(countryKey(en)).toBe(c.country);
      const matches=retrieveCases(input(en,''));expect(matches.some(m=>m.record.country===c.country)).toBe(true);
    }
    expect(countryKey('Hong Kong')).toBe('中国香港');expect(countryKey('Türkiye')).toBe('土耳其');
  });
  it('retrieves by a free account with bounded context and no invented match dimensions',()=>{
    const record=input('United Kingdom','An editor was challenged about reader comments and contempt on an online news platform.');
    const candidates=retrieveNarrativeCandidates(record);
    expect(candidates.length).toBeLessThanOrEqual(MAX_NARRATIVE_CANDIDATES);
    expect(candidates.some(m=>m.record.caseId==='malaysiakini-steven-gan')).toBe(true);
    expect(candidates.every(m=>m.comparison.matchDimensions.length===0)).toBe(true);
    const changed=cases.map(c=>({...structuredClone(c),outcomes:[],reportRecommendations:[]}));
    expect(retrieveNarrativeCandidates(record,changed).map(m=>m.record.caseId)).toEqual(candidates.map(m=>m.record.caseId));
    expect(retrieveNarrativeCandidates(input('unknown',''))).toEqual([]);
  });
  it('requires a whole curated outcome sentence and an outcome-owned citation',()=>{
    const record=structuredClone(cases[0]);const ref=structuredClone(evidence.find(e=>e.caseId===record.caseId&&e.reviewStatus==='verified')!);
    record.outcomes=[{outcomeId:'test-reviewed-outcome',caseId:record.caseId,description:'The editor Steven Gan was acquitted.',type:'specific',observedDate:{value:null,precision:'unknown',originalText:''},statusAsOf:'2021-10',evidenceIds:[ref.evidenceId]}];
    const check=(text:string,refs=[ref])=>supportedHistoricalOutcome(text,text.indexOf('was'), 'was acquitted',[record],refs,'zh');
    expect(check('The editor Steven Gan was acquitted.')).toBe(true);
    expect(check('The editor Steven Gan was acquitted.',[])).toBe(false);
    expect(check('The organization Malaysiakini was acquitted.')).toBe(false);
    expect(check('Because of advocacy the editor Steven Gan was acquitted.')).toBe(false);
    expect(check('The editor Steven Gan was acquitted in 2026.')).toBe(false);
    expect(check('The editor Steven Gan was acquitted.',[{...ref,caseId:'other-case'}])).toBe(false);
  });
  it('does not conflate two proceedings because they share the same first name',()=>{
    const radi=cases.filter(c=>c.caseId.startsWith('omar-radi'));
    expect(mentionsCase('Omar experienced different proceedings.',radi[0],radi)).toBe(false);
    for(const c of radi)expect(mentionsCase('Omar Radi received a suspended sentence in March 2020.',c,radi)).toBe(false);
    expect(mentionsCase(radi[0].title,radi[0],radi)).toBe(true);
    expect(mentionsCase(radi[1].title,radi[1],radi)).toBe(true);
  });
  it('accepts cited curated outcomes but rejects same-case subject swaps and fabricated causes',()=>{
    const record=cases.find(c=>c.caseId==='malaysiakini-steven-gan')!;
    const request=input('Malaysia','Fictional platform received a notice about reader comments.');request.primaryGoal='other';request.intake!.goalText='Prepare a record for the lawyer.';
    const matches=retrieveCases(request);const context=contextFor(matches);
    for(const locale of ['zh','en'] as const){
      const gan=localizeCase(record,locale).outcomes.find(o=>/Steven Gan/.test(o.description))!;
      const output=buildRuleReference(request,[],locale);
      output.comparableCases=[{caseId:record.caseId,relevance:'related',matchDimensions:[],similarities:[],differences:[gan.description],evidenceIds:gan.evidenceIds}];
      expect(()=>validateModelOutput(output,request,context,locale)).not.toThrow();
      const bad=locale==='zh'?['Malaysiakini被判无罪。','Malaysiakini获判无罪，众筹使该机构免于定罪。']:['Malaysiakini was acquitted.','Not only was Malaysiakini acquitted, but the charges were dropped.'];
      bad.push((locale==='zh'?'公众压力造成了该结果；':'Public pressure caused the outcome; ')+gan.description);
      for(const text of bad){const changed=structuredClone(output);changed.comparableCases[0].differences=[text];expect(()=>validateModelOutput(changed,request,context,locale)).toThrow();}
    }
  });
  it('keeps webpage-print pagination separate from official PDF navigation',()=>{
    const doc=documents.find(d=>d.sourceFormat==='web_print')!;expect(doc).toBeTruthy();
    const ref=evidence.find(e=>e.documentId===doc.documentId)!;
    expect(evidenceSourceLink(ref)).toBe(doc.sourceUrl);expect(evidenceSourceLink(ref)).not.toContain('#page=');
    expect(sourceFormatNote(ref,'en')).toContain('archived web-page printout');
    const pdf=evidence.find(e=>e.documentId!==doc.documentId)!;expect(evidenceSourceLink(pdf)).toContain(`#page=${pdf.pdfPage}`);
  });
});
