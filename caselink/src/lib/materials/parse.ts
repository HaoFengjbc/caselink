import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';
import {PDF_WORKER_SOURCE} from './worker-source';
import {AnalysisError} from '../ai/errors';
import type {Locale} from '../i18n/locale';
import {MATERIAL_LIMITS,ParsedMaterialSchema,type ParsedMaterial,type MaterialStreamEvent} from './contracts';

export type MaterialUpload={name:string;type:string;bytes:Uint8Array};
export type MaterialEmitter=(event:MaterialStreamEvent)=>void;
const copy=(locale:Locale,zh:string,en:string)=>locale==='en'?en:zh;
export function safeMaterialFilename(name:string):string{
  return (name.split(/[\\/]/).at(-1)??'material.pdf').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,180)||'material.pdf';
}
export const materialFileId=(bytes:Uint8Array)=>`pdf-${createHash('sha256').update(bytes).digest('hex')}`;
export function releaseUploads(files:MaterialUpload[]):void{for(const file of files){try{file.bytes.fill(0);}catch{/* PDF.js may already have transferred its private copy. */}}files.length=0;}
const cancelled=(locale:Locale)=>new AnalysisError('CANCELLED',copy(locale,'材料读取已取消。','Material reading was cancelled.'),499);

/** Memory-only parsing. Never opens links, runs PDF JavaScript, rasterizes or calls a provider. */
export async function parseMaterials(files:MaterialUpload[],options:{locale:Locale;signal?:AbortSignal;emit?:MaterialEmitter;existingPageCount?:number;existingFileCount?:number}):Promise<ParsedMaterial[]>{
  const {locale,signal,emit}=options;
  if(signal?.aborted)throw cancelled(locale);
  if(!files.length||files.length+(options.existingFileCount??0)>MATERIAL_LIMITS.maxFiles)throw new AnalysisError('INVALID_INPUT',copy(locale,'每次请选择同案的 1–3 份 PDF。','Choose 1–3 PDFs for the same case.'));
  if(files.reduce((total,file)=>total+file.bytes.byteLength,0)>MATERIAL_LIMITS.maxTotalFileBytes)throw new AnalysisError('PAYLOAD_TOO_LARGE',copy(locale,'文件总大小超过 3,900,000 字节。请减少材料。','The files exceed 3,900,000 bytes in total. Please reduce the materials.'),413);
  const ids=new Set<string>();
  for(const file of files){
    const name=safeMaterialFilename(file.name);
    emit?.({type:'stage',stage:'checking',filename:name});
    if(!file.bytes.byteLength)throw new AnalysisError('INVALID_INPUT',copy(locale,`${name} 是空文件。`,`${name} is empty.`));
    if(file.bytes.byteLength>MATERIAL_LIMITS.maxFileBytes)throw new AnalysisError('PAYLOAD_TOO_LARGE',copy(locale,`${name} 超过每份 3 MiB 的限制。`,`${name} exceeds the 3 MiB per-file limit.`),413);
    if(Buffer.from(file.bytes.subarray(0,5)).toString('ascii')!=='%PDF-')throw new AnalysisError('INVALID_INPUT',copy(locale,`${name} 不是真实 PDF 文件。`,`${name} is not a PDF file.`),415);
    const id=materialFileId(file.bytes);if(ids.has(id))throw new AnalysisError('INVALID_INPUT',copy(locale,'同一 PDF 被重复选择，请移除重复文件。','The same PDF was selected twice. Remove the duplicate.'));ids.add(id);
  }
  if(activeParsers>=2)throw new AnalysisError('PARSER_BUSY',copy(locale,'当前材料读取繁忙，请稍后重试。','Material reading is busy. Please retry shortly.'),429,{retryable:true,retryAfterSeconds:5});
  activeParsers++;
  let worker:Worker|undefined;
  try{
    // Resolve through the actual Node runtime: webpack must not rewrite this ESM path into a require stub.
    const require=process.getBuiltinModule('module').createRequire(`${process.cwd()}/package.json`);
    worker=new Worker(PDF_WORKER_SOURCE,{eval:true,resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:32,stackSizeMb:4},workerData:{files:files.map(file=>({filename:safeMaterialFilename(file.name),fileId:materialFileId(file.bytes),size:file.bytes.byteLength,bytes:new Uint8Array(file.bytes)})),locale,limits:MATERIAL_LIMITS,existingPageCount:options.existingPageCount??0,pdfjsUrl:pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href}});
    return await awaitPdfWorker(worker,options);
  }catch(error){if(error instanceof AnalysisError)throw error;throw new AnalysisError('CONFIGURATION_ERROR',copy(locale,'PDF 读取环境暂不可用，请联系管理员检查解析器部署。','The PDF reading runtime is unavailable. Ask the administrator to check the parser deployment.'),503);}
  finally{if(worker)await worker.terminate();activeParsers--;}
}
let activeParsers=0;

/** Owns worker termination, including workers blocked in synchronous parsing. */
export function awaitPdfWorker(worker:Worker,options:{locale:Locale;signal?:AbortSignal;emit?:MaterialEmitter;timeoutMs?:number}):Promise<ParsedMaterial[]>{
  const {locale,signal,emit}=options;
  const current=worker;
  return new Promise<ParsedMaterial[]>((resolve,reject)=>{
      let settled=false;
      const finish=(error?:AnalysisError,documents?:ParsedMaterial[])=>{
        if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);
        void current.terminate().finally(()=>error?reject(error):resolve(documents!));
      };
      const cancel=()=>finish(cancelled(locale));
      const timer=setTimeout(()=>finish(new AnalysisError('TIMEOUT',copy(locale,'PDF 读取超过 15 秒，解析进程已终止；请缩小材料后重试。','PDF reading exceeded 15 seconds and its parser was terminated. Reduce the materials and retry.'),504)),options.timeoutMs??MATERIAL_LIMITS.parseTimeoutMs);
      signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted){cancel();return;}
      current.on('message',(message:{type:string;event?:MaterialStreamEvent;documents?:unknown[];code?:AnalysisError['code'];message?:string;status?:number})=>{
        if(settled)return;
        if(message.type==='event'&&message.event){emit?.(message.event);return;}
        if(message.type==='complete'){
          const parsed=ParsedMaterialSchema.array().safeParse(message.documents);
          finish(parsed.success?undefined:new AnalysisError('INVALID_INPUT',copy(locale,'PDF 读取结果无效，未采用结果。','The PDF parser returned invalid output.'),422),parsed.success?parsed.data:undefined);
        }else if(message.type==='failure')finish(new AnalysisError(message.code??'INVALID_INPUT',message.message??'PDF parsing failed.',message.status??422));
      });
      current.on('error',()=>finish(new AnalysisError('INVALID_INPUT',copy(locale,'PDF 超过解析器资源限制或无法读取，请缩小材料。','The PDF exceeded parser resource limits or could not be read. Reduce the materials.'),422)));
      current.on('exit',()=>{if(!settled)finish(new AnalysisError('INVALID_INPUT',copy(locale,'PDF 解析进程已停止，未采用结果。','The PDF parser stopped without a valid result.'),422));});
    });
}
