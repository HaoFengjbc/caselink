import {originalMaterialQuote} from './citations';

type DateExcerpt={start:number;end:number;original:string;key:string|null};
const months=['january','february','march','april','may','june','july','august','september','october','november','december'] as const;
const monthNames='January|February|March|April|May|June|July|August|September|October|November|December|Jan\\.?|Feb\\.?|Mar\\.?|Apr\\.?|Jun\\.?|Jul\\.?|Aug\\.?|Sept?\\.?|Oct\\.?|Nov\\.?|Dec\\.?';

/** Arithmetic only: no locale-dependent parsing, missing components or calendar conversion. */
function dateKey(year:number,month:number,day:number):string|null{
  if(year<1||year>9999||month<1||month>12||day<1)return null;
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  return day<=days[month-1]?`${year}-${month}-${day}`:null;
}
const monthNumber=(name:string)=>months.findIndex(month=>month.startsWith(name.toLowerCase().replace(/\.$/,'')))+1;

/** Recognize complete lexical dates, retaining invalid ones so fallback cannot ignore a conflict. */
function dateExcerpts(text:string):DateExcerpt[]{
  const output:DateExcerpt[]=[];
  const formats:Array<{pattern:RegExp;parts:(match:RegExpExecArray)=>[number,number,number]}>= [
    {pattern:/(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})/gu,parts:m=>[+m[1],+m[2],+m[3]]},
    {pattern:/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/gu,parts:m=>[+m[1],+m[2],+m[3]]},
    {pattern:new RegExp(`(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})`,'giu'),parts:m=>[+m[3],monthNumber(m[2]),+m[1]]},
    {pattern:new RegExp(`(${monthNames})\\s+(\\d{1,2})(?:\\s*,\\s*|\\s+)(\\d{4})`,'giu'),parts:m=>[+m[3],monthNumber(m[1]),+m[2]]},
  ];
  for(const {pattern,parts} of formats){
    for(const match of text.matchAll(pattern)){
      const start=match.index,end=start+match[0].length;
      // Do not take "3 October" from "13 October", dates inside identifiers, or numeric tails.
      const before=text.slice(0,start).at(-1)??'',after=text.slice(end,end+1);
      const bounded=!/[\p{N}A-Za-z_/]/u.test(before)&&!/[\p{N}A-Za-z_/]/u.test(after);
      output.push({start,end,original:match[0],key:bounded?dateKey(...parts(match as RegExpExecArray)):null});
    }
  }
  return output.sort((a,b)=>a.start-b.start||b.end-a.end);
}

function markedDates(text:string,dates:DateExcerpt[]):string{
  let marked='',offset=0;
  for(const date of dates){marked+=text.slice(offset,date.start)+'§';offset=date.end;}
  return marked+text.slice(offset);
}

// A full date on one side of a range cannot lend its omitted month/year to the other side.
const sharedComponentRange=(marked:string)=>/\d\s*[-–—~～至到]\s*§|§\s*[-–—~～至到]\s*\d/u.test(marked);
const ambiguousNumericDate=/(?:^|[^\d])(?:\d{1,4}\s*\/\s*\d{1,2}\s*\/\s*\d{1,4}|\d{1,2}\s*-\s*\d{1,2}\s*-\s*\d{4})(?!\d)/u;

/** Only semantic fallback needs context guards: literal quotes preserve the source's own wording. */
function fallbackContextIsUnclear(quote:string,dates:DateExcerpt[]):boolean{
  const marked=markedDates(quote,dates);
  return ambiguousNumericDate.test(quote)||sharedComponentRange(marked)||
    /§\s*[-–—~～至到]\s*§/u.test(marked)||
    /\b(?:not|no|never|neither|nor|without|denied|deny|denies|disputed|incorrect|wrong|unconfirmed|unknown|uncertain|estimated|estimate|possibly|probably|perhaps|might|before|after|until|since|by|earlier|later|about|around|approximately|circa|yesterday|today|tomorrow|last|next|within|between|from|to|through|prior|following|preceding)\b/iu.test(quote)||
    /不|未|无|無|否认|并非|可能|或许|或許|大概|估计|估計|待定|暂定|暫定|疑似|有误|错误|无法确定|之前|之后|以前|以后|此前|此后|截至|截止|大约|左右|期间|之间|昨日|昨天|今日|今天|明日|明天|上周|下周|上月|下月|翌日|次日|次年/u.test(quote)||
    /(?:非|未|不|约)\s*§|§\s*(?:前|后|起|止|内|外)/u.test(marked)||
    /\b(?:Julian|Hijri|Islamic|Buddhist|Hebrew|lunar|BCE|BC)\b|农历|農曆|阴历|陰曆|佛历|佛曆|伊斯兰历|伊斯蘭曆|儒略历|儒略曆|民国|民國|公元前/iu.test(quote);
}

/**
 * Resolve a model date solely against this item's already-verified source quotes.
 * Return an actual contiguous source substring (<=80 UTF-16 code units), never a synthesized date.
 * Exact/layout matches may select one explicit complete date among several. Format conversion is
 * stricter: every recognizable date must be valid and identical, with no unclear date context.
 */
export function resolveMaterialDate(value:string,sourceQuotes:readonly string[]):string|null{
  if(!value.trim()||value.length>80)return null;
  const requested=value.trim(),valueDates=dateExcerpts(requested);
  if(valueDates.length!==1||valueDates[0].start!==0||valueDates[0].end!==requested.length||!valueDates[0].key)return null;
  const key=valueDates[0].key;
  const quotes=sourceQuotes.map(quote=>({quote,dates:dateExcerpts(quote)}));
  for(const {quote,dates} of quotes){
    const original=originalMaterialQuote(quote,requested);
    if(original===null||original.length>80||sharedComponentRange(markedDates(quote,dates)))continue;
    const match=dates.find(date=>date.key===key&&date.original===original);
    if(match)return match.original;
  }
  if(quotes.some(({quote,dates})=>fallbackContextIsUnclear(quote,dates)))return null;
  const candidates=quotes.flatMap(({dates})=>dates);
  if(!candidates.length||candidates.some(date=>date.key!==key))return null;
  return candidates.find(date=>date.original.length<=80)?.original??null;
}
