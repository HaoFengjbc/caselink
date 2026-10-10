import {test, expect, type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {type NewCaseInput} from '../../src/lib/contracts';
import {type MaterialResponse, type MaterialItem} from '../../src/lib/materials/contracts';

// All material/model responses in this suite are simulated. The PDF is a checked-in fictional fixture.
// The flagged items imitate drafts saved by an earlier version, which asked for a separate review of each date.
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
    expect(route.request().headers()['x-caselink-material-version']).toBe('3');
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
  await page.getByRole('button', {name: '准备答辩或应诉材料', exact: true}).click();
  await page.getByRole('radio', {name: '希望先保持私下处理', exact: true}).check();
}
async function finishRule(page: Page) {
  await page.getByRole('button', {name: '改用规则参考 · 不联网、不调用 AI', exact: true}).click();
  await expect(page).toHaveURL(/\/analysis$/);
  await expect(page.getByText('规则参考 · 未调用实时 AI', {exact: true})).toBeVisible();
}

test('MOCKED dates: no per-date form; an unverified date stays unknown when the case is confirmed', async ({page}) => {
  const run = await setup(page);
  await expect(page.getByTestId('material-date-review')).toHaveCount(0);
  const flaggedPoint = page.locator('[data-material-item="date-1"]');
  await expect(flaggedPoint).toContainText('第 1 页');
  await flaggedPoint.getByRole('button').click();
  const editor = page.getByRole('group', {name: '修改这一处'});
  await expect(editor.locator('blockquote')).toContainText(quote);
  await mkdir('test-results/pdf-date-review-mocked', {recursive: true});
  await editor.screenshot({path: 'test-results/pdf-date-review-mocked/date-review-source.png'});
  await editor.getByRole('button', {name: '完成', exact: true}).click();
  await prepareOtherRequirements(page);
  await finishRule(page);
  const items = run.analyzed[0].intake!.materials!.items;
  expect(items.filter(item => !item.dateReview)).toHaveLength(3);
  const item = items.find(item => item.id === 'date-1')!;
  expect(item.date).toBeNull(); expect(item.dateReview!.resolution).toBe('unknown'); expect(item.sources[0].quote).toBe(quote);
  expect(run.materialCalls()).toBe(1);
});

test('MOCKED dates: a point can still be rewritten from its original wording or deleted', async ({page}) => {
  const run = await setup(page, extraction([flagged('date-1'), flagged('date-2', 'missing_date')]));
  await page.locator('[data-material-item="date-1"]').getByRole('button').click();
  const editor = page.getByRole('group', {name: '修改这一处'});
  await editor.getByRole('button', {name: '改用原文', exact: true}).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('[data-material-item="date-1"]')).toContainText(quote);
  await page.locator('[data-material-item="date-2"]').getByRole('button').click();
  await editor.getByRole('button', {name: '删除这条', exact: true}).click();
  await expect(page.locator('[data-material-item="date-2"]')).toHaveCount(0);
  await prepareOtherRequirements(page); await finishRule(page);
  const items = run.analyzed[0].intake!.materials!.items;
  expect(items.some(item => item.id === 'date-2')).toBe(false);
  const item = items.find(item => item.id === 'date-1')!;
  expect(item).toMatchObject({status: 'edited', date: null, text: quote}); expect(item.dateReview!.resolution).toBe('unknown');
  expect(run.materialCalls()).toBe(1);
});

test('MOCKED dates: five flagged dates are all kept unknown in one confirmation', async ({page}) => {
  const run = await setup(page, extraction(Array.from({length: 5}, (_, index) => flagged(`date-${index + 1}`, index === 0 ? 'missing_date' : 'date_mismatch'))));
  await expect(page.locator('[data-material-item^="date-"]')).toHaveCount(5);
  await prepareOtherRequirements(page); await finishRule(page);
  const dates = run.analyzed[0].intake!.materials!.items.filter(item => item.dateReview);
  expect(dates).toHaveLength(5); expect(dates.every(item => item.date === null && item.dateReview!.resolution === 'unknown' && item.sources[0].quote === quote)).toBe(true);
  expect(run.materialCalls()).toBe(1);
});
