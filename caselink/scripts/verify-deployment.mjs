import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { randomUUID } from 'node:crypto';

// Anonymous HTTP checks only. Never load credentials or follow a login redirect.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const modules=new Map();
async function fixtureModule(relative){
  const filename=path.join(root,relative);
  if(modules.has(filename))return modules.get(filename);
  const source=await fs.readFile(filename,'utf8');
  let output=stripTypeScriptTypes(source,{mode:'strip'});
  if(relative==='src/lib/contracts.ts')output=output.replace("import { z } from 'zod';",`import zod from ${JSON.stringify(pathToFileURL(require.resolve('zod')).href)}; const { z } = zod;`);
  else if(relative==='data/demo/fixtures.ts'){
    const contracts=await fixtureModule('src/lib/contracts.ts');
    output=output.replace(/import\s*\{[^}]*\}\s*from\s*['"]\.\.\/\.\.\/src\/lib\/contracts['"];?/,`const EMPTY_INPUT = ${JSON.stringify(contracts.EMPTY_INPUT)};`);
  }else throw new Error('Unexpected fixture module');
  const result=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
  modules.set(filename,result);return result;
}

const {DEMO_SCENARIOS}=await fixtureModule('data/demo/fixtures.ts');
if(process.argv.includes('--check-fixtures')){
  console.log(JSON.stringify({fixtureCount:DEMO_SCENARIOS.length,exampleIds:DEMO_SCENARIOS.map(s=>s.input.exampleId)}));
  process.exit(0);
}
const target=process.argv[2];
if(!target)throw new Error('Usage: node scripts/verify-deployment.mjs https://your-production-alias');
const base=new URL(target);
if(!['https:','http:'].includes(base.protocol)||base.username||base.password)throw new Error('Provide an HTTP(S) URL without credentials.');
const origin=base.origin;
const checks=[];
async function check(name,operation){
  try{const details=await operation();checks.push({name,passed:true,...details});console.log(`PASS ${name}`);}
  catch(error){checks.push({name,passed:false,error:error instanceof Error?error.message:String(error)});console.log(`FAIL ${name}: ${error instanceof Error?error.message:String(error)}`);}
}
function assert(condition,message){if(!condition)throw new Error(message);}
async function request(route,options={}){
  return fetch(new URL(route,origin),{...options,redirect:'manual',signal:AbortSignal.timeout(30000)});
}
function noStore(response){assert(response.headers.get('cache-control')?.includes('no-store'),'Missing Cache-Control: no-store');}
async function json(response){try{return await response.json();}catch{throw new Error(`Expected JSON; HTTP ${response.status}, redirect=${response.headers.get('location')||'none'}`);}}
function post(input,extra={}){return request('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'Sec-Fetch-Site':'same-origin',...extra},body:JSON.stringify({input,requestId:randomUUID()})});}
let capabilities;
await check('anonymous capabilities: demo, no secrets',async()=>{
  const response=await request('/api/capabilities');assert(response.status===200,`HTTP ${response.status}; location=${response.headers.get('location')||'none'}`);noStore(response);
  capabilities=await json(response);
  const allowed=['mode','configured','liveAvailable','accessRequired'];
  assert(Object.keys(capabilities).every(k=>allowed.includes(k)),'Capabilities exposed unexpected fields');
  assert(capabilities.mode==='demo'&&capabilities.liveAvailable===false&&capabilities.accessRequired===false,'Deployment is not anonymous demo mode');
  assert(typeof capabilities.configured==='boolean','Invalid configured flag');
  return {status:response.status,capabilities};
});

if(capabilities?.mode==='demo'&&capabilities.liveAvailable===false){
  const input=structuredClone(DEMO_SCENARIOS[0].input);
  let originalHash;
  await check('exact fictional scenario: preset_demo',async()=>{
    const response=await post(input);if(response.status!==200)throw new Error(`HTTP ${response.status}: ${JSON.stringify(await json(response))}`);noStore(response);const result=await json(response);
    assert(result.mode==='preset_demo','Expected preset_demo');assert(result.actionOptions?.length>0&&result.actionOptions.length<=3,'Missing detailed actions');
    assert(result.sources?.length>0,'Missing evidence sources');assert(typeof result.inputHash==='string','Missing input identity');
    originalHash=result.inputHash;return {status:response.status,mode:result.mode,caseCount:result.comparableCases.length,actionCount:result.actionOptions.length,sourceCount:result.sources.length};
  });
  await check('edited fictional scenario: rule_reference',async()=>{
    const response=await post({...input,publicity:'public'});assert(response.status===200,`HTTP ${response.status}`);noStore(response);const result=await json(response);
    assert(result.mode==='rule_reference','Edited input reused a preset');assert(!originalHash||result.inputHash!==originalHash,'Edited input reused original hash');
    return {status:response.status,mode:result.mode,actionCount:result.actionOptions.length};
  });
  await check('foreign Origin rejected',async()=>{
    const response=await post(input,{Origin:'https://untrusted.example','Sec-Fetch-Site':'cross-site'});noStore(response);const result=await json(response);
    assert(response.status===403&&result.code==='FORBIDDEN','Cross-origin request was not rejected');assert(typeof result.requestId==='string','Missing error request ID');return {status:response.status,code:result.code};
  });
  await check('invalid empty input rejected without caching',async()=>{
    const response=await post({});noStore(response);const result=await json(response);
    assert(response.status===400&&result.code==='INVALID_INPUT','Empty input was not rejected');assert(typeof result.requestId==='string','Missing error request ID');return {status:response.status,code:result.code};
  });
}else{
  checks.push({name:'analysis requests',passed:false,error:'Skipped: demo mode was not confirmed. No model call was attempted.'});
}

await Promise.all(['aigul-utepova','emna-chargui','myriam-bribri'].map(caseId=>check(`anonymous case detail: ${caseId}`,async()=>{
  const response=await request(`/cases/${caseId}`);assert(response.status===200,`HTTP ${response.status}; location=${response.headers.get('location')||'none'}`);
  assert(!response.headers.get('location'),'Unexpected redirect');const html=await response.text();
  assert(html.includes('CaseLink'),'Missing CaseLink page');assert(!html.includes('Log in to Vercel')&&!html.includes('Authentication Required'),'Deployment protection page returned');
  const expected={'aigul-utepova':'Aigul Utepova','emna-chargui':'Emna Chargui','myriam-bribri':'Myriam Bribri'}[caseId];assert(html.includes(expected),'Missing expected case');
  return {status:response.status};
})));

const report={baseUrl:origin,checkedAt:new Date().toISOString(),anonymous:true,browserUsed:false,modelCallsAttempted:false,passed:checks.every(c=>c.passed),checks};
const output=path.join(root,'test-results','deployment-http.json');await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,passedChecks:checks.filter(c=>c.passed).length,totalChecks:checks.length,report:output}));
if(!report.passed)process.exitCode=1;
