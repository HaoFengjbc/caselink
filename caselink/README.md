# CaseLink developer guide

CaseLink is a Next.js application for evidence-based research and case preparation involving journalism, public expression, and related criminal or civil proceedings. It combines a curated historical corpus, legal provisions, optional OpenAI research, and editable working documents.

[Project overview](../README.md) · [Documentation index](docs/README.md) · [Current release and known gaps](docs/current-release.md) · [Live application](https://caselink-eight.vercel.app/new)

## Requirements

- Node.js 24, as specified in `package.json` and `.nvmrc`.
- npm and the committed `package-lock.json`.
- Google Chrome for the existing Playwright configuration.
- An OpenAI API key and access to the configured models only if you enable live AI.

The application is in this directory. If you cloned the repository as `caselink`, the application path is `caselink/caselink` relative to the clone's parent directory.

## Local setup

Run these commands from the application directory:

```sh
npm ci
cp .env.example .env.local
ANALYSIS_MODE=demo npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Setting `ANALYSIS_MODE=demo` explicitly overrides an existing live setting in `.env.local`. Demo and rule modes do not call paid models or web search. Do not overwrite an existing `.env.local` when updating an established checkout.

For a local production build:

```sh
npm run build
ANALYSIS_MODE=demo npm start
```

Builds intentionally use webpack through the package script. Do not replace the existing build configuration as part of routine setup.

## Live AI configuration

Edit the ignored `.env.local` file on your own machine. Configure the same variables through your hosting provider for deployed environments.

| Variable | Purpose |
| --- | --- |
| `ANALYSIS_MODE` | `demo` by default; `live` enables configured provider use |
| `OPENAI_API_KEY` | Server-side API key; never place it in a `NEXT_PUBLIC_` variable |
| `OPENAI_MODEL` | Analysis and research model; the checked-in example uses `gpt-6.1-sol` |
| `OPENAI_INTAKE_MODEL` | Intake and material extraction model; the example uses `gpt-6-luna` |
| `OPENAI_WEB_SEARCH_ENABLED` | Set `false` to disable live web research; otherwise available in configured live mode |
| `OPENAI_REASONING_EFFORT` | `low`, `medium`, or `high`; default `low` |
| `AI_TIMEOUT_MS` | Synthesis timeout, up to 90,000 milliseconds |
| `AI_INTAKE_TIMEOUT_MS` | Manual intake model timeout; default 30,000 milliseconds |
| `AI_MATERIAL_TIMEOUT_MS` | PDF extraction model timeout; default 120,000 milliseconds |

The complete example is in [`.env.example`](.env.example). Keep real credentials out of source files, commits, logs, screenshots, and exported reports. Model names are configuration values and require access on the API account being used.

Web research uses the existing OpenAI Responses API and `web_search` tool. No Brave Search account or key is required. The capability endpoint reports `webSearchProvider: "openai"` and `webSearchAvailable`. It also reports `controlledSearchConfigured: false`, because OpenAI can expand public queries; this flag does not mean OpenAI search is unavailable.

The application has no built-in paid-use budget, quota, Redis requirement, or distributed concurrency gate. An explicit live submission or retry can incur provider charges. A successful capability response confirms configuration presence, not successful provider connectivity.

## Research execution and evidence

A research operation performs source discovery, reading of selected pages, and synthesis. Discovery requests permit up to three web-tool calls; reading permits up to six. Discovery and reading share a 65-second deadline. There is no automatic second research round or SDK retry. Further research requires another explicit user action.

The search model receives server-validated public categories and legal topics. Raw case narratives, names, uploaded text, disclosure notes, and unrestricted research plans are excluded from its input. Intake and synthesis use models without web-search tools and can receive case data when the user enables AI.

Cited passages are accepted only when they are associated with a candidate page opened during the reading stage. URL matching removes `utm_*` tracking parameters without broadly treating different URLs as equivalent. `pageOpened` records tool behavior; it does not prove complete reading, accuracy, or human review.

A failed or uncited search remains explicitly unavailable. Independently valid action cards can survive removal of an invalid card; a failure affecting the result as a whole still follows the rule-reference fallback. The result records execution mode, stage timings, model and token usage, and failure details without logging the raw case narrative.

Treaty applicability, domestic legal effect, mechanism eligibility, and case-specific conditions are separate checks. Unknown conditions do not become satisfied by default. Sources labeled `agent_checked` are not promoted to `team_verified` by automated validation.

## Pages and routes

| Route | Purpose |
| --- | --- |
| `/` | Project introduction and fictional examples |
| `/new` | PDF intake or manual case entry |
| `/new?entry=manual` | Direct manual entry, independent of uploads |
| `/review` | Review case facts, goals, disclosure choices, and preferences |
| `/analysis` | Legal questions, action references, sources, What's Next, and downloads |
| `/history` | Reports explicitly saved in the current browser |
| `/cases` | Curated public historical case library |
| `/compare` | Compare two to four historical cases and export a brief |
| `/resources` | International resources and local legal rules |
| `/api/capabilities` | Public configuration and feature availability |

The UI supports Chinese and English. Historical quotations and archived research retain their original language and review status.

## PDF intake

Manual input works without a PDF. The PDF workflow supports one to three text-based PDFs, up to 3 MiB each, 3,900,000 bytes in total, and 30 physical pages per case. The multipart request limit is 4,000,000 bytes and the extracted-text limit is 75,000 UTF-8 bytes. Scanned-page OCR is not implemented.

Choosing files does not call AI. Processing requires a separate action and consent. Extracted facts retain their source document, physical page, and original quotation. The review workflow keeps contradictions and uncertain dates visible. Demo mode can expose locally extracted text without pretending that AI extraction occurred.

Original PDFs are not stored as an application server-side file collection. Saved reports retain the material index and cited excerpts needed for their snapshots rather than silently adding entire original files.

## Privacy, editing, and snapshots

Case data and results remain in memory by default. A user may explicitly save a report to this browser with a one-, seven-, or thirty-day retention choice. Refresh recovery is a separate opt-in using this tab's session storage, for at most 24 hours. Downloads have no application-enforced retention period after they leave the browser.

AI preferences do not erase case facts, goals, or disclosure restrictions. Editing working documents preserves user changes; changing a proposition requires its citations to be checked again. Reports use their generated-time source snapshots in the UI, history, and exports. New corpus data must not silently rewrite an old report.

The server does not keep a report-result cache, anonymous usage cookie, or cross-device case database. Request IDs and input versions help discard stale client responses; they do not guarantee cross-instance deduplication. OpenAI requests use `store: false`, which is not a statement about every upstream retention policy.

The application never automatically contacts organizations, publishes a case, or submits materials on a user's behalf.

## Validation

Run from the application directory:

```sh
npm run typecheck
npm test
npm run build
```

The unit-test configuration disables ambient live web search. Offline and mocked tests are not evidence of actual provider calls.

With a local demo server running, a targeted browser check can be run as follows:

```sh
TEST_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/openai-search.spec.ts
```

That browser check replays recorded fictional output and verifies the interface and downloads without making model requests. `npm run test:e2e` runs the broader suite; the [current release record](docs/current-release.md) documents six existing failures in the legacy journey suite and two skipped unit tests.

Free deployment checks explicitly use rule/manual modes:

```sh
node scripts/verify-live-deployment.mjs https://caselink-eight.vercel.app
```

The following command is a separate, explicit paid smoke test. It sends one fictional ordinary case through the real analysis API, reads no credentials itself, and never retries:

```sh
node scripts/verify-openai-search.mjs http://127.0.0.1:3000 --run-paid-smoke
```

It writes to `test-results/openai-search-20261010/`; preserve any earlier local results before reusing that location. Always distinguish actual provider calls, recorded-output browser replay, and rule-mode verification when reporting results.

## Deployment

The repository contains one active application under `caselink/`. For a GitHub-backed Vercel import, set the project's **Root Directory** to `caselink` and use Node.js 24. The committed `vercel.json` specifies `npm ci` and `npm run build` with the Next.js framework.

The existing production site is [caselink-eight.vercel.app](https://caselink-eight.vercel.app). Creating this GitHub repository does not connect it to Vercel or change production deployment settings. Continue to make deployment an explicit action until an automatic deployment workflow is intentionally configured.

For an already linked and authenticated local checkout, the project's existing CLI workflow is:

```sh
npm exec --yes --package=vercel@62.7.0 -- vercel deploy --dry --json --scope hao-s-projects-2154e1c6
npm exec --yes --package=vercel@62.7.0 -- vercel deploy --prod --yes --scope hao-s-projects-2154e1c6
```

Inspect the dry-run upload list first. `.vercelignore` excludes private environment files, credentials, local research, documentation, generated PDFs, tests, scripts, and build artifacts. A deployment must be checked independently of Git push; changing environment variables also requires a new deployment before they affect the application.

## Data and source rights

The checked-in corpus contains 22 historical cases, 21 source documents, 187 evidence excerpts, 16 international resources, and six local rules. Follow-ups are separate records: planned actions, implemented actions, adverse results, release, dismissal, and domestic implementation must remain distinct.

Source status, temporal cutoffs, conflicts, and missing information are part of the data. The corpus is not a global-law database. A source being publicly accessible, machine-checked, or cited by a successful test does not establish redistribution rights or professional legal review.

No open-source license has been selected. The repository is private. Source reports, quotations, translations, and third-party content have rights separate from the application code.
