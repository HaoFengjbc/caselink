import incrementalFollowups from '../../data/followups/incremental.json';
import {mergeFollowups} from './followup-merge';
import casesJson from '../../data/cases/cases.json';
import evidenceJson from '../../data/evidence/evidence.json';
import documentsJson from '../../data/evidence/documents.json';
import resourcesJson from '../../data/resources/resources.json';
import localRulesJson from '../../data/resources/local-rules.json';
import kzFollowups from '../../data/followups/kazakhstan.json';
import tnFollowups from '../../data/followups/tunisia.json';
import maFollowups from '../../data/followups/morocco.json';
import {CaseFollowupSchema} from './legal-contracts';
import {CaseRecordSchema,EvidenceSchema,SourceDocumentSchema,ResourceSchema} from './contracts';
export const cases=CaseRecordSchema.array().parse(casesJson);
export const evidence=EvidenceSchema.array().parse(evidenceJson);
export const documents=SourceDocumentSchema.array().parse(documentsJson);
export const resources=ResourceSchema.array().parse([...resourcesJson,...localRulesJson]);
export const getCase=(id:string)=>cases.find(c=>c.caseId===id);
export const getEvidence=(id:string)=>evidence.find(e=>e.evidenceId===id);

/** Append-only public follow-ups; original reports and their cut-offs remain unchanged. */
export const followups=mergeFollowups(CaseFollowupSchema.array().parse([...kzFollowups,...tnFollowups,...maFollowups]),CaseFollowupSchema.array().parse(incrementalFollowups));
for(const followup of followups){
 const record=cases.find(c=>c.caseId===followup.caseId);
 if(!record||record.lastKnownStatusAsOf!==followup.originalFactsAsOf)throw new Error('Follow-up case ownership / original cut-off mismatch');
 const sourceIds=new Set(followup.sources.map(s=>s.sourceId));
 if(sourceIds.size!==followup.sources.length||new Set(followup.events.map(e=>e.eventId)).size!==followup.events.length)throw new Error('Duplicate follow-up source or event ID');
 for(const event of followup.events){
  if(!event.sourceIds.length||event.sourceIds.some(id=>!sourceIds.has(id)))throw new Error('Follow-up source ownership mismatch');
  const readSources=followup.sources.filter(source=>event.sourceIds.includes(source.sourceId)&&['full_text','partial_text'].includes(source.readStatus)&&source.quote.trim()&&source.locator.trim());
  if(!readSources.length)throw new Error('Follow-up event lacks a read source passage');
  if(event.verification==='source_checked'&&!readSources.some(source=>source.sourceKind==='underlying_source'&&source.supportLevel==='source_checked'))throw new Error('Checked event requires an opened underlying source');
  if(event.verification==='research_reported'&&!readSources.some(source=>source.sourceKind==='uploaded_research'))throw new Error('Research line requires its own uploaded-report passage');
 }
}
