# Local development runbook

## Repository boundaries

`EmuKey` is one Git repository with three independently installable delivery units:

- `backend`: NestJS API and Worker from one codebase. The PostgreSQL schema and Solidity contracts belong here.
- `frontend`: React/Vite web application and its Caddy image.
- `mobile`: React Native/Expo Android customer application.

The removed Kotlin test client and the old Contract PDF/signing flow are not part of the v4.1 baseline. Mobile is built separately and is not a Docker Compose service.

## Prerequisites

- Docker Desktop with Docker Compose.
- Node.js `22.21.x` and Corepack.
- PostgreSQL and Redis may run locally or on managed services. The provided Compose files manage Redis; supply your PostgreSQL instance through `DATABASE_URL`.
- An ignored `backend/.env` created from `backend/.env.example`, with a valid `DATABASE_URL` and the remaining backend settings.

Each delivery unit owns its package manifest, lockfile, lint configuration, build and container contract. Install dependencies from the unit directory:

```powershell
Set-Location backend
corepack pnpm install --frozen-lockfile
```

Repeat from `frontend` or `mobile` when working on that unit. Do not recreate a root pnpm workspace.

To run the API directly with Node while keeping only Redis in Docker:

```powershell
Set-Location backend
docker compose up -d redis
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm start:api
```

The backend Compose file publishes Redis only on `127.0.0.1:${REDIS_PORT:-6379}`
for this workflow. PostgreSQL uses the configured local or managed `DATABASE_URL` from
`backend/.env`; no local PostgreSQL service is started.

## Start the local platform

From the `EmuKey` directory:

```powershell
docker compose --env-file .env.example up --build --wait
```

The default Compose graph starts Redis, API, Worker and Web. API and Worker load their database connection from `backend/.env`; Compose does not start a PostgreSQL server. The root `.env.example` only controls the host ports published for Redis, API and Web.

- Web: <http://localhost:5173>
- API liveness: <http://localhost:3000/api/v1/health/live>
- API readiness: <http://localhost:3000/api/v1/health/ready>
- Swagger UI: <http://localhost:3000/api/docs>
- OpenAPI JSON: <http://localhost:3000/api/v1/openapi.json>

Stop without deleting durable local volumes:

```powershell
docker compose --env-file .env.example down
```

Removing `redis-data` is an explicit destructive clean-room operation and is not part of the normal stop command. PostgreSQL data is external and is never removed by Compose.

## Database and configuration

Never commit a real `.env`. The checked-in examples contain placeholders. Production must provide credentials and keys through its secret manager. Both the root and backend Compose files load the real database connection from the ignored `backend/.env`; `REDIS_URL` is overridden inside containers so they can reach the Compose Redis service.

Database initialization is not part of normal `docker compose up`. The only SQL
source, `backend/database/schema.sql`, declares the final 18-table structure.
It has no historical migration modes. **Its default is destructive:** drop schema
`public` with `CASCADE`, recreate it and build the current structure. Dependent
objects can also be removed, including dependencies in other schemas. This resets
the application schema within the selected database; it does not drop the database
or its roles. Stop the API/worker and confirm the database and recovery backup
before explicitly running initialization.

From `backend`, build the CLI and initialize only when a reset is intended:

```powershell
corepack pnpm build
corepack pnpm db:initialize
corepack pnpm db:verify
```

`db:reset` is a compatibility alias for the same operation. Both commands verify
the final schema before committing; SQL/verification failures roll back the reset.
The initializer requires ownership of `public` (or equivalent administrative
privileges). New `public` is owned by `pg_database_owner`; only USAGE is granted
to PUBLIC. Custom object grants must be reapplied for separate runtime roles.
EmuKey uses explicit SQL through `pg`, with no ORM or automatic schema mutation.

The Compose maintenance service performs the same destructive initialization:

```powershell
docker compose --env-file .env.example --profile maintenance run --rm database-initialize
```

It reads `DATABASE_URL` from the ignored `backend/.env`. There is no `db:migrate`
command in this fresh-initializer workflow. Preserving an existing deployment's
data requires a separately reviewed upgrade procedure; do not run this reset
initializer as an in-place upgrade. New installations require `pgcrypto` and
`citext`; guide retrieval uses PostgreSQL full-text search.

