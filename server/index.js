import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { createGame, join, move, snapshot } from './game.js';
import { TICK_MS } from '../shared/constants.js';

const PORT = Number(process.env.PORT ?? 8080);
const app = express();
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

const game = createGame();

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

  socket.on('net:ping', (ack) => typeof ack === 'function' && ack());

  socket.on('disconnect', () => {
    if (player && player.socketId === socket.id) player.online = false;
  });
});

setInterval(() => io.to('players').emit('world:state', snapshot(game)), TICK_MS);

httpServer.listen(PORT, () => {
  const lan = Object.values(networkInterfaces()).flat().find((n) => n.family === 'IPv4' && !n.internal);
  console.log(`http://localhost:${PORT}` + (lan ? `  (phone on same Wi-Fi: http://${lan.address}:${PORT})` : ''));
});
