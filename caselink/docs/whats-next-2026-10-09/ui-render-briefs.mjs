/** Print the actual browser-downloaded Markdown. No facts or citations are regenerated. */
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from '@playwright/test';
const evidence=resolve('docs/whats-next-2026-10-09/ui-evidence');
const output=resolve('output/pdf');const temporary=resolve('tmp/pdfs');
await mkdir(output,{recursive:true});await mkdir(temporary,{recursive:true});
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(md){return md.split('\n').filter(l=>l.trim()).map(line=>line.startsWith('# ')?`<h1>${escape(line.slice(2))}</h1>`:line.startsWith('## ')?`<h2>${escape(line.slice(3))}</h2>`:line.startsWith('### ')?`<h3>${escape(line.slice(4))}</h3>`:line.startsWith('> ')?`<blockquote>${escape(line.slice(2))}</blockquote>`:`<p>${escape(line)}</p>`).join('\n');}
function html(body,appendix=''){return `<!doctype html><html lang="zh"><meta charset="utf-8"><title>CaseLink · Internal counsel brief</title><style>@page{size:A4;margin:13mm 15mm 14mm}*{box-sizing:border-box}body{font-family:"PingFang SC","Arial",sans-serif;font-size:10pt;line-height:1.4;color:#19352c;margin:0}h1,h2,h3{break-after:avoid}h1{font-size:18pt;line-height:1.2;margin:0 0 7pt;padding-bottom:7pt;border-bottom:2pt solid #294f3b}h2{font-size:11.5pt;line-height:1.2;margin:8pt 0 3pt;color:#244e39}h3{font-size:10pt;margin:8pt 0 4pt}p{margin:2pt 0;overflow-wrap:anywhere}blockquote{margin:5pt 0;padding:4pt 8pt;border-left:2pt solid #aabb9c;font-size:9pt;color:#4e6353}.appendix{break-before:page;font-size:9.5pt;line-height:1.5}.appendix h1{font-size:16pt}.brand{font-size:8pt;letter-spacing:.18em;color:#627767;margin-bottom:5pt}.footer{margin-top:8pt;font-size:8pt;color:#647766;border-top:.5pt solid #bdcabc;padding-top:5pt}</style><body><section class="body"><div class="brand">CASELINK · INTERNAL RESEARCH · 2026-10-09</div>${render(body)}<div class="footer">内部草稿 / Internal working draft · 不代表法律判断或已完成外部行动。完整来源与核查状态见独立附件。</div></section>${appendix?`<section class="appendix"><h1>引用附件 · Sources and verification</h1>${render(appendix)}</section>`:''}</body></html>`;}
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const manifest=[];
for(const directory of (await readdir(evidence)).filter(name=>name.startsWith('case-')).sort()){
 const path=join(evidence,directory);const files=(await readdir(path)).filter(name=>name.includes('lawyer_brief')&&name.endsWith('.md'));if(files.length!==1)throw new Error('Expected exactly one actual downloaded brief: '+directory);const file=files[0];
 const markdown=await readFile(join(path,file),'utf8');const marker='—— 以下为引用附件，独立于一页简报正文 ——';if(!markdown.includes(marker))throw new Error('No explicit appendix split');const [body,appendix]=markdown.split(marker);
 const full=html(body,appendix);await writeFile(join(output,directory+'-counsel-brief.html'),full);await page.setContent(full,{waitUntil:'load'});await page.pdf({path:join(output,directory+'-counsel-brief.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
 await page.setContent(html(body),{waitUntil:'load'});await page.pdf({path:join(temporary,directory+'-body-only.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
 manifest.push({case:directory,markdown:join(path,file),fullPdf:join(output,directory+'-counsel-brief.pdf'),bodyOnlyPdf:join(temporary,directory+'-body-only.pdf'),bodyCharacters:body.length});
}
await browser.close();await writeFile(join(evidence,'brief-print-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
