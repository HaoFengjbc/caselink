/**
 * Citation matching for uploaded PDFs. A model quote is accepted only when the same words appear in
 * the extracted page text, and the stored quote is always the page's own contiguous substring.
 *
 * Only presentation differences are tolerated: Unicode compatibility forms (full-width characters,
 * ligatures), curly versus straight quotes, dash variants, Latin accents, invisible characters, letter
 * case, line-end hyphenation and layout whitespace (spaces next to CJK text or punctuation, and runs of
 * spaces or line breaks). Words, digits, punctuation and Latin word boundaries must still agree, so
 * removed negation, changed amounts and joined fragments never match.
 */

type Canonical = { text: string; starts: number[]; ends: number[] };
type PageText = { pdfPage: number; text: string; status: string };
type DocumentText = { fileId: string; pages: readonly PageText[] };
export type LocatedQuote = { fileId: string; pdfPage: number; quote: string };

const INVISIBLE = /[­​-‍⁠﻿]/u;
const QUOTE_MARKS: Record<string, string> = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'", '´': "'", '`': "'",
  '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"', '«': '"', '»': '"',
  '「': '"', '」': '"', '『': '"', '』': '"',
};
const DASHES = /[‐-―−﹘﹣－]/u;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}　-〿＀-￯]/u;
const ACCENTED_SCRIPT = /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}]/u;
const isWord = (ch: string) => /[\p{L}\p{N}]/u.test(ch) && !CJK.test(ch);
/** Less specific quotes are accepted only where the model placed them, never searched for elsewhere. */
const MIN_RELOCATION_SPECIFICITY = 12;
const ELLIPSIS = /\s*(?:\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\)|\.{3,}|…+)\s*/u;

/** Canonical form of one code point: possibly empty (invisible) or several characters (ligatures). */
function canonicalPoint(point: string, previousPoint: string): string {
  if (INVISIBLE.test(point)) return '';
  let value = point.normalize('NFKD');
  // Accents are dropped only where they are diacritics; CJK sound marks stay significant.
  if (/^\p{M}+$/u.test(value)) return ACCENTED_SCRIPT.test(previousPoint) ? '' : value;
  if (ACCENTED_SCRIPT.test(value[0] ?? '')) value = value.replace(/\p{M}/gu, '');
  return [...value.normalize('NFKC')].map(ch => QUOTE_MARKS[ch] ?? (DASHES.test(ch) ? '-' : ch)).join('').toLowerCase();
}

const codePointAt = (value: string, offset: number) => offset < value.length ? String.fromCodePoint(value.codePointAt(offset)!) : '';

/**
 * Canonical text plus, for every canonical character, the original range it came from.
 * With `dehyphenate`, a hyphen at a line end between two letters is removed with the line break.
 */
function canonical(value: string, dehyphenate = false): Canonical {
  let text = '', previousPoint = '';
  const starts: number[] = [], ends: number[] = [];
  const push = (chunk: string, start: number, end: number) => {
    for (const ch of chunk) { text += ch; for (let i = 0; i < ch.length; i++) { starts.push(start); ends.push(end); } }
  };
  for (let offset = 0; offset < value.length;) {
    const start = offset, point = codePointAt(value, offset);
    offset += point.length;
    if (/\s/u.test(point)) {
      while (offset < value.length && /\s/u.test(value[offset]!)) offset++;
      const before = text.at(-1) ?? '', after = canonicalPoint(codePointAt(value, offset), previousPoint).at(0) ?? '';
      // A space matters only between two words written with spaces ("now here" ≠ "nowhere", "20 000" ≠ "20000").
      if (before && after && isWord(before) && isWord(after)) push(' ', start, offset);
      continue;
    }
    if (dehyphenate && (point === '-' || DASHES.test(point))) {
      let lookahead = offset, lineBreak = false;
      while (lookahead < value.length && /\s/u.test(value[lookahead]!)) { if (value[lookahead] === '\n') lineBreak = true; lookahead++; }
      if (lineBreak && /\p{L}/u.test(text.at(-1) ?? '') && /\p{L}/u.test(codePointAt(value, lookahead))) { offset = lookahead; continue; }
    }
    push(canonicalPoint(point, previousPoint), start, offset);
    previousPoint = point;
  }
  return { text, starts, ends };
}

// Pages are canonicalized once per validation pass rather than once per quote.
const pageCache = new Map<string, Canonical>();
function canonicalPage(pageText: string, dehyphenate: boolean): Canonical {
  const key = `${dehyphenate ? 1 : 0}${pageText}`;
  let result = pageCache.get(key);
  if (!result) {
    if (pageCache.size >= 128) pageCache.clear();
    result = canonical(pageText, dehyphenate);
    pageCache.set(key, result);
  }
  return result;
}

/** Find a quote in one text and return its original span, or null. */
function findSpan(pageText: string, quote: string): { start: number; end: number } | null {
  if (!quote.trim()) return null;
  const exact = pageText.indexOf(quote);
  if (exact >= 0) return { start: exact, end: exact + quote.length };
  const needle = canonical(quote).text;
  if (!needle) return null;
  for (const dehyphenate of [false, true]) {
    const page = canonicalPage(pageText, dehyphenate);
    const offset = page.text.indexOf(needle);
    if (offset >= 0) return { start: page.starts[offset]!, end: page.ends[offset + needle.length - 1]! };
  }
  return null;
}

