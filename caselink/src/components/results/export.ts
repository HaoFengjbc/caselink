import {evidenceSourceLink,sourceFormatNote} from '@/lib/evidence/source-links';
import type {AnalysisResult,NewCaseInput} from '@/lib/contracts';
import {snapshotForResult} from '@/lib/reports/snapshot';
import {zh} from '@/lib/i18n/zh';
import {en} from '@/lib/i18n/en';
import {ui} from '@/lib/i18n/ui';
import {webMarkdownText,webMarkdownCitation,webSourcesFor,citationProvenance} from './web-sources';
import type {Locale} from '@/lib/i18n/locale';
import {normalizeConfirmedGoal} from '@/lib/intake/analysis';
import {countryName,localizeCase,localizeDocument,localizeEvidence,localizeResource} from '@/lib/i18n/content';
export function analysisMarkdown(result:AnalysisResult,input:NewCaseInput,locale:Locale='zh'){
 const snapshot = snapshotForResult(result);
 locale = result.snapshot?.locale ?? locale;
 result = { ...result, legalResearch: snapshot.legalResearch, followups: snapshot.followups, nextSteps: snapshot.nextSteps, sources: result.sources.map(source => snapshot.evidence.find(e => e.evidenceId === source.evidenceId) ?? source), webResearch: snapshot.webResearch };
 input=normalizeConfirmedGoal(input);
 let original=locale==='en'?englishMarkdown(result,input):chineseMarkdown(result,input);
 original = original.replace('\n\n##', `\n${locale === 'en' ? 'Snapshot' : '历史快照'}: ${snapshot.completeness === 'complete' ? (locale === 'en' ? 'Generation-time evidence preserved' : '生成时证据已固定') : (locale === 'en' ? 'Legacy partial record; missing cases/documents/resources are not reconstructed from today’s library.' : '旧版不完整记录；缺失的案例、文档和资源未用当前库回填。')}\n\n##`);
 const record=input.intake;
 const marker=locale==='en'?'## Historical comparison':'## 历史比较';
 if(!record)return original.replace(marker,legalResearchMarkdown(result,locale)+'\n'+historicalFollowupMarkdown(result,locale)+'\n'+webResearchMarkdown(result,locale)+'\n'+marker);
 const en=locale==='en';
 const section=['',en?'## Full user-provided case record':'## 完整案情记录（使用者提供，未经独立核实）',
 `${en?'Jurisdiction':'具体辖区'}: ${record.jurisdiction||'—'}`,`${en?'Procedure type':'程序类型'}: ${record.caseKind}`,
 `${en?'Original account':'原始案情'}: ${record.narrative}`,`${en?'Goal in your words':'具体诉求'}: ${record.goalText||'—'}`,
 `${en?'Disclosure boundaries':'具体披露边界'}: ${record.disclosureDetails||'—'}`,
 ...record.answers.flatMap(answer=>[`${en?'Question':'问题'}: ${answer.question}`,`${en?'Answer':'回答'}: ${answer.answer||'—'}`]),
 ...record.facts.flatMap(fact=>[`${en?'Reviewed note (not independent evidence)':'已核对笔记（非独立证据）'}: ${fact.text}`,`${en?'Original words':'对应原话'}: ${fact.quote}`]),''];
 original=original.replace(marker,section.join('\n')+'\n'+marker);
 return original.replace(marker,legalResearchMarkdown(result,locale)+'\n'+historicalFollowupMarkdown(result,locale)+'\n'+webResearchMarkdown(result,locale)+'\n'+marker);
}
/** Adaptive records keep free-form answers below; empty legacy fields must not
 * contradict those answers with misleading summaries such as "Tried: unknown". */
