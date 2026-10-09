import {describe,it,expect,vi} from 'vitest';
import {EMPTY_INPUT,type NewCaseInput,type ModelAnalysisOutput} from '../src/lib/contracts';
import {effectiveGoal,normalizeConfirmedGoal,needsGoalClarification} from '../src/lib/intake/analysis';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {contextFor,lockUnspecifiedGoalActions,validateModelOutput} from '../src/lib/evidence/validate';
import {generateLive,type ModelTransport} from '../src/lib/ai/adapter';
import {buildPromptData,webSystemPrompt} from '../src/lib/ai/prompt';
import type {ServerConfig} from '../src/lib/ai/config';

const config:ServerConfig={mode:'live',key:'offline-unused',model:'offline-model',configured:true,timeoutMs:1000,reasoningEffort:'low',maxOutputTokens:9000};
function account():NewCaseInput{return {...structuredClone(EMPTY_INPUT),country:'中国',primaryGoal:'unknown',publicity:'private',intake:{version:1,jurisdiction:'unknown',caseKind:'civil',narrative:'我委托他人处理示例游戏账号，之后账号被封禁。我认为对方使用了违规软件，但对方否认并删除了联系。',goalText:'希望服务方赔偿可证明的账号损失。',disclosureDetails:'不公开姓名或联系方式。',answers:[{questionId:'key-dates',question:'已知时间',answer:'10月1日委托，3日结束，5日收到封禁通知。'}],facts:[],confirmed:true}};}
function options(input=account()):ModelAnalysisOutput{
 const base=buildRuleReference(input,[]);const template=base.actionOptions[0];
 return {...base,actionOptions:[
  {...template,actionId:'evidence',title:'保留账号封禁与代练约定的证据',reason:'违规使用是用户的主张，需要与封禁通知和登录记录核对。',leadRole:'用户本人',applicability:'priority',prerequisites:['保存可访问的原始记录'],steps:['保存服务约定与完整聊天记录。','保留封禁通知中的原因及可核对记录。','区分本人主张、对方否认和已有客观材料。'],materials:['聊天与约定记录','封禁通知及支付记录'],followUp:['通知是否说明原因','对方的否认是否有对应记录']},
  {...template,actionId:'amount',title:'分开记录服务费用和主张的其他损失',reason:'充值不自动等于可赔损失，先列出每项金额的来源。',leadRole:'用户本人',applicability:'priority',prerequisites:['仅填写有依据的金额'],steps:['分别列出服务费和另行主张的损失。','为每项金额标注支付记录或其他依据。','比较争议金额与双方书面方案，不把报价写成确定责任。'],materials:['付款记录','损失明细及对应依据'],followUp:['每项金额是否可核对','是否出现重复计算']},
  {...template,actionId:'private-review',title:'通过平台内部申诉核对封禁原因',reason:'私下申诉不等于公开传播，也不要求先聘请律师。',leadRole:'用户本人',applicability:'priority',prerequisites:['核对平台自己的申诉入口与所需资料'],steps:['核对平台内已显示的封禁原因。','向平台提交必要的账号申诉材料，不向公众发布身份信息。','记录受理状态及要求补充的具体材料。'],materials:['封禁通知','允许提交的必要账号资料'],followUp:['是否有受理记录','是否要求补充材料']},
 ]};
}

