import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LocaleProvider} from '../src/components/i18n/LocaleProvider';
import WebResearchView from '../src/components/results/WebResearchView';
import {DEMO_SCENARIOS} from '../data/demo/fixtures';
import {CORPUS_VERSION,SCHEMA_VERSION,PROMPT_VERSION,EMPTY_INPUT,type AnalysisResult} from '../src/lib/contracts';
import type {WebResearch,WebSource} from '../src/lib/research/contracts';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {evidence} from '../src/lib/corpus';
import {analysisMarkdown,webResearchMarkdown} from '../src/components/results/export';
import {webMarkdownCitation,webMarkdownText,webSourceUrl,webSourcesFor} from '../src/components/results/web-sources';

const source:WebSource={sourceId:'web-1',title:'A sourced court record',url:'https://example.org/case?ref=(record)',hostname:'example.org'};
const research:WebResearch={status:'completed',searchedAt:'2026-10-08T16:00:00.000Z',searchTerms:['United Kingdom reporting court'],passages:[{text:'A report passage with context.',sourceIds:['web-1']}],sources:[source],searchCallCount:2,failureReason:null};
const input=structuredClone(DEMO_SCENARIOS[0].input);
function result():AnalysisResult{
 const base=buildRuleReference(input);
 return {...base,analysisId:'mock-web-export',schemaVersion:SCHEMA_VERSION,inputHash:'test-only',corpusVersion:CORPUS_VERSION,promptVersion:PROMPT_VERSION,createdAt:'2026-10-08T16:01:00.000Z',mode:'live_ai',historicalComparisons:[],sources:[evidence[0]],webResearch:structuredClone(research),webComparisons:[{title:'A case found on the web',jurisdiction:'United Kingdom',statusAsOf:null,summary:'A comparison requiring source checks.',similarities:['Related reporting context'],differences:['Different procedure'],sourceIds:['web-1']}],actionWebSources:[{actionId:base.actionOptions[0].actionId,sourceIds:['web-1']}]};
}
describe('web research Markdown export',()=>{
 it('preserves full research, comparison and action citations alongside library quotes in both languages',()=>{
  const value=result();value.actionOptions[0].basisType='web_research';
  for(const locale of ['zh','en'] as const){const md=analysisMarkdown(value,input,locale);expect(md).toContain(research.searchedAt);expect(md).toContain(research.searchTerms[0]);expect(md).toContain(research.passages[0].text);expect(md).toContain(value.webComparisons![0].summary);expect(md).toContain('Different procedure');expect(md).toContain(evidence[0].exactQuote);expect(md).toContain('https://example.org/case?ref=%28record%29');expect(md.match(/\[web-1 · A sourced court record\]/g)?.length).toBeGreaterThanOrEqual(4);expect(md).toContain(locale==='zh'?'日期未知，须核实':'Date unknown — verify');const actionPart=md.split(locale==='zh'?'## 当前行动参考':'## Current actions')[1];expect(actionPart).toContain('[web-1 · A sourced court record]');}
 });
 it('keeps distinct missing-results, unavailable and no-search explanations',()=>{
  const value=result();value.webComparisons=[];
  value.webResearch={...research,status:'no_results',passages:[],sources:[],failureReason:'no_citations'};
  expect(webResearchMarkdown(value)).toContain('搜索未取得可用的带来源资料');
  value.webResearch.status='unavailable';value.webResearch.failureReason='timeout';
  expect(webResearchMarkdown(value,'en')).toContain('The research could not finish');expect(webResearchMarkdown(value,'en')).toContain('Search timed out');
  delete value.webResearch;expect(webResearchMarkdown(value)).toContain('本次结果未进行联网研究');
 });
 it('retains the complete adaptive record while adding web sections',()=>{
  const adaptive={...input,intake:{version:1 as const,jurisdiction:'unknown',caseKind:'unknown' as const,narrative:'Original words kept',goalText:'A user goal',disclosureDetails:'Only a private discussion',answers:[{questionId:'current-stage' as const,question:'What changed?',answer:'A response arrived'}],facts:[],confirmed:true}};
  const md=analysisMarkdown(result(),adaptive,'en');expect(md).toContain('Original words kept');expect(md).toContain('Only a private discussion');expect(md).toContain('A response arrived');expect(md).toContain('## Web findings');
 });
 it('does not describe answered narrative facts as unknown through empty legacy fields',()=>{
  const adaptive={...structuredClone(EMPTY_INPUT),country:'中国',intake:{version:1 as const,jurisdiction:'unknown',caseKind:'civil' as const,narrative:'Account restricted after a service',goalText:'Compensation',disclosureDetails:'',answers:[{questionId:'prior-actions',question:'What happened and when?',answer:'I contacted the provider on 5 October; they denied responsibility.'}],facts:[],confirmed:true}};
  for(const locale of ['zh','en'] as const){
   const md=analysisMarkdown(result(),adaptive,locale);
   expect(md).toContain(adaptive.intake.answers[0].answer);
   expect(md).toContain('Compensation');
   for(const falseSummary of ['已尝试：未知','已知日期：未知','表达活动：未知','Tried so far: Unknown','Known dates: Unknown','Expression: Unknown'])expect(md).not.toContain(falseSummary);
  }
  expect(analysisMarkdown(result(),EMPTY_INPUT,'en')).toContain('Known dates: Unknown');
 });
 it('exports the semantic plan, actual queries, both search passes and server action origins',()=>{
  const value=result();
  value.researchAssessment={status:'relevant_cases_found',attempts:2,recovery:'found_cases',note:'A relevant comparison was selected on the second pass.'};
  value.actionOrigins=value.actionOptions.map(action=>({actionId:action.actionId,origin:'ai',reason:null}));
  value.webResearch!.plan={domain:'digital_services',relationship:'Customer and service provider',disputedConduct:['Alleged unauthorized tools'],harms:['Account restrictions'],remedies:['Compensation'],evidenceIssues:['Causation records'],excludedIssues:[],uncertainties:['Responsibility is contested'],searchQueries:['service account restriction compensation'],coverage:'adequate'};
  value.webResearch!.actualQueries=['court service dispute causation'];
  value.webResearch!.attempts=[1,2].map(attempt=>({attempt:attempt as 1|2,reason:attempt===1?'initial':'no_relevant_comparisons',startedAt:research.searchedAt,status:'completed',searchTerms:['service dispute'],actualQueries:[`service query ${attempt}`],searchCallCount:attempt,sourceCount:1,failureReason:null}));
  for(const locale of ['zh','en'] as const){
   const md=analysisMarkdown(value,input,locale);
   expect(md).toContain('Customer and service provider');expect(md).toContain('Causation records');expect(md).toContain('court service dispute causation');expect(md).toContain('service query 1');expect(md).toContain('service query 2');expect(md).toContain(value.researchAssessment.note);
   expect(md).toContain(locale==='zh'?'AI 根据本案生成':'AI-generated for this case');
   expect(md).toContain(locale==='zh'?'搜索调用次数: 3':'Search calls: 3');
  }
 });
});
describe('only structured source entries create external links',()=>{
 it('rejects unsafe protocols and credential URLs and resolves only known IDs',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,hello','https://user:secret@example.org/x'])expect(webSourceUrl({...source,url})).toBeNull();
  expect(webSourcesFor(['web-1','web-999','web-1'],[source])).toEqual([source]);
 });
 it('escapes malicious source labels and prose links, while retaining a usable official URL',()=>{
  const title='Court ](javascript:alert(1)) [fake';const citation=webMarkdownCitation({...source,title});expect(citation).toContain('Court \\]\\(javascript:alert\\(1\\)\\) \\[fake');expect(citation).not.toContain('](javascript:');expect(citation).toContain('](<https://example.org/case?ref=%28record%29>)');
  const prose='See [claimed](https://unverified.example/x) or https://unverified.example/x and <script>alert(1)</script>';
  const escaped=webMarkdownText(prose);expect(escaped).not.toContain('[claimed](');expect(escaped).not.toContain('https://unverified.example');expect(escaped).not.toContain('<script>');
  const value=result();value.webResearch!.passages=[{text:prose,sourceIds:[]}];expect(webResearchMarkdown(value)).toContain(escaped);
 });
});

