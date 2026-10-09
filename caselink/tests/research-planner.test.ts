import {afterEach,describe,expect,it,vi} from 'vitest';
import {zodTextFormat} from 'openai/helpers/zod';
import {EMPTY_INPUT,type NewCaseInput} from '../src/lib/contracts';
import type {ServerConfig} from '../src/lib/ai/config';
import {ModelResearchPlanSchema,validateResearchPlan,unsafePublicText,type ModelResearchPlan} from '../src/lib/research/plan';
import {buildResearchQuery} from '../src/lib/research/query';
import {planResearch,openAIResearchPlannerTransport,RESEARCH_PLANNER_TIMEOUT_MS,type ResearchPlannerTransport} from '../src/lib/research/planner';
import {researchWeb,SEARCH_INSTRUCTIONS,type WebSearchTransport,type WebSearchResponse} from '../src/lib/research/provider';

const config:ServerConfig={mode:'live',key:'offline-test-not-a-secret',model:'gpt-6.1-sol',configured:true,timeoutMs:1000,reasoningEffort:'low',maxOutputTokens:9000};
const account=(narrative:string,goal:string):NewCaseInput=>({...structuredClone(EMPTY_INPUT),country:'中国',primaryGoal:'other',background:{personType:'other',activities:[],description:''},intake:{version:1,caseKind:'civil',jurisdiction:'中国',narrative,goalText:goal,disclosureDetails:'',answers:[],facts:[],confirmed:true}});
const delta=()=>account('我三角洲的账号找人代练跑刀，代练的人开挂把我的账号封禁了。代练不承认，删了微信。','代练的人赔偿我的账号损失');
const deltaPlan=():ModelResearchPlan=>({domain:'digital_services',relationship:'游戏用户委托有偿服务商操作虚拟账户',disputedConduct:['受托方被指使用违规软件，随后运营方限制账户使用'],harms:['虚拟资产使用利益受损'],remedies:['向受托服务商请求经济损失赔偿'],evidenceIssues:['违规行为与封停之间的因果联系','服务约定与损失价值的证明','聊天及支付记录保存'],excludedIssues:[],uncertainties:['受托方是否违规尚有争议','平台限制原因有待核实'],searchQueries:['游戏代操作服务违规导致封号 委托责任 赔偿 判决','虚拟资产使用利益受损 服务违约 损失认定 裁判','电子聊天记录 服务合同 因果关系 举证'],coverage:'adequate',privateTerms:['三角洲'],groundingQuotes:['代练不承认','代练的人赔偿我的账号损失']});
const transport=(plan:unknown):ResearchPlannerTransport=>vi.fn(async()=>plan);
const searched=(queries=['游戏代操作 损失赔偿 裁判'])=>({status:'completed',output:[{type:'web_search_call',status:'completed',action:{type:'search',queries}},{type:'message',status:'completed',content:[{type:'output_text',text:'A public contract case discusses liability.',annotations:[{type:'url_citation',start_index:0,end_index:42,title:'Public judgment',url:'https://court.gov/public-decision'}]}]}]});
const web:WebSearchTransport=vi.fn(async()=>searched());
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});