describe('confirmed general civil goals',()=>{
 it('normalizes a confirmed written goal without mutating input or overriding a selected preset',()=>{
  const input=account();expect(effectiveGoal(input)).toBe('other');expect(needsGoalClarification(input)).toBe(false);
  const normalized=normalizeConfirmedGoal(input);expect(normalized.primaryGoal).toBe('other');expect(input.primaryGoal).toBe('unknown');expect(normalized.intake).toBe(input.intake);
  expect(effectiveGoal({...input,primaryGoal:'release'})).toBe('release');
  expect(effectiveGoal({...input,intake:{...input.intake!,confirmed:false}})).toBe('unknown');
  expect(needsGoalClarification({...input,intake:{...input.intake!,goalText:'  '}})).toBe(true);
 });
 it('passes the complete narrative and effective goal to the model and never replaces its specific actions',async()=>{
  const input=account();const proposed=options(input);const model:ModelTransport=vi.fn(async({data})=>{
   const payload=JSON.parse(data);expect(payload.userProvidedCase.primaryGoal).toBe('other');expect(payload.userProvidedCase.intake).toEqual(input.intake);
   return {status:'completed',output_parsed:proposed};
  });
  expect(lockUnspecifiedGoalActions(proposed,input)).toBe(proposed);
  const result=await generateLive(input,contextFor([]),[],config,undefined,model);
  expect(result.actionOptions.map(a=>a.actionId)).toEqual(['evidence','amount','private-review']);
  expect(result.actionOptions.every(a=>a.goal==='other'&&a.applicability==='priority')).toBe(true);expect(model).toHaveBeenCalledOnce();
 });
 it('keeps genuinely unknown goals on an explicitly described, domain-neutral rule template',()=>{
  const input=account();input.intake!.goalText='';const result=buildRuleReference(input,[]);
  expect(result.actionOptions[0].reason).toContain('规则模板');
  expect(JSON.stringify(result.actionOptions)).not.toMatch(/释放|保释|撤诉|拘押|人身限制/);
  expect(()=>validateModelOutput(result,input,contextFor([]))).not.toThrow();
 });
 it('does not require a lawyer for private refund discussions, legal-question preparation or a platform appeal',()=>{
  const input=account();input.resources=['none'];const output=options(input);output.actionOptions[0].title='整理法律问题与退款协商材料';
  expect(validateModelOutput(output,input,contextFor([])).actionOptions.every(a=>a.applicability==='priority')).toBe(true);
  output.actionOptions[2].title='Prepare a private platform appeal, without hiring a lawyer';
  expect(validateModelOutput(output,input,contextFor([]),'en').actionOptions[2].applicability).toBe('priority');
 });
 it('retains procedural checks for an actual formal filing instead of accepting it as immediate action',()=>{
  const input=account();const output=options(input);output.actionOptions[2].title='向法院提交民事起诉材料';output.actionOptions[2].steps[0]='向法院提交民事起诉材料。';
  const checked=validateModelOutput(output,input,contextFor([]));expect(checked.actionOptions[2].applicability).toBe('conditional');expect(checked.actionOptions[2].prerequisites[0]).toContain('当地代理要求');
 });
 it.each(['仅内部整理，不发送。','不要联系平台。'])('respects an explicit private-channel boundary: %s',boundary=>{
  const input=account();input.intake!.disclosureDetails=boundary;expect(()=>validateModelOutput(options(input),input,contextFor([]))).toThrow(/不联系范围/);
 });
 it('retains public-disclosure, unsupported-reference, invented-deadline and outcome-guarantee checks',()=>{
  const input=account();
  for(const mutation of [
   (o:ModelAnalysisOutput)=>{o.actionOptions[0].steps[0]='立即公开姓名并联系媒体。';},
   (o:ModelAnalysisOutput)=>{o.actionOptions[0].supportingEvidenceIds=['invented'];},
   (o:ModelAnalysisOutput)=>{o.actionOptions[0].timing='必须在5天内起诉';},
   (o:ModelAnalysisOutput)=>{o.actionOptions[0].reason='赔偿成功率达到99%';},
   (o:ModelAnalysisOutput)=>{o.actionOptions[0].reason='There is a 70 percent chance of success.';},
  ]){const output=options(input);mutation(output);expect(()=>validateModelOutput(output,input,contextFor([]))).toThrow();}
 });
 it('does not treat a money percentage as a success prediction',()=>{
  const input=account();const output=options(input);output.actionOptions[1].reason='如对方提出按服务费的50%退款，记录该方案与计算基数；这不是已确定的赔偿责任。';
  expect(()=>validateModelOutput(output,input,contextFor([]))).not.toThrow();
  output.actionOptions[1].reason='If the proposed refund is 50 percent of the service fee, record its basis; this is not an established entitlement.';
  expect(()=>validateModelOutput(output,input,contextFor([]),'en')).not.toThrow();
 });
 it('asks for evidence, amounts and suitable routes without forcing every dispute into lawyer or media action',()=>{
  const prompt=webSystemPrompt();expect(prompt).toContain('普通民事');expect(prompt).toContain('充值或购买支出不自动等于可赔损失');expect(prompt).toContain('平台内部申诉不默认需要律师');
  expect(JSON.parse(buildPromptData(account(),contextFor([]),[])).userProvidedCase.primaryGoal).toBe('other');
 });
});
