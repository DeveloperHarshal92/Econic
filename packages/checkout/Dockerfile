FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/checkout/package.json ./packages/checkout/
COPY packages/checkout/tsconfig.json ./packages/checkout/
COPY packages/checkout/webpack.config.js ./packages/checkout/

RUN npm install --workspace=packages/shared --workspace=packages/checkout

COPY packages/shared/src ./packages/shared/src
COPY packages/checkout/src ./packages/checkout/src

ENV NODE_ENV=production
RUN npm run build --workspace=packages/checkout

FROM nginx:alpine

COPY packages/checkout/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/checkout/dist /usr/share/nginx/html

EXPOSE 3003

CMD ["nginx", "-g", "daemon off;"]
