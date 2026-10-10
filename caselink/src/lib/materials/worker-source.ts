/** Static worker program, bundled as a string so Next does not need a separately copied runtime file.
 * It receives only bytes and parser metadata, has no provider or filesystem output code, and runs
 * in a separate V8 isolate that the parent can terminate even during synchronous PDF parsing.
 */
export const PDF_WORKER_SOURCE=String.raw`
const {parentPort,workerData}=require('node:worker_threads');
const {fileURLToPath}=require('node:url');
const {files,locale,limits,existingPageCount,pdfjsUrl}=workerData;
const copy=(zh,en)=>locale==='en'?en:zh;
const fail=(code,message,status=422)=>Object.assign(new Error(message),{safe:true,code,status});
const emit=event=>parentPort.postMessage({type:'event',event});
// PDF.js already emits the spaces between words. Adding one after every text item split words at
// font or kerning changes ("defa mation", "2026 年") and doubled real spaces, so quotes stopped matching.
// A space is added only where the next item starts after a visible gap on the same baseline.
const joinTextItems=items=>{
 let text='',last=null;
 for(const item of items){
  if(!('str' in item))continue;
  const str=item.str;
  if(last&&!last.hasEOL&&str&&text&&!/\s$/.test(text)&&!/^\s/.test(str)){
   const t=item.transform,lt=last.transform,size=Math.hypot(t[2],t[3])||10;
   const rise=Math.abs(t[5]-lt[5]),gap=t[4]-(lt[4]+(last.width||0));
   // A new line PDF.js did not mark; superscripts and subscripts stay attached to their word.
   if(rise>size*0.9)text+='\n';
   else if(rise<=size*0.3&&gap>size*0.12)text+=' ';
  }
  text+=str;
  if(item.hasEOL)text+='\n';
  if(str||item.hasEOL)last=item;
 }
 // Fonts such as PingFang map some glyphs to look-alike Kangxi radicals (⽉ U+2F49 for 月); restore the
 // ordinary characters so the text shown, sent to AI and quoted is the same text a reader sees.
 return text.replace(/[\u2E80-\u2EFF\u2F00-\u2FDF]/g,ch=>ch.normalize('NFKC')).replace(/[\t \u00A0]+\n/g,'\n').replace(/[\t \u00A0]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();
};
(async()=>{
 const pdfjs=await import(pdfjsUrl);
 const cMapUrl=fileURLToPath(new URL('../../cmaps/',pdfjsUrl));
 const standardFontDataUrl=fileURLToPath(new URL('../../standard_fonts/',pdfjsUrl));
 // Pages beyond the page allowance or text budget are listed as not processed instead of refusing the whole PDF.
 let remainingBytes=limits.maxTextBytes,remainingPages=Math.max(0,limits.maxPages-existingPageCount);
 const output=[];
 for(const file of files){
  const {filename,fileId,bytes}=file;
  emit({type:'stage',stage:'reading',fileId,filename});
  const task=pdfjs.getDocument({data:bytes,cMapUrl,cMapPacked:true,standardFontDataUrl,isEvalSupported:false,enableXfa:false,useWasm:false,useSystemFonts:false,disableFontFace:true,useWorkerFetch:false,disableAutoFetch:true,verbosity:0,maxImageSize:16000000,stopAtErrors:true});
  try{
   const doc=await task.promise;
   if(await doc.getPermissions()!==null)throw fail('INVALID_INPUT',copy(filename+' 已加密；请在本地提供未加密副本。',filename+' is encrypted. Provide an unencrypted copy from your device.'));
   if(doc.numPages<1)throw fail('INVALID_INPUT',copy(filename+' 没有可读取的页面。',filename+' has no readable pages.'));
   const pages=[],warnings=[],beyondAllowance=[];
   for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){
    if(remainingPages===0){beyondAllowance.push(pageNumber);continue;}
    remainingPages--;
    // PDF PageLabels are metadata, not verified printed page numbers.
    const printedPage=null;
    if(remainingBytes===0){pages.push({pdfPage:pageNumber,text:'',status:'omitted',printedPage});continue;}
    let page;
    try{
     page=await doc.getPage(pageNumber);
     const content=await page.getTextContent();
     const text=joinTextItems(content.items);
     const byteLength=Buffer.byteLength(text,'utf8');
     if(byteLength>remainingBytes){remainingBytes=0;pages.push({pdfPage:pageNumber,text:'',status:'omitted',printedPage});continue;}
     if(text.replace(/\s/g,'').length>=8){remainingBytes-=byteLength;pages.push({pdfPage:pageNumber,text,status:'read',printedPage});}
     else{
      const operators=await page.getOperatorList();
      const imageOps=[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,pdfjs.OPS.paintImageMaskXObject,pdfjs.OPS.paintImageXObjectRepeat,pdfjs.OPS.paintImageMaskXObjectRepeat];
      const imageOnly=operators.fnArray.some(op=>imageOps.includes(op));
      pages.push({pdfPage:pageNumber,text,status:imageOnly?'image_only':text?'unreadable':'blank',printedPage});
     }
    }catch{pages.push({pdfPage:pageNumber,text:'',status:'unreadable',printedPage});}
    finally{page?.cleanup();}
   }
   const unreadable=pages.filter(p=>!['read','omitted'].includes(p.status));
   if(unreadable.length)warnings.push(copy('PDF 物理页 '+unreadable.map(p=>p.pdfPage).join(', ')+' 为空白、扫描图像或无法可靠提取文字；未做 OCR。请核对原件，必要时粘贴文字。','Physical PDF pages '+unreadable.map(p=>p.pdfPage).join(', ')+' are blank, image-only or lack reliable text. OCR was not performed. Check the original and paste text if needed.'));
   const overBudget=pages.filter(p=>p.status==='omitted').map(p=>p.pdfPage),omitted=[...overBudget,...beyondAllowance];
   const range=list=>list.length>1&&list.at(-1)-list[0]===list.length-1?list[0]+'–'+list.at(-1):list.join(', ');
   if(overBudget.length)warnings.push(copy('超过 75,000 字节文字预算，PDF 物理页 '+range(overBudget)+' 未处理。','The 75,000-byte text budget was reached. Physical PDF pages '+range(overBudget)+' were not processed.'));
   if(beyondAllowance.length)warnings.push(copy(filename+' 共 '+doc.numPages+' 页；每次最多读取 '+limits.maxPages+' 页，PDF 物理页 '+range(beyondAllowance)+' 未处理。需要时请拆分 PDF 后再上传。',filename+' has '+doc.numPages+' pages; at most '+limits.maxPages+' pages are read per upload, so physical PDF pages '+range(beyondAllowance)+' were not processed. Split the PDF if those pages matter.'));
   const result={fileId,filename,size:file.size,pageCount:doc.numPages,pages,processedPages:pages.filter(p=>p.status==='read').map(p=>p.pdfPage),unreadablePages:unreadable.map(p=>p.pdfPage),omittedPages:omitted,warnings};
   output.push(result);emit({type:'document',document:result});
  }catch(error){
   if(error.safe)throw error;
   const encrypted=error?.name==='PasswordException';
   throw fail('INVALID_INPUT',copy(encrypted?filename+' 已加密；请在本地提供未加密副本。':filename+' 损坏或无法可靠读取，请重新导出 PDF。',encrypted?filename+' is encrypted. Provide an unencrypted copy from your device.':filename+' is damaged or cannot be read reliably. Export the PDF again.'));
  }finally{await task.destroy();}
 }
 parentPort.postMessage({type:'complete',documents:output});
})().catch(error=>parentPort.postMessage({type:'failure',code:error.safe?error.code:'INVALID_INPUT',message:error.safe?error.message:copy('PDF 解析器未能读取材料。','The PDF parser could not read these materials.'),status:error.safe?error.status:422})).finally(()=>parentPort.close());
`;
