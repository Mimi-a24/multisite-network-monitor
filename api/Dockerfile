# Build context: the repository root (npm workspaces).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY worker/package.json worker/
RUN npm ci
COPY shared shared
COPY api api
RUN npx tsc -b api

# One-off job run by `make up` / `make migrate-up`.
FROM build AS migrate
COPY migrations migrations
CMD ["npx", "node-pg-migrate", "up", "-m", "migrations"]

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY worker/package.json worker/
RUN npm ci --omit=dev -w api && npm cache clean --force
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/api/dist api/dist
USER node
EXPOSE 3000
CMD ["node", "api/dist/main.js"]
