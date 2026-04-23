# Voice App / Mutty 🎙️

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![LiveKit](https://img.shields.io/github/v/release/livekit/livekit)
![Tauri](https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=%23FFFFFF)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)

**Voice App** — open-source платформа для голосового общения в реальном времени, вдохновлённая Discord и построенная на базе **LiveKit**. Позволяет разворачивать голосовые приложения с низкой задержкой, масштабируемой WebRTC-инфраструктурой и кастомизируемым UI.

Проект включает **Mutty** — десктопное Tauri-приложение (React + Rust), ребрендированный клиент Voice App.

---

## Возможности

- **Голосовая связь** в реальном времени (WebRTC, низкая задержка)
- **Discord-подобные** голосовые каналы
- **Шаринг экрана** со звуковыми сигналами (start/stop chime)
- **Плавающие окна** — коллаборативный whiteboard (Excalidraw) и shared notepad
- **Бот-агент** со встроенным AI через OpenRouter — стримит YouTube/Twitch/SoundCloud/Telegram и отвечает в чате
- **Чат** с вложениями изображений, drag-and-drop, превью твитов
- **Кроссплатформенность** — веб (React) + десктоп (Tauri + Rust)
- **Self-hosted** — полностью под твоим контролем

---

## Архитектура

```
┌─────────────────────┐         ┌──────────────────────────────┐
│   Web/Desktop       │◄───────►│   Backend (Token Server)     │
│   React + Vite      │  HTTP    │   Node.js / tsx              │
│   :1420 / :1421     │         │   :4000                      │
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
   │          Agent Server (Python бот)                │
   │        livekit-agents + OpenRouter AI             │
   │                  :8081                            │
   └───────────────────────────────────────────────────┘
```

### Монорепо (pnpm workspace)

```
Voice-app/
├── backend/                    # Token Server (Node.js + tsx)
├── packages/
│   ├── web/                    # Веб-клиент (React + Vite)
│   ├── desktop/                # Десктоп (Tauri v2 + Rust)
│   └── shared/                 # Shared компоненты (React hooks, UI, collab)
├── agent-server/               # Python бот
├── livekit/                    # Конфиги LiveKit
└── readme-voice/               # Документация
```

### Модули

#### 1. LiveKit Server
- **Ядро WebRTC-инфраструктуры** (Go), образ `livekit/livekit-server:latest`
- **Медиа-маршрутизация**, сигнализация, управление комнатами
- **Порты:**
  - `7880` — WebSocket (сигнализация)
  - `7881` — TCP (fallback для WebRTC)
  - `7882` — UDP (RTC, медиа)
- **Конфиг:** `livekit/livekit.prod.yaml` (production) / `livekit/livekit.dev.yaml` (dev)
- **Ключи:** блок `keys` в YAML должен совпадать с `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` из `.env`

#### 2. Backend (Token Server)
- **Стек:** TypeScript + tsx + `livekit-server-sdk` v2 + dotenv
- **За что отвечает:** выдача JWT-токенов LiveKit для аутентификации в комнатах
- **Порт:** `4000`
- **Ключевые env:**
  - `LIVEKIT_WS_URL` — URL, отдаваемый браузеру (`localhost` или твой домен)
  - `LIVEKIT_API_URL` — авто-вычисляется из WS-URL (`ws/` → `http/`)
  - `TOKEN_CORS_ORIGINS` — origins через запятую (пусто = `[*]`)
  - `TOKEN_ROOM_MAX_LENGTH` / `TOKEN_IDENTITY_MAX_LENGTH` / `TOKEN_TTL`

#### 3. Web Client (`packages/web`)
- **Стек:** React + TypeScript + Vite + Tailwind CSS + shadcn/ui + LiveKit SDK + React Router
- **Порт:** `1420` (dev)
- **Фичи:**
  - Голос/видео, screen share
  - Чат с вложениями изображений, drag-and-drop
  - Коллаборативный whiteboard (Excalidraw + Yjs)
  - Shared notepad (LiveKit data channels)
  - Floating windows — drag, resize, minimize

#### 4. Desktop Client (`packages/desktop`)
- **Стек:** Tauri v2 (React frontend + Rust backend)
- **Порт:** `1421` (dev)
- **Фичи:**
  - Все фичи веб-клиента
  - **Глобальные горячие клавиши** (настраиваемые через UI, работают даже когда окно не в фокусе)
  - Трей (сворачивание в системный луч)
  - Звуки шаринга экрана (start/stop chime)
  - Agent controls — меню управления ботом (режимы, качество, очередь, громкость)
  - Сплэш-скрин при запуске

