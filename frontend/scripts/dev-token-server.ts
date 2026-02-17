import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { AccessToken } from 'livekit-server-sdk';
import dotenv from 'dotenv';

dotenv.config();

const {
  LIVEKIT_API_KEY = 'devkey',
  LIVEKIT_API_SECRET = 'secret',
  LIVEKIT_WS_URL = 'ws://127.0.0.1:7880',
  TOKEN_SERVER_PORT = '4000',
  TOKEN_SERVER_HOST = '127.0.0.1',
} = process.env;

const port = Number(TOKEN_SERVER_PORT);
const host = TOKEN_SERVER_HOST;

const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(body);
};

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, {});
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
        const { room, identity } = JSON.parse(data || '{}');
        if (!room || !identity) {
          sendJson(res, 400, { error: 'room and identity are required' });
          return;
        }

        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
          identity,
        });
        at.ttl = '10m';
        at.addGrant({
          room,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
        });

        const token = await at.toJwt();

        sendJson(res, 200, {
          token,
          wsUrl: LIVEKIT_WS_URL,
        });
      } catch (error) {
        console.error('token error', error);
        sendJson(res, 500, { error: 'failed to create token' });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'Not Found' });
});

server.listen(port, host, () => {
  console.log(`LiveKit dev token server on http://${host}:${port}`);
  console.log(`Using LiveKit URL ${LIVEKIT_WS_URL}`);
});

