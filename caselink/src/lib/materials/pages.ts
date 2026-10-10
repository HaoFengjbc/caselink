import type {MaterialItem} from './contracts';

/** "1–19" for consecutive pages, "3、7" otherwise. */
export function pageRange(pages:readonly number[],locale:'zh'|'en'):string{
 const sorted=[...pages].sort((a,b)=>a-b),runs:string[]=[];
 for(let start=0;start<sorted.length;){let end=start;while(end+1<sorted.length&&sorted[end+1]===sorted[end]!+1)end++;runs.push(end>start?`${sorted[start]}–${sorted[end]}`:`${sorted[start]}`);start=end+1;}
 return runs.join(locale==='en'?', ':'、');
}

/** "第 3 页" or "p. 3"; the file number ("材料2 第 3 页") appears only when several PDFs were uploaded. */
export function materialPages(item:Pick<MaterialItem,'sources'>,documents:readonly {fileId:string}[],locale:'zh'|'en'):string{
 const en=locale==='en',byFile=new Map<string,number[]>();
 for(const source of item.sources){const pages=byFile.get(source.fileId)??[];if(!pages.includes(source.pdfPage))pages.push(source.pdfPage);byFile.set(source.fileId,pages);}
 return [...byFile].map(([fileId,pages])=>{
  const list=pages.sort((a,b)=>a-b).join(en?', ':'、'),label=en?`p. ${list}`:`第 ${list} 页`;
  if(documents.length<2)return label;
  const n=documents.findIndex(document=>document.fileId===fileId)+1;
  return en?`File ${n} ${label}`:`材料${n} ${label}`;
 }).join(' · ');
}
