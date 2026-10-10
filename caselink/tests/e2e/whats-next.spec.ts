import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {WHATS_NEXT_INPUTS} from '../fixtures/whats-next';

// Only the rule-forcing flag changes. All case facts travel through the ordinary manual UI.
test.beforeEach(async({page})=>{
 await page.route('**/api/analyze',route=>route.continue({postData:JSON.stringify({...route.request().postDataJSON(),forceRule:true})}));
});
async function manualInput(page:Page,index:number){
 const input=WHATS_NEXT_INPUTS[index];await page.goto('/new');
 await page.getByRole('button',{name:/没有文件，直接描述/}).click();
 await page.getByRole('checkbox',{name:'提交时允许调用 AI（关闭不改变案情，使用规则参考）'}).uncheck();
 await page.getByLabel('国家或地区',{exact:true}).fill(input.country);
 if(index===1)await page.getByRole('radio',{name:'英格兰与威尔士',exact:true}).check();
 await page.getByRole('radio',{name:['刑事','民事','行政'][index],exact:true}).check();
 await page.getByRole('group',{name:'这件事和新闻报道或公开表达有关吗？'}).getByRole('radio',{name:'有关',exact:true}).check();
 await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.getByLabel('案情原始描述').fill(input.intake!.narrative);
 await page.getByLabel('你的主要诉求是什么？').fill(input.intake!.goalText);
 await page.getByLabel('具体的披露边界',{exact:true}).fill(input.intake!.disclosureDetails);
 await page.getByLabel('对外公开的意愿',{exact:true}).selectOption('private');
 await page.getByRole('button',{name:'先不用 AI，直接下一步',exact:true}).click();
 const analyzed=page.waitForResponse(r=>r.url().endsWith('/api/analyze')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'确认案情，生成行动参考',exact:true}).click();
 const response=await analyzed;expect(response.ok(),await response.text()).toBe(true);
 const result=await response.json();await expect(page).toHaveURL(/\/analysis$/);return result;
}
for(let index=0;index<3;index++)test(`陌生手动案件 ${index+1}: 三份真实下载、修改引用、快照与移动端`,async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const sentInputs:unknown[]=[];
 page.on('request',request=>{if(request.url().endsWith('/api/analyze'))sentInputs.push(request.postDataJSON().input);});
 const result=await manualInput(page,index);const workspace=page.getByRole('region',{name:'What’s Next workspace'});
 await expect(workspace).toBeVisible();await expect(workspace.locator('[data-work-kind]')).toHaveCount(3);
 expect(result.mode).toBe('rule_reference');expect(result.snapshot.whatsNext.documents).toHaveLength(3);
 if(index===0){expect(result.snapshot.whatsNext.priorities.find((t:{kind:string})=>t.kind==='lawyer_brief').role).toContain('已有当地律师');expect(result.snapshot.whatsNext.questions.some((q:{questionId:string})=>q.questionId==='representation')).toBe(false);expect(result.snapshot.legalResearch.bindings.some((b:{resourceId:string})=>b.resourceId==='iccpr-article-9')).toBe(true);}
 if(index===1){expect(result.snapshot.legalResearch.bindings.some((b:{resourceId:string})=>b.resourceId==='iccpr-article-9')).toBe(false);expect(result.snapshot.whatsNext.priorities[0].title).toContain('函件');expect(result.snapshot.whatsNext.priorities.flatMap((t:{history:unknown[]})=>t.history)).toHaveLength(0);}
 if(index===2){expect(result.snapshot.whatsNext.priorities.flatMap((t:{history:unknown[]})=>t.history)).toHaveLength(0);expect(result.snapshot.whatsNext.documents[2].markdown).toContain('日期未确认');}
 expect((sentInputs[0] as {exampleId:unknown}).exampleId).toBe(null);expect((sentInputs[0] as {isExample:boolean}).isExample).toBe(false);
 await writeFile(testInfo.outputPath('ordinary-input.json'),JSON.stringify(sentInputs[0],null,2));
 await writeFile(testInfo.outputPath('complete-output.json'),JSON.stringify(result,null,2));
 await page.setViewportSize({width:1440,height:1500});await workspace.evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-175,behavior:'instant'}));await page.screenshot({path:testInfo.outputPath('priority-cards.png')});await page.setViewportSize({width:1440,height:1000});
 for(const kind of ['timeline','issue_matrix','lawyer_brief']){
  await workspace.locator(`[data-document-tab="${kind}"]`).click();
  const ready=page.waitForEvent('download');await workspace.locator(`[data-download-kind="${kind}"]`).click();const download=await ready;
  const path=testInfo.outputPath(download.suggestedFilename());await download.saveAs(path);const markdown=await readFile(path,'utf8');
  expect(markdown).toContain(WHATS_NEXT_INPUTS[index].intake!.narrative);expect(markdown).toContain(WHATS_NEXT_INPUTS[index].intake!.disclosureDetails);
  expect(markdown).toContain('冻结来源与命题定位');expect(markdown).toContain('用户记录的实际进度: draft');expect(markdown.length).toBeGreaterThan(900);
 }
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('caselink.report.v1.')))).toHaveLength(0);
 await workspace.getByRole('button',{name:'编辑本案草稿',exact:true}).click();const editor=workspace.getByRole('textbox',{name:'本案材料正文'});
 await editor.fill((await editor.inputValue())+'\n使用者补充：文书仍待核对，旧引用不能证明新命题。');
 await expect(workspace.locator('[data-citation-state="needs_review"]')).toBeVisible();
 await workspace.getByRole('button',{name:'预览当前草稿',exact:true}).click();
 await page.getByRole('button',{name:'主动保存到历史',exact:true}).click();
 const saved=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('caselink.report.v1.')).map(([,v])=>JSON.parse(v)));
 expect(saved).toHaveLength(1);expect(saved[0].result.snapshot.whatsNext.documents.find((d:{kind:string})=>d.kind==='lawyer_brief').citationState).toBe('needs_review');
 if(index===0){
  await workspace.getByRole('link',{name:'补充缺失信息',exact:true}).first().click();
  await page.getByRole('navigation',{name:'先听懂案情，再决定下一问'}).getByRole('button',{name:/用自己的话说/}).click();
  await page.getByLabel('案情原始描述').fill(WHATS_NEXT_INPUTS[0].intake!.narrative+'补充事实：家属称律师已于2026-10-09会面，但会面记录尚未提供。');
  await page.getByRole('button',{name:'先不用 AI，直接下一步',exact:true}).click();
  const recalculated=page.waitForResponse(r=>r.url().endsWith('/api/analyze')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'确认案情，生成行动参考',exact:true}).click();expect((await recalculated).ok()).toBe(true);
  await expect(page).toHaveURL(/\/analysis$/);await workspace.locator('[data-document-tab="lawyer_brief"]').click();
  await expect(workspace.getByRole('heading',{name:'案情已改变：人工稿需要合并'})).toBeVisible();
  await workspace.getByText('查看根据新事实生成的稿件',{exact:true}).click();await expect(workspace.getByText('查看根据新事实生成的稿件',{exact:true}).locator('..').getByText(/补充事实：家属称律师已于2026-10-09会面/).first()).toBeVisible();
  await workspace.getByRole('button',{name:'保留人工稿继续核对',exact:true}).click();await expect(workspace.getByText('使用者补充：文书仍待核对，旧引用不能证明新命题。',{exact:true})).toBeVisible();
 }
 await page.locator('#working-document-panel').evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-175,behavior:'instant'}));await page.screenshot({path:testInfo.outputPath('whats-next-desktop.png')});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await workspace.evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-140,behavior:'instant'}));await page.screenshot({path:testInfo.outputPath('whats-next-mobile.png')});
 await page.goto(`/analysis?id=${result.analysisId}`);await expect(workspace).toBeVisible();
 await workspace.locator('[data-document-tab="lawyer_brief"]').click();await workspace.getByRole('button',{name:'编辑本案草稿',exact:true}).click();
 await workspace.getByRole('textbox',{name:'本案材料正文'}).fill('历史修订副本：仅用于测试保留原始快照。');
 const after=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('caselink.report.v1.')).map(([,v])=>JSON.parse(v)));
 expect(after).toEqual(saved);expect(errors).toEqual([]);
});

test('跨案比较保留后续记录、事件性质、来源日期与实际导出',async({page},testInfo)=>{
 await page.goto('/compare');
 await page.getByRole('checkbox',{name:/Aigul Utepova/}).check();await page.getByRole('checkbox',{name:/Alnur Ilyashev/}).check();
 await page.getByRole('button',{name:/生成比较快照/}).click();await expect(page.getByText('后续行动、另案与后来结果',{exact:true})).toBeVisible();
 const ready=page.waitForEvent('download');await page.getByRole('button',{name:'导出交接简报 Markdown',exact:true}).click();const download=await ready;const path=testInfo.outputPath(download.suggestedFilename());await download.saveAs(path);
 const markdown=await readFile(path,'utf8');expect(markdown).toContain('后续行动与结果比较');expect(markdown).toContain('alnur-ilyashev');expect(markdown).toContain('aigul-utepova');expect(markdown).toContain('检索截止（不是状态确认日）');expect(markdown).toContain('recorded');
 await page.screenshot({path:testInfo.outputPath('comparison-desktop.png')});
});
