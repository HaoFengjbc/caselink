from pathlib import Path
from pypdf import PdfReader
import json, unicodedata
rows=[]
for p in sorted(Path('tmp/pdfs').glob('case-*-body-only.pdf')):
    body=PdfReader(p)
    full=PdfReader(Path('output/pdf')/p.name.replace('-body-only','-counsel-brief'))
    def text(page):return unicodedata.normalize('NFKC',page.extract_text())
    rows.append({'case':p.stem.replace('-body-only',''),'bodyPages':len(body.pages),'fullPages':len(full.pages),'pageSizePoints':[round(float(body.pages[0].mediabox.width),2),round(float(body.pages[0].mediabox.height),2)],'bodyTextCharacters':len(text(body.pages[0])),'appendixStartsPage2':'引用附件' in text(full.pages[1]),'bodyMatchesFullPage1':text(body.pages[0])==text(full.pages[0]),'cjkNormalization':'NFKC for compatibility radical glyphs in PDF extraction','fontSizePt':10,'lineHeight':1.4})
assert len(rows)==3
assert all(r['bodyPages']==1 and r['appendixStartsPage2'] and r['bodyMatchesFullPage1'] for r in rows)
Path('docs/whats-next-2026-10-09/ui-evidence/brief-print-checks.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(rows,ensure_ascii=False,indent=2))
