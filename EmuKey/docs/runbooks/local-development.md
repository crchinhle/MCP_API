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
- An external PostgreSQL database (the current development environment uses Neon).
- An ignored `backend/.env` created from `backend/.env.example`, with a valid external `DATABASE_URL` and the remaining backend settings.

Each delivery unit owns its package manifest, lockfile, lint configuration, tests, build and container contract. Install dependencies from the unit directory:

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
for this workflow. PostgreSQL continues to use the external `DATABASE_URL` from
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

Database initialization is not part of normal `docker compose up`. It applies `backend/database/schema.sql` only when the `public` schema has no tables, then verifies the result. Run it only as an explicit maintenance operation after confirming the target database and backup:

```powershell
docker compose --env-file .env.example --profile maintenance run --rm database-initialize
```

The maintenance service reads `DATABASE_URL` from `backend/.env`. EmuKey uses version-controlled PostgreSQL SQL directly through `pg`; no ORM or automatic schema mutation is part of the backend.

Development seed data is separate from schema initialization and is never run automatically:

```powershell
Set-Location backend
corepack pnpm build
corepack pnpm db:seed
```

`db:seed` reads `DATABASE_URL` and `SEED_PASSWORD` from `backend/.env` and is idempotent for the deterministic development fixtures.

## OpenAPI contract

The backend owns `backend/docs/openapi/openapi.json`. Frontend and mobile each keep a local input snapshot so their generation checks remain self-contained after a future repository split.

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
corepack pnpm test
corepack pnpm openapi:check
corepack pnpm build
```

The backend database integration test additionally requires Docker.
