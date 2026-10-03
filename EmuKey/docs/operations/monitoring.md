# Monitoring and Alert Policy

EmuKey uses structured Pino logs and optional OpenTelemetry auto-instrumentation.
Every API error response carries a correlation `traceId`; application logs must carry
the same value together with the relevant order, payment attempt, chain command,
transaction hash, chain event, notification, or conversation identifier when the
application already has that identifier. Values that are credentials, bearer tokens,
activation secrets, raw messages, or PII are redacted.

## Required signals

| Signal | Source | Alert condition | Operator action |
|---|---|---|---|
| API error rate | HTTP logs/OTEL | 5xx > 2% for 5 minutes | inspect trace IDs, dependency health, rollback if deployment-correlated |
| API latency | HTTP logs/OTEL | p95 over 1s for 10 minutes | inspect DB pool and Redis latency |
| PostgreSQL readiness | `/api/v1/health/ready` | dependency down for 2 minutes | fail traffic over or restore DB connectivity |
| Redis readiness | `/api/v1/health/ready` | dependency down for 2 minutes | restart/replace Redis; durable state remains PostgreSQL authority |
| Worker lag | BullMQ/worker logs | queue age over 5 minutes | inspect worker and Redis, do not edit business rows manually |
| Chain backlog | chain command projection | actionable command age over configured SLA | run reconcile/recovery runbook |
| `SUBMITTED_UNKNOWN` | chain command projection | age over 10 minutes | same-raw receipt/reconcile only; never blind resend |
| RPC errors/429 | relayer/indexer logs | 3 consecutive failures or sustained 429 | validate provider and fallback chain ID, then throttle |
| Indexer lag | chain checkpoint | lag over 10 blocks or 10 minutes | inspect RPC and restart indexer |
| Reorg | chain event summary | any unexpected deep reorg | block entitlement/key use until canonical recovery |
| Payment IPN failure | payment audit/logs | signature, cutoff, or amount rejection spike | inspect provider evidence and payment recovery runbook |
| Notification dead letter | notification projection | any production dead letter | retry only through canonical worker/admin operation |
| Gemini/Cloudinary/FCM/Brevo failure | adapter logs | provider error budget exceeded | provider-specific retry/rotation procedure |

Optional providers are reported independently and do not make liveness false. Critical
PostgreSQL, Redis, and configured chain/contract readiness do gate readiness.
