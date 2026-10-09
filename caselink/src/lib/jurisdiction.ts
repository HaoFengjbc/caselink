import {COUNTRY_CODES} from './workflow-contracts';
import type {NewCaseInput} from './contracts';
import type {CanonicalJurisdiction} from './workflow-contracts';
// Fixed ISO 3166-1 alpha-2 values. Intl supplies display names, never user text.
const ISO_CODES=COUNTRY_CODES;
const EN=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'});
const ZH=new Intl.DisplayNames(['zh-Hans'],{type:'region',fallback:'none'});
const ZH_TRAD=new Intl.DisplayNames(['zh-Hant'],{type:'region',fallback:'none'});
const normal=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const matchesName=(text:string,name:string)=>{
 const term=normal(name);
 if(text===term)return true;
 // Short alpha-2 tokens and common words (IN, US, Georgia) are not mined from prose.
 if(term.length<4||term==='georgia'||term==='chad'||term==='oman')return false;
 if(/[\p{Script=Han}]/u.test(term))return text.includes(term);
 return new RegExp(`(^|[^\\p{L}\\p{N}])${escape(term)}(?=$|[^\\p{L}\\p{N}])`,'u').test(text);
};
const ALIASES:Readonly<Record<string,readonly string[]>>={
 GB:['UK','U.K.','U.K','United Kingdom','Britain','Great Britain','英国','英國','联合王国','聯合王國'],
 US:['USA','U.S.A.','U.S.','United States of America','美国','美國','美利坚合众国'],
 CN:['PRC','People’s Republic of China','People\'s Republic of China','中华人民共和国','中國','中国大陆','中國大陸'],
 HK:['Hong Kong','Hong Kong SAR','香港'],MO:['Macao','Macau','澳门','澳門'],TW:['Taiwan','台灣','台湾'],
 KR:['South Korea','韩国','韓國'],KP:['North Korea','朝鲜','朝鮮'],RU:['Russian Federation','俄罗斯','俄羅斯'],
 CZ:['Czech Republic','Czechia','捷克'],TR:['Turkey','Türkiye','土耳其'],VN:['Viet Nam','Vietnam','越南'],
 MM:['Burma','Myanmar','缅甸','緬甸'],LA:['Laos','Lao PDR','老挝','老撾'],CI:['Ivory Coast','Côte d’Ivoire','Cote d\'Ivoire','科特迪瓦'],
 CD:['DR Congo','Democratic Republic of the Congo','刚果民主共和国','剛果民主共和國','刚果（金）'],CG:['Republic of the Congo','刚果共和国','剛果共和國','刚果（布）'],
 PS:['Palestine','State of Palestine','巴勒斯坦'],VA:['Vatican','Holy See','梵蒂冈','梵蒂岡'],
 SZ:['Swaziland','Eswatini','斯威士兰','史瓦帝尼'],MK:['Macedonia','North Macedonia','北马其顿','北馬其頓'],
 };
const REGIONS=ISO_CODES.map(code=>({code,name:EN.of(code)??code,names:[EN.of(code),ZH.of(code),ZH_TRAD.of(code),...(ALIASES[code]??[])].filter((x):x is string=>!!x)}));
const UK_SYSTEMS=[
 {name:'Northern Ireland',test:/(?:\bnorthern ireland\b|北爱尔兰|北愛爾蘭)/iu},
 {name:'Scotland',test:/(?:\bscotland\b|\bscottish\b|苏格兰|蘇格蘭)/iu},
 {name:'England and Wales',test:/(?:\bengland\b|\bwales\b|\bwelsh\b|英格兰|英格蘭|威尔士|威爾斯)/iu},
] as const;

const unknownJurisdiction=():Omit<CanonicalJurisdiction,'jurisdictionCode'>=>({countryCode:null,country:'Jurisdiction unconfirmed; broad comparative research',legalSystem:null,recognized:false});
// Only affirmative clauses participate; a negated comparison cannot override a following actual location.
const affirmativeLocation=(raw:string)=>normal(raw).split(/[;；。!?\n]|,(?=\s*(?:but|rather|actually)\b)|\bbut\b/iu)
 .filter(clause=>!/(?:\b(?:not|never|outside|rather than)\b|不是|不在|并非|並非|非属|非屬)/iu.test(clause)).join(' ');
/** Canonical labels only. Unknown/ambiguous values remain broad, never raw text. */
export function recognizedJurisdiction(values:readonly string[]):Omit<CanonicalJurisdiction,'jurisdictionCode'>{
 for(const raw of values){
  const text=affirmativeLocation(raw.replace(/_/g,' '));if(!text)continue;
  const exactCode=ISO_CODES.find(code=>text===code.toLowerCase());
  if(exactCode)return {countryCode:exactCode,country:EN.of(exactCode)??exactCode,legalSystem:exactCode==='GB'?'UK jurisdiction to confirm':null,recognized:true};
  const systems=UK_SYSTEMS.filter(s=>s.test.test(text));
  const exact=REGIONS.filter(r=>r.names.some(n=>normal(n)===text));
  const found=exact.length?exact:REGIONS.filter(r=>r.names.some(n=>matchesName(text,n)));
  // Northern Ireland is a UK system, not a mention of the Republic of Ireland.
  const regions=systems.length?found.filter(r=>!(r.code==='IE'&&systems.some(s=>s.name==='Northern Ireland'))):found;
  if(systems.length&&regions.some(r=>r.code!=='GB'))return unknownJurisdiction();
  if(systems.length)return {countryCode:'GB',country:'United Kingdom',legalSystem:systems.length===1?systems[0].name:'UK jurisdiction to confirm',recognized:true};
  if(regions.length===1)return {countryCode:regions[0].code,country:regions[0].name,legalSystem:regions[0].code==='GB'?'UK jurisdiction to confirm':null,recognized:true};
  if(regions.length>1)return unknownJurisdiction();
 }
 return unknownJurisdiction();
}


const UK_CODES={england_wales:'England and Wales',scotland:'Scotland',northern_ireland:'Northern Ireland'} as const;
export function resolveJurisdiction(input:NewCaseInput):CanonicalJurisdiction{
 const country=recognizedJurisdiction([input.country]);
 const explicit=input.intake?.jurisdiction;
 // A confirmed non-GB country is authoritative. Retained UK fields are ignored.
 if(country.recognized&&country.countryCode!=='GB')return {...country,jurisdictionCode:'national'};
 if(country.countryCode==='GB'&&explicit&&Object.hasOwn(UK_CODES,explicit)){
  const jurisdictionCode=explicit as keyof typeof UK_CODES;
  return {countryCode:'GB',country:'United Kingdom',jurisdictionCode,legalSystem:UK_CODES[jurisdictionCode],recognized:true};
 }
 // Unknown/new country must not inherit an old legal system.
 if(!country.recognized)return {...country,jurisdictionCode:'unknown'};
 const detail=recognizedJurisdiction([explicit??'',...(input.intake?.answers??[]).filter(a=>a.questionId==='uk-jurisdiction').map(a=>a.answer),input.country]);
 const found=Object.entries(UK_CODES).find(([,label])=>label===detail.legalSystem);
 return {...country,jurisdictionCode:found?found[0] as keyof typeof UK_CODES:'unknown',legalSystem:found?found[1]:'UK jurisdiction to confirm'};
}

export const isUnitedKingdom=(country:string):boolean=>recognizedJurisdiction([country]).countryCode==='GB';
