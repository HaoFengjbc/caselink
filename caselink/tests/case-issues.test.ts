import {describe,it,expect,vi,afterEach} from 'vitest';
import dns from 'node:dns';
import {DEMO_SCENARIOS} from '../data/demo/fixtures';
import {buildLegalResearch} from '../src/lib/legal-research';
import {retrieveCases} from '../src/lib/retrieval/match';
import {contextFor} from '../src/lib/evidence/validate';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {analyzeInput} from '../src/lib/ai/service';
import {buildCaseIssues,ruleCaseIssues} from '../src/lib/issues/build';
import {htmlToText,verifyQuotes,quoteKey,publicLookup,fetchPublicPageText} from '../src/lib/research/verify-source';
import type {ModelAnalysisOutput} from '../src/lib/contracts';
import type {WebResearch} from '../src/lib/research/contracts';
import type {ModelIssue} from '../src/lib/issues/contracts';

afterEach(()=>{vi.restoreAllMocks();});
const input=()=>structuredClone(DEMO_SCENARIOS[0]!.input);
const law='Section 4. Cybercrime Offenses. The following acts constitute the offense of cybercrime punishable under this Act: (c)(4) Libel. The unlawful or prohibited acts of libel as defined in Article 355 of the Revised Penal Code, committed through a computer system.';
const research=(url='https://www.officialgazette.gov.ph/2012/09/12/republic-act-no-10175/'):WebResearch=>({status:'completed',searchedAt:'2026-10-10T00:00:00.000Z',searchTerms:['Philippines law defamation official legislation text'],passages:[{text:'Section 4(c)(4) makes libel committed through a computer system a cybercrime.',sourceIds:['web-1']}],sources:[{sourceId:'web-1',url,title:'Republic Act No. 10175',hostname:new URL(url).hostname,citationKind:'url_annotation',pageOpened:true}],searchCallCount:1,failureReason:null,relevanceStatus:'not_assessed'});
function issue(overrides:Partial<ModelIssue>={}):ModelIssue{return {issueId:'issue-1',question:'2012 年 5 月的文章能否适用 2012 年 9 月的新法？',facts:[{text:'文章于 2012 年 5 月发表。',materialItemId:null,factId:null}],authorities:[],application:'如果新法不能溯及既往，定罪的基础就要重新检视。',nextStep:'当地律师核对上诉书状。',...overrides};}

describe('server-side checking of quoted public sources',()=>{
 it('reads page text without scripts, styles or markup and decodes entities',()=>{
  expect(htmlToText('<html><head><title>x</title><script>alert(1)</script></head><body><p>Section&nbsp;4 &amp; <b>libel</b></p><style>p{}</style><p>Art. 355&#8212;Revised</p></body></html>')).toBe('Section 4 & libel\nArt. 355—Revised');
 });
 it('accepts only the words actually on the page, and returns the page’s own wording',async()=>{
  const read=vi.fn(async()=>`<p>${law}</p>`.replace(/<[^>]+>/g,''));
  const checks=[{url:'https://law.example.gov/a',quote:'The unlawful or prohibited acts of libel as defined in Article 355 of the Revised Penal Code'},{url:'https://law.example.gov/a',quote:'Libel committed online is punishable by life imprisonment under this Act'},{url:'https://law.example.gov/a',quote:'Libel.'}];
  const result=await verifyQuotes(checks,{read});
  expect(result.get(quoteKey(checks[0]!))).toContain('Article 355 of the Revised Penal Code');
  expect(result.get(quoteKey(checks[1]!))).toBeNull();
  expect(result.get(quoteKey(checks[2]!))).toBeNull();
  expect(read).toHaveBeenCalledTimes(1);
 });
 it('never connects to a private address, even when a public-looking name resolves to one',async()=>{
  expect(await fetchPublicPageText('http://127.0.0.1/admin',AbortSignal.timeout(1000))).toBeNull();
  expect(await fetchPublicPageText('http://localhost/admin',AbortSignal.timeout(1000))).toBeNull();
  vi.spyOn(dns,'lookup').mockImplementation(((_host:string,_options:unknown,callback:(error:null,addresses:{address:string;family:number}[])=>void)=>callback(null,[{address:'10.0.0.5',family:4}])) as never);
  const error=await new Promise<NodeJS.ErrnoException|null>(resolve=>publicLookup('law.example.gov',{},(err)=>resolve(err)));
  expect(error?.code).toBe('ENOTPUBLIC');
 });
});