describe('web finding presentation',()=>{
 const render=(data:WebResearch|undefined,locale:'zh'|'en'='zh',comparisons:AnalysisResult['webComparisons']=[])=>renderToStaticMarkup(createElement(LocaleProvider,{initial:locale,children:createElement(WebResearchView,{research:data,comparisons:comparisons??[]})}));
 it('renders no-results separately from unavailable and opens the report when no comparison exists',()=>{
  expect(render({...research,status:'no_results',passages:[],sources:[]})).toContain('未取得可用网页结果');
  expect(render({...research,status:'unavailable',failureReason:'timeout'},'en')).toContain('Web research did not finish');
  const available=render(research);expect(available).toContain('暂未形成可比案例');expect(available).toMatch(/<details[^>]*open=""/);expect(available).toContain(research.passages[0].text);
  expect(render(undefined)).toContain('本次结果未进行联网研究');
 });
 it('renders narrative HTML as text and creates links only from cited structured sources',()=>{
  const raw='<script>bad()</script> [fake](https://uncited.example)';const data={...research,passages:[{text:raw,sourceIds:['web-1']}]};
  const html=render(data,'en',result().webComparisons);expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).not.toContain('href="https://uncited.example');expect(html).toContain('href="https://example.org/case?ref=(record)"');expect(html).toContain('Date unknown — verify');expect(html).toContain('Web finding · verify before use');
 });
 it('discloses inventory-matched links without presenting them as native citation annotations',()=>{
  const data={...research,sources:[{...source,citationKind:'tool_returned_link' as const}]};
  expect(render(data)).toContain('段落与来源的关联由 AI 给出');
  expect(render(data,'en')).toContain('paragraph attribution is AI-generated');
  const value=result();value.webResearch=data;
  expect(webResearchMarkdown(value)).toContain('链接已匹配本轮工具返回的来源');
  expect(webResearchMarkdown(value)).not.toContain('搜索接口提供的引用标注');
 });
});
