import type {WebSearchTransport,WebSearchResponse} from './provider';
import {safePublicUrl} from './provider';
import {AnalysisError} from '../ai/errors';
import {recordSearch} from '../ai/execution';
import {buildResearchQuery} from './query';
import {EMPTY_INPUT,type NewCaseInput} from '../contracts';
import {resolveJurisdiction} from '../jurisdiction';

export function controlledSearchConfigured(env:Readonly<Record<string,string|undefined>>=process.env):boolean{return env.CONTROLLED_SEARCH_ENABLED==='true'&&!!env.BRAVE_SEARCH_API_KEY?.trim();}
type BraveHit={url?:unknown;title?:unknown;description?:unknown};
export class ControlledSearchFailure extends Error{constructor(public actualQueries:string[],public searchCallCount:number){super('controlled_search_failed');}}
const clean=(value:unknown,limit:number)=>typeof value==='string'?value.replace(/<[^>]*>/g,'').replace(/[\u0000-\u001f]/g,' ').slice(0,limit):'';
/** Server executes literal approved q values. No model, tool, page or snippet can initiate another search. */
export function createControlledSearchTransport(fetcher:typeof fetch=fetch,env:Readonly<Record<string,string|undefined>>=process.env,record:typeof recordSearch=recordSearch):WebSearchTransport{
 return async ({query,signal})=>{
  if(!controlledSearchConfigured(env))throw new AnalysisError('WEB_SEARCH_DISABLED','受控联网未配置，保留正式库参考。',503,{retryable:false});
  // Reconstruct from canonical structured labels. Never serialize free-form plan/narrative.
  const canonicalInput:NewCaseInput={...structuredClone(EMPTY_INPUT),country:query.jurisdiction.countryCode??'unknown',stage:query.stage,intake:{version:1,jurisdiction:query.jurisdiction.jurisdictionCode,caseKind:query.caseKind,narrative:'',goalText:'',disclosureDetails:'',answers:[],facts:[],confirmed:true,expression:'yes'}};
  const jurisdiction=resolveJurisdiction(canonicalInput);
  if(JSON.stringify(jurisdiction)!==JSON.stringify(query.jurisdiction))throw new Error('noncanonical_jurisdiction');
  // Full equality to a new server-owned plan prevents callers from smuggling query text.
  // Validate against exact templates with one of the fixed goal codes. No fuzzy/PII filtering.
  const possible=new Set<string>();
  for(const goal of ['release','lawyer','conditions','drop_charges','change_judgment','other','unknown'] as const){
   for(const term of buildResearchQuery({...canonicalInput,primaryGoal:goal},query.plan,query.attempt).searchTerms)possible.add(term);
  }
  if(query.searchTerms.length>2||query.searchTerms.some(term=>!possible.has(term)))throw new Error('unapproved_search_query');
  const output:unknown[]=[],actualQueries:string[]=[];
  for(const term of query.searchTerms){
   if(signal.aborted)throw new AnalysisError('CANCELLED','本次研究已取消。',499);
   const url=new URL('https://api.search.brave.com/res/v1/web/search');url.searchParams.set('q',term);url.searchParams.set('count','3');url.searchParams.set('spellcheck','false');url.searchParams.set('text_decorations','false');url.searchParams.set('result_filter','web');
   actualQueries.push(term);
   let body:{query?:{original?:string;altered?:string;spellcheck_off?:boolean};web?:{results?:BraveHit[]}};
   try{body=await record(async()=>{
    const response=await fetcher(url,{headers:{Accept:'application/json','X-Subscription-Token':env.BRAVE_SEARCH_API_KEY!},signal,redirect:'error',cache:'no-store'});
    if(!response.ok){const error=new Error('controlled_search_failed');Object.assign(error,{status:response.status});throw error;}
    const parsed=await response.json() as typeof body;
    if(parsed.query?.altered||parsed.query?.original&&parsed.query.original!==term)throw new Error('provider_query_contract_violation');
    return parsed;
   });}catch{throw new ControlledSearchFailure(actualQueries,actualQueries.length);}
   const hits=(body.web?.results??[]).slice(0,3).flatMap(hit=>{const sourceUrl=safePublicUrl(hit.url),title=clean(hit.title,240),snippet=clean(hit.description,2000);return sourceUrl&&title&&snippet?[{url:sourceUrl,title,snippet}]:[];});
   output.push({type:'web_search_call',status:'completed',action:{type:'search',query:term,sources:hits.map(h=>({type:'url',url:h.url,title:h.title}))}});
   for(const hit of hits){
    const text=`Search result excerpt only; source page not opened or verified. ${hit.title}: ${hit.snippet}`;
    output.push({type:'message',content:[{type:'output_text',text,annotations:[{type:'url_citation',url:hit.url,title:hit.title,start_index:0,end_index:text.length}]}]});
   }
  }
  return {status:'completed',output,requireOpenedSources:false,readSourceUrls:[]} satisfies WebSearchResponse;
 };
}
export const controlledSearchTransport:WebSearchTransport=async args=>createControlledSearchTransport()(args);
