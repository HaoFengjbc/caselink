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
export const followups=CaseFollowupSchema.array().parse([...kzFollowups,...tnFollowups,...maFollowups]);
for(const followup of followups){
 const record=cases.find(c=>c.caseId===followup.caseId);
 if(!record||record.lastKnownStatusAsOf!==followup.originalFactsAsOf)throw new Error('Follow-up case ownership / original cut-off mismatch');
 const sourceIds=new Set(followup.sources.map(s=>s.sourceId));
 if(sourceIds.size!==followup.sources.length||new Set(followup.events.map(e=>e.eventId)).size!==followup.events.length)throw new Error('Duplicate follow-up source or event ID');
 for(const event of followup.events)if(!event.sourceIds.length||event.sourceIds.some(id=>!followup.sources.some(source=>source.sourceId===id&&['full_text','partial_text'].includes(source.readStatus)&&source.quote.trim()&&source.locator.trim())))throw new Error('Follow-up event lacks a read source passage');
}
