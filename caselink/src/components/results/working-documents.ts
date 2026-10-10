import type {AnalysisResult,NewCaseInput,ReportSnapshot} from '@/lib/contracts';
import type {WorkFact,WorkingDocument,WorkKind} from '@/lib/whats-next-contracts';
import {labels} from '@/lib/i18n/en';
import {snapshotForResult} from '@/lib/reports/snapshot';
import {workingSourcesValid} from '@/lib/working-source-validation';
import {reportedRepresentation} from '@/lib/whats-next-context';
import {adaptiveCopy} from '@/components/intake/adaptive-copy';

type Locale='zh'|'en';
const cell=(value:string)=>value.replace(/\|/g,'／').replace(/[\r\n]+/g,' ');
const unique=<T,>(items:T[])=>[...new Set(items)];
export const documentTitles={zh:{timeline:'案件时间线与材料索引',issue_matrix:'问题—证据—法律依据表',lawyer_brief:'给当地律师的一页内部简报'},en:{timeline:'Case timeline and materials index',issue_matrix:'Issues, evidence and legal authorities',lawyer_brief:'One-page internal brief for local counsel'}};
/** Words for the stored codes, so no draft or chip shows "generated", "draft" or "unknown". */
export const workingLabels={
 zh:{status:{generated:'系统生成',user_edited:'用户已编辑',needs_merge:'案情已变，待合并'},progress:{draft:'仅草稿',reviewed:'用户记录：已复核',completed:'用户记录：已完成',sent:'用户记录：已发送'},condition:{confirmed:'已确认',unknown:'待确认',not_met:'不满足'},origin:{user_statement:'用户陈述',document_record:'文件记载',court_finding:'法院认定',external_report:'外部报道',model_inference:'模型推断'},read:{full_text:'已读官方全文',partial_text:'已读部分正文',blocked:'正文无法读取',not_checked:'正文未读取'},review:{unreviewed:'待核实',agent_checked:'Agent 已检查来源，团队未人工复核',team_verified:'团队已复核',legacy_recorded:'沿用原入库记录',conflict:'来源有冲突'}},
 en:{status:{generated:'Generated',user_edited:'Edited by user',needs_merge:'Facts changed; merge needed'},progress:{draft:'Draft only',reviewed:'User recorded: reviewed',completed:'User recorded: completed',sent:'User recorded: sent'},condition:{confirmed:'Confirmed',unknown:'To confirm',not_met:'Not met'},origin:{user_statement:'User statement',document_record:'Document record',court_finding:'Court finding',external_report:'External report',model_inference:'Model inference'},read:{full_text:'Official text read',partial_text:'Partly read',blocked:'Text unavailable',not_checked:'Text not read'},review:{unreviewed:'Unreviewed',agent_checked:'Source checked by agent; team review pending',team_verified:'Team reviewed',legacy_recorded:'Original library record',conflict:'Conflicting sources'}},
} as const;

const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
/** Chinese drafts read dates the Chinese way: "10 January 2019" becomes 2019年1月10日; anything unrecognized stays as written. */
function displayDate(date:string,locale:Locale):string{
 if(locale==='en')return date;
 const month=(name:string)=>MONTHS.indexOf(name.toLowerCase().slice(0,3))+1;
 let m=date.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);if(m&&month(m[2]!)>0)return `${m[3]}年${month(m[2]!)}月${Number(m[1])}日`;
 m=date.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);if(m&&month(m[1]!)>0)return `${m[3]}年${month(m[1]!)}月${Number(m[2])}日`;
 m=date.match(/([A-Za-z]{3,9})\.?,?\s+(\d{4})/);if(m&&month(m[1]!)>0)return `${m[2]}年${month(m[1]!)}月`;
 m=date.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m)return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
 return date;
}

