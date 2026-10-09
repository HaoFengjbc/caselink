import { afterEach, describe, expect, it, vi } from 'vitest';
import { postWorkflow } from '../src/components/intake/workflow-request';
import {chargedAttemptCount,mayRetry} from '../src/components/intake/submission-state';
afterEach(()=>vi.unstubAllGlobals());
describe('anonymous session handshake (mock HTTP only)',()=>{
 it('does not exhaust the sole model retry when a prior lease still blocks admission',()=>{
  let attempts=1; // The first model attempt timed out.
  for(const code of ['REQUEST_IN_PROGRESS','CONCURRENCY_LIMIT']){
   attempts=chargedAttemptCount(code,attempts+1);
   expect(attempts).toBe(1);expect(mayRetry({code,retryable:true},attempts)).toBe(true);
  }
  expect(chargedAttemptCount('TIMEOUT',2)).toBe(2);
  expect(chargedAttemptCount('RATE_LIMITED',2)).toBe(2); // Could be a provider rejection.
 });
 it('performs one zero-call bootstrap with exactly the same payload before the real request',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(Response.json({code:'REQUEST_IN_PROGRESS',retryAfterSeconds:0},{status:409})).mockResolvedValueOnce(Response.json({analysisId:'mock-result'}));vi.stubGlobal('fetch',fetch);
  const payload={requestId:'same-request',inputVersion:2,operation:'initial'};
  const response=await postWorkflow('/api/analyze',payload,new AbortController().signal);expect(response.body.analysisId).toBe('mock-result');expect(fetch).toHaveBeenCalledTimes(2);expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
 });
 it.each([['REQUEST_IN_PROGRESS',3],['TIMEOUT',0],['RATE_LIMITED',0]])('does not silently retry %s with delay %s',async(code,delay)=>{
  const fetch=vi.fn().mockResolvedValue(Response.json({code,retryAfterSeconds:delay},{status:503}));vi.stubGlobal('fetch',fetch);await postWorkflow('/api/intake',{},new AbortController().signal);expect(fetch).toHaveBeenCalledOnce();
 });
 it('never loops through repeated handshake errors',async()=>{
  const fetch=vi.fn().mockImplementation(()=>Promise.resolve(Response.json({code:'REQUEST_IN_PROGRESS',retryAfterSeconds:0},{status:409})));vi.stubGlobal('fetch',fetch);await postWorkflow('/api/analyze',{},new AbortController().signal);expect(fetch).toHaveBeenCalledTimes(2);
 });
});
