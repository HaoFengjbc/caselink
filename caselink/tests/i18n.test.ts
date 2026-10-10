import {describe,it,expect} from 'vitest';
import {DEMO_SCENARIOS,DEMO_SCENARIOS_EN} from '../data/demo/fixtures';
import {NewCaseInputSchema,type NewCaseInput} from '../src/lib/contracts';
import {cases,evidence,resources,documents} from '../src/lib/corpus';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {retrieveCases} from '../src/lib/retrieval/match';
import {contextFor,validateModelOutput} from '../src/lib/evidence/validate';
import {analyzeInput} from '../src/lib/ai/service';
import {SYSTEM_PROMPT,systemPrompt,buildPromptData} from '../src/lib/ai/prompt';
import {EN_CONTENT,localizeCase} from '../src/lib/i18n/content';
import {inputSummary,unknownSteps} from '../src/lib/i18n/intake';
import {analysisMarkdown} from '../src/components/results/export';
import type {ServerConfig} from '../src/lib/ai/config';

const CJK=/[㐀-鿿！-｠　-〿]/;
const demoConfig:ServerConfig={mode:'demo',configured:false,key:'',model:'',timeoutMs:50000,reasoningEffort:'low',maxOutputTokens:9000} as ServerConfig;
const en=(input:NewCaseInput)=>buildRuleReference(input,retrieveCases(input,cases,'en'),'en');
const ctx=(input:NewCaseInput)=>contextFor(retrieveCases(input,cases,'en'));
const goals=['release','lawyer','conditions','drop_charges','change_judgment','other','unknown'] as const;
const pubs=['public','consent','private','unknown'] as const;

describe('English content overlay',()=>{
  it('translates every case field, evidence note, resource and author',()=>{
    for(const c of cases){
      const t=EN_CONTENT.cases[c.caseId];expect(t,c.caseId).toBeTruthy();
      for(const e of c.events)expect(t.events[e.eventId],e.eventId).toBeTruthy();
      for(const i of c.interventions)expect(t.interventions[i.interventionId]?.action,i.interventionId).toBeTruthy();
      for(const o of c.outcomes)expect(t.outcomes[o.outcomeId],o.outcomeId).toBeTruthy();
      for(const r of c.reportRecommendations)expect(t.recommendations[r.recommendationId]?.description,r.recommendationId).toBeTruthy();
      expect(t.unknowns).toHaveLength(c.unknowns.length);expect(t.conflicts).toHaveLength(c.conflicts.length);
      const l=localizeCase(c,'en');
      const shown=[l.title,l.summary,l.statusSummary,...l.events.map(e=>e.description),...l.interventions.flatMap(i=>[i.actor,i.action]),...l.outcomes.map(o=>o.description),...l.reportRecommendations.flatMap(r=>[r.actor,r.description]),...l.unknowns,...l.conflicts.map(f=>f.description)];
      expect(CJK.test(shown.join(' ')),c.caseId).toBe(false);
    }
    for(const e of evidence)expect(EN_CONTENT.evidence[e.evidenceId],e.evidenceId).toBeTruthy();
    for(const r of resources)expect(EN_CONTENT.resources[r.resourceId]?.name??r.sourceAudit?.issuer,r.resourceId).toBeTruthy();
    for(const d of documents)expect(EN_CONTENT.documents[d.documentId]?.author,d.documentId).toBeTruthy();
    expect(CJK.test(JSON.stringify(EN_CONTENT.evidence)+JSON.stringify(EN_CONTENT.resources)+JSON.stringify(EN_CONTENT.documents))).toBe(false);
  });
  it('English demo fixtures are valid fictional inputs',()=>{
    for(const s of DEMO_SCENARIOS_EN){expect(NewCaseInputSchema.safeParse(s.input).success).toBe(true);expect(s.input.isExample).toBe(true);expect(CJK.test(JSON.stringify(s))).toBe(false);}
  });
  it('summaries and gap detection work without Chinese text',()=>{
    const input=structuredClone(DEMO_SCENARIOS_EN[0].input);
    expect(CJK.test(inputSummary(input,'en').join(' '))).toBe(false);
    expect(inputSummary(DEMO_SCENARIOS[0].input,'en')[0]).toBe('Kazakhstan');
    expect(unknownSteps({...input,stage:'unknown',publicity:'unknown'})).toEqual([false,true,false,false,false,false,false,false,true]);
  });
});

