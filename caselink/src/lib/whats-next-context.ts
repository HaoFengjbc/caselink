import type {NewCaseInput} from './contracts';

/** Reported representation only; it never confirms a mandate, access, or appointment. */
export function reportedRepresentation(input:NewCaseInput):'reported'|'none'|'unknown'{
 if(input.resources.includes('none'))return 'none';
 const text=[input.intake?.narrative||input.background.description,...(input.intake?.answers.filter(a=>a.questionId==='representation').map(a=>a.answer)??[])].join('\n');
 const negative=/(?:尚无|暂无|没有|未有|尚未聘请|未聘请|还没有|沒有).{0,4}(?:当地)?律师|\b(?:no|without) (?:local )?(?:lawyer|counsel)\b|\bnot (?:yet )?represented\b/i.test(text);
 const positive=/(?:已有|已找到|已经找到|已聘请|已经聘请|已委托|现有|已有当地).{0,4}律师|\b(?:has|have|retained|instructed) (?:a |an |local |existing )*(?:lawyer|counsel)\b/i.test(text);
 if(negative)return input.resources.includes('lawyer')||positive?'unknown':'none';
 if(input.resources.includes('lawyer'))return 'reported';
 return positive&&!/(?:是否|不知道|不清楚|尚未确认|尚未確認).{0,10}(?:已有|聘请|律师)|\b(?:unclear|unknown)\b/i.test(text)?'reported':'unknown';
}
