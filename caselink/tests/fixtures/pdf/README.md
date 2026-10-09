# Fictional PDF materials

All names, parties, allegations and events in these fixtures were invented for CaseLink development. They are not real case records and contain no private user material. They may be used for local tests and demos. The output assertions in unit/browser tests are simulated provider responses; they do not prove a real model extracted these materials.

Rebuild with `scripts/create-pdf-fixtures.py` using Python with reportlab, pypdf and Pillow. This fixture-only script is not an application/server dependency. `expression-letter.pdf` and `expression-update.pdf` concern the same invented journalist matter and deliberately disagree on the letter's receipt date. The first file prints page 101 on its physical PDF page 1, exercising the distinction between physical and printed page numbers. The application verifies physical page numbers only; `printedPage` stays `null`.

- `expression-letter.pdf`: two-page extractable text, alleged defamation and requested damages, historical status and requested response date.
- `expression-update.pdf`: one-page same-case update, conflicting receipt date and missing envelope/delivery evidence.
- `multiple-cases.pdf`: two different fictional proceedings requiring user selection.
- `prompt-injection.pdf`: untrusted document instructions that must remain inert data.
- `scanned-image.pdf`: actual raster-only PDF, no embedded text and no OCR.
- `blank.pdf`: blank physical page.
- `encrypted.pdf`: encrypted copy; public fixture password is `fictional-test-password`, but the application does not accept passwords or decrypt PDFs.
- `corrupt.pdf`: deliberately malformed bytes beginning with a PDF signature.
- `too-many-pages.pdf`: 31 physical pages, exceeds the 30-page case limit.
- `text-budget.pdf`: 10 readable pages with more than 75,000 UTF-8 bytes of text; later complete pages are explicitly omitted rather than silently truncated.

`expression-letter.pdf` page 1 was rendered and visually checked during implementation. Parsing tests inspect the actual generated files with the same isolated PDF.js parser used by the route. Binary fixtures are the only committed PDFs and are development assets, not saved user uploads.
