# Multi-stage build для web frontend (pnpm monorepo)
FROM node:20-alpine AS builder

RUN npm install -g pnpm@10

WORKDIR /app

# Копируем корневые файлы монорепы
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Копируем package.json для всех workspace-пакетов
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/

# Устанавливаем зависимости
RUN pnpm install --frozen-lockfile

# Копируем исходный код
COPY packages/shared packages/shared
COPY packages/web packages/web

# Переменные окружения для сборки (ARG передаются только на этап сборки)
ARG VITE_TOKEN_ENDPOINT=http://localhost:4000/api/token
ENV VITE_TOKEN_ENDPOINT=${VITE_TOKEN_ENDPOINT}

# Собираем web
RUN pnpm --filter @mutty/web build

# Production stage - nginx для статики
FROM nginx:alpine

COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
