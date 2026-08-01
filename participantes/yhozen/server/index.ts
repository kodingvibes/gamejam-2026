import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { attachWebSocketServer, MULTIPLAYER_PATH } from './room-server.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argumentsList = process.argv.slice(2);
const isProduction = argumentsList.includes('--production');

function option(name: string, fallback: string): string {
  const index = argumentsList.indexOf(name);
  return index >= 0 && argumentsList[index + 1] ? argumentsList[index + 1] : fallback;
}

const host = option('--host', '0.0.0.0');
const port = Number(option('--port', '3000'));
if (!Number.isInteger(port) || port <= 0 || port > 65_535) throw new Error('Invalid --port value.');

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
};

let vite: ViteDevServer | null = null;

const httpServer = createServer(async (request, response) => {
  if (!isProduction && vite) {
    vite.middlewares(request, response, () => {
      response.statusCode = 404;
      response.end('Not found');
    });
    return;
  }

  const distRoot = join(projectRoot, 'dist');
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const normalizedPath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = join(distRoot, normalizedPath === '/' ? 'index.html' : normalizedPath);
  if (!filePath.startsWith(distRoot)) filePath = join(distRoot, 'index.html');
  try {
    const file = await stat(filePath);
    if (file.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    filePath = join(distRoot, 'index.html');
  }
  response.setHeader('Content-Type', mimeTypes[extname(filePath)] ?? 'application/octet-stream');
  createReadStream(filePath).on('error', () => {
    response.statusCode = 404;
    response.end('Not found');
  }).pipe(response);
});

if (!isProduction) {
  vite = await createViteServer({
    root: projectRoot,
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server: httpServer } },
  });
}

const webSocketServer = new WebSocketServer({ noServer: true });
httpServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (pathname !== MULTIPLAYER_PATH) return;
  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit('connection', webSocket, request);
  });
});
const rooms = attachWebSocketServer(webSocketServer);
rooms.startSnapshotLoop();

httpServer.listen(port, host, () => {
  console.log(`Skatefire ${isProduction ? 'production' : 'development'} server listening at http://${host}:${port}`);
});

function shutdown(): void {
  rooms.destroy();
  webSocketServer.close();
  void vite?.close();
  httpServer.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
