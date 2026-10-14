FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/api-gateway/tsconfig.json ./services/api-gateway/

# Install dependencies
RUN npm install --workspace=packages/shared --workspace=services/api-gateway

# Copy source code
COPY packages/shared/src ./packages/shared/src
COPY services/api-gateway/src ./services/api-gateway/src

# Build packages
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=services/api-gateway

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=4000

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/dist ./packages/shared/dist
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/api-gateway/dist ./services/api-gateway/dist

RUN npm install --omit=dev --workspace=packages/shared --workspace=services/api-gateway

EXPOSE 4000

CMD ["node", "services/api-gateway/dist/server.js"]
