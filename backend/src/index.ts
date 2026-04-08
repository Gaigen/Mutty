import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { AccessToken, AgentDispatchClient } from 'livekit-server-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const {
  LIVEKIT_API_KEY = 'devkey',
  LIVEKIT_API_SECRET = 'secret',
  LIVEKIT_WS_URL = 'ws://127.0.0.1:7880',
  LIVEKIT_PUBLIC_WS_URL = 'ws://localhost:7880',
  LIVEKIT_API_URL: _apiUrl,
  TOKEN_CORS_ORIGINS = '',
  TOKEN_ROOM_MAX_LENGTH = '100',
  TOKEN_IDENTITY_MAX_LENGTH = '100',
  TOKEN_TTL = '10m',
} = process.env;

const LIVEKIT_API_URL =
  _apiUrl || (process.env.LIVEKIT_WS_URL || 'ws://127.0.0.1:7880').replace(/^ws/, 'http').replace(/^wss/, 'https');

const port = Number(4000);
const host = '0.0.0.0';

const CORS_ORIGINS = TOKEN_CORS_ORIGINS
  ? TOKEN_CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['*'];

const ROOM_MAX_LENGTH = Number(TOKEN_ROOM_MAX_LENGTH) || 100;
const IDENTITY_MAX_LENGTH = Number(TOKEN_IDENTITY_MAX_LENGTH) || 100;
const ROOM_IDENTITY_REGEX = /^[a-zA-Z0-9_\-\u0400-\u04FF\s.]+$/;

const ALLOWED_AVATARS = new Set([
  'bear',
  'shark',
  'hedgehog',
  'otter',
  'penguin',
  'skunk',
  'raccoon',
  'capybara',
  'frog',
  'hamster',
  'axsolotle',
  'fox',
  'monkey',
]);

function validateAvatar(avatar: unknown): string | null {
  if (avatar == null || avatar === '') return null;
  const s = String(avatar).trim().toLowerCase();
  if (!s || !ALLOWED_AVATARS.has(s)) return null;
  return s;
}

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

  if (req.method === 'GET' && url?.pathname === '/health') {
    sendJson(res, 200, { ok: true }, reqOrigin);
    return;
  }

  if (req.method === 'POST' && url?.pathname === '/api/agent/dispatch') {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', async () => {
      try {
        const body = JSON.parse(data || '{}');
        const room = validateRoom(body.room);
        if (!room) {
          sendJson(res, 400, { error: 'room is required and must be valid' }, reqOrigin);
          return;
        }
        const client = new AgentDispatchClient(LIVEKIT_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
        await client.createDispatch(room, 'youtube-bot', { metadata: '{}' });
        sendJson(res, 200, { status: 'dispatched', room }, reqOrigin);
      } catch (error) {
        console.error('dispatch error', error);
        sendJson(res, 500, { error: 'failed to dispatch agent' }, reqOrigin);
      }
    });
    return;
  }

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

        const avatar = validateAvatar(body.avatar);
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
          identity,
          name: identity,
          metadata: avatar ? JSON.stringify({ avatar }) : undefined,
        });
        at.ttl = TOKEN_TTL;
        at.addGrant({
          room,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
        });

        const token = await at.toJwt();

        sendJson(res, 200, { token, wsUrl: LIVEKIT_PUBLIC_WS_URL }, reqOrigin);
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
  console.log(`Backend (token server) on http://${host}:${port}`);
  console.log(`Using LiveKit URL ${LIVEKIT_WS_URL}`);
  console.log(`Using LiveKit Public URL ${LIVEKIT_PUBLIC_WS_URL}`);
});
