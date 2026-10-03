# Credential Rotation Checklist

This checklist records the local release scan without copying any credential value.
Run `corepack pnpm --dir backend test:security:local`; the command reports only the
file and count of non-placeholder values.

| Provider/class | Env keys | Rotation required | Verification command |
|---|---|---:|---|
| PostgreSQL | `DATABASE_URL` | YES if local value is shared or reused | `pnpm --dir backend db:verify` |
| Redis | `REDIS_URL` | YES if authenticated/shared | `docker compose up -d redis` and readiness |
| JWT/session | `JWT_SECRET` | YES before staging/production | `pnpm --dir backend release:check` and old-token rejection test |
| SePay Sandbox | `SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY` | YES if copied outside sandbox | `pnpm --dir backend test:external:sepay` |
| Gemini | `GEMINI_API_KEY` | YES if provider key is shared | `pnpm --dir backend test:external:gemini` |
| Brevo | `BREVO_API_KEY` | YES if provider key is shared | `pnpm --dir backend test:external:brevo` |
| FCM | `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` | YES if service account is shared | `pnpm --dir backend test:external:fcm` |
| Cloudinary | `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | YES if provider key is shared | `pnpm --dir backend test:external:cloudinary` |
| EVM RPC | `EVM_RPC_HTTP_URL`, `EVM_RPC_FALLBACK_HTTP_URL` | YES if URL contains credentials | `pnpm --dir backend test:external:sepolia` |
| EVM relayer | `EVM_RELAYER_PRIVATE_KEY` | YES on any suspected exposure | `pnpm --dir backend test:external:sepolia` |
| Activation envelope | `ACTIVATION_ENVELOPE_KEY` | YES only through controlled key-version migration | envelope recovery tests and reconcile |

## Procedure

1. Create replacement credentials in the provider console or secret manager.
2. Inject into staging and run the verification command without printing values.
3. Deploy the immutable release, verify provider acceptance, then revoke old values.
4. Invalidate sessions or rotate the relayer/envelope key according to its owner.
5. Record only provider request IDs, key version, release ID, and timestamps.

The current local `.env` scan found real development/test values. Those values are
ignored by Git but still require rotation before any production claim. No automatic
revocation is performed by this repository tooling.
