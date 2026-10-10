import type {AnalysisResult,NewCaseInput} from '@/lib/contracts';
import {snapshotForResult} from '@/lib/reports/snapshot';
import {labels} from '@/lib/i18n/en';

/** A working document from the frozen report, never a filing or inferred user consent. */
export function workPackMarkdown(result:AnalysisResult,input:NewCaseInput,locale:'zh'|'en'='zh'):string{
 const en=locale==='en',snapshot=snapshotForResult(result),L=labels[locale];
 const tr=(zh:string,english:string)=>en?english:zh;
 const cell=(value:string)=>value.replace(/\|/g,'\\|').replace(/\n/g,' ');
 const unknown=tr('待确认','To confirm');
 const lines=[`# CaseLink · ${tr('内部讨论材料包','Internal working pack')}`,'',
  `${tr('报告','Report')}: ${result.analysisId} · ${result.createdAt}`,
  `${tr('示例属性','Example status')}: ${input.isExample?tr('虚构演示','Fictional demo'):tr('用户提供案情，未独立核实','User account, not independently verified')}`,
  tr('此文件供内部讨论和当地律师核对；不是法律材料的提交稿。没有自动发送、联系或公开任何内容。','For internal discussion and local-counsel review; not a filing. Nothing was automatically sent, disclosed or submitted.'),
  '',`## 1. ${tr('内部案件简报','Internal case brief')}`,
  `${tr('国家/具体法域','Country / jurisdiction')}: ${input.country} / ${input.intake?.jurisdiction||unknown}`,
  `${tr('用户陈述','User account')}: ${input.intake?.narrative||input.background.description||unknown}`,
  `${tr('用户确认目标','User-selected goal')}: ${input.intake?.goalText||L.goals[input.primaryGoal]}`,
  `${tr('披露选择','Disclosure preference')}: ${L.publicity[input.publicity]}`,
  `${tr('具体披露限制','Specific disclosure limits')}: ${input.intake?.disclosureDetails||tr('未提供更细说明；不能据此推定允许披露','No additional detail recorded; this is not permission to disclose')}`,
  ...((input.intake?.answers??[]).filter(a=>a.questionId==='disclosure-details').map(a=>`${a.question}: ${a.answer}`)),
  `${tr('已知支持','Recorded support')}: ${input.resources.map(r=>L.resources[r]).join(' / ')||unknown}`,
  `${tr('核心研究问题','Core research question')}: ${snapshot.legalResearch?.coreQuestion||unknown}`,
  '',`## 2. ${tr('案件时间线（用户陈述，不推算期限）','Case timeline (user account; no calculated deadlines)')}`,
  `| ${tr('日期原话','Date as given')} | ${tr('事件','Event')} | ${tr('归属/待核','Provenance / check')} |`,'| --- | --- | --- |',
  ...input.keyDates.map(d=>`| ${cell(d.date)||unknown} | ${cell(d.event)} | ${d.approximate?tr('大概时间；不是法定期限','Approximate; not a legal deadline'):tr('用户给定日期，待文书核对','User-given date; check document')} |`),
  ...(input.priorActions.status==='described'?[`| ${cell(input.priorActions.date)||unknown} | ${cell(input.priorActions.description)} | ${tr('用户陈述的既有行动；索取对应文书/回执','Prior action reported by user; locate its document/receipt')} |`]:[]),
  ...(!input.keyDates.length&&input.priorActions.status!=='described'?[`| ${unknown} | ${tr('从现有叙述核对最早表达、法律通知和最近程序','Check expression, legal notice and latest procedural dates against the account')} | ${tr('未将资料缺失解释为事件未发生','Missing dates do not mean no event occurred')} |`]:[]),
  '',`## 3. ${tr('材料与来源索引','Materials and source index')}`,
  tr('新案材料状态：现有输入未提供可核实的文件名/页码元数据；请当地团队在持有文件时补齐，不伪造页码。对方指控、用户陈述、法院认定须单列。','New-case source status: the current input has no verified filename/page metadata. The local team should index documents actually held and distinguish opposing allegations, user accounts and court findings.'),
  ...[...new Set((snapshot.nextSteps??[]).flatMap(s=>s.materials))].map(s=>`- [ ] ${s}`),
  '',`### ${tr('法律与机制原文','Legal and mechanism sources')}`,
  ...snapshot.resources.flatMap(r=>[ `- **${r.resourceId}** · ${r.name} · ${r.type} · ${r.reviewStatus}`,`  ${r.sourceAudit?.readUrl||r.officialUrl} · ${r.locator||unknown}`,`  ${tr('核查','Checked')}: ${r.sourceAudit?.checkedAt||r.checkedAt} · ${tr('团队人工复核','Team review')}: ${r.teamReviewedAt||tr('未完成','Not performed')}`]),
  '',`### ${tr('历史原报告与后续公开材料','Original historical reports and public follow-ups')}`,
  ...snapshot.documents.map(d=>`- ${d.documentId} · ${d.title} · ${tr('原事实截至','Original facts as of')} ${d.factsAsOf} · ${d.sourceUrl}`),
  ...(snapshot.followups??[]).flatMap(f=>f.sources.map(s=>`- ${f.caseId} / ${s.sourceId} · ${s.title} · ${s.locator} · ${s.readStatus} · ${tr('核查','Checked')} ${s.checkedAt} · ${s.url}`)),
  '',`## 4. ${tr('给当地律师的核对问题','Questions for local counsel')}`,
  ...[...new Set([...(snapshot.legalResearch?.gaps??[]),...(snapshot.nextSteps??[]).flatMap(s=>s.basisGaps)])].map(q=>`- [ ] ${q}`),
  ...[...new Set((snapshot.legalResearch?.bindings??[]).flatMap(b=>b.conditions.filter(c=>c.status==='unknown').map(c=>`${c.label}：${c.detail}`)))].map(q=>`- [ ] ${q}`),
  '',`## 5. ${tr('候选行动路径及条件对照','Candidate paths and conditions')}`];
 for(const step of snapshot.nextSteps??[]){const action=result.actionOptions.find(a=>a.actionId===step.actionId);lines.push('',`### ${action?.title||step.actionId}`,step.purpose,`${tr('负责判断/准备','Responsible for assessment / preparation')}: ${step.owner}`,`${tr('具体交付物','Deliverables')}: ${step.deliverables.join(' / ')}`,`${tr('暂停条件','Do not advance when')}: ${step.stopConditions.join(' / ')}`,`${tr('法律研究定位','Legal research bindings')}: ${step.legalBindingIds.join(', ')||tr('没有直接法律依据；属于工作准备建议','No direct legal authority; preparation advice')}`);
  for(const h of step.history)lines.push(`- ${tr('历史比较','Historical comparison')}: ${h.caseId} · ${h.date} · ${h.actor} · ${h.action} · ${h.executionStatus}`,`  ${tr('记录的结果（不认定因果）','Recorded outcome (no causal inference)')}: ${h.outcome}`,`  ${tr('关键差异','Differences')}: ${h.differences.join(' / ')}`,`  ${tr('原报告/后续来源','Report / follow-up references')}: ${[...h.evidenceIds,...h.sourceIds].join(', ')}`);
 }
 if(!snapshot.nextSteps)lines.push(tr('本报告没有保存本轮行动材料记录，不从当前资料补写。','This report did not save the working-plan data; it is not reconstructed from current sources.'));
 lines.push('',tr('清单仅存在此下载文件中。后续修改、保存和分享由持有人决定。','Checklist state exists only in this downloaded file. Its holder controls later edits, storage and sharing.'));
 return lines.join('\n');
}
