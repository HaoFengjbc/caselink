# TrialWatch research execution and usage controls

This iteration keeps the reviewed expression-case corpus as the primary evidence. International references retain their review status and applicability conditions. Public search is an optional, unverified supplement. No general-dispute experiment area is implemented. The implementation and tests below are reviewable code, not a claim that the production Redis, search service, or account spending limits have been configured.

## Request and scope protocol

Both paid routes accept an opaque `requestId`, positive integer `inputVersion`, `operation`, `input`, optional `locale` and separate `preferences`. Facts are hashed without preferences. A new input version or explicit supplement needs a new request ID; an unchanged retry uses the same ID/version. `/api/intake` only accepts `initial`. `/api/analyze` accepts `initial` or `supplement` plus `parentAnalysisId`.

```json
{"requestId":"fictional-request-001","inputVersion":1,"operation":"initial","locale":"en","input":"<complete NewCaseInput object>","preferences":{"aiEnabled":true,"saveMode":"memory","refreshRecovery":false,"expiresAt":null}}
```

The string in `input` above is a documentation placeholder, not an executable request. Use a real fictional `NewCaseInput` object when testing. The three expression scenarios under `data/demo` are the intended demonstration inputs.

- `assessDomain(input)` returns `in_scope`, `out_of_scope` or `needs_clarification`. Explicit `expression:no` is out of scope. `yes` confirms the user-described connection. Missing/unsure context requests clarification; a profession or keyword alone does not reject a case. Legacy classic records with explicit reporting/posting activities remain usable.
- The server applies this check before any reservation or paid provider call, including intake. Unknown or out-of-scope inputs cannot bypass it by calling the API directly. They can still use the explicit manual/rule path. General assistance text points to locally appropriate bar/legal-aid/adviser directories without inventing a universal agency or promising acceptance.
- `resolveJurisdiction(input)` uses the shared country-code catalog. `england_wales`, `northern_ireland` and `scotland` resolve to GB and distinct legal systems. A selected non-GB country wins over retained UK fields/answers. An unknown/new country does not inherit an earlier UK jurisdiction. Original case text is not mutated.
- A supplement verifies same-session parent metadata and the same case hash, increments `execution.round`, and performs one new round. The metadata expires after 24 hours. Historical or changed-input reports need a new initial request. No automatic second search happens after poor relevance or no sources.

## Search boundary and limits

`controlled-search.ts` is the only enabled production search transport. It uses the Brave Web Search REST API, literal server-built `q` strings, `spellcheck=false`, at most two sequential requests and three results per request. The adapter revalidates exact templates before sending. It does not send the private input, narrative, goals, names, model-written relationship, raw model queries, or rare fact combinations. Returned pages/snippets cannot initiate another search. The legacy OpenAI autonomous web-search transport is deliberately disabled.

Country and legal-system display labels, procedure, issue and remedy terms come from approved server labels. Model-suggested issue IDs/labels are accepted only on exact own-property/value match; prototype keys and arbitrary prose are rejected. The default path uses the recorded structured categories and **does not call an additional semantic planner**. A civil proceeding is not automatically classified as defamation. This sacrifices some long-tail specificity; adding a reviewed issue vocabulary and user-confirmed issue selection is preferable to sending private detail to search.

The API sends only approved literal queries; it cannot prove how an external search engine internally ranks results. `spellcheck=false` and query-echo checks enforce the documented request contract. Echo checks diagnose provider divergence after the fact and are **not** the privacy boundary. Exact server construction before network transmission is the boundary. The code records actual attempted queries, including a first successful request followed by a failed second request. A full provider timeout/cancellation may leave only stage/tool-call metadata; no claim is made that a remote request stopped instantly.

**Current reader limitation:** results are search snippets, not full pages. No URL is fetched from arbitrary search results. `pageOpened:false`, output instructions and result limitations explicitly state that full source pages were not read. Sources stay unreviewed; snippets are candidates for human checking, not independently verified judgments. There is no fabricated reading phase or progress event. A future controlled reader needs its own SSRF, size, redirect and provenance review.

No shared search cache is implemented in this iteration. No private synthesis report is shared between users. When search is disabled or fails, paid synthesis can use the corpus only, provided usage controls are available. Without paid configuration, users retain manual intake, local corpus and rule-reference paths.

