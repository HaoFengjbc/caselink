import {describe,it,expect,vi} from 'vitest';
import {EMPTY_INPUT,type NewCaseInput} from '../src/lib/contracts';
import {resolveJurisdiction} from '../src/lib/jurisdiction';
import {assessDomain} from '../src/lib/research/domain';
import {buildResearchQuery,APPROVED_ISSUES} from '../src/lib/research/query';
import {structuredResearchPlan} from '../src/lib/research/plan';
import {createControlledSearchTransport} from '../src/lib/research/controlled-search';
import {researchWeb,type WebSearchTransport} from '../src/lib/research/provider';
import type {ServerConfig} from '../src/lib/ai/config';
import {withTestExecution} from './fixtures/execution';
const config:ServerConfig={mode:'live',key:'unused',model:'test-model',configured:true,timeoutMs:1000,reasoningEffort:'low',maxOutputTokens:9000};
const input=(jurisdiction='england_wales'):NewCaseInput=>({...structuredClone(EMPTY_INPUT),country:'GB',primaryGoal:'lawyer',intake:{version:1,jurisdiction,caseKind:'civil',narrative:'FICTIONAL reporter SecretName wrote a public-interest article. secret@example.org',goalText:'Organize papers for adviser',disclosureDetails:'Internal only',answers:[],facts:[],confirmed:true,expression:'yes'}});
describe('structured scope and jurisdiction',()=>{
 it.each([['england_wales','England and Wales'],['northern_ireland','Northern Ireland'],['scotland','Scotland']])('keeps %s as GB in the UI and research mapping',(code,label)=>{
  expect(resolveJurisdiction(input(code))).toMatchObject({countryCode:'GB',jurisdictionCode:code,legalSystem:label});expect(buildResearchQuery(input(code)).searchTerms[0]).toContain(label);
 });
 it('uses current country, never retained UK fields or answers',()=>{
  const value=input('northern_ireland');value.country='加拿大';value.intake!.answers=[{questionId:'uk-jurisdiction',question:'Where?',answer:'Scotland'}];expect(resolveJurisdiction(value)).toMatchObject({countryCode:'CA',jurisdictionCode:'national',legalSystem:null});
 });
 it('does not override confirmed structured jurisdiction with prose or a conflicting old answer',()=>{
  const value=input();value.intake!.answers=[{questionId:'uk-jurisdiction',question:'Where?',answer:'Northern Ireland'}];expect(resolveJurisdiction(value).jurisdictionCode).toBe('england_wales');
 });
 it('requires a user-confirmed expression connection, not keywords or profession alone',()=>{
  const value=input();expect(assessDomain(value).status).toBe('in_scope');value.intake!.expression='no';expect(assessDomain(value).status).toBe('out_of_scope');value.intake!.expression='unsure';value.background.personType='journalist';expect(assessDomain(value).status).toBe('needs_clarification');
 });
});
describe('controlled actual search requests, mocked HTTP only',()=>{
 it('serializes only approved vocabulary, never model prose, narrative or names',async()=>{
  const value=input(),proposal={...structuredResearchPlan(value),relationship:'SecretName unusual private combination',disputedConduct:['defamation','RarePrivatePhrase'],searchQueries:['secret@example.org SecretName exact case'],evidenceIssues:['SecretFileNumber']};
  const query=buildResearchQuery(value,proposal);expect(JSON.stringify(query)).not.toMatch(/SecretName|secret@example|RarePrivate|SecretFile|unusual private/);
  expect(query.topics).toContain(APPROVED_ISSUES.defamation);const calls:URL[]=[];
  const http=vi.fn(async(url:unknown)=>{calls.push(new URL(String(url)));return Response.json({query:{original:new URL(String(url)).searchParams.get('q'),spellcheck_off:true},web:{results:[{url:'https://www.judiciary.uk/judgments/fixture',title:'Fictional result',description:'A public snippet. Full source not read.'}]}});});
  const transport=createControlledSearchTransport(http as typeof fetch,{CONTROLLED_SEARCH_ENABLED:'true',BRAVE_SEARCH_API_KEY:'fixture-only'});
  const result=await withTestExecution(()=>researchWeb(value,config,undefined,transport,'en'));
  expect(calls).toHaveLength(3);expect(calls.every(url=>url.searchParams.get('spellcheck')==='false')).toBe(true);expect(result.actualQueries).toEqual(buildResearchQuery(value).searchTerms);expect(result.sources.every(s=>s.pageOpened===false)).toBe(true);expect(result.passages[0].text).toContain('source page not opened');
 });
 it('rejects tampered prepared queries before outbound HTTP rather than filtering after disclosure',async()=>{
  const query=buildResearchQuery(input());query.searchTerms=['SecretName unusual event 2026 exact'];const http=vi.fn();const transport=createControlledSearchTransport(http,{CONTROLLED_SEARCH_ENABLED:'true',BRAVE_SEARCH_API_KEY:'fixture'});
  await expect(withTestExecution(()=>transport({config,query,locale:'en',signal:new AbortController().signal}))).rejects.toThrow('unapproved_search_query');expect(http).not.toHaveBeenCalled();
 });
 it('keeps the executed query record when the second provider request fails',async()=>{
  let count=0;const http=vi.fn(async()=>++count===1?Response.json({web:{results:[]}}):new Response('',{status:429}));
  const transport=createControlledSearchTransport(http as typeof fetch,{CONTROLLED_SEARCH_ENABLED:'true',BRAVE_SEARCH_API_KEY:'fixture'});
  const result=await withTestExecution(()=>researchWeb(input(),config,undefined,transport));expect(http).toHaveBeenCalledTimes(2);expect(result.status).toBe('unavailable');expect(result.actualQueries).toEqual(buildResearchQuery(input()).searchTerms.slice(0,2));expect(result.searchCallCount).toBe(2);
 });
 it('rejects prototype keys as proposed labels and never infers defamation from civil alone',()=>{
  const value=input(),proposal={...structuredResearchPlan(value),disputedConduct:['__proto__','constructor','toString']};expect(buildResearchQuery(value,proposal).topics).toEqual(['journalism freedom of expression']);expect(buildResearchQuery(value).searchTerms.join(' ')).not.toContain('defamation');
 });
 it('maps the actual detained problem enum to the approved detention label',()=>{const value=input();value.currentProblems=['detained'];expect(buildResearchQuery(value).topics).toContain('detention');});
 it('does not use a semantic planner or trigger a second round after irrelevant sources',async()=>{
  const planner=vi.fn(),search:WebSearchTransport=vi.fn(async()=>({status:'completed',output:[]}));
  const result=await researchWeb(input(),config,undefined,search,'en',{plannerTransport:planner});expect(planner).not.toHaveBeenCalled();expect(search).toHaveBeenCalledOnce();expect(result.attempts).toHaveLength(1);
 });
 it('records manual supplementation as one explicit new round',async()=>{
  const search:WebSearchTransport=vi.fn(async()=>({status:'completed',output:[]}));const result=await researchWeb(input(),config,undefined,search,'en',{attempt:2});expect(search).toHaveBeenCalledOnce();expect(result.attempts).toHaveLength(1);expect(result.attempts![0].reason).toBe('manual_supplement');
 });
 it('fails closed without controlled provider configuration and never invokes default autonomous search',async()=>{
  const transport=createControlledSearchTransport(vi.fn(),{});await expect(transport({config,query:buildResearchQuery(input()),locale:'en',signal:new AbortController().signal})).rejects.toMatchObject({code:'WEB_SEARCH_DISABLED'});
 });
});
