import type { ComparisonBrief } from '@/lib/contracts';
import { evidenceSourceLink } from '@/lib/evidence/source-links';
import { zh } from '@/lib/i18n/zh';
import { en } from '@/lib/i18n/en';

/** All content comes from the supplied frozen brief; no current corpus lookup or retranslation. */
export function comparisonMarkdown(brief: ComparisonBrief, _locale: 'zh' | 'en' = brief.locale): string {
  const english = brief.snapshot.locale === 'en'; const L = english ? en : zh;
  const label = (zhText: string, enText: string) => english ? enText : zhText;
  const missing = label('未记载', 'Not recorded');
  const refs = (ids: string[]) => `${label('原文证据', 'Evidence')}: ${ids.join(', ') || missing}`;
  const lines = [`# CaseLink — ${brief.title}`, `Generated: ${brief.createdAt}`, `Snapshot: ${brief.snapshot.corpusVersion} · ${brief.snapshot.capturedAt}`, `${label('输入性质', 'Input')}: ${label('公开案例比较，不包含私密用户案情', 'Public case comparison, no private case narrative')}`, '', label('仅描述选定案例，不推断总体发生率；历史行动与后续结果的先后关系不代表因果。', 'Describes only selected cases, not population rates. A sequence of action and outcome does not establish causation.')];
  for (const item of brief.snapshot.cases) {
    lines.push('', `## ${item.title}`, `${label('国家', 'Country')}: ${item.country}`, `${label('法域', 'Specific jurisdiction')}: ${missing}`, `${label('表达活动', 'Expression activities')}: ${item.backgroundTags.map(tag => L.activities[tag]).join(', ') || missing}`, `${label('标准化程序类型 / 指控或争点', 'Standardized procedure / charge or issue')}: ${missing} (${label('详见下列原文摘要与事件，不据标签推定罪名', 'see sourced summary and events below; do not infer a charge from tags')})`, item.summary, refs(item.evidenceIds), `${label('程序问题', 'Procedural concerns')}: ${item.problems.map(problem => L.problems[problem]).join(', ') || missing}`);
    for (const event of item.events) lines.push(`- ${L.stages[event.stageAtEvent]} · ${event.eventType} · ${event.date.value || event.date.originalText || missing}: ${event.description}`, `  ${refs(event.evidenceIds)}`);
    lines.push('', `### ${label('历史行动与后续状态', 'Historical actions and later status')}`);
    if (!item.interventions.length) lines.push(missing);
    for (const action of item.interventions) lines.push(`- ${action.actor}: ${action.action} (${action.executionStatus}; ${action.date.value || action.date.originalText || missing})`, `  ${refs(action.evidenceIds)}`, `  ${label('与结果的联系', 'Relationship to outcome')}: ${action.relationshipToOutcome}; ${label('不外推因果', 'no wider causal inference')}`);
    lines.push(`${label('状态截至', 'Status as of')}: ${item.lastKnownStatusAsOf}`, item.statusSummary);
    for (const outcome of item.outcomes) lines.push(`- ${outcome.description} (${outcome.statusAsOf || missing})`, `  ${refs(outcome.evidenceIds)}`);
    lines.push(`${label('未知事项', 'Unknowns')}:`, ...(item.unknowns.length ? item.unknowns.map(text => `- ${text}`) : [missing]));
    for (const conflict of item.conflicts) lines.push(`${label('来源冲突', 'Source conflict')}: ${conflict.description}`, refs(conflict.evidenceIds));
  }
  lines.push('', `## ${label('选定案例中的共同问题', 'Common issues in selected cases')}`);
  for (const issue of brief.commonIssues) lines.push('', `### ${issue.label}`, `${label('支持案件', 'Supporting cases')}: ${issue.supportingCaseIds.join(', ')}`, refs(issue.evidenceIds), `${label('差异', 'Differences')}:`, ...(issue.differences.length ? issue.differences.map(text => `- ${text}`) : [missing]), `${label('未知事项', 'Unknowns')}:`, ...(issue.unknowns.length ? issue.unknowns.map(text => `- ${text}`) : [missing]));
  lines.push('', `## ${label('限制', 'Limitations')}`, ...brief.limitations.map(text => `- ${text}`), '', `## ${label('原文摘录与固定来源', 'Original excerpts and frozen sources')}`);
  for (const excerpt of brief.snapshot.evidence) {
    const doc = brief.snapshot.documents.find(d => d.documentId === excerpt.documentId);
    const descriptor = brief.snapshot.sourceDescriptors.find(d => d.sourceId === excerpt.evidenceId);
    lines.push('', `### ${excerpt.evidenceId}`, `> ${excerpt.exactQuote}`, excerpt.explanation, `${doc?.title ?? missing} · ${doc?.author ?? missing} · ${doc?.publishedDate ?? missing}`, `PDF p. ${excerpt.pdfPage}${excerpt.printedPage ? ` · printed p. ${excerpt.printedPage}` : ''}`, `${label('来源类别 / 审核状态', 'Source category / review status')}: curated_case / ${descriptor?.reviewStatus ?? 'legacy_recorded'}`, evidenceSourceLink(excerpt));
  }
  lines.push('', `## ${label('国际标准、机制与资源（附适用条件）', 'International standards, mechanisms and resources (conditional applicability)')}`);
  if (!brief.snapshot.resources.length) lines.push(missing);
  for (const resource of brief.snapshot.resources) lines.push('', `### ${resource.resourceId} · ${resource.name}`, resource.summary ?? '', `${resource.type ?? 'general_resource'} / ${resource.reviewStatus ?? 'legacy_recorded'}`, `${label('定位', 'Locator')}: ${resource.locator ?? missing}`, `${label('来源检查日期', 'Source-check date')}: ${resource.agentCheckedAt ?? resource.checkedAt}`, `${label('团队人工审核日期', 'Team review date')}: ${resource.teamReviewedAt ?? missing}`, resource.applicability, ...(resource.eligibility ?? []).map(text => `- ${text}`), ...(resource.unknowns ?? []).map(text => `- ${label('待确认', 'To verify')}: ${text}`), resource.officialUrl);
  return lines.join('\n');
}
