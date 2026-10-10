import {executionFor,runExecution} from '../ai/execution';
import {readMaterialConfig,type MaterialConfig} from './config';
import {MaterialResponseSchema,type MaterialRequest,type MaterialResponse} from './contracts';
import {parseMaterials,releaseUploads,type MaterialUpload,type MaterialEmitter} from './parse';
import {emptyMaterialValidationReport,extractMaterials,type MaterialTransport} from './extract';

export type MaterialServiceOptions={signal?:AbortSignal;emit?:MaterialEmitter;config?:MaterialConfig;transport?:MaterialTransport};
/** The only upload lifetime. On success, failure or cancellation upload buffers are released. */
export async function organizeMaterials(files:MaterialUpload[],request:MaterialRequest,options:MaterialServiceOptions={}):Promise<MaterialResponse>{
  try{
    const documents=await parseMaterials(files,{locale:request.locale,signal:options.signal,emit:options.emit,existingPageCount:request.existingPageCount,existingFileCount:request.existingFileCount});
    const warnings=documents.flatMap(document=>document.warnings);
    const config=request.aiConsent?(options.config??readMaterialConfig()):undefined;
    const local=()=>MaterialResponseSchema.parse({mode:'local_text',documents,candidates:[],warnings,execution:{...executionFor(request),actualCostUsd:0}});
    if(!request.aiConsent||config?.mode!=='live'||!documents.some(document=>document.processedPages.length))return local();
    return await runExecution(request,'material',async()=>{
      options.emit?.({type:'stage',stage:'organizing'});
      const report=emptyMaterialValidationReport();
      const candidates=await extractMaterials(documents,{locale:request.locale,background:request.background,config:config!,signal:options.signal,transport:options.transport,report});
      const en=request.locale==='en';
      if(report.droppedItems)warnings.push(en?`${report.droppedItems} AI item(s) could not be matched to the PDF text and were left out. Every remaining item is checked against the original; you can read the extracted text below.`:`AI 整理的 ${report.droppedItems} 项在 PDF 原文中找不到对应文字，已略过；其余各项均已逐条对照原文，可在下方查看已读取文字。`);
      if(report.relocatedSources)warnings.push(en?`${report.relocatedSources} citation(s) were moved to the page where the words actually appear.`:`${report.relocatedSources} 处引文已按原文实际所在的页码更正。`);
      const datesForReview=candidates.reduce((count,candidate)=>count+candidate.items.filter(item=>item.dateReview&&!item.dateReview.resolution).length,0);
      if(datesForReview)warnings.push(request.locale==='en'?`${datesForReview} date item(s) need your review; their AI dates and related drafts were not adopted. Other checked items are ready to review.`:`${datesForReview} 项日期需要核对；相关 AI 日期和草稿未采用，其余已通过来源校验的内容已整理。`);
      return MaterialResponseSchema.parse({mode:'live_ai',documents,candidates,model:config!.model,warnings});
    });
  }finally{releaseUploads(files);}
}
