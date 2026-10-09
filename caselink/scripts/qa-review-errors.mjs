// Browser regression with fully mocked AI responses; no live model call.
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
import { chromium, expect } from '@playwright/test';

const input = { schemaVersion: '1.0', country: '突尼斯', stage: 'trial', currentProblems: ['threats'], background: { activities: ['social_media'], personType: 'blogger', description: '虚构QA' }, primaryGoal: 'drop_charges', keyDates: [{ date: '2026-11-05', event: '预计听证', approximate: true }], resources: ['lawyer'], resourceConstraints: '', priorActions: { status: 'none', description: '', date: '' }, publicity: 'private', isExample: false, exampleId: null };
const copy = {
  zh: { submit: '查找案例并生成行动参考', retry: '重试一次', rule: /改用规则参考/, unavailable: '暂未获取服务状态', disclosure: /完整案情可能交给 OpenAI 分析/, quota: /额度或预算限制/ },
  en: { submit: 'Find cases and draft an action plan', retry: 'Retry once', rule: /Use rule-based reference/, unavailable: 'Service status unavailable', disclosure: /full case record may be sent to OpenAI/, quota: /quota or budget limits/ },
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const locale of ['zh', 'en']) {
    const context = await browser.newContext();
    try {
      await context.addCookies([{ name: 'caselink-locale', value: locale, url: baseURL }]);
      const page = await context.newPage();
      let analysisRequests = 0;
      let retiredAccessRequests = 0;
      await page.addInitScript(input => sessionStorage.setItem('caselink.session.v1', JSON.stringify({ version: 1, input, result: null, resultInputKey: null, step: 8 })), input);
      await page.route('**/api/capabilities', route => route.fulfill({ status: 200, json: { mode: 'live', configured: true, liveAvailable: true, accessRequired: false } }));
      // Trap the retired endpoint too, so an accidental UI regression cannot
      // send a request to a real service while this guard is running.
      await page.route('**/api/access', route => { retiredAccessRequests += 1; return route.abort(); });
      await page.route('**/api/analyze', route => {
        analysisRequests += 1;
        return route.fulfill({ status: 429, json: { code: 'QUOTA_EXHAUSTED', message: 'AI 服务受到额度或预算限制。请联系管理员检查额度，或使用规则参考。', requestId: 'qa-quota-errors' } });
      });
      await page.goto(`${baseURL}/review`);
      await page.getByRole('button', { name: copy[locale].submit, exact: true }).click();
      await expect(page.locator('main').getByRole('alert')).toContainText(copy[locale].quota);
      await expect(page.getByRole('button', { name: copy[locale].retry, exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: copy[locale].submit, exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: copy[locale].rule })).toBeVisible();
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
      if (analysisRequests !== 1 || retiredAccessRequests !== 0) throw new Error('Quota failure retried or invoked the retired access endpoint');
      console.log(`${locale}: quota failure has no retry or password control; explicit rule choice remains`);

      await page.unroute('**/api/capabilities');
      await page.route('**/api/capabilities', route => route.fulfill({ status: 503, json: { message: 'QA unavailable' } }));
      await page.reload();
      await expect(page.getByText(copy[locale].unavailable, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: copy[locale].rule })).toBeVisible();
      await expect(page.getByText(copy[locale].disclosure)).toBeVisible();
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
      if (analysisRequests !== 1 || retiredAccessRequests !== 0) throw new Error('Reload unexpectedly submitted an analysis or access request');
      console.log(`${locale}: unknown capabilities disclose AI submission and offer rule mode; reload starts no analysis`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
