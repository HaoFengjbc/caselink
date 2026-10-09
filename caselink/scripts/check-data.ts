import assert from 'node:assert/strict';
import { cases, documents, evidence, resources } from '../src/lib/corpus';

const unique = (values:string[]) => assert.equal(new Set(values).size,values.length,'IDs must be unique');
unique(cases.map(c=>c.caseId)); unique(documents.map(d=>d.documentId)); unique(documents.map(d=>d.hash));
unique(evidence.map(e=>e.evidenceId)); unique(resources.map(r=>r.resourceId));
assert.equal(documents.length,21,'All distinct supplied reports are in the application corpus');
assert.equal(cases.length,22,'Proceedings and thematic-report case excerpts are counted explicitly');
const emna=cases.find(c=>c.caseId==='emna-chargui')!;
assert(emna.conflicts.some(c=>c.evidenceIds.includes('emna-verdict-july13')&&c.evidenceIds.includes('emna-verdict-july3')));
assert(emna.outcomes.some(o=>o.type==='pending'));
assert(!emna.personTypes.includes('journalist'));
assert(!cases.find(c=>c.caseId==='myriam-bribri')!.personTypes.includes('journalist'));
assert(cases.find(c=>c.caseId==='aigul-utepova')!.outcomes.some(o=>o.type==='partial'));
for(const c of cases){
  assert(c.unknowns.length>0);
  const checkRefs=(ids:string[])=>{for(const id of ids){const e=evidence.find(x=>x.evidenceId===id);assert(e,`Missing ${id}`);assert.equal(e.caseId,c.caseId,`Cross-case ${id}`);assert(c.sourceDocumentIds.includes(e.documentId));assert.notEqual(e.reviewStatus,'draft');}};
  checkRefs(c.evidenceIds);
  for(const row of [...c.events,...c.interventions,...c.outcomes,...c.reportRecommendations,...c.conflicts])checkRefs(row.evidenceIds);
  for(const i of c.interventions){assert(['implemented','unknown'].includes(i.executionStatus),'Author recommendations belong in their separate collection'); if(i.executionStatus==='unknown')assert.equal(i.relationshipToOutcome,'unknown'); for(const id of i.observedOutcomeIds)assert(c.outcomes.some(o=>o.outcomeId===id),`Missing outcome ${id}`);}
  unique(c.events.map(e=>e.eventId));unique(c.interventions.map(i=>i.interventionId));unique(c.outcomes.map(o=>o.outcomeId));
}
for(const e of evidence){const d=documents.find(d=>d.documentId===e.documentId);assert(d);assert(e.pdfPage>=1&&e.pdfPage<=d.pageCount);assert.equal(e.sourceUrl,d.sourceUrl);assert(e.exactQuote.trim().length>0);}
for(const d of documents){assert.match(d.hash,/^[a-f0-9]{64}$/);assert(d.factsAsOf<d.checkedAt,'Historical dates must not be replaced by check date');assert(['cfj.org','www.americanbar.org'].includes(new URL(d.sourceUrl).hostname));
assert(cases.some(c=>c.sourceDocumentIds.includes(d.documentId)),`Orphan source document ${d.documentId}`);}
console.log(`Data checks passed: ${cases.length} cases, ${evidence.length} excerpts, ${cases.reduce((n,c)=>n+c.interventions.length,0)} interventions, ${resources.length} resources.`);
