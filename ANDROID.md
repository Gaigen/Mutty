# Mutty на Android — план сборки

Рабочий документ. Цель — довести Tauri-приложение до устанавливаемого APK,
в котором работает голосовая связь.

## Definition of Done

Пользователь скачивает APK из GitHub Release, ставит на телефон, запускает и:

1. Видит приветственный экран, вводит **адрес сервера, ник, комнату, аватар**
2. Успешно подключается к серверу (десктоп и web с ним работают)
3. **Говорит голосом** со вторым участником в комнате
4. Может **включить камеру**
5. Может **пользоваться чатом**

Не входит в DoD: шаринг экрана (опционально, скорее всего не заведётся),
whiteboard, Notes, плавающие окна, глобальные хоткеи, трей.

## Принятые решения

| Вопрос | Решение |
|---|---|
| Архитектура | Только `aarch64` (arm64-v8a). `armv7` добавим, если понадобится |
| Ветка | `share` — изменения носят **аддитивный** характер, десктоп не ломаем |
| Доставка APK | GitHub Release через `gh` (согласовано) |
| Тип сборки | Debug APK — самоподписан, ставится сайдлоадом. Release без подписи не установится |
| JDK | Temurin 17 тарболом (apt в образе пуст) |
| NDK | r27c, прямой zip |

## Целевая матрица устройств

| | Значение |
|---|---|
| Эталон совместимости | Pixel 3 (2018) — Android 9, API 28 |
| Фактический тест | Poco X5 — Android 13, API 33, Snapdragon 695 → **arm64-v8a** ✅ |
| `minSdk` | 24 (дефолт Tauri) — не поднимаем, покрывает и Android 7+ |
| `compileSdk` / `targetSdk` | 34 |
| ABI | `arm64-v8a` только |

Poco X5 подтверждает выбор `aarch64` — Snapdragon 695 64-битный.

**Что следует из уровней API:**

- **API 28+ (эталонный Pixel 3 и выше)** — cleartext-трафик заблокирован по умолчанию.
  Значит флаг из этапа 2 нужен для **всего** поддерживаемого диапазона, а не только для новых устройств.
- **API 33 (Android 13, ваш Poco X5)** — уведомления требуют **runtime-разрешения
  `POST_NOTIFICATIONS`**. Приложение использует notification-плагин, поэтому без этого
  разрешения уведомления о сообщениях в чате молча не появятся именно на вашем устройстве.
- **API 33** — гранулярные медиа-разрешения. Понадобятся, только если нужен выбор файлов
  для вложений в чат (текстовый чат из DoD работает без них).

## Ресурсы

Загрузка ~1.41 GB, тулчейн на диске ~4.5 GB, полный рабочий след ~9–12 GB
(с cargo registry и `target/`). Свободно 74 GB — запас шестикратный.

---

## Этапы

### Этап 0 — Тулчейн
Rust + таргет `aarch64-linux-android`, Temurin JDK 17, Android SDK
(cmdline-tools, platform-tools, platform 34, build-tools 34), NDK r27c.

- **Верификация:** `cargo tauri android init` отрабатывает, появляется `src-tauri/gen/android`
- **Статус:** ✅ **готово.** Rust 1.98.1, JDK 17.0.13, SDK (platform 34, build-tools 34,
  platform-tools), NDK 27.2.12479018. Проект сгенерирован, `EXIT=0`. Тулчейн 3.4 GB.
- **Грабли 1:** Tauri CLI 2.10.1 ищет `$ANDROID_HOME/cmdline-tools/bin/sdkmanager`,
  а стандартная установка кладёт его в `cmdline-tools/latest/bin`. Без симлинка init
  падает с бесполезным «Skipping Android Studio command line tools installation».
  Решено симлинками `cmdline-tools/bin → latest/bin` и `sdk/ndk/27.2.12479018 → NDK`.
- **Грабли 2 (дорогие):** NDK **нельзя** распаковывать через `python3 -m zipfile` —
  модуль не восстанавливает симлинки, и `clang` превращается в 8-байтовый текстовый
  файл со строкой `clang-18`. Линковка падает на `clang-18: command not found` уже
  после успешной компиляции всех объектных файлов, из-за чего ошибка выглядит
  обманчиво. В архиве 35 симлинков. Распаковывать **только** `unzip`
  (`sudo apt-get install -y unzip`) либо распаковщиком, читающим Unix-режим
  из `external_attr`.
- **Замечание по apt:** источники в этом образе лежат в
  `/etc/apt/sources.list.d/debian.sources` (формат deb822), `/etc/apt/sources.list`
  пуст. `apt-cache search` до `apt-get update` возвращает пустоту — apt рабочий.

### Этап 1 — Реструктуризация Rust (аддитивно)
Android собирает **cdylib из `lib.rs`**, а не бинарник из `main.rs`. Сейчас
`lib.rs` — пустая заглушка, вся логика (528 строк) в `main.rs`, поэтому на
Android приложение стартует без плагинов и команд и падает на первом `invoke`.

