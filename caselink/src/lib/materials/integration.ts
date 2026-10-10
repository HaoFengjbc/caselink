import {type NewCaseInput,type IntakeRecord} from '../contracts';
import {type IntakeQuestion,type IntakeSlot} from '../intake/contracts';
import {MaterialRecordSchema,type MaterialItem,type MaterialRecord,type MaterialResponse} from './contracts';
import {resolveJurisdiction} from '../jurisdiction';

type Draft=NewCaseInput&{intake:IntakeRecord};
const draft=(input:NewCaseInput):Draft=>({...input,intake:input.intake??{version:1,jurisdiction:'unknown',caseKind:'unknown',narrative:input.background.description,goalText:'',disclosureDetails:'',answers:[],facts:[],confirmed:false}});
const slot=(field:MaterialItem['field']):IntakeSlot=>field==='event'||field==='date'?'event':field==='claim'||field==='position'||field==='demand'?'claim':field==='evidence'||field==='missing_evidence'?'evidence':['stage','restriction','prior_action'].includes(field)?'status':'other';
/** Stable non-secret UI key; never used for authorization or external identifiers. */
const questionId=(value:string)=>{let hash=2166136261;for(const c of value)hash=Math.imul(hash^c.charCodeAt(0),16777619);return `dynamic-${(hash>>>0).toString(16).padStart(8,'0').repeat(3).slice(0,20)}`;};
function sync(input:Draft,materials:MaterialRecord):Draft{
 const userFacts=input.intake.facts.filter(f=>!f.materialItemId);
 const facts=[...userFacts,...materials.items.filter(item=>!item.dateReview||item.dateReview.resolution).map(item=>({id:item.id,materialItemId:item.id,text:item.text,summary:item.originalText.slice(0,200),quote:item.sources[0].quote,slot:slot(item.field)}))].slice(0,12);
 return {...input,intake:{...input.intake,materials:MaterialRecordSchema.parse(materials),facts,confirmed:false}};
}
export function applyMaterialCandidate(input:NewCaseInput,result:MaterialResponse,candidateId:string):Draft{
 const selected=result.candidates.find(c=>c.id===candidateId);if(!selected)throw new Error('Select one case before adding its materials.');
 const current=draft(input),old=current.intake.materials;
 const documents=[...(old?.documents??[])];for(const {pages:_pages,...document} of result.documents){const at=documents.findIndex(d=>d.fileId===document.fileId);if(at<0)documents.push(document);else documents[at]=document;}
 if(documents.length>3||documents.reduce((n,d)=>n+d.processedPages.length,0)>30||documents.reduce((n,d)=>n+d.size,0)>3_900_000)throw new Error('One case accepts at most 3 PDFs and 30 physical pages.');
 const items=[...(old?.items??[])];for(const item of selected.items){if(!items.some(i=>i.id===item.id))items.push(item);}
 if(items.length>48)throw new Error('The combined case exceeds 48 extracted items; review the existing materials before adding more.');
 const conflicts=[...(old?.conflicts??[])];for(const conflict of selected.conflicts)if(!conflicts.some(c=>c.id===conflict.id))conflicts.push(conflict);
 // Incremental uploads cannot silently replace contradictory single-valued assertions.
 for(const item of selected.items){if(!['country','jurisdiction','date','stage'].includes(item.field)&&!(item.date&&item.dateKind==='requested_deadline'))continue;
  const prior=old?.items.find(i=>i.field===item.field&&i.subject===item.subject&&i.dateKind===item.dateKind&&(i.date??i.text)!==(item.date??item.text)&&!i.sources.some(s=>item.sources.some(t=>s.fileId===t.fileId)));
  if(prior&&!conflicts.some(c=>c.itemIds.includes(prior.id)&&c.itemIds.includes(item.id)))conflicts.push({id:questionId(prior.id+item.id),description:`${prior.text} / ${item.text}`,itemIds:[prior.id,item.id],resolution:null});
 }
 const prefill=selected.prefill;
 const next:Draft={...current,country:!current.country.trim()||current.country==='unknown'?prefill.country||'unknown':current.country,
  // A document's stage describes its own reporting date, never the user's current stage.
  background:{...current.background,personType:current.background.personType==='unknown'?prefill.personType:current.background.personType},
  intake:{...current.intake,jurisdiction:current.intake.jurisdiction==='unknown'?prefill.jurisdiction:current.intake.jurisdiction,caseKind:current.intake.caseKind==='unknown'?prefill.caseKind:current.intake.caseKind,expression:current.intake.expression&&current.intake.expression!=='unsure'?current.intake.expression:prefill.expression}};
 const prior=items.filter(i=>i.field==='prior_action'&&(!i.dateReview||i.dateReview.resolution));if(next.priorActions.status==='unknown'&&prior.length)next.priorActions={status:'described',description:prior.map(i=>i.text).join('\n').slice(0,800),date:''};
 return sync(next,{version:1,documents,selectedCaseId:old?.selectedCaseId??selected.id,selectedCaseLabel:old?.selectedCaseLabel??selected.label,items,conflicts,missing:[...new Set([...(old?.missing??[]),...selected.missing])].slice(0,8),reviewNeeded:true,goalConfirmed:old?.goalConfirmed??false,disclosureConfirmed:old?.disclosureConfirmed??false,latestConfirmed:false});
}
function invalidateDerived(input:Draft,fields:MaterialItem['field'][]):Draft{
 if(fields.includes('country'))input.country='unknown';
 if(fields.includes('jurisdiction')||fields.includes('country'))input.intake.jurisdiction='unknown';
 if(fields.includes('expression')){input.intake.expression='unsure';input.background={...input.background,activities:['unknown']};}
 if(fields.includes('stage'))input.stage='unknown';
 if(fields.includes('party'))input.background={...input.background,personType:'unknown'};
 if(fields.includes('document_type'))input.intake.caseKind='unknown';
 if(fields.includes('prior_action'))input.priorActions={status:'unknown',description:'',date:''};
 return input;
}
export function removeMaterialFile(input:NewCaseInput,fileId:string):Draft{
 const current=draft(input),old=current.intake.materials;if(!old)return current;
 const items=old.items.map(i=>({...i,sources:i.sources.filter(s=>s.fileId!==fileId)})).filter(i=>i.sources.length);
 const ids=new Set(items.map(i=>i.id));
 const next=sync(current,{...old,documents:old.documents.filter(d=>d.fileId!==fileId),items,conflicts:old.conflicts.filter(c=>c.itemIds.every(id=>ids.has(id))),reviewNeeded:true,latestConfirmed:false});
 // Derived structured values are invalidated if their source is removed, even when a user later edits them.
 // The remaining facts and all explicit user narrative/answers/consents are retained for review.
 const removed=old.items.filter(i=>!ids.has(i.id));
 invalidateDerived(next,removed.map(i=>i.field));
 return next;
}
export function updateMaterialItem(input:NewCaseInput,itemId:string,text:string):Draft{
 const current=draft(input),old=current.intake.materials;if(!old)return current;
 if(!text.trim()||text.length>800)throw new Error('Please enter a note of 1–800 characters or remove the item.');
 const next=sync(current,{...old,reviewNeeded:true,items:old.items.map(i=>i.id===itemId?{...i,text,status:'edited'}:i)});
 const item=old.items.find(i=>i.id===itemId);return item&&item.text!==text?invalidateDerived(next,[item.field]):next;
}
/** Resolve only the review status; a human note never becomes a source quote or an inferred date. */
export function resolveMaterialDateReview(input:NewCaseInput,itemId:string,resolution:'reviewed'|'unknown',note?:string,locale:'zh'|'en'='zh'):Draft{
 const current=draft(input),old=current.intake.materials;if(!old)return current;
 const item=old.items.find(i=>i.id===itemId);if(!item?.dateReview)return current;
 const text=resolution==='unknown'?(locale==='en'?'Date remains unverified; retain it as unknown and check the original before relying on it.':'日期尚未核实，明确保留未知；依赖该日期前须核对原文。'):note?.trim()??'';
 if(!text||text.length>800)throw new Error('Enter a review note of 1–800 characters or explicitly keep the date unknown.');
 const uncertainty=resolution==='unknown'?(locale==='en'?'The user explicitly retained the date as unknown. Do not infer a date from this note.':'用户明确将日期保留为未知，不得从笔记推定日期。'):(locale==='en'?'Date handled through a user review note; the note is not documentary wording or independent verification.':'日期已由用户填写核对说明；该说明不是文件原话或独立核实结论。');
 const next=sync(current,{...old,reviewNeeded:true,items:old.items.map(i=>i.id===itemId?{...i,text,date:null,status:'edited',uncertainty,dateReview:{...i.dateReview!,resolution}}:i)});
 return invalidateDerived(next,[item.field]);
}
export function deleteMaterialItem(input:NewCaseInput,itemId:string):Draft{
 const current=draft(input),old=current.intake.materials;if(!old)return current;
 const next=sync(current,{...old,reviewNeeded:true,items:old.items.filter(i=>i.id!==itemId),conflicts:old.conflicts.filter(c=>!c.itemIds.includes(itemId))});
 const item=old.items.find(i=>i.id===itemId);return item?invalidateDerived(next,[item.field]):next;
}
export function resolveMaterialConflict(input:NewCaseInput,conflictId:string,resolution:string):Draft{
 const current=draft(input),old=current.intake.materials;if(!old)return current;
 return sync(current,{...old,reviewNeeded:true,conflicts:old.conflicts.map(c=>c.id===conflictId?{...c,resolution:resolution.trim()||null}:c)});
}
export const materialQuestionIds={country:questionId('country'),jurisdiction:questionId('jurisdiction'),expression:questionId('expression'),latest:questionId('latest-material-update')};
export function materialQuestions(input:NewCaseInput,locale:'zh'|'en',options:{omitDedicated?:boolean}={}):IntakeQuestion[]{
 const record=input.intake,materials=record?.materials;if(!materials)return [];
 const en=locale==='en',questions:IntakeQuestion[]=[];
 const add=(id:string,title:string,reason:string)=>questions.push({id,title,reason,options:[en?'Not sure':'不清楚',en?'Skip for now':'暂时跳过'],sourceIds:[]});
 if(!options.omitDedicated)for(const item of materials.items.filter(i=>i.dateReview&&!i.dateReview.resolution))add(questionId('date:'+item.id),en?'What date can you verify in this excerpt, or should it remain unknown?':'原文中的这处日期能否核实，或应保留未知？',item.uncertainty??(en?'The model date could not be verified against its quoted source.':'AI 日期未能与引用原文核对。'));
 if(!options.omitDedicated)for(const conflict of materials.conflicts.filter(c=>!c.resolution?.trim()))add(questionId(conflict.id),en?'How should these conflicting accounts be recorded?':'这两处记载不一致，应如何记录？',conflict.description);
 const jur=resolveJurisdiction(input);
 if(input.country==='unknown'||!input.country.trim())add(questionId('country'),en?'Which country and specific jurisdiction is this matter in?':'案件在哪个国家、具体法域？',en?'The materials do not establish the applicable location.':'材料尚不能确定案件地点与具体法域。');
 else if(jur.countryCode==='GB'&&jur.jurisdictionCode==='unknown')add('uk-jurisdiction',en?'Which UK jurisdiction handles the matter?':'本案由英国哪个具体法域处理？',en?'The documents do not identify a UK legal system.':'材料尚未明确英国的具体法系。');
 if(!options.omitDedicated&&!record.goalText.trim()&&input.primaryGoal==='unknown')add('goal-details',en?'What work do you want to complete now?':'你现在希望完成什么工作？',en?'Your present goal must come from you, not from a document.':'本次目标需要你确认，不能由文件推断。');
 if(!options.omitDedicated&&(!record.disclosureDetails.trim()||input.publicity==='unknown'))add('disclosure-details',en?'What may be shared, and with which recipients?':'本次允许分享哪些信息，接收范围是什么？',en?'Past public advocacy is not permission for this work.':'过去公开倡议的记录不代表本次披露授权。');
 if(jur.countryCode&&jur.countryCode!=='GB'&&record.jurisdiction==='unknown')add(materialQuestionIds.jurisdiction,en?'Which specific court, region or legal jurisdiction handles the matter?':'本案由哪个法院、地区或具体法域处理？',en?'The materials name a country but do not establish the specific jurisdiction.':'材料提供了国家，但具体法域尚不明确。');
 if(!record.expression||record.expression==='unsure'){
  questions.push({id:materialQuestionIds.expression,title:en?'Did reporting, speaking, posting or another expression activity trigger this legal matter?':'本案是否因报道、发言、发帖或其他表达活动引发？',reason:en?'The connection is unclear in the supplied material.':'材料中的表达关联尚不清楚，需要核对后再开展完整研究。',options:en?['Yes','No','Not sure']:['是','否','不清楚'],sourceIds:[]});
 }
 if(!materials.latestConfirmed)add(questionId('latest-material-update'),en?'When was the document received, and what has changed since its date?':'文件实际何时收到？材料记载之后有何新进展？',en?'Document dates and historical status do not establish the current situation.':'文件日期与历史状态不能直接当作当前进展；不清楚也可说明。');
 for(const missing of materials.missing){
  // Mandatory controls already cover these topics. Do not ask a model paraphrase again.
  if(/收到|最新|进展|目标|披露|授权|receipt|latest|current status|update|goal|disclosure|consent/i.test(missing))continue;
  if(/国家|法域|辖区|country|jurisdiction/i.test(missing))continue;
  if(/表达关联|expression.*(?:connection|link)/i.test(missing))continue;
  add(questionId('missing:'+missing),missing,en?'A gap identified in the material; you may say not sure or skip.':'材料中尚未明确的具体缺口，可以回答不清楚或暂时跳过。');
 }

 const answered=new Set(record.answers.filter(a=>a.answer.trim()).map(a=>a.questionId));
 return questions.filter(q=>!answered.has(q.id)).slice(0,3);
}
export function materialReviewErrors(input:NewCaseInput,locale:'zh'|'en'='zh'):string[]{
 const record=input.intake,materials=record?.materials;if(!materials)return [];
 const en=locale==='en',errors:string[]=[];
 if(!materials.items.length)errors.push(en?'Add or enter case facts before confirming.':'请先添加或填写案情内容。');
 if(materials.items.some(item=>item.dateReview&&!item.dateReview.resolution))errors.push(en?'Review the flagged dates, explicitly keep them unknown, or delete those items.':'请核对标记的日期，也可明确保留未知或删除该项。');
 if(materials.conflicts.some(c=>!c.resolution?.trim()))errors.push(en?'Record how unresolved conflicting accounts should be handled; “not sure” is allowed.':'请说明尚未处理的冲突如何记录；可以填写“不清楚”。');
 if(!record.goalText.trim()||!materials.goalConfirmed)errors.push(en?'Confirm your current work goal.':'请确认本次希望完成的工作目标。');
 if(!record.disclosureDetails.trim()||input.publicity==='unknown'||!materials.disclosureConfirmed)errors.push(en?'Confirm permitted information and recipients, including an internal-only choice if appropriate.':'请确认本次可分享的信息和接收范围，也可明确选择仅内部使用。');
 return errors;
}
export function confirmMaterials(input:NewCaseInput):Draft{
 const current=draft(input),old=current.intake.materials;if(!old)return {...current,intake:{...current.intake,confirmed:true}};
 const errors=materialReviewErrors(current);if(errors.length)throw new Error(errors.join(' '));
 const next=sync(current,{...old,reviewNeeded:false,goalConfirmed:true,disclosureConfirmed:true,items:old.items.map(i=>i.status==='extracted'?{...i,status:'confirmed'}:i)});
 return {...next,intake:{...next.intake,confirmed:true}};
}

