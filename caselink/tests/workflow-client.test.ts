import {afterEach,describe,expect,it,vi} from 'vitest';
import {postWorkflow} from '../src/components/intake/workflow-request';
import {mayRetry} from '../src/components/intake/submission-state';
afterEach(()=>vi.unstubAllGlobals());
describe('explicit retries without application usage quotas (mock HTTP)',()=>{
 it('continues offering user retries without an attempt-count cutoff',()=>{
  for(let i=0;i<100;i++)expect(mayRetry({code:'TIMEOUT'})).toBe(true);
  expect(mayRetry({code:'INVALID_INPUT',retryable:false})).toBe(false);
 });
 it('sends each user action immediately, preserving its input identity',async()=>{
  const fetch=vi.fn().mockImplementation(()=>Promise.resolve(Response.json({analysisId:'mock-result'})));vi.stubGlobal('fetch',fetch);
  const payload={requestId:'same-request',inputVersion:2,operation:'initial'};
  for(let i=0;i<4;i++)await postWorkflow('/api/analyze',payload,new AbortController().signal);
  expect(fetch).toHaveBeenCalledTimes(4);expect(fetch.mock.calls.every(call=>call[1].body===JSON.stringify(payload))).toBe(true);
 });
 it.each(['REQUEST_IN_PROGRESS','TIMEOUT','RATE_LIMITED'])('never automatically replays %s, including old bootstrap responses',async code=>{
  const fetch=vi.fn().mockImplementation(()=>Promise.resolve(Response.json({code,retryAfterSeconds:0},{status:503})));vi.stubGlobal('fetch',fetch);
  await postWorkflow('/api/intake',{},new AbortController().signal);expect(fetch).toHaveBeenCalledOnce();
 });
});