function caseOverviewLines(input:NewCaseInput,locale:Locale):string[]{
 const english=locale==='en';const L=english?en:zh;const lines:string[]=[];
 const join=english?', ':'、';const unknown=english?'Unknown':'未知';const absent=english?'Not provided':'未提供';
 const add=(label:string,value:string,known=true)=>{if(!input.intake||known)lines.push(`${label}${english?': ':'：'}${value}`);};
 add(english?'Country or region':'国家或地区',english?countryName(input.country,'en'):input.country);
 add(english?'Stage':'程序阶段',L.stages[input.stage],input.stage!=='unknown');
 add(english?'Main goal':'主要目标',input.primaryGoal==='other'&&input.intake?.goalText.trim()?input.intake.goalText:L.goals[input.primaryGoal]);
 add(english?'Publicity':'公开限制',L.publicity[input.publicity]);
 add(english?'Current difficulties':'当前困难',input.currentProblems.map(p=>L.problems[p]).join(join),input.currentProblems.some(p=>p!=='unknown'));
 add(english?'Expression':'表达活动',input.background.activities.map(a=>L.activities[a]).join(join)||unknown,input.background.activities.length>0);
 add(english?'Identity':'当事人身份',L.persons[input.background.personType],input.background.personType!=='unknown');
 add(english?'User notes':'用户补充',input.background.description||absent,!!input.background.description.trim());
 add(english?'Support':'支持',input.resources.map(r=>L.resources[r]).join(join)||unknown,input.resources.length>0);
 add(english?'Resource limits':'资源限制',input.resourceConstraints||absent,!!input.resourceConstraints.trim());
 add(english?'Tried so far':'已尝试',input.priorActions.status==='described'?input.priorActions.description:input.priorActions.status==='none'?(english?'No action taken':'未采取行动'):unknown,input.priorActions.status!=='unknown');
 add(english?'Known dates':'已知日期',input.keyDates.map(d=>`${d.date} ${d.event}${d.approximate?(english?' (approx.)':'（大约）'):''}`).join(english?'; ':'；')||unknown,input.keyDates.length>0);
 return lines;
}

function chineseMarkdown(result:AnalysisResult,input:NewCaseInput){
 const {cases, documents, resources} = snapshotForResult(result); const getCase = (id: string) => cases.find(c => c.caseId === id);
 const lines=['# CaseLink · 当前行动参考','',`生成模式：${zh.modes[result.mode]}`,`生成时间：${result.createdAt}`,`历史库版本：${result.corpusVersion}`,`输入校验：${result.inputHash}`,input.isExample?'输入性质：虚构示例案件':'输入性质：使用者提供，未经独立核实','','## 案情与目标',...caseOverviewLines(input,'zh'),'','## 历史比较'];
 for(const m of result.comparableCases){const c=getCase(m.caseId);if(!c)continue;lines.push('',`### ${c.title} · ${c.country}`,`报告日期：${c.reportDate}；事实截至 ${c.lastKnownStatusAsOf}`,c.statusSummary,`身份：${c.personTypes.map(p=>zh.persons[p]).join('、')}`,`参考维度：${m.matchDimensions.join('、')}`,`相似点：${m.similarities.join('；')}`,`关键差异：${m.differences.join('；')}`);for(const h of result.historicalComparisons.filter(h=>h.caseId===c.caseId)){const a=c.interventions.find(a=>a.interventionId===h.interventionId);if(!a)continue;lines.push(`- 历史事实：${a.actor}；${zh.stages[a.stageAtAction]}；${a.date.value||a.date.originalText}；${a.action}`,`  后续结果：${a.observedOutcomeIds.map(id=>c.outcomes.find(o=>o.outcomeId===id)?.description).filter(Boolean).join('；')||'材料未记载对应结果'}`,`  联系：${a.relationshipToOutcome==='explicit'?'报告明确联系所列回应，不外推因果效果':a.relationshipToOutcome==='sequence_only'?'仅先后出现':'联系未知'}；证据：${[...new Set([...a.evidenceIds,...a.observedOutcomeIds.flatMap(id=>c.outcomes.find(o=>o.outcomeId===id)?.evidenceIds||[])])].join(', ')}`)}}
 lines.push('','## 当前行动参考（建议，不是历史事实）');for(const [i,a] of result.actionOptions.entries()){lines.push('',`### ${i+1}. ${a.title} · ${zh.applicability[a.applicability]}`,`目标：${a.goal==='other'&&input.intake?.goalText.trim()?input.intake.goalText:zh.goals[a.goal]}`,`理由：${a.reason}`,`牵头角色：${a.leadRole}`,`时机：${a.timing}`,`依据类型：${zh.basis[a.basisType]}`,`历史依据：${a.supportingEvidenceIds.join(', ')||'无个案证据'}`);lines.push(...actionWebMarkdown(result,a.actionId,'zh'));for(const [title,items] of [['前置条件',a.prerequisites],['执行步骤',a.steps],['准备材料',a.materials],['协作对象',a.collaborators],['跟进观察',a.followUp],['关键差异',a.differences],['待核实',a.uncertainties]] as const){lines.push('',`**${title}**`,...items.map((s,j)=>`${j+1}. ${s}`))}for(const rid of a.resourceIds){const r=resources.find(r=>r.resourceId===rid);if(r)lines.push(`官方资源：${r.name} — ${r.officialUrl}；核查 ${r.checkedAt}；适用：${r.applicability}`)}}
 lines.push('','## 缺失信息',...result.missingInformation.map(s=>`- ${s}`),'','## 使用限制',...result.limitations.map(s=>`- ${s}`),'','## 原文证据与来源');
 if(!input.intake||input.priorActions.date)lines.push(`用户已尝试行动的日期：${input.priorActions.date||'未提供'}`);for(const m of result.comparableCases){const c=getCase(m.caseId);c?.conflicts.forEach(f=>lines.push(`来源冲突（${c.title}）：${f.description}`));c?.unknowns.forEach(u=>lines.push(`历史资料未记载（${c.title}）：${u}`));}
 for(const e of result.sources.filter((e,i,a)=>a.findIndex(x=>x.evidenceId===e.evidenceId)===i)){const d=documents.find(d=>d.documentId===e.documentId);lines.push('',`### ${e.evidenceId} · ${getCase(e.caseId)?.title ?? '未记载'}`,`> ${e.exactQuote}`,e.explanation,`报告：${d?.title ?? '—'}；作者：${d?.author ?? '—'}`,`发布日期：${d?.publishedDate ?? '—'}；事实截至：${d?.factsAsOf ?? '—'}；核查：${d?.checkedAt ?? '—'}`,`PDF 第 ${e.pdfPage} 页${e.printedPage?`；印刷页 ${e.printedPage}`:''}；${zh.origins[e.origin]}`,sourceFormatNote(e,'zh'),`原报告：${evidenceSourceLink(e)}`)}
 lines.push('','独立黑客松原型。历史先后关系不等于因果，行动参考由使用者结合当前情境判断。');return lines.join('\n');
}

