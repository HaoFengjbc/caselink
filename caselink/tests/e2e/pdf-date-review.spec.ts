import {test, expect, type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {type NewCaseInput} from '../../src/lib/contracts';
import {type MaterialResponse, type MaterialItem} from '../../src/lib/materials/contracts';

// All material/model responses in this suite are simulated. The PDF is a checked-in fictional fixture.
const fixture = await readFile(fileURLToPath(new URL('../fixtures/pdf/expression-letter.pdf', import.meta.url)));
const filename = 'fictional-date-review.pdf';
const fileId = `pdf-${createHash('sha256').update(fixture).digest('hex')}`;
const quote = 'The lawyer requests a response by 14 October 2026.';
const source = (text: string) => ({fileId, filename, pdfPage: 1, printedPage: null, quote: text, method: 'embedded_text' as const});
const normalItem = (id: string, text: string, field: MaterialItem['field'], excerpt: string): MaterialItem => ({
  id, field, text, subject: 'Mira Vale', nature: 'document_record', dateKind: 'none', date: null,
  sources: [source(excerpt)], uncertainty: null, status: 'extracted', originalText: text,
});
const normal = [
  normalItem('party', 'Mira Vale 是英国记者。', 'party', 'Mira Vale is a freelance journalist in England and Wales, United Kingdom.'),
  normalItem('expression', '本案涉及记者对虚构地方采购的报道。', 'expression', 'Her article questioned procurement by fictional Northbridge Council.'),
  {...normalItem('claim', '律师函提出诽谤指控，尚无法院认定。', 'claim', 'No court has determined the allegations or awarded damages.'), nature: 'allegation' as const},
];
const flagged = (id = 'date-1', reason: 'date_mismatch' | 'missing_date' = 'date_mismatch'): MaterialItem => ({
  ...normalItem(id, '日期待核对；请查看对应原文。', 'demand', quote),
  dateKind: 'requested_deadline', dateReview: {reason, resolution: null},
  uncertainty: 'AI 日期无法核实，未采用未核实的日期或相关草稿。',
});
function extraction(dateItems: MaterialItem[] = [flagged()]): MaterialResponse {
  return {
    mode: 'live_ai', model: 'MOCKED-DATE-REVIEW-PROVIDER', warnings: [],
    documents: [{fileId, filename, size: fixture.length, pageCount: 2, processedPages: [1, 2], unreadablePages: [], omittedPages: [], warnings: [], pages: [
      {pdfPage: 1, text: [...normal.flatMap(item => item.sources.map(entry => entry.quote)), quote].join('\n'), status: 'read', printedPage: null},
      {pdfPage: 2, text: 'The article was published on 20 September 2026.', status: 'read', printedPage: null},
    ]}],
    candidates: [{id: 'mira-date-case', label: 'Mira Vale · 虚构表达案件', prefill: {country: '英国', jurisdiction: 'england_wales', caseKind: 'civil', expression: 'yes', stage: 'unknown', personType: 'journalist'}, items: [...normal, ...dateItems], conflicts: [], missing: []}],
  };
}
async function setup(page: Page, response = extraction()) {
  const analyzed: NewCaseInput[] = [];
  let materialCalls = 0;
  await page.route('**/api/capabilities', route => route.fulfill({json: {mode: 'live', configured: true, liveAvailable: true, materialExtractionAvailable: true, controlledSearchConfigured: false, ruleAvailable: true}}));
  await page.route('**/api/materials', route => {
    expect(route.request().headers()['x-caselink-material-version']).toBe('2');
    materialCalls++;
    return route.fulfill({contentType: 'application/x-ndjson', body: JSON.stringify({type: 'result', result: response}) + '\n'});
  });
  await page.route('**/api/analyze', route => {
    const payload = route.request().postDataJSON();
    // Even with mocked live capabilities, only the actual local rule endpoint is permitted.
    expect(payload.forceRule).toBe(true);
    analyzed.push(payload.input);
    return route.continue();
  });
  await page.goto('/new');
  await page.getByLabel('选择案件 PDF').setInputFiles({name: filename, mimeType: 'application/pdf', buffer: fixture});
  await expect(page.getByText(filename, {exact: true})).toBeVisible();
  await page.getByRole('checkbox', {name: /我同意将提取文字交给 AI/}).check();
  await page.getByRole('button', {name: '读取材料并整理案情', exact: true}).click();
  await expect(page.getByRole('heading', {level: 1, name: '案情整理'})).toBeVisible();
  await expect(page.locator('[data-material-item="party"]')).toContainText('Mira Vale 是英国记者。');
  await expect(page.locator('[data-material-item="expression"]')).toContainText('本案涉及记者');
  expect(materialCalls).toBe(1);
  return {analyzed, materialCalls: () => materialCalls};
}
async function prepareOtherRequirements(page: Page) {
  await page.getByLabel('本次工作目标', {exact: true}).fill('准备内部律师会谈，核对表达案件材料。');
  await page.getByLabel('本次披露选择').selectOption('private');
  await page.getByLabel('披露范围与接收对象', {exact: true}).fill('仅供内部研究团队与受委托律师；不公开身份或全文。');
  await page.getByRole('checkbox', {name: '我确认这是本次工作目标。'}).check();
  await page.getByRole('checkbox', {name: '我确认本次接收范围和披露限制。'}).check();
}
async function finishRule(page: Page) {
  await page.getByRole('button', {name: '改用规则参考 · 不联网、不调用 AI', exact: true}).click();
  await expect(page).toHaveURL(/\/analysis$/);
  await expect(page.getByText('规则参考 · 未调用实时 AI', {exact: true})).toBeVisible();
}

test('MOCKED date validation: retain other facts, block confirmation, and require an explicit review note', async ({page}) => {
  const run = await setup(page);
  const review = page.getByTestId('material-date-review');
  await expect(review).toContainText('还有 1 项日期需要处理');
  await review.locator('summary').click();
  await expect(review.locator('blockquote')).toHaveText(quote);
  await expect(review.getByRole('button', {name: '保存核对说明', exact: true})).toBeDisabled();
  await review.getByLabel('你的日期核对说明', {exact: true}).fill('   ');
  await expect(review.getByRole('button', {name: '保存核对说明', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: '编辑 date-1', exact: true}).click();
  await page.getByLabel('编辑提取笔记', {exact: true}).fill('用户普通笔记修改，仍需单独核对日期。');
  await page.getByRole('button', {name: '完成', exact: true}).click();
  await expect(review).toBeVisible();
  await expect(page.locator('[data-material-item="date-1"]')).toContainText('普通笔记修改不会自动消除日期问题');
  await prepareOtherRequirements(page);
  await page.getByRole('button', {name: '改用规则参考 · 不联网、不调用 AI', exact: true}).click();
  await expect(page.locator('main').getByRole('alert').last()).toContainText('日期');
  expect(run.analyzed).toHaveLength(0);
  await mkdir('test-results/pdf-date-review-mocked', {recursive: true});
  await review.screenshot({path: 'test-results/pdf-date-review-mocked/date-review-source.png'});
  const note = '我核对了原文：14 October 2026 是对方提出的回复时间；是否构成法定期限仍需律师核实。';
  await review.getByLabel('你的日期核对说明', {exact: true}).fill(note);
  await review.getByRole('button', {name: '保存核对说明', exact: true}).click();
  await expect(review).toHaveCount(0);
  const saved = page.locator('[data-material-item="date-1"]');
  await expect(saved).toContainText(note);
  await saved.locator('summary').click();
  await expect(saved.locator('blockquote')).toHaveText(quote);
  await finishRule(page);
  const item = run.analyzed[0].intake!.materials!.items.find(item => item.id === 'date-1')!;
  expect(item.dateReview!.resolution).toBe('reviewed'); expect(item.date).toBeNull(); expect(item.text).toBe(note); expect(item.sources[0].quote).toBe(quote);
  expect(run.materialCalls()).toBe(1);
});

for (const action of ['unknown', 'delete'] as const) test(`MOCKED date validation: explicit ${action} permits confirmation without invented dates`, async ({page}) => {
  const run = await setup(page);
  await prepareOtherRequirements(page);
  const review = page.getByTestId('material-date-review');
  await review.getByRole('button', {name: action === 'unknown' ? '日期不清楚，保留未知' : '删除此日期项', exact: true}).click();
  await expect(review).toHaveCount(0);
  if (action === 'unknown') {
    const saved = page.locator('[data-material-item="date-1"]');
    await expect(saved).toContainText('日期已明确保留未知');
    await saved.locator('summary').click(); await expect(saved.locator('blockquote')).toHaveText(quote);
  } else await expect(page.locator('[data-material-item="date-1"]')).toHaveCount(0);
  await finishRule(page);
  const items = run.analyzed[0].intake!.materials!.items;
  expect(items.filter(item => !item.dateReview)).toHaveLength(3);
  if (action === 'unknown') {
    const item = items.find(item => item.id === 'date-1')!;
    expect(item.date).toBeNull(); expect(item.dateReview!.resolution).toBe('unknown'); expect(item.text).toContain('明确保留未知'); expect(item.sources[0].quote).toBe(quote);
  } else expect(items.some(item => item.id === 'date-1')).toBe(false);
  expect(run.materialCalls()).toBe(1);
});

test('MOCKED date validation: show at most three cards and resolve all pending dates as unknown', async ({page}) => {
  const run = await setup(page, extraction(Array.from({length: 5}, (_, index) => flagged(`date-${index + 1}`, index === 0 ? 'missing_date' : 'date_mismatch'))));
  const review = page.getByTestId('material-date-review');
  await expect(review.locator('[data-date-review-item]')).toHaveCount(3);
  await expect(review).toContainText('缺少可核对的日期');
  await review.getByRole('button', {name: '日期不清楚，保留未知', exact: true}).first().click();
  await expect(review.locator('[data-date-review-item]')).toHaveCount(3);
  await expect(review.locator('[data-date-review-item="date-4"]')).toBeVisible();
  await review.getByRole('button', {name: '将全部 4 项未处理日期保留未知', exact: true}).click();
  await expect(review).toHaveCount(0);
  await prepareOtherRequirements(page); await finishRule(page);
  const dates = run.analyzed[0].intake!.materials!.items.filter(item => item.dateReview);
  expect(dates).toHaveLength(5); expect(dates.every(item => item.date === null && item.dateReview!.resolution === 'unknown' && item.sources[0].quote === quote)).toBe(true);
  expect(run.materialCalls()).toBe(1);
});
