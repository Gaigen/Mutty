# Voice App 🎙️

![GitHub release (latest SemVer)]
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![LiveKit](https://img.shields.io/github/v/release/livekit/livekit)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)

**Voice App** — open-source платформа для голосового общения в реальном времени, вдохновлённая Discord и построенная на базе **LiveKit**. Позволяет разворачивать голосовые приложения с низкой задержкой, масштабируемой WebRTC-инфраструктурой и кастомизируемым UI.

Проект включает **Mutty** — десктопное Tauri-приложение (React + Rust), ребрендированный клиент Voice App.

---

## Возможности

- Голосовая связь в реальном времени (WebRTC, низкая задержка)
- Discord-подобные голосовые каналы
- Шаринг экрана с автозвуком (стартовые/стоповые звуковые сигналы)
- Бот-агент, стримящий YouTube/Twitch/SoundCloud/Telegram прямо в голосовую комнату
- Чат с вложениями изображений и превью твитов
- Модульная архитектура для кастомизации
- Кроссплатформенность: веб + десктоп (Tauri)
- Self-hosted — полностью под твоим контролем

---

## Архитектура

```
┌─────────────────────┐         ┌──────────────────────────────┐
│   Frontend          │◄───────►│   Backend (Token Server)     │
│   React + nginx     │  HTTP    │   Node.js (tsx)              │
│   :1420             │         │   :4000                      │
└──────────┬──────────┘         └──────────────┬───────────────┘
           │                                    │
           │  WebSocket / WebRTC               │  HTTP (внутри Docker)
           ▼                                    ▼
   ┌───────────────────────────────────────────────────┐
   │              LiveKit Server                       │
   │        livekit-server:latest                      │
   │   :7880 (WS) / :7881 (TCP) / :7882 (UDP)          │
   └──────────────────────┬────────────────────────────┘
                          │
            WebSocket (внутри Docker)
                          ▼
   ┌───────────────────────────────────────────────────┐
   │          Agent Server (YouTube-бот)               │
   │        Python + livekit-agents                    │
   │                  :8081                            │
   └───────────────────────────────────────────────────┘
```

### Модули

#### 1. LiveKit Server
- **Что:** Ядро WebRTC-инфраструктуры (Go), образ `livekit/livekit-server:latest`
- **За что отвечает:** медиа-маршрутизация, сигнализация, управление комнатами
- **Порты:**
  - `7880` — WebSocket (сигнализация)
  - `7881` — TCP (fallback для WebRTC)
  - `7882` — UDP (RTC, медиа)
- **Конфиг:** `livekit/livekit.prod.yaml` (production) или `livekit/livekit.dev.yaml` (dev)
- **Ключи:** блок `keys` в YAML — должны совпадать с `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` из `.env`
- **Healthcheck:** `wget --quiet --tries=1 --spider http://localhost:7880/`

#### 2. Backend (Token Server)
- **Что:** Node.js сервер на `tsx` (TypeScript), выделен в отдельный пакет `backend/`
- **Стек:** TypeScript + tsx + `livekit-server-sdk` v2 + dotenv
- **За что отвечает:** выдача JWT-токенов LiveKit для аутентификации пользователей в комнатах
- **Путь:** `backend/`
- **Dockerfile:** `backend/Dockerfile` (node:20-alpine, tsx runtime)
- **Порт:** `4000`
- **Зависит от:** `livekit`
- **Ключевые env:**
  - `LIVEKIT_WS_URL` — URL, отдаваемый браузеру (должен быть `localhost` или твой домен)
  - `LIVEKIT_API_URL` — авто-вычисляется из WS-URL (`ws/` → `http/`), для внутренних запросов
  - `TOKEN_CORS_ORIGINS` — origins через запятую (пусто = `[*]`)
  - `TOKEN_ROOM_MAX_LENGTH` / `TOKEN_IDENTITY_MAX_LENGTH` / `TOKEN_TTL` — лимиты токенов
- **Healthcheck:** `node -e "fetch('http://127.0.0.1:4000/health')..."` (start_period: 15s, 5 retry)

#### 3. Frontend
- **Что:** React SPA, собранная Vite и раздаваемая через nginx
- **Стек:** React + TypeScript + Vite + Tailwind + shadcn/ui + LiveKit SDK + React Router
- **Dockerfile:** `frontend/Dockerfile` → мультистейдж-билд, затем nginx
- **Порт:** `1420` (host) → `80` (контейнер nginx)
- **Зависит от:**
  - `token-server` (condition: `service_healthy`, required: `true`)
  - `livekit` (condition: `service_healthy`, required: `true`)
  - `agent-server` (condition: `service_started`, required: `false`) — опционально
- **VITE_* переменные встраиваются при сборке.** После смены `.env`: `docker-compose build --no-cache frontend`

#### 4. Agent Server (YouTube-бот)
- **Что:** Python-бот на `livekit-agents`, регистрируется как участник комнаты `youtube-bot`
- **За что отвечает:** воспроизведение YouTube/Twitch/SoundCloud/Telegram в голосовой комнате
- **Порт:** `8081`
- **Команды в чате** (без "!"):
  - `<url>` — воспроизвести ссылку
  - `add <url>` / `queue <url>` — добавить в очередь
  - `skip` / `next` — пропустить трек
  - `queue` / `list` — показать очередь
  - `clear` — очистить очередь
  - `стоп` / `stop` — остановить
  - `pause` / `resume` — пауза / продолжить
  - `repeat` — повтор текущего трека
  - `аудио <url>` — только звук
  - `видео <url>` — видео + звук
  - `youtube <запрос>` / `soundcloud <запрос>` — поиск

#### 5. Mutty App (десктоп)
- **Что:** Tauri desktop-приложение (React + Rust)
- **Путь:** `mutty-app/`
- **Фичи:**
  - Автозапуск, трей (сворачивание)
  - Настройки через Tauri Store (persistent)
  - Горячие клавиши
  - Звуки шаринга экрана (start chime / stop chime)
  - Агент-контроль с выпадающим меню (режимы, качество, очередь, громкость, now playing)
  - Чат с вложениями, drag-and-drop, автоскролл, уведомления
  - Превью твитов
  - Сплэш-скрин при запуске

---

## Быстрый старт

### 1. Клон

```bash
git clone https://github.com/Gaigen/Voice-app.git
cd Voice-app
```

### 2. Настрой .env

```bash
cp .env.example .env
```

```env
# Ключи LiveKit (в проде — ОБЯЗАТЕЛЬНО свои!)
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# URL для браузера (локально = localhost)
VITE_LIVEKIT_URL=ws://localhost:7880
VITE_TOKEN_ENDPOINT=http://localhost:4000/api/token
VITE_AGENT_ENDPOINT=http://localhost:5000

# Token Server
TOKEN_SERVER_PORT=4000
TOKEN_SERVER_HOST=0.0.0.0
LIVEKIT_WS_URL=ws://localhost:7880

# Опционально
# TOKEN_CORS_ORIGINS=
# TOKEN_ROOM_MAX_LENGTH=100
# TOKEN_IDENTITY_MAX_LENGTH=100
# TOKEN_TTL=3600
# AGENT_VIDEO_FPS=30
```

### 3. Запусти

```bash
# С Makefile (рекомендуется)
make build    # собрать образы
make up       # запустить всё

# Или без make
docker-compose up -d --build
```

### 4. Открой приложение

| Сервис         | URL                         | Описание                        |
|----------------|-----------------------------|---------------------------------|
| Frontend       | `http://localhost:1420`     | Веб-интерфейс                   |
| Token Server   | `http://localhost:4000`     | API выдачи токенов (`/health`)  |
| LiveKit WS     | `ws://localhost:7880`       | WebSocket (сигнализация)        |
| LiveKit Admin  | `http://localhost:7880`     | HTTP API LiveKit                |
| Agent Server   | `http://localhost:8081`     | YouTube/стриминг бот            |

---

## Как связаны порты и модули

### Карта коммуникаций

```
БРАУЗЕР (пользователь)
  │
  ├─ http://localhost:1420 ──────────► Frontend (nginx :80 в контейнере)
  │
  ├─ ws://localhost:7880   ──────────► LiveKit Server (WebRTC через браузер)
  │
  ├─ http://localhost:4000/api/token ─► Backend / Token Server (JWT-токен)
  │
  └─ http://localhost:5000           ─► Agent Control (управление ботом из UI)

ВНУТРИ DOCKER NETWORK:
  │
  Backend ──http://livekit:7880──► LiveKit Server  (генерация токенов)
  Agent   ──ws://livekit:7880────► LiveKit Server  (подключение в комнату)
```

### Ключевой принцип: VITE_* vs внутренние URL

`VITE_*` переменные **встраиваются в JS-бандл при сборке**. Это URL-ы, по которым **браузер пользователя** подключается — поэтому нужен `localhost` (или твой домен).

```
✅ VITE_LIVEKIT_URL=ws://localhost:7880    — браузер понимает localhost
❌ VITE_LIVEKIT_URL=ws://livekit:7880      — "livekit" — имя контейнера, браузер его не знает
```

Контейнеры внутри Docker-сети общаются по именам сервисов: `ws://livekit:7880`, `http://livekit:7880`.

### Зависимости запуска

```
1. livekit (порт 7880)           — запускается первым
   ├── healthcheck → ok
       │
       ├── 2. backend/token-server (порт 4000)
       │      depends_on: livekit
       │      healthcheck → ok
       │          │
       │          └── 3. frontend (порт 1420)
       │                 depends_on: livekit ✅ (healthy)
       │                    + backend ✅ (healthy)
       │                    + agent (опционально)
       │
       └── 4. agent-server (порт 8081) [опционально]
              depends_on: livekit
```

---

## Режим разработки

Запускаешь инфраструктуру в Docker, фронтенд — локально с hot reload:

```bash
# Только LiveKit + Backend в Docker
make dev
# или
docker-compose -f docker-compose.dev.yml up -d

# Фронтенд локально
cd frontend
npm install
npm run dev
```

Backend в dev режиме — с `tsx watch` и `volumes: - ./backend/src:/app/src:ro` для hot reload.

```bash
# Backend локально (если хочешь dev без Docker)
cd backend
npm install
npm run dev    # tsx watch src/index.ts
```

---

## Перенос на сервер (Production)

### 1. Смени ключи

В `.env` и `livekit/livekit.prod.yaml` — задай реальные ключи.

### 2. Публичный адрес в .env

```env
# С HTTPS (рекомендуется)
VITE_LIVEKIT_URL=wss://example.com/livekit
VITE_TOKEN_ENDPOINT=https://example.com/api/token
LIVEKIT_WS_URL=wss://example.com/livekit

# Без HTTPS (по IP)
VITE_LIVEKIT_URL=ws://YOUR_SERVER_IP:7880
VITE_TOKEN_ENDPOINT=http://YOUR_SERVER_IP:4000/api/token
LIVEKIT_WS_URL=ws://YOUR_SERVER_IP:7880
```

### 3. Пересобери фронтенд

```bash
docker-compose build --no-cache frontend
docker-compose up -d
```

### 4. Reverse proxy + HTTPS

Nginx/Caddy/Traefik перед сервисами:
| Маршрут | Бэкенд |
|---------|--------|
| `:443` | frontend `:80` |
| `/api/token` | backend `:4000` |
| `/livekit` | livekit `:7880` |

### 5. Фаервол

| Порт | Назначение |
|------|-----------|
| `80` / `443` | HTTP/HTTPS через reverse proxy |
| `7880` | WebSocket (прямой доступ к LiveKit) |
| `7881` | TCP fallback (WebRTC) |
| `7882/UDP` | Медиа (WebRTC) |

### 6. TURN

Для пользователей за симметричным NAT — настрой TURN в `livekit.prod.yaml`.

---

## Makefile команды

| Команда | Описание |
|---------|----------|
| `make help` | Список команд |
| `make build` | Собрать все образы |
| `make up` | Запустить всё |
| `make down` | Остановить всё |
| `make logs` | Логи всех сервисов |
| `make restart` | Перезапустить всё |
| `make clean` | Остановить + удалить контейнеры + volumes |
| `make dev` | Dev-режим (LiveKit + Backend) |
| `make dev-down` | Остановить dev |
| `make rebuild` | Пересобрать + перезапустить |
| `make ps` | Статус контейнеров |

---

## Структура проекта

```
Voice-app/
├── docker-compose.yml          # Production: 4 сервиса
├── docker-compose.dev.yml      # Development: LiveKit + Backend
├── .env.example                # Шаблон переменных
├── Makefile                    # Удобные команды
├── README.Docker.md            # Подробная Docker-документация
│
├── backend/                    # Token Server (раньше в frontend/scripts/)
│   ├── Dockerfile              # Node.js 20 Alpine + tsx
│   ├── src/index.ts            # Точка входа (HTTP server)
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   └── .dockerignore
│
├── frontend/                   # React фронтенд
│   ├── Dockerfile              # Production (Vite build → nginx)
│   ├── nginx.conf
│   ├── package.json
│   └── src/                    # React компоненты
│
├── agent-server/               # Python бот
│   ├── Dockerfile
│   ├── main.py                 # LiveKit Agent Server entrypoint
│   ├── agent.py                # Логика бота (стриминг, очередь)
│   └── requirements.txt
│
├── livekit/                    # Конфиги LiveKit
│   ├── livekit.prod.yaml
│   └── livekit.dev.yaml
│
└── mutty-app/                  # Tauri десктоп
    ├── src/                    # React + компоненты
    │   ├── components/livekit/
    │   │   ├── AgentControls.tsx
    │   │   ├── SoundHandler.tsx
    │   │   ├── agent-controls/     # Меню бота
    │   │   └── chat-with-attachments/  # Чат
    │   └── hooks/              # Custom React hooks
    ├── src-tauri/              # Rust + Tauri конфиг
    └── package.json
```

---

## Troubleshooting

### Контейнеры не стартуют
```bash
make logs    # смотри логи
make ps      # статус контейнеров
```

### Фронтенд не подключается к LiveKit
- Проверь `VITE_LIVEKIT_URL` в `.env` (должен = `ws://localhost:7880`)
- Пересобери: `docker-compose build --no-cache frontend && docker-compose up -d`

### WebRTC не работает
- UDP порт `7882` должен быть открыт
- Для внешних подключений — настрой TURN
- Без HTTPS WebRTC работает только на localhost

### Ошибка токенов
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` в `.env` и `livekit/livekit.prod.yaml` должны совпадать
- Healthcheck бэкенда: `http://localhost:4000/health`

### Backend не видит .env
Backend ищет `.env` по двум путям: `../../.env` и `../.env` (относительно `backend/src/index.ts`). Убедись, что файл лежит в корне проекта.
