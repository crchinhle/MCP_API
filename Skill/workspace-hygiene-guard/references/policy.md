# Workspace hygiene policy

## Preserve first

- Treat all pre-existing tracked and untracked changes as user-owned.
- Never use destructive reset/checkout/clean commands to obtain a clean tree.
- Never delete or overwrite an uncertain target.
- Restrict edits and formatting to the requested scope.

## Reuse before create

Search by filename, exported symbol, route, table/entity, UI label, event, queue, and domain synonym. Prefer extending the existing owner. Do not create parallel `common`, `shared`, `utils`, `helpers`, `types`, or `services` folders when an established location exists.

Do not create:

- `*-copy*`, `*_backup*`, `*.bak`, `*.orig`, `*.rej`, editor swap files, or “final/final2” variants;
- an alternate implementation named `new`, `v2`, `refactored`, or `fixed` instead of replacing or migrating the real owner;
- duplicate DTO/type definitions where a public contract already exists;
- a second API client, auth store, query-key system, logger, config loader, database connection, or design-system wrapper without an explicit migration plan;
- generated output such as `dist`, `build`, `coverage`, screenshots, traces, or local databases in source directories.

## Temporary and generated artifacts

Use `mktemp -d` or the operating system temporary directory. Keep previews, downloaded docs, ad-hoc scripts, test traces, and debug captures there. If a tool must output inside the repository, use the existing ignored directory and remove only artifacts created by the current task.

## Dependencies and lockfiles

Use an existing dependency when it satisfies the need. Before adding a production dependency, verify maintenance, license, bundle/runtime impact, security posture, and overlap with installed packages. Use the existing package manager and update the lockfile only through that package manager. Reject unrelated lockfile churn.

## Secrets and sensitive data

Never commit real `.env` files, API keys, certificates, private keys, tokens, database dumps, uploaded contracts, or customer data. Provide redacted examples in the repository's established example-env mechanism.

## Completion gate

A change is ready only when the diff is scoped, no unexpected untracked files exist, no new high-confidence content duplicates exist, generated artifacts are absent or ignored, tests/checks are reported truthfully, and intentional new files each have a clear owner.
