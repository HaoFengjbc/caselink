import {test,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';

// Production-build HTTP and browser PDF parser tests. No response interception and no AI permission.
test('REAL local parser: two text PDFs, a scan, blank, corrupt, encrypted and page-limit errors',async({request})=>{
 for(const [files,expected] of [
  [['expression-letter.pdf','expression-update.pdf'],'read'],[['scanned-image.pdf'],'image_only'],[['blank.pdf'],'blank'],[['encrypted.pdf'],'INVALID_INPUT'],[['corrupt.pdf'],'INVALID_INPUT'],[['too-many-pages.pdf'],'PAYLOAD_TOO_LARGE'],[['text-budget.pdf'],'omitted'],
 ] as [string[],string][]){
  const form=new FormData();form.set('metadata',JSON.stringify({requestId:crypto.randomUUID(),inputVersion:1,operation:'initial',locale:'en',aiConsent:false,background:''}));
  for(const name of files)form.append('files',new Blob([await readFile(path.join('tests/fixtures/pdf',name))],{type:'application/pdf'}),name);
  const serialized=new Response(form),bytes=Buffer.from(await serialized.arrayBuffer());
  const response=await request.post('/api/materials',{headers:{'content-type':serialized.headers.get('content-type')!},data:bytes});
  expect(response.headers()['cache-control']).toContain('no-store');const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line)),last=events.at(-1);
  if(expected==='INVALID_INPUT'||expected==='PAYLOAD_TOO_LARGE'){expect(last).toMatchObject({type:'error',code:expected});expect(events.some(event=>event.type==='result')).toBe(false);}
  else{expect(last).toMatchObject({type:'result',result:{mode:'local_text',candidates:[]}});expect(last.result.documents.flatMap((doc:{pages:{status:string}[]})=>doc.pages.map(page=>page.status))).toContain(expected);if(files.length===2)expect(last.result.documents.map((doc:{pageCount:number})=>doc.pageCount)).toEqual([2,1]);}
 }
});

test('REAL browser upload: AI off can read text, reports scans honestly, and never creates extracted facts',async({page})=>{
 let aiCalls=0;page.on('request',request=>{if(request.url().includes('/api/materials')){const body=request.postDataBuffer()?.toString()??'';if(body.includes('"aiConsent":true'))aiCalls++;}});
 await page.goto('/new');await page.getByRole('checkbox',{name:/提交时允许调用 AI/}).uncheck();
 await page.getByLabel('选择案件 PDF').setInputFiles(['tests/fixtures/pdf/expression-letter.pdf']);await page.getByRole('button',{name:'仅提取文字（不调用 AI）',exact:true}).click();
 await expect(page.getByText('已在应用服务器本地提取文字，未调用模型。可复制文字到手动描述。',{exact:true})).toBeVisible();
 await page.getByText('expression-letter.pdf · 本地提取文字',{exact:true}).click();await expect(page.locator('pre').first()).toContainText('Mira Vale');await expect(page.locator('[data-material-item]')).toHaveCount(0);
 await mkdir('test-results/pdf-intake',{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/pdf-intake/actual-local-text.png',fullPage:true});
 await page.getByRole('button',{name:'移除 expression-letter.pdf',exact:true}).click();await page.getByLabel('选择案件 PDF').setInputFiles(['tests/fixtures/pdf/scanned-image.pdf']);await page.getByRole('button',{name:'仅提取文字（不调用 AI）',exact:true}).click();
 await page.getByText('scanned-image.pdf · 本地提取文字',{exact:true}).click();await expect(page.getByText('PDF 1 · image_only',{exact:true})).toBeVisible();await expect(page.getByText('此页无可提取文字。',{exact:true})).toBeVisible();expect(aiCalls).toBe(0);
});