Development seed data is separate from schema initialization and is never run automatically:

```powershell
Set-Location backend
corepack pnpm build
corepack pnpm db:seed
```

`db:seed` reads `DATABASE_URL` and `SEED_PASSWORD` from `backend/.env` and is idempotent for the deterministic development fixtures.

The full demo seed is at the bottom of `database/schema.sql`; the workspace
fixture runner reads the same SQL and JSON data. With `NODE_ENV=development`,
from `backend`, run:

```powershell
corepack pnpm db:seed:demo
# Alternatively, RESET the selected application schema and seed in one transaction:
corepack pnpm db:initialize --demo
```

The demo contains 50 products, 30 plans, 30 accounts and related business rows.
Demo logins include `admin01@demo.emukey.local`, `provider01@demo.emukey.local`,
`support01@demo.emukey.local`, and `customer01@demo.emukey.local`; the development
password is `Emu@1234`, stored as an Argon2id hash. Repeated seeds retain the same
fixture IDs. Demo blockchain rows are fixtures, not confirmed transactions.

In a SQL editor, add both `SET LOCAL emukey.seed_demo='true';` and
`SET LOCAL emukey.seed_environment='development';` after the outer `BEGIN;`,
then execute the complete file. **This resets public before seeding.** To seed
without resetting, use `db:seed:demo`, which extracts only the marked seed block.
Seed verification and schema creation share the transaction; a failed seed rolls
everything back. Default initialize/reset operations do not insert demo rows.

## OpenAPI contract

The backend owns `backend/openapi/openapi.json`. Frontend and mobile each keep a local input snapshot so their generation checks remain self-contained after a future repository split.

From `EmuKey`, synchronize all three units with:

```powershell
node scripts/generate-openapi.mjs
node scripts/generate-openapi.mjs --check
```

Do not hand-edit generated client files.

## Independent delivery

Each unit owns a future-repository workflow under `<unit>/.github/workflows` and a delivery contract under `<unit>/cicd/pipeline.yml`.

```powershell
docker build -t emukey-backend backend
docker build --build-arg VITE_API_URL=https://api.example.com/api/v1 -t emukey-frontend frontend
docker build --build-arg EXPO_PUBLIC_API_URL=https://api.example.com/api/v1 -t emukey-mobile mobile
```

The backend image runs API by default and the same image runs Worker with a different command. The frontend image serves static files and proxies `/api`. The mobile image is a build/development artifact, not a platform runtime service.

## Quality checks

