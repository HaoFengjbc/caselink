#!/usr/bin/env python3
"""Deterministic, offline, append-only research importer. No network or model calls.

Usage: bundled-python scripts/import-followups.py [--source-dir DIR] [--check]
Reads the preserved independent research and writes ONLY incremental.json and
import-manifest.json. Baseline cases/evidence and legacy six-case files are read-only.
Classification is explicit per input row; imported author's 'verified' is never review.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/followups'
ORIGINALS = ROOT / 'docs/whats-next-2026-10-09/history-originals'
CHECKED = '2026-10-09'
VERSION = 'whats-next-followups-v1'
PEOPLE = {
    'wuth-boonlert-samak-donnapee': ['Wuth Boonlert', 'Samak Donnapee'],
    'katsiaryna-andreyeva-daria-chultsova': ['Katsiaryna Andreyeva', 'Daria Chultsova'],
    'malaysiakini-steven-gan': ['Malaysiakini (company)', 'Steven Gan'],
    'hajar-raissouni': ['Hajar Raissouni'],
    'omar-radi-2020': ['Omar Radi'], 'omar-radi-ii-2022': ['Omar Radi'],
}
MAP = [
    ['wuth-boonlert-samak-donnapee'], ['alnur-ilyashev'], ['alexander-pichugin'],
    ['asad-ali-toor', 'bilal-ghauri'], ['emna-chargui'], ['shahidul-alam'],
    ['katsiaryna-andreyeva-daria-chultsova'], ['mzia-amaglobeli'], ['jose-ruben-zamora'],
    ['bao-choy'], ['aigul-utepova'], ['malaysiakini-steven-gan'], ['marina-zolotova'],
    ['hajar-raissouni'], ['omar-radi-ii-2022'], ['omar-radi-2020'], ['svetlana-prokopyeva'],
    ['cansu-piskin'], ['moses-bwayo'], ['dian-abdullah'], ['myriam-bribri'],
]
# Kind/scope/status codes. Every one of the 150 rows is classified explicitly.
KINDS = dict(A='historical_action', D='decision', O='observed_outcome', R='risk_personal', P='publication', S='schedule_plan')
SCOPES = dict(s='same_case', o='same_person_other_case', c='co_defendant', g='general_legal_background', p='professional_activity')
STATUSES = dict(i='implemented', u='unknown', s='submitted', h='scheduled', p='planned')
CLASSES = {
 1: 'Dsi Psi Dsi Doi',
 2: 'Dsi Dsi Dsi Osi Psi Ass Rou',
 3: 'Dsi Dsi Ass Dsi Rou Dsi',
 4: 'Dgi Pgi Dgi Sgh Doi Doi',
 5: 'Rsu Dsi Ass Psi Psi',
 6: 'Rsu Dsi Osi Dsi Dsi Dsi Psi',
 7: 'Dsi Doi Oci Doi Rcu Ooi Psi',
 8: 'Dsi Dsi Psi Dsi Osi Ass Osi Psi Psi',
 9: 'Dsi Dsi Osi Dsi Osi Osi Dsi Dsi Dsi Psi',
10: 'Psi Dsi Dsi Dgi Pgi Dgi',
11: 'Rsu Dsi Dsi Ass Ass',
12: 'Rsu Dsi Ssp Ssh Dsi',
13: 'Psi Rou Doi Ooi Rou Oci',
14: 'Rsu Ass Dsi Osi Psi Psi Rsu Psu',
15: 'Rsu Dsi Dsi Psi Dsi Osi Rsu Psi Psi Psi',
16: 'Rsu Rsu Ass Psi Poi Ooi Rou Api Poi',
17: 'Dsi Dsi Ass Rou Osi Rou Rou Dsi Doi Aos',
18: 'Rsu Dsi Psi Ppi Ppi',
19: 'Rsu Rsu Dsi Rsu Psi Psi Rpu Ppu Ppu Ppi',
20: 'Rsu Rsu Dsi Ass Dsi Dgi Dgi Dgi',
21: 'Rsu Dsi Ass Osi Asi Ssh Ssh',
}
# Deduplicate overlapping events at assembly time by the existing stable event ID.
# Input-row IDs remain separately preserved in import-manifest.json.
ALIASES = {
 (2,3): 'alnur-followup-2022-03-30-wgad-opinion',
 (2,6): 'alnur-followup-2025-hrc-awaiting-registration',
 (11,4): 'aigul-followup-2022-04-27-hrc-filing-confirmed',
 (11,5): 'aigul-followup-2025-hrc-pending',
 (15,5): 'omar-ii-followup-2023-07-18-cassation',
 (15,6): 'omar-ii-followup-2024-07-29-release',
 (21,2): 'myriam-followup-conviction',
 (21,3): 'myriam-followup-defence-appeal',
}
SPECIAL = {
 (1,4): ('Wuth / Suracha: separate Surapon defamation proceeding', ['Wuth Boonlert','Suracha Boonyeim'], '不同控诉人、言论及共同被告；不属于Samak的原案。'),
 (2,7): ('Alnur: 2026 Article 190 fraud investigation', ['Alnur Ilyashev'], '2026另案证人/辩护权身份；并非原Article 274案重新定罪。'),
 (4,5): ('Toor: 2026 Section 26A NCCIA inquiry', ['Asad Ali Toor'], '新调查文书披露命令，未证明原案结案。'),
 (4,6): ('Ghauri: FIR 143/2026, Sections 20 and 26A', ['Bilal Ghauri'], '新案有条件保释命令；未确认满足担保条件、实际释放或撤罪。'),
 (5,3): ('Chargui: appeal and asylum reported by the original June 2021 report', ['Emna Chargui'], '2021-06只是原报告日期；上诉递交与寻求庇护具体事件日期均未载，不能当作六月实施。'),
 (7,2): ('Andreyeva: separate 2022 treason proceeding', ['Katsiaryna Andreyeva'], '非原共同被告公共秩序案；不归属Daria。'),
 (7,3): ('Chultsova: original public-order sentence completion', ['Daria Chultsova'], '9月获释日有3/5日差异，保留月精度；不归属Andreyeva。'),
 (7,4): ('Andreyeva: separate treason appeal', ['Katsiaryna Andreyeva'], '另案八年三个月总刑期；非Daria的刑期。'),
 (7,5): ('Chultsova: post-release personal situation', ['Daria Chultsova'], '生活状况报道，不是原定罪被撤销。'),
 (7,6): ('Andreyeva: 2026 pardon after later treason case', ['Katsiaryna Andreyeva'], '赦免/离境不等于原两案撤罪。'),
 (8,3): ('Amaglobeli: ECtHR detention applications 13661/25 and 36304/25', ['Mzia Amaglobeli'], '1月14为律师通报；刑事/行政拘押申请分别于2025-04-28及2025-11-17提交。'),
 (8,4): ('Amaglobeli: cassation and separate ill-treatment application', ['Mzia Amaglobeli'], '同一输入行含国内不予受理与另项酷刑待遇申请，非一个成功结果。'),
 (8,5): ('Amaglobeli: ECtHR ill-treatment complaint', ['Mzia Amaglobeli'], '登记非受理或实体裁判；不同于定罪申诉。'),
 (8,6): ('Amaglobeli: ECtHR conviction/fair-trial application', ['Mzia Amaglobeli'], '提交与7月3日登记分开；原始案卷未读取。'),
 (8,7): ('Amaglobeli: ECtHR conviction/fair-trial application', ['Mzia Amaglobeli'], '登记非受理或实体裁判。'),
 (12,2): ('Malaysiakini company contempt conviction / Gan acquittal', ['Malaysiakini (company)','Steven Gan'], '同一原行两被告结果相反：公司被罚、Gan无罪，禁止共同状态。'),
 (12,3): ('Malaysiakini company review: expected listing', ['Malaysiakini (company)'], '原报告预计日期，不能推定当日审理或裁判。'),
 (12,4): ('Malaysiakini company review: rescheduling', ['Malaysiakini (company)'], '2022-01-03是排期消息发表日；新排期2022-03-29。'),
 (12,5): ('Malaysiakini company review', ['Malaysiakini (company)'], '公司复审被驳回；不改变Gan无罪。'),
 (13,2): ('Zolotova: later TUT.BY prosecution', ['Marina Zolotova'], '不是2019 BeLTA罚金案。'),
 (13,3): ('Zolotova: later TUT.BY prosecution', ['Marina Zolotova'], '12年刑与原案分开；税务指控撤销不等于本案无罪。'),
 (13,4): ('Zolotova: later TUT.BY pardon', ['Marina Zolotova'], '本人2025-12-13释放；不等于撤销两案定罪。'),
 (13,5): ('Zolotova: post-release exile account', ['Marina Zolotova'], '2026-08-07为本人采访发表日，不是新法院决定。'),
 (13,6): ('Chekina: later TUT.BY co-defendant release', ['Liudmila Chekina'], '2026-09-16是Chekina释放，不能改写Zolotova释放日期。'),
 (14,3): ('Hajar: domestic conviction and AL MAR 4/2019', ['Hajar Raissouni'], '混合行：国内定罪与特别程序来函独立，不互相等价。'),
 (16,6): ('Radi II later imprisonment: pardon scope unverified for Radi I', ['Omar Radi'], '2024赦免不可归入原推文案撤罪；个别赦免文书未取得。'),
 (16,8): ('Radi: educational school visits', ['Omar Radi'], '职业活动非原推文案司法进展；犯罪记录来源尚不能分配到某一定罪。'),
 (17,8): ('Prokopyeva: ECtHR application 60839/21', ['Svetlana Prokopyeva'], '国际赔偿裁定不等于实际付款或国内撤罪。'),
 (17,9): ('Prokopyeva: separate foreign-agent-label administrative fine', ['Svetlana Prokopyeva'], '2026-04-20报道与另一源4月21日裁判日期冲突，保留月精度。'),
 (17,10): ('Prokopyeva: separate foreign-agent-label fine appeal', ['Svetlana Prokopyeva'], '收到上诉与安排6月8听证均非胜诉；后续结果未知。'),
 (18,4): ('Piskin as observer in Kalafat / Akgul prosecution', ['Cansu Piskin (observer)'], '获无罪的是Haluk Kalafat和Elif Akgul；Piskin为观察员。'),
 (18,5): ('Piskin as author reporting Ismail Ari proceeding', ['Cansu Piskin (author)'], 'Piskin是作者，2026-01-13是Ari听证日期；非Piskin裁判。'),
 (19,10): ('Bwayo professional film credit', ['Moses Bwayo'], '2025-12-10为电影节名单公告；不证明2026首映已发生。'),
 (20,7): ('Quah constitutional litigation: general Section 233 context', [], 'Quah是他人另案，只作一般法律背景；不得自动撤销Dian定罪。'),
 (20,8): ('Quah Federal Court constitutional litigation', [], '他人另案，非Dian上诉；2025/2026法律变化不得倒推个人状态。'),
 (21,2): ('Bribri Article 86 first-instance conviction', ['Myriam Bribri'], '判决20/21日来源冲突；Amnesty称缓刑，未确认执行。'),
 (21,3): ('Bribri Article 86 defence appeal', ['Myriam Bribri'], '上诉22/23日冲突；检方亦上诉；结果未知。'),
 (21,6): ('Bribri appeal session announcement', ['Myriam Bribri'], '9月27为公告日期，预告9月28开庭；未证实实际开庭。'),
 (21,7): ('Bribri expected appellate ruling', ['Myriam Bribri'], '10月9为公告日期，预告10月12裁判；不证明实际作出或胜诉。'),
}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def norm(text):
    return re.sub(r'[^a-z0-9]', '', text.lower())

def serialize(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2) + '\n'

def build(source_dir):
    from pypdf import PdfReader
    manifest = json.loads((source_dir / 'Research_and_Source_Manifest.json').read_text())
    cases = {c['caseId']: c for c in json.loads((ROOT/'data/cases/cases.json').read_text())}
    documents = json.loads((ROOT/'data/evidence/documents.json').read_text())
    legacy = [DATA/name for name in ['kazakhstan.json','tunisia.json','morocco.json']]
    legacy_events = {e['eventId']: e for p in legacy for c in json.loads(p.read_text()) for e in c['events']}
    reviews = json.loads((DATA/'reviewed-actions.json').read_text())
    for protected in json.loads((DATA/'baseline-hashes.json').read_text()):
        if digest(ROOT/protected['path'])!=protected['sha256']:
            raise ValueError('Protected baseline changed: '+protected['path'])
    audit = dict(version=VERSION, checkedAt=CHECKED, researchCutoff=manifest['research_cutoff'],
        authorVerificationNotAdopted=True, originalsAreSameResearchNotIndependentCorroboration=True,
        originalManifestClaims={k:manifest[k] for k in ['input_pdf_count','unique_report_count','independent_research']},
        immutableFiles=[dict(path=str(p.relative_to(ROOT)),sha256=digest(p)) for p in legacy + [ROOT/'data/cases/cases.json',ROOT/'data/evidence/evidence.json',ROOT/'data/evidence/documents.json']],
        reports=[], rows=[], sourceRecords=[], preservedFiles=[])
    for p in sorted(source_dir.iterdir()):
        if p.suffix in ['.json','.pdf']:
            audit['preservedFiles'].append(dict(name=p.name,sha256=digest(p),pages=len(PdfReader(p).pages) if p.suffix=='.pdf' else None))
    result={}
    for report in manifest['reports']:
        number=report['number']; ids=MAP[number-1]; rid=f'followup-report-{number:02}'
        assert len(report['timeline'])==len(CLASSES[number].split())
        pdf=source_dir/report['filename']; pages=[p.extract_text() or '' for p in PdfReader(pdf).pages]
        original_doc=next((d for d in documents if d['hash']==report['original_sha256']),None)
        if not original_doc:raise ValueError('No hash-matched baseline report: '+rid)
        report_meta=dict(reportId=rid,number=number,caseIds=ids,filename=pdf.name,sha256=digest(pdf),pages=len(pages),
             sourceOriginalFactsAsOf=report['original_date'], preservedCaseCutoffs={cid:cases[cid]['lastKnownStatusAsOf'] for cid in ids},
             researchCutoff=manifest['research_cutoff'],authorLastVerifiedEvent=report['last_verified_event'],
             baselineDocumentId=original_doc['documentId'],baselineDocumentHash=original_doc['hash'],
             authorStatusQualification=report['status_qualification'],timelineRows=len(report['timeline']),
             sharedBackgroundOwner='asad-ali-toor' if number==4 else None)
        audit['reports'].append(report_meta)
        srcs=[]
        for s in report['sources']:
            sid=f'{rid}-source-{s["id"]}'
            original=s['id']=='O'
            # Keep the supplied author-local path as provenance only; never pretend to open it.
            url=original_doc['sourceUrl'] if original else s['url']
            source=dict(sourceId=sid,title=s['title'],url=url,publisher=s['publisher'],
                publishedAt=s['published'] if re.fullmatch(r'\d{4}(-\d{2})?(-\d{2})?',s['published']) else None,
                locator='上传研究清单所引定位（底层原文本轮未核对）：'+'; '.join(s['supported_facts']),quote='',
                readStatus='search_only',checkedAt=CHECKED,reviewStatus='unreviewed',teamReviewedAt=None,teamReviewer=None,
                sourceKind='uploaded_research' if original else 'underlying_source',supportLevel='research_reported',reportId=rid,publishedDateText=s['published'])
            srcs.append(source)
            audit['sourceRecords'].append(dict(reportId=rid,sourceId=sid,originalSourceId=s['id'],kind=s['kind'],url=s['url'],readStatus='not_opened_this_run',independentlyVerified=False))
        for cid in ids:
            assert cid in cases
            result[cid]=dict(caseId=cid,originalFactsAsOf=cases[cid]['lastKnownStatusAsOf'],checkedAt=CHECKED,searchStatus='limited',
                summary='上传独立研究报告记载；未经团队人工核实。'+report['status_qualification'],events=[],sources=srcs.copy(),
                searchedSources=['本轮逐份读取上传PDF与manifest；未把研究作者的检索/verified作为团队核查。'],
                unknowns=['研究截止并非当前司法状态确认日；PDF和JSON是同一研究成果。',*report['gaps']])
            if number==4:
                result[cid]['unknowns'].append('PECA共享法律背景的唯一记录保存在Asad Toor项；Ghauri只载其个人另案。共享关联见import-manifest。')
            if report['original_date']!=cases[cid]['lastKnownStatusAsOf']:
                result[cid]['unknowns'].append('研究材料原始日期精度不同；保留既有case截止'+cases[cid]['lastKnownStatusAsOf']+'，研究字段为'+report['original_date']+'。')
        for index,(row,code) in enumerate(zip(report['timeline'],CLASSES[number].split()),1):
            rowid=f'{rid}-row-{index:02}'
            cid=ids[1] if number==4 and index==6 else ids[0]
            entry=result[cid]
            # Verify each timeline sentence against the actual PDF, not just JSON.
            key=norm(row['event']); locator_pages=[i+1 for i,t in enumerate(pages) if key in norm(t)]
            if not locator_pages:
                raise ValueError(f'Timeline not found in PDF: {rowid}')
            upload_id=f'{rowid}-uploaded-passage'
            entry['sources'].append(dict(sourceId=upload_id,title=report['cover_title']+' — uploaded independent follow-up',
                url=(ORIGINALS/pdf.name).as_uri(),publisher='用户提供的独立研究作者（非TrialWatch官方报告）',publishedAt=manifest['research_cutoff'],
                locator='PDF页 '+','.join(map(str,locator_pages))+'；KEY PROCEDURAL DATES；'+rowid,quote=row['event'],
                readStatus='full_text',checkedAt=CHECKED,reviewStatus='unreviewed',teamReviewedAt=None,teamReviewer=None,
                sourceKind='uploaded_research',supportLevel='research_reported',reportId=rid,publishedDateText='研究截止 '+manifest['research_cutoff']+'；未独立核实出版日'))
            kind,scope,status=KINDS[code[0]],SCOPES[code[1]],STATUSES[code[2]]
            default_subjects=PEOPLE.get(cid,[cases[cid]['title']])
            proceeding,subjects,note=SPECIAL.get((number,index),(cases[cid]['title']+' — original monitored proceeding',default_subjects,''))
            if scope=='general_legal_background':subjects=[]
            event_id=ALIASES.get((number,index),rowid)
            precision={4:'year',7:'month',10:'day'}.get(len(row['date']),'unknown')
            event=dict(eventId=event_id,proceeding=proceeding,subjects=subjects,eventDate=row['date'] if precision!='unknown' else None,datePrecision=precision,
                actors=[],action='上传研究报告记载：'+row['event'],executionStatus=status,
                outcome='仅作研究记录；此行未独立证明后续救济、执行或成功。'+note,
                relationshipToOutcome='unknown',causalAttribution=None,
                sourceIds=[upload_id]+[f'{rid}-source-{x}' for x in row['cites']],
                unknowns=['底层来源尚未逐项打开；研究作者verified不得解释为团队核实。',*([note] if note else [])],
                eventKind=kind,scope=scope,proceedingId=proceeding,personIds=[re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-') for s in subjects],
                reportId=rid,researchCutoff=manifest['research_cutoff'],supportClaim=row['event'],verification='research_reported')
            if (number,index) in [(5,3),(17,10)]:
                event['eventDate']=None;event['datePrecision']='unknown'
                event['unknowns'].append('原输入日期'+row['date']+'是材料/报道日期；实际递交或收件日尚未确认。')
            if event_id in legacy_events:
                old=legacy_events[event_id]
                # Existing text and historical checks survive. This is only metadata/source enrichment.
                event.update({k:old[k] for k in ['proceeding','subjects','eventDate','datePrecision','actors','action','executionStatus','outcome','relationshipToOutcome','causalAttribution']})
                event['unknowns']=list(dict.fromkeys(old['unknowns']+event['unknowns']))
                # Sources from old records are merged by corpus; do not add unresolved IDs here.
            entry['events'].append(event)
            audit['rows'].append(dict(importRowId=rowid,caseId=cid,eventId=event_id,sourceDate=row['date'],sourceEvent=row['event'],pdfPages=locator_pages,
                eventKind=kind,scope=scope,executionStatus=status,legacyMerge=event_id in legacy_events))
    for review in reviews['actions']:
        cid=review['caseId']; entry=result[cid]; eid=review['event']['eventId']
        match=next((e for e in entry['events'] if e['eventId']==eid),None)
        event=dict(review['event'])
        if match:
            event['sourceIds']=list(dict.fromkeys(event['sourceIds']+match['sourceIds']))
            event['unknowns']=list(dict.fromkeys(event['unknowns']+[x for x in match['unknowns'] if not x.startswith('底层来源尚未')]))
            entry['events'][entry['events'].index(match)]=event
        else:entry['events'].append(event)
        entry['sources'] += review['sources']
    for entry in result.values():
        entry['sources']=list({s['sourceId']:s for s in entry['sources']}.values())
        assert len(entry['events'])==len({e['eventId'] for e in entry['events']})
    audit['counts']=dict(reports=len(audit['reports']),caseMappings=sum(len(x['caseIds']) for x in audit['reports']),
        inputTimelineRows=len(audit['rows']),inputSourceRecords=len(audit['sourceRecords']),
        webSourceRecords=sum(s['originalSourceId']!='O' for s in audit['sourceRecords']),
        uniqueWebUrls=len({s['url'] for s in audit['sourceRecords'] if s['originalSourceId']!='O'}),
        pdfPages=sum(x['pages'] or 0 for x in audit['preservedFiles']),
        sourceCheckedActions=len(reviews['actions']),outputEventRecords=sum(len(x['events']) for x in result.values()),
        teamVerified=0)
    audit['reviewedActionIds']=[x['event']['eventId'] for x in reviews['actions']]
    assert audit['counts']['inputTimelineRows']==150
    return list(result.values()),audit

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir',type=Path,default=ORIGINALS)
    parser.add_argument('--check',action='store_true',help='Check byte-for-byte deterministic output without writes')
    args=parser.parse_args(); incremental,audit=build(args.source_dir)
    for name,obj in [('incremental.json',incremental),('import-manifest.json',audit)]:
        path=DATA/name; body=serialize(obj)
        if args.check:
            if not path.exists() or path.read_text()!=body:raise SystemExit(f'Out of date: {path}')
        else:path.write_text(body)
    print(serialize(audit['counts']).strip())

if __name__=='__main__':main()
