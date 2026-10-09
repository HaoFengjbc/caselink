import {afterEach,describe,it,expect,vi} from 'vitest';
import {EMPTY_INPUT,NewCaseInputSchema,type NewCaseInput} from '../src/lib/contracts';
import {IntakeResponseSchema,IntakeRecordSchema,type ModelIntakeQuestion} from '../src/lib/intake/contracts';
import {analyzeIntake,buildIntakePromptData,validateIntakeOutput,INTAKE_SYSTEM_PROMPT} from '../src/lib/intake/service';
import {dynamicQuestionId,isRepeatedQuestion} from '../src/lib/intake/question-validation';
import {changeIntake,confirmableIntake,mergeIntakeFacts,withIntake} from '../src/components/intake/adaptive-state';
import {saveInput,readSession,clearSession} from '../src/lib/session';
const text='我找人代练三角洲行动，发现对方开挂后账号被封。我付了代练费，平台发过封禁通知。';
const goal='代练的人赔偿我的账号损失';
const draft=():NewCaseInput=>({...structuredClone(EMPTY_INPUT),country:'中国',intake:{version:1,jurisdiction:'unknown',caseKind:'civil',narrative:text,goalText:goal,disclosureDetails:'',answers:[],facts:[],confirmed:false}});
const question=():ModelIntakeQuestion=>({title:'代练前双方约定了哪些服务内容和账号使用方式？',reason:'你提到找人代练并支付费用，需要了解代练时双方已有的约定。',options:['有书面或聊天约定','只有口头约定','不清楚'],anchorQuote:'我找人代练三角洲行动'});
const output=(questions:ModelIntakeQuestion[]=[question()])=>({facts:[{quote:'平台发过封禁通知。'}],questions});
const config={mode:'live' as const,key:'unused-local-test',model:'local-test',timeoutMs:1000};
afterEach(()=>{clearSession();vi.unstubAllGlobals();});