/** Explicit user answers update the same record; documentary quotes are never rewritten. */
export function applyMaterialAnswer(input:NewCaseInput,question:IntakeQuestion,answer:string,locale:'zh'|'en'='zh'):Draft{
 const current=draft(input),old=current.intake.materials;if(!old)return current;
 if(answer.length>800)throw new Error('Answer exceeds 800 characters.');
 const value={questionId:question.id,question:question.title,answer};
 const answers=current.intake.answers.some(a=>a.questionId===question.id)?current.intake.answers.map(a=>a.questionId===question.id?value:a):[...current.intake.answers,value];
 if(answers.length>40)throw new Error('At most 40 follow-up answers are supported.');
 const next:Draft={...current,intake:{...current.intake,answers,confirmed:false,materials:{...old,reviewNeeded:true}}};
 const text=answer.trim(),unknown=/^(not sure|unknown|skip for now|不清楚|暂时跳过)$/i.test(text);
 const dateItem=old.items.find(i=>i.dateReview&&question.id===questionId('date:'+i.id));
 if(dateItem&&text)return resolveMaterialDateReview(next,dateItem.id,unknown?'unknown':'reviewed',text,locale);
 if(question.id===materialQuestionIds.country){next.country=!text||unknown?'unknown':text.slice(0,100);next.intake.jurisdiction='unknown';}
 if(question.id===materialQuestionIds.jurisdiction)next.intake.jurisdiction=!text||unknown?'unknown':text.slice(0,100);
 if(question.id==='uk-jurisdiction')next.intake.jurisdiction=resolveJurisdiction({...next,intake:{...next.intake,jurisdiction:text}}).jurisdictionCode;
 if(question.id===materialQuestionIds.expression){next.intake.expression=/^(yes|是)$/i.test(text)?'yes':/^(no|否)$/i.test(text)?'no':'unsure';next.background={...next.background,activities:next.intake.expression==='no'?[]:next.background.activities};}
 if(question.id===materialQuestionIds.latest)next.intake.materials!.latestConfirmed=!!text;
 return next;
}