/** Frozen records only. A legacy report is never rebuilt from today's catalog. */
export function buildWorkingDocuments(input:NewCaseInput,result:AnalysisResult,locale:Locale='zh'):WorkingDocument[]{
 const snapshot=snapshotForResult(result),plan=snapshot.whatsNext;
 if(!plan)return [];
 const en=locale==='en',tr=(zh:string,english:string)=>en?english:zh,L=labels[locale],W=workingLabels[locale],copy=adaptiveCopy[locale];
 const materials=snapshot.uploadedMaterials;
 const unknownDate=tr('日期未确认','Date unconfirmed');
 const account=input.intake?.narrative||input.background.description||(materials?.items.length?tr('案情来自上传的材料，见「本案材料索引」。','The account comes from the uploaded documents; see the materials index.'):tr('尚未提供具体经过，案件协调人应先核对事件和来源。','No detailed account provided; the case coordinator should establish events and sources.'));
 const goal=input.intake?.goalText||L.goals[input.primaryGoal];
 const lawyerRole=plan.priorities.find(t=>t.kind==='lawyer_brief')?.role??'';
 const representation=reportedRepresentation(input);
 const support=representation==='none'?tr('用户称尚无律师；尚未确认委托','User reports no lawyer; no mandate confirmed'):representation==='reported'||/(?:现有|已有)当地律师|existing local counsel/i.test(lawyerRole)?tr('用户称已有当地律师；委托及接触范围仍需核对','User reports existing local counsel; mandate and access still need confirmation'):input.resources.filter(r=>r!=='unknown').map(r=>L.resources[r]).join(' / ')||tr('未明确提供；按下列核对角色保留未知','Not explicitly recorded; retain uncertainty for the suggested reviewer');
 const disclosure=[L.publicity[input.publicity],input.intake?.disclosureDetails||tr('具体接收者和用途未提供；不推定允许对外传送。','Specific recipients and purposes are not recorded; no external transmission is inferred.')].join(' · ');
 const jurisdiction=input.intake?.jurisdiction;
 const procedure=[input.country.trim()&&input.country!=='unknown'?input.country:tr('国家未确认','Country unconfirmed'),!jurisdiction||jurisdiction==='unknown'?tr('子法域未确认','Sub-jurisdiction unconfirmed'):(copy.jurisdictions as Record<string,string>)[jurisdiction]??jurisdiction,(copy.kinds as Record<string,string>)[input.intake?.caseKind??'unknown'],L.stages[input.stage]].join(' / ');
 const missing=unique(plan.priorities.flatMap(task=>task.missing.map(m=>`${m.item} — ${m.why}`)));
 const bindings=snapshot.legalResearch?.bindings??[];
 const page=(n:number)=>tr(`第 ${n} 页`,`p. ${n}`);
 const factLine=(f:WorkFact)=>en?`- ${f.text} (${W.origin[f.origin]}; ${f.sourceLabel})`:`- ${f.text}（${W.origin[f.origin]}；${f.sourceLabel}）`;
 const caseTitle=(id:string)=>snapshot.cases.find(c=>c.caseId===id)?.title??id;
 const intro=(kind:WorkKind)=>[`# ${documentTitles[locale][kind]}`,'',`${tr('程序位置','Procedural position')}: ${procedure}`,`${tr('目标','Goal')}: ${goal}`,`${tr('披露选择','Disclosure choice')}: ${disclosure}`,tr('内部工作草稿：事实来自使用者和所列材料，未经独立核实；生成或下载不代表已复核、已联系或已提交。','Internal working draft: facts come from the user and the listed materials and are not independently verified; generating or downloading it is not review, contact or filing.'),''];
 const priorActions=input.priorActions.status==='described'?`${input.priorActions.date||unknownDate}: ${input.priorActions.description}`:input.priorActions.status==='none'?tr('用户称尚未采取行动；不能据此推断没有其他人采取行动。','User reports no prior action; this does not establish that no one else acted.'):tr('未确认是否已有行动；请核对有无提交、回执和律师沟通，避免重复或冲突。','Prior action unknown; check submissions, receipts and counsel communications to avoid duplicate or conflicting steps.');
 const sourceLines=sourceAppendix(snapshot,locale);
 const paren=(value:string)=>en?` (${value})`:`（${value}）`;
 const layer=(a:NonNullable<ReportSnapshot['caseIssues']>[number]['authorities'][number])=>a.kind==='case'?tr('已核实案例','reviewed case'):a.kind==='international'?tr('国际标准','international standard'):a.check==='quote_matched'?tr('本地法，原文已核对','local law, wording matched'):tr('本地法，资料库','local law, catalog');
 const issueLines=(snapshot.caseIssues??[]).length?[`## ${tr('关键问题','Key questions')}`,...(snapshot.caseIssues??[]).flatMap((issue,index)=>[`### ${index+1}. ${issue.question}`,
  ...(issue.facts.length?[`${tr('事实','Facts')}: ${issue.facts.map(f=>`${f.text}${paren(f.pageLabel??tr('用户陈述','user account'))}`).join(en?'; ':'；')}`]:[]),
  ...(issue.authorities.length?[`${tr('依据','Basis')}:`,...issue.authorities.flatMap(a=>[`- ${a.title}${a.locator?` · ${a.locator}`:''}${paren(layer(a))}: ${a.point}`,...(a.quote?[`  > ${a.quote.replace(/\s+/g,' ')}`]:[]),...(a.url?[`  ${tr('原文','Source')}: ${a.url}`]:[])])]:[]),
  ...(issue.application?[`${tr('对本案（AI 分析）','For this case (AI analysis)')}: ${issue.application}`]:[]),
  ...(issue.nextStep?[`${tr('下一步','Next step')}: ${issue.nextStep}`]:[]),'']),'']:[];
 const timeline=[...intro('timeline'),`## ${tr('本案叙述','Account')}`,account,'',
  `## ${tr('事件与日期','Events and dates')}`,`| ${tr('日期','Date')} | ${tr('事件','Event')} | ${tr('出处','Source')} |`,'| --- | --- | --- |',
  ...plan.facts.map(f=>`| ${cell(f.date?`${displayDate(f.date,locale)}${f.precision==='approximate'?tr('（大概）',' (approx.)'):''}`:unknownDate)} | ${cell(f.text)} | ${cell(`${W.origin[f.origin]} · ${f.sourceLabel}`)} |`),
  ...input.keyDates.filter(d=>!plan.facts.some(f=>f.date===d.date&&f.text.includes(d.event))).map(d=>`| ${cell(d.date)||unknownDate} | ${cell(d.event)} | ${d.approximate?tr('大概时间；不是法定期限','Approximate; not a legal deadline'):tr('用户提供的日期，待核','User-provided date, to verify')} |`),
  '',tr('没有日期的事件要与文书和送达记录核对；系统不计算任何期限。','Undated events need checking against documents and service records; no deadline is calculated.'),
  '',`## ${tr('已采取的行动','Prior actions')}`,priorActions,
  '',`## ${tr('本案材料索引','Materials index')}`,
  ...(materials?.items.length?materials.items.flatMap(item=>[`- ${item.text}`,...item.sources.map(s=>`  ${s.filename} ${page(s.pdfPage)} · ${tr('原文','Original')}: ${s.quote.replace(/\s+/g,' ').trim()}`),...(item.uncertainty?[`  ${tr('待核','To check')}: ${item.uncertainty}`]:[])]):[tr('本报告未保存新案材料的文件名/页码索引；只能依据上面的用户陈述，不能伪造文书名、案号或页码。取得真实文书后再补充。','This report did not save a filename/page index for new-case materials. Only the user statements above are available; filenames, case numbers and pages are never invented. Add the actual documents when obtained.')]),
  '',`## ${tr('还缺的材料','Missing material')}`,...missing.map(m=>`- [ ] ${m}`),'',`## ${tr('待核问题','Questions to verify')}`,...plan.questions.map(q=>`- ${q.question} — ${q.reason}`),'',...sourceLines];
 const seeFacts=tr('见上方「本案事实」','See case facts above');
 const matrix=[...intro('issue_matrix'),`## ${tr('本案事实','Case facts')}`,...(plan.facts.length?plan.facts.map(factLine):[`- ${account}`]),'',...issueLines,
  tr('下表是待研究的问题和材料任务，不是本案已成立的结论；表中没有反证不等于不存在反证。','These are research issues and material tasks, not established findings; no counter-evidence in the table does not mean there is none.'),'',
  `| ${tr('问题','Issue')} | ${tr('相关事实与证据','Facts and evidence')} | ${tr('条文与命题','Provision and proposition')} | ${tr('适用条件','Conditions')} | ${tr('还要核对','To check')} |`,'| --- | --- | --- | --- | --- |',
  ...bindings.filter(b=>plan.priorities.some(task=>task.legalBindingIds.includes(b.bindingId))).map(b=>{const r=snapshot.resources.find(r=>r.resourceId===b.resourceId),p=r?.sourceAudit?.provisions.find(p=>p.provisionId===b.provisionId);return `| ${cell(b.issue)} | ${cell(b.factBasis.map(f=>`${f.text}${f.fileName?` (${f.fileName}${f.page?` ${page(f.page)}`:''})`:''}`).join(' / ')||seeFacts)} | ${cell(`${r?.name??b.resourceId} · ${p?.locator??b.provisionId}: ${b.claim}`)} | ${cell(b.conditions.map(c=>`${c.label}: ${W.condition[c.status]}`).join(' / '))} | ${cell(b.nextChecks.join(' / ')||tr('请当地律师核对法律根据、现行版本及文书；目前不能确定救济或时限。','Local counsel must confirm legal basis, current version and documents; remedies and deadlines are undetermined.'))} |`;}),
  ...plan.questions.map(q=>`| ${cell(q.question)} | ${seeFacts} | ${tr('一般事实核对，不强配法条','General fact check; no provision forced')} | ${cell(q.reason)} | ${cell(q.role)} |`),
  ...(!bindings.length&&!plan.questions.length?[`| ${tr('确认程序、文书与表达活动的关联','Establish procedure, documents and relation to expression')} | ${seeFacts} | ${tr('当地法律覆盖不足，尚无直接依据','Local-law coverage incomplete; no direct authority linked')} | ${tr('由当地律师核对真实程序与适用法律','Local counsel to confirm actual procedure and governing law')} | ${cell(missing.join(' / ')||unknownDate)} |`]:[]),
  '',`## ${tr('材料缺口','Material gaps')}`,...missing.map(m=>`- ${m}`),'',`## ${tr('法律与机制条件','Legal and mechanism conditions')}`,...(snapshot.legalResearch?.mechanisms??[]).map(m=>`- ${m.title}: ${m.conditions.map(c=>`${c.label} ${W.condition[c.status]}`).join(en?'; ':'；')}${m.disclosure.length?` · ${m.disclosure.join(en?'; ':'；')}`:''}`),'',...sourceLines];
 const compact=(text:string,max:number)=>text.length>max?text.slice(0,max)+tr('…（完整记载见引用附件）','… (full record in appendix)'):text;
 const histories=unique(plan.priorities.flatMap(t=>t.history.map(h=>JSON.stringify(h)))).map(h=>JSON.parse(h) as typeof plan.priorities[number]['history'][number]).slice(0,1);
 const brief=[`# ${documentTitles[locale].lawyer_brief}`,`${tr('生成日期','Generated')}: ${result.createdAt.slice(0,10)}`,`${tr('程序位置','Procedural position')}: ${procedure}`,`${tr('目标','Goal')}: ${goal}`,`${tr('披露选择','Disclosure choice')}: ${disclosure}`,tr('内部工作草稿；事实未经独立核实。生成不是已复核、已联系或已提交。','Internal working draft; facts not independently verified. Generation is not review, contact or submission.'),'',`## ${tr('本案摘要','Case summary')}`,account.length>550?account.slice(0,550)+tr('…（完整叙述见时间线）','… (full account in timeline)'):account,
  `${tr('现有支持','Existing support')}: ${support}${input.resourceConstraints?` · ${input.resourceConstraints}`:''}`,
  `${tr('简要时序','Short chronology')}: ${plan.facts.filter(f=>f.date).slice(0,3).map(f=>`${f.date} ${f.text}`).join(' / ')||tr('日期未确认；无法判断期限、紧迫程度和适用的法律版本，也不推算期限。','Dates are unconfirmed; deadlines, urgency and the applicable legal version cannot be assessed or calculated.')}`,
  `${tr('已采取行动','Prior actions')}: ${input.priorActions.status==='described'?input.priorActions.description:input.priorActions.status==='none'?tr('用户称尚无','User reports none'):tr('未确认；请先核对已有提交及回执','Unconfirmed; check existing submissions and receipts')}`,
  '',...issueLines,`## ${tr('请律师优先判断','Priority questions for counsel')}`,...plan.questions.slice(0,4).map((q,i)=>`${i+1}. ${q.question} — ${q.reason}`),
  ...(plan.questions.length<2?unique(missing).slice(0,2-plan.questions.length).map((q,i)=>`${plan.questions.length+i+1}. ${tr('请核对：','Please verify: ')}${q}`):[]),
  '',`## ${tr('相关条款与历史参考','Authorities and historical reference')}`,
  ...bindings.filter((b,i,all)=>plan.priorities.some(t=>t.legalBindingIds.includes(b.bindingId))&&all.findIndex(x=>x.resourceId===b.resourceId)===i).slice(0,3).map(b=>{const r=snapshot.resources.find(r=>r.resourceId===b.resourceId),p=r?.sourceAudit?.provisions.find(p=>p.provisionId===b.provisionId);return `- ${r?.name??b.resourceId} · ${p?.locator??b.provisionId}: ${compact(b.claim,en?130:45)}`;}),
  ...histories.map(h=>`- ${caseTitle(h.caseId)} · ${h.date}: ${compact(h.actor,100)} — ${compact(h.action,en?150:65)}; ${tr('后续记载','Recorded later outcome')}: ${compact(h.outcome,en?130:60)}; ${tr('关键差异','Key differences')}: ${compact(h.differences.find(d=>/本案|新案|this matter|new case/i.test(d))??h.differences[0]??unknownDate,en?150:70)}`),
  ...(!histories.length?[tr('暂无与本案程序和议题相符的已实施历史行动；继续上面的资料准备，不推断策略效果。','No implemented historical action matches this matter’s procedure and issues; continue preparation without inferring strategic effectiveness.')]:[]),
  '',`## ${tr('最需要核对的文书与日期','Documents and dates to confirm')}`,...(plan.priorities.find(t=>t.kind==='lawyer_brief')?.missing??[]).slice(0,3).map(m=>`- ${m.item}（${m.role}）`),
  tr('国际原则、当地法律效果和机制资格要分别核对；国际意见不等于国内执行。任何外发须按上面的披露选择另行确认。','Treaty principles, domestic legal effect and mechanism eligibility need separate checks; an international opinion is not domestic implementation. Any transmission needs the specific authorization recorded above.'),
  '',tr('—— 以下为引用附件，独立于一页简报正文 ——','— Citation appendix, separate from the one-page brief body —'),...sourceLines];
 return (['timeline','issue_matrix','lawyer_brief'] as const).map(kind=>{const markdown=({timeline,issue_matrix:matrix,lawyer_brief:brief}[kind]).join('\n');return {kind,title:documentTitles[locale][kind],markdown,generatedMarkdown:markdown,inputHash:plan.inputHash,status:'generated',citationState:workingSourcesValid(snapshot)?'source_linked':'needs_review',progress:'draft',progressNote:''};});
}

