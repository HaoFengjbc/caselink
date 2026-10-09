import type {CaseRecord,Evidence} from '../contracts';
import {localizeCase} from '../i18n/content';
import type {Locale} from '../i18n/locale';

const normalize=(value:string)=>value.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
// A semicolon does not end a sentence: an invented causal prefix before it
// must not be discarded while accepting a later verbatim outcome clause.
const boundary=/[.!?\n。！？]/;

/** Narrow exception for a verbatim curated outcome sentence, not model entailment.
 * The whole sentence must match and have an outcome-owned, reviewed citation.
 * Prefixing a different subject, causality or a new time claim therefore fails.
 */
export function supportedHistoricalOutcome(text:string,index:number,match:string,records:CaseRecord[],refs:Evidence[],locale:Locale):boolean{
  const before=text.slice(0,index).split(boundary).pop()??'';
  const after=text.slice(index+match.length).split(boundary)[0];
  const clause=normalize(before+match+after);
  if(clause.length<16)return false;
  return records.some(record=>localizeCase(record,locale).outcomes.some(outcome=>{
    if(!outcome.evidenceIds.some(id=>refs.some(ref=>ref.evidenceId===id&&ref.caseId===record.caseId&&ref.reviewStatus!=='draft'&&ref.origin!=='unverified_footnote')))return false;
    return outcome.description.split(boundary).some(sentence=>normalize(sentence)===clause);
  }));
}

/** Full titles or distinctive name tokens; shared first names do not establish
 * which of two proceedings is mentioned. Citation ownership remains mandatory.
 */
export function mentionsCase(text:string,record:CaseRecord,corpus:CaseRecord[]):boolean{
  const haystack=normalize(text);
  if(haystack.includes(normalize(record.title)))return true;
  const tokens=(title:string):string[]=>title.toLowerCase().match(/[a-zÀ-ž]{4,}/gi)??[];
  return tokens(record.title).some(word=>corpus.filter(other=>tokens(other.title).includes(word)).length===1&&new RegExp(`\\b${word}\\b`,'i').test(text));
}
