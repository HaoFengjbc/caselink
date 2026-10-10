import {z} from 'zod';

export const SourceAuditSchema=z.object({
 issuer:z.string(),version:z.string(),publishedOrEffective:z.string(),checkedAt:z.string(),
 readStatus:z.enum(['full_text','partial_text','blocked','not_checked']),readUrl:z.string().url(),
 jurisdiction:z.array(z.string()),proceedings:z.array(z.enum(['criminal','civil','administrative','all'])),
 currentVersionStatus:z.string(),eventVersionStatus:z.string(),legalEffect:z.string().optional(),language:z.string().optional(),translationStatus:z.string().optional(),
 provisions:z.array(z.object({provisionId:z.string(),locator:z.string(),quote:z.string(),explanation:z.string(),supports:z.array(z.string())}).strict()),
 confirmed:z.array(z.string()),corrections:z.array(z.string()),gaps:z.array(z.string()),
 relatedSources:z.array(z.object({title:z.string(),url:z.string().url(),locator:z.string()}).strict()).optional(),
 jurisdictionChecks:z.array(z.object({jurisdiction:z.string(),status:z.enum(['confirmed','unknown','not_met']),topic:z.enum(['participation','mechanism_eligibility','domestic_effect']),detail:z.string(),sourceUrl:z.string().url()}).strict()).optional()
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
export const MechanismAssessmentSchema=z.object({mechanismId:z.string(),title:z.string(),state:z.enum(['preliminary','unknown','not_met']),conditions:z.array(z.object({label:z.string(),status:z.enum(['confirmed','unknown','not_met']),detail:z.string()}).strict()),resourceIds:z.array(z.string()),disclosure:z.array(z.string()),nextChecks:z.array(z.string())}).strict();
export type MechanismAssessment=z.infer<typeof MechanismAssessmentSchema>;
export const LegalResearchSchema=z.object({
 coreQuestion:z.string(),coverage:z.enum(['checked','partial','gap']),coverageNote:z.string(),bindings:z.array(LegalBindingSchema),gaps:z.array(z.string()),mechanisms:z.array(MechanismAssessmentSchema).optional()
}).strict();
export type LegalResearch=z.infer<typeof LegalResearchSchema>;
export const LegalCitationSchema=z.object({bindingId:z.string(),claimKey:z.string(),resourceId:z.string(),provisionId:z.string()}).strict();

export const FollowupSourceSchema=z.object({sourceId:z.string(),title:z.string(),url:z.string().url(),publisher:z.string(),publishedAt:z.string().nullable(),locator:z.string(),quote:z.string(),readStatus:z.enum(['full_text','partial_text','blocked','search_only']),checkedAt:z.string(),reviewStatus:z.enum(['agent_checked','unreviewed']),teamReviewedAt:z.null(),teamReviewer:z.null(),sourceKind:z.enum(['uploaded_research','underlying_source']).optional(),supportLevel:z.enum(['research_reported','source_checked']).optional(),reportId:z.string().optional(),publishedDateText:z.string().optional()}).strict();
export const FollowupEventSchema=z.object({eventId:z.string(),proceeding:z.string(),subjects:z.array(z.string()),eventDate:z.string().nullable(),datePrecision:z.enum(['day','month','year','unknown']),actors:z.array(z.string()),action:z.string(),executionStatus:z.enum(['implemented','submitted','scheduled','recommended_only','planned','unknown']),outcome:z.string(),relationshipToOutcome:z.enum(['sequence_only','attributed_claim','unknown']),causalAttribution:z.string().nullable(),sourceIds:z.array(z.string()),unknowns:z.array(z.string()),eventKind:z.enum(['historical_action','decision','observed_outcome','risk_personal','publication','schedule_plan']).optional(),scope:z.enum(['same_case','same_person_other_case','co_defendant','general_legal_background','professional_activity']).optional(),proceedingId:z.string().optional(),personIds:z.array(z.string()).optional(),reportId:z.string().optional(),researchCutoff:z.string().optional(),supportClaim:z.string().optional(),verification:z.enum(['research_reported','source_checked']).optional(),matching:z.object({proceedings:z.array(z.string()),stages:z.array(z.string()),issues:z.array(z.string()),goals:z.array(z.string()),materialForm:z.string(),differences:z.array(z.string())}).strict().optional()}).strict();
export const CaseFollowupSchema=z.object({caseId:z.string(),originalFactsAsOf:z.string(),checkedAt:z.string(),searchStatus:z.enum(['updates_found','no_update_found','limited']),summary:z.string(),events:z.array(FollowupEventSchema),sources:z.array(FollowupSourceSchema),searchedSources:z.array(z.string()),unknowns:z.array(z.string())}).strict();
export type CaseFollowup=z.infer<typeof CaseFollowupSchema>;
export const NextStepSchema=z.object({actionId:z.string(),purpose:z.string(),owner:z.string(),materials:z.array(z.string()),deliverables:z.array(z.string()),stopConditions:z.array(z.string()),legalBindingIds:z.array(z.string()),history:z.array(z.object({caseId:z.string(),interventionId:z.string().nullable(),followupEventId:z.string().nullable(),actor:z.string(),action:z.string(),executionStatus:z.enum(['implemented','submitted','scheduled','recommended_only','planned','unknown']),date:z.string(),outcome:z.string(),differences:z.array(z.string()),evidenceIds:z.array(z.string()),sourceIds:z.array(z.string())}).strict()),basisGaps:z.array(z.string())}).strict();
export type NextStep=z.infer<typeof NextStepSchema>;
