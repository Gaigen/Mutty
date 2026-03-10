# Multi-stage build для frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package файлы (package-lock.json опционален — при отсутствии используется npm install)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Копируем исходный код
COPY . .

# Переменные окружения для сборки (ARG передаются только на этап сборки)
ARG VITE_LIVEKIT_URL=ws://localhost:7880
ARG VITE_TOKEN_ENDPOINT=http://localhost:4000/api/token

ENV VITE_LIVEKIT_URL=${VITE_LIVEKIT_URL}
ENV VITE_TOKEN_ENDPOINT=${VITE_TOKEN_ENDPOINT}

# Собираем приложение
RUN npm run build

# Production stage - используем nginx для статики
FROM nginx:alpine

# Копируем собранное приложение
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем кастомную конфигурацию nginx (опционально)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
