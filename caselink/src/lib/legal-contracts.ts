import {z} from 'zod';

export const SourceAuditSchema=z.object({
 issuer:z.string(),version:z.string(),publishedOrEffective:z.string(),checkedAt:z.string(),
 readStatus:z.enum(['full_text','partial_text','blocked','not_checked']),readUrl:z.string().url(),
 jurisdiction:z.array(z.string()),proceedings:z.array(z.enum(['criminal','civil','administrative','all'])),
 currentVersionStatus:z.string(),eventVersionStatus:z.string(),
 provisions:z.array(z.object({provisionId:z.string(),locator:z.string(),quote:z.string(),explanation:z.string(),supports:z.array(z.string())}).strict()),
 confirmed:z.array(z.string()),corrections:z.array(z.string()),gaps:z.array(z.string()),
 relatedSources:z.array(z.object({title:z.string(),url:z.string().url(),locator:z.string()}).strict()).optional(),
 jurisdictionChecks:z.array(z.object({jurisdiction:z.string(),status:z.enum(['confirmed','unknown','not_met']),topic:z.enum(['participation','mechanism_eligibility']),detail:z.string(),sourceUrl:z.string().url()}).strict()).optional()
}).strict();
export type SourceAudit=z.infer<typeof SourceAuditSchema>;
export const LegalBindingSchema=z.object({
 bindingId:z.string(),issue:z.string(),claim:z.string(),claimKey:z.string(),resourceId:z.string(),provisionId:z.string(),
 factBasis:z.array(z.object({text:z.string(),origin:z.enum(['user_statement','opposing_allegation','court_finding','document']),fileName:z.string().nullable(),page:z.number().int().positive().nullable()}).strict()),
 relevance:z.string(),conditions:z.array(z.object({label:z.string(),status:z.enum(['confirmed','unknown','not_met']),detail:z.string()}).strict()),
 nextChecks:z.array(z.string()),applicability:z.enum(['research_reference','conditional','excluded']),factsAsOf:z.string(),lawAsOf:z.string(),
 relationOrigin:z.enum(['curated_rule','ai_analysis'])
}).strict();
export type LegalBinding=z.infer<typeof LegalBindingSchema>;
export const LegalResearchSchema=z.object({
 coreQuestion:z.string(),coverage:z.enum(['checked','partial','gap']),coverageNote:z.string(),bindings:z.array(LegalBindingSchema),gaps:z.array(z.string())
}).strict();
export type LegalResearch=z.infer<typeof LegalResearchSchema>;
export const LegalCitationSchema=z.object({bindingId:z.string(),claimKey:z.string(),resourceId:z.string(),provisionId:z.string()}).strict();

export const FollowupSourceSchema=z.object({sourceId:z.string(),title:z.string(),url:z.string().url(),publisher:z.string(),publishedAt:z.string().nullable(),locator:z.string(),quote:z.string(),readStatus:z.enum(['full_text','partial_text','blocked','search_only']),checkedAt:z.string(),reviewStatus:z.enum(['agent_checked','unreviewed']),teamReviewedAt:z.null(),teamReviewer:z.null()}).strict();
export const FollowupEventSchema=z.object({eventId:z.string(),proceeding:z.string(),subjects:z.array(z.string()),eventDate:z.string().nullable(),datePrecision:z.enum(['day','month','year','unknown']),actors:z.array(z.string()),action:z.string(),executionStatus:z.enum(['implemented','recommended_only','planned','unknown']),outcome:z.string(),relationshipToOutcome:z.enum(['sequence_only','attributed_claim','unknown']),causalAttribution:z.string().nullable(),sourceIds:z.array(z.string()),unknowns:z.array(z.string())}).strict();
export const CaseFollowupSchema=z.object({caseId:z.string(),originalFactsAsOf:z.string(),checkedAt:z.string(),searchStatus:z.enum(['updates_found','no_update_found','limited']),summary:z.string(),events:z.array(FollowupEventSchema),sources:z.array(FollowupSourceSchema),searchedSources:z.array(z.string()),unknowns:z.array(z.string())}).strict();
export type CaseFollowup=z.infer<typeof CaseFollowupSchema>;
export const NextStepSchema=z.object({actionId:z.string(),purpose:z.string(),owner:z.string(),materials:z.array(z.string()),deliverables:z.array(z.string()),stopConditions:z.array(z.string()),legalBindingIds:z.array(z.string()),history:z.array(z.object({caseId:z.string(),interventionId:z.string().nullable(),followupEventId:z.string().nullable(),actor:z.string(),action:z.string(),executionStatus:z.enum(['implemented','recommended_only','planned','unknown']),date:z.string(),outcome:z.string(),differences:z.array(z.string()),evidenceIds:z.array(z.string()),sourceIds:z.array(z.string())}).strict()),basisGaps:z.array(z.string())}).strict();
export type NextStep=z.infer<typeof NextStepSchema>;
