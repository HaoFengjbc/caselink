import {z} from 'zod';
import {NewCaseInputSchema} from './contracts';
import {RequestIdentitySchema,UsePreferencesSchema} from './workflow-contracts';
export const AnalysisRequestSchema=RequestIdentitySchema.extend({input:NewCaseInputSchema,forceRule:z.boolean().optional(),locale:z.enum(['zh','en']).optional(),preferences:UsePreferencesSchema.optional()}).strict();
export type AnalysisRequest=z.infer<typeof AnalysisRequestSchema>;
export const RETRYABLE_REQUEST_CODES=new Set(['TIMEOUT','NETWORK_ERROR','RATE_LIMITED','UPSTREAM_ERROR','INTERNAL_ERROR']);
// Request IDs/input versions associate results with drafts; there is no server result cache or retry quota.

export const IntakeRequestSchema=AnalysisRequestSchema.omit({forceRule:true}).extend({forceManual:z.boolean().optional()}).strict();
export type IntakeRequest=z.infer<typeof IntakeRequestSchema>;
