# Documentation

Use the English guides below for the current application. Dated directories contain original development and verification records; their statements describe the version tested at that time.

| Guide | Contents |
| --- | --- |
| [Project overview](../../README.md) | Features, repository layout, evidence boundaries, and privacy |
| [Developer guide](../README.md) | Local setup, AI configuration, routes, verification, and deployment |
| [Current release](current-release.md) | Consolidated baseline, recorded test results, real AI evidence, and remaining gaps |

## Original evidence and release records

These records are retained in their original language and format. They may include Chinese prose, synthetic case inputs, recorded AI outputs, source excerpts, screenshots, and generated working documents. They are historical evidence rather than current setup instructions. A successful test does not upgrade a source to human legal verification.

| Record | What it documents |
| --- | --- |
| [Final branch consolidation](merge-all-2026-10-10/release.md) | Latest application release, branch ancestry, test counts, and the local-law notice correction |
| [Partial-action handling and source matching](partial-actions-2026-10-10/release.md) | Keeping valid action cards, matching URLs with tracking parameters, and two real synthetic AI analyses |
| [Local-law fixes](local-law-fixes-2026-10-10/release.md) | Jurisdiction eligibility, legal-topic queries, and explicit coverage limits |
| [Case-specific legal questions](case-issues-2026-10-10/release.md) | Issues connected to facts, law, and proposed work |
| [OpenAI search restoration](openai-search-2026-10-10/production-release.md) | Actual search, source reading, synthesis, report snapshots, and downloaded documents |
| [What's Next delivery](whats-next-2026-10-09/DELIVERY.md) | Incremental historical research and case-filled working documents |
| [Source integration](source-integration-2026-10-09/delivery.md) | Curated legal sources, follow-ups, provenance, and integration checks |
| [PDF intake](pdf-intake-2026-10-09/acceptance.md) | Consent, text extraction, review, privacy, and verification boundaries |

## Reading the evidence

1. Check the date, commit, deployment, and prompt version attached to a record.
2. Distinguish offline or mocked tests, rule-mode browser checks, and actual provider calls.
3. Read a historical action together with its execution status, outcome, source, and cutoff date.
4. Treat `agent_checked`, page access, and automated citation validation as distinct from `team_verified`.
5. Use each report's saved snapshot. Do not replace old conclusions or quotations with today's corpus.

Current product data is maintained in `../data/`, not reconstructed from these reports. Private environment files, local credentials, dependency folders, build caches, and uncommitted drafts from other worktrees are not part of the GitHub publication.
