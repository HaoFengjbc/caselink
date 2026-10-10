import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

// Verification never authorizes a paid production analysis, including if privacy controls regress.
test.beforeEach(async({page})=>{
 await page.route('**/api/analyze',route=>route.continue({postData:JSON.stringify({...route.request().postDataJSON(),forceRule:true})}));
});

for(const [label,localId] of [
 ['记者受限','kz-criminal-procedure-detention'],
 ['博主被诉','tn-constitution-expression'],
 ['英国调查报道','ew-defamation-act-2013'],
] as const)test(`来源链、主动保存与真实导出：${label}`,async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await page.getByRole('button',{name:'体验示例案件'}).click();
 await page.getByRole('button',{name:new RegExp(label)}).click();
 await page.getByRole('button',{name:'载入示例并查看案情'}).click();
 await expect(page).toHaveURL(/\/review$/);
 const response=page.waitForResponse(r=>r.url().endsWith('/api/analyze')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'查找案例并生成行动参考'}).click();
 const analyzed=await response;expect(analyzed.ok(),await analyzed.text()).toBeTruthy();
 const report=await analyzed.json();
 await expect(page).toHaveURL(/\/analysis$/);
 await expect(page.getByRole('region',{name:'本案法律研究链'})).toBeVisible();
 const binding=report.snapshot.legalResearch.bindings.find((b:{resourceId:string})=>b.resourceId===localId);
 expect(binding).toBeTruthy();
 const card=page.locator(`[data-binding-id="${binding.bindingId}"]`).first();
 if(!await card.evaluate(el=>(el as HTMLDetailsElement).open))await card.locator('summary').click();
 await expect(card.getByRole('heading',{name:'相关事实与来源归属'})).toBeVisible();
 await expect(card.getByRole('heading',{name:'原文与准确定位'})).toBeVisible();
 await expect(card.getByText('用户陈述，未经独立核实；不是法院认定或原始指控文书')).toBeVisible();
 await expect(card.getByText('Agent 已检查来源；团队未人工复核')).toBeVisible();
 const savedBefore=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('caselink.report.v1.')));
 expect(savedBefore).toHaveLength(0);
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'下载 Markdown'}).click();
 const download=await downloading;const path=testInfo.outputPath(download.suggestedFilename());await download.saveAs(path);
 const markdown=await readFile(path,'utf8');expect(markdown).toContain(binding.claim);expect(markdown).toContain(binding.bindingId);expect(markdown).toContain('团队人工审核');
 await expect(page.getByRole('region',{name:'What’s Next'}).first()).toBeVisible();
 const step=report.snapshot.nextSteps[0];
 const next=page.locator(`[data-next-step="${step.actionId}"]`);await next.getByText('材料、历史依据与暂停条件',{exact:true}).click();
 await expect(next.getByRole('heading',{name:'谁曾实际做过什么'})).toBeVisible();
 await expect(next.getByText(step.deliverables[0],{exact:true})).toBeVisible();
 if(label==='英国调查报道'){expect(step.history).toHaveLength(0);await expect(next.getByText(/未找到与本项准备直接对应/)).toBeVisible();}
 else{expect(step.history.length).toBeGreaterThan(0);await expect(next.getByText(step.history[0].actor+' · '+step.history[0].action,{exact:true})).toBeVisible();}
 const packDownload=page.waitForEvent('download');await page.getByRole('button',{name:'下载内部材料包'}).click();
 const pack=await packDownload;const packPath=testInfo.outputPath(pack.suggestedFilename());await pack.saveAs(packPath);
 const working=await readFile(packPath,'utf8');expect(working).toContain(step.deliverables[0]);expect(working).toContain('案件时间线');expect(working).toContain('候选行动路径');
 await page.getByRole('button',{name:'主动保存到历史'}).click();
 const stored=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('caselink.report.v1.')).map(([,v])=>JSON.parse(v)));
 expect(stored).toHaveLength(1);expect(stored[0].result.snapshot.legalResearch).toEqual(report.snapshot.legalResearch);
 expect(stored[0].result.snapshot.nextSteps).toEqual(report.snapshot.nextSteps);
 await page.goto('/history');const backing=page.waitForEvent('download');await page.getByRole('button',{name:'下载全部备份'}).click();
 const backup=await backing;const backupPath=testInfo.outputPath(backup.suggestedFilename());await backup.saveAs(backupPath);
 const json=JSON.parse(await readFile(backupPath,'utf8'));expect(json.reports[0].result.snapshot).toEqual(report.snapshot);
 const fresh=await page.context().browser()!.newContext();const imported=await fresh.newPage();
 await imported.goto(new URL('/history',page.url()).href);
 await imported.getByLabel('导入 CaseLink 文件').setInputFiles(backupPath);
 await imported.getByRole('link',{name:'查看报告',exact:true}).click();
 await expect(imported.getByRole('region',{name:'本案法律研究链'})).toBeVisible();
 const restored=await imported.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('caselink.report.v1.')).map(([,v])=>JSON.parse(v)));
 expect(restored[0].result.snapshot).toEqual(report.snapshot);await fresh.close();
 await page.goto(`/analysis?id=${report.analysisId}`);
 await expect(page.getByRole('region',{name:'本案法律研究链'})).toBeVisible();
 await page.reload();await expect(page.getByRole('region',{name:'本案法律研究链'})).toBeVisible();
 await page.locator(`[data-next-step="${step.actionId}"]`).screenshot({path:testInfo.outputPath(`${localId}-next-step.png`)});
 await page.screenshot({path:testInfo.outputPath(`${localId}.png`),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});

test('六案详情保留原截至日期并展开真实后续来源',async({page})=>{
 for(const id of ['aigul-utepova','alnur-ilyashev','emna-chargui','myriam-bribri','hajar-raissouni','omar-radi-ii-2022']){
  await page.goto(`/cases/${id}`);const section=page.getByRole('region',{name:'历史后续追踪'});
  await expect(section).toBeVisible();await expect(section.getByText(/保留原报告事实截至/)).toBeVisible();
  const event=section.locator('details').first();await event.locator('summary').click();await expect(event.locator('blockquote').first()).toBeVisible();
  await expect(event.getByText(/团队人工审核未完成/).first()).toBeVisible();
 }
});
