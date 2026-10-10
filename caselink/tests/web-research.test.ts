import {afterEach,describe,expect,it,vi} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {EMPTY_INPUT,type NewCaseInput} from '../src/lib/contracts';
import {type ServerConfig} from '../src/lib/ai/config';
import {buildResearchQuery,recognizedJurisdiction} from '../src/lib/research/query';
import {assembleWebResearch,openAIWebSearchTransport,researchWeb,safePublicUrl,WEB_SEARCH_TIMEOUT_MS,type WebSearchResponse,type WebSearchTransport} from '../src/lib/research/provider';
import {WebResearchSchema} from '../src/lib/research/contracts';

const config:ServerConfig={mode:'live',key:'offline-test-not-a-secret',model:'gpt-6.1-sol',configured:true,timeoutMs:1000,reasoningEffort:'high',maxOutputTokens:9000};
const input=():NewCaseInput=>({...structuredClone(EMPTY_INPUT),country:'英国',background:{activities:['reporting'],personType:'journalist',description:'民事诽谤和读者评论'}});
const search={type:'web_search_call',status:'completed',action:{type:'search',sources:[{type:'url',url:'https://uncited.org/inventory-only'}]}};
const citation=(text:string,url='https://www.judiciary.uk/judgments/test/',start=0,end=text.length)=>({type:'url_citation',start_index:start,end_index:end,title:'Official court judgment',url});
const message=(text:string,annotations:unknown[])=>({type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text,annotations}]});
const result=(text='A public case was decided at trial.',annotations=[citation(text)]):WebSearchResponse=>({status:'completed',output:[search,message(text,annotations)]});
const transport=(r:WebSearchResponse):WebSearchTransport=>vi.fn(async()=>r);
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();});

