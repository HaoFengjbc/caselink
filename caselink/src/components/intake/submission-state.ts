import type { NewCaseInput } from '@/lib/contracts';
import { inputKey } from '@/lib/session';
import { RETRYABLE_REQUEST_CODES } from '@/lib/analysis-protocol';
export type SubmissionFailure = { code: string; retryable?: boolean; inputIdentity: string };
/** Confirmation changes no facts. Failure/retry eligibility belongs to a particular fact revision. */
export function submissionIdentity(input: NewCaseInput): string {
  return inputKey({ ...input, ...(input.intake ? { intake: { ...input.intake, confirmed: false } } : {}) });
}
export function activeFailure<T extends SubmissionFailure>(failure: T | null, input: NewCaseInput): T | null {
  return failure?.inputIdentity === submissionIdentity(input) ? failure : null;
}
export function mayRetry(failure: Pick<SubmissionFailure, 'code' | 'retryable'> | null): boolean {
  return !!failure && failure.retryable !== false && (failure.retryable === true || RETRYABLE_REQUEST_CODES.has(failure.code));
}
