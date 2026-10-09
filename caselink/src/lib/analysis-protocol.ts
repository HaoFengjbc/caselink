import {z} from 'zod';
import {NewCaseInputSchema} from './contracts';
import {RequestIdentitySchema,UsePreferencesSchema} from './workflow-contracts';
export const AnalysisRequestSchema=RequestIdentitySchema.extend({input:NewCaseInputSchema,forceRule:z.boolean().optional(),locale:z.enum(['zh','en']).optional(),preferences:UsePreferencesSchema.optional()}).strict();
export type AnalysisRequest=z.infer<typeof AnalysisRequestSchema>;
export const RETRYABLE_REQUEST_CODES=new Set(['TIMEOUT','NETWORK_ERROR','RATE_LIMITED','UPSTREAM_ERROR','INTERNAL_ERROR','CONCURRENCY_LIMIT','REQUEST_IN_PROGRESS']);
// A retry keeps the request ID/input version. Edits or explicit supplementation create a new identity.
export const MAX_UNCHANGED_INPUT_ATTEMPTS=2;