#### 5. Shared (`packages/shared`)
- **Стек:** React + TypeScript
- **Что внутри:**
  - `floating/` — система плавающих окон (drag, resize, z-index, minimize)
  - `collab/` — синхронизация через LiveKit data channels (Yjs для whiteboard, JSON-reducer для notes)
  - `components/livekit/` — UI компоненты комнаты (control bar, settings, chat)
  - `hooks/` — React hooks (audio settings, camera, screen share, hotkeys)
  - `modules/whiteboard/` — Excalidraw-интеграция с коллаборацией
  - `modules/notes/` — shared notepad с экспортом в `.txt`

#### 6. Agent Server (Python бот)
- **Стек:** Python 3.11 + `livekit-agents` + `yt-dlp` + `ffmpeg`
- **Порт:** `8081`
- **Модульная архитектура:**
  - `src/bot.py` — основной оркестратор
  - `src/chat/` — чат-шлюз и парсер команд
  - `src/media/` — стриминг, очередь воспроизведения, резолвер URL
  - `src/llm/` — OpenRouter провайдер + промпты (AI-ассистент, поиск, плейлисты)
  - `src/memory/` — SQLite memory store (история разговоров)
- **Команды в чате** (без "!"):
  - `<url>` — воспроизвести ссылку (YouTube / Twitch / SoundCloud / Telegram)
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
  - `ai <вопрос>` / `jarvis <вопрос>` / `бот <вопрос>` — AI-ассистент
  - `playlist <описание>` / `плейлист <описание>` — AI генерирует плейлист
- **AI через OpenRouter:**
  - Установи `OPENROUTER_API_KEY` в env
  - Бот отвечает на вопросы, может искать и играть музыку по запросу
  - Генерирует плейлисты по описанию (например, "lofi для программирования")
  - Помнит контекст разговора (SQLite per room)

---

## Быстрый старт

### 1. Клон

```bash
git clone https://github.com/Gaigen/Voice-app.git
cd Voice-app
```

### 2. Зависимости

```bash
pnpm install
```

### 3. Настрой `.env`

```bash
cp .env.example .env
```

```env
# LiveKit ключи (в проде — ОБЯЗАТЕЛЬНО свои!)
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# URL для браузера (локально = localhost)
VITE_LIVEKIT_URL=ws://localhost:7880
VITE_TOKEN_ENDPOINT=http://localhost:4000/api/token

# Token Server
LIVEKIT_WS_URL=ws://livekit:7880
LIVEKIT_PUBLIC_WS_URL=ws://localhost:7880

# Опционально
# OPENROUTER_API_KEY=sk-or-v1-...
# AGENT_MEDIA_PROXY=http://proxy:8080
# AGENT_VIDEO_FPS=30
# AGENT_VIDEO_QUALITY=720p
```

### 4. Запуск (Docker — всё вместе)

```bash
# Собрать и запустить все сервисы
docker-compose up -d --build
```

### 5. Запуск (Dev — только инфра, фронт локально)

```bash
# 1. Инфраструктура в Docker
docker-compose -f docker-compose.dev.yml up -d

# 2. Веб-клиент локально
cd packages/web
pnpm dev          # http://localhost:1420

# 3. Десктоп локально
cd packages/desktop
pnpm tauri dev    # http://localhost:1421 + Tauri window
```

### 6. Открой приложение

| Сервис         | URL                         | Описание                        |
|----------------|-----------------------------|---------------------------------|
| Web Client     | `http://localhost:1420`     | Веб-интерфейс                   |
| Desktop Client | `pnpm tauri dev`            | Нативное окно                   |
| Token Server   | `http://localhost:4000`     | API выдачи токенов (`/health`)  |
| LiveKit WS     | `ws://localhost:7880`       | WebSocket (сигнализация)        |
| LiveKit Admin  | `http://localhost:7880`     | HTTP API LiveKit                |
| Agent Server   | `http://localhost:8081`     | YouTube/стриминг бот            |

---

## Горячие клавиши

### Веб (`packages/web`)

| Комбо        | Действие               |
|--------------|------------------------|
| `Ctrl + B`   | Открыть/закрыть Whiteboard |
| `Ctrl + N`   | Открыть/закрыть Notes      |

### Десктоп (`packages/desktop`)

