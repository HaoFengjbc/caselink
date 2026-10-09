import {AnalysisError} from '../ai/errors';
import {executionFor} from '../usage/runtime';
import {readIntakeConfig,type IntakeConfig} from '../intake/service';
import {MaterialResponseSchema,type MaterialRequest,type MaterialResponse} from './contracts';
import {parseMaterials,releaseUploads,type MaterialUpload,type MaterialEmitter} from './parse';
import {extractMaterials,type MaterialTransport} from './extract';

export type MaterialServiceOptions={signal?:AbortSignal;emit?:MaterialEmitter;config?:IntakeConfig;transport?:MaterialTransport;paid?:<T extends MaterialResponse>(work:()=>Promise<T>)=>Promise<T>};
/** The only upload lifetime. On success, failure or cancellation upload buffers are released. */
export async function organizeMaterials(files:MaterialUpload[],request:MaterialRequest,options:MaterialServiceOptions={}):Promise<MaterialResponse>{
  try{
    const documents=await parseMaterials(files,{locale:request.locale,signal:options.signal,emit:options.emit,existingPageCount:request.existingPageCount,existingFileCount:request.existingFileCount});
    const warnings=documents.flatMap(document=>document.warnings);
    const config=request.aiConsent?(options.config??readIntakeConfig()):undefined;
    const local=()=>MaterialResponseSchema.parse({mode:'local_text',documents,candidates:[],warnings,execution:{...executionFor(request,0),actualCostUsd:0}});
    if(!request.aiConsent||config?.mode!=='live'||!documents.some(document=>document.processedPages.length))return local();
    if(!options.paid)throw new AnalysisError('USAGE_CONTROL_UNAVAILABLE','付费材料整理必须通过用量保护；没有调用模型。',503);
    return await options.paid(async()=>{
      options.emit?.({type:'stage',stage:'organizing'});
      const candidates=await extractMaterials(documents,{locale:request.locale,background:request.background,config:config!,signal:options.signal,transport:options.transport});
      return MaterialResponseSchema.parse({mode:'live_ai',documents,candidates,model:config!.model,warnings});
    });
  }finally{releaseUploads(files);}
}
