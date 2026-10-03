FROM node:22.21.0-bookworm-slim AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY contracts/package.json contracts/tsconfig.json ./contracts/
RUN corepack pnpm install --frozen-lockfile

COPY contracts/hardhat.config.ts ./contracts/
COPY contracts/solidity ./contracts/solidity
COPY contracts/test ./contracts/test
COPY contracts/test-vectors ./contracts/test-vectors
COPY contracts/scripts ./contracts/scripts
RUN corepack pnpm contracts:verify
COPY . .
RUN corepack pnpm build

FROM node:22.21.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/database/schema.sql database/schema.sql
COPY --from=build /app/config/license-terms config/license-terms
COPY --from=build /app/config/service-terms.md config/service-terms.md
COPY --from=build /app/package.json package.json

RUN mkdir -p /app/data/storage && chown -R node:node /app/data
USER node
CMD ["node", "dist/entrypoints/api/main.js"]
