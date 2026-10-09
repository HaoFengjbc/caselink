import {describe,it,expect,vi,afterEach} from 'vitest';
import {EMPTY_INPUT,NewCaseInputSchema,AnalysisResultSchema,type NewCaseInput} from '../src/lib/contracts';
import {MaterialResponseSchema,type MaterialResponse} from '../src/lib/materials/contracts';
import {applyMaterialCandidate,removeMaterialFile,updateMaterialItem,deleteMaterialItem,resolveMaterialConflict,materialQuestions,materialReviewErrors,confirmMaterials} from '../src/lib/materials/integration';
import {analyzeInput} from '../src/lib/ai/service';
import {analysisMarkdown} from '../src/components/results/export';
import {buildResearchQuery} from '../src/lib/research/query';
import {runPaidRequest,type PaidIdentity} from '../src/lib/usage/control';
import {readUsageConfig,materialUsageConfigured} from '../src/lib/usage/config';
import {RedisProtocolSimulator,fixtureUsageConfig} from './fixtures/usage';
import {availableIntakeQuestions} from '../src/lib/intake/questions';

export const extracted=():MaterialResponse=>MaterialResponseSchema.parse({mode:'live_ai',warnings:[],documents:[{fileId:'pdf-fixture-1',filename:'fictional-letter.pdf',size:2500,pageCount:1,processedPages:[1],unreadablePages:[],omittedPages:[],warnings:[],pages:[{pdfPage:1,text:'The fictional company alleges that reporter Morgan Vale published an inaccurate article. Case in England and Wales. Letter dated 2024-05-10. Reply requested by 2024-05-20.',status:'read',printedPage:null}]}],candidates:[{id:'case-fixture',label:'Fictional Morgan Vale publication dispute',prefill:{country:'United Kingdom',jurisdiction:'england_wales',caseKind:'civil',expression:'yes',stage:'pretrial',personType:'journalist'},items:[{id:'fact-allegation',field:'claim',text:'The company alleges inaccurate reporting.',subject:'Fictional company',nature:'allegation',dateKind:'none',date:null,sources:[{fileId:'pdf-fixture-1',filename:'fictional-letter.pdf',pdfPage:1,printedPage:null,quote:'The fictional company alleges that reporter Morgan Vale published an inaccurate article.',method:'embedded_text'}],uncertainty:null,status:'extracted',originalText:'The company alleges inaccurate reporting.'}],conflicts:[],missing:[]}]});
const ready=()=>{let input=applyMaterialCandidate(structuredClone(EMPTY_INPUT),extracted(),'case-fixture');input={...input,publicity:'private',intake:{...input.intake,goalText:'Prepare an internal chronology for the instructed lawyer.',disclosureDetails:'Only share de-identified excerpts with the instructed lawyer.'}};return confirmMaterials(input);};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

