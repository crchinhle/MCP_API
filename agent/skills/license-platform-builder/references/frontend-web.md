# React web implementation

## Boundaries

- Use React Router or the router already present for route composition and role guards.
- Use Ant Design for accessible, consistent UI primitives; wrap only when a stable product abstraction exists.
- Use TanStack Query for server state. Keep transient UI state local; do not mirror query data into a global store.
- Centralize the HTTP client, authentication refresh behavior, API error mapping, and query-key factories.

## Screen workflow

1. Find the existing route, layout, permission guard, list/detail pattern, form conventions, and query keys.
2. Extend an existing component when it has the same responsibility. Create a component only when it owns a distinct reusable behavior.
3. Model loading, empty, permission-denied, validation, server-error, retry, and success states.
4. Invalidate or update only affected query keys after mutation. Avoid broad “invalidate everything”.
5. Keep price, authorization, signature, payment, and license decisions on the server.

## Forms and security

Use typed schemas/DTO contracts when present. Normalize user-visible errors without exposing internal stack traces. Render uploaded content through safe URLs and content policies. Never place access tokens, secret keys, payment secrets, or private signing material in browser storage or source code.

## UI tests

Test user-observable behavior. Prefer queries by role/name over implementation selectors. Mock the network at the boundary for component tests; use real API/container dependencies only in integration or E2E suites.
