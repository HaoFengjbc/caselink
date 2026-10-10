import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

// Replay the recorded fictional live output to check display and actual downloads.
// No model/search request is allowed in this browser regression.
const evidenceDir=process.env.E2E_RESEARCH_EVIDENCE_DIR||'docs/openai-search-2026-10-10';
test.beforeEach(async({page})=>{page.setDefaultTimeout(10_000);});
test('recorded OpenAI research: cited pages, measured queries, export and frozen snapshot',async({page},testInfo)=>{
 const input=JSON.parse(await readFile(`${evidenceDir}/sample-input.json`,'utf8'));
 const result=JSON.parse(await readFile(`${evidenceDir}/complete-output.json`,'utf8'));
 expect(result.mode).toBe('live_ai');expect(result.webResearch.status).toBe('completed');
 let blockedCalls=0;
 for(const endpoint of ['analyze','intake'])await page.route(`**/api/${endpoint}`,route=>{blockedCalls++;return route.fulfill({status:503,json:{code:'TEST_BLOCKED',message:'No paid calls in replay'}});});
 await page.addInitScript(({input,result})=>{
  const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value;
  sessionStorage.setItem('caselink.preferences.v2',JSON.stringify({aiEnabled:true,saveMode:'memory',refreshRecovery:true,expiresAt:new Date(Date.now()+3_600_000).toISOString()}));
  sessionStorage.setItem('caselink.recovery.v2',JSON.stringify({version:1,input,result,step:0,resultInputKey:JSON.stringify(canonical(input))}));
 },{input,result});
 await page.goto('/analysis');
 await page.getByRole('tab',{name:/联网补充/}).click();
 await expect(page.locator('#panel-web').getByText('已取得网页资料',{exact:true})).toBeVisible();
 await expect(page.locator('#panel-web').getByText('完整搜索报告',{exact:true})).toBeVisible();
 const details=page.locator('details').filter({has:page.getByText('搜索工具返回的实际查询',{exact:true})});
 if(await details.count())await details.first().evaluate(el=>{(el as HTMLDetailsElement).open=true;});
 for(const source of result.webResearch.sources){
  expect(source.pageOpened).toBe(true);
  expect(await page.locator('a').evaluateAll((links,url)=>links.some(link=>link.getAttribute('href')===url),source.url)).toBe(true);
  expect(result.snapshot.sourceDescriptors.find((s:any)=>s.sourceId===source.sourceId)).toMatchObject({reviewStatus:'unreviewed',teamReviewedAt:null});
 }
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'下载 Markdown',exact:true}).click();
 const download=await downloadEvent;const filename=testInfo.outputPath(download.suggestedFilename());await download.saveAs(filename);
 const markdown=await readFile(filename,'utf8');
 for(const source of result.webResearch.sources)expect(markdown).toContain(source.url);
 for(const query of result.webResearch.actualQueries)expect(markdown).toContain(query);
 expect(markdown).toContain(input.intake.disclosureDetails);expect(markdown).toContain(result.createdAt);
 await page.screenshot({path:testInfo.outputPath('openai-research-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('openai-research-mobile.png'),fullPage:true});
 await page.getByRole('tab',{name:/行动参考/}).click();
 const workspace=page.getByRole('region',{name:'What’s Next workspace'});
 for(const kind of ['timeline','issue_matrix','lawyer_brief']){
  await workspace.locator(`[data-document-tab="${kind}"]`).click();
  const event=page.waitForEvent('download');await workspace.locator(`[data-download-kind="${kind}"]`).click();
  const file=await event;const filename=testInfo.outputPath(`${kind}.md`);await file.saveAs(filename);
  const text=await readFile(filename,'utf8');expect(text).toContain(input.intake.narrative);expect(text).toContain(input.intake.disclosureDetails);expect(text.length).toBeGreaterThan(900);
 }
 expect(blockedCalls).toBe(0);
});

test('OpenAI availability does not show the obsolete Brave configuration warning',async({page})=>{
 await page.route('**/api/capabilities',route=>route.fulfill({json:{mode:'live',configured:true,liveAvailable:true,webSearchAvailable:true,webSearchProvider:'openai',controlledSearchConfigured:false}}));
 await page.route('**/api/intake',route=>route.fulfill({json:{mode:'manual',facts:[],questions:[],sources:[],model:null}}));
 await page.route('**/api/analyze',route=>route.fulfill({status:503,json:{code:'TEST_BLOCKED'}}));
 await page.goto('/new');await page.getByRole('button',{name:/没有文件，直接描述/}).click();
 await page.getByRole('checkbox',{name:'提交时允许调用 AI'}).uncheck();
 await page.getByLabel('国家或地区',{exact:true}).fill('United Kingdom');await page.getByRole('radio',{name:'英格兰与威尔士',exact:true}).check();
 await page.getByRole('radio',{name:'民事',exact:true}).check();await page.getByRole('group',{name:'这件事和新闻报道或公开表达有关吗？'}).getByRole('radio',{name:'有关',exact:true}).check();
 await page.getByRole('button',{name:'继续',exact:true}).click();await page.getByLabel('案情原始描述').fill('【虚构】记者收到关于一篇报道的民事律师函。');
 await page.getByLabel('你的主要诉求是什么？').fill('为本地律师整理材料');await page.getByLabel('对外公开的意愿',{exact:true}).selectOption('private');
 await page.getByRole('button',{name:'先不用 AI，直接下一步',exact:true}).click();
 await expect(page.getByText('实时 AI 模式',{exact:true})).toBeVisible();
 await expect(page.getByText('受控联网搜索尚未配置',{exact:false})).toHaveCount(0);
 await expect(page.getByText('联网搜索不可用或已关闭',{exact:false})).toHaveCount(0);
});