describe('stated goals do not require a second opt-in',()=>{
 it('promotes a free goal and clears it to unknown without modifying the story or disclosure',()=>{
  const original=withIntake(draft());const changed=changeIntake(original,{goalText:goal});expect(changed.primaryGoal).toBe('other');expect(changed.intake.narrative).toBe(text);expect(changed.publicity).toBe('unknown');expect(changeIntake(changed,{goalText:' '}).primaryGoal).toBe('unknown');expect(original.primaryGoal).toBe('unknown');
 });
 it('migrates legacy unknown with a goal on confirmation but respects an explicit preset',()=>{
  expect(confirmableIntake(draft()).primaryGoal).toBe('other');expect(confirmableIntake({...draft(),primaryGoal:'lawyer'}).primaryGoal).toBe('lawyer');expect(changeIntake({...draft(),primaryGoal:'lawyer'},{narrative:'New account'}).primaryGoal).toBe('lawyer');
 });
 it('retains human edits and IDs on re-extraction without silently removing earlier notes',()=>{
  const previous=[{id:'fact-1',quote:'平台发过封禁通知。',text:'用户说收到通知（人工改写）'}];
  const merged=mergeIntakeFacts(previous,[{id:'fact-1',quote:'平台发过封禁通知。',text:'平台发过封禁通知。'},{id:'fact-1',quote:'我付了代练费',text:'我付了代练费'}]);expect(merged[0]).toEqual(previous[0]);expect(merged).toHaveLength(2);expect(new Set(merged.map(f=>f.id)).size).toBe(2);
 });
});
describe('real contextual question contract',()=>{
 it('accepts factual questions about the actual game-service dispute with server-owned stable IDs',()=>{
  const input=draft();const before=structuredClone(input);const first=validateIntakeOutput(output(),input,'zh','local-test');const second=validateIntakeOutput(output(),input,'zh','local-test');expect(first.questions).toHaveLength(1);expect(first.questions[0].title).toBe(question().title);expect(first.questions[0].id).toMatch(/^dynamic-[a-f0-9]{20}$/);expect(second.questions[0].id).toBe(first.questions[0].id);expect(first.questions[0].sourceIds).toEqual([]);expect(first.facts[0].text).toBe(first.facts[0].quote);expect(input).toEqual(before);expect(JSON.stringify(first)).not.toMatch(/拘押|保释|撤诉|联合国/);
 });
 it('allows a question to anchor the stated goal but never treats a goal as an event fact',()=>{
  const q={title:'账号损失目前包括哪些项目，有没有可以说明损失的记录？',reason:'你希望赔偿账号损失，需要先知道你所说的损失具体指什么。',options:[],anchorQuote:goal};
  expect(validateIntakeOutput(output([q]),draft(),'zh','local-test').questions).toHaveLength(1);
  expect(()=>validateIntakeOutput({facts:[{quote:goal}],questions:[]},draft(),'zh','local-test')).toThrow();
 });
 it('filters unsupported anchors, unrelated criminal questions, secret requests, advice and duplicate questions',()=>{
  const attempts=[{...question(),anchorQuote:'根本没有说过这句话'}, {...question(),title:'你被拘押后是否申请保释？'}, {...question(),title:'请填写代练账号密码是什么？'}, {...question(),title:'你应当在3天内起诉代练，对吗？'},{...question(),title:'代练的行为已经构成违约，你是否同意？'},{...question(),title:'你收到的私人联系方式是什么？',reason:'请联系https://unverified.example'}];
  for(const q of attempts)expect(validateIntakeOutput(output([q]),draft(),'zh','local-test').questions,q.title).toEqual([]);
  expect(validateIntakeOutput(output([question(),question()]),draft(),'zh','local-test').questions).toHaveLength(1);
 });
 it('does not repeat saved questions, including unknown answers, and preserves dynamic answers in prompt/schema/session',()=>{
  const storage=new Map<string,string>();vi.stubGlobal('window',{sessionStorage:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)},dispatchEvent:vi.fn()});
  const input=draft();input.intake!.answers=[{questionId:dynamicQuestionId(question().title),question:question().title,answer:'不清楚',anchorQuote:question().anchorQuote}];
  expect(validateIntakeOutput(output(),input,'zh','local-test').questions).toEqual([]);expect(isRepeatedQuestion(question().title+'？',[question().title])).toBe(true);
  const parsed=NewCaseInputSchema.parse(input);expect(IntakeRecordSchema.parse(parsed.intake).answers).toEqual(input.intake!.answers);const data=JSON.parse(buildIntakePromptData(input,'zh'));expect(data.userProvidedCase.answers[0].question).toBe(question().title);expect(data.userProvidedCase.narrative).toBe(text);expect(data.userProvidedCase.goalText).toBe(goal);expect(INTAKE_SYSTEM_PROMPT).toContain('Read the COMPLETE narrative');saveInput(input);expect(readSession().input?.intake?.answers).toEqual(input.intake!.answers);clearSession();
 });
 it('does not treat an empty answer draft as information already supplied',()=>{
  const input=draft();input.intake!.answers=[{questionId:dynamicQuestionId(question().title),question:question().title,answer:' '}];expect(validateIntakeOutput(output(),input,'zh','local-test').questions).toHaveLength(1);
 });
 it('inserts the reviewed UK question while keeping all questions bounded and legacy views valid',()=>{
  const input=draft();input.country='UK';const result=validateIntakeOutput(output([question(),{...question(),title:'代练付款有哪些记录可以核对？'},{...question(),title:'平台封禁通知写明了哪些具体事项？'}]),input,'zh','local-test');expect(result.questions[0].id).toBe('uk-jurisdiction');expect(result.questions.length).toBeLessThanOrEqual(3);expect(result.sources[0].url).toContain('judiciary.uk');expect(IntakeResponseSchema.parse({...result,questions:[{id:'latest-document',title:'旧问题',reason:'原有说明',options:[],sourceIds:[]}]}).questions[0].id).toBe('latest-document');
 });
 it('uses manual neutral questions with no model request when only the region has been entered',async()=>{
  const input=draft();input.intake!.narrative='';const transport=vi.fn();const result=await analyzeIntake(input,{locale:'zh',config,transport});expect(result.mode).toBe('manual');expect(transport).not.toHaveBeenCalled();expect(JSON.stringify(result)).not.toMatch(/拘押|保释|撤诉/);
 });
});
