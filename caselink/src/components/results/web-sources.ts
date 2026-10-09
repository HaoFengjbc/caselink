import type {WebSource} from '@/lib/research/contracts';
export function citationProvenance(source:WebSource,locale:'zh'|'en'){
  const opened=source.pageOpened?(locale==='en'?'A source-page opening step completed in this research; the content still needs human checking. ':'本轮执行了原文打开步骤；内容仍须人工核对。 '):'';
  if(source.citationKind==='tool_returned_link')return opened+(locale==='en'?'Link matched to this search’s returned sources; paragraph attribution is AI-generated.':'链接已匹配本轮工具返回的来源；段落与来源的关联由 AI 给出。');
  if(source.citationKind==='url_annotation')return opened+(locale==='en'?'Citation supplied by the search API; content still requires checking.':'搜索接口提供的引用标注；内容仍须核查。');
  return opened.trim();
}

/** Only an explicitly supplied source entry can become a link. Narrative URLs stay text. */
export function webSourceUrl(source:WebSource):string|null {
  try {
    const url=new URL(source.url);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;
    return url.href;
  } catch { return null; }
}
export function webSourcesFor(ids:string[],sources:WebSource[]):WebSource[]{
  const entries=new Map(sources.map(source=>[source.sourceId,source]));
  return [...new Set(ids)].flatMap(id=>entries.has(id)?[entries.get(id)!]:[]);
}
/** Escape external prose, including bare URL autolinks and link-label syntax. */
export function webMarkdownText(value:string):string {
  return value.replace(/\\/g,'\\\\').replace(/([`*_{}\[\]()<>#!|~])/g,'\\$1').replace(/\b(https?):\/\//gi,'$1\\://').replace(/\bwww\./gi,'www\\.');
}
export function webMarkdownCitation(source:WebSource):string {
  const label=webMarkdownText(`${source.sourceId} · ${source.title}`).replace(/[\r\n]+/g,' ');
  const url=webSourceUrl(source);
  if(!url)return label;
  const target=url.replace(/[()<>\\]/g,char=>`%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `[${label}](<${target}>)`;
}