function englishMarkdown(result:AnalysisResult,input:NewCaseInput){
 const L=en;const {cases, documents, resources} = snapshotForResult(result); const caseOf=(id:string)=>cases.find(c=>c.caseId===id);
 const lines=['# CaseLink · Current action plan','',`Mode: ${L.modes[result.mode]}`,`Generated: ${result.createdAt}`,`Library version: ${result.corpusVersion}`,`Input check: ${result.inputHash}`,input.isExample?'Input: fictional demo case':'Input: provided by the user, not independently verified','','## Case and goal',...caseOverviewLines(input,'en'),'','## Historical comparison'];
 for(const m of result.comparableCases){const c=caseOf(m.caseId);if(!c)continue;lines.push('',`### ${c.title} · ${countryName(c.country,'en')}`,`Report date: ${c.reportDate}; facts as of ${c.lastKnownStatusAsOf}`,c.statusSummary,`Identity: ${c.personTypes.map(p=>L.persons[p]).join(', ')}`,`Matched on: ${m.matchDimensions.join(', ')}`,`Similarities: ${m.similarities.join('; ')}`,`Key differences: ${m.differences.join('; ')}`);for(const h of result.historicalComparisons.filter(h=>h.caseId===c.caseId)){const a=c.interventions.find(a=>a.interventionId===h.interventionId);if(!a)continue;lines.push(`- Historical fact: ${a.actor}; ${L.stages[a.stageAtAction]}; ${a.date.value||'date not recorded'}; ${a.action}`,`  Later outcome: ${a.observedOutcomeIds.map(id=>c.outcomes.find(o=>o.outcomeId===id)?.description).filter(Boolean).join('; ')||'No matching outcome recorded'}`,`  Link: ${a.relationshipToOutcome==='explicit'?'The report links it to the listed response; no wider causal effect is inferred':a.relationshipToOutcome==='sequence_only'?'Only a sequence in time':'Link unknown'}; evidence: ${[...new Set([...a.evidenceIds,...a.observedOutcomeIds.flatMap(id=>c.outcomes.find(o=>o.outcomeId===id)?.evidenceIds||[])])].join(', ')}`)}}
 lines.push('','## Current actions (suggestions, not historical facts)');for(const [i,a] of result.actionOptions.entries()){lines.push('',`### ${i+1}. ${a.title} · ${L.applicability[a.applicability]}`,`Goal: ${a.goal==='other'&&input.intake?.goalText.trim()?input.intake.goalText:L.goals[a.goal]}`,`Why: ${a.reason}`,`Lead: ${a.leadRole}`,`Timing: ${a.timing}`,`Basis: ${L.basis[a.basisType]}`,`Historical evidence: ${a.supportingEvidenceIds.join(', ')||'No case-specific evidence'}`);lines.push(...actionWebMarkdown(result,a.actionId,'en'));for(const [title,items] of [['Before you start',a.prerequisites],['Steps',a.steps],['Materials',a.materials],['Collaborators',a.collaborators],['Follow-up',a.followUp],['Key differences',a.differences],['To verify',a.uncertainties]] as const){lines.push('',`**${title}**`,...items.map((s,j)=>`${j+1}. ${s}`))}for(const rid of a.resourceIds){const raw=resources.find(r=>r.resourceId===rid);if(raw){const r=raw;lines.push(`Official resource: ${r.name} — ${r.officialUrl}; checked ${r.checkedAt}; scope: ${r.applicability}`)}}}
 lines.push('','## Missing information',...result.missingInformation.map(s=>`- ${s}`),'','## Limits of use',...result.limitations.map(s=>`- ${s}`),'','## Sources and original evidence');
 if(!input.intake||input.priorActions.date)lines.push(`Date of the user’s earlier action: ${input.priorActions.date||'Not provided'}`);for(const m of result.comparableCases){const c=caseOf(m.caseId);c?.conflicts.forEach(f=>lines.push(`Source conflict (${c.title}): ${f.description}`));c?.unknowns.forEach(u=>lines.push(`Not recorded in the historical material (${c.title}): ${u}`));}
 for(const raw of result.sources.filter((e,i,a)=>a.findIndex(x=>x.evidenceId===e.evidenceId)===i)){const e=raw;const doc=documents.find(d=>d.documentId===e.documentId);const d=doc;lines.push('',`### ${e.evidenceId} · ${caseOf(e.caseId)?.title ?? 'Not recorded'}`,`> ${e.exactQuote}`,e.explanation,`Report: ${d?.title ?? '—'}; author: ${d?.author ?? '—'}`,`Published: ${d?.publishedDate ?? '—'}; facts as of: ${d?.factsAsOf ?? '—'}; checked: ${d?.checkedAt ?? '—'}`,`PDF page ${e.pdfPage}${e.printedPage?`; printed page ${e.printedPage}`:''}; ${L.origins[e.origin]}`,sourceFormatNote(e,'en'),`Original report: ${evidenceSourceLink(e)}`)}
 lines.push('','Independent hackathon prototype. A sequence in time is not causation; the user judges the action plan against the current situation.');return lines.join('\n');
}

