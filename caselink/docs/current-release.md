# Current release and verification status

Recorded on October 10, 2026. This English overview summarizes the consolidated application state used for the initial GitHub publication. Repository documentation changes do not redeploy the application.

## Version identity

| Item | Value |
| --- | --- |
| Application baseline | `2b4ff90` |
| Default branch | `main` |
| Schema version | `1.0` |
| Corpus version | `2026-10-09.v5` |
| Prompt version | `4.6` |
| Most recently recorded production deployment | `dpl_JCpuCmWc43BV48YajQJq2PXbUjrm` |
| Recorded rollback target | `dpl_6qAZfeNwnZ9xdKDG4dJnFtYk2LwF` |
| Application URL | <https://caselink-eight.vercel.app/new> |

The deployment identifiers come from the [consolidation release record](merge-all-2026-10-10/release.md). They are historical release identities; GitHub publication itself does not change the production alias.

## Included work

- Manual intake and consent-based PDF extraction, with source-linked fact review and date handling.
- Case-specific legal questions and action cards connected to evidence and legal provisions.
- Curated historical cases, separate follow-up records, legal eligibility checks, and report snapshots.
- What's Next priorities, conditional paths, editable case-filled documents, and downloads.
- OpenAI web search using the existing server-side API configuration.
- Source-page matching that ignores `utm_*` tracking parameters while retaining other URL distinctions.
- Validation that can remove an invalid action card and retain independently valid cards; failures affecting the whole result still trigger the existing fallback.
- A local-law notice that states when no local legal basis was found, without incorrectly claiming that all available evidence consists only of international standards.

## Branch consolidation

All 20 local branch tips were ancestors of `main` at publication preflight. No branch had a committed change outside `main`.

Four older PDF branches were recorded through merge `46a7019` with the `ours` strategy. Their changes already had patch-equivalent commits in `main`: a separate `git cherry` check against pre-merge `47c5646` found zero unique patches for each branch. The merge preserved the newer PDF review implementation instead of restoring superseded components.

Only `main` needs to be published. Its history contains the merged work. Uncommitted drafts and generated files in separate old worktrees are outside that history and remain local.

## Recorded verification

| Verification | Recorded result | Boundary |
| --- | --- | --- |
| Unit tests | 586 passed, 2 skipped | Offline tests; not proof of real provider availability |
| Type checking | Passed | Recorded for the application release |
| Production build | Passed | Recorded for the application release |
| Targeted local browser checks | 28 passed | Six separate legacy `journey.spec.ts` failures remain |
| Production rule-mode browser checks | 13 passed | No real AI calls in the final consolidation release |

These results are reported in the [final consolidation record](merge-all-2026-10-10/release.md). Documentation-only GitHub setup does not turn them into new test executions.

Earlier actual provider tests are retained separately. The [partial-action release](partial-actions-2026-10-10/release.md) records one real analysis for each of two fictional cases: a Philippine criminal matter and the English civil V-92 matter. Both returned live AI analyses. The Philippine search still produced no usable citations; the English result included local-law references and historical sources. The [OpenAI restoration record](openai-search-2026-10-10/production-release.md) separately records a real production request and four actual browser downloads. These are distinct runs and must not be counted as tests of every later release.

## Remaining gaps

- Philippine local-law coverage remains unfinished and was explicitly deferred. An empty retrieval result is not proof that no relevant law exists.
- A search tool can open a page without returning usable cited text. Such results are recorded as unavailable rather than promoted to verified sources.
- Six legacy browser tests still fail; the entire end-to-end suite is not green.
- Two unit tests depend on prior local evidence artifacts and remain skipped in the recorded run.
- Scanned PDFs require OCR, which this application does not implement.
- Legal and historical source coverage is limited. Machine checks do not constitute team legal review or establish treaty applicability, domestic effect, or mechanism eligibility.
- There is no application-level paid-use budget, quota, or distributed concurrency gate. Explicit live submissions can incur provider costs.

## GitHub publication checks

Before the first upload, 84 commits and 937 reachable file blobs were examined for common credential patterns. No OpenAI-key, GitHub-token, private-key, AWS-access-key, or long bearer-token pattern matched. No historical path matched the checked credential or private-environment locations. This is a bounded automated check, not an exhaustive security audit.

The upload preserves the existing application and merged Git history. The repository description, homepage README, developer guide, and this release overview are written in English. Original evidence and archived reports retain their original language. No application behavior, PDF processing, production environment, or deployment is changed by this publication.
