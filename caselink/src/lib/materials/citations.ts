/** Only PDF layout whitespace may differ. Never fuzzy-match words, numbers or punctuation. */
function layoutText(value:string):{text:string;starts:number[];ends:number[]}{
  let text='',lastPoint='';const starts:number[]=[],ends:number[]=[];
  for(let offset=0;offset<value.length;){
    const start=offset,point=String.fromCodePoint(value.codePointAt(offset)!);offset+=point.length;
    if(/\s/u.test(point)){
      while(offset<value.length&&/\s/u.test(value[offset]))offset++;
      // PDF text fragments often put layout spaces between Chinese characters.
      // Preserve Latin word boundaries ("now here" must not become "nowhere").
      const before=lastPoint,after=offset<value.length?String.fromCodePoint(value.codePointAt(offset)!):'';
      if(/\p{Script=Han}/u.test(before)&&/\p{Script=Han}/u.test(after))continue;
      text+=' ';lastPoint=' ';starts.push(start);ends.push(offset);
    }else{
      text+=point;lastPoint=point;for(let i=0;i<point.length;i++){starts.push(start);ends.push(offset);}
    }
  }
  return {text,starts,ends};
}

/** Return the actual contiguous original substring on the supplied page, never the model's rewrite. */
export function originalMaterialQuote(pageText:string,quote:string):string|null{
  if(!quote.trim())return null;
  if(pageText.includes(quote))return quote;
  const page=layoutText(pageText),needle=layoutText(quote).text.trim();
  if(!needle)return null;
  const offset=page.text.indexOf(needle);if(offset<0)return null;
  const original=pageText.slice(page.starts[offset],page.ends[offset+needle.length-1]);
  return original.length<=800?original:null;
}
