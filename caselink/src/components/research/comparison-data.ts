import {ComparisonBriefSchema,type ComparisonBrief,type ReportSnapshot,type Resource,type SourceDescriptor} from '@/lib/contracts';
import {captureCaseSnapshot} from '@/lib/reports/snapshot';
import {resources} from '@/lib/corpus';
import {localizeResource} from '@/lib/i18n/content';

export const COMPARISON_MAX_BYTES=3_000_000;
const labels={zh:{detained:'拘押或人身自由受限',lawyer_access:'律师协助问题',file_access:'获取案卷问题',threats:'威胁',expression_restricted:'表达受限'},en:{detained:'Detention or restrictions on liberty',lawyer_access:'Access to counsel',file_access:'Access to case files',threats:'Threats',expression_restricted:'Restrictions on expression'}};
const loc=(zh:string,en:string,locale:'zh'|'en')=>locale==='zh'?zh:en;
export function resourceDescriptor(r:Resource):SourceDescriptor{return {sourceId:r.resourceId,category:r.type==='assistance'?'assistance':r.type==='un_mechanism'||r.type==='regional_mechanism'?'mechanism':'international_standard',reviewStatus:r.reviewStatus??'unreviewed',applicability:[r.applicability,...r.eligibility??[]],locator:r.locator??r.officialUrl,agentCheckedAt:r.agentCheckedAt??null,teamReviewedAt:r.teamReviewedAt??null,unknowns:r.unknowns??[]};}
/** No new legal classification: common themes are existing corpus labels, scoped to selected records. */
export function commonIssuesFromSnapshot(snapshot:ReportSnapshot):ComparisonBrief['commonIssues']{
 const locale=snapshot.locale;
 return Object.entries(labels[locale]).flatMap(([tag,label])=>{
  const supporting=snapshot.cases.filter(c=>c.problems.includes(tag as typeof c.problems[number]));
  if(supporting.length<2)return [];
  return [{label:loc('共同入库主题：','Shared recorded theme: ',locale)+label,supportingCaseIds:supporting.map(c=>c.caseId),evidenceIds:[...new Set(supporting.flatMap(c=>c.evidenceIds))].filter(id=>snapshot.evidence.some(e=>e.evidenceId===id)),differences:supporting.map(c=>`${c.title} · ${c.country} · ${c.statusSummary}`),unknowns:[loc('这些是所选记录中的主题，不是新的违法认定或发生率估计；逐条引文需结合上下文核对。','These are themes in selected records, not new findings of violations or prevalence estimates; review each excerpt in context.',locale),...supporting.flatMap(c=>c.unknowns.map(u=>`${c.title}: ${u}`))]}];
 });
}
export function buildComparisonBrief(caseIds:readonly string[],locale:'zh'|'en'='zh'):ComparisonBrief{
 if(new Set(caseIds).size!==caseIds.length||caseIds.length<2||caseIds.length>4)throw new Error(loc('请选择 2–4 个不同案例。','Select 2–4 distinct cases.',locale));
 const snapshot=captureCaseSnapshot(caseIds,locale);
 if(snapshot.cases.length!==caseIds.length)throw new Error(loc('所选案例不存在。','A selected case is unavailable.',locale));
 const selectedTags=new Set(['expression','fair_trial',...(snapshot.cases.some(c=>c.problems.includes('detained'))?['detention']:[])]);
 snapshot.resources=structuredClone(resources.filter(r=>r.tags?.some(t=>selectedTags.has(t))).map(r=>localizeResource(r,locale)));
 snapshot.sourceDescriptors.push(...snapshot.resources.map(resourceDescriptor));
 return ComparisonBriefSchema.parse({briefId:crypto.randomUUID(),title:loc('表达案件比较 · 内部交接简报','Expression cases · internal comparison brief',locale),createdAt:new Date().toISOString(),locale,caseIds:[...caseIds],snapshot,commonIssues:commonIssuesFromSnapshot(snapshot),limitations:[loc('仅比较所选公开案例，不能推断国家或全球发生率。','Only selected public cases are compared; no national or global prevalence inference.',locale),loc('历史行动与结果分别记载；先后关系不证明因果效果。','Historical actions and outcomes are separate; sequence does not establish causation.',locale),loc('法域、程序类型和罪名没有统一结构化字段时显示未记载；不由模型补齐。','Missing structured jurisdiction, procedure and charge fields remain unrecorded; no model fills the gaps.',locale),loc('原入库审核记录保留；本轮未独立复核原案事实。资源由 agent 检查不等于团队人工复核。','Legacy review records are retained; underlying events were not independently reverified. Agent source checks are not team review.',locale),loc('没有调用 AI 或搜索。这是生成时固定的资料简报，不是实时案情更新。','No AI or search was called. This is a generation-time snapshot, not a live case update.',locale)]});
}
export function serializeComparisonBrief(brief:ComparisonBrief):string{
 const text=JSON.stringify(ComparisonBriefSchema.parse(brief),null,2);
 if(new TextEncoder().encode(text).byteLength>COMPARISON_MAX_BYTES)throw new Error('Comparison exceeds the 3 MB import/export limit. Select fewer cases.');
 return text;
}
export function parseComparisonBrief(text:string):ComparisonBrief{
 if(new TextEncoder().encode(text).byteLength>COMPARISON_MAX_BYTES)throw new Error('Comparison exceeds the 3 MB import/export limit.');
 const brief=ComparisonBriefSchema.parse(JSON.parse(text));
 const ids=new Set(brief.caseIds);
 if(ids.size!==brief.caseIds.length||brief.snapshot.cases.length!==ids.size||brief.snapshot.cases.some(c=>!ids.has(c.caseId)))throw new Error('Snapshot case selection is inconsistent.');
 const refs=new Map(brief.snapshot.evidence.map(e=>[e.evidenceId,e]));
 if(brief.snapshot.evidence.some(e=>!ids.has(e.caseId))||brief.commonIssues.some(i=>i.supportingCaseIds.some(id=>!ids.has(id))||i.evidenceIds.some(id=>!refs.has(id)||!i.supportingCaseIds.includes(refs.get(id)!.caseId))))throw new Error('Snapshot evidence ownership is inconsistent.');
 return brief;
}
export function safeSourceUrl(value:string):string|null{try{const u=new URL(value);return (u.protocol==='https:'||u.protocol==='http:')&&!u.username&&!u.password?u.href:null;}catch{return null;}}