describe('semantic research planning, without web tools',()=>{
 it('retains the real game service relationship, harm, compensation target and evidence dispute offline',async()=>{
  const i=delta();const plan=await planResearch(i,config,undefined,transport(deltaPlan()));const q=buildResearchQuery(i,plan);
  expect(q.plan.relationship).toContain('有偿服务商');expect(q.plan.remedies[0]).toContain('服务商');expect(q.plan.evidenceIssues).toContain('违规行为与封停之间的因果联系');
  expect(q.searchTerms.join(' ')).toMatch(/China civil/);expect(q.searchTerms.join(' ')).toMatch(/赔偿/);
  expect(JSON.stringify(q)).not.toMatch(/三角洲|微信|journalist|freedom of expression|fair trial/);
  expect(JSON.stringify(q)).not.toContain(i.intake!.narrative);expect(q).not.toHaveProperty('privateTerms');expect(q.plan).not.toHaveProperty('groundingQuotes');
 });
 it('does not collapse a different goods/payment dispute into the same research',async()=>{
  const i=account('客户收了货但拒绝付尾款，声称货物有质量问题。','我要客户支付剩余货款');
  const raw:ModelResearchPlan={...deltaPlan(),domain:'business_contract',relationship:'卖方与买方之间的货物买卖关系',disputedConduct:['买受方以瑕疵为由拒付价款'],harms:['交易价款未收回'],remedies:['请求买方履行付款义务'],evidenceIssues:['货物验收及质量约定','付款记录与交付记录'],uncertainties:['货物瑕疵尚待证明'],searchQueries:['买卖合同 质量抗辩 拒付价款 判决','货物验收 付款义务 举证 裁判'],privateTerms:[],groundingQuotes:['客户收了货但拒绝付尾款']};
  const q=buildResearchQuery(i,await planResearch(i,config,undefined,transport(raw)));
  expect(q.searchTerms).not.toEqual(buildResearchQuery(delta(),validateResearchPlan(deltaPlan(),delta())).searchTerms);
  expect(q.searchTerms.join(' ')).toContain('质量抗辩');expect(q.searchTerms.join(' ')).not.toMatch(/游戏|记者|journalist/);
 });
 it('supports a journalism claim only when the semantic account warrants it, preserving existing counsel',()=>{
  const i=account('作为记者，我报道公共采购后收到民事诽谤起诉，已有律师协助。没有被拘押。','我希望抗辩并保护消息来源');
  const raw:ModelResearchPlan={domain:'expression_media',relationship:'调查报道者与提起名誉诉讼的报道对象',disputedConduct:['公共利益报道遭遇民事名誉请求'],harms:['表达活动受到诉讼压力'],remedies:['名誉侵权请求的公共利益抗辩','保密新闻来源保护'],evidenceIssues:['报道事实依据与核实过程'],excludedIssues:['人身拘禁','律师接触受阻'],uncertainties:['原告具体请求尚不明确'],searchQueries:['公共采购调查报道 民事名誉诉讼 公共利益抗辩 判决','名誉侵权 新闻来源保密 裁判'],coverage:'adequate',privateTerms:[],groundingQuotes:['已有律师协助','我希望抗辩并保护消息来源']};
  const q=buildResearchQuery(i,validateResearchPlan(raw,i));expect(q.plan.domain).toBe('expression_media');expect(q.plan.excludedIssues).toContain('律师接触受阻');
  expect(q.searchTerms.join(' ')).not.toMatch(/拘禁|律师接触|detention|access to counsel/);
 });
 it('preserves a long-tail natural-language issue rather than requiring a topic enum',()=>{
  const i=account('合作实验室没有按双方约定归还特定生物样本，我要求保全样本后移交。','我要先确保样本不会销毁');
  const raw:ModelResearchPlan={...deltaPlan(),domain:'other',relationship:'研究材料保管人与委托机构之间的返还争议',disputedConduct:['托管研究材料拒绝交付'],harms:['不可替代研究材料灭失风险'],remedies:['材料保存和返还'],evidenceIssues:['保管协议与材料清单'],uncertainties:['保管义务范围待确认'],searchQueries:['研究材料托管 返还义务 保全 裁判'],privateTerms:[],groundingQuotes:['我要求保全样本后移交']};
  expect(buildResearchQuery(i,validateResearchPlan(raw,i)).searchTerms[0]).toContain('研究材料托管');
 });
 it('explicitly adds selected current problems and goal without arbitrary topic truncation',()=>{
  const i=delta();i.currentProblems=['file_access','lawyer_access'];i.primaryGoal='release';i.stage='appeal';
  const q=buildResearchQuery(i,validateResearchPlan(deltaPlan(),i));
  expect(q.plan.evidenceIssues).toContain('access to case records');expect(q.plan.remedies[0]).toBe('release from detention');
  expect(q.searchTerms.join(' ')).toMatch(/appeal review/);expect(q.searchTerms.join(' ')).toMatch(/case records/);
 });
 it('does not permit an excluded issue to be silently searched as an affirmative problem',()=>{
  expect(()=>validateResearchPlan({...deltaPlan(),excludedIssues:['人身拘禁'],searchQueries:['人身拘禁 判决']},delta())).toThrow('contradictory_plan');
 });
 it('fails closed on invented supporting quotes and insufficient plans never reach web search',async()=>{
  expect(()=>validateResearchPlan({...deltaPlan(),groundingQuotes:['invented evidence']},delta())).toThrow('ungrounded_plan');
  const mock:WebSearchTransport=vi.fn(async()=>searched());
  const r=await researchWeb(delta(),config,undefined,mock,'zh',{plannerTransport:transport({...deltaPlan(),coverage:'insufficient'})});
  expect(r.failureReason).toBe('insufficient_plan');expect(mock).not.toHaveBeenCalled();
 });
});

