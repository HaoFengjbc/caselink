import dns from 'node:dns';
import {request as httpRequest,type IncomingMessage,type RequestOptions} from 'node:http';
import {request as httpsRequest} from 'node:https';
import type {LookupFunction} from 'node:net';
import {publicIpAddress,safePublicUrl} from './provider';
import {originalMaterialQuote} from '../materials/citations';
import {parseMaterials} from '../materials/parse';

const MAX_BYTES=3_000_000,PAGE_TIMEOUT_MS=8000,MAX_REDIRECTS=3,MAX_PAGES=6;

/** DNS answers are checked before connecting, so a public name cannot point the server at a private address. */
export const publicLookup:LookupFunction=(hostname,options,callback)=>{
 dns.lookup(hostname,{...options,all:true},(error,addresses)=>{
  if(error)return callback(error,'',4);
  const list=addresses as unknown as {address:string;family:number}[];
  if(!list.length||list.some(entry=>!publicIpAddress(entry.address)))return callback(Object.assign(new Error('non_public_address'),{code:'ENOTPUBLIC'}),'',4);
  if((options as {all?:boolean}).all)return (callback as unknown as (error:null,addresses:{address:string;family:number}[])=>void)(null,list);
  callback(null,list[0]!.address,list[0]!.family);
 });
};

function get(url:URL,signal:AbortSignal):Promise<{response:IncomingMessage;body:Buffer}>{
 return new Promise((resolve,reject)=>{
  const options:RequestOptions={method:'GET',lookup:publicLookup,signal,headers:{'user-agent':'CaseLink source check (public legal text)',accept:'text/html,application/xhtml+xml,text/plain,application/pdf;q=0.9'},timeout:PAGE_TIMEOUT_MS};
  const request=(url.protocol==='https:'?httpsRequest:httpRequest)(url,options,response=>{
   const chunks:Buffer[]=[];let size=0;
   response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>MAX_BYTES){request.destroy(new Error('too_large'));return;}chunks.push(chunk);});
   response.on('end',()=>resolve({response,body:Buffer.concat(chunks)}));
   response.on('error',reject);
  });
  request.on('timeout',()=>request.destroy(new Error('timeout')));
  request.on('error',reject);
  request.end();
 });
}

const ENTITIES:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',sect:'§',hellip:'…'};
/** Readable text of an HTML page: scripts and styles dropped, blocks become line breaks, entities decoded. */
export function htmlToText(html:string):string{
 return html
  .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1\s*>/gi,' ')
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/article|\/blockquote)\b[^>]*>/gi,'\n')
  .replace(/<[^>]+>/g,' ')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(match,entity:string)=>{
   if(entity[0]==='#'){const code=entity[1]?.toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return Number.isFinite(code)&&code>0&&code<0x110000?String.fromCodePoint(code):' ';}
   return ENTITIES[entity.toLowerCase()]??match;
  })
  .replace(/[ \t\f\v ]+/g,' ').replace(/ *\n[ \n]*/g,'\n').trim();
}

/**
 * The text of a public page, fetched by the server itself. Only public addresses are contacted, every
 * redirect is checked again, and size and time are bounded. Returns null when the page cannot be read.
 */
export async function fetchPublicPageText(value:string,signal:AbortSignal):Promise<string|null>{
 let current=safePublicUrl(value);
 for(let hop=0;current&&hop<=MAX_REDIRECTS;hop++){
  const url=new URL(current);
  let result:{response:IncomingMessage;body:Buffer};
  try{result=await get(url,signal);}catch{return null;}
  const {response,body}=result,status=response.statusCode??0;
  if(status>=300&&status<400&&response.headers.location){current=safePublicUrl(new URL(response.headers.location,url).href);continue;}
  if(status<200||status>=300)return null;
  const type=(response.headers['content-type']??'').toLowerCase();
  if(type.includes('application/pdf')||body.subarray(0,5).toString('latin1')==='%PDF-'){
   try{const [document]=await parseMaterials([{name:'source.pdf',type:'application/pdf',bytes:new Uint8Array(body)}],{locale:'en',signal});return document?.pages.map(page=>page.text).join('\n')??null;}catch{return null;}
  }
  const text=body.toString('utf8');
  return type.includes('text/plain')?text:htmlToText(text);
 }
 return null;
}

export type PageReader=(url:string,signal:AbortSignal)=>Promise<string|null>;
export type QuoteCheck={url:string;quote:string};
export const quoteKey=(check:QuoteCheck)=>`${check.url}\n${check.quote}`;
/** A quote has to say something specific: about 16 Latin letters, or 8 CJK characters. */
const specificEnough=(quote:string)=>[...quote.replace(/[\s\p{P}]/gu,'')].reduce((sum,ch)=>sum+(/\p{Script=Han}/u.test(ch)?2:1),0)>=16;

/**
 * Check each quote against the page it cites. The value is the page's own contiguous wording when found,
 * otherwise null; a quote is never accepted on the model's word alone.
 */
export async function verifyQuotes(checks:readonly QuoteCheck[],options:{signal?:AbortSignal;budgetMs?:number;read?:PageReader}={}):Promise<Map<string,string|null>>{
 const result=new Map<string,string|null>();
 const usable=checks.filter(check=>specificEnough(check.quote));
 for(const check of checks)result.set(quoteKey(check),null);
 const urls=[...new Set(usable.map(check=>check.url))].slice(0,MAX_PAGES);
 if(!urls.length)return result;
 const signal=AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(options.budgetMs??15_000)]);
 const read=options.read??fetchPublicPageText;
 const pages=new Map(await Promise.all(urls.map(async url=>[url,await read(url,signal).catch(()=>null)] as const)));
 for(const check of usable){const page=pages.get(check.url);if(page)result.set(quoteKey(check),originalMaterialQuote(page,check.quote));}
 return result;
}
