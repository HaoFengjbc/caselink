import {z} from 'zod';
import {RequestIdentitySchema,ResearchExecutionSchema} from '../workflow-contracts';

// Deliberately below Vercel's 4.5 MB function request limit, including multipart overhead.
export const MATERIAL_LIMITS={maxFiles:3,maxFileBytes:3*1024*1024,maxRequestBytes:4_000_000,maxTotalFileBytes:3_900_000,maxPages:30,maxTextBytes:75_000,parseTimeoutMs:15_000,requestTimeoutMs:180_000} as const;
export const MaterialFieldSchema=z.enum(['party','country','jurisdiction','expression','document_type','stage','event','claim','position','prior_action','evidence','missing_evidence','date','demand','restriction']);
export const MaterialNatureSchema=z.enum(['allegation','party_statement','court_finding','document_record','uncertain']);
export const MaterialSourceSchema=z.object({fileId:z.string().min(1).max(100),filename:z.string().min(1).max(180),pdfPage:z.number().int().min(1).max(30),printedPage:z.string().max(80).nullable(),quote:z.string().min(1).max(800),method:z.literal('embedded_text')}).strict();
export const MaterialItemSchema=z.object({id:z.string().min(1).max(100),field:MaterialFieldSchema,text:z.string().min(1).max(800),subject:z.string().max(180),nature:MaterialNatureSchema,dateKind:z.enum(['document','event','facts_as_of','requested_deadline','none']),date:z.string().max(80).nullable(),sources:z.array(MaterialSourceSchema).min(1).max(6),uncertainty:z.string().max(500).nullable(),status:z.enum(['extracted','confirmed','edited']),originalText:z.string().min(1).max(800)}).strict();
export const MaterialDocumentSchema=z.object({fileId:z.string().min(1).max(100),filename:z.string().min(1).max(180),size:z.number().int().nonnegative(),pageCount:z.number().int().min(1).max(30),processedPages:z.array(z.number().int().positive()).max(30),unreadablePages:z.array(z.number().int().positive()).max(30),omittedPages:z.array(z.number().int().positive()).max(30),warnings:z.array(z.string().max(500)).max(30)}).strict();
export const MaterialPageSchema=z.object({pdfPage:z.number().int().positive(),text:z.string().max(75000),status:z.enum(['read','blank','image_only','unreadable','omitted']),printedPage:z.string().max(80).nullable()}).strict();
export const ParsedMaterialSchema=MaterialDocumentSchema.extend({pages:z.array(MaterialPageSchema).max(30)}).strict();
export const MaterialConflictSchema=z.object({id:z.string().min(1).max(100),description:z.string().min(1).max(500),itemIds:z.array(z.string().min(1).max(100)).min(2).max(8),resolution:z.string().max(800).nullable()}).strict();
export const MaterialPrefillSchema=z.object({country:z.string().max(100),jurisdiction:z.string().max(100),caseKind:z.enum(['criminal','civil','administrative','mixed','unknown']),expression:z.enum(['yes','no','unsure']),stage:z.enum(['investigation','pretrial','trial','appeal','postjudgment','unknown']),personType:z.enum(['journalist','blogger','activist','other','unknown'])}).strict();
export const MaterialCandidateSchema=z.object({id:z.string().min(1).max(100),label:z.string().min(1).max(180),prefill:MaterialPrefillSchema,items:z.array(MaterialItemSchema).max(48),conflicts:z.array(MaterialConflictSchema).max(12),missing:z.array(z.string().max(500)).max(8)}).strict();
export const MaterialRecordSchema=z.object({version:z.literal(1),documents:z.array(MaterialDocumentSchema).max(3),selectedCaseId:z.string().min(1).max(100),selectedCaseLabel:z.string().max(180),items:z.array(MaterialItemSchema).max(48),conflicts:z.array(MaterialConflictSchema).max(12),missing:z.array(z.string().max(500)).max(8),reviewNeeded:z.boolean(),goalConfirmed:z.boolean(),disclosureConfirmed:z.boolean(),latestConfirmed:z.boolean()}).strict().superRefine((record,ctx)=>{
 const files=new Map(record.documents.map(d=>[d.fileId,d]));
 if(files.size!==record.documents.length)ctx.addIssue({code:'custom',message:'Duplicate material IDs'});
 const ids=new Set(record.items.map(i=>i.id));
 if(ids.size!==record.items.length)ctx.addIssue({code:'custom',message:'Duplicate extraction IDs'});
 for(const item of record.items)for(const source of item.sources){const file=files.get(source.fileId);if(!file||file.filename!==source.filename||!file.processedPages.includes(source.pdfPage))ctx.addIssue({code:'custom',message:'Material source no longer belongs to the processed file range'});}
 for(const conflict of record.conflicts)if(conflict.itemIds.some(id=>!ids.has(id)))ctx.addIssue({code:'custom',message:'Conflict refers to a missing extraction'});
});
export const MaterialRequestSchema=RequestIdentitySchema.extend({locale:z.enum(['zh','en']).default('zh'),aiConsent:z.boolean(),existingPageCount:z.number().int().min(0).max(30).default(0),existingFileCount:z.number().int().min(0).max(3).default(0),background:z.string().max(800).default('')}).strict();
export const MaterialResponseSchema=z.object({mode:z.enum(['live_ai','local_text']),documents:z.array(ParsedMaterialSchema).max(3),candidates:z.array(MaterialCandidateSchema).max(5),model:z.string().max(100).optional(),execution:ResearchExecutionSchema.optional(),warnings:z.array(z.string().max(500)).max(30)}).strict();
export const MaterialStreamEventSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('stage'),stage:z.enum(['checking','reading','organizing']),fileId:z.string().optional(),filename:z.string().optional()}).strict(),
 z.object({type:z.literal('document'),document:ParsedMaterialSchema}).strict(),
 z.object({type:z.literal('result'),result:MaterialResponseSchema}).strict(),
 z.object({type:z.literal('error'),code:z.string(),message:z.string(),retryable:z.boolean().optional(),retryAfterSeconds:z.number().optional()}).strict(),
]);
export type MaterialSource=z.infer<typeof MaterialSourceSchema>;
export type MaterialItem=z.infer<typeof MaterialItemSchema>;
export type MaterialDocument=z.infer<typeof MaterialDocumentSchema>;
export type ParsedMaterial=z.infer<typeof ParsedMaterialSchema>;
export type MaterialConflict=z.infer<typeof MaterialConflictSchema>;
export type MaterialCandidate=z.infer<typeof MaterialCandidateSchema>;
export type MaterialRecord=z.infer<typeof MaterialRecordSchema>;
export type MaterialRequest=z.infer<typeof MaterialRequestSchema>;
export type MaterialResponse=z.infer<typeof MaterialResponseSchema>;
export type MaterialStreamEvent=z.infer<typeof MaterialStreamEventSchema>;
