import type {NewCaseInput} from '../contracts';
import {cases} from '../corpus';

const boundary=/[.!?;\n。！？；]/;
const attribution=/(?:\b(?:your|the user['’]s)\s+(?:account|description|narrative|statement|notes?)\s+(?:says|states|reports|describes|mentions|indicates)\b|\b(?:according to|based on)\s+(?:your|the user['’]s)\s+(?:account|description|narrative|statement|notes?)\b|(?:根据|按照|按|据)(?:你|您|用户)(?:提供的|的)?(?:叙述|描述|陈述|说明|记录)|(?:你|您|用户)(?:的)?(?:叙述|描述|陈述|说明|记录)(?:称|提到|记载|说|表示))/gi;
const normalize=(text:string)=>text.toLowerCase().replace(/[“”"‘’]/g,'').replace(/\s+/g,' ').trim();
const corpusNames=cases.flatMap(c=>[c.title,...c.title.split(' ')]).filter(name=>name.length>3).concat(['乌特波娃','查古伊','布里布里']);

/** A narrow attribution exception, not a general entailment or legal-outcome checker. */
export function supportedUserOutcome(text:string,index:number,match:string,input:NewCaseInput):boolean{
  const prefix=text.slice(0,index);const pieces=prefix.split(boundary);const before=pieces[pieces.length-1];
  const start=index-before.length;const remaining=text.slice(index+match.length);const next=remaining.search(boundary);
  const clause=text.slice(start,index+match.length+(next<0?remaining.length:next));
  // A user's statement cannot override evidence requirements for a curated historical case.
  if(corpusNames.some(name=>clause.toLowerCase().includes(name.toLowerCase())))return false;
  const markers=[...before.matchAll(attribution)];const marker=markers[markers.length-1];
  if(!marker)return false;
  const afterAttribution=before.slice((marker.index??0)+marker[0].length);
  const subject=afterAttribution.split(/\b(?:and|while|but|whereas)\b|[，,:：]/i).pop()?.replace(/^[\s“”"‘’]+/,'').trim()??'';
  if(!/[a-z\u3400-\u9fff]/i.test(subject))return false;
  const claim=normalize(`${subject} ${match}`);
  const material=[input.intake?.narrative??'',...(input.intake?.answers.map(answer=>answer.answer)??[]),input.background.description,input.priorActions.description];
  // Keep the subject with the outcome: an editor's acquittal cannot become an organization's acquittal.
  return material.some(value=>normalize(value).includes(claim)||normalize(value).includes(normalize(`${subject}${match}`)));
}
