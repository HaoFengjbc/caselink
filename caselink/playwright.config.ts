import {defineConfig} from '@playwright/test';
// Playwright empties its outputDir on every run; keep it in a subfolder so saved fixtures in test-results/ survive.
export default defineConfig({testDir:'./tests/e2e',outputDir:'test-results/playwright',fullyParallel:false,workers:1,timeout:60000,use:{baseURL:process.env.TEST_BASE_URL||'http://127.0.0.1:3000',channel:'chrome',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure'},reporter:[['list'],['json',{outputFile:'test-results/e2e-results.json'}]]});
