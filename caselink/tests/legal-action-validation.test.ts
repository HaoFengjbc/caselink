import {describe,it,expect} from 'vitest';
import {DEMO_SCENARIOS} from '../data/demo/fixtures';
import {buildRuleReference} from '../src/lib/retrieval/rules';
import {retrieveCases} from '../src/lib/retrieval/match';
import {contextFor,validateModelOutput} from '../src/lib/evidence/validate';

describe('uncited catalog entries cannot masquerade as applicable action authority',()=>{
 it.each([
  ['hrc-individual-communications','国家或机制资格'],
  ['kz-criminal-procedure-detention','具体法域不匹配'],
  ['iccpr-article-19','具体判断和条款'],
 ])('rejects %s for an England and Wales civil action without a valid basis',(resourceId,message)=>{
  const input=structuredClone(DEMO_SCENARIOS[2].input);const matches=retrieveCases(input);const output=buildRuleReference(input,matches);
  output.actionOptions[0].resourceIds=[resourceId];
  expect(()=>validateModelOutput(output,input,contextFor(matches))).toThrow(message);
 });
 it('does not re-ask a known private disclosure selection',()=>{
  const input=structuredClone(DEMO_SCENARIOS[0].input);
  const output=buildRuleReference(input);
  expect(output.missingInformation.some(text=>/是否.*公开|公开限制.*不清楚/.test(text))).toBe(false);
 });
});
