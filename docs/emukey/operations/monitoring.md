# Monitoring and Alert Policy

EmuKey uses minimal structured Pino logs and optional OpenTelemetry instrumentation.
The user activity audit table, writer, API and UI have been removed. Business history
remains in order/payment records, license state, blockchain commands/events and
notification delivery state.

Successful requests, health polling and expected validation/authorization failures
do not produce automatic access logs. The API exception filter emits one
`http.request.failed` record for a 5xx response, with its response `traceId`, method,
route, status and machine-readable error code. Raw errors, request bodies, query
strings, credentials and vendor payloads are excluded. Existing redaction remains
enabled as an additional safeguard. Dependency/worker errors and short startup/CLI
messages remain available; user actions are not reintroduced as technical logs.

## Required signals

| Signal | Source | Alert condition | Operator action |
|---|---|---|---|
| API failures | `http.request.failed` logs | repeated unexpected 5xx | inspect trace IDs and dependency health |
| API latency (optional) | OTEL when enabled | p95 over 1s for 10 minutes | inspect DB pool and Redis latency |
| PostgreSQL readiness | `/api/v1/health/ready` | dependency down for 2 minutes | fail traffic over or restore DB connectivity |
| Redis readiness | `/api/v1/health/ready` | dependency down for 2 minutes | restart/replace Redis; durable state remains PostgreSQL authority |
| Worker lag | BullMQ/worker logs | queue age over 5 minutes | inspect worker and Redis, do not edit business rows manually |
| Chain backlog | chain command projection | actionable command age over configured SLA | run reconcile/recovery runbook |
| `SUBMITTED_UNKNOWN` | chain command projection | age over 10 minutes | same-raw receipt/reconcile only; never blind resend |
| RPC errors/429 | relayer/indexer logs | 3 consecutive failures or sustained 429 | validate provider and fallback chain ID, then throttle |
| Indexer lag | chain checkpoint | lag over 10 blocks or 10 minutes | inspect RPC and restart indexer |
| Reorg | chain event summary | any unexpected deep reorg | block entitlement/key use until canonical recovery |
| Payment IPN failure | payment transaction classification/review and technical error codes | repeated rejected callbacks or open payment reviews | inspect provider evidence and payment recovery runbook |
| Notification dead letter | notification projection | any production dead letter | retry only through canonical worker/admin operation |
| Gemini/Cloudinary/FCM/Brevo failure | adapter logs | provider error budget exceeded | provider-specific retry/rotation procedure |

Optional providers are reported independently and do not make liveness false. Critical
PostgreSQL, Redis, and configured chain/contract readiness do gate readiness.