describe('planning privacy boundary',()=>{
 it.each(['private@example.net','微信号：secret_account','2026-10-09','10/05','￥2000','2000元','10年','10 years','user12345678','account id: SecretID','https://private.org/account','13912345678','三角洲'])('rejects identifiers and identifying plan text: %s',(value)=>{
  expect(()=>validateResearchPlan({...deltaPlan(),searchQueries:[`${value} 损失赔偿 判决`]},delta())).toThrow('unsafe_plan');
 });
 it('rejects verbatim narrative runs, even when the planner forgot to list private terms',()=>{
  expect(()=>validateResearchPlan({...deltaPlan(),relationship:delta().intake!.narrative,privateTerms:[]},delta())).toThrow('unsafe_plan');
 });
 it('does not mistake a reusable English legal phrase for a long private sentence',()=>{
  const i=account('The dispute concerns freedom of expression and access to legal representation.','Protect speech');
  expect(unsafePublicText('access to legal representation',i)).toBe(false);
  expect(unsafePublicText(i.intake!.narrative,i)).toBe(true);
 });
 it('screens marked names and distinctive identifiers omitted by the planner',()=>{
  const i=account('我叫张三丰。微信是SecretFriend。AlicePrivate hired a provider.','赔偿损失');
  for(const value of ['张三丰','SecretFriend','AlicePrivate'])expect(unsafePublicText(`${value} damages`,i)).toBe(true);
 });
 it('does not send unsafe plans or error details to web or the returned research',async()=>{
  const mock:WebSearchTransport=vi.fn(async()=>searched());
  const r=await researchWeb(delta(),config,undefined,mock,'zh',{plannerTransport:transport({...deltaPlan(),searchQueries:['private@example.net damages']})});
  expect(r).toMatchObject({status:'unavailable',failureReason:'unsafe_plan'});expect(mock).not.toHaveBeenCalled();expect(JSON.stringify(r)).not.toMatch(/private@example|groundingQuotes|privateTerms/);
 });
 it('keeps raw actual tool queries distinct from planned terms and filters sensitive tool-query text',async()=>{
  const i=delta();i.intake!.narrative+=' 微信号：SecretAccount';
  const mock:WebSearchTransport=vi.fn(async()=>searched(['游戏代练 损失赔偿 法院判决','private@example.net contract','SecretAccount liability','三角洲私案赔偿']));
  const r=await researchWeb(i,config,undefined,mock,'zh',{plannerTransport:transport(deltaPlan())});
  expect(r.actualQueries).toEqual(['游戏代练 损失赔偿 法院判决']);expect(r.actualQueries).not.toEqual(r.searchTerms);
  expect(r.relevanceStatus).toBe('not_assessed');expect(r.attempts?.[0].actualQueries).toEqual(r.actualQueries);
  const retry=await researchWeb(i,config,undefined,mock,'zh',{attempt:2,previousResearch:r});
  expect(retry.actualQueries).toEqual(['游戏代练 损失赔偿 法院判决']);expect(JSON.stringify(retry)).not.toContain('三角洲');
 });
 it('screens familiar PII directly without assuming all abstract text is necessarily anonymous',()=>{
  expect(unsafePublicText('email: a@example.org')).toBe(true);expect(unsafePublicText('虚拟资产损失认定')).toBe(false);
 });
});

