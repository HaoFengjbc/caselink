import {randomUUID} from 'node:crypto';
import { AnalysisResultSchema, NewCaseInputSchema, SCHEMA_VERSION, CORPUS_VERSION, PROMPT_VERSION, type NewCaseInput, type AnalysisResult, type ModelAnalysisOutput, type WebModelAnalysisOutput } from '../contracts';
import { retrieveCases } from '../retrieval/match';
import { retrieveNarrativeCandidates } from '../retrieval/candidates';
import { buildRuleReference } from '../retrieval/rules';
import { contextFor, collectSources, validateModelOutput, validateWebModelOutput } from '../evidence/validate';
import { presetOutput } from '../../../data/demo/presets';
import { cases } from '../corpus';
import type { Locale } from '../i18n/locale';
import { hashInput } from './hash';
import { readConfig, requireLiveConfiguration, type ServerConfig } from './config';
import { generateLive, generateWebLive, type ModelTransport } from './adapter';
import { AnalysisError } from './errors';
import {researchWeb,type WebSearchTransport} from '../research/provider';
import type {WebResearch} from '../research/contracts';
import type {ResearchPlannerTransport} from '../research/planner';
import {needsGoalClarification,normalizeConfirmedGoal} from '../intake/analysis';
const webComparisonCount=(value:ModelAnalysisOutput|WebModelAnalysisOutput)=>Array.isArray((value as WebModelAnalysisOutput).webComparisons)?(value as WebModelAnalysisOutput).webComparisons.length:0;

