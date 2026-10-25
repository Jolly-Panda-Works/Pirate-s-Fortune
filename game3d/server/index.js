/**
 * Local Colyseus game server for the 3D build.
 * ws://localhost:2567 (override with GAME_PORT). In production mode it also
 * serves the built client from ../dist so one process runs everything.
 */

import http from 'node:http';
import path from 'node:path';
import { existsSync, createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { PirateRoom } from './PirateRoom.js';
import { warmUp } from './engineHost.js';

const PORT = Number(process.env.GAME_PORT ?? 2567);
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
};

async function handleHttp(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/rooms') {
    const rooms = await matchMaker.query({ name: 'pirate', private: false, locked: false });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(rooms.map((r) => ({
      roomId: r.roomId,
      clients: r.clients,
      maxClients: r.maxClients,
      host: r.metadata?.host ?? '',
    }))));
    return;
  }

  if (existsSync(DIST)) {
    let file = path.join(DIST, decodeURIComponent(url.pathname));
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end();
}

warmUp();

const httpServer = http.createServer((req, res) => {
  // Colyseus' matchmaking routes (/matchmake/*) are attached by the transport.
  if (req.url.startsWith('/matchmake')) return;
  handleHttp(req, res).catch((err) => {
    res.writeHead(500);
    res.end(String(err));
  });
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('pirate', PirateRoom).filterBy(['mode']);

gameServer.listen(PORT).then(() => {
  console.log(`⚓ Pirate's Fortune server listening on ws://localhost:${PORT}`);
});
