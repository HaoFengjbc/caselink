import {controlledSearchTransport,controlledSearchConfigured,ControlledSearchFailure} from './controlled-search';
import {isIP} from 'node:net';
import type {NewCaseInput} from '../contracts';
import type {ServerConfig} from '../ai/config';
import {AnalysisError} from '../ai/errors';
import type {Locale} from '../i18n/locale';
import {WebResearchSchema,type WebResearch,type WebSource} from './contracts';
import {buildResearchQuery,type SafeResearchQuery} from './query';
import {structuredResearchPlan,unsafePublicText} from './plan';
import {type ResearchPlannerTransport} from './planner';
export type {ResearchPlannerTransport} from './planner';

export const WEB_SEARCH_TIMEOUT_MS=65_000;
export type WebSearchResponse={status?:string;output?:unknown[];requireOpenedSources?:boolean;readSourceUrls?:string[]};
export type WebSearchTransport=(args:{config:ServerConfig;query:SafeResearchQuery;signal:AbortSignal;locale:Locale})=>Promise<WebSearchResponse>;

// No LLM search instructions are executed in this version. The approved public
// vocabulary and literal requests live in query.ts and controlled-search.ts.
export const SEARCH_INSTRUCTIONS='Controlled public query retrieval only; no autonomous model search.';

/** Legacy named transport deliberately disabled: autonomous tools cannot enforce query vocabulary. */
export const openAIWebSearchTransport:WebSearchTransport=async()=>{throw new AnalysisError('WEB_SEARCH_DISABLED','自主联网工具已关闭。请配置受控搜索接口，或使用正式案例库。',503,{retryable:false});};

type ObjectValue=Record<string,unknown>;
const object=(value:unknown):ObjectValue|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as ObjectValue:null;
const textOnly=(text:string)=>text
 .replace(/\[([^\]]*)\]\([^\n]*?\)/g,'$1')
 .replace(/[\uE200-\uE20F][^\uE201\n]*\uE201/g,'')
 .replace(/<[^>]*>/g,'')
 .replace(/(?:https?:\/\/|www\.)[^\s<>\])}]+/gi,'[link omitted]')
 .replace(/(?:javascript|data|file|vbscript):[^\s<>]+/gi,'[link omitted]')
 .replace(/\[\d+(?:[,; -]\d+)*\]/g,'')
 .replace(/\(\s*\)/g,'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').trim();

/** Link validation, not a fetch: only public-shaped HTTP(S) URLs may be displayed. */
export function safePublicUrl(value:unknown):string|null{
 if(typeof value!=='string'||value.length>3000||/[\u0000-\u0020\u007F\\]/.test(value))return null;
 let url:URL;try{url=new URL(value);}catch{return null;}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;
 const host=url.hostname.toLowerCase().replace(/\.$/,'');
 const address=host.replace(/^\[|\]$/g,'');
 const family=isIP(address);
 if(family===4){
  const [a,b,c]=address.split('.').map(Number);
  if(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113))return null;
 }else if(family===6){
  // Only global-unicast-shaped IPv6, excluding transition and documentation space.
  if(!/^[23][0-9a-f]{3}:/.test(address)||/^2001:(?:0:|2:|10:|20:|db8:)/.test(address)||address.startsWith('2002:')||address.startsWith('3fff:'))return null;
 }else{
  if(!host.includes('.')||!/[a-z]/i.test(host)||/(?:^|\.)(?:localhost|local|internal|intranet|lan|home|test|invalid|example|onion)$/.test(host))return null;
  if(host.endsWith('.localhost.localdomain')||host==='localhost.localdomain'||host.endsWith('.nip.io')||host.endsWith('.sslip.io')||host.endsWith('.localtest.me'))return null;
 }
 // Avoid normalizing away suspicious userinfo or accepting an empty/invalid host.
 if(!host)return null;
 return url.href;
}

