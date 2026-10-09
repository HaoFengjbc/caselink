import {cases,evidence,documents,resources} from '../corpus';
import {CORPUS_VERSION,type AnalysisResult,type ReportSnapshot} from '../contracts';
import {localizeCase,localizeEvidence,localizeDocument,localizeResource} from '../i18n/content';

/** Runtime implementation owned by A; these exported signatures are shared with B and C. */
export function captureCaseSnapshot(caseIds:readonly string[],locale:'zh'|'en'='zh'):ReportSnapshot {
 const selected=cases.filter(c=>caseIds.includes(c.caseId));
 const evidenceIds=new Set(selected.flatMap(c=>c.evidenceIds));
 const excerpts=evidence.filter(e=>evidenceIds.has(e.evidenceId)||caseIds.includes(e.caseId));
 const documentIds=new Set([...selected.flatMap(c=>c.sourceDocumentIds),...excerpts.map(e=>e.documentId)]);
 return structuredClone({version:1,capturedAt:new Date().toISOString(),corpusVersion:CORPUS_VERSION,completeness:'complete',locale,
  cases:selected.map(c=>localizeCase(c,locale)),evidence:excerpts.map(e=>localizeEvidence(e,locale)),documents:documents.filter(d=>documentIds.has(d.documentId)).map(d=>localizeDocument(d,locale)),resources:[],sourceDescriptors:excerpts.map(e=>({sourceId:e.evidenceId,category:'curated_case' as const,reviewStatus:e.reviewStatus==='conflict'?'conflict' as const:'legacy_recorded' as const,applicability:['Historical source; applicability to another matter is not established.'],locator:`PDF p. ${e.pdfPage}`,agentCheckedAt:null,teamReviewedAt:null,unknowns:[]}))});
}
export function captureReportSnapshot(result:AnalysisResult,locale:'zh'|'en'=result.locale??'zh'):ReportSnapshot {
 const snapshot=captureCaseSnapshot([...new Set([...result.comparableCases.map(c=>c.caseId),...result.sources.map(e=>e.caseId)])],locale);
 const resourceIds=new Set(result.actionOptions.flatMap(a=>a.resourceIds));
 snapshot.resources=resources.filter(r=>resourceIds.has(r.resourceId)).map(r=>localizeResource(r,locale));
 if(result.webResearch)snapshot.webResearch=structuredClone(result.webResearch);
 for(const source of result.webResearch?.sources??[])snapshot.sourceDescriptors.push({sourceId:source.sourceId,category:'public_web',reviewStatus:'unreviewed',applicability:['Unverified public supplement; independent review required.'],locator:source.url,agentCheckedAt:null,teamReviewedAt:null,unknowns:['Applicability and factual support need review.']});
 return structuredClone(snapshot);
}
/** Legacy records never backfill missing historical content from today's corpus. */
export function snapshotForResult(result:AnalysisResult):ReportSnapshot {
 return result.snapshot??{version:1,capturedAt:result.createdAt,corpusVersion:result.corpusVersion,completeness:'legacy_partial',locale:result.locale??'zh',cases:[],evidence:structuredClone(result.sources),documents:[],resources:[],sourceDescriptors:[],...(result.webResearch?{webResearch:structuredClone(result.webResearch)}:{})};
}
