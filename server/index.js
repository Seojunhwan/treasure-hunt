import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { createGame, join, move, snapshot, start, reset, tick, isAdminToken, tryPickup } from './game.js';
import { TICK_MS, GAME_SECONDS_DEFAULT } from '../shared/constants.js';

const PORT = Number(process.env.PORT ?? 8080);
const GAME_SECONDS = Number(process.env.GAME_SECONDS ?? GAME_SECONDS_DEFAULT);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || randomBytes(9).toString('base64url');
const lan = Object.values(networkInterfaces()).flat().find((n) => n.family === 'IPv4' && !n.internal);
// Address players type or scan; behind the company proxy set PUBLIC_URL to the proxied address.
const PUBLIC_URL = process.env.PUBLIC_URL || `http://${lan?.address ?? 'localhost'}:${PORT}`;

const app = express();
app.get('/admin', (req, res) => res.redirect('/admin.html' + (req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '')));
const httpServer = createServer(app);
// destroyUpgrade off: in dev, Vite's HMR websocket shares this HTTP server
const io = new Server(httpServer, { destroyUpgrade: false });

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(fileURLToPath(new URL('../dist', import.meta.url))));
} else {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({ server: { middlewareMode: true, hmr: { server: httpServer } }, appType: 'mpa' });
  app.use(vite.middlewares);
}

const game = createGame(GAME_SECONDS * 1000);
const broadcast = () => io.to(['players', 'admins']).emit('world:state', snapshot(game, Date.now()));

io.on('connection', (socket) => {
  let player = null;

  socket.on('player:join', (msg, ack) => {
    if (typeof ack !== 'function') return;
    const res = join(game, msg ?? {}, Date.now());
    if (res.error) return ack({ error: res.error });
    player = res.player;
    player.online = true;
    player.socketId = socket.id; // a newer tab with the same token takes over
    player.lastMoveAt = Date.now();
    socket.join('players');
    const { token, id, name, x, z, ry, score } = player;
    ack({ token, id, name, x, z, ry, score });
  });

  socket.on('player:move', (msg) => {
    if (!player || player.socketId !== socket.id) return;
    if (!move(game, player, msg, Date.now())) socket.emit('player:correct', { x: player.x, z: player.z });
  });

  socket.on('treasure:pickup', (msg, ack) => {
    if (typeof ack !== 'function' || !player || player.socketId !== socket.id) return;
    const now = Date.now();
    // the tap carries the freshest position; it still goes through the speed check
    if (Number.isFinite(msg?.x) && Number.isFinite(msg?.z)) move(game, player, { x: msg.x, z: msg.z, ry: player.ry }, now);
    const result = tryPickup(game, player, msg?.id, now);
    ack({ result, score: player.score });
    if (result === 'ok') broadcast();
  });

  socket.on('admin:auth', (token, ack) => {
    if (typeof ack !== 'function') return;
    if (!isAdminToken(token, ADMIN_TOKEN)) return ack({ error: '관리자 토큰이 올바르지 않습니다' });
    socket.data.admin = true;
    socket.join('admins');
    ack({ joinUrl: PUBLIC_URL });
  });

  socket.on('admin:start', () => {
    if (!socket.data.admin) return;
    if (start(game, Date.now())) broadcast();
  });

  socket.on('admin:reset', () => {
    if (!socket.data.admin) return;
    for (const p of reset(game)) if (p.online) io.to(p.socketId).emit('player:correct', { x: p.x, z: p.z });
    broadcast();
  });

  socket.on('net:ping', (ack) => typeof ack === 'function' && ack());

  socket.on('disconnect', () => {
    if (player && player.socketId === socket.id) player.online = false;
  });
});

setInterval(() => {
  tick(game, Date.now());
  broadcast();
}, TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`players: ${PUBLIC_URL}`);
  console.log(`admin:   http://localhost:${PORT}/admin?token=${ADMIN_TOKEN}`);
  console.log(`game length: ${GAME_SECONDS}s`);
});