function sourceAppendix(snapshot:ReportSnapshot,locale:Locale):string[]{
 const tr=(zh:string,en:string)=>locale==='en'?en:zh,W=workingLabels[locale],plan=snapshot.whatsNext!;
 const ids=unique(plan.priorities.flatMap(t=>t.legalBindingIds));
 const lines=[`## ${tr('冻结来源与命题定位','Frozen sources and proposition locators')}`,tr('引用只支持所列研究命题，不证明用户案情，也不代表团队人工复核；改动命题后须重新核对。','Citations support only the listed research propositions, not the case account or team review. Recheck them after editing a proposition.')];
 for(const id of ids){const b=snapshot.legalResearch?.bindings.find(b=>b.bindingId===id),r=snapshot.resources.find(r=>r.resourceId===b?.resourceId),p=r?.sourceAudit?.provisions.find(p=>p.provisionId===b?.provisionId);if(!b||!r||!p){lines.push(`- ${tr('快照中缺少一条完整依据；不得视为已核实支持。','A complete authority record is missing from the snapshot; do not treat it as verified support.')}`);continue;}lines.push('',`### ${r.name} · ${p.locator}`,b.claim,`> ${p.quote}`,`${tr('原文','Source')}: ${r.sourceAudit?.readUrl||r.officialUrl}`,`${tr('适用条件','Conditions')}: ${b.conditions.map(c=>`${c.label}: ${W.condition[c.status]}`).join(' / ')}`,`${tr('来源核查','Source check')}: ${r.sourceAudit?.checkedAt??r.checkedAt} · ${W.read[r.sourceAudit?.readStatus??'not_checked']} · ${r.teamReviewedAt&&r.teamReviewer?`${tr('团队复核','Team review')} ${r.teamReviewer} / ${r.teamReviewedAt}`:W.review[r.reviewStatus==='team_verified'?'unreviewed':r.reviewStatus??'unreviewed']}`);}
 for(const h of unique(plan.priorities.flatMap(t=>t.history.map(h=>JSON.stringify(h)))).map(x=>JSON.parse(x) as typeof plan.priorities[number]['history'][number])){
  lines.push('',`### ${snapshot.cases.find(c=>c.caseId===h.caseId)?.title??h.caseId} · ${h.date}`,`${h.actor} · ${h.action}`,`${tr('后续结果','Later outcome')}: ${h.outcome}`,`${tr('关键差异','Key differences')}: ${h.differences.join(' / ')}`,tr('只保留来源归属与时间先后，不认定因果，也不说明机构现在接受本案。','Attribution and chronology only; no causal effect or current availability is established.'));
  for(const id of h.evidenceIds){const e=snapshot.evidence.find(e=>e.evidenceId===id&&e.caseId===h.caseId),d=snapshot.documents.find(d=>d.documentId===e?.documentId);lines.push(e?`- ${d?.title??e.documentId} · PDF ${e.pdfPage} · ${e.sourceUrl}\n> ${e.exactQuote}`:`- ${tr('一条原文摘录不在快照中，待复核','An excerpt is missing from the snapshot; review needed')}`);}
  for(const id of h.sourceIds){const s=snapshot.followups?.find(f=>f.caseId===h.caseId)?.sources.find(s=>s.sourceId===id);lines.push(s?`- ${s.title} · ${s.locator} · ${s.publishedAt??tr('发布日期未知','Publication date unknown')} · ${s.url}\n> ${s.quote}`:`- ${tr('一条后续来源不在快照中，待复核','A follow-up source is missing from the snapshot; review needed')}`);}
 }
 if(!ids.length&&!plan.priorities.some(t=>t.history.length))lines.push(tr('暂无可直接引用的法律或历史行动依据；本文的案情整理属于一般准备工作，来源为用户提供记录。','No directly citable authority or historical action is available; this factual organization is general preparation sourced to the user-provided record.'));
 return lines;
}

/** Attach current draft provenance every time a copy is downloaded or copied. */
export function workingDocumentMarkdown(document:WorkingDocument,locale:Locale='zh'):string{
 const en=locale==='en',W=workingLabels[locale];
 return [document.markdown,'','---',`${en?'Draft status':'草稿状态'}: ${W.status[document.status]} · ${en?'Citations':'依据'}: ${document.citationState==='needs_review'?(en?'need rechecking':'待复核'):(en?'source-linked':'已连接来源')}`,document.citationState==='needs_review'?(en?'User edits or unresolved source gaps: original citations need rechecking; no previous verification is inherited.':'用户编辑或来源缺口：原引用与命题须重新核对，不继承原核查结论。'):(en?'Source-linked draft; not a team-verified legal conclusion.':'已连接来源的草稿；不是团队核实的法律结论。'),`${en?'User-recorded action progress':'用户记录的实际进度'}: ${W.progress[document.progress]}${document.progressNote?` — ${document.progressNote}`:''}`,en?'Export does not mark an action reviewed, completed or sent.':'导出不会将行动标记为已复核、已完成或已发送。'].join('\n');
}
