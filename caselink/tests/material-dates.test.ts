import {describe,it,expect} from 'vitest';
import {resolveMaterialDate} from '../src/lib/materials/dates';

describe('resolveMaterialDate explicit Gregorian equivalence',()=>{
  it.each([
    ['2026-10-03','Received on 3 October 2026.','3 October 2026'],
    ['3 October 2026','Received on 2026-10-03.','2026-10-03'],
    ['2026年10月3日','Dated October 3, 2026.','October 3, 2026'],
    ['October 3, 2026','文件日期：2026年10月3日。','2026年10月3日'],
    ['2026-10-03','文件日期：2026 年 10 月 3 日。','2026 年 10 月 3 日'],
    ['2026-10-03','Dated 03 Oct. 2026.','03 Oct. 2026'],
    ['2026-09-03','Dated 3 Sept 2026.','3 Sept 2026'],
    ['2026-01-01','Dated 1 January 2026.','1 January 2026'],
    ['2026-12-31','Dated December 31 2026.','December 31 2026'],
    ['2026-10-03','Dated 3\n  October\t2026.','3\n  October\t2026'],
    ['3 October 2026','Dated 3\n  October\t2026.','3\n  October\t2026'],
    ['2026-10-03','Dated 2026 -\n10 - 03.','2026 -\n10 - 03'],
  ])('returns original source for %s', (value,source,expected)=>{
    const result=resolveMaterialDate(value,[source]);expect(result).toBe(expected);expect(source).toContain(result);
  });
  it('supports every English calendar month without confusing May with a modal verb',()=>{
    ['January','February','March','April','May','June','July','August','September','October','November','December'].forEach((month,index)=>{
      const source=`Dated 3 ${month} 2026.`;expect(resolveMaterialDate(`2026-${String(index+1).padStart(2,'0')}-03`,[source])).toBe(`3 ${month} 2026`);
    });
  });
  it('allows repeated equivalent full dates across this item sources only',()=>{
    const sources=['Dated 3 October 2026.','文件日期：2026年10月3日。','Signed October 3, 2026.'];
    expect(resolveMaterialDate('2026-10-03',sources)).toBe('3 October 2026');
    expect(resolveMaterialDate('2026-10-03',['Unrelated source has no date.'])).toBeNull();
  });
  it('keeps an explicitly quoted complete date when an excerpt contains other dates',()=>{
    const source='The letter is dated 1 October 2026 and was received on 3\nOctober 2026.';
    expect(resolveMaterialDate('3 October 2026',[source])).toBe('3\nOctober 2026');
    expect(resolveMaterialDate('1 October 2026',[source])).toBe('1 October 2026');
    expect(resolveMaterialDate('2026-10-03',[source])).toBeNull();
  });
  it('preserves an exact date without guessing its legal role or erasing quoted negation',()=>{
    const source='It did not happen on 3 October 2026.';
    expect(resolveMaterialDate('3 October 2026',[source])).toBe('3 October 2026');
    expect(resolveMaterialDate('2026-10-03',[source])).toBeNull();
  });
});

