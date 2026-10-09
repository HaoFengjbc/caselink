import {z} from 'zod';
import {MaterialRecordSchema,type MaterialRecord} from '../materials/contracts';
import {DomainAssessmentSchema,ResearchExecutionSchema} from '../workflow-contracts';

export const INTAKE_QUESTION_IDS=['uk-jurisdiction','case-kind','current-stage','latest-document','key-dates','representation','prior-actions','immediate-concerns','source-material','goal-details','disclosure-details'] as const;
export const FixedIntakeQuestionIdSchema=z.enum(INTAKE_QUESTION_IDS);
export type FixedIntakeQuestionId=z.infer<typeof FixedIntakeQuestionIdSchema>;
export const IntakeQuestionIdSchema=z.union([FixedIntakeQuestionIdSchema,z.string().regex(/^dynamic-[a-f0-9]{20}$/)]);
export const isFixedIntakeQuestionId=(id:string):id is FixedIntakeQuestionId=>FixedIntakeQuestionIdSchema.safeParse(id).success;
export type IntakeQuestionId=z.infer<typeof IntakeQuestionIdSchema>;
/** Sections of the organized case sheet. */
export const INTAKE_SLOTS=['event','claim','status','evidence','concern','other'] as const;
export const IntakeSlotSchema=z.enum(INTAKE_SLOTS);
export type IntakeSlot=z.infer<typeof IntakeSlotSchema>;
// `text` is the editable note shown to the user; `summary` keeps the model's original short restatement so an edit can be undone.
export const IntakeFactSchema=z.object({id:z.string().min(1).max(100),text:z.string().min(1).max(800),quote:z.string().min(1).max(800),summary:z.string().min(1).max(200).optional(),slot:IntakeSlotSchema.optional(),materialItemId:z.string().max(100).optional()}).strict();
const IntakeFactDraftSchema=IntakeFactSchema.extend({text:z.string().max(800)});
export const IntakeAnswerSchema=z.object({questionId:IntakeQuestionIdSchema,question:z.string().min(1).max(300),answer:z.string().max(800),anchorQuote:z.string().max(800).optional()}).strict();

type QuoteMaterial={narrative:string;answers:Array<{answer:string}>;materials?:MaterialRecord};
export function hasIntakeQuote(material:QuoteMaterial,quote:string):boolean{
  return quote.trim().length>0&&[material.narrative,...material.answers.map(a=>a.answer),...(material.materials?.items.flatMap(i=>i.sources.map(s=>s.quote))??[])].some(text=>text.includes(quote));
}
export const IntakeRecordSchema=z.object({
  version:z.literal(1),jurisdiction:z.string().max(100),caseKind:z.enum(['criminal','civil','administrative','mixed','unknown']),
  narrative:z.string().max(6000),goalText:z.string().max(800),disclosureDetails:z.string().max(800),
  answers:z.array(IntakeAnswerSchema).max(40),facts:z.array(IntakeFactDraftSchema).max(12),confirmed:z.boolean(),
  /** Whether the user says the matter involves journalism or public expression: the scope of the reviewed library. Absent in older drafts. */
  expression:z.enum(['yes','no','unsure']).optional(),
  materials:MaterialRecordSchema.optional(),
}).strict().superRefine((record,ctx)=>{
  if(record.confirmed&&record.materials){
    const m=record.materials;
    if(m.reviewNeeded||!m.goalConfirmed||!m.disclosureConfirmed||m.conflicts.some(c=>!c.resolution?.trim())||m.items.some(i=>i.dateReview&&!i.dateReview.resolution))ctx.addIssue({code:'custom',path:['materials'],message:'请先核对材料、处理日期疑点和冲突并确认本次目标与披露范围。'});
    if(!record.goalText.trim()||!record.disclosureDetails.trim())ctx.addIssue({code:'custom',path:['materials'],message:'材料不能替用户确认本次目标和披露边界。'});
  }
  if(new Set(record.answers.map(answer=>answer.questionId)).size!==record.answers.length)ctx.addIssue({code:'custom',path:['answers'],message:'同一补充问题不能重复保存答案。'});
  if(new Set(record.facts.map(fact=>fact.id)).size!==record.facts.length)ctx.addIssue({code:'custom',path:['facts'],message:'事实标识不能重复。'});
  // Human edits may differ from the excerpt, but every confirmed excerpt must still be traceable.
  if(record.confirmed)record.facts.forEach((fact,index)=>{
    if(!fact.text.trim())ctx.addIssue({code:'custom',path:['facts',index,'text'],message:'请完成事实笔记或移除空白项后再确认。'});
    if(!hasIntakeQuote(record,fact.quote))ctx.addIssue({code:'custom',path:['facts',index,'quote'],message:'原话已改变，请核对摘录后再确认。'});
  });
});
export type IntakeRecord=z.infer<typeof IntakeRecordSchema>;
export type IntakeFact=z.infer<typeof IntakeFactSchema>;
export const IntakeQuestionSchema=z.object({id:IntakeQuestionIdSchema,title:z.string().min(1).max(300),reason:z.string().min(1).max(800),options:z.array(z.string().min(1).max(160)).max(8),sourceIds:z.array(z.string().min(1).max(100)).max(3),anchorQuote:z.string().max(800).optional()}).strict();
export type IntakeQuestion=z.infer<typeof IntakeQuestionSchema>;
export const IntakeSourceSchema=z.object({id:z.string().min(1).max(100),title:z.string().min(1).max(300),url:z.string().url(),checkedAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),scope:z.string().min(1).max(800)}).strict();
export type IntakeSource=z.infer<typeof IntakeSourceSchema>;
export const IntakeResponseSchema=z.object({mode:z.enum(['live_ai','manual']),facts:z.array(IntakeFactSchema).max(12),questions:z.array(IntakeQuestionSchema).max(3),sources:z.array(IntakeSourceSchema).max(3),model:z.string().min(1).max(100).optional(),execution:ResearchExecutionSchema.optional(),domain:DomainAssessmentSchema.optional()}).strict();
export type IntakeResponse=z.infer<typeof IntakeResponseSchema>;

// The model proposes contextual factual questions; IDs and official sources are server-owned.
export const ModelIntakeQuestionSchema=z.object({title:z.string().min(8).max(300),reason:z.string().min(8).max(800),options:z.array(z.string().min(1).max(160)).max(6),anchorQuote:z.string().min(2).max(800)}).strict();
export type ModelIntakeQuestion=z.infer<typeof ModelIntakeQuestionSchema>;
// Sent to the model as the strict output format: every excerpt carries a short restatement and a section.
export const ModelIntakeOutputSchema=z.object({facts:z.array(z.object({quote:z.string().min(1).max(800),summary:z.string(),slot:IntakeSlotSchema}).strict()).max(12),questions:z.array(ModelIntakeQuestionSchema).max(3)}).strict();
/** Accepts outputs without a summary or section too; such excerpts are shown in the user's own words. */
export const ModelIntakeOutputInputSchema=z.object({facts:z.array(z.object({quote:z.string().min(1).max(800),summary:z.string().optional(),slot:IntakeSlotSchema.optional()}).strict()).max(12),questions:z.array(ModelIntakeQuestionSchema).max(3)}).strict();
export type ModelIntakeOutput=z.infer<typeof ModelIntakeOutputSchema>;
