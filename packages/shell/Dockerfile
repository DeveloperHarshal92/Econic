FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shell/package.json ./packages/shell/
COPY packages/shell/tsconfig.json ./packages/shell/
COPY packages/shell/webpack.config.js ./packages/shell/

RUN npm install --workspace=packages/shell

COPY packages/shell/src ./packages/shell/src

ENV NODE_ENV=production
RUN npm run build --workspace=packages/shell

FROM nginx:alpine

COPY packages/shell/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/shell/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
