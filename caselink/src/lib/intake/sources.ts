import type {Locale} from '../i18n/locale';
import type {IntakeSource} from './contracts';

export const UK_JURISDICTION_SOURCE_ID='uk-three-legal-systems';
const sourceUrl='https://www.judiciary.uk/about-the-judiciary/our-justice-system/jud-acc-ind/justice-sys-and-constitution/';
export function intakeSources(ids:readonly string[],locale:Locale):IntakeSource[]{
  if(!ids.includes(UK_JURISDICTION_SOURCE_ID))return [];
  return [{id:UK_JURISDICTION_SOURCE_ID,title:locale==='en'?'The justice system and the constitution — Courts and Tribunals Judiciary':'司法制度与宪制——英国法院及审裁处司法机构',url:sourceUrl,checkedAt:'2026-10-08',scope:locale==='en'?'Confirms only the distinction between the legal systems of England and Wales, Scotland, and Northern Ireland. Used to clarify location; it does not establish which law applies to this case or provide UK legal advice.':'仅用于确认英格兰及威尔士、苏格兰和北爱尔兰分属不同法系，支持进一步询问地区。不据此判断个案适用法律，也不表示已提供英国法律意见。'}];
}