Run checks inside every changed unit:

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm openapi:check
corepack pnpm build
```

Tests belong to UY. From the UY root, after installing the product dependencies:

```powershell
node tooling/emukey/run.mjs baseline
node tooling/emukey/run.mjs backend:unit
node tooling/emukey/run.mjs backend:contract
node tooling/emukey/run.mjs backend:security
node tooling/emukey/run.mjs backend:integration
node tooling/emukey/run.mjs frontend:unit
node tooling/emukey/run.mjs frontend:e2e
node tooling/emukey/run.mjs mobile:unit
node tooling/emukey/run.mjs contracts
```

The runner links installed product dependencies into ignored workspace `node_modules` directories; it never copies product source. Integration tests use disposable Docker containers. Set `RUN_PHASE7_INTEGRATION=true` to include assistance/notification cases. Integration suites cover DB/application invariants (concurrency, idempotency, replay, projection repair, reorg state) without any blockchain node; real Sepolia transactions run only through explicitly invoked external verification or the manual external workflow.

For isolated browser regressions, start the frontend with `corepack pnpm --dir EmuKey/frontend dev`, set `E2E_EXTERNAL=true` and `BASE_URL`, then run `frontend:e2e buyer-ui-recovery.spec.ts workspace-navigation.spec.ts`. The `payment-status-flow.spec.ts` suite also uses isolated API fixtures. These tests mock the API; they are not live payment/provider evidence.

Public activation challenge and activation share a Redis limit of 30 requests per 60 seconds per connected peer address. A denied request returns 429 with Retry-After. A reverse proxy shares this budget; apply client-IP limits at the trusted edge as well. Untrusted forwarded headers cannot bypass this backend limit.

The activation load scenario runs with `node tooling/emukey/load/load-test.mjs --scenario=activation`. Supply `LOAD_ACTIVATION_KEY` and `LOAD_DEVICE_PRIVATE_KEY` through environment variables for a disposable fixture with enough quota for `LOAD_REQUESTS`. It sends public challenge plus signed activation without purchaser authentication. It reports throttled requests separately; missing credentials return exit code 2. Never target a durable customer license.

The final initializer includes the aggregate-sync projection fix. Existing deployments need a separately reviewed data-preserving upgrade; this initializer resets the application schema.

Visual helpers run from UY, for example `node tooling/emukey/run.mjs frontend:visual-regression`; mobile readiness is `node tooling/emukey/run.mjs mobile:check-maestro`. Captures and generated reports are ignored under `docs/emukey/evidence/`; reference images and fixtures remain versioned.

## Sepolia runtime and deployment

The application (frontend/mobile/backend/PostgreSQL/Redis) may run locally, but blockchain runtime and integration use Ethereum Sepolia only (`11155111`). Hardhat is retained for Solidity compile, contract unit tests, ABI export and Ignition deployment. RPC failure blocks blockchain work; it never selects another chain.

After all local tests pass, from UY:

```powershell
corepack pnpm --dir EmuKey/backend contracts:build
corepack pnpm --dir EmuKey/backend/contracts deploy:sepolia
corepack pnpm --dir EmuKey/backend/contracts deployment:show
```

Deployment verifies chain ID, the funded non-development account, receipt and exact runtime bytecode. Ignition uses deployment ID `sepolia-v3`, preserving v2 history. Metadata is written only after a successful verified receipt. Copy the public address/block printed by `deployment:show` into the ignored runtime environment and GitHub variables `SEPOLIA_CONTRACT_ADDRESS` / `SEPOLIA_DEPLOYMENT_BLOCK`; no v2 fallback exists.

Run the isolated lifecycle smoke with Docker available:

```powershell
corepack pnpm --dir EmuKey/backend build
node --env-file=EmuKey/backend/.env tooling/emukey/run.mjs verify:verify-sepolia
```

This creates disposable PostgreSQL/Redis, uses the real application commerce path with a test payment adapter, then sends real Sepolia ISSUE and aggregate-sync transactions. Public activation and entitlement use the actual HTTP API without purchaser login. Evidence records receipt/event/projection plus T0-T4; payment evidence here does not claim a real payment-provider callback. The script removes its disposable services at exit and never initializes or resets the configured application database.

Normal CI runs no real blockchain transactions. `.github/workflows/emukey-external.yml` uses manual `run_sepolia=true`, the Sepolia RPC/relayer secrets and v3 address/block variables. Its blockchain smoke owns disposable DB/Redis containers; it does not require staging database credentials.


### Mô hình dữ liệu 24/10/2026

Schema mới có 19 bảng, tách `notification_deliveries` khỏi inbox. API/worker cũ không tương thích schema mới; cập nhật cùng phiên bản. `schema.sql` vẫn là initializer xóa public, chỉ dùng khi đã quyết định tạo lại DB. Các kiểm tra trong đợt refactor chạy trên Docker tạm, không cập nhật DB đang sử dụng.

Gia hạn cho phép đúng version đã mua kể cả đã ARCHIVED, với Provider ACTIVE; không đổi gói hoặc khách sở hữu. Plan đã công bố không được sửa giá/quyền trực tiếp.

Android push dùng native FCM (expo-notifications), không dùng Expo push gateway. Bản native phải có Firebase Android configuration tương ứng `app.emukey.mobile`, cấu hình googleServicesFile trong Expo build, và backend phải cấu hình adapter FCM/credentials theo biến môi trường hiện có. Không đưa credentials vào Git. Expo Go không thay thế development/release build để kiểm chứng push. Đợt này đã kiểm thử đăng ký/hủy token và gửi độc lập nhiều thiết bị bằng integration tests; nhận push thật khi app đóng cần kiểm chứng trên thiết bị có cấu hình Firebase.
