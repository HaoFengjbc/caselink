# CaseLink

Evidence-based research and practical preparation for cases involving journalism, public expression, and related legal proceedings.

CaseLink connects case facts with documented historical actions, relevant legal provisions, and specific preparation tasks. It supports criminal and civil matters while keeping jurisdiction, procedural stage, source quality, and disclosure preferences explicit.

[Live application](https://caselink-eight.vercel.app/new) · [Developer guide](caselink/README.md) · [Documentation](caselink/docs/README.md) · [Release status](caselink/docs/current-release.md)

## What it does

- **Case intake:** describe a case manually or review facts extracted from text-based PDFs. Manual entry works independently of uploads.
- **Case-specific issues:** connect the important legal questions to facts, evidence, applicable provisions, and unresolved conditions.
- **Historical research:** inspect 22 curated public cases, 21 source documents, and 187 evidence excerpts, with separately recorded follow-up actions and outcomes.
- **Optional live research:** use OpenAI web search to discover public sources, open candidate pages, and retain cited material. Existing OpenAI configuration is sufficient; Brave Search is not required.
- **What's Next:** prepare three priority tasks, conditional paths, missing-material questions, and reasons to pause a path.
- **Working documents:** preview, edit, and download a case timeline and material index, an issue–evidence–law matrix, and an internal brief for local counsel.
- **Report history:** explicitly save reports in the current browser, preserve their original source snapshots, and export or delete them.
- **Bilingual interface:** Chinese and English UI, with original-language evidence preserved.

## Run locally

Use Node.js 24 and npm. The application lives in the `caselink/` subdirectory.

```sh
git clone https://github.com/HaoFengjbc/caselink.git
cd caselink/caselink
npm ci
cp .env.example .env.local
ANALYSIS_MODE=demo npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Demo and rule modes do not make paid model or web-search calls. See the [developer guide](caselink/README.md) for live configuration, testing, and deployment.

## Repository layout

| Path | Purpose |
| --- | --- |
| `caselink/src/app/` | Next.js pages and server API routes |
| `caselink/src/components/` | Intake, source review, research, reports, and document editing |
| `caselink/src/lib/` | Contracts, AI orchestration, retrieval, citation checks, legal conditions, and snapshots |
| `caselink/data/` | Curated cases, evidence, legal resources, and historical follow-ups |
| `caselink/tests/` | Unit tests, browser checks, and synthetic fixtures |
| `caselink/scripts/` | Data validation, import utilities, and release verification |
| `caselink/docs/` | English navigation and release overview, plus original audit and verification records |

## Evidence and privacy

CaseLink distinguishes a planned action from an implemented one, release from dismissal of charges, an international opinion from domestic enforcement, and machine checks from team verification. Missing treaty, local-law, or mechanism-eligibility conditions remain unknown rather than becoming assumed facts.

Case information and reports remain in memory by default. Browser persistence and refresh recovery require explicit choices. Selecting a PDF does not call AI; processing requires a separate action and consent. The application does not automatically contact organizations, publish case information, or submit materials.

Search receives validated public categories and legal topics, rather than the raw case narrative or uploaded text. When AI is enabled, the intake and synthesis models can receive the case data needed for those tasks. Opening a source page does not establish factual accuracy or human legal review.

## Current baseline

The initial GitHub publication uses the consolidated application baseline `2b4ff90`, followed by English repository documentation. All 20 local branch tips were ancestors of that baseline. Their merged history is retained on `main`; obsolete branch names are not needed to use the latest application.

The latest recorded application release reports 586 passing unit tests, two skipped tests, successful type checking and production build, 28 passing targeted local browser checks, and 13 passing production rule-mode browser checks. Six legacy `journey.spec.ts` failures remain documented. These are recorded release results, not a claim that every test was rerun during repository publication. See [release status and remaining gaps](caselink/docs/current-release.md).

Repository descriptions and current developer documentation are in English. Original source quotations, historical reports, screenshots, and recorded model outputs retain their original language to preserve provenance.

## Project status and rights

CaseLink is an independent research prototype. It does not claim official TrialWatch endorsement and does not replace advice from qualified local counsel. The repository is public for project evaluation. No open-source license has been selected; source reports, excerpts, translations, and third-party materials retain their separate rights.
