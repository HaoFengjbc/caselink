#!/usr/bin/env python3
"""Merge explicitly reviewed batches only; never extract/approve evidence automatically.
Run from any directory. Raw sources, local paths and review working files stay out of deployment.
"""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
read=lambda path:json.loads((ROOT/path).read_text())
norm=lambda text:re.sub(r'\s+',' ',text).strip()
def write(path,value):
    (ROOT/path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def main():
    catalog=read('data/research/catalog.json')
    batches=[read(f'data/research/curated/{name}-group.json') for name in ['evidence','intake','engine']]
    paths={'cases':'data/cases/cases.json','documents':'data/evidence/documents.json','evidence':'data/evidence/evidence.json'}
    id_keys={'cases':'caseId','documents':'documentId','evidence':'evidenceId'}
    merged={}
    for key,path in paths.items():
        additions=[record for batch in batches for record in batch[key]]
        ids=[record[id_keys[key]] for record in additions]
        assert len(ids)==len(set(ids)),f'Duplicate batch {key} IDs'
        merged[key]=[r for r in read(path) if r[id_keys[key]] not in ids]+additions
    assert len(merged['documents'])==21 and len(merged['cases'])==22,'Explicit report/proceeding count changed; review first'
    by_hash={d['sha256']:d for d in catalog['documents']}
    docs={d['documentId']:d for d in merged['documents']}
    cases={c['caseId']:c for c in merged['cases']}
    assert len({d['hash'] for d in docs.values()})==21,'Duplicate PDFs must not become multiple reports'
    extracts={}
    for d in docs.values():
        item=by_hash[d['hash']]
        assert hashlib.sha256(Path(item['paths'][0]).read_bytes()).hexdigest()==d['hash']
        extract=read('data/research/'+item['extractedFile'])
        assert extract['sha256']==d['hash'] and len(extract['pages'])==d['pageCount']
        assert d['publishedDate']==item['reportDate'],'Use verified cover/publication date'
        d['sourceFormat']='web_print' if 'americanbar.org' in d['sourceUrl'] else 'pdf'
        if 'PECA' in item['title'] or 'Pakistan' in item['title']:d['sourceType']='thematic_report'
        extracts[d['documentId']]=extract
    for e in merged['evidence']:
        d=docs[e['documentId']]
        assert e['documentId'] in cases[e['caseId']]['sourceDocumentIds'],e['evidenceId']
        page=extracts[e['documentId']]['pages'][e['pdfPage']-1]
        assert page['pdfPage']==e['pdfPage'] and norm(e['exactQuote']) in norm(page['text']),f"Quote/page mismatch: {e['evidenceId']}"
        assert e['reviewStatus'] in ['verified','conflict'] and e['origin']!='unverified_footnote',e['evidenceId']
        assert e['sourceUrl']==d['sourceUrl'],e['evidenceId']
    english=read('data/i18n/en.json')
    for batch in batches:
        for key,values in batch['english'].items():english.setdefault(key,{}).update(values)
    assert all(c['caseId'] in english['cases'] for c in cases.values())
    assert all(e['evidenceId'] in english['evidence'] for e in merged['evidence'])
    # Preserve an initial local backup; this is not a public artifact or another corpus.
    backup=ROOT/'data/research/before-formal-ingestion'
    backup.mkdir(exist_ok=True)
    for key,path in paths.items():
        dest=backup/f'{key}.json'
        if not dest.exists():dest.write_text((ROOT/path).read_text())
    if not (backup/'en.json').exists():(backup/'en.json').write_text((ROOT/'data/i18n/en.json').read_text())
    for key,path in paths.items():write(path,merged[key])
    write('data/i18n/en.json',english)
    for item in catalog['documents']:
        doc=next(d for d in docs.values() if d['hash']==item['sha256'])
        item.update(corpusInclusion='formally_imported',applicationDocumentId=doc['documentId'],applicationCaseIds=[c['caseId'] for c in cases.values() if doc['documentId'] in c['sourceDocumentIds']],reviewStatus='selected_evidence_reviewed_against_source')
    catalog['notApplicationCorpus']=False
    catalog['summary']['formallyImportedDocuments']=len(docs)
    catalog['summary']['applicationCaseRecords']=len(cases)
    write('data/research/catalog.json',catalog)
    receipt={'corpusVersion':'2026-10-08.v2','ingestedAt':datetime.now(timezone.utc).isoformat(),'reviewMeaning':'Selected excerpts and their structured interpretation checked against the supplied reports; not independent verification of underlying events or later case developments.',
             'counts':{'caseRecords':len(cases),'sourceDocuments':len(docs),'evidenceExcerpts':len(merged['evidence']),'regions':len({c['country'] for c in cases.values()})},
             'documents':[{'documentId':d['documentId'],'title':d['title'],'sha256':d['hash'],'reportDate':d['publishedDate'],'sourceFormat':d['sourceFormat'],'caseIds':[c['caseId'] for c in cases.values() if d['documentId'] in c['sourceDocumentIds']],'excerptCount':sum(e['documentId']==d['documentId'] for e in merged['evidence'])} for d in docs.values()]}
    write('data/evidence/ingestion.json',receipt)
    print(json.dumps(receipt['counts']))

if __name__=='__main__':main()
