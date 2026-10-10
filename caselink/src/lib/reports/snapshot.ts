import {cases,evidence,documents,resources,followups} from '../corpus';
import {CORPUS_VERSION,type AnalysisResult,type ReportSnapshot,type NewCaseInput} from '../contracts';
import {countryName,localizeCase,localizeEvidence,localizeDocument,localizeResource} from '../i18n/content';

/** Runtime implementation owned by A; these exported signatures are shared with B and C. */
export function captureCaseSnapshot(caseIds:readonly string[],locale:'zh'|'en'='zh'):ReportSnapshot {
 const selected=cases.filter(c=>caseIds.includes(c.caseId));
 const evidenceIds=new Set(selected.flatMap(c=>c.evidenceIds));
 const excerpts=evidence.filter(e=>evidenceIds.has(e.evidenceId)||caseIds.includes(e.caseId));
 const referencedEvidenceIds = new Set(selected.flatMap(c => [...c.evidenceIds, ...c.events.flatMap(e => e.evidenceIds), ...c.interventions.flatMap(i => i.evidenceIds), ...c.outcomes.flatMap(o => o.evidenceIds), ...c.reportRecommendations.flatMap(r => r.evidenceIds), ...c.conflicts.flatMap(f => f.evidenceIds)]));
 const documentIds=new Set([...selected.flatMap(c=>c.sourceDocumentIds),...excerpts.map(e=>e.documentId)]);
 const complete=caseIds.every(id=>selected.some(c=>c.caseId===id))&&[...referencedEvidenceIds].every(id=>excerpts.some(e=>e.evidenceId===id))&&[...documentIds].every(id=>documents.some(d=>d.documentId===id));
 return structuredClone({version:1,capturedAt:new Date().toISOString(),corpusVersion:CORPUS_VERSION,completeness:complete?'complete':'legacy_partial',locale,
  cases:selected.map(c=>({...localizeCase(c,locale),country:countryName(c.country,locale)})),evidence:excerpts.map(e=>localizeEvidence(e,locale)),documents:documents.filter(d=>documentIds.has(d.documentId)).map(d=>localizeDocument(d,locale)),resources:[],followups:structuredClone(followups.filter(f=>caseIds.includes(f.caseId))),sourceDescriptors:excerpts.map(e=>({sourceId:e.evidenceId,category:'curated_case' as const,reviewStatus:e.reviewStatus==='conflict'?'conflict' as const:'legacy_recorded' as const,applicability:['Historical source; applicability to another matter is not established.'],locator:`PDF p. ${e.pdfPage}`,agentCheckedAt:null,teamReviewedAt:null,unknowns:[]}))});
}
export function captureReportSnapshot(result:AnalysisResult,locale:'zh'|'en'=result.locale??'zh',input?:NewCaseInput):ReportSnapshot {
 const snapshot=captureCaseSnapshot([...new Set([...result.comparableCases.map(c=>c.caseId),...result.sources.map(e=>e.caseId),...(result.nextSteps?.flatMap(step=>step.history.map(history=>history.caseId))??[]),...(result.followups?.map(followup=>followup.caseId)??[]),...(result.whatsNext?.priorities.flatMap(task=>task.history.map(h=>h.caseId))??[])])],locale);
 const resourceIds=new Set([...result.actionOptions.flatMap(a=>[...a.resourceIds,...(a.legalCitations??[]).map(c=>c.resourceId)]),...(result.legalResearch?.bindings.map(b=>b.resourceId)??[]),...(result.legalResearch?.mechanisms?.flatMap(m=>m.resourceIds)??[])]);
 snapshot.resources=resources.filter(r=>resourceIds.has(r.resourceId)).map(r=>localizeResource(r,locale));
 // The result's quoted records win over current catalog records at capture time.
 for (const source of result.sources) { const frozen = localizeEvidence(source, locale); const at = snapshot.evidence.findIndex(e => e.evidenceId === source.evidenceId); if (at < 0) snapshot.evidence.push(frozen); else snapshot.evidence[at] = frozen; }
 for (const resource of snapshot.resources) snapshot.sourceDescriptors.push({ sourceId: resource.resourceId, category: resource.type === 'domestic_law' || resource.type === 'procedure_rule' ? 'domestic_law' : resource.type === 'assistance' ? 'assistance' : resource.type === 'un_mechanism' || resource.type === 'regional_mechanism' ? 'mechanism' : 'international_standard', reviewStatus: resource.reviewStatus ?? 'legacy_recorded', applicability: [resource.applicability, ...(resource.eligibility ?? [])], locator: resource.locator ?? resource.officialUrl, agentCheckedAt: resource.agentCheckedAt ?? null, teamReviewedAt: resource.teamReviewedAt ?? null, unknowns: resource.unknowns ?? ['Team review was not recorded.'] });
 const requiredEvidenceIds = new Set([...result.comparableCases.flatMap(c => c.evidenceIds), ...result.actionOptions.flatMap(a => a.supportingEvidenceIds), ...result.sources.map(e => e.evidenceId)]);
 if ([...requiredEvidenceIds].some(id => !snapshot.evidence.some(e => e.evidenceId === id)) || snapshot.evidence.some(e => !snapshot.documents.some(d => d.documentId === e.documentId))) snapshot.completeness = 'legacy_partial';
 if (result.comparableCases.some(c => !snapshot.cases.some(record => record.caseId === c.caseId)) || [...resourceIds].some(id => !snapshot.resources.some(r => r.resourceId === id))) snapshot.completeness = 'legacy_partial';
 if(result.legalResearch){
  snapshot.legalResearch=structuredClone(result.legalResearch);
  if(result.legalResearch.bindings.some(binding=>!snapshot.resources.some(resource=>resource.resourceId===binding.resourceId&&resource.sourceAudit?.provisions.some(provision=>provision.provisionId===binding.provisionId&&provision.supports.includes(binding.claimKey)&&provision.explanation===binding.claim))))snapshot.completeness='legacy_partial';
 }
 if(result.followups){
  snapshot.followups=structuredClone(result.followups);
  for(const followup of snapshot.followups)for(const source of followup.sources)snapshot.sourceDescriptors.push({sourceId:source.sourceId,category:'historical_followup',reviewStatus:source.reviewStatus,applicability:['Historical follow-up; not proof of the new matter or causal effect.'],locator:source.locator,agentCheckedAt:source.reviewStatus==='agent_checked'?source.checkedAt:null,teamReviewedAt:null,unknowns:[...followup.unknowns]});
 }
 if(result.nextSteps){
  snapshot.nextSteps=structuredClone(result.nextSteps);
  if(snapshot.nextSteps.some(step=>step.legalBindingIds.some(id=>!snapshot.legalResearch?.bindings.some(binding=>binding.bindingId===id))||step.history.some(history=>history.evidenceIds.some(id=>!snapshot.evidence.some(item=>item.evidenceId===id))||history.sourceIds.some(id=>!snapshot.followups?.find(followup=>followup.caseId===history.caseId)?.sources.some(source=>source.sourceId===id)))))snapshot.completeness='legacy_partial';
 }
 if(result.whatsNext)snapshot.whatsNext=structuredClone(result.whatsNext);
 if(result.webResearch)snapshot.webResearch=structuredClone(result.webResearch);
 for(const source of result.webResearch?.sources??[])snapshot.sourceDescriptors.push({sourceId:source.sourceId,category:'public_web',reviewStatus:'unreviewed',applicability:['Unverified public supplement; independent review required.'],locator:source.url,agentCheckedAt:null,teamReviewedAt:null,unknowns:['Applicability and factual support need review.']});
 if(input?.intake?.materials){
  snapshot.uploadedMaterials=structuredClone(input.intake.materials);
  for(const item of snapshot.uploadedMaterials.items)snapshot.sourceDescriptors.push({sourceId:item.id,category:'uploaded_material',reviewStatus:'unreviewed',applicability:['Private materials provided for this case; neither independent verification nor corpus evidence.'],locator:item.sources.map(s=>`${s.filename} · PDF ${s.pdfPage}`).join('; '),agentCheckedAt:null,teamReviewedAt:null,unknowns:item.uncertainty?[item.uncertainty]:[]});
 }
 return structuredClone(snapshot);
}
/** Legacy records never backfill missing historical content from today's corpus. */
export function snapshotForResult(result:AnalysisResult):ReportSnapshot {
 return result.snapshot??{version:1,capturedAt:result.createdAt,corpusVersion:result.corpusVersion,completeness:'legacy_partial',locale:result.locale??'zh',cases:[],evidence:structuredClone(result.sources),documents:[],resources:[],sourceDescriptors:[],...(result.webResearch?{webResearch:structuredClone(result.webResearch)}:{})};
}