describe('research queries contain only canonical labels',()=>{
 it('recognizes ISO names, Chinese names and aliases without forwarding raw jurisdiction',()=>{
  for(const [raw,code] of [['英国','GB'],['GB','GB'],['United States','US'],['美国','US'],['Tunisie',''],['科特迪瓦','CI'],['Ivory Coast','CI'],['香港','HK'],['Kazakhstan','KZ'],['Türkiye','TR'],['DR Congo','CD'],['巴勒斯坦','PS']]){
   expect(recognizedJurisdiction([raw]).countryCode).toBe(code||null);
  }
 });
 it('keeps the UK legal systems separate and ambiguity explicit',()=>{
  expect(recognizedJurisdiction(['England and Wales']).legalSystem).toBe('England and Wales');
  expect(recognizedJurisdiction(['苏格兰']).legalSystem).toBe('Scotland');
  expect(recognizedJurisdiction(['Northern Ireland']).legalSystem).toBe('Northern Ireland');
  expect(recognizedJurisdiction(['UK']).legalSystem).toBe('UK jurisdiction to confirm');
  expect(recognizedJurisdiction(['England or Scotland']).legalSystem).toBe('UK jurisdiction to confirm');
 });
 it('does not mine alpha-2 tokens from ordinary sentences or silently pick among countries',()=>{
  for(const value of ['help us with documents','a hearing in a courthouse','unidentified jurisdiction at Secret Street','Canada and China'])expect(recognizedJurisdiction([value]).recognized).toBe(false);
  expect(recognizedJurisdiction(['IN']).countryCode).toBe('IN');
  expect(recognizedJurisdiction(['unidentified city','Tunisia']).countryCode).toBe('TN');
 });
 it('does not send raw identifiers when building expression-domain approved labels',()=>{
  const i=input();i.country='England; AliceSensitive 555-0109 lives at 77 Hidden Road';
  i.background.description='AliceSensitive alice@example.net was accused of defamation on 2026-10-08.';
  i.background.personType='other';const q=buildResearchQuery(i);const body=JSON.stringify(q);
  expect(body).not.toMatch(/AliceSensitive|555-0109|Hidden Road|2026-10-08|alice@example/);
  // The stated subject travels only as the server's own label.
  expect(q.searchTerms.join(' ')).toMatch(/journalism/);expect(q.searchTerms.join(' ')).toMatch(/defamation/);expect(q.searchTerms.join(' ')).not.toMatch(/fair trial/);
  expect(q.plan.coverage).toBe('limited');
 });
 it('unknown country uses visibly broad comparative terms without forwarding free jurisdiction',()=>{
  const i=input();i.country='SecretCountryNotRecognized';i.publicity='private';
  const q=buildResearchQuery(i);expect(q.jurisdiction.recognized).toBe(false);
  expect(q.searchTerms[0]).toContain('international comparative');expect(JSON.stringify(q)).not.toContain(i.country);
 });
 it('never turns negative narrative keywords or existing counsel into structured problems',()=>{
  const i=input();i.background.description='没有被逮捕，不涉及国家安全，也不是诽谤。已有律师，收到律师函。';
  expect(buildResearchQuery(i).topics).toEqual(['journalism freedom of expression']);
 });
 it('keeps confirmed access problems, file access and selected goals ahead of optional query topics',()=>{
  const i=input();i.currentProblems=['lawyer_access','file_access'];i.primaryGoal='release';i.stage='appeal';
  const q=buildResearchQuery(i);expect(q.searchTerms.join(' ')).toMatch(/legal representation/);
  expect(q.searchTerms.join(' ')).toMatch(/case records/);expect(q.searchTerms.join(' ')).toMatch(/release from detention/);expect(q.searchTerms.join(' ')).toMatch(/appeal/);
 });
 it('does not assign a negated UK location when proceedings are in Canada',()=>{
  expect(recognizedJurisdiction(['not England; proceedings are in Canada','Canada']).countryCode).toBe('CA');
  expect(recognizedJurisdiction(['不是英格兰；在加拿大','加拿大']).countryCode).toBe('CA');
  expect(recognizedJurisdiction(['England and Canada']).recognized).toBe(false);
 });
 it.each(['中国','China','CN','Canada'])('ignores retained UK answers after country changes to %s',(country)=>{
  const i=input();i.country=country;
  i.intake={version:1,jurisdiction:country,caseKind:'civil',narrative:'',goalText:'',disclosureDetails:'',answers:[{questionId:'uk-jurisdiction',question:'UK legal system?',answer:'Scotland'}],facts:[],confirmed:true};
  const q=buildResearchQuery(i);expect(q.jurisdiction.countryCode).toBe(country==='Canada'?'CA':'CN');expect(q.jurisdiction.legalSystem).toBeNull();
  expect(q.searchTerms.join(' ')).not.toMatch(/Scotland|United Kingdom/);
 });
 it('prefers the current explicit jurisdiction over a retained UK follow-up',()=>{
  const i=input();
  i.intake={version:1,jurisdiction:'England and Wales',caseKind:'civil',narrative:'',goalText:'',disclosureDetails:'',answers:[{questionId:'uk-jurisdiction',question:'UK legal system?',answer:'Scotland'}],facts:[],confirmed:true};
  expect(buildResearchQuery(i).jurisdiction.legalSystem).toBe('England and Wales');
  i.country='unknown';i.intake.jurisdiction='Canada';expect(buildResearchQuery(i).jurisdiction.countryCode).toBeNull();
 });
 it('does not inherit an old UK system when the country was changed to unknown',()=>{
  const i=input();i.country='unknown';
  i.intake={version:1,jurisdiction:'Northern Ireland',caseKind:'civil',narrative:'',goalText:'',disclosureDetails:'',answers:[{questionId:'uk-jurisdiction',question:'UK legal system?',answer:'Scotland'}],facts:[],confirmed:true};
  expect(buildResearchQuery(i).jurisdiction).toMatchObject({countryCode:null,legalSystem:null});
  i.intake.jurisdiction='UK';expect(buildResearchQuery(i).jurisdiction.legalSystem).toBeNull();
  i.intake.jurisdiction='';expect(buildResearchQuery(i).jurisdiction.legalSystem).toBeNull();
 });

});