Подход: общую регистрацию плагинов/команд вынести в разделяемую функцию,
десктопное (трей, поллер хоткеев, window-state, autostart, WebView2-аргументы)
закрыть `#[cfg(desktop)]`. В `Cargo.toml` увести `tauri-plugin-window-state` и
`tauri-plugin-autostart` под `[target.'cfg(desktop)'.dependencies]`, фичу
`tray-icon` — тоже. Общими остаются `store` (на нём держится адрес сервера),
`notification`, `dialog`, `shell`. Разделить `capabilities` на desktop и android.

- **Верификация:**
  - `pnpm build:desktop` (tsc + vite) остаётся зелёным — эталон зафиксирован, exit 0
  - `cargo tree` под Windows-таргет: `window-state`, `autostart`, `tray-icon` на месте
  - `cargo tree` под `aarch64-linux-android`: их ноль
  - `cargo check --lib --target aarch64-linux-android` проходит
- **Ограничение окружения:** десктопную Rust-сборку здесь проверить **нельзя** —
  Linux-сборка Tauri требует GTK/WebKit dev-библиотек, `pkg-config` отсутствует,
  apt в образе пуст. Поэтому корректность манифеста проверяется разрешением графа
  зависимостей под каждую платформу, а не компиляцией. Windows-сборку десктопа
  надо будет прогнать на вашей стороне.
- **Статус:** ✅ **готово.** `cargo check --lib --target aarch64-linux-android` → `EXIT=0`.
- **Что сделано:**
  - `src/lib.rs` — реальная точка входа под Android, целиком под `#[cfg(mobile)]`.
    Плагины shell/notification/dialog/store + шесть команд, из которых desktop-only
    зарегистрированы как no-op заглушки. `main.rs` **не тронут вообще**.
  - `Cargo.toml` — `window-state`, `autostart` и фича `tray-icon` уведены под
    `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`.
  - `capabilities/default.json` — добавлено `"platforms": ["windows","macOS","linux"]`.
  - `capabilities/mobile.json` — новый файл для android/iOS без несуществующих permissions.
    Без этого сборка падала на `Permission window-state:default not found`.
  - Значения `platforms` сверены с `gen/schemas/*.json`.

### Этап 2 — Android-проект и манифест

`AndroidManifest.xml`:

| Разрешение | Зачем |
|---|---|
| `INTERNET` | сеть |
| `ACCESS_NETWORK_STATE` | состояние сети для WebRTC |
| `RECORD_AUDIO` | микрофон — **ядро DoD** |
| `MODIFY_AUDIO_SETTINGS` | режим звонка, маршрутизация звука |
| `CAMERA` | камера — в DoD |
| `POST_NOTIFICATIONS` | Android 13+, иначе уведомления чата молча не работают на Poco X5 |

Плюс `usesCleartextTraffic` / `networkSecurityConfig` — иначе `ws://IP:7880` и
`http://` молча не подключатся (API 28+ режет незашифрованный трафик).
Нужно всему поддерживаемому диапазону, включая эталонный Pixel 3.

- **Верификация:** собирается debug-APK; `aapt dump badging` показывает permissions и ABI
- **Статус:** ✅ манифест дополнен (`gen/android/app/src/main/AndroidManifest.xml`).
  `usesCleartextTraffic` в debug-сборке уже `true` — отдельная правка не потребовалась.
  Микрофон и камера объявлены `uses-feature ... required="false"`, чтобы приложение
  оставалось устанавливаемым на устройствах без них.

### Этап 3 — Мост разрешений WebView — ✅ РИСК СНЯТ

**Патчить Kotlin не нужно.** wry 0.54.4 уже реализует всё необходимое в
`src/android/kotlin/RustWebChromeClient.kt`:

- `onPermissionRequest` маппит `android.webkit.resource.AUDIO_CAPTURE` →
  `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS`, а `VIDEO_CAPTURE` → `CAMERA`
- запускает runtime-запрос через `ActivityResultContracts.RequestMultiplePermissions`
- по результату вызывает `request.grant(...)` либо `request.deny()`
- `onShowFileChooser` реализован полностью → вложения в чате должны работать
- `PermissionHelper.kt` проверяет и наличие разрешения, и его объявление в манифесте

**Критическая зависимость:** всё это работает, только если разрешения объявлены
в `AndroidManifest.xml` — иначе системный запрос отклоняется автоматически.
Это сделано на этапе 2, и именно поэтому этап 2 обязателен для DoD.

`MainActivity.kt` остаётся нетронутым.

- **Верификация:** остаётся за устройством, но статический риск снят
- **Статус:** ✅ по коду готово, ждёт проверки на устройстве

### Этап 4 — Фронтенд под Android

**Аудит проведён заранее.** Все вызовы `invoke` в десктоп-фронтенде:

