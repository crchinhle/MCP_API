# Mobile and external integrations

## Mobile manager

Use React Native with Expo and the same account identity/API as web. Store refresh credentials only in platform secure storage. Support license list/detail and device management defined by the API. Do not show activation-code claim UI in this app.

## License client demo

Use Kotlin, Jetpack Compose, and Android Keystore. Keep the surface intentionally small: accept a key, call verification/activation, store the resulting device credential securely, and display the result. Do not duplicate the manager app.

## Adapter contract

Wrap every external provider behind an application port. Define request/response mapping, timeout, retries, idempotency, webhook authenticity, audit fields, observability, and a local/test fake. Never let vendor DTOs become domain objects.

## Provider-specific rules

- Brevo: use one integration from local through production; local may send real mail to approved addresses. Keep sender/domain and API key in environment configuration, enforce rate limits, and use templates with stable identifiers.
- Cloudinary: store images and ordinary downloadable files when product limits and access controls fit. Store only asset identifiers, version, metadata, and controlled delivery URL in PostgreSQL. Use private/authenticated delivery for contracts or sensitive documents; evaluate object storage if document volume, retention, compliance, or cost outgrows Cloudinary.
- Google AI Studio/Gemini: keep the API key server-side, bound prompts and output, redact sensitive data, add timeout/fallback, and never make LLM output the authority for payment, permission, contract, or license decisions.
- SePay: verify callback authenticity as supported, store raw callback evidence safely, use an idempotency key, reconcile payment amount/reference, and transition order state transactionally.
- EVM: submit hashes/audit anchors, not confidential business data. Treat blockchain confirmation as asynchronous and retryable; store transaction hash and confirmation state in PostgreSQL.
