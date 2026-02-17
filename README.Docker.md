# Docker Setup для Voice-app

Этот проект можно запустить через Docker Compose.

## Быстрый старт (Production)

1. **Скопируйте `.env.example` в `.env`** и настройте переменные окружения:
   ```bash
   cp .env.example .env
   ```

2. **Важно:** Обновите `.env` файл с правильными URL для Docker:
   ```env
   # Для Docker используйте имена сервисов вместо localhost
   VITE_LIVEKIT_URL=ws://localhost:7880  # Для браузера остается localhost
   VITE_TOKEN_ENDPOINT=http://localhost:4000/api/token  # Для браузера остается localhost
   ```

3. **Запустите все сервисы:**
   ```bash
   docker-compose up -d --build
   ```

4. **Откройте приложение:**
   - Frontend: http://localhost:1420
   - LiveKit WebSocket: ws://localhost:7880
   - Token Server: http://localhost:4000

## Разработка с Docker

Для разработки можно запустить только LiveKit и Token Server через Docker, а frontend запускать локально:

```bash
# Запуск только LiveKit и Token Server
docker-compose -f docker-compose.dev.yml up -d

# Frontend запускается локально
cd frontend
npm run dev
```

Или запустить все в dev режиме:
```bash
docker-compose -f docker-compose.dev.yml up
```

## Структура сервисов

- **livekit** - LiveKit сервер для WebRTC
- **token-server** - Сервер для выдачи токенов LiveKit
- **frontend** - React приложение (собранное и раздаваемое через nginx)

## Переменные окружения

Создайте файл `.env` в корне проекта:

```env
# LiveKit ключи (для продакшена используйте реальные!)
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# Frontend переменные (используются при сборке)
VITE_LIVEKIT_URL=ws://localhost:7880
VITE_TOKEN_ENDPOINT=http://localhost:4000/api/token
```

## Команды

### С использованием Makefile (рекомендуется)

Если у вас установлен `make`:
```bash
make help      # Показать все доступные команды
make build     # Собрать все образы
make up        # Запустить все сервисы
make down      # Остановить все сервисы
make logs      # Показать логи
make dev       # Запустить dev окружение
make rebuild   # Пересобрать и перезапустить
```

### Без Makefile

#### Запуск
```bash
docker-compose up -d
```

#### Остановка
```bash
docker-compose down
```

#### Просмотр логов
```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f frontend
docker-compose logs -f livekit
docker-compose logs -f token-server
```

#### Пересборка после изменений
```bash
docker-compose up -d --build
```

#### Остановка и удаление всех данных
```bash
docker-compose down -v
```

## Перенос на сервер (Production)

На сервере нужно поменять следующее.

### 1. Файл `.env` на сервере

Создай `.env` из `.env.example` и задай **публичный адрес сервера** (домен или IP):

```env
# Ключи — обязательно смени с devkey/secret на свои
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# URL, по которым браузер будет подключаться (твой домен или IP сервера)
# Без HTTPS: ws:// и http://
# С HTTPS (рекомендуется): wss:// и https://
VITE_LIVEKIT_URL=wss://example.com/livekit
VITE_TOKEN_ENDPOINT=https://example.com/api/token

# То же для ответа token-server клиенту
LIVEKIT_WS_URL=wss://example.com/livekit
```

Если без домена, по IP (без TLS):
```env
VITE_LIVEKIT_URL=ws://YOUR_SERVER_IP:7880
VITE_TOKEN_ENDPOINT=http://YOUR_SERVER_IP:4000/api/token
LIVEKIT_WS_URL=ws://YOUR_SERVER_IP:7880
```

### 2. Сборка с новыми URL

`VITE_*` встраиваются в фронт при сборке. После смены `.env`:

```bash
docker-compose build --no-cache frontend
docker-compose up -d
```

### 3. LiveKit ключи в конфиге

В `livekit/livekit.prod.yaml` в блоке `keys` должны быть те же ключи, что и в `.env` (LIVEKIT_API_KEY / LIVEKIT_API_SECRET). Сейчас там захардкожено `devkey: secret` — замени на свои.

### 4. HTTPS и reverse proxy (рекомендуется)

- Поднять перед приложением nginx/traefik/Caddy.
- Раздать по HTTPS: фронт (например `:443` → frontend:80), API токенов (`/api/token` → token-server:4000), WebSocket LiveKit (`/livekit` или отдельный хост → livekit:7880).
- В `.env` тогда: `VITE_LIVEKIT_URL=wss://example.com/livekit`, `VITE_TOKEN_ENDPOINT=https://example.com/api/token`, `LIVEKIT_WS_URL=wss://example.com/livekit` (прокси сам проксирует на `livekit:7880`).

### 5. Фаервол