Reference checked 2026-10-09: [Brave Web Search API, including spellcheck and query echo](https://api-dashboard.search.brave.com/api-reference/web/search/post). This is an API contract review; this iteration made zero real Brave requests.

## Distributed usage protection

All real OpenAI transports require an active reservation context. The two API routes acquire it through Redis REST and a single atomic Lua reservation. The Redis keys use one cluster hash slot. There is no process-local production counter, lock or result cache. The in-process context only carries the already-authorized request's execution meter.

Reservation covers anonymous session and platform-derived IP daily request counts, a global UTC-day financial ledger, global and per-session concurrency, and same-session request identity. The fingerprint binds input hash, version, operation, parent, locale and endpoint kind. The same ID with different content is rejected. Duplicate in-flight requests return `REQUEST_IN_PROGRESS` without calling a model. A completed result can be replayed for two minutes. After that result is removed, reusing the successful ID is rejected instead of silently charging again.

The anonymous cookie is HMAC-signed, HttpOnly and SameSite=Strict, expires after 24 hours, and contains no case text. `/api/capabilities` prepares it when configuration is present. A first paid request without it returns a cookie plus `REQUEST_IN_PROGRESS`, `retryAfterSeconds:0`, with zero model calls; the client repeats the same request identity. IP values are HMAC-digested before Redis. On Vercel, the implementation uses the platform's `x-vercel-forwarded-for`; a custom trusted header is accepted only with explicit configuration on another deployment. The proxy must overwrite it and block direct bypass. Never choose an arbitrary client-supplied header.

The Lua settlement atomically reconciles money, final request state, encrypted result, and parent metadata. Results use AES-256-GCM with session/request/fingerprint associated data and Redis TTL **120 seconds**. Reports can contain input-derived private text inside that temporary ciphertext. Raw `NewCaseInput` is not persisted. HMAC fingerprints and parent/round metadata expire after 24 hours, day counters after 48 hours, and concurrency leases after at most six minutes. These records are operational controls, not browser history or a team case database. Redis backup/log/replication retention must be separately reviewed; expiry is not a claim of erasure from provider backups.

Failed requests are not permanently cached. Corrected input uses a fresh ID/version. An unchanged failed ID can retry after applicable locks/limits; quota consumption and charged/unknown costs are not erased. A failed or cancelled provider with ambiguous execution retains its concurrency lease until expiry, to avoid treating an upstream timeout as proof the remote work stopped. Such errors expose the remaining lease duration through `retryAfterSeconds`; same-ID admission while that failed request still holds its own lease returns `REQUEST_IN_PROGRESS` with the remaining seconds, not a new model attempt. Late results cannot overwrite a different lease. Crashes retain the financial reservation and expire their concurrency lease.

Reference checked 2026-10-09: [Upstash Redis REST and scripting support](https://upstash.com/docs/redis/features/restapi), [Vercel trusted request headers](https://vercel.com/docs/headers/request-headers). No real Redis endpoint or deployed proxy header behavior was tested by Agent B.

## Cost envelope and observability

A normal full analysis or explicit supplement makes **one synthesis model call**, plus zero or at most two controlled search HTTP requests. Intake makes **one intake model call**. There is no paid planning/reading phase in this version and no SDK automatic retry (`maxRetries:0`). These counts describe code limits, not a performed live experiment.

Before execution, the ledger reserves the configured model's input upper bound (262,144 tokens) and its output cap (intake 4,000; analysis `AI_MAX_OUTPUT_TOKENS`, default 9,000/max 16,000), plus two configured per-search maximum charges when enabled. The text + instructions + output-schema serialization is capped at 131,072 UTF-8 bytes before a model call; the token allowance includes a conservative framing margin. Formula in USD:

`(262144 × inputPricePerMillion + outputCap × outputPricePerMillion) / 1,000,000 + searchCalls × searchMaxCostUsd`

No production price is hard-coded or assumed. Operators must configure reviewed, conservative rates for the requested model and any returned version alias. Model/rate changes require rechecking the cap and ledger settings. Unknown/missing actual usage or search invoice cost keeps the full reservation as charged. It is never released as zero. With known model token usage and a recognized actual model rate, the ledger charges that usage and releases the unused reservation. If an unexpected real charge exceeds the configured reservation, the ledger records the full amount; the pre-execution ceiling depends on correct upper-bound pricing configuration, so this is not a substitute for provider account limits.

`execution` records actual stage duration, actual returned model, response ID, input/output tokens, tool count, failure stage, operation, round, reserved amount and known actual amount. Null means unavailable. Costs derived from configured rates are not a provider invoice. Logs contain these operational values and an opaque request ID, not the narrative, prompt, queries or report. Browser-visible results include the permitted public query record separately. Platform log retention and access still require configuration. No progress stream is provided (`progressEvents:false`); clients must display generic processing, not simulated research phases.

## Required deployment configuration

| Setting | Meaning |
|---|---|
| Existing `ANALYSIS_MODE`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_INTAKE_MODEL` | Existing model integration; this iteration does not switch models. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Private HTTPS Redis REST endpoint/token with EVAL/GET/SET/hash/sorted-set permission. Do not use a read-only token. |
| `USAGE_SESSION_SECRET` | Independently generated secret, at least 32 characters, shared by instances. Rotation invalidates cookies/results. Never place in public env. |
| `AI_MODEL_RATES_JSON` | Object keyed by exact model identifiers, each with positive `inputPerMillion`, `outputPerMillion`, `checkedAt` (YYYY-MM-DD). Values are operator-reviewed upper bounds, not example defaults. |
| `AI_GLOBAL_DAILY_BUDGET_USD` | Required positive application daily cap; no implicit unlimited/default budget. |
| `AI_SESSION_DAILY_REQUESTS` / `AI_IP_DAILY_REQUESTS` | Defaults 10 / 30 accepted reservations per UTC day. |
| `AI_GLOBAL_CONCURRENCY` / `AI_SESSION_CONCURRENCY` | Defaults 3 / 1 active reservations. |
| `USAGE_TRUSTED_IP_HEADER` | Only for non-Vercel deployments, and only after the proxy overwrites the header. Vercel selects its platform header automatically. |
| `CONTROLLED_SEARCH_ENABLED` | Must be literal `true` to enable optional search; otherwise disabled. |
| `BRAVE_SEARCH_API_KEY` | Private provider key; no key was read/copied/tested by Agent B. |
| `BRAVE_SEARCH_MAX_COST_USD` | Positive maximum charge per search, required when enabled. Review against the actual subscription. |

`usageControlConfigured` and `controlledSearchConfigured` indicate config presence; they are not live connectivity or account-billing verification. `liveAvailable` also requires the usage configuration and rates for the selected intake and analysis models. Redis connection failures fail closed before paid calls. `WEB_SEARCH_DISABLED`, `USAGE_CONTROL_UNAVAILABLE`, `RATE_LIMITED`, `QUOTA_EXHAUSTED`, `CONCURRENCY_LIMIT`, `REQUEST_IN_PROGRESS`, `IDEMPOTENCY_CONFLICT`, `OUT_OF_SCOPE` and `SCOPE_CLARIFICATION_REQUIRED` provide explicit UI paths. The free rule/manual flags bypass paid configuration, not input validation.

OpenAI account spending alerts, provider hard limits, app ledger limits and available prepaid credit are separate controls. **Agent B did not inspect or modify account alert/hard-limit settings.** Production Redis, Brave subscription, rates, proxy behavior, secrets, retention and account controls remain deployment prerequisites, not completed configuration.

## Validation and handoff

Targeted regressions cover the three GB enums and country switches, scope states, public-query templates and actual mock HTTP payloads, prototype/free-prose rejection, one round and explicit supplement, snippet provenance, SDK schema serialization, refusal/timeout/cancellation, scopes before paid calls, no-config fail-closed with free fallback, quota/global reservation/concurrency, duplicate in-flight requests, session separation, altered fingerprints, encrypted TTL, unknown-cost cancellation, and retry after a lost settlement acknowledgement.

The Redis test uses an **atomic protocol simulator**, not a Redis server. Search and SDK requests use mocked HTTP, not live calls. Tests asserting old unrestricted disputes, autonomous search or automatic second rounds were replaced with desired-behavior regressions; citation and source-validation tests were retained. Two older fixture-dependent source tests remain skipped because their recorded provider files are absent; no claim is made that they passed. Production distributed locking, external query execution and a complete live paid flow are **integration pending**.

The lead should run: complete integrated tests, typecheck/build, browser rule/manual flows, then a shared external Redis test with at least two application instances. Only after reviewing config/rates and the stated budget should the lead perform the explicitly limited fictional-expression AI validation. Agents did not deploy production or perform paid calls.

Agent B validation receipt, 2026-10-09 (isolated branch before A/C integration): 7 targeted test files, 207 passed / 2 legacy recording-fixture tests skipped; TypeScript passed; Next production build passed (34 static pages). The broader pre-integration run had 5 remaining failures in A-owned expression fixtures and the legacy all-JSON-no-CJK assertion; these were reported to the lead for integrated correction, not marked passed. No deployed or paid integration test was performed.