describe('only actual search and annotated sources become research',()=>{
 it('preserves bracketed legal citation years while removing short footnote markers',()=>{
  const text='The decision is [2022] UKSC 5, not a footnote. [1]';
  const report=assembleWebResearch(result(text),[]);expect(report.passages[0].text).toContain('[2022] UKSC 5');expect(report.passages[0].text).not.toContain('[1]');
 });
 it('requires a completed search action; opening a page or failed search does not count',()=>{
  for(const call of [{...search,action:{type:'open_page'}},{...search,status:'failed'},{...search,status:'in_progress'}]){
   expect(assembleWebResearch({status:'completed',output:[call,...result().output!.slice(1)]},[])).toMatchObject({status:'unavailable',failureReason:'no_search',searchCallCount:0});
  }
 });
 it('never promotes tool source inventories or handwritten URLs into cited evidence',()=>{
  expect(assembleWebResearch({status:'completed',output:[search,message('Read https://made-up.org/report for proof.',[])]},[])).toMatchObject({status:'no_results',failureReason:'no_citations',sources:[],searchCallCount:1});
 });
 it('assembles only actual annotations, deduplicates sources and counts search actions separately',()=>{
  const text='Case A. ([Court](https://www.judiciary.uk/a))\n\nCase B. ([Court](https://www.judiciary.uk/a))';
  const starts=[text.indexOf('[Court]'),text.lastIndexOf('[Court]')];
  const r=assembleWebResearch({status:'completed',output:[search,{...search,action:{type:'open_page'}},search,message(text,starts.map(s=>citation(text,'https://www.judiciary.uk/a',s,s+10)))]},['canonical query']);
  expect(r.status).toBe('completed');expect(r.searchCallCount).toBe(2);expect(r.sources).toHaveLength(1);expect(r.sources[0].sourceId).toBe('web-1');expect(r.passages).toHaveLength(2);
  for(const p of r.passages){expect(p.sourceIds).toEqual(['web-1']);expect(p.text).not.toContain('https://');}
  expect(JSON.stringify(r.sources)).not.toContain('uncited.org');WebResearchSchema.parse(r);
 });
 it('does not carry uncited paragraphs or upgrade unannotated links',()=>{
  const text='Unsupported extra claim.\n\nCase A established a narrow point. See [unverified](https://fake.org/x), https://raw.org/no and www.alsofake.org. citeturn0search0';
  const start=text.indexOf('cite');const r=assembleWebResearch(result(text,[citation(text,'https://court.gov/case',start,text.length)]),[]);
  expect(r.passages).toHaveLength(1);expect(r.passages[0].text).not.toContain('Unsupported');
  expect(r.passages[0].text).not.toMatch(/https?:|www\.|||/);expect(r.sources.map(s=>s.url)).toEqual(['https://court.gov/case']);
 });
 it('handles emoji before a code-point citation and does not assign it to an earlier paragraph',()=>{
  const text='😀😀 Header without source.\n\nA case paragraph. [court](https://court.gov/x)';
  const codePointStart=Array.from(text.slice(0,text.indexOf('[court]'))).length;
  const codePointEnd=Array.from(text).length;
  const r=assembleWebResearch(result(text,[citation(text,'https://court.gov/x',codePointStart,codePointEnd)]),[]);
  expect(r.passages).toHaveLength(1);expect(r.passages[0].text).toContain('A case paragraph');expect(r.passages[0].text).not.toContain('Header');
 });
 it('supports zero-width citations at paragraph ends and rejects invalid offsets',()=>{
  const text='A public case has a reported outcome.';
  expect(assembleWebResearch(result(text,[citation(text,'https://court.gov/x',text.length,text.length)]),[]).status).toBe('completed');
  for(const [s,e] of [[-1,4],[5,2],[0,900],[1.5,9]])expect(assembleWebResearch(result(text,[citation(text,'https://court.gov/x',s,e)]),[]).failureReason).toBe('no_citations');
 });
 it('rejects incomplete model output even if it contains citations',()=>{
  expect(assembleWebResearch({...result(),status:'incomplete'},[])).toMatchObject({status:'unavailable',failureReason:'invalid_output'});
 });
 it('enforces bounded source and passage counts while retaining reference integrity',()=>{
  const output:unknown[]=[search];for(let n=0;n<50;n++)output.push(message(`Public case ${n}`, [citation(`Public case ${n}`,`https://court.gov/${n}`)]));
  const r=assembleWebResearch({status:'completed',output},[]);expect(r.sources).toHaveLength(30);expect(r.passages.length).toBeLessThanOrEqual(40);
  const ids=new Set(r.sources.map(s=>s.sourceId));for(const p of r.passages)for(const id of p.sourceIds)expect(ids.has(id)).toBe(true);
 });
 const probePath='test-results/web-search-provider-probe.json';
 it.skipIf(!existsSync(probePath))('parses the saved real-provider response offline without promoting its full source inventory',()=>{
  const probe=JSON.parse(readFileSync(probePath,'utf8')) as WebSearchResponse;
  const r=assembleWebResearch(probe,['England and Wales defamation journalist judgment']);
  expect(r.status).toBe('completed');expect(r.searchCallCount).toBe(1);expect(r.sources).toHaveLength(2);expect(r.passages).toHaveLength(2);
  expect(r.sources.every(s=>s.hostname==='www.judiciary.uk')).toBe(true);expect(r.passages.every(p=>!p.text.includes('https://'))).toBe(true);
 });
});

