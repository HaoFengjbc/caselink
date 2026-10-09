import {AnalysisError} from '../ai/errors';
import {currentExecution} from '../ai/execution';
import type {Locale} from '../i18n/locale';

export type MaterialValidationReason='schema'|'duplicate_case'|'unknown_file'|'unreadable_page'|'quote_mismatch'|'date_mismatch'|'missing_date'|'duplicate_item'|'invalid_conflict';
type Position={candidate?:number;item?:number;source?:number;pdfPage?:number};
const descriptions:Record<MaterialValidationReason,[string,string]>={
 schema:['AI 返回的整理结构不完整或字段格式不符。','The AI extraction structure or field format was invalid.'],
 duplicate_case:['AI 返回了无法区分的重复案件分组。','The AI returned duplicate case groups that cannot be distinguished.'],
 unknown_file:['AI 引用的文件编号与本次上传不符。','An AI citation points to a file outside this upload.'],
 unreadable_page:['AI 引用的 PDF 物理页未被成功读取。','An AI citation points to a physical PDF page that was not successfully read.'],
 quote_mismatch:['AI 引文无法在它标注的 PDF 物理页找到一致原文。','An AI quote could not be matched to the original text on its stated physical PDF page.'],
 date_mismatch:['AI 提取的日期与所引原文不一致。','An extracted date does not match its quoted original text.'],
 missing_date:['AI 标记了日期类型，却未提供原文日期。','The AI marked a date type without supplying the original date.'],
 duplicate_item:['AI 返回了重复的提取项，无法可靠定位冲突。','The AI returned duplicate items whose conflict references cannot be resolved.'],
 invalid_conflict:['AI 标记的冲突未正确关联到两条不同的提取项。','An AI conflict was not linked to two distinct extraction items.'],
};

export function materialValidationError(reason:MaterialValidationReason,locale:Locale,position:Position={}):AnalysisError{
  const en=locale==='en';
  const where=position.item!==undefined?(en?`Item ${position.item+1}: `:`第 ${position.item+1} 项：`):'';
  const page=position.pdfPage!==undefined?(en?` (PDF page ${position.pdfPage})`:`（PDF 物理页 ${position.pdfPage}）`):'';
  // Allowlisted reason and numeric positions only. Never log text, names, file IDs or excerpts.
  recordMaterialValidationIssue(reason,position);
  return new AnalysisError('INVALID_MODEL_OUTPUT',where+descriptions[reason][en?1:0]+page+(en?' Source validation failed; no case facts were applied. Read text already extracted below, or continue manually.':'未通过来源校验，未填入案情。可在下方查看已读取文字，或继续手动填写。'),502);
}

export function recordMaterialValidationIssue(reason:MaterialValidationReason,position:Position={},disposition?:'needs_review'):void{
  const execution=currentExecution();
  if(execution){try{console.info(JSON.stringify({event:'caselink_material_validation',requestId:execution.requestId,reason,...position,...(disposition?{disposition}:{})}));}catch{/* Diagnostics must not change request handling. */}}
}