describe('English rule engine',()=>{
  it('produces English-only output that passes the same validator',()=>{
    for(const scenario of [...DEMO_SCENARIOS,...DEMO_SCENARIOS_EN])for(const goal of goals)for(const publicity of pubs)for(const resourcesSet of [scenario.input.resources,['none']] as NewCaseInput['resources'][]){
      const input={...structuredClone(scenario.input),primaryGoal:goal,publicity,resources:resourcesSet};
      const output=en(input);
      expect(CJK.test(JSON.stringify(output)),`${scenario.id}/${goal}/${publicity}`).toBe(false);
      expect(()=>validateModelOutput(output,input,ctx(input),'en')).not.toThrow();
    }
  });
  it('keeps the same structure, evidence and applicability as Chinese',()=>{
    for(const scenario of DEMO_SCENARIOS)for(const goal of goals){
      const input={...structuredClone(scenario.input),primaryGoal:goal};const zh=buildRuleReference(input);const english=en(input);
      expect(english.actionOptions.map(a=>[a.actionId,a.applicability,a.basisType,a.supportingEvidenceIds,a.requiresPublicity,a.steps.length])).toEqual(zh.actionOptions.map(a=>[a.actionId,a.applicability,a.basisType,a.supportingEvidenceIds,a.requiresPublicity,a.steps.length]));
      expect(english.comparableCases.map(c=>[c.caseId,c.relevance,c.evidenceIds])).toEqual(zh.comparableCases.map(c=>[c.caseId,c.relevance,c.evidenceIds]));
      expect(english.missingInformation).toHaveLength(zh.missingInformation.length);
    }
  });
  it('rejects English output that breaks the safety rules',()=>{
    const input={...structuredClone(DEMO_SCENARIOS_EN[0].input)};
    const cases_:Array<[string,(o:ReturnType<typeof en>)=>void]>=[
      ['publicity',o=>{o.actionOptions[0].steps[0]='Immediately publish the full case to the media.';}],
      ['hidden outreach',o=>{o.actionOptions[1].steps[0]='Issue a press release with the case details.';}],
      ['guarantee',o=>{o.actionOptions[0].reason='This route guarantees she will be released.';}],
      ['deadline',o=>{o.actionOptions[0].timing='The appeal must be filed within 10 days.';}],
      ['outcome',o=>{o.limitations.push('In the end the charges were dropped.');}],
      ['UN',o=>{o.actionOptions[0].differences.push('The UN Special Rapporteur has already taken up the case.');}],
      ['Aigul',o=>{o.actionOptions[0].differences.push('Aigul won her appeal in June 2021.');}],
      ['percent',o=>{o.missingInformation.push('There is a 70 percent chance of success.');}],
    ];
    for(const [name,mutate] of cases_){const output=en(input);mutate(output);expect(()=>validateModelOutput(output,input,ctx(input),'en'),name).toThrow();}
    const negated=en(input);negated.limitations.push('Asylum does not mean the conviction was overturned.');
    expect(()=>validateModelOutput(negated,input,ctx(input),'en')).not.toThrow();
  });
});

describe('English analysis end to end',()=>{
  it('returns English presets for both the English and Chinese fixtures, tagged with the locale',async()=>{
    for(const scenario of [...DEMO_SCENARIOS_EN,...DEMO_SCENARIOS]){
      const result=await analyzeInput(scenario.input,{config:demoConfig,locale:'en'});
      expect(result.mode).toBe('preset_demo');expect(result.locale).toBe('en');
      // Immutable source snapshots retain original-language source metadata and quotes.
      const presentation={...result,sources:[],snapshot:undefined,whatsNext:undefined,legalResearch:undefined,followups:undefined,caseIssues:result.caseIssues?.map(issue=>({...issue,facts:[],authorities:issue.authorities.filter(a=>a.check!=='catalog').map(a=>({...a,quote:null}))})),nextSteps:result.nextSteps?.map(step=>({...step,history:[]})),actionOptions:result.actionOptions.map(a=>({...a,prerequisites:a.prerequisites.filter(p=>!result.legalResearch?.bindings.some(b=>b.claim===p))}))};
      expect(CJK.test(JSON.stringify(presentation))).toBe(false);
      expect(result.legalResearch?.bindings.every(b=>b.relationOrigin==='curated_rule')).toBe(true);
      expect(result.snapshot?.locale).toBe('en');
      expect(result.snapshot?.completeness).toBe('complete');
    }
    const zh=await analyzeInput(DEMO_SCENARIOS[0].input,{config:demoConfig});
    expect(zh.locale).toBeUndefined();
  });
  it('English prompt asks for English and sends English historical material',()=>{
    expect(systemPrompt('zh')).toBe(SYSTEM_PROMPT);
    expect(systemPrompt('en')).not.toContain('所有面向用户内容使用简体中文');expect(systemPrompt('en')).toContain('plain English');
    const input=DEMO_SCENARIOS_EN[1].input;const data=JSON.parse(buildPromptData(input,ctx(input),retrieveCases(input,cases,'en'),'en'));
    expect(CJK.test(JSON.stringify(data.historicalCases.map((c:{summary:string})=>c.summary)))).toBe(false);
  });
  it('exports an English Markdown plan',async()=>{
    const input=DEMO_SCENARIOS_EN[0].input;const result=await analyzeInput(input,{config:demoConfig,locale:'en'});
    const md=analysisMarkdown(result,input,'en');
    expect(md).toContain('## Sources and original evidence');expect(md).toContain('Preset demo result');expect(md).toContain(result.actionOptions[0].title);expect(md).toContain(result.legalResearch!.bindings[0].claim); // Curated legal explanations retain their reviewed source language.
  });
});
