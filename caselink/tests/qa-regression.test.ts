import {afterEach,describe,it,expect,vi} from 'vitest';
import {DEMO_SCENARIOS} from '../data/demo/fixtures';
import {type NewCaseInput} from '../src/lib/contracts';
import {analyzeInput} from '../src/lib/ai/service';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {retrieveCases} from '../src/lib/retrieval/match';
import {contextFor,validateModelOutput} from '../src/lib/evidence/validate';
import {analysisMarkdown} from '../src/components/results/export';
import {documents,getCase} from '../src/lib/corpus';
import {zh} from '../src/lib/i18n/zh';

const example=()=>structuredClone(DEMO_SCENARIOS[0].input);
const demoConfig={mode:'demo' as const,key:'',model:'',timeoutMs:1000,reasoningEffort:'low' as const,maxOutputTokens:9000,configured:false};
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
function mockWindow(failStorage=false){
 const storage=new Map<string,string>();
 vi.stubGlobal('window',{sessionStorage:{getItem:(k:string)=>{if(failStorage)throw new Error('storage unavailable');return storage.get(k)??null;},setItem:(k:string,v:string)=>{if(failStorage)throw new Error('storage unavailable');storage.set(k,v);},removeItem:(k:string)=>storage.delete(k)},dispatchEvent:vi.fn()});
 return storage;
}

describe('independent QA: session restoration and stale result protection',()=>{
 it('marks results from a previous corpus or prompt stale without deleting the case record',async()=>{
  mockWindow();const session=await import('../src/lib/session');const input=example();session.saveInput(input);
  const result=await analyzeInput(input,{config:demoConfig});
  session.saveResult({...result,corpusVersion:'2026-10-07.v1'},session.inputKey(input));
  expect(session.isResultStale()).toBe(true);expect(session.readSession().input).toEqual(input);
  session.saveResult({...result,promptVersion:'1.2'},session.inputKey(input));expect(session.isResultStale()).toBe(true);
 });
 it('marks edits to every detailed intake field as stale and refuses late old results',async()=>{
  mockWindow();const session=await import('../src/lib/session');const input=example();
  const result=await analyzeInput(input,{config:demoConfig});
  session.saveInput(input,4);const originalKey=session.inputKey(input);expect(session.saveResult(result,originalKey)).toBe(true);expect(session.isResultStale()).toBe(false);
  const variants:NewCaseInput[]=[
   {...input,country:'突尼斯'},{...input,stage:'appeal'},{...input,currentProblems:['threats']},
   {...input,background:{...input.background,activities:['repost']}},{...input,background:{...input.background,personType:'blogger'}},{...input,background:{...input.background,description:'changed'}},
   {...input,primaryGoal:'lawyer'},{...input,keyDates:[{...input.keyDates[0],date:'2026-12-01'}]},{...input,keyDates:[{...input.keyDates[0],event:'changed'}]},{...input,keyDates:[{...input.keyDates[0],approximate:false}]},
   {...input,resources:['international']},{...input,resourceConstraints:'changed'},{...input,priorActions:{...input.priorActions,status:'none'}},{...input,priorActions:{...input.priorActions,description:'changed'}},{...input,priorActions:{...input.priorActions,date:'2026-10-01'}},
   {...input,publicity:'public'},{...input,isExample:false},{...input,exampleId:'changed'},
  ];
  for(const changed of variants){session.saveInput(changed);expect(session.isResultStale()).toBe(true);expect(session.saveResult({...result,analysisId:'late-old-response'},originalKey)).toBe(false);expect(session.readSession().result?.analysisId).toBe(result.analysisId);}
 });
 it('recovers saved input and result on a fresh module and clears them together',async()=>{
  mockWindow();let session=await import('../src/lib/session');const input=example();session.saveInput(input,6);const result=await analyzeInput(input,{config:demoConfig});session.saveResult(result,session.inputKey(input));
  vi.resetModules();session=await import('../src/lib/session');expect(session.readSession().input).toEqual(input);expect(session.readSession().result?.analysisId).toBe(result.analysisId);expect(session.readSession().step).toBe(6);expect(session.isResultStale()).toBe(false);
  session.clearSession();expect(session.readSession()).toMatchObject({input:null,result:null,step:0});
 });
 it('keeps the active flow working in memory if browser storage throws',async()=>{
  mockWindow(true);const session=await import('../src/lib/session');const input=example();session.saveInput(input);expect(session.readSession().input).toEqual(input);expect(session.isStorageAvailable()).toBe(false);
  const result=await analyzeInput(input,{config:demoConfig});expect(session.saveResult(result,session.inputKey(input))).toBe(true);expect(session.isResultStale()).toBe(false);
 });
});

describe('independent QA: model labels cannot override user intent',()=>{
 it('rejects a concrete bail filing disguised as general preparation when goal is unknown',()=>{
  const input={...example(),primaryGoal:'unknown' as const};const output=buildRuleReference(input);
  output.actionOptions[0].title='由律师提交保释申请';
  output.actionOptions[0].steps=['收集拘押文书并整理申请材料。','请律师向法院提交保释申请。','跟进法院对保释申请的回应。'];
  expect(()=>validateModelOutput(output,input,contextFor(retrieveCases(input)))).toThrow();
 });
});

describe('independent QA: new-case dates are not historical verdict assertions',()=>{
 it('accepts a user-provided new-case date even when it resembles Emna disputed verdict dates',async()=>{
  const input=example();input.keyDates=[{date:'2020-07-13',event:'用户提供的本案听证',approximate:false}];
  const result=await analyzeInput(input,{config:demoConfig});
  expect(result.mode).toBe('rule_reference');
  expect(result.actionOptions.some(a=>a.actionId==='prepare-case-file')).toBe(true);
 });
});

describe('independent QA: exported plans preserve review context',()=>{
 it('retains all action details, source provenance, historical gaps and the prior-action date',async()=>{
  const input=example();input.priorActions={status:'described',description:'已经询问负责律师，仍在等待回应。',date:'上周（待确认）'};
  const result=await analyzeInput(input,{config:demoConfig});const markdown=analysisMarkdown(result,input);
  expect(markdown).toContain(zh.modes[result.mode]);expect(markdown).toContain(input.priorActions.date);
  expect(markdown).toContain(result.inputHash);
  for(const action of result.actionOptions)for(const detail of [...action.steps,...action.materials,...action.followUp,...action.uncertainties])expect(markdown).toContain(detail);
  for(const match of result.comparableCases){const record=getCase(match.caseId)!;for(const gap of record.unknowns)expect(markdown).toContain(gap);for(const conflict of record.conflicts)expect(markdown).toContain(conflict.description);}
  for(const source of result.sources){const document=documents.find(d=>d.documentId===source.documentId)!;for(const detail of [source.exactQuote,source.explanation,`${source.sourceUrl}#page=${source.pdfPage}`,document.author,document.publishedDate,document.factsAsOf,document.checkedAt])expect(markdown).toContain(detail);if(source.printedPage)expect(markdown).toContain(`印刷页 ${source.printedPage}`);}
 });
});
