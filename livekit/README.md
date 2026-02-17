# LiveKit dev setup

Запуск локального LiveKit сервера:

1. Убедитесь, что бинарь `livekit-server.exe` находится в этой папке.
2. В корне репозитория выполните:
   ```powershell
   cd c:\tttaurrrri
   .\livekit\livekit-server.exe --dev --config .\livekit\livekit.dev.yaml
   ```
   Сервер поднимется на `ws://127.0.0.1:7880`.

> Альтернатива – использовать npm-скрипт из фронтенда:
> ```powershell
> cd frontend
> npm run livekit:server
> ```

Ключи `devkey/secret` предназначены только для локального тестирования. Для продакшена сгенерируйте свои ключи в LiveKit Cloud или через CLI.***


