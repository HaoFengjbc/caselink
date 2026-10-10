import {readFile} from 'node:fs/promises';
import {describe, expect, it} from 'vitest';
import {locateMaterialQuote, originalMaterialQuote} from '../src/lib/materials/citations';
import {parseMaterials} from '../src/lib/materials/parse';
import {emptyMaterialValidationReport, validateMaterialOutput, type ModelMaterialOutput} from '../src/lib/materials/extract';
import {organizeMaterials} from '../src/lib/materials/service';
import type {ParsedMaterial} from '../src/lib/materials/contracts';

const page = (pdfPage: number, text: string, status = 'read') => ({pdfPage, text, status});

describe('quote matching tolerates presentation differences only', () => {
  it('returns the page’s own text for equivalent quote marks, dashes, widths, radicals, spacing, case, accents and ligatures', () => {
    for (const [text, quote, expected] of [
      ['The plaintiff’s lawyer alleges defamation.', "The plaintiff's lawyer alleges defamation", 'The plaintiff’s lawyer alleges defamation'],
      ['be removed — within 48 hours', 'be removed - within 48 hours', 'be removed — within 48 hours'],
      ['要求赔偿２０万美元。', '要求赔偿20万美元', '要求赔偿２０万美元'],
      ['2026年10⽉6⽇，记者收到传票', '2026年10月6日，记者收到传票', '2026年10⽉6⽇，记者收到传票'],
      ['2026 年 10 月 6 日 ， 记者收到传票', '2026年10月6日，记者收到传票', '2026 年 10 月 6 日 ， 记者收到传票'],
      ['记者收到传票和\n起诉状。', '记者收到传票和起诉状', '记者收到传票和\n起诉状'],
      ['alleges defama-\ntion and demands', 'alleges defamation and demands', 'alleges defama-\ntion and demands'],
      ['a well-\nknown blogger', 'a well-known blogger', 'a well-\nknown blogger'],
      ['The Court said the post was lawful.', 'the court said the post was lawful', 'The Court said the post was lawful'],
      ['Éva Szeli is the expert.', 'Eva Szeli is the expert', 'Éva Szeli is the expert'],
      ['the ﬁnal sentence was removed', 'the final sentence was removed', 'the ﬁnal sentence was removed'],
      ['the con­viction was upheld', 'the conviction was upheld', 'the con­viction was upheld'],
    ]) expect(originalMaterialQuote(text!, quote!), quote).toBe(expected);
  });

  it('still rejects changed words, numbers, negation, word boundaries, punctuation, joined fragments and translations', () => {
    for (const [text, quote] of [
      ['The court did not convict the reporter.', 'The court did convict the reporter.'],
      ['GBP 20,000 was demanded.', 'GBP 2,000 was demanded.'],
      ['GBP 20 000', 'GBP 20000'],
      ['now here', 'nowhere'],
      ['left; right', 'left right'],
      ['first unrelated words last', 'first last'],
      ['记者声明不认罪。', '记者声明认罪。'],
      ['The lawyer demands GBP 20,000.', '律师要求赔偿两万英镑'],
    ]) expect(originalMaterialQuote(text!, quote!), quote).toBeNull();
  });
});