| Вызов | Место | Обработка ошибки |
|---|---|---|
| `update_global_hotkeys` | `useHotkeySettings.ts:52` (на монтировании) | ⚠️ `try` охватывает только `import()`, сам `invoke` внутри `.then()` → **unhandled rejection** |
| `update_global_hotkeys` | `useHotkeySettings.ts:80` | ✅ await в try/catch |
| `set_tray_state` | `TrayStateSync.tsx:30` (при входе в комнату) | ✅ await в try/catch |
| `set_minimize_to_tray` | `useAppSettings.ts:59` | ✅ await в try/catch |
| `plugin:autostart\|enable/disable` | `useAppSettings.ts:38,40` | ✅ await в try/catch |
| `save_file` | `TauriDownloadProvider.tsx:12` | проверить при скачивании файла |

**Вывод:** если зарегистрировать в `lib.rs` no-op заглушки для `update_global_hotkeys`,
`set_tray_state`, `set_minimize_to_tray`, `get_minimize_to_tray`, `save_file` — путь DoD
не потребует правок фронтенда вообще. Остаётся косметика (кнопка шаринга экрана,
вкладка хоткеев), которая DoD не блокирует.

**Переключатель secure / non-secure (запрошен пользователем).**

Проблема, которую он решает: `normalizeBaseUrl` (`tauri-config.ts:45-51`) жёстко
подставляет `https://`, если схема не указана, а `wsUrl` вообще приходит **с сервера**
(бэкенд отдаёт `LIVEKIT_PUBLIC_WS_URL`, `backend/src/index.ts:169`). То есть клиент
сейчас не может выбрать схему — ни HTTP, ни WebSocket. На месте пробовать нечем.

Дизайн (аддитивный, web не затрагивается):

1. Новый ключ **обязательно в `LS_KEYS`** (`shared/src/config.ts`) — иначе на десктопе
   он будет молча сбрасываться при каждом старте: синхронный `storage.get()` читает
   только предзагруженный кеш Tauri Store, а предзагружаются ровно значения `LS_KEYS`.
   Это та же причина, по которой чинили `participant-volumes` и `theme`.
2. `TauriConfig.normalizeBaseUrl` выбирает `http://` или `https://` по флагу вместо хардкода.
3. В `ConfigAdapter` добавляется **опциональный** метод `normalizeWsUrl?(url): string`.
   Desktop его реализует и переписывает схему `ws://` ↔ `wss://` в URL, пришедшем
   с сервера. Web метод не реализует → `LiveKitRoom` использует `wsUrl` как есть,
   поведение веба не меняется вообще.
4. UI — radio group в `ServerUrlSection.tsx` (десктопный экран ввода адреса,
   он же первый экран DoD на Android).

Дополнительно: если выбран non-secure, `usesCleartextTraffic` обязателен — в debug-сборке
он уже `true` (`gen/android/app/build.gradle.kts:29`), так что для нашего APK вопрос закрыт.

- **Верификация:** `tsc` + сборка; прогон `normalizeBaseUrl` на реальных URL
- **Статус:** ✅ переключатель реализован, `tsc` чист в обоих пакетах (desktop + web).
  - `shared/src/config.ts` — ключ `serverSecure` добавлен в `LS_KEYS`
  - `shared/src/platform/config.ts` — опциональные `normalizeWsUrl` / `isSecure` / `setSecure`
  - `desktop/src/platform/tauri-config.ts` — реализация; явная схема во вводе
    имеет приоритет над тумблером; дефолт `secure = true` (прежнее поведение)
  - `shared/.../LiveKitRoom.tsx` — `config.normalizeWsUrl?.(raw) ?? raw`; веб не затронут
  - `desktop/src/components/ServerUrlSection.tsx` — radio group в обеих формах
  - Заглушки команд не понадобились для правок фронтенда — они уже в `lib.rs`

### Этап 5 — Доставка
Debug-APK публикуется GitHub Release через `gh`.

- **Верификация:** пользователь ставит и проходит DoD
- **Статус:** ⬜ не начат

### Этап 6 — Итерации
Почти наверняка нужен минимум один круг. Решающий инструмент — `adb logcat` со стороны пользователя.

- **Статус:** ⬜ не начат

---

## Что нельзя проверить в этом окружении

- **Живое устройство.** Эмулятор не поднять: KVM в контейнере недоступен,
  ARM-эмуляция неработоспособно медленная. Этапы 3, 5, 6 — совместные.
- **Поведение WebRTC** в конкретной версии System WebView на устройстве пользователя.

## Известные ограничения на Android (по итогам аудита кода)

| Функция | Причина |
|---|---|
| Шаринг экрана | `getDisplayMedia` в Android WebView отсутствует |
| Глобальные хоткеи | Поллер целиком под `#[cfg(target_os = "windows")]` |
| Трей, autostart, window-state | Desktop-only |
| `save_file` | Пишет по произвольному пути — не пройдёт scoped storage |
| Ссылки-приглашения | `getWebAppUrl()` вернёт `tauri://localhost` |
| Перетаскивание плавающих окон | В `floating/` только mouse-события, ноль `onTouch`/`onPointer`; WebView синтезирует mouse на тап, но не в течение жеста |