function webReferenceLines(result:AnalysisResult,ids:string[]):string[]{
 const sources=result.webResearch?.sources??[];
 const found=webSourcesFor(ids,sources);
 return [...found.map(source=>`- ${webMarkdownCitation(source)}`),...[...new Set(ids)].filter(id=>!found.some(source=>source.sourceId===id)).map(id=>`- ${webMarkdownText(id)}`)];
}
function actionWebMarkdown(result:AnalysisResult,actionId:string,locale:Locale):string[]{
 const ids=(result.actionWebSources??[]).filter(ref=>ref.actionId===actionId).flatMap(ref=>ref.sourceIds);
 const origin=result.actionOrigins?.find(item=>item.actionId===actionId);
 const text=origin?.origin==='ai'?(locale==='en'?'AI-generated for this case':'AI 根据本案生成'):origin?.origin==='preset'?(locale==='en'?'Preset example':'预置示例'):(locale==='en'?'Fixed-rule preparation':'规则生成的一般准备');
 return [...actionLegalMarkdown(result,actionId,locale),...actionNextStepMarkdown(result,actionId,locale),...(origin?[`${locale==='en'?'Content origin':'内容来源'}: ${text}`,...(origin.reason?[origin.reason]:[])]:[]),...(ids.length?['',`**${ui[locale].web.citations}**`,...webReferenceLines(result,ids)]:[])];
}
/** Export the entire research payload; only catalogued web sources become links. */
export function webResearchMarkdown(result:AnalysisResult,locale:Locale='zh'):string{
 const w=ui[locale].web;const research=snapshotForResult(result).webResearch;
 const lines=['',`## ${w.tab}`];
 if(result.researchAssessment)lines.push(result.researchAssessment.note,`${locale==='en'?'Research passes':'研究轮次'}: ${result.researchAssessment.attempts}`);
 if(!research)return [...lines,'',w.none,''].join('\n');
 const en=locale==='en';
 const calls=research.attempts?.reduce((total,attempt)=>total+attempt.searchCallCount,0)??research.searchCallCount;
 lines.push('',w.status[research.status],w.intro,`${w.searchedAt}: ${webMarkdownText(research.searchedAt)}`,`${w.searchCalls}: ${calls}`);
 if(research.plan){
  const plan=research.plan;
  lines.push('',`### ${en?'Research direction':'本次研究方向'}`,en?'AI-organized research context; these are not independently verified facts.':'AI 整理的研究方向，不代表事实已经确认。',`${en?'Relationship':'双方关系'}: ${webMarkdownText(plan.relationship)}`);
  for(const [label,items] of [[en?'Disputed conduct':'争议行为',plan.disputedConduct],[en?'Reported harm':'所述损失',plan.harms],[en?'Requested remedy':'期望解决',plan.remedies],[en?'Evidence questions':'证据问题',plan.evidenceIssues],[en?'Uncertainties':'待确认事项',plan.uncertainties]] as const){
   if(items.length)lines.push('',`**${label}**`,...items.map(item=>`- ${webMarkdownText(item)}`));
  }
 }
 if(research.failureReason)lines.push(`${w.reason}: ${w.reasons[research.failureReason]} (${research.failureReason})`);
 if(research.status!=='completed')lines.push(research.status==='no_results'?w.noResults:w.unavailable);
 for(const c of result.webComparisons??[]){lines.push('',`### ${webMarkdownText(c.title)}`,w.pending,webMarkdownText(c.jurisdiction||w.jurisdictionUnknown),c.statusAsOf?`${w.asOf}: ${webMarkdownText(c.statusAsOf)}`:w.dateUnknown,'',webMarkdownText(c.summary),'',`**${w.similar}**`,...(c.similarities.length?c.similarities.map(text=>`- ${webMarkdownText(text)}`):[w.noSimilar]),'',`**${w.different}**`,...c.differences.map(text=>`- ${webMarkdownText(text)}`),'',`**${w.citations}**`,...webReferenceLines(result,c.sourceIds));}
 if(!result.webComparisons?.length)lines.push('',`### ${w.noComparisons}`,w.noComparisonsText);
 lines.push('',`### ${w.report}`,'',`**${w.searchTerms}**`,...(research.searchTerms.length?research.searchTerms.map(term=>`- ${webMarkdownText(term)}`):[w.noTerms]));
 if(research.actualQueries?.length)lines.push('',`**${en?'Queries returned by the search tool':'搜索工具返回的实际查询'}**`,en?'The tool may not return every query.':'工具可能未返回全部查询。',...research.actualQueries.map(term=>`- ${webMarkdownText(term)}`));
 if(research.attempts&&research.attempts.length>1){
  lines.push('',`**${en?'Research passes':'各轮检索记录'}**`);
  for(const attempt of research.attempts)lines.push(`- ${en?'Pass':'第'} ${attempt.attempt}${en?'':' 轮'}: ${w.status[attempt.status]} · ${attempt.searchCallCount} ${w.searchCalls}${attempt.failureReason?` · ${w.reasons[attempt.failureReason]}`:''}`,...attempt.actualQueries.map(term=>`  - ${webMarkdownText(term)}`));
 }
 for(const passage of research.passages)lines.push('',webMarkdownText(passage.text),'',...webReferenceLines(result,passage.sourceIds));
 if(!research.passages.length)lines.push('',w.noPassages);
 lines.push('',`### ${w.sources}`,w.sourceNote);
 for(const source of research.sources)lines.push('',`- ${webMarkdownCitation(source)}`,`  ${webMarkdownText(source.hostname)}`,...(source.citationKind?[`  ${citationProvenance(source,locale)}`]:[]));
 return [...lines,''].join('\n');
}

