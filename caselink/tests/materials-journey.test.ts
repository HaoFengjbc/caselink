import {readFile} from 'node:fs/promises';
import {describe,it,expect,vi} from 'vitest';
import {EMPTY_INPUT,NewCaseInputSchema} from '../src/lib/contracts';
import {organizeMaterials} from '../src/lib/materials/service';
import {type ModelMaterialOutput} from '../src/lib/materials/extract';
import {type MaterialResponse,type ParsedMaterial} from '../src/lib/materials/contracts';
import {applyMaterialCandidate,confirmMaterials,resolveMaterialConflict,materialQuestions} from '../src/lib/materials/integration';
import {analyzeInput} from '../src/lib/ai/service';
import {runPaidRequest} from '../src/lib/usage/control';
import {meteredModel} from '../src/lib/usage/runtime';
import {RedisProtocolSimulator,fixtureUsageConfig} from './fixtures/usage';

// A transport simulation, not a recorded or real AI extraction. PDF parsing and rule analysis are real.
describe('complete PDF journey with actual fixture bytes and simulated model transport',()=>{
 it('joins two parsed PDFs, validates quotes, resolves a conflict, confirms consent, and freezes action references',async()=>{
  const files=await Promise.all(['expression-letter.pdf','expression-update.pdf'].map(async name=>({name,type:'application/pdf',bytes:new Uint8Array(await readFile(new URL(`./fixtures/pdf/${name}`,import.meta.url)))})));
  const buffers=files.map(file=>file.bytes),redis=new RedisProtocolSimulator();
  const transport=vi.fn(async({data}:{data:string})=>{
   const {documents}=JSON.parse(data) as {documents:ParsedMaterial[]};
   const note=(index:number,field:ModelMaterialOutput['candidates'][number]['items'][number]['field'],quote:string)=>({field,text:quote,subject:'Mira Vale',nature:'document_record' as const,dateKind:'none' as const,date:null,sources:[{fileId:documents[index].fileId,pdfPage:1,quote}],uncertainty:null});
   const value:ModelMaterialOutput={candidates:[{label:'SIMULATED: FICT-EXPR-001',prefill:{country:'United Kingdom',jurisdiction:'england_wales',caseKind:'civil',expression:'yes',stage:'pretrial',personType:'journalist'},items:[
    note(0,'party','Mira Vale is a freelance journalist in England and Wales, United Kingdom.'),
    note(0,'country','Mira Vale is a freelance journalist in England and Wales, United Kingdom.'),
    note(0,'jurisdiction','Mira Vale is a freelance journalist in England and Wales, United Kingdom.'),
    note(0,'expression','Her article questioned procurement by fictional Northbridge Council.'),
    {...note(0,'claim',"The council's lawyer alleges defamation and demands GBP 20,000."),nature:'allegation'},
    {...note(0,'date','Mira says she received the letter on 3 October 2026.'),dateKind:'event',date:'3 October 2026',nature:'party_statement'},
    {...note(1,'date',"The lawyer's note says the letter was received on 5 October 2026."),dateKind:'event',date:'5 October 2026'},
   ],conflicts:[{description:'The materials disagree about the actual receipt date.',itemIndices:[5,6]}],missing:['The actual receipt date and latest developments need confirmation.']}]};
   return meteredModel('intake','test-model',8000,data,async()=>({status:'completed',model:'test-model',output_parsed:value,usage:{input_tokens:1000,output_tokens:1000}}));
  });
  const identity={requestId:'material-journey-01',inputVersion:1,operation:'initial' as const,sessionId:'fixture-session',ipDigest:'fixture-ip',inputHash:'fixture-hash',locale:'en' as const,kind:'material' as const};
  const paid=<T extends MaterialResponse>(work:()=>Promise<T>)=>runPaidRequest(identity,{model:'test-model',maxOutputTokens:8000,searchCalls:0},work,{config:fixtureUsageConfig,redis:redis.command,now:()=>redis.now,retainResult:false,log:vi.fn()});
  const extraction=await organizeMaterials(files,{...identity,aiConsent:true,background:'',existingPageCount:0,existingFileCount:0},{config:{mode:'live',key:'fictional-test-key',model:'test-model',timeoutMs:3000},transport,paid});
  expect(transport).toHaveBeenCalledOnce();expect(extraction.documents.map(d=>d.pageCount)).toEqual([2,1]);
  expect(extraction.execution?.actualCostUsd).toBeGreaterThan(0); // Simulated metering, no real money spent.
  expect([...redis.values.keys()].some(key=>key.includes(':result:'))).toBe(false);
  expect(files).toHaveLength(0);expect(buffers.every(buffer=>buffer.every(byte=>byte===0))).toBe(true);
  let input=applyMaterialCandidate(structuredClone(EMPTY_INPUT),extraction,extraction.candidates[0].id);
  expect(input.stage).toBe('unknown');expect(input.intake.materials!.conflicts).toHaveLength(1);
  expect(materialQuestions(input,'en',{omitDedicated:true})).toHaveLength(1);
  expect(()=>confirmMaterials(input)).toThrow();
  input=resolveMaterialConflict(input,input.intake.materials!.conflicts[0].id,'Unknown; retain both attributed receipt dates pending the delivery record.');
  input={...input,publicity:'private',intake:{...input.intake,goalText:'Prepare an internal chronology for counsel.',disclosureDetails:'TrialWatch internal researchers and instructed counsel only.',materials:{...input.intake.materials!,latestConfirmed:true,goalConfirmed:true,disclosureConfirmed:true}}};
  input=confirmMaterials(input);expect(NewCaseInputSchema.safeParse(input).success).toBe(true);
  const report=await analyzeInput(input,{forceRule:true,locale:'en'});
  expect(report.mode).toBe('rule_reference');expect(report.actionOptions.length).toBeGreaterThan(0);
  expect(report.snapshot?.uploadedMaterials?.documents).toHaveLength(2);
  expect(report.snapshot?.uploadedMaterials?.conflicts[0].resolution).toContain('Unknown');
  expect(report.snapshot?.uploadedMaterials?.items.flatMap(item=>item.sources).every(source=>extraction.documents.find(doc=>doc.fileId===source.fileId)?.pages.find(page=>page.pdfPage===source.pdfPage)?.text.includes(source.quote))).toBe(true);
  expect(JSON.stringify(report.snapshot)).not.toContain('"pages":');
 });
});