describe('Gregorian validation with no locale guess or missing components',()=>{
  it.each([
    ['2024-02-29','29 February 2024'],['2000-02-29','2000年2月29日'],
    ['2400-02-29','February 29, 2400'],['2026-04-30','30 April 2026'],
  ])('accepts valid full date %s', (value,source)=>expect(resolveMaterialDate(value,[source])).toBe(source));
  it.each(['2026-02-29','1900-02-29','2100-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','2026-01-32','0000-01-01','31 April 2026','February 29, 1900','2026年2月30日'])('rejects invalid literal %s',value=>{
    expect(resolveMaterialDate(value,[`Dated ${value}.`])).toBeNull();
  });
  it.each(['03/04/2026','03-04-2026','2026/10/03','2026','October 2026','3 October','10月3日','昨天','yesterday','next week'])('does not infer or reclassify %s',value=>{
    expect(resolveMaterialDate(value,[value])).toBeNull();
    expect(resolveMaterialDate('2026-10-03',[value])).toBeNull();
  });
  it('does not treat an entire negated date phrase or date range as one complete date',()=>{
    for(const value of ['not 2026-10-03','2026-10-03 to 2026-10-04'])expect(resolveMaterialDate(value,[value])).toBeNull();
  });
  it('does not change calendar, year, month or day',()=>{
    for(const source of ['3 October 2025','3 September 2026','4 October 2026','3 October 2026 (Julian calendar)','农历2026年10月3日'])expect(resolveMaterialDate('2026-10-03',[source])).toBeNull();
  });
  it('does not join facts from separate quotations',()=>{
    expect(resolveMaterialDate('2026-10-03',['3 October','2026'])).toBeNull();
    expect(resolveMaterialDate('2026-10-03',['2026年','10月','3日'])).toBeNull();
  });
});

describe('conservative fallback in unclear source context',()=>{
  it.each([
    '3 October 2026 and 4 October 2026',
    '3 October 2026; other date 2026-02-30',
    '3 October 2026; other date 03/04/2026',
    'Not 3 October 2026.',
    'The date 3 October 2026 is disputed.',
    'Before 3 October 2026.',
    'After 3 October 2026.',
    'Around 3 October 2026.',
    '3 October 2026 or the following day.',
    '并非2026年10月3日。',
    '未于2026年10月3日收到。',
    '可能于2026年10月3日收到。',
    'Possibly 3 October 2026.',
    '截至2026年10月3日。',
    '2026年10月3日前。',
    '2026年10月3日之后。',
    '约2026年10月3日。',
    '3 October 2026 to 3 October 2026',
    '3 October 2026–3 October 2026',
    '3–5 October 2026',
    'October 3–5, 2026',
    '2026年10月3日至5日',
    '2026年10月3日至2026年10月3日',
  ])('requires review for source context %s',source=>expect(resolveMaterialDate('2026-10-03',[source])).toBeNull());
  it('rejects different dates across separate sources instead of selecting the desired one',()=>{
    expect(resolveMaterialDate('2026-10-03',['3 October 2026','5 October 2026'])).toBeNull();
  });
  it('does not recover a misleading substring from a longer date or shared range',()=>{
    for(const [value,source] of [
      ['3 October 2026','13 October 2026'],
      ['2026-10-03','12026-10-03'],
      ['2026-10-03','2026-10-030'],
      ['2026-10-03','ref2026-10-03x'],
      ['5 October 2026','3–5 October 2026'],
      ['2026年10月3日','2026年10月3日至5日'],
    ])expect(resolveMaterialDate(value,[source])).toBeNull();
  });
  it('still permits a literal complete endpoint among two fully written dates',()=>{
    const source='From 3 October 2026 to 5 October 2026.';
    expect(resolveMaterialDate('3 October 2026',[source])).toBe('3 October 2026');
    expect(resolveMaterialDate('5 October 2026',[source])).toBe('5 October 2026');
  });
  it('never returns manufactured or oversized source strings',()=>{
    const longSource=`3${' '.repeat(80)}October 2026`;
    expect(resolveMaterialDate('2026-10-03',[longSource])).toBeNull();
    expect(resolveMaterialDate('3 October 2026',[longSource])).toBeNull();
    expect(resolveMaterialDate(` ${' '.repeat(80)}3 October 2026`,['3 October 2026'])).toBeNull();
    expect(resolveMaterialDate('',['3 October 2026'])).toBeNull();
    expect(resolveMaterialDate('2026-10-03',[])).toBeNull();
    const quote='文件于2026年10月3日签署。';
    const result=resolveMaterialDate('2026-10-03',[quote]);expect(result).toBe('2026年10月3日');expect(quote.includes(result!)).toBe(true);
  });
});