export async function analyzeInput(raw:NewCaseInput,options:{forceRule?:boolean;signal?:AbortSignal;config?:ServerConfig;transport?:ModelTransport;researchTransport?:WebSearchTransport;researchPlannerTransport?:ResearchPlannerTransport;locale?:Locale}={}):Promise<AnalysisResult>{
  const locale=options.locale??'zh';
  const deadlineAt=Date.now()+270_000;
  const checkCancelled=()=>{if(options.signal?.aborted)throw new AnalysisError('CANCELLED','本次分析已取消。',499);};
  checkCancelled();
  const parsed=NewCaseInputSchema.safeParse(raw);
  if(!parsed.success)throw new AnalysisError('INVALID_INPUT','案情字段不完整、选项冲突或文字过长，请返回确认页修改。');
  if(parsed.data.intake && !parsed.data.intake.confirmed)throw new AnalysisError('INVALID_INPUT','请先核对并确认当前案情记录，再生成分析。');
  const inputHash=hashInput(parsed.data);const input=normalizeConfirmedGoal(parsed.data);let matches=retrieveCases(input,cases,locale);
  const config=options.forceRule?undefined:options.config??readConfig();
  // Recall from the confirmed narrative without treating keyword mentions as
  // verified facts. Bound the full-evidence context as the corpus grows.
  if(input.intake?.confirmed && config?.mode==='live') {
    matches=retrieveNarrativeCandidates(input,cases,locale).slice(0,3);
  }
  if(config?.mode==='live')matches=matches.slice(0,3);
  // The reviewed library holds journalism and expression cases only. When the person says the matter is
  // unrelated, no library case is offered as a comparison.
  if(input.intake?.expression==='no')matches=[];
  const context=contextFor(matches);
  let mode:AnalysisResult['mode'];let output:ModelAnalysisOutput|WebModelAnalysisOutput;let webResearch:WebResearch|undefined;
  let attempts=0;let recovery:NonNullable<AnalysisResult['researchAssessment']>['recovery']='not_needed';
  if(options.forceRule){mode='rule_reference';output=buildRuleReference(input,matches,locale);}
  else if(config!.mode==='demo'){
    const preset=presetOutput(inputHash,locale);mode=preset?'preset_demo':'rule_reference';output=preset??buildRuleReference(input,matches,locale);
  }else{
    requireLiveConfiguration(config!);
    const researchOptions={plannerTransport:options.researchPlannerTransport,deadlineAt};
    webResearch=await researchWeb(input,config!,options.signal,options.researchTransport,locale,researchOptions);attempts=1;
    checkCancelled();
    const synthesize=async(research:WebResearch)=>{
      const remaining=deadlineAt-Date.now();
      if(remaining<1000)throw new AnalysisError('TIMEOUT','分析时间不足，未生成完整结果。',504);
      const boundedConfig={...config!,timeoutMs:Math.min(config!.timeoutMs,remaining)};
      return research.status==='completed'
        ?generateWebLive(input,context,matches,research,boundedConfig,options.signal,options.transport,locale)
        :generateLive(input,context,matches,boundedConfig,options.signal,options.transport,locale);
    };
    output=await synthesize(webResearch);
    // The model can reject irrelevant material. Act on that finding once rather
    // than treating any cited page as a successful case comparison.
    const adoptedWeb=webComparisonCount(output);
    if(webResearch.plan && webResearch.status!=='unavailable' && adoptedWeb===0){
      // Reserve a complete search window and at least 30s for reassessment.
      if(deadlineAt-Date.now()>=95_000){
        attempts=2;
        try{
          const refined=await researchWeb(input,config!,options.signal,options.researchTransport,locale,{...researchOptions,attempt:2,previousResearch:webResearch});
          checkCancelled();
          webResearch={...webResearch,attempts:refined.attempts};
          if(refined.status==='completed'){
            const refinedOutput=await synthesize(refined);
            checkCancelled();
            webResearch=refined;output=refinedOutput;
            recovery=webComparisonCount(output)?'found_cases':'no_relevant_cases';
          }else recovery=refined.status==='no_results'?'no_relevant_cases':'unavailable';
        }catch(error){
          checkCancelled();
          if(error instanceof AnalysisError&&error.code==='CANCELLED')throw error;
          recovery='unavailable';
        }
      }else recovery='budget_exhausted';
    }
    checkCancelled();mode='live_ai';
    // Matching labels and dimensions are deterministic, never upgraded by the model.
    output.comparableCases=output.comparableCases.map(c=>{const match=matches.find(m=>m.record.caseId===c.caseId);return match?{...c,relevance:match.comparison.relevance,matchDimensions:match.comparison.matchDimensions}:c;});
  }
  output=webResearch?.status==='completed'
    ?validateWebModelOutput(output,input,context,webResearch,locale)
    :validateModelOutput(output,input,context,locale);
  if(webResearch){
    const note=webResearch.status==='completed'
      ?(locale==='en'?'Web sources were retrieved for this request. Their content and applicability still need human checking; citation availability is not independent verification.':'本次已检索网页来源，其内容与本案适用性仍需人工核查；有引用不等于独立事实核实。')
      :webResearch.status==='no_results'
        ?(locale==='en'?'Web research returned no usable cited material. This analysis relies on the curated corpus and general preparation only.':'本次联网研究未获得可用的引用材料；分析仅使用正式库参考与一般准备。')
        :(locale==='en'?'Web research was unavailable for this request. This analysis relies on the curated corpus and general preparation; no completed web research is claimed.':'本次联网研究未能完成；分析仅使用正式库参考与一般准备，不声称已完成网页研究。');
    output.limitations=[note,...output.limitations.filter(item=>item!==note)].slice(0,12);
  }
  const webCaseCount=webComparisonCount(output);
  const status:NonNullable<AnalysisResult['researchAssessment']>['status']=!webResearch?'not_searched':webCaseCount?'relevant_cases_found':webResearch.status==='unavailable'?'search_unavailable':'no_relevant_cases';
  const researchNotes=locale==='en'?{
    relevant_cases_found:'AI selected comparisons from cited public material; their facts and applicability still need checking.',
    no_relevant_cases:'No suitable case comparison was selected. Retrieved sources alone do not establish relevance or an absence of similar cases.',
    search_unavailable:'Web research did not complete. The result uses available historical material and general preparation.',
    not_searched:'This result uses rules or a preset; no web research was performed.',
  }:{
    relevant_cases_found:'AI 从本次公开资料中选出可比较案件；事实与适用性仍需核查。',
    no_relevant_cases:'本次未选出合适的案例比较。取得来源不等于相关，也不代表不存在类似案件。',
    search_unavailable:'本次联网研究未完成；结果使用已有历史资料与一般准备。',
    not_searched:'本次使用规则或预置结果，未进行联网研究。',
  };
  const recoveryNote=recovery==='unavailable'?(locale==='en'?' The additional search or assessment could not complete; the earlier valid result is retained.':' 补充检索或复核未完成，保留此前有效结果。'):recovery==='budget_exhausted'?(locale==='en'?' The time budget did not allow another search.':' 剩余时间不足以完成另一轮检索。'):'';
  const researchAssessment={status,attempts,recovery,note:researchNotes[status]+recoveryNote};
  const origin=mode==='preset_demo'?'preset':mode==='rule_reference'||needsGoalClarification(input)?'rule':'ai';
  const actionOrigins=output.actionOptions.map(action=>({actionId:action.actionId,origin,reason:origin==='rule'?(locale==='en'?'General preparation generated from fixed rules; a specific goal or sufficient research is not yet available.':'按固定规则生成的一般准备参考，尚未明确具体目标或未采用实时分析。'):null}));
  // Candidate evidence is supplied for assessment, not automatically published
  // as support. Only adopted comparisons receive the full historical table;
  // evidence explicitly cited by an action is collected separately below.
  const adoptedCaseIds=new Set(output.comparableCases.map(comparison=>comparison.caseId));
  const adoptedMatches=matches.filter(match=>adoptedCaseIds.has(match.record.caseId));
  const historicalComparisons=adoptedMatches.flatMap(m=>m.record.interventions.filter(i=>i.executionStatus==='implemented').map(i=>({caseId:m.record.caseId,interventionId:i.interventionId})));
  const historicalIds=new Set(adoptedMatches.flatMap(m=>[...m.record.interventions.filter(i=>i.executionStatus==='implemented').flatMap(i=>i.evidenceIds),...m.record.outcomes.flatMap(o=>o.evidenceIds)]));
  const referencedSources=collectSources(output,context);const sourceIds=new Set(referencedSources.map(s=>s.evidenceId));
  for(const e of context.evidence)if(historicalIds.has(e.evidenceId)&&!sourceIds.has(e.evidenceId)){referencedSources.push(e);sourceIds.add(e.evidenceId);}
  // Chinese results keep their original shape; only other languages are tagged.
  checkCancelled();
  return AnalysisResultSchema.parse({...output,...(webResearch?{webResearch}:{}),actionOrigins,researchAssessment,analysisId:randomUUID(),schemaVersion:SCHEMA_VERSION,inputHash,corpusVersion:CORPUS_VERSION,promptVersion:PROMPT_VERSION,createdAt:new Date().toISOString(),mode,historicalComparisons,sources:referencedSources,...(locale==='zh'?{}:{locale})});
}
