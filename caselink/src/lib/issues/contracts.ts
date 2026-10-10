import {z} from 'zod';

/**
 * A key legal question in this case, as the model drafts it. Every authority must point at something
 * the server can check: a curated binding, a library case with its excerpts, or a public page whose
 * quoted words the server finds itself. Anything that cannot be checked is removed before display.
 */
export const IssueFactSchema=z.object({text:z.string().min(1).max(240),materialItemId:z.string().max(100).nullable(),factId:z.string().max(100).nullable()}).strict();
export const IssueAuthoritySchema=z.object({
 kind:z.enum(['local','international','case']),
 bindingId:z.string().max(200).nullable(),
 sourceId:z.string().max(20).nullable(),
 quote:z.string().max(600).nullable(),
 locator:z.string().max(160).nullable(),
 caseId:z.string().max(100).nullable(),
 evidenceIds:z.array(z.string().max(100)).max(4),
 point:z.string().min(1).max(240),
}).strict();
export const ModelIssueSchema=z.object({
 issueId:z.string().regex(/^issue-[1-3]$/),
 question:z.string().min(1).max(160),
 facts:z.array(IssueFactSchema).max(3),
 authorities:z.array(IssueAuthoritySchema).max(4),
 application:z.string().max(400),
 nextStep:z.string().max(200),
}).strict();
export type ModelIssue=z.infer<typeof ModelIssueSchema>;

/** The checked, display-ready record kept in the result and frozen in the report snapshot. */
export const CaseIssueFactSchema=z.object({text:z.string().max(240),origin:z.enum(['document','user']),pageLabel:z.string().max(120).nullable()}).strict();
export const CaseIssueAuthoritySchema=z.object({
 kind:z.enum(['local','international','case']),
 // quote_matched: the server found the quoted words on the cited public page; catalog: curated and agent-checked; library: reviewed case excerpts.
 check:z.enum(['quote_matched','catalog','library']),
 title:z.string().max(300),
 locator:z.string().max(200).nullable(),
 point:z.string().max(300),
 quote:z.string().max(800).nullable(),
 url:z.string().url().max(3000).nullable(),
 hostname:z.string().max(250).nullable(),
 bindingId:z.string().max(200).nullable(),
 caseId:z.string().max(100).nullable(),
 evidenceIds:z.array(z.string()).max(4),
}).strict();
export const CaseIssueSchema=z.object({
 issueId:z.string().max(20),
 question:z.string().max(160),
 facts:z.array(CaseIssueFactSchema).max(3),
 authorities:z.array(CaseIssueAuthoritySchema).max(4),
 application:z.string().max(400).nullable(),
 nextStep:z.string().max(200).nullable(),
 origin:z.enum(['ai','rule']),
}).strict();
export type CaseIssue=z.infer<typeof CaseIssueSchema>;
export type CaseIssueAuthority=z.infer<typeof CaseIssueAuthoritySchema>;
