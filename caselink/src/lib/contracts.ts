import { z } from 'zod';
import {DomainAssessmentSchema,CanonicalJurisdictionSchema,SourceDescriptorSchema,SourceReviewStatusSchema,ResourceKindSchema,ResearchExecutionSchema} from './workflow-contracts';
export * from './workflow-contracts';
import {IntakeRecordSchema} from './intake/contracts';
import {WebResearchSchema,WebComparisonSchema,ActionWebSourcesSchema} from './research/contracts';
export {IntakeRecordSchema} from './intake/contracts';
export type {IntakeRecord} from './intake/contracts';

export const SCHEMA_VERSION = '1.0' as const;
export const CORPUS_VERSION = '2026-10-09.v3';
export const PROMPT_VERSION = '4.0';
export const StageSchema = z.enum(['investigation','pretrial','trial','appeal','postjudgment','unknown']);
export const PersonTypeSchema = z.enum(['journalist','blogger','activist','other','unknown']);
export const BackgroundTagSchema = z.enum(['reporting','investigation_report','social_media','repost','other','unknown']);
export const ProblemSchema = z.enum(['detained','lawyer_access','file_access','threats','expression_restricted','other','none','unknown']);
export const GoalSchema = z.enum(['release','lawyer','conditions','drop_charges','change_judgment','other','unknown']);
export const PublicitySchema = z.enum(['public','consent','private','unknown']);
export const ResourceTypeSchema = z.enum(['lawyer','local_ngo','press_association','international','none','unknown']);
const short = z.string().max(800);
const ids = z.array(z.string().min(1).max(100)).max(40);
export const NewCaseInputSchema = z.object({
  schemaVersion:z.literal(SCHEMA_VERSION),country:z.string().min(1).max(100),stage:StageSchema,
  currentProblems:z.array(ProblemSchema).min(1).max(8),
  background:z.object({activities:z.array(BackgroundTagSchema).max(6),personType:PersonTypeSchema,description:short}),
  primaryGoal:GoalSchema,keyDates:z.array(z.object({date:z.string().max(40),event:z.string().max(120),approximate:z.boolean()})).max(5),
  resources:z.array(ResourceTypeSchema).max(6),resourceConstraints:short,
  priorActions:z.object({status:z.enum(['none','unknown','described']),description:short,date:z.string().max(40)}),
  publicity:PublicitySchema,isExample:z.boolean(),exampleId:z.string().max(100).nullable(),intake:IntakeRecordSchema.optional()
}).strict().superRefine((v,c)=>{
  for(const [field,values] of [['currentProblems',v.currentProblems],['resources',v.resources],['background.activities',v.background.activities]] as const){
    if((values.includes('unknown' as never)||values.includes('none' as never))&&values.length>1)c.addIssue({code:'custom',message:'不清楚或没有不能与其他选项同时选择',path:field.split('.')});
    if(new Set(values).size!==values.length)c.addIssue({code:'custom',message:'选项重复',path:field.split('.')});
  }
});
export type NewCaseInput = z.infer<typeof NewCaseInputSchema>;
export type Stage = z.infer<typeof StageSchema>;
export const DateSchema=z.object({value:z.string().nullable(),precision:z.enum(['day','month','year','range','unknown']),originalText:z.string()});
export const EvidenceSchema=z.object({evidenceId:z.string(),caseId:z.string(),documentId:z.string(),pdfPage:z.number().int().positive(),printedPage:z.string().nullable(),exactQuote:z.string().min(1),explanation:z.string(),origin:z.enum(['direct_report','unverified_footnote','verified_supplement']),reviewStatus:z.enum(['draft','verified','conflict']),sourceUrl:z.string()});
export type Evidence=z.infer<typeof EvidenceSchema>;
export const SourceDocumentSchema=z.object({documentId:z.string(),originalFilename:z.string(),title:z.string(),author:z.string(),publishedDate:z.string(),hash:z.string(),pageCount:z.number().int().positive(),sourceUrl:z.string(),checkedAt:z.string(),factsAsOf:z.string(),sourceType:z.enum(['case_report','thematic_report','statement','followup','current_guidance']),sourceFormat:z.enum(['pdf','web_print']).default('pdf')});
export const EventSchema=z.object({eventId:z.string(),caseId:z.string(),eventType:z.string(),description:z.string(),stageAtEvent:StageSchema,date:DateSchema,evidenceIds:ids});
export const InterventionSchema=z.object({interventionId:z.string(),caseId:z.string(),actor:z.string(),action:z.string(),category:z.enum(['legal','international','media','ngo','diplomatic','monitoring','other']),executionStatus:z.enum(['implemented','recommended_only','unknown']),stageAtAction:StageSchema,date:DateSchema,observedOutcomeIds:ids,relationshipToOutcome:z.enum(['explicit','sequence_only','unknown']),evidenceIds:ids});
export const OutcomeSchema=z.object({outcomeId:z.string(),caseId:z.string(),description:z.string(),type:z.enum(['specific','partial','pending','unrecorded']),observedDate:DateSchema,statusAsOf:z.string(),evidenceIds:ids});
export const RecommendationSchema=z.object({recommendationId:z.string(),description:z.string(),actor:z.string(),category:InterventionSchema.shape.category,evidenceIds:ids});
export const CaseRecordSchema=z.object({caseId:z.string(),title:z.string(),country:z.string(),personTypes:z.array(PersonTypeSchema),backgroundTags:z.array(BackgroundTagSchema),problems:z.array(ProblemSchema),summary:z.string(),evidenceIds:ids,sourceDocumentIds:ids,reportDate:z.string(),lastKnownStatusAsOf:z.string(),statusSummary:z.string(),events:z.array(EventSchema),interventions:z.array(InterventionSchema),outcomes:z.array(OutcomeSchema),reportRecommendations:z.array(RecommendationSchema),unknowns:z.array(z.string()),conflicts:z.array(z.object({description:z.string(),evidenceIds:ids}))});
export type CaseRecord=z.infer<typeof CaseRecordSchema>;
export type SourceDocument=z.infer<typeof SourceDocumentSchema>;
export const ResourceSchema=z.object({resourceId:z.string(),name:z.string(),officialUrl:z.string(),checkedAt:z.string(),applicability:z.string(),requiredMaterials:z.array(z.string()),type:ResourceKindSchema.optional(),locator:z.string().optional(),summary:z.string().optional(),eligibility:z.array(z.string()).optional(),reviewStatus:SourceReviewStatusSchema.optional(),agentCheckedAt:z.string().nullable().optional(),teamReviewedAt:z.string().nullable().optional(),unknowns:z.array(z.string()).optional(),tags:z.array(z.string()).optional()}).superRefine((value,ctx)=>{
 if(value.reviewStatus==='team_verified'&&!value.teamReviewedAt)ctx.addIssue({code:'custom',path:['teamReviewedAt'],message:'Team verification requires a recorded review date.'});
 if(value.reviewStatus==='agent_checked'&&!value.agentCheckedAt)ctx.addIssue({code:'custom',path:['agentCheckedAt'],message:'Agent checking requires a recorded source-check date.'});
});
export type Resource=z.infer<typeof ResourceSchema>;
export const ReportSnapshotSchema=z.object({version:z.literal(1),capturedAt:z.string(),corpusVersion:z.string(),completeness:z.enum(['complete','legacy_partial']),locale:z.enum(['zh','en']),cases:z.array(CaseRecordSchema),evidence:z.array(EvidenceSchema),documents:z.array(SourceDocumentSchema),resources:z.array(ResourceSchema),webResearch:WebResearchSchema.optional(),sourceDescriptors:z.array(SourceDescriptorSchema)}).strict();
export type ReportSnapshot=z.infer<typeof ReportSnapshotSchema>;
export const ComparisonBriefSchema=z.object({briefId:z.string(),title:z.string(),createdAt:z.string(),locale:z.enum(['zh','en']),caseIds:z.array(z.string()).min(2).max(4),snapshot:ReportSnapshotSchema,commonIssues:z.array(z.object({label:z.string(),supportingCaseIds:z.array(z.string()),evidenceIds:z.array(z.string()),differences:z.array(z.string()),unknowns:z.array(z.string())})),limitations:z.array(z.string())}).strict();
export type ComparisonBrief=z.infer<typeof ComparisonBriefSchema>;
export const ComparableCaseSchema=z.object({caseId:z.string(),relevance:z.enum(['comparable','related']),matchDimensions:z.array(z.string()).max(6),similarities:z.array(short).max(6),differences:z.array(short).max(6),evidenceIds:ids});
export const ActionOptionSchema=z.object({actionId:z.string(),goal:GoalSchema,title:z.string().max(160),applicability:z.enum(['priority','conditional','defer']),reason:short,leadRole:z.string().max(160),prerequisites:z.array(short).max(8),timing:short,steps:z.array(short).min(3).max(8),materials:z.array(short).min(2).max(8),collaborators:z.array(short).max(8),followUp:z.array(short).min(2).max(8),supportingEvidenceIds:ids,differences:z.array(short).max(8),uncertainties:z.array(short).max(8),basisType:z.enum(['historical_action','report_recommendation','general_preparation','web_research']),requiresPublicity:z.boolean(),resourceIds:ids});
export type ActionOption=z.infer<typeof ActionOptionSchema>;
export const ModelAnalysisOutputSchema=z.object({comparableCases:z.array(ComparableCaseSchema).max(3),actionOptions:z.array(ActionOptionSchema).max(3),missingInformation:z.array(short).max(12),limitations:z.array(short).max(12)}).strict();
export type ModelAnalysisOutput=z.infer<typeof ModelAnalysisOutputSchema>;
export const WebModelAnalysisOutputSchema=ModelAnalysisOutputSchema.extend({webComparisons:z.array(WebComparisonSchema).max(5),actionWebSources:z.array(ActionWebSourcesSchema).max(3)}).strict();
export type WebModelAnalysisOutput=z.infer<typeof WebModelAnalysisOutputSchema>;
// Server-owned metadata is deliberately absent from the model output schema.
export const ActionOriginSchema=z.object({actionId:z.string(),origin:z.enum(['ai','rule','preset']),reason:z.string().max(500).nullable()}).strict();
export const ResearchAssessmentSchema=z.object({status:z.enum(['relevant_cases_found','no_relevant_cases','search_unavailable','not_searched']),attempts:z.number().int().min(0).max(2),recovery:z.enum(['not_needed','found_cases','no_relevant_cases','unavailable','budget_exhausted']),note:z.string().max(800)}).strict();
export const AnalysisResultSchema=ModelAnalysisOutputSchema.extend({analysisId:z.string(),schemaVersion:z.literal(SCHEMA_VERSION),inputHash:z.string(),corpusVersion:z.string(),promptVersion:z.string(),createdAt:z.string(),mode:z.enum(['live_ai','rule_reference','preset_demo']),locale:z.enum(['zh','en']).optional(),webResearch:WebResearchSchema.optional(),webComparisons:z.array(WebComparisonSchema).max(5).optional(),actionWebSources:z.array(ActionWebSourcesSchema).max(3).optional(),actionOrigins:z.array(ActionOriginSchema).max(3).optional(),researchAssessment:ResearchAssessmentSchema.optional(),historicalComparisons:z.array(z.object({caseId:z.string(),interventionId:z.string()})),sources:z.array(EvidenceSchema),snapshot:ReportSnapshotSchema.optional(),domain:DomainAssessmentSchema.optional(),jurisdiction:CanonicalJurisdictionSchema.optional(),execution:ResearchExecutionSchema.optional()});
export type AnalysisResult=z.infer<typeof AnalysisResultSchema>;
export const EMPTY_INPUT:NewCaseInput={schemaVersion:SCHEMA_VERSION,country:'',stage:'unknown',currentProblems:['unknown'],background:{activities:[],personType:'unknown',description:''},primaryGoal:'unknown',keyDates:[],resources:[],resourceConstraints:'',priorActions:{status:'unknown',description:'',date:''},publicity:'unknown',isExample:false,exampleId:null};
