# Phase 7 Assistance and Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace Phase 7 mock Assistance/Support surfaces with a complete backend-owned Conversation, Knowledge/RAG, AI advisory, Notification and Operations flow.

**Architecture:** Extend the existing `assistance-support` and `operations` modules around the already-versioned PostgreSQL tables. Conversation and message writes are transactional and idempotent on `(conversation_id, client_message_id)`; support claiming is a row-locked state transition. Knowledge retrieval is provider-scoped and source-based; AI may answer only from retrieved sources and must return refusal metadata when grounding is insufficient. Notifications are durable outbox-like rows created in the same business transaction, then delivered asynchronously through existing email/push ports without rolling back business state. HTTP polling is the first realtime boundary; socket emission can be added after commit without moving authority into the client.

**Tech Stack:** NestJS 12, TypeScript 6, PostgreSQL `pg` with explicit SQL, Redis/BullMQ where already configured, React 19 + TanStack Query + Ant Design, Expo React Native, Vitest/Jest, OpenAPI generated clients.

**Spec:** `APP_IMPLEMENTATION_PLAN.md` Phase 7 section and `chuc_nang_toan_he_thong_ver2.0.md` sections 8.4, 9.10-9.12.

## Global Constraints

- PostgreSQL remains authoritative; Redis is only cache, rate-limit, queue, lock or pub/sub infrastructure.
- Every Customer/Support message append accepts a stable client UUID and is idempotent; retry must return the original message and server sequence.
- AI responses are advisory, read-only, source-grounded and must refuse when evidence is insufficient.
- Support may only access conversations that are claimed by that Support actor; Customer may only access owned conversations.
- Provider knowledge and operations views are provider-scoped; no cross-provider data leakage.
- Notification delivery failure never rolls back the business transaction; delivery retries and dead-letter state are durable.
- No plaintext activation keys, passwords, private keys, action tokens or sensitive PII in logs/audit metadata.
- Reuse the current tables, ports, guards, audit writer and generated OpenAPI workflow; do not create duplicate shared abstractions.

---

### Task 1: Conversation and Message Domain Contract

**Files:**
- Create: `backend/src/modules/assistance-support/assistance-support.dto.ts`
- Create: `backend/src/modules/assistance-support/assistance-support.types.ts`
- Create: `backend/test/unit/assistance-support.service.test.ts`
- Modify: `backend/src/modules/assistance-support/assistance-support.module.ts`

**Interfaces:**
- Produces validated DTOs for conversation creation, message append, support claim, close and AI question.
- Produces domain unions for conversation status, sender type and grounded AI response.

- [ ] Define `ConversationStatus = AI_ACTIVE | WAITING_SUPPORT | SUPPORT_ACTIVE | CLOSED`, `ContextType = GENERAL | PRODUCT | PLAN | ORDER | LICENSE`, and sender types matching SQL constraints.
- [ ] Define request DTOs with UUID validation, content limits, context allowlist and `clientMessageId` required for Customer/Support append.
- [ ] Define response DTOs that expose message IDs, server sequence, source references and refusal state but exclude internal storage keys and unrelated PII.
- [ ] Write failing unit tests for invalid context, oversized content, missing client UUID and unsupported AI source state.
- [ ] Run `corepack pnpm exec vitest run test/unit/assistance-support.service.test.ts`; verify the new tests fail for missing service/contract.

### Task 2: Conversation Repository and Idempotent Message Append

**Files:**
- Create: `backend/src/modules/assistance-support/infrastructure/assistance-support.repository.ts`
- Modify: `backend/src/modules/assistance-support/assistance-support.types.ts`
- Test: `backend/test/unit/assistance-support.repository.test.ts`
- Test: `backend/test/integration/database/baseline-schema.integration.test.ts`

**Interfaces:**
- `createConversation(customerUserId, input): Promise<ConversationRecord>`
- `findConversationForCustomer(customerUserId, conversationId): Promise<ConversationRecord | null>`
- `listSupportQueue(): Promise<ConversationRecord[]>`
- `claimConversation(supportUserId, conversationId): Promise<ConversationRecord>`
- `appendMessage(input): Promise<MessageRecord>`
- `closeConversation(actor, conversationId): Promise<ConversationRecord>`

- [ ] Implement all queries with parameters and explicit ownership predicates.
- [ ] In one transaction, lock the conversation, return the existing message on duplicate `(conversation_id, client_message_id)`, otherwise allocate `MAX(server_sequence)+1`, insert the message, update conversation timestamps/status and return the inserted row.
- [ ] Enforce Customer ownership and Support assignment in SQL predicates, not only controller checks.
- [ ] Add tests for duplicate retry returning the same message/sequence, concurrent appends producing unique ordered sequences, cross-customer denial and unclaimed Support denial.
- [ ] Run focused unit/integration tests and verify the schema's existing unique constraints enforce the race safely.