describe('citation URL boundaries',()=>{
 it.each(['javascript:alert(1)','data:text/html,x','file:///etc/passwd','ftp://public.org/a','http://localhost/a','http://127.0.0.1/a','http://2130706433/a','http://0x7f000001/a','http://10.0.0.1/a','http://172.16.1.1/a','http://192.168.1.1/a','http://169.254.169.254/latest','http://100.64.0.1/a','http://[::1]/a','http://[fd00::1]/a','http://[fe80::1]/a','http://[::ffff:127.0.0.1]/a','http://[2001:db8::1]/a','https://user:secret@court.gov/a','https://server.internal/a','https://device.local/a','https://127.0.0.1.nip.io/a','https://example.test/a','https://court.gov\\@localhost/a'])('rejects nonpublic or unsafe URL %s',(url)=>expect(safePublicUrl(url)).toBeNull());
 it('allows public HTTPS domain citations without requiring a fixed organization list',()=>{
  expect(safePublicUrl('https://www.judiciary.uk/a?b=1#paragraph-2')).toBe('https://www.judiciary.uk/a?b=1#paragraph-2');
  expect(safePublicUrl('https://www.constitutionalcourt.org.za/judgment')).toBeTruthy();
  expect(safePublicUrl('https://8.8.8.8/report')).toBeTruthy();
 });
 it('drops unsafe annotations instead of displaying their title or URL',()=>{
  expect(assembleWebResearch(result('Some text',[citation('Some text','http://127.0.0.1/private')]),[])).toMatchObject({status:'no_results',sources:[],passages:[]});
 });
});