| Комбо (дефолт)    | Действие               | Настраиваемый |
|-------------------|------------------------|---------------|
| `Ctrl + B`        | Whiteboard toggle      | ✅              |
| `Ctrl + N`        | Notes toggle           | ✅              |
| `Ctrl + M`        | Mute/unmute mic        | ✅              |
| `Ctrl + F`        | Full mute toggle       | ✅              |
| `MouseBack`       | (опционально)          | ✅              |

Настройка — в Settings → Hotkeys. Работает **глобально**, даже когда окно свёрнуто (Windows).

---

## Перенос на сервер (Production)

### 1. Смени ключи

В `.env` и `livekit/livekit.prod.yaml` — задай реальные ключи.

### 2. Публичный адрес

```env
# С HTTPS
VITE_LIVEKIT_URL=wss://example.com/livekit
VITE_TOKEN_ENDPOINT=https://example.com/api/token
LIVEKIT_WS_URL=wss://example.com/livekit

# Без HTTPS (по IP)
VITE_LIVEKIT_URL=ws://YOUR_SERVER_IP:7880
VITE_TOKEN_ENDPOINT=http://YOUR_SERVER_IP:4000/api/token
```

### 3. Пересобери фронтенд

```bash
docker-compose build --no-cache frontend
docker-compose up -d
```

### 4. Reverse proxy + HTTPS

| Маршрут         | Бэкенд           |
|-----------------|------------------|
| `/`             | web `:80`        |
| `/api/token`    | backend `:4000`  |
| `/livekit`      | livekit `:7880`  |

### 5. Фаервол

| Порт            | Назначение                      |
|-----------------|---------------------------------|
| `80` / `443`    | HTTP/HTTPS через reverse proxy  |
| `7880`          | WebSocket (LiveKit)             |
| `7881`          | TCP fallback (WebRTC)           |
| `7882/UDP`      | Медиа (WebRTC)                  |

### 6. TURN

Для пользователей за симметричным NAT — настрой TURN в `livekit.prod.yaml`.

---

## Структура проекта

```
Voice-app/
├── docker-compose.yml              # Production
├── docker-compose.dev.yml          # Development (LiveKit + Backend)
├── .env.example                    # Шаблон переменных
├── pnpm-workspace.yaml             # pnpm monorepo
│
├── backend/                        # Token Server (Node.js + tsx)
│   ├── Dockerfile
│   ├── src/index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── packages/
│   ├── web/                        # Веб-клиент (React + Vite)
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   └── ...
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── desktop/                    # Десктоп (Tauri v2)
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── src-tauri/              # Rust код
│   │   │   ├── src/main.rs         # Глобальные хоткеи, трей
│   │   │   └── tauri.conf.json
│   │   └── package.json
│   │
│   └── shared/                     # Shared компоненты
│       ├── src/
│       │   ├── floating/           # Плавающие окна (drag, resize)
│       │   ├── collab/             # Коллаб-синхронизация (Yjs, LiveKit)
│       │   ├── components/livekit/ # UI комнаты
│       │   ├── modules/
│       │   │   ├── whiteboard/     # Excalidraw + Yjs
│       │   │   └── notes/          # Shared notepad + export .txt
│       │   ├── hooks/              # React hooks
│       │   └── config.ts           # Shared константы
│       └── package.json
│
├── agent-server/                   # Python бот
│   ├── Dockerfile
│   ├── main.py                     # Entrypoint
│   ├── requirements.txt
│   └── src/
│       ├── bot.py                  # Оркестратор
│       ├── chat/                   # Чат-шлюз, парсер команд
│       ├── media/                  # Стриминг, очередь, резолвер
│       ├── llm/                    # OpenRouter AI
│       └── memory/                 # SQLite store
│
├── livekit/                        # Конфиги LiveKit
│   ├── livekit.prod.yaml
│   └── livekit.dev.yaml
│
└── readme-voice/
    └── README.md                   # Этот файл
```

---

## Troubleshooting

### Контейнеры не стартуют
```bash
docker-compose logs -f          # смотри логи
docker-compose ps               # статус
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

### Бот не отвечает / не стримит
- Проверь `OPENROUTER_API_KEY` (опционально, без него AI-фичи не работают, но стриминг да)
- Проверь `AGENT_MEDIA_PROXY` если yt-dlp не достаёт YouTube
- Логи: `docker-compose logs -f agent-server`

---

## Лицензия

MIT