### Task 3: Conversation Application Service and HTTP API

**Files:**
- Create: `backend/src/modules/assistance-support/assistance-support.service.ts`
- Create: `backend/src/modules/assistance-support/assistance-support.controller.ts`
- Modify: `backend/src/modules/assistance-support/assistance-support.module.ts`
- Create: `backend/test/unit/assistance-support.service.test.ts`
- Create: `backend/test/unit/assistance-support.controller.test.ts`

**Interfaces:**
- `POST /conversations`
- `GET /conversations`
- `GET /conversations/:conversationId`
- `POST /conversations/:conversationId/messages`
- `POST /conversations/:conversationId/claim`
- `POST /conversations/:conversationId/close`

- [ ] Add AuthGuard/RolesGuard boundaries: Customer owns customer routes; Support Staff owns queue/claim/reply; System Admin may inspect but not impersonate Customer ownership.
- [ ] Map repository errors to stable 400/403/404/409 responses and never reveal another user's conversation existence.
- [ ] Publish a post-commit notification intent for support waiting and new assigned replies without making transport part of the DB transaction.
- [ ] Add API tests for authorization, idempotent append, claim race and closed-conversation rejection.
- [ ] Export controllers/provider from the module and register them through `app.module.ts` if required by current module wiring.

### Task 4: Knowledge Documents and Provider-Scoped Retrieval

**Files:**
- Create: `backend/src/modules/assistance-support/infrastructure/knowledge.repository.ts`
- Create: `backend/src/modules/assistance-support/application/knowledge.service.ts`
- Create: `backend/src/modules/assistance-support/presentation/knowledge.controller.ts`
- Create: `backend/src/modules/assistance-support/knowledge.dto.ts`
- Create: `backend/test/unit/knowledge.service.test.ts`
- Create: `backend/test/integration/database/knowledge.integration.test.ts`

**Interfaces:**
- `POST /knowledge/documents` for Provider Admin metadata/FAQ ingestion.
- `GET /knowledge/documents` provider-scoped list.
- `POST /knowledge/documents/:id/publish` atomically promotes one current version.
- `POST /knowledge/query` returns source snippets only from the caller's allowed provider/product scope.

- [ ] Reuse `knowledge_documents` and `knowledge_chunks`; store only private metadata and chunks, never public storage URLs or customer PII.
- [ ] Validate `sourceType`, document version, chunk indexes, token limits, embedding dimension and provider/product ownership.
- [ ] Implement deterministic lexical retrieval first; keep the embedding column/configuration-gated so local fake adapter remains usable.
- [ ] Add tests for provider isolation, current-version uniqueness, unpublished document exclusion, empty result and source metadata redaction.
- [ ] Add audit events for document create/publish/archive without content dumps.

### Task 5: Grounded AI Advisory and Refusal Path

**Files:**
- Create: `backend/src/modules/assistance-support/application/ai-assistance.service.ts`
- Modify: `backend/src/modules/assistance-support/application/ports/ai-gateway.port.ts`
- Modify: `backend/src/modules/assistance-support/infrastructure/fake-ai.gateway.ts`
- Modify: `backend/src/modules/assistance-support/assistance-support.service.ts`
- Create: `backend/test/unit/ai-assistance.service.test.ts`

**Interfaces:**
- `POST /conversations/:conversationId/ai-ask`
- `AiGatewayPort.answerGrounded({ question, sources }): Promise<{ answer, citedSourceIds, grounded }>` remains the adapter boundary.

- [ ] Retrieve provider-scoped sources before invoking AI; do not pass unrelated conversation/customer data.
- [ ] Require every cited source ID to exist in the retrieved source set; reject malformed adapter output.
- [ ] Persist AI response as one idempotent `AI` message keyed by stable `eventId`/job ID; retries cannot create a second server sequence.
- [ ] Return explicit refusal when no adequate source exists, with `grounded=false`, empty citations and safe user-facing copy.
- [ ] Add tests for grounded answer, missing evidence refusal, invalid citation, adapter failure and retry idempotency.

### Task 6: Durable Notification Application and Delivery Worker

**Files:**
- Create: `backend/src/modules/operations/application/notification.service.ts`
- Create: `backend/src/modules/operations/infrastructure/notification.repository.ts`
- Create: `backend/src/modules/operations/presentation/notification.controller.ts`
- Create: `backend/src/modules/operations/worker/notification.processor.ts`
- Modify: `backend/src/modules/operations/operations.module.ts`
- Create: `backend/test/unit/notification.service.test.ts`
- Create: `backend/test/unit/notification.processor.test.ts`