describe('paragraph links backed by this response’s completed web tools',()=>{
 const url='https://court.gov/contract-decision';
 const paragraph=(link=url)=>`A public civil case examined whether a service provider caused a customer's financial loss. [Official decision](${link})`;
 const withInventory=(urls:string[])=>({...search,action:{type:'search',sources:urls.map(url=>({type:'url',url}))}});
 it('accepts an inline link only when that exact URL was returned by a completed search',()=>{
  const r=assembleWebResearch({status:'completed',output:[withInventory([url,'https://court.gov/unused']),message(paragraph(),[])]},[]);
  expect(r.status).toBe('completed');expect(r.sources).toHaveLength(1);expect(r.sources[0]).toMatchObject({url,citationKind:'tool_returned_link'});
  expect(r.passages).toHaveLength(1);expect(r.passages[0].text).not.toContain('https://');
 });
 it('accepts an exact completed open_page URL while still requiring a completed search',()=>{
  const open={type:'web_search_call',status:'completed',action:{type:'open_page',url}};
  expect(assembleWebResearch({status:'completed',output:[search,open,message(paragraph(),[])]},[]).sources[0].citationKind).toBe('tool_returned_link');
  expect(assembleWebResearch({status:'completed',output:[open,message(paragraph(),[])]},[]).failureReason).toBe('no_search');
 });
 it('rejects handcrafted links, inventory-only sources and raw non-inline URLs',()=>{
  for(const text of [paragraph('https://court.gov/invented'),`A public civil case examined a contractual liability question. ${url}`]){
   expect(assembleWebResearch({status:'completed',output:[withInventory([url]),message(text,[])]},[])).toMatchObject({status:'no_results',sources:[]});
  }
 });
 it('does not accept failed tools, incomplete tools or inventories from earlier responses',()=>{
  const previous=assembleWebResearch({status:'completed',output:[withInventory([url]),message(paragraph(),[])]},[]);expect(previous.sources).toHaveLength(1);
  for(const tool of [{...withInventory([url]),status:'failed'},{...withInventory([url]),status:'in_progress'},{type:'web_search_call',status:'failed',action:{type:'open_page',url}},null]){
   const r=assembleWebResearch({status:'completed',output:[search,tool,message(paragraph(),[])]},[]);expect(r).toMatchObject({status:'no_results',sources:[]});
  }
 });
 it('does not use a bibliography or link list as a blanket citation for uncited report text',()=>{
  const text=`An unsupported report paragraph claims that several parties won unrelated cases.\n\nSources: materials for all of the above factual claims are available here: [Decision](${url})\n\n- [A long title that cannot itself establish support for the entire report](${url})`;
  expect(assembleWebResearch({status:'completed',output:[withInventory([url]),message(text,[])]},[])).toMatchObject({status:'no_results',passages:[],sources:[]});
 });
 it('binds the link to its own paragraph and retains the existing paragraph length cap',()=>{
  const text=`An uncited paragraph with no supporting link.\n\n${paragraph()}\n\n${'long '.repeat(1700)} [Decision](${url})`;
  const r=assembleWebResearch({status:'completed',output:[withInventory([url]),message(text,[])]},[]);
  expect(r.passages).toHaveLength(1);expect(r.passages[0].text).toContain('service provider');expect(r.passages[0].text).not.toContain('uncited');
 });
 it('normalizes Unicode URL encoding and hex case without relaxing exact path or query equality',()=>{
  const unicode='https://court.gov/裁判/案例?类型=合同';const encoded=new URL(unicode).href.toLowerCase();
  const r=assembleWebResearch({status:'completed',output:[withInventory([encoded]),message(paragraph(unicode),[])]},[]);
  expect(r.status).toBe('completed');expect(r.sources).toHaveLength(1);
  for(const wrong of [`${unicode}&extra=1`,'https://court.gov/%2Fdecision','https://court.gov/other']){
   expect(assembleWebResearch({status:'completed',output:[withInventory([unicode,'https://court.gov//decision']),message(paragraph(wrong),[])]},[]).sources).toEqual([]);
  }
 });
 it('native annotations take priority within a paragraph and for a shared source',()=>{
  const text=paragraph();const native='https://court.gov/native-only';
  const r=assembleWebResearch({status:'completed',output:[withInventory([url]),message(text,[citation(text,native)])]},[]);
  expect(r.sources).toHaveLength(1);expect(r.sources[0]).toMatchObject({url:native,citationKind:'url_annotation'});
  const shared=assembleWebResearch({status:'completed',output:[withInventory([url]),message(text,[]),message('A later native-cited passage.',[citation('A later native-cited passage.',url)])]},[]);
  expect(shared.sources).toHaveLength(1);expect(shared.sources[0].citationKind).toBe('url_annotation');
 });
 it('does not downgrade an unsafe or invalid native citation into a fallback link',()=>{
  for(const annotation of [citation(paragraph(),'http://127.0.0.1/private'),citation(paragraph(),url,-1,1)]){
   expect(assembleWebResearch({status:'completed',output:[withInventory([url]),message(paragraph(),[annotation])]},[]).sources).toEqual([]);
  }
 });
 it('applies public URL screening even when an unsafe URL appears in tool output',()=>{
  const privateUrl='http://127.0.0.1/private';expect(assembleWebResearch({status:'completed',output:[withInventory([privateUrl]),message(paragraph(privateUrl),[])]},[]).sources).toEqual([]);
 });
 const actualPath='test-results/semantic-rework/delta-search.json';
 it.skipIf(!existsSync(actualPath))('restores the real three-case fixture offline, including a version without native annotations',()=>{
  const actual=JSON.parse(readFileSync(actualPath,'utf8')) as WebSearchResponse;
  const native=assembleWebResearch(actual,[]);expect(native.status).toBe('completed');expect(native.sources).toHaveLength(3);
  const withoutAnnotations=JSON.parse(JSON.stringify(actual)) as WebSearchResponse;
  for(const item of withoutAnnotations.output??[]){const value=item as {type?:string;content?:Array<{annotations?:unknown[]}>};if(value.type==='message')for(const part of value.content??[])part.annotations=[];}
  const recovered=assembleWebResearch(withoutAnnotations,[]);expect(recovered.status).toBe('completed');expect(recovered.sources).toHaveLength(3);expect(recovered.passages).toHaveLength(3);
  expect(recovered.sources.every(source=>source.citationKind==='tool_returned_link')).toBe(true);
 });
});

