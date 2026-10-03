# SePay Sandbox Timestamp Support Report

## Environment

- Product: EmuKey
- Provider: SePay Sandbox (`pay-sandbox.sepay.vn`)
- Flow: real browser checkout and provider UI `Giả lập thanh toán`
- Callback: real SePay Sandbox IPN over the configured HTTPS tunnel
- Currency: VND

## Observed behavior

Five independent sandbox transactions were created through the browser. In every
run, SePay's `transaction.transaction_date` and top-level IPN `timestamp` represented
the same provider time, approximately 143 seconds before the local browser payment
click. The EmuKey backend clock, PostgreSQL clock, and API container clock were
synchronized.

The backend correctly uses `transaction.transaction_date` as payment occurrence,
parses it as Asia/Ho_Chi_Minh, and stores UTC in `provider_occurred_at`. It does not
use the callback delivery timestamp for payment-window validation.

## Runs

| Run | Provider event | Wait before click | Skew vs click | Result |
|---|---|---:|---:|---|
| 1 | `ed33c04f-b4e4-11f1-b21a-a6006ab65aca` | 0s | -143.198s | `UNMATCHED` |
| 2 | `0874d2e0-b4e5-11f1-b21a-a6006ab65aca` | 30s | -142.850s | `UNMATCHED` |
| 3 | `46e5a516-b4e5-11f1-b21a-a6006ab65aca` | 90s | -143.637s | `UNMATCHED` |
| 4 | `bc3d0392-b4e5-11f1-b21a-a6006ab65aca` | 180s | -143.513s | `MATCHED` |
| 5 | `c6d992bc-b4e5-11f1-b21a-a6006ab65aca` | 0s | -143.247s | `UNMATCHED` |

Statistics:

```text
min skew:    -143.637 seconds
max skew:    -142.850 seconds
median skew: -143.247 seconds
```

## Questions for SePay

1. Does `transaction.transaction_date` represent the actual provider payment time in Sandbox?
2. Is a roughly 143-second Sandbox clock offset known?
3. Is there a documented bounded clock-skew policy for Sandbox IPN validation?
4. Does production use the same timestamp source and clock behavior?
5. Is merchant Sandbox configuration affecting transaction timestamps?

No credentials, signatures, customer PII, activation keys, or payment secrets are
included in this report.