describe('locating citations across pages and files', () => {
  const letter = {fileId: 'pdf-a', pages: [
    page(1, 'HEADER · Fictional file\nOn 6 October 2026 the reporter received a summons from the district court.\n1'),
    page(2, 'HEADER · Fictional file\nThe company says the post harmed its commercial reputation and the next hearing is set for\n2'),
    page(3, 'HEADER · Fictional file\n20 November 2026 in courtroom three. The reporter has no lawyer.\n3'),
    page(4, '', 'omitted'),
  ]};
  const note = {fileId: 'pdf-b', pages: [page(1, 'A separate note records that the reply was sent on 9 October 2026.')]};

  it('keeps a quote on its stated page and corrects a wrong page to where the words appear', () => {
    expect(locateMaterialQuote([letter], {fileId: 'pdf-a', pdfPage: 1, quote: 'the reporter received a summons'})).toEqual({sources: [{fileId: 'pdf-a', pdfPage: 1, quote: 'the reporter received a summons'}], relocated: false});
    expect(locateMaterialQuote([letter], {fileId: 'pdf-a', pdfPage: 1, quote: 'The company says the post harmed its commercial reputation'})).toEqual({sources: [{fileId: 'pdf-a', pdfPage: 2, quote: 'The company says the post harmed its commercial reputation'}], relocated: true});
    // A short phrase is only accepted where the model placed it.
    expect(locateMaterialQuote([letter], {fileId: 'pdf-a', pdfPage: 1, quote: 'no lawyer'})).toBeNull();
  });

  it('splits a sentence that runs over a page break, skipping the running header and page number', () => {
    const found = locateMaterialQuote([letter], {fileId: 'pdf-a', pdfPage: 2, quote: 'the next hearing is set for 20 November 2026 in courtroom three'});
    expect(found).toEqual({relocated: true, sources: [{fileId: 'pdf-a', pdfPage: 2, quote: 'the next hearing is set for'}, {fileId: 'pdf-a', pdfPage: 3, quote: '20 November 2026 in courtroom three'}]});
  });

  it('accepts an ellipsis-joined quote only when every part is found, as separate excerpts', () => {
    expect(locateMaterialQuote([letter], {fileId: 'pdf-a', pdfPage: 3, quote: '20 November 2026 in courtroom three … The reporter has no lawyer'})?.sources.map(source => source.quote)).toEqual(['20 November 2026 in courtroom three', 'The reporter has no lawyer']);
    expect(locateMaterialQuote([letter], {fileId: 'pdf-a', pdfPage: 3, quote: '20 November 2026 in courtroom three ... The reporter was released on bail'})).toBeNull();
  });

  it('finds a quote cited with the wrong file, and never reads skipped pages', () => {
    expect(locateMaterialQuote([letter, note], {fileId: 'pdf-a', pdfPage: 1, quote: 'the reply was sent on 9 October 2026'})).toEqual({sources: [{fileId: 'pdf-b', pdfPage: 1, quote: 'the reply was sent on 9 October 2026'}], relocated: true});
    expect(locateMaterialQuote([letter, note], {fileId: 'pdf-forged', pdfPage: 1, quote: 'the reply was sent on 9 October 2026'})?.sources[0]?.fileId).toBe('pdf-b');
    const hidden = {fileId: 'pdf-c', pages: [page(1, 'Visible text on the first page of the file.'), page(2, 'Text the budget skipped entirely.', 'omitted')]};
    expect(locateMaterialQuote([hidden], {fileId: 'pdf-c', pdfPage: 2, quote: 'Text the budget skipped entirely'})).toBeNull();
  });
});

