import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {evidence} from '../src/lib/corpus';

const root=fileURLToPath(new URL('../',import.meta.url));
const script=path.join(root,'scripts/verify-live-ai.mjs');
const deploymentScript=path.join(root,'scripts/verify-live-deployment.mjs');
// Deny any fetch, writes or reads outside the exact fixture/evidence files in this child process.
const guard=`import fs from 'node:fs/promises';
const allowed=new Set(${JSON.stringify(['src/lib/whats-next-contracts.ts','src/lib/materials/contracts.ts','src/lib/legal-contracts.ts','src/lib/workflow-contracts.ts','src/lib/contracts.ts','src/lib/intake/contracts.ts','src/lib/research/contracts.ts','src/lib/research/plan.ts','data/demo/fixtures.ts','data/evidence/evidence.json'].map(file=>path.join(root,file)))});
const originalRead=fs.readFile.bind(fs);
fs.readFile=async(file,...args)=>{if(!allowed.has(String(file)))throw new Error('Unexpected input read');return originalRead(file,...args);};
fs.writeFile=async()=>{throw new Error('Unexpected write');};
globalThis.fetch=async()=>{process.exitCode=1;throw new Error('Network prohibited');};`;
const preload=`data:text/javascript;base64,${Buffer.from(guard).toString('base64')}`;
const run=(args:string[],target=script)=>spawnSync(process.execPath,['--import',preload,target,...args],{cwd:root,encoding:'utf8',env:{NODE_ENV:'test',NODE_NO_WARNINGS:'1'},timeout:15000});

describe('offline live-smoke input checker',()=>{
  it.each([script,deploymentScript])('loads intake and research-plan schema dependencies offline in %s',target=>{
    const result=run(['--check-inputs'],target);expect(result.status,result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({status:'inputs_valid',counts:{fixtures:3,evidence:evidence.length,networkRequests:0,analysisRequests:0}});
  });
  it('still refuses a remote target without an explicit paid-smoke opt-in',()=>{
    const result=run(['https://caselink-eight.vercel.app']);expect(result.status).toBe(1);expect(result.stderr).toContain('EXPLICIT_OPT_IN_REQUIRED');
  });
  it('uses a 290-second analysis deadline and does not retry a mocked quota error',()=>{
    const mock=`${guard}
const deadlines=[]; let analysisRequests=0;
AbortSignal.timeout=(milliseconds)=>{deadlines.push(milliseconds);return new AbortController().signal;};
globalThis.fetch=async(url,options)=>{
  if(options.credentials!=='omit'||options.redirect!=='manual')throw new Error('Unexpected request policy');
  const headers={'cache-control':'no-store','content-type':'application/json'};
  if(url.pathname==='/api/capabilities')return new Response(JSON.stringify({mode:'live',configured:true,liveAvailable:true,accessRequired:false}),{headers});
  if(url.pathname!=='/api/analyze'||options.method!=='POST')throw new Error('Unexpected request');
  analysisRequests++;
  if(!JSON.parse(options.body).input.isExample)throw new Error('Non-example input');
  return new Response(JSON.stringify({code:'QUOTA_EXHAUSTED'}),{status:429,headers});
};
fs.mkdir=async()=>{};
fs.writeFile=async()=>{console.log(JSON.stringify({mockOnly:true,deadlines,analysisRequests}));};`;
    const result=spawnSync(process.execPath,['--import',`data:text/javascript;base64,${Buffer.from(mock).toString('base64')}`,script,'https://caselink-eight.vercel.app','--run-paid-smoke'],{cwd:root,encoding:'utf8',env:{NODE_ENV:'test',NODE_NO_WARNINGS:'1'},timeout:15000});
    expect(result.status,result.stderr).toBe(1);
    expect(result.stderr).toContain('QUOTA_EXHAUSTED');
    const summary=result.stdout.split('\n').find(line=>line.startsWith('{"mockOnly":'));
    expect(JSON.parse(summary??'null')).toEqual({mockOnly:true,deadlines:[15000,290000],analysisRequests:1});
  });
});
