# Multi-stage build для web frontend (monorepo)
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем корневой package.json и lock-файл
COPY package.json package-lock.json* ./

# Копируем package.json для shared и web
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Копируем исходный код shared и web
COPY packages/shared packages/shared
COPY packages/web packages/web

# Переменные окружения для сборки (ARG передаются только на этап сборки)
ARG VITE_TOKEN_ENDPOINT=http://127.0.0.1:4000/api/token

ENV VITE_TOKEN_ENDPOINT=${VITE_TOKEN_ENDPOINT}

# Собираем shared, затем web
RUN npm run build --workspace=packages/shared 2>/dev/null || true
RUN npm run build --workspace=packages/web

# Production stage - используем nginx для статики
FROM nginx:alpine

# Копируем собранное приложение
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Копируем кастомную конфигурацию nginx
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
