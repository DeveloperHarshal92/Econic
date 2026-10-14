FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/cart/package.json ./packages/cart/
COPY packages/cart/tsconfig.json ./packages/cart/
COPY packages/cart/webpack.config.js ./packages/cart/

RUN npm install --workspace=packages/shared --workspace=packages/cart

COPY packages/shared/src ./packages/shared/src
COPY packages/cart/src ./packages/cart/src

ENV NODE_ENV=production
RUN npm run build --workspace=packages/cart

FROM nginx:alpine

COPY packages/cart/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/cart/dist /usr/share/nginx/html

EXPOSE 3002

CMD ["nginx", "-g", "daemon off;"]
