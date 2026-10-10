import {describe,it,expect,vi,afterEach} from 'vitest';
import {EMPTY_INPUT,NewCaseInputSchema,AnalysisResultSchema,type NewCaseInput} from '../src/lib/contracts';
import {MaterialResponseSchema,type MaterialResponse} from '../src/lib/materials/contracts';
import {applyMaterialCandidate,removeMaterialFile,updateMaterialItem,deleteMaterialItem,resolveMaterialConflict,materialQuestions,materialReviewErrors,confirmMaterials,resolveMaterialDateReview} from '../src/lib/materials/integration';
import {analyzeInput} from '../src/lib/ai/service';
import {analysisMarkdown} from '../src/components/results/export';
import {workPackMarkdown} from '../src/components/results/work-pack';
import {buildResearchQuery} from '../src/lib/research/query';
import {availableIntakeQuestions} from '../src/lib/intake/questions';

export const extracted=():MaterialResponse=>MaterialResponseSchema.parse({mode:'live_ai',warnings:[],documents:[{fileId:'pdf-fixture-1',filename:'fictional-letter.pdf',size:2500,pageCount:1,processedPages:[1],unreadablePages:[],omittedPages:[],warnings:[],pages:[{pdfPage:1,text:'The fictional company alleges that reporter Morgan Vale published an inaccurate article. Case in England and Wales. Letter dated 2024-05-10. Reply requested by 2024-05-20.',status:'read',printedPage:null}]}],candidates:[{id:'case-fixture',label:'Fictional Morgan Vale publication dispute',prefill:{country:'United Kingdom',jurisdiction:'england_wales',caseKind:'civil',expression:'yes',stage:'pretrial',personType:'journalist'},items:[{id:'fact-allegation',field:'claim',text:'The company alleges inaccurate reporting.',subject:'Fictional company',nature:'allegation',dateKind:'none',date:null,sources:[{fileId:'pdf-fixture-1',filename:'fictional-letter.pdf',pdfPage:1,printedPage:null,quote:'The fictional company alleges that reporter Morgan Vale published an inaccurate article.',method:'embedded_text'}],uncertainty:null,status:'extracted',originalText:'The company alleges inaccurate reporting.'}],conflicts:[],missing:[]}]});
const ready=()=>{let input=applyMaterialCandidate(structuredClone(EMPTY_INPUT),extracted(),'case-fixture');input={...input,publicity:'private',intake:{...input.intake,goalText:'Prepare an internal chronology for the instructed lawyer.',disclosureDetails:'Only share de-identified excerpts with the instructed lawyer.',materials:{...input.intake.materials!,goalConfirmed:true,disclosureConfirmed:true}}};return confirmMaterials(input);};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

