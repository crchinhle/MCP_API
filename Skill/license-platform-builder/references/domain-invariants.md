# Domain invariants

Apply these rules unless a newer approved requirement or the existing implementation explicitly supersedes them.

## Identity and provider onboarding

- Customers and providers may self-register.
- A provider must complete the required enterprise profile before receiving permission to publish products or upload license keys.
- Enforce the profile-completeness gate in the backend. The UI may explain the missing fields but is not the authority.
- System administrators and support staff use assigned internal roles; do not expose self-registration for privileged internal roles.

## Catalog, order, and pricing

- There is no shopping cart in the MVP.
- A customer selects one product/package and a device quantity of at least one.
- Calculate quantity-based discounts on the server from versioned pricing rules. Never accept a client-calculated total as authoritative.
- The system confirms the order automatically; the provider does not manually approve it.
- Keep order and contract records distinct because they represent different lifecycle states and audit evidence.

## Contract and signature

- The provider uploads an internal electronic-signature asset to its account. It is not a public PKI certificate or a legally verified public digital signature.
- Snapshot the provider signature asset version used when generating a contract. A later upload creates a new version; historical contracts continue referencing the exact earlier asset version.
- The provider signature is inserted automatically. Only the buyer performs the contract-signing action in the MVP.
- Store the buyer's cryptographic signing evidence, account, contract digest, timestamp, and audit context. Do not claim verification of two public cryptographic signatures.
- Primary sequence: confirm order, review/sign contract, pay, then view completed order and provisioned licenses.

## License lifecycle and mobile

- Provision licenses/keys only after confirmed payment, using idempotent processing.
- Renewal is manual. Do not implement “cancel at end of cycle” for the MVP.
- Merge duplicate “expiring soon” notifications into one rule and delivery pipeline.
- The manager mobile app authenticates with the same account credentials as the web app and downloads/manages the account's licenses; it does not claim a key with an activation code.
- The separate license-client demo has one purpose: enter a key and verify/activate it for demonstration. Do not merge this flow into the manager app.
- Treat teacher, student, individual, and organization labels as the same customer/user role unless a later requirement introduces a real permission difference.

## Support chat

- Support cases enter a shared queue. Staff self-accept work; there is no mandatory dispatcher assignment.
- A case remains owned only while actively handled. If the staff member leaves without marking it complete, return it to the queue so another staff member can accept it.
- Make claim/release/complete transitions atomic and auditable.
