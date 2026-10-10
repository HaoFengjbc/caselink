// One explicit paid, fictional smoke request through the real application API.
// This script reads no credentials, uses no cookies and never retries.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv.length!==4||process.argv[3]!=='--run-paid-smoke'){
 console.error('Usage: node scripts/verify-openai-search.mjs http://127.0.0.1:3041 --run-paid-smoke');process.exit(1);
}
const base=new URL(process.argv[2]);
if(base.username||base.password||base.pathname!=='/'||base.search||base.hash||!(base.protocol==='https:'||base.protocol==='http:'&&base.hostname==='127.0.0.1'))throw new Error('Use a root HTTPS URL or a loopback test server.');
const output=path.join(root,'test-results/openai-search-20261010');await mkdir(output,{recursive:true});
const input=JSON.parse(await readFile(path.join(root,'docs/whats-next-2026-10-09/ui-evidence/case-2/ordinary-input.json'),'utf8'));
if(input.isExample||input.exampleId!==null||!input.intake.narrative.includes('陌生虚构案件 V-92'))throw new Error('Expected the specified fictional ordinary input.');
const request={input,requestId:randomUUID(),inputVersion:1,operation:'initial',locale:'zh',preferences:{aiEnabled:true,saveMode:'memory',refreshRecovery:false,expiresAt:null}};
await writeFile(path.join(output,'sample-input.json'),JSON.stringify(input,null,2));
const capability=await fetch(new URL('/api/capabilities',base),{signal:AbortSignal.timeout(10_000)}).then(r=>r.json());
await writeFile(path.join(output,'capabilities.json'),JSON.stringify(capability,null,2));
if(!capability.liveAvailable||!capability.webSearchAvailable||capability.webSearchProvider!=='openai')throw new Error('BLOCKED: expected live OpenAI web-search configuration; no paid request sent.');
const started=Date.now();
const response=await fetch(new URL('/api/analyze',base),{method:'POST',headers:{'content-type':'application/json',origin:base.origin},body:JSON.stringify(request),signal:AbortSignal.timeout(290_000)});
const result=await response.json();await writeFile(path.join(output,'complete-output.json'),JSON.stringify(result,null,2));
const research=result.webResearch;
const passed=response.ok&&result.mode==='live_ai'&&research?.status==='completed'&&research.searchCallCount>0&&research.sources.length>0&&research.sources.every(s=>s.pageOpened===true)&&result.snapshot?.webResearch?.status==='completed';
const evidence={checkedAt:new Date().toISOString(),target:base.origin,fixture:'V-92 fictional ordinary manual input, no exampleId',status:passed?'passed':'failed',httpStatus:response.status,elapsedMs:Date.now()-started,mode:result.mode??null,promptVersion:result.promptVersion??null,errorCode:result.code??null,searchStatus:research?.status??null,failureReason:research?.failureReason??null,actualQueries:research?.actualQueries??[],searchCalls:research?.searchCallCount??0,sources:research?.sources??[],comparisonCount:result.webComparisons?.length??0,documentCount:result.whatsNext?.documents?.length??0,execution:result.execution??null,actualCostUsd:null,notes:['Provider response IDs and token/tool counts are measured; no price or bill was queried.','pageOpened means the tool opened the cited URL, not verified accuracy or complete reading.','No production deployment is performed by this script.']};
await writeFile(path.join(output,'real-call-evidence.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
if(!passed)process.exitCode=1;