describe('key questions are checked before display',()=>{
 const base=()=>{const value=input();const legal=buildLegalResearch(value,'zh');const matches=retrieveCases(value);const context=contextFor(matches);const output:ModelAnalysisOutput={...buildRuleReference(value,matches,'zh'),issues:[]};return {value,legal,context,output};};
 it('keeps curated, library and quote-matched authorities and drops anything it cannot check',async()=>{
  const {value,legal,context,output}=base();
  const binding=legal.bindings.find(b=>b.applicability!=='excluded'&&!b.conditions.some(c=>c.status==='not_met'))!;
  const evidence=context.evidence[0]!,other=context.evidence.find(e=>e.caseId!==evidence.caseId);
  output.issues=[issue({authorities:[
   {kind:'international',bindingId:binding.bindingId,sourceId:null,quote:null,locator:null,caseId:null,evidenceIds:[],point:'与本问题直接相关。'},
   {kind:'international',bindingId:'invented-binding',sourceId:null,quote:null,locator:null,caseId:null,evidenceIds:[],point:'不存在的依据。'},
   {kind:'local',bindingId:null,sourceId:'web-1',quote:'The unlawful or prohibited acts of libel as defined in Article 355 of the Revised Penal Code',locator:'Section 4(c)(4)',caseId:null,evidenceIds:[],point:'网络诽谤的定义。'},
   {kind:'local',bindingId:null,sourceId:'web-1',quote:'Online libel is punishable by life imprisonment',locator:'Section 99',caseId:null,evidenceIds:[],point:'编造的条文。'},
  ]}),issue({issueId:'issue-2',authorities:[{kind:'case',bindingId:null,sourceId:null,quote:null,locator:null,caseId:evidence.caseId,evidenceIds:[evidence.evidenceId,...(other?[other.evidenceId]:[])],point:'可比的历史行动。'}],application:'本案构成违法，定罪当然无效。'})];
  output.actionOptions[0]!.issueIds=['issue-1','issue-9'];
  const verify=vi.fn(async(checks:readonly {url:string;quote:string}[])=>new Map(checks.map(check=>[quoteKey(check),check.quote.startsWith('The unlawful')?check.quote:null])));
  const {issues,actionIssueIds}=await buildCaseIssues(output,{input:value,research:legal,context,webResearch:research(),locale:'zh',mode:'live_ai',verify});
  expect(issues).toHaveLength(2);
  expect(issues[0]!.authorities.map(a=>a.check)).toEqual(['catalog','quote_matched']);
  expect(issues[0]!.authorities[1]).toMatchObject({kind:'local',locator:'Section 4(c)(4)',url:'https://www.officialgazette.gov.ph/2012/09/12/republic-act-no-10175/'});
  expect(issues[0]!.application).toContain('溯及既往');
  expect(issues[1]!.authorities[0]).toMatchObject({kind:'case',check:'library',evidenceIds:[evidence.evidenceId]});
  expect(issues[1]!.application).toBeNull();
  expect(actionIssueIds.get(output.actionOptions[0]!.actionId)).toEqual(['issue-1']);
 });
 it('withholds analysis that names a provision the question does not cite',async()=>{
  const {value,legal,context,output}=base();const binding=legal.bindings.find(b=>b.applicability!=='excluded'&&!b.conditions.some(c=>c.status==='not_met'))!;
  output.issues=[issue({authorities:[{kind:'international',bindingId:binding.bindingId,sourceId:null,quote:null,locator:null,caseId:null,evidenceIds:[],point:'相关。'}],application:'依据第 987 条，本案可以申请撤销。'})];
  const {issues}=await buildCaseIssues(output,{input:value,research:legal,context,locale:'zh',mode:'live_ai',verify:vi.fn()});
  expect(issues[0]!.application).toBeNull();
 });
 it('drops the “据用户叙述” prefix and the internal word “绑定” from what the page shows',async()=>{
  const {value,legal,context,output}=base();const binding=legal.bindings.find(b=>b.applicability!=='excluded'&&!b.conditions.some(c=>c.status==='not_met'))!;
  output.issues=[issue({facts:[{text:'据用户叙述，文章于 2012 年 5 月发表。',materialItemId:null,factId:null}],authorities:[{kind:'international',bindingId:binding.bindingId,sourceId:null,quote:null,locator:null,caseId:null,evidenceIds:[],point:'该绑定要求限制须有法律依据。'}]})];
  const {issues}=await buildCaseIssues(output,{input:value,research:legal,context,locale:'zh',mode:'live_ai',verify:vi.fn()});
  expect(issues[0]!.facts[0]!.text).toBe('文章于 2012 年 5 月发表。');
  expect(issues[0]!.authorities[0]!.point).toBe('该条要求限制须有法律依据。');
 });
 it('drops facts that point at material that does not exist',async()=>{
  const {value,legal,context,output}=base();const binding=legal.bindings.find(b=>b.applicability!=='excluded'&&!b.conditions.some(c=>c.status==='not_met'))!;
  output.issues=[issue({facts:[{text:'虚构的材料事实。',materialItemId:'material-missing',factId:null},{text:'用户叙述。',materialItemId:null,factId:null}],authorities:[{kind:'international',bindingId:binding.bindingId,sourceId:null,quote:null,locator:null,caseId:null,evidenceIds:[],point:'相关。'}]})];
  const {issues}=await buildCaseIssues(output,{input:value,research:legal,context,locale:'zh',mode:'live_ai',verify:vi.fn()});
  expect(issues[0]!.facts.map(f=>f.text)).toEqual(['用户叙述。']);
 });
 it('falls back to the curated research questions in rule mode or when no AI issue survives',async()=>{
  const {value,legal,context,output}=base();
  const rule=ruleCaseIssues(legal,'zh');
  expect(rule.length).toBeGreaterThan(0);expect(rule.length).toBeLessThanOrEqual(3);
  expect(rule.every(issue=>issue.origin==='rule'&&issue.authorities.length>0&&issue.application===null)).toBe(true);
  output.issues=[issue({authorities:[{kind:'local',bindingId:null,sourceId:'web-1',quote:'Invented text that is nowhere on the page at all',locator:'Section 1',caseId:null,evidenceIds:[],point:'编造。'}]})];
  const {issues}=await buildCaseIssues(output,{input:value,research:legal,context,webResearch:research(),locale:'zh',mode:'live_ai',verify:vi.fn(async(checks:readonly {url:string;quote:string}[])=>new Map(checks.map(check=>[quoteKey(check),null])))});
  expect(issues).toEqual(rule);
 });
 it('rule analysis freezes the key questions in the result and the report snapshot',async()=>{
  const result=await analyzeInput(input(),{forceRule:true});
  expect(result.caseIssues?.length).toBeGreaterThan(0);expect(result.snapshot?.caseIssues).toEqual(result.caseIssues);
  expect(result).not.toHaveProperty('issues');
 });
});
