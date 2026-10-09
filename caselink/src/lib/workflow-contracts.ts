import {z} from 'zod';

// Public protocol owned by the integration lead. Preferences never enter case facts.
export const DomainStatusSchema=z.enum(['in_scope','out_of_scope','needs_clarification']);
export type DomainStatus=z.infer<typeof DomainStatusSchema>;
export const DomainAssessmentSchema=z.object({status:DomainStatusSchema,reason:z.string(),clarification:z.string().nullable(),resourceIds:z.array(z.string())}).strict();
export type DomainAssessment=z.infer<typeof DomainAssessmentSchema>;
export const UsePreferencesSchema=z.object({aiEnabled:z.boolean().default(true),saveMode:z.enum(['memory','local']).default('memory'),refreshRecovery:z.boolean().default(false),expiresAt:z.string().datetime().nullable().default(null)}).strict();
export type UsePreferences=z.infer<typeof UsePreferencesSchema>;
export const DEFAULT_PREFERENCES:UsePreferences={aiEnabled:true,saveMode:'memory',refreshRecovery:false,expiresAt:null};
export const COUNTRY_CODES=('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');
export const CountryCodeSchema=z.enum(COUNTRY_CODES);
export const JurisdictionCodeSchema=z.enum(['england_wales','scotland','northern_ireland','national','unknown']);
export const CanonicalJurisdictionSchema=z.object({countryCode:CountryCodeSchema.nullable(),country:z.string(),jurisdictionCode:JurisdictionCodeSchema,legalSystem:z.string().nullable(),recognized:z.boolean()}).strict();
export type CanonicalJurisdiction=z.infer<typeof CanonicalJurisdictionSchema>;
export const ResearchOperationSchema=z.enum(['initial','supplement']);
export type ResearchOperation=z.infer<typeof ResearchOperationSchema>;
export const RequestIdentitySchema=z.object({requestId:z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),inputVersion:z.number().int().positive(),operation:ResearchOperationSchema,parentAnalysisId:z.string().max(100).optional()}).strict();
export type RequestIdentity=z.infer<typeof RequestIdentitySchema>;
export const WorkflowErrorCodeSchema=z.enum(['INVALID_INPUT','PAYLOAD_TOO_LARGE','CONFIGURATION_ERROR','FORBIDDEN','TIMEOUT','CANCELLED','RATE_LIMITED','QUOTA_EXHAUSTED','MODEL_REFUSAL','INCOMPLETE_OUTPUT','INVALID_MODEL_OUTPUT','UPSTREAM_ERROR','INTERNAL_ERROR','OUT_OF_SCOPE','SCOPE_CLARIFICATION_REQUIRED','WEB_SEARCH_DISABLED']);
export type WorkflowErrorCode=z.infer<typeof WorkflowErrorCodeSchema>;
export const RequestErrorSchema=z.object({code:WorkflowErrorCodeSchema,message:z.string(),requestId:z.string(),retryable:z.boolean().optional(),retryAfterSeconds:z.number().int().nonnegative().optional(),domain:DomainAssessmentSchema.optional()});
export const SourceCategorySchema=z.enum(['curated_case','international_standard','mechanism','assistance','public_web']);
export const SourceReviewStatusSchema=z.enum(['unreviewed','agent_checked','team_verified','legacy_recorded','conflict']);
export const SourceDescriptorSchema=z.object({sourceId:z.string(),category:SourceCategorySchema,reviewStatus:SourceReviewStatusSchema,applicability:z.array(z.string()),locator:z.string(),agentCheckedAt:z.string().nullable(),teamReviewedAt:z.string().nullable(),unknowns:z.array(z.string())}).strict().superRefine((value,ctx)=>{
 if(value.reviewStatus==='team_verified'&&!value.teamReviewedAt)ctx.addIssue({code:'custom',path:['teamReviewedAt'],message:'Team verification requires a recorded team review date.'});
 if(value.reviewStatus==='agent_checked'&&!value.agentCheckedAt)ctx.addIssue({code:'custom',path:['agentCheckedAt'],message:'Agent checking requires a recorded source-check date.'});
});
export type SourceDescriptor=z.infer<typeof SourceDescriptorSchema>;
export const ResourceKindSchema=z.enum(['treaty','interpretation','un_mechanism','regional_mechanism','assistance','general_resource']);
export const ExecutionStageSchema=z.object({stage:z.enum(['intake','planning','search','reading','synthesis']),elapsedMs:z.number().nonnegative(),model:z.string().nullable(),responseId:z.string().nullable(),inputTokens:z.number().int().nonnegative().nullable(),outputTokens:z.number().int().nonnegative().nullable(),toolCalls:z.number().int().nonnegative(),status:z.enum(['completed','failed','skipped'])}).strict();
export const ResearchExecutionSchema=z.object({requestId:z.string(),inputVersion:z.number().int().positive(),operation:ResearchOperationSchema,round:z.number().int().positive(),stages:z.array(ExecutionStageSchema),failureStage:z.string().nullable(),controlledSearch:z.boolean(),reservedCostUsd:z.number().nonnegative().nullable(),actualCostUsd:z.number().nonnegative().nullable()}).strict();
export type ResearchExecution=z.infer<typeof ResearchExecutionSchema>;
