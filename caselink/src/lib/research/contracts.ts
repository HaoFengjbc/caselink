import {z} from 'zod';
import {ResearchPlanSchema} from './plan';

export const ResearchFailureSchema=z.enum(['timeout','no_search','no_citations','search_failed','invalid_output','planning_failed','unsafe_plan','insufficient_plan','budget_exhausted']);
export const ResearchAttemptSchema=z.object({
 attempt:z.union([z.literal(1),z.literal(2)]),reason:z.enum(['initial','no_relevant_comparisons']),startedAt:z.string(),
 status:z.enum(['completed','no_results','unavailable']),searchTerms:z.array(z.string().max(700)).max(20),
 actualQueries:z.array(z.string().max(700)).max(40),searchCallCount:z.number().int().min(0).max(20),
 sourceCount:z.number().int().min(0).max(30),failureReason:ResearchFailureSchema.nullable(),
}).strict();

export const WebSourceSchema=z.object({sourceId:z.string().regex(/^web-[1-9][0-9]*$/),url:z.string().url().max(3000),title:z.string().min(1).max(500),hostname:z.string().max(250),citationKind:z.enum(['url_annotation','tool_returned_link']).optional(),pageOpened:z.boolean().optional()}).strict();
export type WebSource=z.infer<typeof WebSourceSchema>;
export const WebPassageSchema=z.object({text:z.string().min(1).max(8000),sourceIds:z.array(z.string()).max(30)}).strict();
export const WebResearchSchema=z.object({
  status:z.enum(['completed','no_results','unavailable']),searchedAt:z.string(),
  searchTerms:z.array(z.string().max(700)).max(20),
  passages:z.array(WebPassageSchema).max(40),sources:z.array(WebSourceSchema).max(30),
  searchCallCount:z.number().int().min(0).max(20),
  failureReason:ResearchFailureSchema.nullable(),
  plan:ResearchPlanSchema.optional(),planningMode:z.enum(['semantic','structured_fallback']).optional(),
  actualQueries:z.array(z.string().max(700)).max(40).optional(),
  attempts:z.array(ResearchAttemptSchema).max(2).optional(),
  relevanceStatus:z.literal('not_assessed').optional(),
}).strict();
export type WebResearch=z.infer<typeof WebResearchSchema>;
export const WebComparisonSchema=z.object({
  title:z.string().min(1).max(200),jurisdiction:z.string().max(150),statusAsOf:z.string().max(120).nullable(),
  summary:z.string().min(1).max(1000),similarities:z.array(z.string().max(800)).max(4),differences:z.array(z.string().max(800)).min(1).max(5),
  sourceIds:z.array(z.string()).min(1).max(8),
}).strict();
export type WebComparison=z.infer<typeof WebComparisonSchema>;
export const ActionWebSourcesSchema=z.object({actionId:z.string(),sourceIds:z.array(z.string()).min(1).max(8)}).strict();