describe('PDF intake uses one case record and immutable source evidence',()=>{
 it('prefills without a handwritten narrative; document stage is not promoted to current status',()=>{
  const input=applyMaterialCandidate(structuredClone(EMPTY_INPUT),extracted(),'case-fixture');
  expect(input).toMatchObject({country:'United Kingdom',stage:'unknown',intake:{narrative:'',jurisdiction:'england_wales',caseKind:'civil',expression:'yes',confirmed:false}});
  expect(input.intake.materials?.items).toHaveLength(1);expect(input.intake.facts[0].materialItemId).toBe('fact-allegation');
  expect(materialReviewErrors(input)).toHaveLength(2);expect(()=>confirmMaterials(input)).toThrow();
  expect(NewCaseInputSchema.safeParse({...input,intake:{...input.intake,confirmed:true}}).success).toBe(false);
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
 it('retains conflicts until explicit resolution, including unknown; deleting a fact clears dependent conflicts',()=>{
  const result=extracted(),candidate=result.candidates[0];candidate.items.push({...structuredClone(candidate.items[0]),id:'second-claim',text:'The reporter disputes that allegation.',originalText:'The reporter disputes that allegation.',nature:'party_statement'});
  candidate.conflicts=[{id:'conflict-fixture',description:'Company and reporter disagree.',itemIds:['fact-allegation','second-claim'],resolution:null}];
  let input=applyMaterialCandidate(structuredClone(EMPTY_INPUT),result,'case-fixture');
  expect(materialReviewErrors(input).join()).toContain('冲突');
  input=resolveMaterialConflict(input,'conflict-fixture','Not sure; retain both attributed accounts.');
  expect(input.intake.materials!.items).toHaveLength(2);expect(materialReviewErrors(input).join()).not.toContain('冲突');
  input=deleteMaterialItem(input,'second-claim');expect(input.intake.materials!.conflicts).toHaveLength(0);
 });
 it('requires an explicit candidate and keeps another case out',()=>{
  const result=extracted();result.candidates.push({...structuredClone(result.candidates[0]),id:'unrelated-case',label:'Unrelated matter',items:[{...structuredClone(result.candidates[0].items[0]),id:'unrelated-fact',text:'Unrelated matter.'}]});
  expect(()=>applyMaterialCandidate(structuredClone(EMPTY_INPUT),result,'')).toThrow();
  const input=applyMaterialCandidate(structuredClone(EMPTY_INPUT),result,'case-fixture');expect(JSON.stringify(input)).not.toContain('Unrelated matter');
 });
 it('generates action references through the existing rule flow with a frozen private-source snapshot',async()=>{
  const input=ready(),result=await analyzeInput(input,{forceRule:true,locale:'en'});
  expect(result.mode).toBe('rule_reference');expect(result.actionOptions.length).toBeGreaterThan(0);expect(AnalysisResultSchema.safeParse(result).success).toBe(true);
  expect(result.snapshot?.uploadedMaterials?.items[0].sources[0].quote).toContain('Morgan Vale');
  expect(result.snapshot?.sourceDescriptors.some(s=>s.category==='uploaded_material')).toBe(true);
  input.intake.materials!.items[0].text='Later user edit';
  expect(result.snapshot?.uploadedMaterials?.items[0].text).not.toBe('Later user edit');
  const markdown=analysisMarkdown(result,input,'en');expect(markdown).toContain('not the original PDFs');expect(markdown).toContain('fictional-letter.pdf · pdf-fixture-1 · PDF 1');
  expect(JSON.stringify(result.snapshot)).not.toContain('"pages"');expect(JSON.stringify(result.snapshot)).not.toContain('Reply requested');
 });
 it('never puts private names, excerpts or uploaded filenames into public search queries',()=>{
  const input=ready(),query=JSON.stringify(buildResearchQuery(input).searchTerms);
  for(const privateString of ['Morgan Vale','fictional-letter.pdf','inaccurate article','instructed lawyer'])expect(query).not.toContain(privateString);
 });
});

describe('private PDF usage control independent of search',()=>{
 it('never saves a PDF extraction response even encrypted, while blocking duplicate paid execution',async()=>{
  const redis=new RedisProtocolSimulator(),work=vi.fn(async()=>({warnings:['FICTIONAL PRIVATE EXCERPT'],execution:undefined}));
  const identity:PaidIdentity={requestId:'material-paid-01',inputVersion:1,operation:'initial',sessionId:'fixture-session',ipDigest:'fixture-ip',inputHash:'fixture-hash',locale:'en',kind:'material'};
  const options={config:fixtureUsageConfig,redis:redis.command,now:()=>redis.now,retainResult:false,log:vi.fn()};
  await runPaidRequest(identity,{model:'test-model',maxOutputTokens:8000,searchCalls:0},work,options);
  expect([...redis.values.keys()].some(k=>k.includes(':result:'))).toBe(false);expect(JSON.stringify(redis.commands)).not.toContain('FICTIONAL PRIVATE EXCERPT');
  await expect(runPaidRequest(identity,{model:'test-model',maxOutputTokens:8000,searchCalls:0},work,options)).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});expect(work).toHaveBeenCalledOnce();
 });
 it('needs only the intake price and budget and does not depend on Brave or final-analysis model',()=>{
  const env={UPSTASH_REDIS_REST_URL:fixtureUsageConfig.url,UPSTASH_REDIS_REST_TOKEN:'fixture-token',USAGE_SESSION_SECRET:fixtureUsageConfig.secret,AI_MODEL_RATES_JSON:JSON.stringify({'gpt-6-luna':fixtureUsageConfig.rates['gpt-6-luna']}),AI_GLOBAL_DAILY_BUDGET_USD:'2',USAGE_TRUSTED_IP_HEADER:'x-fixture-ip',CONTROLLED_SEARCH_ENABLED:'true'};
  expect(()=>readUsageConfig(env)).toThrow();expect(materialUsageConfigured(env)).toBe(true);expect(readUsageConfig(env,{searchRequired:false}).searchMicroUsd).toBe(0);
 });
});
