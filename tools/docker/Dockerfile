FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY tools ./tools
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter @jrdm/server... build && pnpm --filter @jrdm/web build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=build /app /app
ENV HOST=0.0.0.0
ENV PORT=3737
EXPOSE 3737
CMD ["pnpm", "--filter", "@jrdm/server", "dev"]