describe('explicitly disabled OpenAI search',()=>{
 it('does not launch built-in tool search when disabled, even with a configured model',async()=>{
  const network=vi.fn();vi.stubGlobal('fetch',network);
  await expect(openAIWebSearchTransport({config,query:buildResearchQuery(input()),signal:new AbortController().signal,locale:'en'})).rejects.toMatchObject({code:'WEB_SEARCH_DISABLED'});
  expect(network).not.toHaveBeenCalled();
 });
});

describe('research transport and cancellation',()=>{
 it('injects only safe query labels and returns annotated research',async()=>{
  const mock=transport(result());const i=input();i.country='England ConfidentialRawValue';
  const r=await researchWeb(i,config,undefined,mock,'en');
  expect(r.status).toBe('completed');const args=vi.mocked(mock).mock.calls[0][0];expect(JSON.stringify(args.query)).not.toContain('ConfidentialRawValue');expect(args.locale).toBe('en');
  expect(Object.keys(args)).toEqual(['config','query','signal','locale']);
 });
 it('does not start work when pre-cancelled',async()=>{
  const c=new AbortController();c.abort();const mock=transport(result());
  await expect(researchWeb(input(),config,c.signal,mock)).rejects.toMatchObject({code:'CANCELLED'});expect(mock).not.toHaveBeenCalled();
 });
 it('cancels even a transport that ignores AbortSignal and ignores a late response',async()=>{
  const c=new AbortController();let resolve!:(v:WebSearchResponse)=>void;const mock:WebSearchTransport=vi.fn(()=>new Promise<WebSearchResponse>(r=>{resolve=r;}));
  const task=researchWeb(input(),config,c.signal,mock);const rejected=expect(task).rejects.toMatchObject({code:'CANCELLED'});c.abort();await rejected;
  resolve(result());await Promise.resolve();expect(mock).toHaveBeenCalledTimes(1);
 });
 it('uses independent 65s timeout rather than the analysis timeout and never retries',async()=>{
  vi.useFakeTimers();const mock:WebSearchTransport=vi.fn(()=>new Promise<WebSearchResponse>(()=>{}));
  const task=researchWeb(input(),config,undefined,mock);let settled=false;void task.then(()=>{settled=true;});
  await vi.advanceTimersByTimeAsync(50_000);expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(WEB_SEARCH_TIMEOUT_MS-50_000);
  await expect(task).resolves.toMatchObject({status:'unavailable',failureReason:'timeout'});expect(mock).toHaveBeenCalledTimes(1);
 });
 it('returns unavailable for failures and does not leak provider error messages',async()=>{
  const mock:WebSearchTransport=vi.fn(async()=>{throw new Error('private upstream credentials details');});
  const r=await researchWeb(input(),config,undefined,mock);expect(r).toMatchObject({status:'unavailable',failureReason:'search_failed'});expect(JSON.stringify(r)).not.toContain('credentials');
 });
 it('does not use ambient credentials when config is incomplete',async()=>{
  const mock=transport(result());const r=await researchWeb(input(),{...config,key:'',configured:false},undefined,mock);
  expect(r.status).toBe('unavailable');expect(mock).not.toHaveBeenCalled();
 });
});

describe('source URL keys',()=>{
 it('ignore only utm_* tracking parameters',async()=>{
  const {citationUrlKey}=await import('../src/lib/research/provider');
  expect(citationUrlKey('https://lawphil.net/a.html?utm_source=openai')).toBe('https://lawphil.net/a.html');
  expect(citationUrlKey('https://x.org/p?id=3&utm_source=openai&utm_medium=x#frag')).toBe('https://x.org/p?id=3#frag');
  expect(citationUrlKey('https://x.org/p?id=3')).toBe('https://x.org/p?id=3');
  expect(citationUrlKey('https://x.org/%e4%b8%ad?q=%2f')).toBe('https://x.org/%E4%B8%AD?q=%2F');
  expect(citationUrlKey('https://x.org/a/')).not.toBe(citationUrlKey('https://x.org/a'));
 });
});
