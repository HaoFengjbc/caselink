import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

// The rule analysis runs for real; only its key questions are replaced by an AI-shaped, already-checked record. No model is called.
test('key questions show facts, three kinds of basis, the analysis and links from actions',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route('**/api/analyze',async route=>{
  const response=await route.fetch({postData:JSON.stringify({...route.request().postDataJSON(),forceRule:true})});const result=await response.json();
  const binding=result.legalResearch.bindings[0];const evidence=result.sources[0];
  const caseIssues=[{issueId:'issue-1',question:'2012 年 5 月的文章，能否按 2012 年 9 月才签署的新法定罪？',origin:'ai',facts:[{text:'文章于 2012 年 5 月 29 日发表。',origin:'document',pageLabel:'第 4 页'},{text:'当事人称已委托当地律师。',origin:'user',pageLabel:null}],
   authorities:[{kind:'local',check:'quote_matched',title:'Republic Act No. 10175',locator:'Section 4(c)(4)',point:'网络诽谤的定义。',quote:'The unlawful or prohibited acts of libel as defined in Article 355 of the Revised Penal Code',url:'https://www.officialgazette.gov.ph/2012/09/12/republic-act-no-10175/',hostname:'www.officialgazette.gov.ph',bindingId:null,caseId:null,evidenceIds:[]},
    {kind:'international',check:'catalog',title:'ICCPR 第 19 条：表达自由',locator:'Article 19(2)–(3)',point:binding.claim,quote:'provided by law',url:'https://www.ohchr.org/en/instruments-mechanisms/instruments/international-covenant-civil-and-political-rights',hostname:'www.ohchr.org',bindingId:binding.bindingId,caseId:null,evidenceIds:[]},
    ...(evidence?[{kind:'case',check:'library',title:'可比案例',locator:null,point:'可比的辩护行动。',quote:null,url:null,hostname:null,bindingId:null,caseId:evidence.caseId,evidenceIds:[evidence.evidenceId]}]:[])],
   application:'如果改错字不算重新发表，新法就无从适用，这是上诉的主线。',nextStep:'当地律师确认上诉书状进度。'},
  {issueId:'issue-2',question:'诽谤的一年追诉期已过，为何还能起诉？',origin:'ai',facts:[{text:'调查局曾以追诉期届满驳回投诉。',origin:'document',pageLabel:'第 8 页'}],authorities:[],application:null,nextStep:null}];
  result.caseIssues=caseIssues;result.snapshot.caseIssues=caseIssues;result.actionOptions[0].issueIds=['issue-2'];
  await route.fulfill({response,json:result});
 });
 await page.goto('/');await page.getByRole('button',{name:'体验示例案件'}).click();await page.getByRole('button',{name:/记者受限/}).click();await page.getByRole('button',{name:'载入示例并查看案情'}).click();
 await page.getByRole('button',{name:'查找案例并生成行动参考'}).click();await expect(page).toHaveURL(/\/analysis$/);
 const issues=page.getByRole('region',{name:'本案的关键问题'});
 await expect(issues.getByRole('heading',{name:'本案的 2 个关键问题'})).toBeVisible();
 await expect(issues.getByText(/标“原文已核对”的本地法条，服务器已打开原网页逐字核对/)).toBeVisible();
 const first=issues.locator('#issue-1');
 await expect(first.getByText('第 4 页',{exact:true})).toBeVisible();await expect(first.getByText('用户陈述',{exact:true})).toBeVisible();
 await expect(first.getByText('本地法 · 原文已核对',{exact:true})).toBeVisible();await expect(first.getByText('国际标准',{exact:true})).toBeVisible();
 await expect(first.getByRole('link',{name:/打开原文 · www\.officialgazette\.gov\.ph/})).toHaveAttribute('href',/officialgazette\.gov\.ph/);
 await expect(first.getByText('AI 分析',{exact:true})).toBeVisible();
 const second=issues.locator('#issue-2');
 await expect(second).not.toHaveAttribute('open','');
 await page.getByRole('button',{name:'→ 问题 2'}).click();
 await expect(second).toHaveAttribute('open','');
 await expect(second.getByText('没有可核对的依据支撑分析，请当地律师判断。',{exact:true})).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:testInfo.outputPath('issues-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await issues.evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-80,behavior:'instant'}));await page.screenshot({path:testInfo.outputPath('issues-mobile.png')});
 // The brief carries the same questions.
 await page.setViewportSize({width:1440,height:1000});
 const downloading=page.waitForEvent('download');await page.locator('[data-download-kind="lawyer_brief"]').click();
 const text=await readFile((await (await downloading).path())!,'utf8');
 expect(errors).toEqual([]);expect(text).toContain('## 关键问题');
});