type Span={start:number;end:number;text:string};
type Citation={url:string;title:string;start:number;end:number;kind:'url_annotation'|'tool_returned_link'};
function paragraphSpans(text:string):Span[]{
 const spans:Span[]=[];let start=0;
 for(const match of text.matchAll(/\n[\t ]*\n+/g)){
  const end=match.index!;if(text.slice(start,end).trim())spans.push({start,end,text:text.slice(start,end)});
  start=end+match[0].length;
 }
 if(text.slice(start).trim())spans.push({start,end:text.length,text:text.slice(start)});
 // A single overlong paragraph cannot safely preserve citation-to-text alignment.
 return spans.filter(s=>s.text.length<=8000);
}
function citationRange(text:string,start:number,end:number):{start:number;end:number}|null{
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start)return null;
 const candidates:Array<{start:number;end:number}>=[];
 if(end<=text.length)candidates.push({start,end});
 // API offsets can be code points; JavaScript slices use UTF-16 code units.
 const codePoints=Array.from(text);
 if(end<=codePoints.length){
  const mapped={start:codePoints.slice(0,start).join('').length,end:codePoints.slice(0,end).join('').length};
  if(!candidates.some(c=>c.start===mapped.start&&c.end===mapped.end))candidates.push(mapped);
 }
 if(!candidates.length)return null;
 // Prefer a range beginning at a real citation token or Markdown link; this disambiguates emoji offsets.
 const explicit=candidates.find(c=>/^(?:\(?\[[^\]]*\]\(|[\uE200-\uE20F])/.test(text.slice(c.start,c.end+1)));
 return explicit??candidates[0];
}
function paragraphForCitation(spans:Span[],citation:{start:number;end:number}):Span|undefined{
 if(citation.start===citation.end){
  // A zero-width citation at the end of a paragraph belongs to that paragraph.
  return spans.find(s=>citation.start>=s.start&&citation.start<=s.end);
 }
 // Never spread a citation across multiple paragraphs: bind it to where the marker starts.
 return spans.find(s=>citation.start>=s.start&&citation.start<s.end);
}

