# EmuKey AI Assistant implementation plan

Goal: extend existing assistance with public product advice, approved Knowledge, vector recommendations and bounded context.

User refinement: resolve varied names, informal Vietnamese, missing accents, typos and descriptions by meaning. Production Gemini orchestration now first interprets the question into a validated intent/query/constraints/reference/required-fields contract, retrieves authorized candidates, then semantically selects only candidate IDs. Regex intent/name matching remains solely a conservative development fallback when the adapter has no understanding method. Partial-name resolution is a retrieval optimization; a miss continues through embedding search. The model cannot invent prices/IDs or weaken server filters. A failed interpretation is a provider error, not a claim that Catalog lacks the product.

Trusted conversation services own persistence and handoff. Inference receives authorized read models. PostgreSQL owns catalog/vector data; Redis holds guest sessions with TTL. Existing payment/license and Support permissions remain unchanged.

## Audit and constraints

- Root initially clean; nested EmuKey repository contains pre-existing user changes, including Knowledge, schema and frontend styles. Preserve them.
- Existing Gemini handles Knowledge only and receives no conversation history. Existing message writes lock status and deduplicate client IDs.
- Adopt installed @google/genai 2.20.0 and pg 8.23.0; no new dependencies or separate vector database.
- Public Knowledge follows existing Help Center policy: READY/current documents on published products; require published plan when scoped.
- Memory resolves references; current Catalog/retrieval determines facts and permissions.
- Return verified Catalog facts and exact verified Knowledge excerpts; fail closed on unsupported output.
- Do not reset databases, commit, push or deploy.

## Work packages

1. [x] Regression tests for intent, grounding, references, bounded context and refusal categories.
2. [x] Extend assistance ports/orchestration while retaining trusted persistence and citations.
3. [x] Catalog embedding adapter, pgvector search, hash-aware reindex CLI and structured constraints.
4. [x] Public assistant API with Redis TTL, ownership capability, locks, rate limits and privacy filtering.
5. [x] Authorized Knowledge/Catalog reads, read role and explicit non-destructive upgrade.
6. [x] Responsive chat, backend recommendation cards, citations, retry and explicit handoff.
7. [ ] Focused checks passed; broader frontend suite has unrelated existing failures (see verification below).

## Sources and environment

- https://ai.google.dev/gemini-api/docs/embeddings
- https://github.com/pgvector/pgvector
- https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html

APIs checked against installed declarations. Docker became available after the initial audit; isolated PostgreSQL/pgvector and Redis integration checks ran. No remote database reset or application-data migration was performed by this task.

## Verification and handoff (2026-11-15)

- Latest backend unit run: 47 files, 525 tests passed.
- Latest PostgreSQL/pgvector and public HTTP integration run: 16 passed, 1 opt-in real-embedding case skipped. Earlier opt-in real embedding run also passed; deterministic vector fixtures are not a model-relevance evaluation.
- Latest focused frontend run: 29 passed across assistant chat and assistance contracts.
- Real Gemini + current public Catalog semantic suite: all 7 passed, covering both screenshot questions, informal/no-accent text, misspelling, product purpose, provider/pricing and a nonexistent product. This small sample does not establish universal language accuracy.
- Rebuilt and restarted only the existing local Docker API. Four real HTTP requests returned 200/ANSWERED: the two screenshot questions, `clinic desk bn tien v`, and `cái phần mềm cho phòng khám đặt lịch bác sĩ có những bản nào?`. All selected current published family variants; prices/provider came from Catalog.
- Backend typecheck, lint and Docker TypeScript build passed. Frontend build and five mocked-browser layout/interaction checks passed earlier in the session. Root/nested diff whitespace checks and both workspace hygiene checks passed.
- Broader frontend tests/lint encountered existing payment/renewal/help/verification-screen failures outside this change. They are not reported as passing. No commit, push or production deployment was performed.

Semantic understanding and candidate selection validate provider JSON, reject unknown candidate IDs, retry temporary 408/429/500/502/503/504 errors up to twice with exponential backoff and jitter (malformed output once) within a shared 20-second stage deadline, and report provider failure separately from missing data. API embedding calls are capped at 10 seconds. Remaining limits: ambiguous language requires clarification, absent approved facts cannot be answered, and provider quota/outages remain possible. The 38-case opt-in understanding suite was interrupted after provider quota errors; only the completed 7-case catalog suite and four HTTP checks support the live behavior claims above.


Stability investigation: local API logs contained three upstream 503 responses at understanding, including one exhausted request; three subsequent HTTP probes answered in 4.5–15 seconds. Replaced the previous fixed 250ms single retry with approximately 1s/2s jittered backoff and at most three attempts. Grounded answering now shares the same bounded retry policy and disables nested SDK retries. Authentication/request errors are not retried. This improves transient recovery; it cannot guarantee provider availability.

Post-change verification: 527 backend unit tests passed; backend typecheck, scoped lint, Docker build and workspace hygiene passed. Three sequential real HTTP questions returned 200/ANSWERED in 14.8s, 8.9s and 5.4s. The first request encountered real 503 errors in understanding and catalog selection, recovered through backoff and completed. Local API health is healthy. This is a small live sample, not an availability guarantee.