describe('two attempts and bounded planning lifecycle',()=>{
 it('changes the second search approach, reuses the plan and records both attempts',async()=>{
  const planner=transport(deltaPlan());const search:WebSearchTransport=vi.fn(async()=>searched());
  const first=await researchWeb(delta(),config,undefined,search,'zh',{plannerTransport:planner});
  const second=await researchWeb(delta(),config,undefined,search,'zh',{plannerTransport:planner,attempt:2,previousResearch:first});
  expect(planner).toHaveBeenCalledTimes(1);expect(search).toHaveBeenCalledTimes(2);expect(second.attempts).toHaveLength(2);
  expect(second.attempts?.[1].reason).toBe('no_relevant_comparisons');expect(second.searchTerms).not.toEqual(first.searchTerms);
  expect(vi.mocked(search).mock.calls[1][0].query.strategy).toBe('broader_legal_analogy');
  const third=await researchWeb(delta(),config,undefined,search,'zh',{attempt:2,previousResearch:second});
  expect(third.failureReason).toBe('invalid_output');expect(search).toHaveBeenCalledTimes(2);
 });
 it('retains old explicit search mocks without silently running a paid planner',async()=>{
  const fetchMock=vi.fn(()=>{throw new Error('must not connect');});vi.stubGlobal('fetch',fetchMock);
  const r=await researchWeb(delta(),config,undefined,web);expect(r.planningMode).toBe('structured_fallback');expect(fetchMock).not.toHaveBeenCalled();
 });
 it('does not start planning or searching when cancelled or when the overall deadline expired',async()=>{
  const c=new AbortController();c.abort();const planner=transport(deltaPlan());const search:WebSearchTransport=vi.fn(async()=>searched());
  await expect(researchWeb(delta(),config,c.signal,search,'zh',{plannerTransport:planner})).rejects.toMatchObject({code:'CANCELLED'});
  const r=await researchWeb(delta(),config,undefined,search,'zh',{plannerTransport:planner,deadlineAt:Date.now()-1});
  expect(r.failureReason).toBe('budget_exhausted');expect(planner).not.toHaveBeenCalled();expect(search).not.toHaveBeenCalled();
 });
 it('cancellation interrupts a planner that ignores its signal and prevents late search',async()=>{
  const c=new AbortController();let complete!:(v:unknown)=>void;const planner:ResearchPlannerTransport=vi.fn(()=>new Promise(resolve=>{complete=resolve;}));const search:WebSearchTransport=vi.fn(async()=>searched());
  const task=researchWeb(delta(),config,c.signal,search,'zh',{plannerTransport:planner});const rejected=expect(task).rejects.toMatchObject({code:'CANCELLED'});c.abort();await rejected;
  complete(deltaPlan());await Promise.resolve();expect(search).not.toHaveBeenCalled();
 });
 it('uses a bounded planner timeout and does not start search after planning times out',async()=>{
  vi.useFakeTimers();const planner:ResearchPlannerTransport=vi.fn(()=>new Promise(()=>{}));const search:WebSearchTransport=vi.fn(async()=>searched());
  const task=researchWeb(delta(),config,undefined,search,'zh',{plannerTransport:planner});await vi.advanceTimersByTimeAsync(RESEARCH_PLANNER_TIMEOUT_MS);
  expect(await task).toMatchObject({status:'unavailable',failureReason:'timeout'});expect(search).not.toHaveBeenCalled();
 });
 it('uses the shared deadline rather than restarting a full search budget',async()=>{
  vi.useFakeTimers();const search:WebSearchTransport=vi.fn(()=>new Promise<WebSearchResponse>(()=>{}));
  const task=researchWeb(delta(),config,undefined,search,'zh',{plannerTransport:transport(deltaPlan()),deadlineAt:Date.now()+100});
  await vi.advanceTimersByTimeAsync(100);expect((await task).failureReason).toBe('timeout');expect(search).toHaveBeenCalledTimes(1);
 });
 it('serializes a strict no-tools model request using the configured Sol model with no SDK retries',async()=>{
  let body:Record<string,any>|undefined;const fetchMock=vi.fn(async(_url:unknown,init?:RequestInit)=>{
   body=JSON.parse(String(init?.body));return new Response(JSON.stringify({id:'resp_offline',object:'response',created_at:0,status:'completed',model:config.model,output:[{type:'message',id:'msg_offline',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(deltaPlan()),annotations:[]}]}]}),{status:200,headers:{'content-type':'application/json'}});
  });vi.stubGlobal('fetch',fetchMock);
  expect(zodTextFormat(ModelResearchPlanSchema,'plan').strict).toBe(true);
  await openAIResearchPlannerTransport({input:delta(),config,signal:new AbortController().signal,locale:'zh'});
  expect(body).toMatchObject({model:'gpt-6.1-sol',store:false,tools:[],text:{format:{type:'json_schema',strict:true}}});expect(body).not.toHaveProperty('previous_response_id');expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(SEARCH_INSTRUCTIONS).toContain('Do not add a journalism');
 });
});
