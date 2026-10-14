FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/catalog/package.json ./packages/catalog/
COPY packages/catalog/tsconfig.json ./packages/catalog/
COPY packages/catalog/webpack.config.js ./packages/catalog/

RUN npm install --workspace=packages/catalog

COPY packages/catalog/src ./packages/catalog/src

ENV NODE_ENV=production
RUN npm run build --workspace=packages/catalog

FROM nginx:alpine

COPY packages/catalog/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/catalog/dist /usr/share/nginx/html

EXPOSE 3001

CMD ["nginx", "-g", "daemon off;"]
