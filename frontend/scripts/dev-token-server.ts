import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { AccessToken } from 'livekit-server-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Загружаем .env: сначала корень проекта, потом frontend/ (для npm run dev:token)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const {
  LIVEKIT_API_KEY = 'devkey',
  LIVEKIT_API_SECRET = 'secret',
  LIVEKIT_WS_URL = 'ws://127.0.0.1:7880',
  TOKEN_SERVER_PORT = '4000',
  TOKEN_SERVER_HOST = '127.0.0.1',
  TOKEN_CORS_ORIGINS = '',
  TOKEN_ROOM_MAX_LENGTH = '100',
  TOKEN_IDENTITY_MAX_LENGTH = '100',
  TOKEN_TTL = '10m',
} = process.env;

const port = Number(TOKEN_SERVER_PORT);
const host = TOKEN_SERVER_HOST;

const CORS_ORIGINS = TOKEN_CORS_ORIGINS
  ? TOKEN_CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['*'];

const ROOM_MAX_LENGTH = Number(TOKEN_ROOM_MAX_LENGTH) || 100;
const IDENTITY_MAX_LENGTH = Number(TOKEN_IDENTITY_MAX_LENGTH) || 100;
const ROOM_IDENTITY_REGEX = /^[a-zA-Z0-9_\-\u0400-\u04FF\s.]+$/;

function validateRoom(room: string): string | null {
  const s = (room || '').trim();
  if (!s || s.length > ROOM_MAX_LENGTH) return null;
  if (!ROOM_IDENTITY_REGEX.test(s)) return null;
  return s;
}

function validateIdentity(identity: string): string | null {
  const s = (identity || '').trim();
  if (!s || s.length > IDENTITY_MAX_LENGTH) return null;
  if (!ROOM_IDENTITY_REGEX.test(s)) return null;
  return s;
}

function getCorsOrigin(reqOrigin: string | undefined): string {
  if (CORS_ORIGINS.includes('*')) return '*';
  if (reqOrigin && CORS_ORIGINS.includes(reqOrigin)) return reqOrigin;
  return CORS_ORIGINS[0] || '*';
}

const sendJson = (res: ServerResponse, status: number, payload: unknown, reqOrigin?: string) => {
  const body = JSON.stringify(payload);
  const origin = getCorsOrigin(reqOrigin);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(body);
};

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const reqOrigin = req.headers.origin as string | undefined;

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, {}, reqOrigin);
    return;
  }

  const url = req.url ? new URL(req.url, `http://${req.headers.host}`) : null;

  if (req.method === 'POST' && url?.pathname === '/api/token') {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', async () => {
      try {
        const body = JSON.parse(data || '{}');
        const room = validateRoom(body.room);
        const identity = validateIdentity(body.identity);
        if (!room || !identity) {
          sendJson(res, 400, { error: 'room and identity are required and must be valid' }, reqOrigin);
          return;
        }

        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
          identity,
          name: identity,
        });
        at.ttl = TOKEN_TTL;
        at.addGrant({
          room,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
        });

        const token = await at.toJwt();

        sendJson(res, 200, { token, wsUrl: LIVEKIT_WS_URL }, reqOrigin);
      } catch (error) {
        console.error('token error', error);
        sendJson(res, 500, { error: 'failed to create token' }, reqOrigin);
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'Not Found' }, reqOrigin);
});

server.listen(port, host, () => {
  console.log(`LiveKit dev token server on http://${host}:${port}`);
  console.log(`Using LiveKit URL ${LIVEKIT_WS_URL}`);
});

