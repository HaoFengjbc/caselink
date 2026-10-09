import {documents} from '../corpus';
import type {Evidence} from '../contracts';
import type {Locale} from '../i18n/locale';

export const isWebPrint=(item:Evidence)=>documents.find(d=>d.documentId===item.documentId)?.sourceFormat==='web_print';
export function evidenceSourceLink(item:Evidence){
  return isWebPrint(item)?item.sourceUrl:`${item.sourceUrl}#page=${item.pdfPage}`;
}
export function sourceFormatNote(item:Evidence,locale:Locale){
  if(!isWebPrint(item))return '';
  return locale==='en'?'Page numbers refer to the archived web-page printout. The official web page does not support PDF page navigation.':'页码对应存档的网页打印件；官方网页不支持 PDF 页码跳转。';
}
