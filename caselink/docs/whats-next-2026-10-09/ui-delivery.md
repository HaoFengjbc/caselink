# What’s Next — UI and filled working documents

Implementation date: 2026-10-09 (America/New_York).

The existing analysis result page now reads `snapshot.whatsNext`. It shows at most three preparation priorities, fact IDs, gaps and why they matter, suggested unassigned roles, qualified historical actions, frozen legal bindings, conditional paths and paused actions. Missing facts return to the ordinary manual intake. Existing legal research and historical actions remain available below.

Each new report contains three editable Markdown documents: the case chronology and materials index, issue–evidence–authority table, and a concise internal counsel brief with a separate full citation appendix. They contain the user's facts, concrete disclosure choice, procedural position, evidence gaps and counsel questions. Document/file/page metadata is used only if present in the saved materials record. No new PDF upload, OCR or storage code was changed. Downloads are generated locally from the current document body and citation state.

Manual edits conservatively mark original citations `needs_review`. Progress is recorded only by the user and does not upgrade citations or team review. Revised facts preserve the old edited body and present the newly generated body for comparison; choosing to retain the edit keeps the recheck marker. Saved historical reports stay frozen; edits in a historical view form an in-memory revision for individual download and do not overwrite the saved report. The existing explicit-save and clear mechanisms are reused; no new automatic storage is introduced.

`/compare` retains its existing limit of 2–4 cases. New comparison snapshots include the selected cases’ follow-ups with event kind, scope, implementation status, actors, later outcomes, source dates, limitations and original cut-offs. Imported legacy snapshots are not backfilled. Both page and Markdown export distinguish mixed research records from historical actions. No success rates or strategy ranking are computed.

## Verification

- Targeted Vitest: 28 passed across `whats-next-materials`, `work-pack`, `research-workspace`, and `web-export` before the final integrated run. Checks include three unfamiliar inputs without example IDs, real case text, disclosure restrictions, unknowns, frozen-catalog independence, invalid binding support, edited citation status and comparison snapshots.
- TypeScript check passed after implementation.
- Playwright uses `/new` → “没有文件，直接描述”, explicitly disables AI in the page, and adds only `forceRule: true` to the real analysis request. It does not mock analysis responses or inject case state. The three narratives are entered in the actual UI. Three real browser downloads per case are saved and read back, then citation invalidation, explicit saving, 390-pixel layout and immutable history are checked.
- The first case also changes the actual narrative and reruns the server analysis, verifies `needs_merge`, opens the newly generated draft, then keeps the previous human edit.
- A separate browser flow creates and actually downloads the Utepova/Ilyashev comparison.
- The combined new-flow and existing source-integration run passed 8/8 (27.8 seconds). The final frozen-source new-flow/comparison rerun passed 4/4 (15.6 seconds). The latter refreshed all ordinary inputs, complete outputs, nine working-document downloads and comparison download. The combined report and its four legacy regression artifacts are retained separately.
- All three cases have desktop priority-card, document-workspace and 390-pixel mobile screenshots. Existing source-integration tests exposed a real mobile min-content overflow with expanded imported citations; the mobile grid and flex children now use bounded minimum widths and wrap long source identifiers. The existing tests subsequently passed without weakening their overflow checks. Manual-input checks also exposed a counsel-status recognition gap, corrected in the lead's shared context reader; the final ordinary Kazakhstan output preserves the reported existing lawyer and includes an ICCPR Article 9 research binding.
- Initial browser harness failures were corrected: `/new` begins at the existing upload tab, so the test must explicitly select manual entry; the merge preview assertion must scope its lookup to the expanded new-draft section because the same text also appears in collapsed fact evidence.
- Each final browser-downloaded counsel brief was printed locally to A4 using `ui-render-briefs.mjs`, without regenerating case facts. The body is one page in all three cases at 10-point type and 1.4 line spacing; full PDFs contain 6, 3 and 3 pages respectively, with the citation appendix beginning on page 2. `ui-check-briefs.py` verifies page count, A4 size and equality between the body-only text and the complete PDF's first page. All three body pages and the 12-page overview were visually inspected for legibility, clipping and overlap.

## Evidence and deliverables

- `ui-evidence/case-1`, `case-2`, `case-3`: actual ordinary input, complete server output, three filled Markdown downloads per case, and desktop/mobile screenshots.
- `ui-evidence/comparison`: actual comparison Markdown download and screenshot.
- `ui-evidence/browser-results.json`: final frozen-source 4/4 browser run. `browser-results-full-regression.json`: prior integrated 8/8 run, including the four existing source-integration checks. `legacy-examples` preserves their exports and screenshots.
- `ui-evidence/download-checks.json`: artifact byte sizes and SHA-256 hashes. `brief-print-manifest.json` and `brief-print-checks.json`: print source and pagination verification. `print` contains body screenshots and the complete-page overview.
- `output/pdf/case-1-counsel-brief.pdf`, `case-2-counsel-brief.pdf`, `case-3-counsel-brief.pdf`: final A4 counsel briefs with full citation appendices, plus the corresponding local HTML sources.

## Boundaries

- Rule-mode browser tests are not real-AI acceptance. The lead owns any budget-authorized real-AI run and its separate call record.
- No target-user or local-lawyer review has occurred. The materials remain internal working drafts, and no “lawyer reviewed” or team-verified state was created.
- The delivered A4 PDFs have verified one-page bodies. Markdown remains editable; other renderers and print settings can change its physical pagination.
- No institution was contacted, no material submitted or published, and no push or deployment was performed by this worker.
