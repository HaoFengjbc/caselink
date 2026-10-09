import {createHash} from 'node:crypto';
import type {NewCaseInput} from '../contracts';
import type {IntakeQuestion,ModelIntakeQuestion} from './contracts';

const normalized=(text:string)=>text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const words=(text:string):Set<string>=>{
 const all=new Set((text.toLocaleLowerCase().match(/[a-z]{4,}/g)??[]).filter(word=>!['what','which','when','where','have','does','this','that','your','with','from','there','please','could','would','about','been'].includes(word)));
 for(const run of text.match(/[\p{Script=Han}]+/gu)??[])for(let i=0;i<run.length-1;i++)all.add(run.slice(i,i+2));
 return all;
};
function similarity(a:string,b:string):number{
 const left=words(a),right=words(b);if(!left.size||!right.size)return normalized(a)===normalized(b)?1:0;
 const common=[...left].filter(word=>right.has(word)).length;
 return 2*common/(left.size+right.size);
}
export function dynamicQuestionId(title:string):string{return `dynamic-${createHash('sha256').update(normalized(title)).digest('hex').slice(0,20)}`;}
export function isRepeatedQuestion(title:string,existing:readonly string[]):boolean{
 const clean=normalized(title);
 return existing.some(prior=>normalized(prior)===clean||similarity(title,prior)>=0.72);
}
const unsafe=/(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,})|(?:账号密码|登录密码|支付密码|银行卡号|身份证号|证件号码|验证码|私钥|手机号码|电话号码|真实姓名|完整住址|api\s*key|password|passcode|one[- ]time code|otp\b|private key|credit card number|social security number|full (?:name|address)|phone number|login details)|(?:忽略.{0,8}(?:规则|指令)|系统提示词|ignore.{0,20}instructions|system prompt)|(?:你(?:应当|应该|必须|可以立即)|建议你|立即(?:联系|起诉|上诉|报警|提交)|(?:构成|属于).{0,8}(?:违法|犯罪|侵权|违约|欺诈)|(?:法定|必须|最迟|应在).{0,16}\d+\s*(?:天|日|小时|周|个月)|(?:应当|应该|必须).{0,5}(?:赔偿|起诉|上诉|支付)|you (?:must|should)|you (?:can|need to) (?:file|sue|appeal|report|submit)|legally (?:liable|required)|statutory deadline|within \d+ (?:days?|weeks?|months?))/i;
// Do not introduce detention, criminal procedure or medical matters into an unrelated account.
const sensitiveTopics=[/拘押|拘留|逮捕|保释|detain|arrest|bail/i,/刑事指控|刑事起诉|criminal charges?|criminal prosecution/i,/酷刑|torture/i,/精神病|精神科|psychiatri/i];

/** A model restatement of an excerpt must not add advice, legal conclusions, secrets or a sensitive topic absent from the account. */
export function unsupportedSummary(summary:string,material:string):boolean{
 return unsafe.test(summary)||sensitiveTopics.some(pattern=>pattern.test(summary)&&!pattern.test(material));
}

/** A bounded factual question is supported by original words, never by an edited fact note.
 * Relevance/duplicate checks are conservative heuristics, not a legal or semantic verdict.
 */
export function contextualQuestions(proposed:ModelIntakeQuestion[],input:NewCaseInput):IntakeQuestion[]{
 const record=input.intake;if(!record)return [];
 const material=[record.narrative,...record.answers.map(answer=>answer.answer),record.goalText,record.disclosureDetails];
 const full=material.join('\n');
 const answered=record.answers.filter(answer=>answer.answer.trim());
 const prior=answered.map(answer=>answer.question);
 const selected:IntakeQuestion[]=[];
 for(const q of proposed){
  const text=[q.title,q.reason,...q.options].join('\n');
  if(!q.anchorQuote.trim()||!material.some(value=>value.includes(q.anchorQuote))||unsafe.test(text))continue;
  if(!/[?？]/.test(q.title)&&!/(?:哪些|什么|是否|如何|多少|何时|怎样|有无|what|which|when|where|how|did |does |is |are |was |were |has |have |can you)/i.test(q.title))continue;
  if(sensitiveTopics.some(pattern=>pattern.test(text)&&!pattern.test(full)))continue;
  // The explanation must name something in its anchor, rather than attaching an unrelated quote.
  const anchorWords=words(q.anchorQuote);const explained=words(`${q.title} ${q.reason}`);
  if(anchorWords.size&&![...anchorWords].some(word=>explained.has(word)))continue;
  const id=dynamicQuestionId(q.title);
  if(answered.some(answer=>answer.questionId===id)||isRepeatedQuestion(q.title,[...prior,...selected.map(item=>item.title)]))continue;
  selected.push({id,title:q.title,reason:q.reason,options:[...new Set(q.options)],anchorQuote:q.anchorQuote,sourceIds:[]});
 }
 return selected.slice(0,Math.max(0,Math.min(3,40-record.answers.length)));
}