describe('PDF intake uses one case record and immutable source evidence',()=>{
 it('prefills without a handwritten narrative; document stage is not promoted to current status',()=>{
  const input=applyMaterialCandidate(structuredClone(EMPTY_INPUT),extracted(),'case-fixture');
  expect(input).toMatchObject({country:'United Kingdom',stage:'unknown',intake:{narrative:'',jurisdiction:'england_wales',caseKind:'civil',expression:'yes',confirmed:false}});
  expect(input.intake.materials?.items).toHaveLength(1);expect(input.intake.facts[0].materialItemId).toBe('fact-allegation');
  // Only the user's present goal and sharing choice are required; the document supplies neither.
  expect(materialReviewErrors(input)).toHaveLength(2);expect(()=>confirmMaterials(input)).toThrow();
  expect(NewCaseInputSchema.safeParse({...input,intake:{...input.intake,confirmed:true}}).success).toBe(false);
  const minimal={...input,publicity:'private' as const,intake:{...input.intake,goalText:'Understand the procedure.'}};
  expect(materialReviewErrors(minimal)).toEqual([]);
  const confirmed=confirmMaterials(minimal);
  expect(confirmed.intake.materials).toMatchObject({reviewNeeded:false,goalConfirmed:true,disclosureConfirmed:true,latestConfirmed:false});
  expect(confirmed.intake.disclosureDetails).toBe('');expect(NewCaseInputSchema.safeParse(confirmed).success).toBe(true);
 });
 it('asks only useful material gaps; goal and disclosure cannot be inferred from prior public advocacy',()=>{
  let input=applyMaterialCandidate(structuredClone(EMPTY_INPUT),extracted(),'case-fixture');
  expect(availableIntakeQuestions(input,'en').map(q=>q.id)).toContain('goal-details');
  expect(availableIntakeQuestions(input,'en').map(q=>q.id)).toContain('disclosure-details');
  expect(materialQuestions(input,'en').map(q=>q.id)).not.toEqual(expect.arrayContaining(['case-kind','latest-document','source-material','uk-jurisdiction']));
  input=ready();expect(materialQuestions(input,'en').map(q=>q.id)).not.toContain('goal-details');
  expect(materialQuestions(input,'en').map(q=>q.id)).not.toContain('disclosure-details');
  const question=materialQuestions(input,'en')[0];input.intake.answers.push({questionId:question.id,question:question.title,answer:'Not sure'});
  expect(materialQuestions(input,'en')).toHaveLength(0);
 });
 it('edited notes never replace quotes, survive incremental extraction, and cannot keep a removed source',()=>{
  let input=updateMaterialItem(ready(),'fact-allegation','User clarification: allegation is disputed.');
  expect(input.intake.facts[0].text).toContain('User clarification');
  expect(input.intake.materials!.items[0].sources[0].quote).toContain('alleges');
  input=applyMaterialCandidate(input,extracted(),'case-fixture');expect(input.intake.materials!.items).toHaveLength(1);expect(input.intake.materials!.items[0].status).toBe('edited');
  input=removeMaterialFile(input,'pdf-fixture-1');expect(input.intake.facts).toHaveLength(0);expect(input.intake.materials!.items).toHaveLength(0);expect(input.intake.confirmed).toBe(false);
  expect(input.intake.goalText).toContain('internal chronology');
 });
 it('keeps both accounts of an unchosen conflict, records a one-click choice, and drops a conflict whose side is deleted',()=>{
  const result=extracted(),candidate=result.candidates[0];candidate.items.push({...structuredClone(candidate.items[0]),id:'second-claim',text:'The reporter disputes that allegation.',originalText:'The reporter disputes that allegation.',nature:'party_statement'});
  candidate.conflicts=[{id:'conflict-fixture',description:'Company and reporter disagree.',itemIds:['fact-allegation','second-claim'],resolution:null}];
  let input=applyMaterialCandidate(structuredClone(EMPTY_INPUT),result,'case-fixture');
  input={...input,publicity:'private',intake:{...input.intake,goalText:'Understand the procedure.'}};
  expect(materialReviewErrors(input)).toEqual([]);
  const kept=confirmMaterials(input,'en');
  expect(kept.intake.materials!.conflicts[0].resolution).toBe('Both accounts kept; to be verified.');expect(kept.intake.materials!.items).toHaveLength(2);
  expect(NewCaseInputSchema.safeParse(kept).success).toBe(true);
  expect(confirmMaterials(input).intake.materials!.conflicts[0].resolution).toBe('两种说法都保留，待核实。');
  input=resolveMaterialConflict(input,'conflict-fixture','Use account 2: The reporter disputes that allegation. (p. 1)');
  expect(confirmMaterials(input,'en').intake.materials!.conflicts[0].resolution).toBe('Use account 2: The reporter disputes that allegation. (p. 1)');
  expect(resolveMaterialConflict(input,'conflict-fixture','').intake.materials!.conflicts[0].resolution).toBeNull();
  expect(input.intake.materials!.items).toHaveLength(2);
  input=deleteMaterialItem(input,'second-claim');expect(input.intake.materials!.conflicts).toHaveLength(0);
 });
 it('requires an explicit candidate and keeps another case out',()=>{
  const result=extracted();result.candidates.push({...structuredClone(result.candidates[0]),id:'unrelated-case',label:'Unrelated matter',items:[{...structuredClone(result.candidates[0].items[0]),id:'unrelated-fact',text:'Unrelated matter.'}]});
  expect(()=>applyMaterialCandidate(structuredClone(EMPTY_INPUT),result,'')).toThrow();
  const input=applyMaterialCandidate(structuredClone(EMPTY_INPUT),result,'case-fixture');expect(JSON.stringify(input)).not.toContain('Unrelated matter');
 });
 it('keeps a date flagged by an older version unknown at confirmation and freezes that in the report snapshot',async()=>{
  const result=extracted(),ordinary=result.candidates[0].items[0];
  result.candidates[0].items.push({...structuredClone(ordinary),id:'date-needs-review',field:'date',dateKind:'document',date:null,text:'Date needs review; AI draft not adopted.',originalText:'Date needs review; AI draft not adopted.',uncertainty:'Review the original date.',dateReview:{reason:'date_mismatch',resolution:null},sources:[{...ordinary.sources[0],quote:'Letter dated 2024-05-10.'}]});
  let input=applyMaterialCandidate(ready(),result,'case-fixture');
  expect(input.intake.facts.map(f=>f.materialItemId)).not.toContain('date-needs-review');expect(materialReviewErrors(input,'en')).toEqual([]);
  const bypass=structuredClone(input);bypass.intake.confirmed=true;bypass.intake.materials!.reviewNeeded=false;
  expect(NewCaseInputSchema.safeParse(bypass).success).toBe(false);
  // Where the date question is still offered (classic questionnaire), an explicit note remains possible.
  expect(()=>resolveMaterialDateReview(input,'date-needs-review','reviewed','')).toThrow();
  const reviewed=resolveMaterialDateReview(input,'date-needs-review','reviewed','The document date is 10 May; receipt date is still unknown.','en');
  expect(reviewed.intake.materials!.items.find(i=>i.id==='date-needs-review')).toMatchObject({status:'edited',date:null,text:'The document date is 10 May; receipt date is still unknown.',dateReview:{resolution:'reviewed'}});
  input=confirmMaterials(input,'en');expect(NewCaseInputSchema.safeParse(input).success).toBe(true);
  const item=input.intake.materials!.items.find(i=>i.id==='date-needs-review')!;
  expect(item).toMatchObject({date:null,dateReview:{resolution:'unknown'}});expect(item.sources[0].quote).toBe('Letter dated 2024-05-10.');
  expect(input.intake.facts.map(f=>f.materialItemId)).toContain('date-needs-review');
  const report=await analyzeInput(input,{forceRule:true,locale:'en'});
  expect(report.snapshot?.uploadedMaterials?.items.find(i=>i.id===item.id)?.dateReview?.resolution).toBe('unknown');
  expect(analysisMarkdown(report,input,'en')).toContain('Explicitly retained as unknown');
 });
 it('generates action references through the existing rule flow with a frozen private-source snapshot',async()=>{
  const input=ready(),result=await analyzeInput(input,{forceRule:true,locale:'en'});
  expect(result.mode).toBe('rule_reference');expect(result.actionOptions.length).toBeGreaterThan(0);expect(AnalysisResultSchema.safeParse(result).success).toBe(true);
  expect(result.snapshot?.uploadedMaterials?.items[0].sources[0].quote).toContain('Morgan Vale');
  expect(result.snapshot?.sourceDescriptors.some(s=>s.category==='uploaded_material')).toBe(true);
  expect(result.snapshot?.legalResearch?.bindings.length).toBeGreaterThan(0);
  expect(result.snapshot?.nextSteps?.length).toBeGreaterThan(0);
  // An allegation of inaccurate reporting is not enough to identify a domestic cause of action.
  expect(result.snapshot?.sourceDescriptors.some(s=>s.category==='domestic_law')).toBe(false);
  input.intake.materials!.items[0].text='Later user edit';
  expect(result.snapshot?.uploadedMaterials?.items[0].text).not.toBe('Later user edit');
  const markdown=analysisMarkdown(result,input,'en');expect(markdown).toContain('not the original PDFs');expect(markdown).toContain('fictional-letter.pdf · pdf-fixture-1 · PDF 1');
  const pack=workPackMarkdown(result,input,'en');expect(pack).toContain('fictional-letter.pdf · pdf-fixture-1 · PDF 1');expect(pack).toContain('The fictional company alleges');expect(pack).toContain(result.snapshot!.legalResearch!.bindings[0].resourceId);expect(pack).not.toContain('Later user edit');
  expect(JSON.stringify(result.snapshot)).not.toContain('"pages"');expect(JSON.stringify(result.snapshot)).not.toContain('Reply requested');
 });
 it('never puts private names, excerpts or uploaded filenames into public search queries',()=>{
  const input=ready(),query=JSON.stringify(buildResearchQuery(input).searchTerms);
  for(const privateString of ['Morgan Vale','fictional-letter.pdf','inaccurate article','instructed lawyer'])expect(query).not.toContain(privateString);
 });
});

describe('PDF execution independent of public search',()=>{
 it('reports extraction available without Brave, Redis or paid cookies',async()=>{
  vi.stubEnv('ANALYSIS_MODE','live');vi.stubEnv('OPENAI_API_KEY','fictional-key');vi.stubEnv('BRAVE_SEARCH_API_KEY','');vi.stubEnv('UPSTASH_REDIS_REST_URL','');
  const {GET}=await import('../src/app/api/capabilities/route');const {NextRequest}=await import('next/server');
  const response=await GET(new NextRequest('https://caselink.example/api/capabilities'));
  expect(await response.json()).toMatchObject({materialExtractionAvailable:true,materialResultRetentionSeconds:0,paidProtectionEnabled:false,webSearchAvailable:false});expect(response.headers.get('set-cookie')).toBeNull();
 });
});