function actionLegalMarkdown(result:AnalysisResult,actionId:string,locale:Locale):string[]{
 const english=locale==='en';const snapshot=snapshotForResult(result);const action=result.actionOptions.find(item=>item.actionId===actionId);
 return (action?.legalCitations??[]).flatMap(citation=>{
  const binding=snapshot.legalResearch?.bindings.find(item=>item.bindingId===citation.bindingId&&item.claimKey===citation.claimKey&&item.resourceId===citation.resourceId&&item.provisionId===citation.provisionId);
  return binding?[`${english?'Supported legal proposition (conditions remain to be checked)':'附带法律判断（仍须核对适用条件）'}: ${binding.claim}`,`${english?'Exact citation; supports this sentence only':'准确引用，仅支持此句'}: ${binding.bindingId} / ${binding.resourceId} / ${binding.provisionId} / ${binding.claimKey}`]:[`${english?'Citation absent from historical snapshot; no current-catalog backfill':'历史快照缺少该引用，不从当前目录回填'}: ${citation.bindingId}`];
 });
}
/** Same generation-time object and resource copies as the result page, never today's catalog. */
export function legalResearchMarkdown(result:AnalysisResult,locale:Locale='zh'):string{
 const english=locale==='en';const snapshot=snapshotForResult(result);const research=snapshot.legalResearch;
 const lines=['',english?'## Matter-specific legal research':'## 本案法律研究链','',english?'Facts → question → provision → conditions → preparation. Research references are not a lawyer’s case assessment.':'事实 → 问题 → 条文 → 条件 → 准备。研究依据不等于律师已审核本案。'];
 if(!research)return [...lines,english?'This historical report did not preserve provision-level research; no current-catalog backfill.':'本报告未保存逐条法律研究记录，未从当前资源库回填。',''].join('\n');
 if(english)lines.push('Source quotations and curated legal explanations retain their reviewed language; translation review pending.');
 lines.push('',research.coreQuestion,`${english?'Source coverage':'来源覆盖'}: ${research.coverage}`,research.coverageNote);
 for(const binding of research.bindings){
  const resource=snapshot.resources.find(item=>item.resourceId===binding.resourceId);const audit=resource?.sourceAudit;const provision=audit?.provisions.find(item=>item.provisionId===binding.provisionId&&item.supports.includes(binding.claimKey)&&item.explanation===binding.claim);
  lines.push('',`### ${binding.bindingId}`,`${english?'Question':'研究问题'}: ${binding.issue}`,`${english?'Proposition supported by the source':'来源支持的判断'}: ${binding.claim}`,`${english?'Applicability status':'适用状态'}: ${binding.applicability}`,`${english?'Source category (separate from review)':'来源类别（独立于审核状态）'}: ${resource?.type??'not_recorded'}`);
  for(const fact of binding.factBasis)lines.push(`${english?'Related fact':'相关事实'}: ${fact.text}`,`${english?'Provenance':'归属'}: ${fact.origin}${fact.origin==='document'&&fact.fileName&&fact.page?` · ${fact.fileName} · ${english?'page':'真实页码'} ${fact.page}`:english?' · no document or court finding is implied':' · 不声称来自文件或法院认定'}`);
  if(provision)lines.push(`${english?'Exact locator':'原文定位'}: ${provision.locator}`,`> ${provision.quote.replace(/\n/g,'\n> ')}`,provision.explanation);
  else lines.push(english?'Supporting source text is missing from this snapshot; verification is not established.':'本快照缺少支持此判断的原文记录，不能视为已核实法律依据。');
  if(resource)lines.push(`${english?'Official source':'官方来源'}: ${audit?.readUrl??resource.officialUrl}`,`${english?'Issuer / version / publication or effective information':'发布机关 / 版本 / 发布或生效信息'}: ${audit?`${audit.issuer} / ${audit.version} / ${audit.publishedOrEffective}`:'—'}`,`${english?'Source check':'来源检查'}: ${resource.reviewStatus??'unreviewed'} · ${audit?.readStatus??'not_checked'} · ${audit?.checkedAt??resource.checkedAt}`,`${english?'Human team review':'团队人工审核'}: ${resource.reviewStatus==='team_verified'&&resource.teamReviewer&&resource.teamReviewedAt?`${resource.teamReviewer} / ${resource.teamReviewedAt}`:english?'Not performed or not recorded; agent check is not team review':'尚未进行或未记录；Agent 检查不等于团队人工复核'}`);
  lines.push(`${english?'Why relevant':'为什么相关'}: ${binding.relevance}`,`${english?'Relationship origin':'关联分析来源'}: ${binding.relationOrigin}`,`${english?'Facts as of':'事实截至'}: ${binding.factsAsOf}`,`${english?'Law checked as of':'法律核查截至'}: ${binding.lawAsOf}`,'',`**${english?'Conditions and unknowns':'适用条件与未知项'}**`,...binding.conditions.map(condition=>`- [${condition.status}] ${condition.label}: ${condition.detail}`),'',`**${english?'Next checks and preparation':'下一步需核实或准备'}**`,...binding.nextChecks.map(item=>`- ${item}`));
  for(const related of audit?.relatedSources??[])lines.push(`${english?'Related official source':'配套官方来源'}: ${related.title} · ${related.locator} · ${related.url}`);
  if(audit?.gaps.length)lines.push(`${english?'Source-audit gaps':'来源核查缺口'}: ${audit.gaps.join('; ')}`);
 }
 if(research.gaps.length)lines.push('',`### ${english?'Coverage gaps':'覆盖缺口'}`,...research.gaps.map(gap=>`- ${gap}`));
 return [...lines,''].join('\n');
}

