import {describe,it,expect} from 'vitest';
import {DEMO_SCENARIOS} from '../data/demo/fixtures';
import {analyzeInput} from '../src/lib/ai/service';
import {workPackMarkdown} from '../src/components/results/work-pack';
import {resources,followups} from '../src/lib/corpus';

describe('usable internal working document',()=>{
 it('preserves the actual stated goal, disclosure restriction and approximate timeline without inventing file pages',async()=>{
  const input=structuredClone(DEMO_SCENARIOS[2].input);input.keyDates=[{date:'日期待核',event:'收到律师函',approximate:true}];
  const result=await analyzeInput(input,{forceRule:true});const pack=workPackMarkdown(result,input);
  expect(pack).toContain(input.intake!.disclosureDetails);expect(pack).toContain('日期待核');expect(pack).toContain('大概时间；不是法定期限');
  expect(pack).toContain('没有自动发送、联系或公开');expect(pack).toContain('未提供可核实的文件名/页码');
  expect(pack).toContain('给当地律师的核对问题');expect(pack).toContain('候选行动路径及条件对照');
  expect(pack).toContain(result.snapshot!.nextSteps![0].deliverables[0]);
 });
 it('is built from the saved snapshot when source and history catalogs later change',async()=>{
  const input=structuredClone(DEMO_SCENARIOS[0].input);const result=await analyzeInput(input,{forceRule:true});const before=workPackMarkdown(result,input);
  const old=resources[0].name;const previous=followups[0]?.summary;
  try{resources[0].name='Changed current resource';if(followups[0])followups[0].summary='Changed current followup';expect(workPackMarkdown(result,input)).toBe(before);}
  finally{resources[0].name=old;if(followups[0]&&previous!==undefined)followups[0].summary=previous;}
  const legacy={...result,snapshot:undefined};expect(workPackMarkdown(legacy,input)).toContain('不从当前资料补写');
 });
});
