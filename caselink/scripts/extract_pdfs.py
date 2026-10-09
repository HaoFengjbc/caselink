#!/usr/bin/env python3
"""Offline extraction only. Runtime website never depends on Python or raw PDFs.
Usage: python scripts/extract_pdfs.py PDF [PDF ...] --output .local-sources/extracted
Requires pypdf. Each unique SHA256 is extracted once; manifest preserves aliases.
"""
import argparse
import hashlib
import json
from pathlib import Path
from pypdf import PdfReader


def extract(paths, output):
    output.mkdir(parents=True, exist_ok=True)
    seen = {}
    manifest = []
    for source in paths:
        path = Path(source).expanduser().resolve()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        duplicate_of = seen.get(digest)
        if digest not in seen:
            reader = PdfReader(path)
            pages = [{"pdfPage": n, "text": p.extract_text() or ""} for n, p in enumerate(reader.pages, 1)]
            if not any(p["text"].strip() for p in pages):
                raise ValueError(f"No text in {path.name}; OCR/manual review required, not silently accepted")
            payload = {"sha256": digest, "originalFilename": path.name, "pageCount": len(pages), "pages": pages}
            (output / f"{digest}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
            seen[digest] = path.name
        manifest.append({"originalFilename": path.name, "sha256": digest, "duplicateOf": duplicate_of})
    (output / "manifest.json").write_text(json.dumps({"files": manifest, "uniqueDocumentCount": len(seen)}, ensure_ascii=False, indent=2) + "\n")
    return manifest, len(seen)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdfs", nargs="+")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    entries, count = extract(args.pdfs, args.output)
    print(json.dumps({"files": len(entries), "uniqueDocuments": count, "output": str(args.output)}, ensure_ascii=False))
