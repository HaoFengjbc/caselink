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
(async()=>{
 const pdfjs=await import(pdfjsUrl);
 const cMapUrl=fileURLToPath(new URL('../../cmaps/',pdfjsUrl));
 const standardFontDataUrl=fileURLToPath(new URL('../../standard_fonts/',pdfjsUrl));
 let remainingBytes=limits.maxTextBytes,totalPages=existingPageCount;
 const output=[];
 for(const file of files){
  const {filename,fileId,bytes}=file;
  emit({type:'stage',stage:'reading',fileId,filename});
  const task=pdfjs.getDocument({data:bytes,cMapUrl,cMapPacked:true,standardFontDataUrl,enableXfa:false,useWasm:false,useSystemFonts:false,disableFontFace:true,useWorkerFetch:false,disableAutoFetch:true,verbosity:0,maxImageSize:16000000,stopAtErrors:true});
  try{
   const doc=await task.promise;
   if(await doc.getPermissions()!==null)throw fail('INVALID_INPUT',copy(filename+' 已加密；请在本地提供未加密副本。',filename+' is encrypted. Provide an unencrypted copy from your device.'));
   totalPages+=doc.numPages;
   if(doc.numPages<1||totalPages>limits.maxPages)throw fail('PAYLOAD_TOO_LARGE',copy('本次 PDF 总页数超过 30 页；未调用 AI。请提供选定页面的副本。','The PDFs exceed 30 pages in total. AI was not called. Provide copies containing the selected pages.'),413);
   const pages=[],warnings=[];
   for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){
    // PDF PageLabels are metadata, not verified printed page numbers.
    const printedPage=null;
    if(remainingBytes===0){pages.push({pdfPage:pageNumber,text:'',status:'omitted',printedPage});continue;}
    let page;
    try{
     page=await doc.getPage(pageNumber);
     const content=await page.getTextContent();
     const text=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('').replace(/[\t ]+\n/g,'\n').trim();
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
   const omitted=pages.filter(p=>p.status==='omitted').map(p=>p.pdfPage);
   if(omitted.length)warnings.push(copy('超过 75,000 字节文字预算，PDF 物理页 '+omitted.join(', ')+' 未处理。','The 75,000-byte text budget was reached. Physical PDF pages '+omitted.join(', ')+' were not processed.'));
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
