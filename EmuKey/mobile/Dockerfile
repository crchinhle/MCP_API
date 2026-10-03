FROM node:22.21.0-bookworm-slim AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack pnpm install --frozen-lockfile

COPY . .
ARG EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
RUN corepack pnpm test
RUN corepack pnpm typecheck
RUN corepack pnpm build

FROM node:22.21.0-bookworm-slim AS runtime

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable
COPY --from=build /app/node_modules node_modules
COPY --from=build /app .

EXPOSE 8081
CMD ["corepack", "pnpm", "start", "--", "--host", "lan"]