/** Return the actual contiguous original substring on the supplied page, never the model's rewrite. */
export function originalMaterialQuote(pageText: string, quote: string): string | null {
  const span = findSpan(pageText, quote);
  if (!span) return null;
  const original = pageText.slice(span.start, span.end);
  return original.length <= 800 ? original : null;
}

/** How specific a quote is: a CJK character carries about as much as two Latin letters. */
const specificity = (quote: string) => [...canonical(quote).text].reduce((sum, ch) => sum + (CJK.test(ch) ? 2 : 1), 0);

const readPages = (document: DocumentText) => document.pages.filter(page => page.status === 'read' && page.text.trim()).sort((a, b) => a.pdfPage - b.pdfPage);

/**
 * Locate a model citation in the uploaded documents. The stated page is tried first, then nearby pages,
 * page breaks and the other files, so a wrong page number or a sentence running onto the next page is
 * corrected instead of rejected. A quote joined with an ellipsis is split, and every part must be found.
 * Returns null when the quote, or any part of it, cannot be found.
 */
export function locateMaterialQuote(documents: readonly DocumentText[], source: { fileId: string; pdfPage: number; quote: string }): { sources: LocatedQuote[]; relocated: boolean } | null {
  const whole = locateFragment(documents, source.fileId, source.pdfPage, source.quote);
  const parts = whole ? [whole] : [];
  if (!whole) {
    const fragments = source.quote.split(ELLIPSIS).map(part => part.trim()).filter(Boolean);
    if (fragments.length < 2) return null;
    for (const fragment of fragments) {
      const found = locateFragment(documents, source.fileId, source.pdfPage, fragment);
      if (!found) return null;
      parts.push(found);
    }
  }
  const sources = parts.flat();
  return { sources, relocated: sources.some(part => part.fileId !== source.fileId || part.pdfPage !== source.pdfPage) };
}

function locateFragment(documents: readonly DocumentText[], fileId: string, pdfPage: number, fragment: string): LocatedQuote[] | null {
  const cited = documents.find(document => document.fileId === fileId);
  const citedPage = cited && readPages(cited).find(page => page.pdfPage === pdfPage);
  const onCitedPage = citedPage ? originalMaterialQuote(citedPage.text, fragment) : null;
  if (onCitedPage) return [{ fileId, pdfPage, quote: onCitedPage }];
  if (specificity(fragment) < MIN_RELOCATION_SPECIFICITY) return null;
  // Nearby pages of the cited file first, then page breaks around them, then the other files.
  for (const document of [...(cited ? [cited] : []), ...documents.filter(document => document !== cited)]) {
    const pages = readPages(document);
    const nearest = document === cited ? [...pages].sort((a, b) => Math.abs(a.pdfPage - pdfPage) - Math.abs(b.pdfPage - pdfPage) || a.pdfPage - b.pdfPage) : pages;
    for (const page of nearest) {
      const quote = originalMaterialQuote(page.text, fragment);
      if (quote) return [{ fileId: document.fileId, pdfPage: page.pdfPage, quote }];
    }
    const boilerplate = runningLines(pages);
    for (const page of nearest) {
      const next = pages.find(candidate => candidate.pdfPage === page.pdfPage + 1);
      const spanning = next ? acrossPageBreak(page, next, fragment, boilerplate) : null;
      if (spanning) return spanning.map(part => ({ fileId: document.fileId, ...part }));
    }
  }
  return null;
}

const lineShape = (line: string) => line.trim().replace(/\d+/g, '#');
/** Running headers and footers: lines repeated (ignoring page numbers) at the top or bottom of most pages. */
function runningLines(pages: readonly PageText[]): Set<string> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const lines = page.text.split('\n').map(lineShape).filter(Boolean);
    for (const line of new Set([...lines.slice(0, 3), ...lines.slice(-3)])) counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  const threshold = Math.max(2, Math.ceil(pages.length / 2));
  return new Set([...counts].filter(([, count]) => count >= threshold).map(([line]) => line));
}

/** Character range of a page without its running header/footer lines. */
function bodyRange(text: string, boilerplate: Set<string>): { start: number; end: number } {
  let start = 0, end = text.length;
  while (start < end) {
    const lineEnd = text.indexOf('\n', start), stop = lineEnd < 0 ? end : lineEnd;
    if (!boilerplate.has(lineShape(text.slice(start, stop))) || stop >= end) break;
    start = stop + 1;
  }
  while (end > start) {
    const lineStart = text.lastIndexOf('\n', end - 1) + 1;
    if (!boilerplate.has(lineShape(text.slice(lineStart, end))) || lineStart <= start) break;
    end = Math.max(start, lineStart - 1);
  }
  return { start, end };
}

/** A sentence that continues onto the next page is stored as two excerpts, one per physical page. */
function acrossPageBreak(first: PageText, second: PageText, fragment: string, boilerplate: Set<string>): Array<{ pdfPage: number; quote: string }> | null {
  const a = bodyRange(first.text, boilerplate), b = bodyRange(second.text, boilerplate);
  const head = first.text.slice(a.start, a.end), tail = second.text.slice(b.start, b.end);
  const span = findSpan(`${head}\n${tail}`, fragment);
  if (!span || span.start >= head.length || span.end <= head.length + 1) return null;
  const firstPart = head.slice(span.start).trim(), secondPart = tail.slice(0, span.end - head.length - 1).trim();
  if (!firstPart || !secondPart || firstPart.length > 800 || secondPart.length > 800) return null;
  return [{ pdfPage: first.pdfPage, quote: firstPart }, { pdfPage: second.pdfPage, quote: secondPart }];
}
