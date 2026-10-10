import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { randomUUID } from 'node:crypto';

// Free release checks only. No credentials, cookies, SDK or automatic retries.
// Every analysis POST explicitly sets forceRule=true, including invalid input
// and cross-site probes. Valid anonymous live requests now invoke paid AI.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const modules = new Map();
const moduleUrls = new Map();
const fixtureAllowlist=new Set(['src/lib/legal-contracts.ts','src/lib/workflow-contracts.ts','src/lib/contracts.ts','src/lib/intake/contracts.ts','src/lib/research/contracts.ts','src/lib/research/plan.ts','data/demo/fixtures.ts']);
async function fixtureModule(relative) {
  if(!fixtureAllowlist.has(relative))throw new Error('LOCAL_INPUT_ERROR');
  if (modules.has(relative)) return modules.get(relative);
  let source = stripTypeScriptTypes(await fs.readFile(path.join(root, relative), 'utf8'), { mode: 'strip' });
  if(relative.endsWith('contracts.ts') || relative==='src/lib/research/plan.ts') {
    source=source.replace(/import\s*\{\s*z\s*\}\s*from\s*['"]zod['"];?/,`import zod from ${JSON.stringify(pathToFileURL(require.resolve('zod')).href)}; const {z}=zod;`);
    if(relative==='src/lib/contracts.ts'||relative==='src/lib/intake/contracts.ts') {
      await fixtureModule('src/lib/workflow-contracts.ts');
      const dependency=moduleUrls.get('src/lib/workflow-contracts.ts');
      source=source.replace(/\bfrom\s*['"]\.\.?\/workflow-contracts['"]/g,`from ${JSON.stringify(dependency)}`);
    }
    if(relative==='src/lib/contracts.ts'){
      await fixtureModule('src/lib/legal-contracts.ts');
      source=source.replace(/\bfrom\s*['"]\.\/legal-contracts['"]/g,`from ${JSON.stringify(moduleUrls.get('src/lib/legal-contracts.ts'))}`);
    }
    if(relative==='src/lib/contracts.ts')for(const kind of ['intake','research']){
      const dependency=`src/lib/${kind}/contracts.ts`;await fixtureModule(dependency);
      source=source.replace(new RegExp(`from\\s*['"]\\.\\/${kind}\\/contracts['"]`,'g'),`from ${JSON.stringify(moduleUrls.get(dependency))}`);
    }
    if(relative==='src/lib/research/contracts.ts'){
      await fixtureModule('src/lib/research/plan.ts');
      source=source.replace(/\bfrom\s*['"]\.\/plan['"]/g,`from ${JSON.stringify(moduleUrls.get('src/lib/research/plan.ts'))}`);
    }
  } else {
    const contracts=await fixtureModule('src/lib/contracts.ts');
    source=source.replace(/import\s*\{[^}]*\}\s*from\s*['"]\.\.\/\.\.\/src\/lib\/contracts['"];?/,`const EMPTY_INPUT=${JSON.stringify(contracts.EMPTY_INPUT)};`);
  }
  const url=`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const result=await import(url);moduleUrls.set(relative,url);modules.set(relative,result);return result;
}
function assert(value, code) { if (!value) throw new Error(code); }

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.length === 1 && args[0] === '--check-inputs';
  assert(checkOnly || (args.length === 1 && !args[0].startsWith('--')), 'USAGE: node scripts/verify-live-deployment.mjs https://production-domain OR --check-inputs');
  const base = checkOnly ? null : new URL(args[0]);
  assert(checkOnly || (base.protocol === 'https:' && !base.username && !base.password && !base.port && base.pathname === '/' && !base.search && !base.hash), 'INVALID_HTTPS_ORIGIN');
  const origin = base?.origin;
  const { DEMO_SCENARIOS } = await fixtureModule('data/demo/fixtures.ts');
  const contracts = await fixtureModule('src/lib/contracts.ts');
  const input = contracts.NewCaseInputSchema.parse(DEMO_SCENARIOS[0].input);
  assert(input.isExample, 'EXAMPLE_INPUT_REQUIRED');
  const evidence = contracts.EvidenceSchema.array().parse(JSON.parse(await fs.readFile(path.join(root, 'data/evidence/evidence.json'), 'utf8')));
  const evidenceIds = new Set(evidence.map(item => item.evidenceId));
  if (checkOnly) {
    for (const scenario of DEMO_SCENARIOS) {
      const parsed = contracts.NewCaseInputSchema.parse(scenario.input);
      assert(parsed.isExample && parsed.exampleId === scenario.id, 'EXAMPLE_INPUT_REQUIRED');
    }
    assert(evidence.length > 0 && evidenceIds.size === evidence.length, 'INVALID_LOCAL_EVIDENCE');
    console.log(JSON.stringify({ status: 'inputs_valid', counts: { fixtures: DEMO_SCENARIOS.length, evidence: evidenceIds.size, networkRequests: 0, analysisRequests: 0 } }));
    return;
  }
  const checks = [];
  const started = performance.now();
  async function request(route, options = {}) {
    return fetch(new URL(route, origin), { ...options, redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(30000) });
  }
  async function bodyOf(response) {
    assert(response.status < 300 || response.status >= 400, 'UNEXPECTED_REDIRECT');
    assert(response.headers.get('cache-control')?.toLowerCase().includes('no-store'), 'MISSING_NO_STORE');
    try { return await response.json(); } catch { throw new Error('INVALID_JSON'); }
  }
  async function check(name, operation) {
    const start = performance.now();
    try {
      const details = await operation();
      checks.push({ name, status: 'passed', latencyMs: Math.round(performance.now() - start), ...details });
      console.log(`PASS ${name}`);
      return true;
    } catch (error) {
      const raw = error instanceof Error ? error.message : '';
      const code = /^[A-Z][A-Z0-9_]{1,80}$/.test(raw) ? raw : error?.name === 'TimeoutError' ? 'TIMEOUT' : 'CHECK_FAILED';
      checks.push({ name, status: 'failed', latencyMs: Math.round(performance.now() - start), errorCode: code });
      console.log(`FAIL ${name}: ${code}`);
      return false;
    }
  }
  function post(ruleInput = input, headers = {}) {
    return request('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Sec-Fetch-Site': 'same-origin', ...headers }, body: JSON.stringify({ input: ruleInput, requestId: randomUUID(), inputVersion: 1, operation: 'initial', forceRule: true }) });
  }
  let capabilities = null;
  await check('capabilities_and_rule_availability', async () => {
    const response = await request('/api/capabilities');
    assert(response.status === 200, 'CAPABILITIES_HTTP_ERROR');
    const body = await bodyOf(response);
    const allowed = ['mode', 'configured', 'liveAvailable', 'accessRequired', 'paidProtectionEnabled', 'controlledSearchConfigured', 'webSearchAvailable', 'ruleAvailable', 'serverResultRetentionSeconds', 'idempotencyEnabled', 'progressEvents', 'configurationNotice'];
    assert(body && typeof body === 'object' && Object.keys(body).every(key => allowed.includes(key)), 'UNEXPECTED_CAPABILITIES_FIELDS');
    assert(body.ruleAvailable === true && body.accessRequired === false && typeof body.liveAvailable === 'boolean', 'RULE_UNAVAILABLE_OR_PASSWORD_REQUIRED');
    assert(!body.liveAvailable || (body.mode === 'live' && body.configured), 'LIVE_WITHOUT_MODEL_CONFIGURATION');
    assert(!body.webSearchAvailable || (body.liveAvailable && body.controlledSearchConfigured), 'WEB_WITHOUT_SEARCH_CONTROL');
    assert(body.paidProtectionEnabled === false && body.serverResultRetentionSeconds === 0 && body.idempotencyEnabled === false, 'UNEXPECTED_PAID_ADMISSION_OR_CACHE');
    capabilities = body;
    return { httpStatus: response.status, capabilities: body };
  });
    await check('invalid_input_rejected', async () => {
      const response = await post({});
      const body = await bodyOf(response);
      assert(response.status === 400 && body.code === 'INVALID_INPUT', 'INVALID_INPUT_NOT_REJECTED');
      assert(typeof body.requestId === 'string' && !('mode' in body), 'INVALID_VALIDATION_ERROR');
      return { httpStatus: response.status, errorCode: body.code };
    });
    for (const scenario of DEMO_SCENARIOS) await check(`explicit_force_rule_${scenario.id}`, async () => {
      const response = await post(scenario.input);
      assert(response.status === 200, 'RULE_HTTP_ERROR');
      const body = await bodyOf(response);
      const parsed = contracts.AnalysisResultSchema.safeParse(body);
      assert(parsed.success && parsed.data.mode === 'rule_reference', 'RULE_MODE_OR_SCHEMA_ERROR');
      assert(parsed.data.actionOptions.length > 0 && parsed.data.sources.length > 0, 'RULE_CONTENT_MISSING');
      assert(parsed.data.sources.every(source => evidenceIds.has(source.evidenceId)), 'UNKNOWN_EVIDENCE_REFERENCE');
      assert(parsed.data.promptVersion === contracts.PROMPT_VERSION && parsed.data.corpusVersion === contracts.CORPUS_VERSION, 'RELEASE_VERSION_MISMATCH');
      assert(parsed.data.snapshot?.completeness === 'complete' && parsed.data.snapshot.corpusVersion === parsed.data.corpusVersion, 'SNAPSHOT_MISSING');
      assert(parsed.data.domain?.status === 'in_scope', 'EXPRESSION_DOMAIN_MISMATCH');
      return { httpStatus: response.status, mode: parsed.data.mode, counts: { actions: parsed.data.actionOptions.length, cases: parsed.data.comparableCases.length, sources: parsed.data.sources.length } };
    });
    await check('cross_site_analysis_rejected', async () => {
      // forceRule=true ensures this probe cannot request a model even if the
      // origin policy regresses. The same route-level guard protects live calls.
      const response = await post(input, { Origin: 'https://untrusted.example', 'Sec-Fetch-Site': 'cross-site' });
      const body = await bodyOf(response);
      assert(response.status === 403 && body.code === 'FORBIDDEN', 'CROSS_SITE_NOT_REJECTED');
      return { httpStatus: response.status, errorCode: body.code };
    });
  await check('manual_intake_available', async () => {
    const response = await request('/api/intake', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify({ input, requestId: randomUUID(), inputVersion: 1, operation: 'initial', forceManual: true }) });
    const body = await bodyOf(response);
    assert(response.status === 200 && body.mode === 'manual' && body.domain?.status === 'in_scope', 'MANUAL_INTAKE_ERROR');
    return { httpStatus: response.status, mode: body.mode };
  });
  for (const route of ['/', '/new', '/cases', '/compare', '/resources']) await check(`page_${route}`, async () => {
    const response = await request(route);
    const html = await response.text();
    assert(response.status === 200 && html.includes('CaseLink') && !html.includes('Authentication Required'), 'PAGE_CONTENT_MISSING');
    return { httpStatus: response.status };
  });
  await Promise.all([
    ['aigul-utepova', 'Aigul Utepova'], ['emna-chargui', 'Emna Chargui'], ['myriam-bribri', 'Myriam Bribri'],
  ].map(([id, expected]) => check(`case_${id}`, async () => {
    const response = await request(`/cases/${id}`);
    assert(response.status === 200, 'CASE_HTTP_ERROR');
    const html = await response.text();
    assert(html.includes('CaseLink') && html.includes(expected) && !html.includes('Authentication Required'), 'CASE_CONTENT_MISSING');
    return { httpStatus: response.status };
  })));
  const report = { status: checks.every(item => item.status === 'passed') ? 'passed' : 'failed', origin, checkedAt: new Date().toISOString(), capabilities, anonymous: true, modelRequests: 0, latencyMs: Math.round(performance.now() - started), checks };
  const output = path.join(root, 'test-results', 'live-deployment-http.json');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, counts: { passed: checks.filter(item => item.status === 'passed').length, checks: checks.length }, modelRequests: 0, report: 'test-results/live-deployment-http.json' }));
  if (report.status !== 'passed') process.exitCode = 1;
}
try { await main(); } catch (error) {
  const message = error instanceof Error && /^[A-Z][A-Z0-9_ :./-]{1,180}$/.test(error.message) ? error.message : 'SETUP_ERROR';
  console.error(`${message}: 未打印底层响应或凭据。`);
  process.exitCode = 1;
}
