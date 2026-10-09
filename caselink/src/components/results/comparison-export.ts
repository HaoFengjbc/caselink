import type {ComparisonBrief} from '@/lib/contracts';
/** Shared signature: C supplies the brief; A owns snapshot-safe export rendering. */
export function comparisonMarkdown(brief:ComparisonBrief,locale:'zh'|'en'=brief.locale):string {
 const lines=[`# CaseLink — ${brief.title}`,`Generated: ${brief.createdAt}`,`Snapshot: ${brief.snapshot.corpusVersion}`];
 for(const item of brief.snapshot.cases)lines.push('',`## ${item.title}`,item.country,item.summary,item.statusSummary);
 for(const issue of brief.commonIssues)lines.push('',`## ${issue.label}`,`Cases: ${issue.supportingCaseIds.join(', ')}`,`Evidence: ${issue.evidenceIds.join(', ')}`,...issue.differences,...issue.unknowns);
 lines.push('',locale==='en'?'## Limitations':'## 限制',...brief.limitations);
 return lines.join('\n');
}