**Interfaces:**
- `POST /notifications/:notificationId/read`
- `GET /notifications`
- `NotificationService.enqueueInTransaction(client, input)` for business owners.
- Existing `EMAIL_DELIVERY` and `PUSH_DELIVERY` ports remain the only external delivery boundaries.

- [ ] Insert notification rows with unique `(userId,eventKey,channel)` and return the existing row for duplicate event delivery.
- [ ] Implement in-app read mutation with ownership predicate and durable `read_at`/`is_read` stamps.
- [ ] Implement delivery claim/retry/backoff/dead-letter transitions using PostgreSQL row locks; external adapter failure must not throw into the originating business transaction.
- [ ] Register BullMQ/worker processing using the repository's current worker bootstrap patterns, or a polling processor if BullMQ is not currently wired for this module.
- [ ] Add tests for duplicate enqueue, recipient isolation, retryable failure, dead-letter and fake push/email success.

### Task 7: Business Event Notification Integration

**Files:**
- Modify: `backend/src/modules/commerce-payment/application/commerce.service.ts`
- Modify: `backend/src/modules/licensing/licensing.service.ts`
- Modify: `backend/src/modules/blockchain/application/blockchain-reconciliation.service.ts`
- Modify: `backend/src/modules/operations/application/notification.service.ts`
- Create: `backend/test/unit/phase7-business-notifications.test.ts`

- [ ] Add durable notifications for payment accepted, license finality, key rotation/recovery, device revoke and support assignment using stable event keys.
- [ ] Keep notification insertion inside the relevant PostgreSQL transaction where the business state is written; delivery occurs after commit.
- [ ] Ensure notification failures do not mutate or rollback order/license/command state.
- [ ] Add tests for duplicate domain event replay and recipient/channel isolation.

### Task 8: Web and Mobile Backend-Owned Surfaces

**Files:**
- Create: `frontend/src/application/assistance/assistanceQueries.ts`
- Modify: `frontend/src/presentation/screens/BuyerAssistanceScreen.tsx`
- Modify: `frontend/src/presentation/screens/SupportConsoleScreen.tsx`
- Modify: `frontend/src/presentation/screens/AiKnowledgeScreen.tsx`
- Modify: `mobile/src/infrastructure/api/client.ts`
- Modify: `mobile/src/presentation/EmuKeyMobileApp.tsx`
- Create/update: frontend and mobile unit tests for Assistance/Notification surfaces.

- [ ] Replace `mockWorkspace` reads and local-only append/claim state with TanStack Query/API mutations.
- [ ] Preserve loading, empty, conflict, retry and closed-conversation states.
- [ ] Generate OpenAPI artifacts through `node scripts/generate-openapi.mjs`; do not edit generated types manually.
- [ ] Add mobile notification registration/read and conversation summary using existing SecureStore/session boundaries.
- [ ] Keep AI answers visibly advisory and show source/refusal state.

### Task 9: Realtime After-Commit Boundary and Operations Dashboard

**Files:**
- Modify: `backend/src/modules/assistance-support/assistance-support.service.ts`
- Modify: `backend/src/modules/operations/operations.module.ts`
- Create/modify: existing operations health controller/service owner discovered during Task 1.
- Modify: frontend Support/Operations screens.
- Create: `backend/test/unit/phase7-realtime-boundary.test.ts`

- [ ] Emit conversation/notification events only after the transaction commits; polling remains a functional fallback.
- [ ] Add aggregate-only Provider dashboard metrics and System/Support health views without exposing cross-tenant conversation content.
- [ ] Prove an event is not emitted when the transaction rolls back.
- [ ] Add health counters for queued/retryable/dead-letter notifications and waiting/support-active conversations.

### Task 10: Full Phase 7 Verification and Evidence

**Files:**
- Modify: `backend/test/integration/database/baseline-schema.integration.test.ts`
- Create: `backend/test/integration/assistance/phase7-assistance.integration.test.ts`
- Create: `backend/test/integration/operations/phase7-notification.integration.test.ts`
- Modify: `frontend/test/buyer-assistance.test.tsx`
- Modify: `frontend/test/internal-consoles.test.tsx`
- Modify: `mobile/test/unit/license-screens.test.tsx` or the current Assistance owner discovered in Task 1.
- Modify: `docs/traceability/capabilities-v4.1.json` only if existing capability rows require owner/evidence updates.

- [ ] Run focused backend tests, all backend unit tests, frontend/mobile tests, lint, typecheck and builds.
- [ ] Run OpenAPI generation/check and `git diff --check`.
- [ ] Run disposable PostgreSQL schema/integration tests with Testcontainers.
- [ ] Run workspace hygiene baseline/check and inspect all changed files for secrets, generated output and unrelated formatting.
- [ ] Record remaining external adapter limitations explicitly: Gemini credentials/model configuration, object storage, Brevo/FCM production and browser/device E2E runtime.
