import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

// This is an opt-in, one-request paid smoke test. It reads no credentials or
// environment variables and never sends an access cookie or authorization header.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const output = path.join(root, 'test-results', 'live-ai-smoke.json');
const knownServerCodes = new Set([
  'INVALID_INPUT', 'PAYLOAD_TOO_LARGE', 'CONFIGURATION_ERROR',
  'FORBIDDEN', 'TIMEOUT', 'CANCELLED', 'RATE_LIMITED', 'QUOTA_EXHAUSTED',
  'MODEL_REFUSAL', 'INCOMPLETE_OUTPUT', 'INVALID_MODEL_OUTPUT', 'UPSTREAM_ERROR', 'INTERNAL_ERROR',
]);
const usage = [
  '仅检查本地输入（不联网、不读取任何凭据）：',
  '  node scripts/verify-live-ai.mjs --check-inputs',
  '显式执行一次可能产生费用的公网验收：',
  '  node scripts/verify-live-ai.mjs https://your-production-domain --run-paid-smoke',
  '无需访问密码；不读取任何凭据，不发送 Cookie，不打印案情或完整响应。',
].join('\n');

class CheckError extends Error {
  constructor(code, message, httpStatus) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
function assert(value, code, message, httpStatus) {
  if (!value) throw new CheckError(code, message, httpStatus);
}

function parseArguments(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  if (args.length === 1 && args[0] === '--check-inputs') return { checkOnly: true };
  assert(args.includes('--run-paid-smoke'), 'EXPLICIT_OPT_IN_REQUIRED', '未提供 --run-paid-smoke；未发起任何网络请求。');
  const positional = args.filter(value => value !== '--run-paid-smoke');
  assert(args.length === 2 && positional.length === 1 && !positional[0].startsWith('--'), 'INVALID_ARGUMENTS', '请只提供一个公网 HTTPS 根域名和 --run-paid-smoke。');
  let base;
  try { base = new URL(positional[0]); } catch { throw new CheckError('INVALID_TARGET', '目标必须是有效的公网 HTTPS 根域名。'); }
  const hostname = base.hostname.toLowerCase();
  assert(
    base.protocol === 'https:' && !base.username && !base.password && !base.port &&
    base.pathname === '/' && !base.search && !base.hash && !isIP(hostname) &&
    hostname.includes('.') && !hostname.startsWith('[') &&
    /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(hostname) &&
    !/(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(hostname) &&
    !hostname.endsWith('.example.com') && hostname !== 'example.com',
    'INVALID_TARGET', '仅接受不含凭据、路径、查询、片段或非默认端口的公网 HTTPS 域名；不接受本机或 IP 地址。',
  );
  return { checkOnly: false, origin: base.origin };
}

const modules = new Map();
const moduleUrls = new Map();
const fixtureAllowlist = new Set(['src/lib/contracts.ts', 'src/lib/intake/contracts.ts', 'src/lib/research/contracts.ts', 'src/lib/research/plan.ts', 'data/demo/fixtures.ts']);
async function fixtureModule(relative) {
  assert(fixtureAllowlist.has(relative), 'LOCAL_INPUT_ERROR', '拒绝加载未指定的本地输入模块。');
  const filename = path.join(root, relative);
  if (modules.has(filename)) return modules.get(filename);
  let source = stripTypeScriptTypes(await fs.readFile(filename, 'utf8'), { mode: 'strip' });
  if (['src/lib/contracts.ts', 'src/lib/intake/contracts.ts', 'src/lib/research/contracts.ts', 'src/lib/research/plan.ts'].includes(relative)) {
    source = source.replace(/import\s*\{\s*z\s*\}\s*from\s*['"]zod['"];?/, `import zod from ${JSON.stringify(pathToFileURL(require.resolve('zod')).href)}; const { z } = zod;`);
    if (relative === 'src/lib/contracts.ts') {
      await fixtureModule('src/lib/intake/contracts.ts');
      const intakeUrl = moduleUrls.get(path.join(root, 'src/lib/intake/contracts.ts'));
      await fixtureModule('src/lib/research/contracts.ts');
      const researchUrl = moduleUrls.get(path.join(root, 'src/lib/research/contracts.ts'));
      source = source.replace(/\bfrom\s*['"]\.\/research\/contracts['"]/g, `from ${JSON.stringify(researchUrl)}`);
      // Rewrite both the import and re-export, without enabling generic relative-module loading.
      source = source.replace(/\bfrom\s*['"]\.\/intake\/contracts['"]/g, `from ${JSON.stringify(intakeUrl)}`);
    }
    if (relative === 'src/lib/research/contracts.ts') {
      await fixtureModule('src/lib/research/plan.ts');
      const planUrl = moduleUrls.get(path.join(root, 'src/lib/research/plan.ts'));
      source = source.replace(/\bfrom\s*['"]\.\/plan['"]/g, `from ${JSON.stringify(planUrl)}`);
    }
  } else if (relative === 'data/demo/fixtures.ts') {
    const contracts = await fixtureModule('src/lib/contracts.ts');
    source = source.replace(/import\s*\{[^}]*\}\s*from\s*['"]\.\.\/\.\.\/src\/lib\/contracts['"];?/, `const EMPTY_INPUT = ${JSON.stringify(contracts.EMPTY_INPUT)};`);
  } else throw new CheckError('LOCAL_INPUT_ERROR', '拒绝加载未指定的本地输入模块。');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const result = await import(moduleUrl);
  moduleUrls.set(filename, moduleUrl);
  modules.set(filename, result);
  return result;
}

async function loadInputs() {
  try {
    const contracts = await fixtureModule('src/lib/contracts.ts');
    const { DEMO_SCENARIOS } = await fixtureModule('data/demo/fixtures.ts');
    assert(Array.isArray(DEMO_SCENARIOS) && DEMO_SCENARIOS.length > 0, 'LOCAL_INPUT_ERROR', '未找到既有虚构示例。');
    for (const scenario of DEMO_SCENARIOS) {
      const parsed = contracts.NewCaseInputSchema.safeParse(scenario.input);
      assert(parsed.success && parsed.data.isExample === true && parsed.data.exampleId === scenario.id, 'LOCAL_INPUT_ERROR', '既有示例未通过输入校验。');
    }
    const evidence = contracts.EvidenceSchema.array().parse(JSON.parse(await fs.readFile(path.join(root, 'data/evidence/evidence.json'), 'utf8')));
    const evidenceById = new Map(evidence.map(item => [item.evidenceId, item]));
    assert(evidence.length > 0 && evidenceById.size === evidence.length, 'LOCAL_INPUT_ERROR', '本地证据库为空或存在重复引用标识。');
    return { contracts, input: structuredClone(DEMO_SCENARIOS[0].input), evidenceById, fixtureCount: DEMO_SCENARIOS.length };
  } catch (error) {
    if (error instanceof CheckError) throw error;
    throw new CheckError('LOCAL_INPUT_ERROR', '无法加载或校验项目示例与证据；请先安装依赖并检查本地资料。');
  }
}

async function request(origin, route, options = {}, timeoutMs = 15000) {
  try {
    return await fetch(new URL(route, origin), { ...options, redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new CheckError(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR', '网络请求未完成；未自动重试。');
  }
}
async function readJson(response) {
  assert(response.status < 300 || response.status >= 400, 'UNEXPECTED_REDIRECT', '收到重定向，未继续访问登录页或其他地址。', response.status);
  let body;
  try { body = await response.json(); } catch { throw new CheckError('INVALID_RESPONSE', '服务未返回有效 JSON；未输出响应正文。', response.status); }
  if (!response.ok) {
    const code = knownServerCodes.has(body?.code) ? body.code : 'HTTP_ERROR';
    throw new CheckError(code, `服务返回 HTTP ${response.status}；未输出错误正文。`, response.status);
  }
  assert(response.headers.get('cache-control')?.toLowerCase().includes('no-store'), 'CACHE_POLICY_ERROR', '响应缺少 Cache-Control: no-store。', response.status);
  return body;
}

function validateResult(raw, inputs) {
  const parsed = inputs.contracts.AnalysisResultSchema.safeParse(raw);
  assert(parsed.success, 'INVALID_RESULT_SCHEMA', '真实分析结果未通过项目共享契约校验。');
  const result = parsed.data;
  assert(result.mode === 'live_ai', 'WRONG_MODE', '服务没有返回 live_ai，不能记作真实 AI 验收通过。');
  assert(result.actionOptions.length >= 1 && result.sources.length + (result.webResearch?.sources.length ?? 0) >= 1, 'MISSING_ACTIONS_OR_CITATIONS', '结果缺少行动方案或证据引用。');
  const sourceIds = new Set();
  for (const source of result.sources) {
    const known = inputs.evidenceById.get(source.evidenceId);
    assert(known && ['caseId', 'documentId', 'pdfPage', 'printedPage', 'exactQuote', 'sourceUrl'].every(key => known[key] === source[key]), 'INVALID_EVIDENCE', '结果引用或证据内容与项目真实证据库不一致。');
    assert(!sourceIds.has(source.evidenceId), 'DUPLICATE_EVIDENCE', '结果来源存在重复证据标识。');
    sourceIds.add(source.evidenceId);
  }
  const citedIds = new Set();
  for (const comparable of result.comparableCases) for (const id of comparable.evidenceIds) {
    assert(inputs.evidenceById.get(id)?.caseId === comparable.caseId && sourceIds.has(id), 'INVALID_EVIDENCE', '可比案例引用缺失或与案件归属不符。');
    citedIds.add(id);
  }
  for (const action of result.actionOptions) for (const id of action.supportingEvidenceIds) {
    assert(inputs.evidenceById.has(id) && sourceIds.has(id), 'INVALID_EVIDENCE', '行动引用未出现在真实证据库或结果来源中。');
    citedIds.add(id);
  }
  const webIds=new Set(result.webResearch?.sources.map(s=>s.sourceId)??[]);
  for(const comparison of result.webComparisons??[])for(const id of comparison.sourceIds)assert(webIds.has(id),'INVALID_WEB_CITATION','网页比较引用不在本次搜索结果中。');
  for(const mapping of result.actionWebSources??[])for(const id of mapping.sourceIds)assert(webIds.has(id),'INVALID_WEB_CITATION','行动引用不在本次搜索结果中。');
  assert(result.webResearch?.status==='completed'&&result.webResearch.searchCallCount>0&&webIds.size>0,'WEB_SEARCH_NOT_COMPLETED','尚未完成真实网页搜索，不记作联网验收通过。');
  assert(citedIds.size + (result.webComparisons??[]).flatMap(c=>c.sourceIds).length > 0, 'MISSING_ACTIONS_OR_CITATIONS', '结果仅有来源列表，没有案例或行动引用。');
  return { mode: result.mode, counts: { cases: result.comparableCases.length, actions: result.actionOptions.length, sources: sourceIds.size, citations: citedIds.size, webSources:webIds.size, webCases:result.webComparisons?.length??0 } };
}

async function paidSmoke(origin, inputs) {
  const started = performance.now();
  const report = { status: 'running', mode: null, latencyMs: 0, counts: { analysisRequests: 0, cases: 0, actions: 0, sources: 0, citations: 0 }, errorCode: null, checks: {} };
  let stage = 'capabilities';
  async function check(name, operation) {
    stage = name;
    const start = performance.now();
    try {
      const details = await operation();
      report.checks[name] = { status: 'passed', latencyMs: Math.round(performance.now() - start), ...details };
      console.log(`通过：${name}`);
      return details;
    } catch (error) {
      report.checks[name] = { status: 'failed', latencyMs: Math.round(performance.now() - start), errorCode: error instanceof CheckError ? error.code : 'CHECK_FAILED', ...(error instanceof CheckError && error.httpStatus ? { httpStatus: error.httpStatus } : {}) };
      throw error;
    }
  }
  try {
    await check('capabilities', async () => {
      const response = await request(origin, '/api/capabilities');
      const body = await readJson(response);
      const allowed = ['mode', 'configured', 'liveAvailable', 'accessRequired'];
      assert(body && typeof body === 'object' && Object.keys(body).every(key => allowed.includes(key)), 'INVALID_CAPABILITIES', '服务能力响应包含未预期字段。');
      assert(body.mode === 'live' && body.configured === true && body.liveAvailable === true && body.accessRequired === false, 'LIVE_NOT_READY', '尚未确认免密码的实时 AI 服务已配置；不会提交分析。');
      report.mode = 'live';
      return { httpStatus: response.status, mode: 'live' };
    });
    const analysis = await check('analysis', async () => {
      report.counts.analysisRequests += 1;
      const response = await request(origin, '/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify({ input: inputs.input, requestId: randomUUID() }) }, 290000);
      const body = await readJson(response);
      return { httpStatus: response.status, ...validateResult(body, inputs) };
    });
    report.mode = analysis.mode;
    Object.assign(report.counts, analysis.counts);
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.errorCode = error instanceof CheckError ? error.code : 'CHECK_FAILED';
    console.error(`未通过：${stage}；错误代码 ${report.errorCode}。未自动重试，也未保存响应正文。`);
    process.exitCode = 1;
  } finally {
    report.latencyMs = Math.round(performance.now() - started);
    try {
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
      console.log(`汇总已保存：test-results/live-ai-smoke.json；状态 ${report.status}；分析请求数 ${report.counts.analysisRequests}。`);
    } catch { throw new CheckError('REPORT_WRITE_FAILED', '无法写入验收汇总。未打印任何敏感内容。'); }
  }
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) console.log(usage);
  else {
    const inputs = await loadInputs();
    if (options.checkOnly) console.log(JSON.stringify({ status: 'inputs_valid', counts: { fixtures: inputs.fixtureCount, evidence: inputs.evidenceById.size, networkRequests: 0, analysisRequests: 0 } }));
    else await paidSmoke(options.origin, inputs);
  }
} catch (error) {
  const safe = error instanceof CheckError ? error : new CheckError('CHECK_FAILED', '脚本未完成；未输出底层异常或敏感内容。');
  console.error(`${safe.code}：${safe.message}\n${usage}`);
  process.exitCode = 1;
}
