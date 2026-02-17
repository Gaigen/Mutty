# LiveKit dev workflow

1. Скопируй `env.example` → `.env` в папке `frontend/` и при необходимости поменяй значения.
2. В одном терминале запусти LiveKit сервер:
   ```powershell
   cd c:\tttaurrrri\frontend
   npm run livekit:server
   ```
   или напрямую через `.\livekit\livekit-server.exe --dev --config ...`.
3. Во втором терминале стартуй dev token сервер:
   ```powershell
   cd c:\tttaurrrri\frontend
   npm run dev:token
   ```
4. В третьем – фронтенд:
   ```powershell
   cd c:\tttaurrrri\frontend
   npm run dev
   ```

Фронтенд отправляет POST-запрос на `VITE_TOKEN_ENDPOINT` (по умолчанию `http://127.0.0.1:4000/api/token`), получает JWT и URL LiveKit, после чего автоматически коннектится к комнате.  
Поля `LIVEKIT_API_KEY/LIVEKIT_API_SECRET` должны совпадать с ключами из `livekit/livekit.dev.yaml` или LiveKit Cloud.

