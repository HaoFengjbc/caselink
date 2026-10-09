# Agent A — workflow, privacy and snapshot handoff

This implementation is on `caselink/iteration-a` in its own worktree. No production deployment or paid AI calls were made. The current TrialWatch expression-case scope, not the old general-dispute audit positioning, governs the work.

## Implemented behavior

- Both editors retain the entire `NewCaseInput.intake` record. Switching no longer removes jurisdiction, long narrative, custom goals, follow-up answers or disclosure restrictions. The classic review includes the full record and explicitly confirms it for submission. Choosing no AI changes only `UsePreferences`.
- Failures are bound to a fact revision. Edits clear a terminal failure and exhausted retry state; unchanged retries retain request ID and input version, obey retryable/error metadata and stop after two attempts. Cancelled or superseded responses cannot overwrite a changed draft. Additional research is an explicit separate operation with its parent analysis ID.
- Server cookie bootstrap (`REQUEST_IN_PROGRESS` with exactly `retryAfterSeconds: 0`) is handled once automatically with the identical payload; it is not charged against the user's unchanged-input retry count. Nonzero in-progress responses and other failures are never automatically retried.
- New workflows default to memory only. No original facts are automatically written to localStorage or sessionStorage. Optional refresh recovery is a separate consent for up to 24 hours in the current tab, with a visible expiry and immediate removal on opt-out. Browser preference/language cookies are outside this fact-storage policy.
- Each report has a separate explicit save action, with 1/7/30-day retention (default 7). New analyses reset workflow preferences. Expired reports are removed on the next history visit, not by a background service while the browser is closed. Existing saved reports keep their original expiry.
- Legacy local history remains readable; legacy tab drafts are neither silently deleted nor silently loaded. The user can restore or remove an older draft explicitly.
- Deleting a report detaches only the matching result, retaining the current draft. Shared tombstones contain only a SHA-256 digest of the report ID and deletion time, and every archive/import observes them. A deletion wins over a stale tab attempting to save the old record again.
- Export and import share a 3,000,000-byte / 500-record file boundary. Split backups are generated when required; an individually oversized legacy report yields a clear failure, never an allegedly recoverable backup. Local persisted report capacity is bounded separately at 4,000,000 bytes / 500 records; failed explicit saves remain downloadable in memory and are identified as unsaved.
- New snapshot helpers freeze case records, original excerpts, documents, used resources, web sources and review descriptors. Completeness checks include referenced cases, evidence, documents and resources. Historical UI, evidence dialog and exports read snapshot data without current corpus enrichment or translation overlays. Legacy snapshots are explicitly partial and retain only the evidence actually present in the old result.
- Comparison Markdown uses the same frozen brief, includes case/event/action/outcome fields, quoted sources, differences/unknowns and conditional international resources. Original country labels are localized at capture time and then frozen.

## Integration owned by the lead

1. B must attach `captureReportSnapshot(result, locale)` at **generation time** on every new result (rule/preset/live), not on later history open/save. The helper is exported from `src/lib/reports/snapshot.ts`.
2. Re-export B's `isUnitedKingdom(country)` from `adaptive-state.ts` after `jurisdiction.ts` is merged, replacing the duplicate old frontend recognizer.
3. Add C's `EvidenceLayers({snapshot})` to `AnalysisView` after its new module exists. C's compare view uses A's `captureCaseSnapshot` and `comparisonMarkdown`; structured comparison history was intentionally not introduced. A saved comparison Markdown can use the existing read-only import path.
4. B's API must accept the shared request identity/preferences. Capabilities can expose `usageControlConfigured`, `controlledSearchConfigured`, `idempotencyResultRetentionSeconds:120` and `progressEvents:false`. A shows configuration gaps and only generic processing, never fabricated stage progress.
5. Service-side encrypted result retention must match the visible maximum of two minutes. UI makes no assertion that Redis is connected merely because fields exist.

## Validation actually run

- `npm ci`: independent dependency installation; zero known audit vulnerabilities reported by npm at install.
- `npm run typecheck`: passed after final changes.
- Focused Vitest suite: **50 passed / 6 files** (`history`, `report-snapshot`, `qa-regression`, `adaptive-independent`, `web-export`, `workflow-client`). Uses fictional inputs, in-memory storage and mock HTTP only. The snapshot tests mutate current corpus and English overlays, then assert frozen Markdown and evidence-dialog HTML are unchanged; data is restored in `finally`.
- Full unit suite: **334 passed, 1 failed, 2 skipped / 337**. The remaining failure is `i18n.test.ts` English export: the isolated pre-B service does not yet attach a snapshot, so the new exporter correctly refuses to translate missing historical metadata from today's corpus. Re-run after B's generation-time snapshot hook. Do not resolve this by restoring mutable-corpus fallbacks. The two skipped tests are existing unavailable provider fixtures, not live verification.
- Production build: passed on this branch; local static/dynamic route compilation is not a deployment or a paid-provider test.
- No real user browser data was read, altered or deleted. Browser interaction acceptance remains for the lead's integrated build; these unit/mocked checks are not a claim of full browser or live-provider acceptance.

## Integrated demo checklist

1. New fictional expression case: default memory message, AI/recovery switches, long narrative and private disclosure restrictions. Switch to classic and back; verify full record.
2. Confirm and submit with AI disabled: rules work; refresh loses the unsaved workflow. Repeat with refresh consent; reload restores it and opt-out removes the recovery copy.
3. Inject a model error locally; edit and confirm the goal; verify submit returns. Exercise cookie bootstrap without consuming the one real retry. Cancel and start another case; late output cannot replace it.
4. Save a completed report for seven days. Start a new draft B and delete report A in another tab: B survives; A cannot reappear. Backup/import on a clean isolated browser; multi-part files each restore.
5. Freeze a report and comparison; update current corpus in the test environment. Historical body, evidence dialog and Markdown remain consistent. Legacy imports show their incomplete-record limitation.
6. Explicit supplement: opening the confirmation makes zero requests; confirmation sends `operation:supplement` with a fresh request ID and parent analysis ID. Paid limits/configuration errors retain a usable rule path.
