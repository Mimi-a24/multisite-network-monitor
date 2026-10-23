# Build context: the repository root (npm workspaces).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY worker/package.json worker/
RUN npm ci
COPY shared shared
COPY worker worker
RUN npx tsc -b worker

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY worker/package.json worker/
RUN npm ci --omit=dev -w worker && npm cache clean --force
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/worker/dist worker/dist
USER node
CMD ["node", "worker/dist/main.js"]