function actionNextStepMarkdown(result:AnalysisResult,actionId:string,locale:Locale):string[]{
 const english=locale==='en';const snapshot=snapshotForResult(result);const step=snapshot.nextSteps?.find(item=>item.actionId===actionId);if(!step)return [];
 const lines=['',...(english?['Historical source descriptions retain their reviewed language; translation review pending.']:[]),`**What’s Next · ${english?'Concrete working products':'具体工作成果'}**`,step.purpose,`${english?'Who prepares / decides':'谁准备／谁判断'}: ${step.owner}`,`**${english?'Materials for this round':'本轮材料'}**`,...step.materials.map(item=>`- ${item}`),`**${english?'Deliverables':'具体交付物'}**`,...step.deliverables.map(item=>`- ${item}`),`**${english?'Stop conditions':'暂停条件'}**`,...step.stopConditions.map(item=>`- ${item}`),`${english?'Legal binding IDs':'逐条法律引用'}: ${step.legalBindingIds.join(', ')|| (english?'None; general preparation':'无；一般工作准备')}`];
 for(const history of step.history){
  const record=snapshot.cases.find(item=>item.caseId===history.caseId);const followup=snapshot.followups?.find(item=>item.caseId===history.caseId);
  lines.push('',`**${english?'Historical action':'历史行动'} · ${record?.title??history.caseId}**`,`${history.date} · ${history.actor} · ${history.action}`,`${english?'Execution (not a success label)':'执行状态（不是成功标签）'}: ${history.executionStatus}`,`${english?'Recorded outcome':'记录的后续结果'}: ${history.outcome}`,english?'A sequence is not causation. Prior involvement is not proof of current availability or partnership.':'时间先后不等于因果。曾参与该案不表示现在接案或与我们合作。',...history.differences.map(item=>`- ${item}`));
  for(const id of history.evidenceIds){const excerpt=snapshot.evidence.find(item=>item.evidenceId===id);if(excerpt)lines.push(`- ${id} · PDF ${excerpt.pdfPage} · ${evidenceSourceLink(excerpt)}`,`  > ${excerpt.exactQuote.replace(/\n/g,'\n  > ')}`);else lines.push(`${english?'Evidence missing from snapshot':'快照缺少历史引文'}: ${id}`);}
  for(const id of history.sourceIds){const source=followup?.sources.find(item=>item.sourceId===id);if(source)lines.push(`- ${id} · ${source.title} · ${source.locator} · ${source.url}`,`  > ${source.quote.replace(/\n/g,'\n  > ')}`,`  ${source.readStatus} · ${source.reviewStatus} · ${source.checkedAt} · ${english?'Team review pending':'团队人工复核未完成'}`);else lines.push(`${english?'Follow-up source missing from snapshot':'快照缺少后续来源'}: ${id}`);}
 }
 if(step.basisGaps.length)lines.push('',`**${english?'Support gaps':'依据缺口'}**`,...step.basisGaps.map(item=>`- ${item}`));
 return lines;
}
export function historicalFollowupMarkdown(result:AnalysisResult,locale:Locale='zh'):string{
 const english=locale==='en';const followups=snapshotForResult(result).followups;
 const lines=['',english?'## Appended public follow-up records':'## 追加的公开追踪记录',''];
 if(!followups)return [...lines,english?'No follow-up snapshot was saved in this historical report; no current-catalog backfill.':'本历史报告没有保存后续追踪快照，不从当前库回填。',''].join('\n');
 if(!followups.length)return [...lines,english?'No procedurally relevant followed case was linked. This is a coverage limit, not a finding that no comparable history exists.':'本报告没有关联程序可比较的后续追踪案。这是覆盖限制，不代表不存在可比历史。',''].join('\n');
 if(english)lines.push('Source quotations and curated historical descriptions retain their reviewed language; translation review pending.');
 for(const followup of followups){
  lines.push(`### ${followup.caseId}`,`${english?'Original facts as of':'原报告事实截至'}: ${followup.originalFactsAsOf}`,`${english?'Follow-up checked':'本轮追踪核查'}: ${followup.checkedAt}`,`${english?'Coverage status':'追踪状态'}: ${followup.searchStatus}`,followup.summary,english?'Not finding an update does not establish that nothing changed. Publication, submission and institutional acceptance are separate.':'未找到更新不等于没有变化；公开发表、递交材料与机构受理分别判断。');
  for(const event of [...followup.events].sort((a,b)=>(a.eventDate??'9999').localeCompare(b.eventDate??'9999'))){
   lines.push('',`#### ${event.eventId}`,`${english?'Proceeding and subjects':'具体程序与当事人'}: ${event.proceeding} · ${event.subjects.join(' / ')}`,`${english?'Event date / precision':'事件日期／精度'}: ${event.eventDate??(english?'Unspecified':'未明确')} / ${event.datePrecision}`,`${english?'Actors and action':'参与者与行动'}: ${event.actors.join(' / ')} · ${event.action}`,`${english?'Execution (not success)':'执行状态（非成功标签）'}: ${event.executionStatus}`,`${english?'Subsequent outcome':'后续结果'}: ${event.outcome}`,`${english?'Relationship to outcome':'与结果关系'}: ${event.relationshipToOutcome} · ${english?'No independent causal inference':'不独立推断因果'}`,`${english?'Attributed source claim':'来源归属说法'}: ${event.causalAttribution??'—'}`,...event.unknowns.map(item=>`- ${item}`));
   for(const id of event.sourceIds){const source=followup.sources.find(item=>item.sourceId===id);if(source)lines.push(`- ${id} · ${source.title} · ${source.publisher} · ${source.locator}`,`  ${english?'Publication date (not automatically the event date)':'发布日期（不自动等于事件日期）'}: ${source.publishedAt??'—'}`,`  > ${source.quote.replace(/\n/g,'\n  > ')}`,`  ${source.url}`,`  ${source.readStatus} · ${source.reviewStatus} · ${source.checkedAt} · ${english?'Team review pending':'团队人工审核未完成'}`);}
  }
  lines.push('',`**${english?'Gaps and search scope':'缺口与检索范围'}**`,...followup.unknowns.map(item=>`- ${item}`),followup.searchedSources.join(' / '));
 }
 return [...lines,''].join('\n');
}
