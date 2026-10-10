import type {ReportSnapshot} from './contracts';

/** Validate only the frozen snapshot. Reverting prose must not upgrade missing/altered support. */
export function workingSourcesValid(snapshot:ReportSnapshot):boolean{
 const plan=snapshot.whatsNext;if(!plan)return false;
 return plan.priorities.every(task=>task.legalBindingIds.every(id=>{
  const b=snapshot.legalResearch?.bindings.find(b=>b.bindingId===id),r=snapshot.resources.find(r=>r.resourceId===b?.resourceId);
  return !!b&&!!r?.sourceAudit&&['full_text','partial_text'].includes(r.sourceAudit.readStatus)&&r.sourceAudit.provisions.some(p=>p.provisionId===b.provisionId&&p.supports.includes(b.claimKey)&&p.explanation===b.claim&&p.quote.trim()&&p.locator.trim());
 })&&task.history.every(h=>{
  if(h.followupEventId){
   const f=snapshot.followups?.find(f=>f.caseId===h.caseId),e=f?.events.find(e=>e.eventId===h.followupEventId);
   return !!e&&e.action===h.action&&e.outcome===h.outcome&&e.executionStatus===h.executionStatus&&(!e.verification||e.verification==='source_checked'&&e.scope==='same_case'&&e.eventKind==='historical_action')&&h.sourceIds.length>0&&h.sourceIds.every(id=>e.sourceIds.includes(id)&&f?.sources.some(s=>s.sourceId===id&&['full_text','partial_text'].includes(s.readStatus)&&s.quote.trim()&&(!e.verification||s.supportLevel==='source_checked'&&s.sourceKind==='underlying_source')));
  }
  const c=snapshot.cases.find(c=>c.caseId===h.caseId),i=c?.interventions.find(i=>i.interventionId===h.interventionId);
  const outcomes=i?.observedOutcomeIds.map(id=>c?.outcomes.find(o=>o.outcomeId===id)).filter(o=>!!o)??[];
  return !!i&&i.action===h.action&&i.executionStatus===h.executionStatus&&(!outcomes.length||outcomes.map(o=>o.description).join('；')===h.outcome)&&h.evidenceIds.length>0&&h.evidenceIds.every(id=>snapshot.evidence.some(e=>e.evidenceId===id&&e.caseId===h.caseId&&e.exactQuote.trim()));
 }));
}