// URL() percent-encodes Unicode. Normalize hex case only; do not decode reserved
// separators, drop fragments, reorder queries, or treat domains as interchangeable.
const citationUrlKey=(url:string)=>url.replace(/%[0-9a-f]{2}/gi,escape=>escape.toUpperCase());
function returnedToolUrls(items:ObjectValue[]):Set<string>{
 const urls=new Set<string>();
 for(const item of items){
  if(item.type!=='web_search_call'||item.status!=='completed')continue;
  const action=object(item.action);if(!action)continue;
  const candidates=[...(Array.isArray(action.sources)?action.sources.map(source=>object(source)?.url):[]),...(action.type==='open_page'?[action.url]:[])];
  for(const candidate of candidates){const url=safePublicUrl(candidate);if(url)urls.add(citationUrlKey(url));}
 }
 return urls;
}
function toolReturnedParagraphCitations(span:Span,returnedUrls:Set<string>):Citation[]{
 const links=[...span.text.matchAll(/\[([^\]\n]{1,500})\]\((https?:\/\/[^\s)]+)\)/g)];
 if(!links.length)return [];
 const body=span.text.replace(/\[[^\]\n]*\]\([^\n]*?\)/g,'').replace(/[*_#`]/g,'').trim();
 // A bibliography or naked link list cannot retroactively cite the whole report.
 if(/^(?:sources?|references?|bibliography|参考(?:资料|文献|来源)?|資料來源|资料来源|来源|來源|相关链接)\s*[:：]?/iu.test(body)||body.replace(/[\p{P}\p{S}\s]/gu,'').length<30)return [];
 return links.flatMap(link=>{
  const url=safePublicUrl(link[2]);if(!url||!returnedUrls.has(citationUrlKey(url)))return [];
  return [{url,title:textOnly(link[1]).slice(0,500),start:span.start+link.index!,end:span.start+link.index!+link[0].length,kind:'tool_returned_link' as const}];
 });
}

/** Native annotations first; a paragraph-local inline link may fall back only to
 * an exact public URL actually returned by a completed tool in this response. */
export function assembleWebResearch(response:WebSearchResponse,searchTerms:string[],searchedAt=new Date().toISOString()):WebResearch{
 const failure=(status:WebResearch['status'],reason:WebResearch['failureReason'],count=0):WebResearch=>({status,searchedAt,searchTerms,passages:[],sources:[],searchCallCount:Math.min(count,20),failureReason:reason,actualQueries:[],relevanceStatus:'not_assessed'});
 if(response.status!=='completed'||!Array.isArray(response.output))return failure('unavailable','invalid_output');
 const items=response.output.map(object).filter((x):x is ObjectValue=>!!x);
 const searches=items.filter(item=>item.type==='web_search_call'&&item.status==='completed'&&object(item.action)?.type==='search');
 if(!searches.length)return failure('unavailable','no_search');
 const returnedUrls=returnedToolUrls(items);
 const completedOpens=new Set(items.flatMap(item=>{const action=object(item.action);const url=item.type==='web_search_call'&&item.status==='completed'&&action?.type==='open_page'?safePublicUrl(action.url):null;return url?[citationUrlKey(url)]:[];}));
 const openedUrls=new Set((response.readSourceUrls??[]).flatMap(value=>{const url=safePublicUrl(value);const key=url?citationUrlKey(url):'';return key&&completedOpens.has(key)?[key]:[];}));
 const actualQueries=[...new Set(searches.flatMap(item=>{const action=object(item.action);return [action?.query,...(Array.isArray(action?.queries)?action.queries:[])].filter((value):value is string=>typeof value==='string'&&value.length<=700&&!unsafePublicText(value));}))].slice(0,40);
 const sources:WebSource[]=[];const sourceByUrl=new Map<string,WebSource>();const passages:WebResearch['passages']=[];
 for(const item of items){
  if(item.type!=='message'||(item.status&&item.status!=='completed')||!Array.isArray(item.content))continue;
  for(const rawPart of item.content){
   const part=object(rawPart);
   if(part?.type!=='output_text'||typeof part.text!=='string'||part.text.length>100_000)continue;
   const fullText=part.text;const spans=paragraphSpans(fullText);
   const bindings=new Map<Span,Citation[]>();
   const nativeSpans=new Set<Span>();let invalidNativeRange=false;
   for(const raw of Array.isArray(part.annotations)?part.annotations:[]){
    const annotation=object(raw);if(annotation?.type!=='url_citation')continue;
    const range=citationRange(fullText,annotation.start_index as number,annotation.end_index as number);if(!range){invalidNativeRange=true;continue;}
    const span=paragraphForCitation(spans,range);if(!span){invalidNativeRange=true;continue;}
    nativeSpans.add(span);
    const url=safePublicUrl(annotation.url);if(!url)continue;
    const citation:Citation={...range,url,title:typeof annotation.title==='string'?textOnly(annotation.title).slice(0,500):'',kind:'url_annotation'};
    const list=bindings.get(span)??[];list.push(citation);bindings.set(span,list);
   }
   for(const span of spans){
    if(passages.length>=40)break;
    const citations=bindings.get(span)??(!nativeSpans.has(span)&&!invalidNativeRange?toolReturnedParagraphCitations(span,returnedUrls):[]);if(!citations.length)continue;
    // Reject the entire mixed paragraph, rather than keeping one read citation
    // next to claims that also rely on an unopened page.
    if(response.requireOpenedSources&&citations.some(citation=>!openedUrls.has(citationUrlKey(citation.url))))continue;
    const text=textOnly(span.text);if(!text)continue;
    const sourceIds:string[]=[];
    for(const citation of citations){
     const key=citationUrlKey(citation.url);let source=sourceByUrl.get(key);
     if(!source){
      if(sources.length>=30)continue;
      const hostname=new URL(citation.url).hostname;
      source={sourceId:`web-${sources.length+1}`,url:citation.url,title:citation.title||hostname,hostname,citationKind:citation.kind,pageOpened:response.requireOpenedSources===true};sources.push(source);sourceByUrl.set(key,source);
     }
     if(citation.kind==='url_annotation')source.citationKind='url_annotation';
     if(!sourceIds.includes(source.sourceId))sourceIds.push(source.sourceId);
    }
    if(sourceIds.length)passages.push({text,sourceIds});
   }
  }
 }
 if(!sources.length||!passages.length)return {...failure('no_results','no_citations',searches.length),actualQueries};
 const parsed=WebResearchSchema.safeParse({status:'completed',searchedAt,searchTerms,passages,sources,searchCallCount:Math.min(searches.length,20),failureReason:null,actualQueries,relevanceStatus:'not_assessed'});
 return parsed.success?parsed.data:failure('unavailable','invalid_output',searches.length);
}

export type ResearchWebOptions={
 plannerTransport?:ResearchPlannerTransport;
 attempt?:1|2;
 previousResearch?:WebResearch;
 deadlineAt?:number;
};

export async function researchWeb(input:NewCaseInput,config:ServerConfig,signal?:AbortSignal,transport:WebSearchTransport=controlledSearchTransport,locale:Locale='zh',options:ResearchWebOptions={}):Promise<WebResearch>{
 const cancelled=()=>new AnalysisError('CANCELLED','本次联网研究已取消。',499);
 if(signal?.aborted)throw cancelled();
 const attempt=options.attempt??1,searchedAt=new Date().toISOString(),query=buildResearchQuery(input,structuredResearchPlan(input),attempt);
 const finish=(result:WebResearch):WebResearch=>WebResearchSchema.parse({...result,plan:query.plan,planningMode:'structured_fallback',relevanceStatus:'not_assessed',attempts:[{attempt,reason:attempt===1?'initial':'manual_supplement',startedAt:searchedAt,status:result.status,searchTerms:result.searchTerms,actualQueries:result.actualQueries??[],searchCallCount:result.searchCallCount,sourceCount:result.sources.length,failureReason:result.failureReason}]});
 const failed=(reason:WebResearch['failureReason'],actualQueries:string[]=[]):WebResearch=>finish({status:'unavailable',searchedAt,searchTerms:query.searchTerms,actualQueries,passages:[],sources:[],searchCallCount:actualQueries.length,failureReason:reason});
 if(!config.configured||!config.key||!config.model)return failed('search_failed');
 if(transport===openAIWebSearchTransport||(transport===controlledSearchTransport&&!controlledSearchConfigured()))return failed('web_search_disabled');
 // The semantic planner is not invoked: a one-round server vocabulary needs no model call.
 const controller=new AbortController(),cancel=()=>controller.abort();
 signal?.addEventListener('abort',cancel,{once:true});const timeout=Math.min(WEB_SEARCH_TIMEOUT_MS,(options.deadlineAt??Date.now()+WEB_SEARCH_TIMEOUT_MS)-Date.now());
 if(timeout<=0)return failed('budget_exhausted');
 let onAbort=()=>{};const aborted=new Promise<never>((_,reject)=>{onAbort=()=>reject(cancelled());controller.signal.addEventListener('abort',onAbort,{once:true});});
 let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeout);
 try{
  const response=await Promise.race([transport({config,query,signal:controller.signal,locale}),aborted]);
  if(signal?.aborted)throw cancelled();if(timedOut)return failed('timeout');
  return finish(assembleWebResearch(response,query.searchTerms,searchedAt));
 }catch(error){const cause=error as {code?:string;name?:string};if(signal?.aborted||(!timedOut&&cause.code==='CANCELLED'))throw cancelled();return failed(timedOut||cause.code==='TIMEOUT'||['TimeoutError','APIConnectionTimeoutError'].includes(cause.name??'')?'timeout':'search_failed',error instanceof ControlledSearchFailure?error.actualQueries:[]);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.signal.removeEventListener('abort',onAbort);}
}
