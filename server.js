'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { LobbyStore } = require('./server/lobby-store.js');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const store = new LobbyStore();

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const sendJson = (response, status, data) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(data));
};

const readJson = (request) => new Promise((resolve, reject) => {
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 64 * 1024) reject(new Error('body-too-large'));
  });
  request.on('end', () => {
    try {
      resolve(body ? JSON.parse(body) : {});
    } catch (_error) {
      reject(new Error('invalid-json'));
    }
  });
  request.on('error', reject);
});

const serveStatic = (request, response, pathname) => {
  const requested = pathname === '/' ? '/index.html' : pathname;
  let decoded;
  try {
    decoded = decodeURIComponent(requested);
  } catch (_error) {
    sendJson(response, 400, { error: 'invalid-path' });
    return;
  }
  const filePath = path.resolve(ROOT, `.${decoded}`);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
    sendJson(response, 403, { error: 'forbidden' });
    return;
  }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      sendJson(response, 404, { error: 'not-found' });
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(filePath).pipe(response);
  });
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (request.method === 'POST' && pathname === '/api/lobbies') {
      const created = store.create();
      sendJson(response, 201, { code: created.lobby.code, token: created.token, seat: created.seat });
      return;
    }

    const joinMatch = pathname.match(/^\/api\/lobbies\/([A-Za-z2-9]{1,12})\/join$/);
    if (request.method === 'POST' && joinMatch) {
      const joined = store.join(joinMatch[1]);
      if (!joined.ok) {
        sendJson(response, joined.status, { error: joined.reason });
        return;
      }
      sendJson(response, 200, { code: joined.lobby.code, token: joined.token, seat: joined.seat });
      return;
    }

    const eventsMatch = pathname.match(/^\/api\/lobbies\/([A-Za-z2-9]{1,12})\/events$/);
    if (request.method === 'GET' && eventsMatch) {
      const authenticated = store.authenticate(eventsMatch[1], url.searchParams.get('token'));
      if (!authenticated) {
        sendJson(response, 401, { error: 'unauthorized' });
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      store.subscribe(authenticated.lobby, authenticated.seat, response);
      request.on('close', () => store.unsubscribe(authenticated.lobby, authenticated.seat, response));
      return;
    }

    const commandMatch = pathname.match(/^\/api\/lobbies\/([A-Za-z2-9]{1,12})\/command$/);
    if (request.method === 'POST' && commandMatch) {
      const body = await readJson(request);
      const authenticated = store.authenticate(commandMatch[1], body.token);
      if (!authenticated) {
        sendJson(response, 401, { error: 'unauthorized' });
        return;
      }
      const result = store.command(authenticated.lobby, authenticated.seat, body.type, body.payload || {});
      sendJson(response, result.ok ? 200 : 409, result.ok ? { ok: true } : { error: result.reason });
      return;
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      serveStatic(request, response, pathname);
      return;
    }
    sendJson(response, 405, { error: 'method-not-allowed' });
  } catch (error) {
    const status = error.message === 'body-too-large' ? 413 : 400;
    sendJson(response, status, { error: error.message || 'bad-request' });
  }
});

const keepAliveTimer = setInterval(() => store.keepAlive(), 25000);
const cleanupTimer = setInterval(() => store.cleanup(), 15 * 60 * 1000);
keepAliveTimer.unref();
cleanupTimer.unref();

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`NAVAL COMMAND läuft auf http://localhost:${PORT}`);
  });
}

module.exports = { server, store };