describe('a real mixed-script PDF from a Chrome/Word-style export', () => {
  const read = async (): Promise<ParsedMaterial[]> => parseMaterials([{name: 'mixed-script-layout.pdf', type: 'application/pdf', bytes: new Uint8Array(await readFile(new URL('./fixtures/pdf/mixed-script-layout.pdf', import.meta.url)))}], {locale: 'zh'});

  it('extracts the text a reader sees: no look-alike radicals, no spaces inside words or dates, no doubled spaces', async () => {
    const [document] = await read();
    const text = document!.pages.map(item => item.text).join('\n');
    expect(document!.processedPages).toEqual([1, 2]);
    expect(text).toContain('2026年10月6日，记者林岚收到某市法院的传票');
    expect(text).toContain('非真实案件');
    expect(text).toContain('alleges defamation and demands');
    expect(text).not.toMatch(/[⼀-⿟]| {2,}/u);
  });

  it('verifies typical model quotes, corrects pages and page breaks, and leaves out only the untraceable item', async () => {
    const documents = await read(), fileId = documents[0]!.fileId;
    const item = (text: string, quote: string, pdfPage = 1) => ({field: 'event' as const, text, subject: 'the document', nature: 'document_record' as const, dateKind: 'none' as const, date: null, sources: [{fileId, pdfPage, quote}], uncertainty: null});
    const model: ModelMaterialOutput = {candidates: [{label: 'Fictional bilingual letter', prefill: {country: '', jurisdiction: 'unknown', caseKind: 'civil', expression: 'yes', stage: 'unknown', personType: 'journalist'}, items: [
      item('记者于 2026年10月6日 收到传票和起诉状。', '2026年10月6日，记者林岚收到某市法院的传票和起诉状'),
      item('The lawyer alleges defamation.', "The plaintiff's lawyer alleges defamation and demands that the post be removed - within"),
      item('下一次程序安排在 2026年11月20日。', '下一次程序安排将于2026年11月20日在第三法庭进行'),
      item('她没有律师。', '林岚目前没有律师', 1),
      item('A translated quote cannot be checked.', '原告律师指控诽谤并要求删除帖子'),
    ], conflicts: [{description: 'The untraceable item cannot be compared.', itemIndices: [0, 4]}], missing: []}]};
    const report = emptyMaterialValidationReport();
    const [candidate] = validateMaterialOutput(model, documents, 'zh', report);
    expect(candidate!.items).toHaveLength(4);
    expect(report).toEqual({droppedItems: 1, droppedSources: 1, relocatedSources: 2, droppedConflicts: 1, droppedCandidates: 0});
    expect(candidate!.items[1]!.sources[0]!.quote).toContain('plaintiff’s lawyer alleges defamation');
    expect(candidate!.items[2]!.sources.map(source => [source.pdfPage, source.quote])).toEqual([[1, '下一次程序安排将于'], [2, '2026年11月20日在第三法庭进行']]);
    expect(candidate!.items[3]!.sources[0]).toMatchObject({pdfPage: 2, quote: '林岚目前没有律师'});
    for (const extracted of candidate!.items) for (const source of extracted.sources) expect(documents[0]!.pages.find(item => item.pdfPage === source.pdfPage)!.text).toContain(source.quote);
    expect(candidate!.conflicts).toEqual([]);
  });
});

describe('the upload service tells the user what was left out or corrected', () => {
  it('returns checked items with plain notes instead of failing the whole upload', async () => {
    const bytes = new Uint8Array(await readFile(new URL('./fixtures/pdf/mixed-script-layout.pdf', import.meta.url)));
    let fileId = '';
    const transport = async ({data}: {data: string}) => {
      fileId = JSON.parse(data).documents[0].fileId;
      const source = (quote: string, pdfPage = 1) => [{fileId, pdfPage, quote}];
      const item = (text: string, quote: string, pdfPage = 1) => ({field: 'event', text, subject: 'the document', nature: 'document_record', dateKind: 'none', date: null, sources: source(quote, pdfPage), uncertainty: null});
      return {status: 'completed', output_parsed: {candidates: [{label: 'Fictional bilingual letter', prefill: {country: '', jurisdiction: 'unknown', caseKind: 'civil', expression: 'yes', stage: 'unknown', personType: 'journalist'}, items: [
        item('记者收到传票。', '记者林岚收到某市法院的传票和起诉状'),
        item('她没有律师。', '林岚目前没有律师'),
        item('A translated quote.', '原告律师指控诽谤并要求删除帖子'),
      ], conflicts: [], missing: []}]}};
    };
    const request = {requestId: 'citations-fixture-001', inputVersion: 1, operation: 'initial' as const, locale: 'zh' as const, aiConsent: true, existingPageCount: 0, existingFileCount: 0, background: ''};
    const result = await organizeMaterials([{name: 'mixed-script-layout.pdf', type: 'application/pdf', bytes}], request, {config: {mode: 'live', key: 'fictional-key', model: 'gpt-6-luna', timeoutMs: 120000}, transport: transport as never});
    expect(result.mode).toBe('live_ai');
    expect(result.candidates[0]!.items).toHaveLength(2);
    expect(result.warnings.join(' ')).toContain('1 项在 PDF 原文中找不到对应文字，已略过');
    expect(result.warnings.join(' ')).toContain('1 处引文已按原文实际所在的页码更正');
  });
});
