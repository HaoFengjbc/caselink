#!/usr/bin/env python3
"""Verify curated excerpts against hash-addressed per-page extracts.
This catches source/page/transcription errors; it cannot establish semantic support.
Usage: python scripts/check_evidence.py --extracted .local-sources/extracted
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
normalize = lambda value: re.sub(r"\s+", " ", value).strip()


def check(extracted, research):
    docs = json.loads((ROOT / "data/evidence/documents.json").read_text())
    evidence = json.loads((ROOT / "data/evidence/evidence.json").read_text())
    cases = json.loads((ROOT / "data/cases/cases.json").read_text())
    document_map = {d["documentId"]: d for d in docs}
    case_map = {c["caseId"]: c for c in cases}
    failures = []
    for ev in evidence:
        doc = document_map[ev["documentId"]]
        path = extracted / (doc["hash"] + ".json")
        if not path.exists():
            path = research / (doc["hash"] + ".pages.json")
        extract = json.loads(path.read_text())
        if extract["sha256"] != doc["hash"] or extract.get("pageCount", len(extract["pages"])) != doc["pageCount"]:
            failures.append(f"Document identity mismatch: {doc['documentId']}")
        if doc["documentId"] not in case_map[ev["caseId"]]["sourceDocumentIds"]:
            failures.append(f"Wrong document owner: {ev['evidenceId']}")
        page = extract["pages"][ev["pdfPage"] - 1]
        if page["pdfPage"] != ev["pdfPage"] or normalize(ev["exactQuote"]) not in normalize(page["text"]):
            failures.append(f"Quote/page mismatch: {ev['evidenceId']}")
        if ev["sourceUrl"] != doc["sourceUrl"]:
            failures.append(f"Wrong source URL: {ev['evidenceId']}")
    if failures:
        raise SystemExit("\n".join(failures))
    print(json.dumps({"status": "passed", "documents": len(docs), "cases": len(cases), "excerpts": len(evidence), "scope": "hash, page, quotation and ownership; semantic support separately reviewed"}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extracted", default=ROOT / "data/extracted", type=Path)
    parser.add_argument("--research", default=ROOT / "data/research/extracted", type=Path)
    args = parser.parse_args()
    check(args.extracted, args.research)
