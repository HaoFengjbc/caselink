import type {CaseFollowup} from './legal-contracts';
/** Incremental source union; original action/outcome wording and original report cut-offs survive. */
export function mergeFollowups(original:CaseFollowup[],incoming:CaseFollowup[]):CaseFollowup[]{
 const merged=structuredClone(original);
 for(const fresh of incoming){
  const current=merged.find(f=>f.caseId===fresh.caseId);
  if(!current){merged.push(structuredClone(fresh));continue;}
  if(current.originalFactsAsOf!==fresh.originalFactsAsOf)throw new Error('Original report cut-off must not change');
  const sources=new Map(current.sources.map(s=>[s.sourceId,s]));for(const s of fresh.sources)if(!sources.has(s.sourceId))sources.set(s.sourceId,structuredClone(s));
  current.sources=[...sources.values()];
  for(const event of fresh.events){const old=current.events.find(e=>e.eventId===event.eventId);
   if(!old){current.events.push(structuredClone(event));continue;}
   const {eventKind,scope,proceedingId,personIds,reportId,researchCutoff,supportClaim,verification,matching}=event;
   Object.assign(old,Object.fromEntries(Object.entries({eventKind,scope,proceedingId,personIds,reportId,researchCutoff,supportClaim,verification,matching}).filter(([,value])=>value!==undefined)));
   // A sourced filing is submitted, not a completed remedy. Original JSON and old snapshots stay frozen.
   if(verification==='source_checked'&&event.executionStatus==='submitted')old.executionStatus='submitted';
   old.sourceIds=[...new Set([...old.sourceIds,...event.sourceIds])];old.unknowns=[...new Set([...old.unknowns,...event.unknowns])];
  }
  current.searchedSources=[...new Set([...current.searchedSources,...fresh.searchedSources])];current.unknowns=[...new Set([...current.unknowns,...fresh.unknowns])];
  // Keep original summary as original record. Added events retain their own research dates and labels.
 }
 return merged;
}