Открыть на сервере (или в облачном фаерволе) порты:
- **80/443** — если за nginx;
- **7880** (WebSocket), **7881** (TCP RTC), **7882/UDP** (RTC) — если обращаешься к LiveKit напрямую по IP.

### 6. TURN (если пользователи за жёстким NAT)

В `livekit/livekit.prod.yaml` включить и настроить TURN (или использовать [LiveKit Cloud TURN](https://docs.livekit.io/realtime/self-hosting/turn/)), и при необходимости задать `use_external_ip: true` и внешний IP.

### Краткий чек-лист

| Где | Что поменять |
|-----|----------------|
| `.env` | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (свои ключи) |
| `.env` | `VITE_LIVEKIT_URL`, `VITE_TOKEN_ENDPOINT`, `LIVEKIT_WS_URL` — домен/IP сервера (wss/https на проде) |
| `livekit/livekit.prod.yaml` | Блок `keys` — те же ключи, что в `.env` |
| После смены `.env` | `docker-compose build --no-cache frontend` и `docker-compose up -d` |
| Сервер | Reverse proxy (HTTPS), открытые порты, при необходимости TURN |

## Структура файлов

```
Voice-app/
├── docker-compose.yml          # Production конфигурация
├── docker-compose.dev.yml      # Development конфигурация
├── .env.example                # Пример переменных окружения
├── frontend/
│   ├── Dockerfile              # Сборка frontend (nginx)
│   ├── Dockerfile.token-server # Token server
│   ├── nginx.conf              # Конфигурация nginx
│   └── .dockerignore
└── livekit/
    ├── livekit.prod.yaml       # Production конфиг LiveKit
    └── livekit.dev.yaml        # Development конфиг LiveKit
```

## Важные замечания

### Переменные окружения для Frontend

**Важно:** `VITE_*` переменные встраиваются в код при сборке, поэтому:
- Для локальной разработки используйте `localhost`
- Для Docker/продакшена URL должны быть доступны из браузера пользователя (не из контейнера!)

Пример:
```env
# Правильно - браузер подключается к localhost
VITE_LIVEKIT_URL=ws://localhost:7880
VITE_TOKEN_ENDPOINT=http://localhost:4000/api/token

# Неправильно - браузер не сможет подключиться к имени сервиса Docker
VITE_LIVEKIT_URL=ws://livekit:7880  # ❌
```

### Сеть Docker

Сервисы общаются между собой через Docker network по именам:
- Token server → LiveKit: `ws://livekit:7880` ✅
- Frontend (браузер) → LiveKit: `ws://localhost:7880` ✅

## Troubleshooting

### Ошибка: "connecting to 127.0.0.1:2080 ... connection refused"

Docker пытается качать образы через прокси (например, Clash на порту 2080), но прокси не принимает соединения.

**Варианты решения:**

1. **Временно отключить прокси для Docker**
   - Docker Desktop: **Settings → Resources → Proxies** — выключите или очистите HTTP/HTTPS proxy.
   - Или в системе: удалите/закомментируйте переменные `HTTP_PROXY`, `HTTPS_PROXY`, `http_proxy`, `https_proxy` в окружении (и в Docker Desktop, если заданы там).

2. **Включить прокси и разрешить локальные подключения**
   - Если используешь Clash/Clash Verge: убедись, что он запущен и разрешает подключения с localhost (порт 2080 или тот, что указан в настройках прокси).
   - В Clash можно добавить правило, чтобы трафик к `127.0.0.1` не шёл через прокси, или чтобы Docker не использовал прокси.

3. **Скачать образ вручную без прокси**
   - Временно отключи прокси в системе/Docker, выполни:
     ```bash
     docker pull livekit/livekit-server:latest
     ```
   - После успешной загрузки снова запусти:
     ```bash
     docker-compose up -d --build
     ```

### Проблемы с портами
Если порты заняты, измените их в `docker-compose.yml`:
```yaml
ports:
  - "1420:80"  # Frontend
  - "4000:4000"  # Token server
  - "7880:7880"  # LiveKit
```

### Проблемы с WebRTC
Убедитесь, что:
- UDP порт 7882 открыт и проброшен (`7882:7882/udp`)
- Используется HTTPS или localhost для WebRTC
- Настроен TURN сервер для внешних подключений (в `livekit.prod.yaml`)

### Проблемы со сборкой frontend
Если переменные окружения не применяются:
1. Убедитесь, что они переданы через `build.args` в `docker-compose.yml`
2. Проверьте, что они начинаются с `VITE_`
3. Пересоберите образ: `docker-compose build --no-cache frontend`

### Проверка здоровья сервисов
```bash
docker-compose ps
```

### Просмотр логов конкретного сервиса
```bash
docker-compose logs -f livekit
docker-compose logs -f token-server
docker-compose logs -f frontend
```

### Перезапуск сервиса
```bash
docker-compose restart frontend
```
