# Secret and Provider Governance

Secret values are injected by the deployment environment and are never committed,
printed, placed in Docker images, persisted in PostgreSQL, or included in release
evidence. Local `.env` files are ignored by Git and are treated as disposable
development material.

## Ownership and rotation

| Secret | Owner | Rotation trigger | Verification |
|---|---|---|---|
| SePay merchant ID/secret | Commerce/System Admin | provider change, suspected IPN exposure | sandbox callback signature and amount/cutoff test |
| Brevo API key | Operations/System Admin | provider rotation or delivery incident | provider accepted verification email |
| Gemini API key | Assistance/System Admin | provider rotation or suspected prompt/data incident | grounded answer regression |
| Cloudinary API secret | Operations/System Admin | storage incident or personnel change | private upload/retrieve/delete probe |
| FCM service-account key | Operations/System Admin | key expiry or device notification incident | provider authentication and device receipt |
| EVM RPC credentials | Blockchain/System Admin | provider rotation, sustained 429, incident | chain ID and contract bytecode probe |
| EVM relayer private key | Blockchain/System Admin | suspected compromise, operator rotation | replacement address funded and transaction smoke test |
| JWT/session secret | Identity/System Admin | suspected token exposure or planned rotation | old refresh/access tokens rejected |
| Activation envelope key | Blockchain/System Admin | suspected envelope exposure | rotate through a controlled key-version migration; never decrypt/reprint plaintext |

## Procedure

1. Create a replacement credential in the provider console or secret manager.
2. Add it to the staging environment only and run `release:check`, readiness, and the
   provider-specific smoke test.
3. Deploy the immutable release with the replacement value, then verify the old value
   is rejected or revoked by the provider.
4. Revoke the old value, invalidate sessions where applicable, and record only the
   provider request ID, key version, timestamp, and release ID in the audit trail.
5. Run `corepack pnpm --dir backend test:security:local` before a release. If the local
   `.env` scan reports `ROTATION_REQUIRED`, rotate every flagged provider
   credential before any staging or production claim. The scanner intentionally reports
   only the file and count, never the value.
