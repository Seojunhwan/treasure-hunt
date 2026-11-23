import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { createGame, join, move, snapshot, start, reset, tick, isAdminToken, openTreasure, answerTreasure, treasureLayout, setQuestions } from './game.js';
import { loadQuestions, saveQuestions, validateQuestions, MAX_QUESTIONS } from './questions.js';
import { loadSettings, saveSettings, validateJoinUrl } from './settings.js';
import { TICK_MS, GAME_SECONDS_DEFAULT, MIN_QUESTIONS } from '../shared/constants.js';

const PORT = Number(process.env.PORT ?? 8080);
const GAME_SECONDS = Number(process.env.GAME_SECONDS ?? GAME_SECONDS_DEFAULT);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || randomBytes(9).toString('base64url');
const lan = Object.values(networkInterfaces()).flat().find((n) => n.family === 'IPv4' && !n.internal);
// Address players type or scan; behind the company proxy set PUBLIC_URL to the proxied address.
const PUBLIC_URL = process.env.PUBLIC_URL || `http://${lan?.address ?? 'localhost'}:${PORT}`;
// the big screen can override it (saved in data/settings.json); empty means PUBLIC_URL again
const settings = loadSettings();
const joinUrl = () => settings.joinUrl || PUBLIC_URL;

const app = express();
const query = (req) => (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
app.get('/admin', (req, res) => res.redirect('/admin.html' + query(req)));
app.get('/admin/questions', (req, res) => res.redirect('/questions.html' + query(req)));

// Question bank API for the admin page. The token travels in a header, never in the body.
const adminOnly = (req, res, next) => (isAdminToken(req.get('x-admin-token'), ADMIN_TOKEN) ? next() : res.status(401).json({ error: '관리자 토큰이 올바르지 않습니다' }));
app.get('/api/questions', adminOnly, (_req, res) => {
  res.json({ questions: game.questions, min: MIN_QUESTIONS, max: MAX_QUESTIONS, phase: game.phase });
});
app.put('/api/questions', adminOnly, express.json({ limit: '200kb' }), (req, res) => {
  if (game.phase === 'playing') return res.status(409).json({ error: '게임 중에는 문제를 저장할 수 없어요. 끝난 뒤나 리셋한 뒤에 저장해 주세요' });
  const v = validateQuestions(req.body?.questions);
  if (v.error) return res.status(400).json({ error: v.error });
  saveQuestions(v.list);
  setQuestions(game, v.list);
  broadcast();
  res.json({ questions: v.list });
});
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

const game = createGame(GAME_SECONDS * 1000, loadQuestions());
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
    const { token, id, name, x, y, z, ry, score } = player;
    ack({ token, id, name, x, y, z, ry, score, treasures: treasureLayout(game), tried: [...player.tried] });
  });

  socket.on('player:move', (msg) => {
    if (!player || player.socketId !== socket.id) return;
    if (!move(game, player, msg, Date.now())) socket.emit('player:correct', { x: player.x, z: player.z });
  });

  socket.on('treasure:open', (msg, ack) => {
    if (typeof ack !== 'function' || !player || player.socketId !== socket.id) return;
    const now = Date.now();
    // the tap carries the freshest position; it still goes through the speed check
    if (Number.isFinite(msg?.x) && Number.isFinite(msg?.z)) move(game, player, { x: msg.x, z: msg.z, y: msg.y, ry: player.ry }, now);
    ack(openTreasure(game, player, msg?.id, now));
  });

  socket.on('treasure:answer', (msg, ack) => {
    if (typeof ack !== 'function' || !player || player.socketId !== socket.id) return;
    const choice = msg?.choice === null ? null : Number.isInteger(msg?.choice) ? msg.choice : -1;
    const res = answerTreasure(game, player, msg?.id, choice, Date.now());
    ack({ ...res, score: player.score });
    if (res.result === 'ok') {
      socket.to('players').emit('treasure:found', { playerId: player.id, treasureId: msg.id }); // others see the pop + pick-up animation
      broadcast();
    }
  });

  socket.on('admin:auth', (token, ack) => {
    if (typeof ack !== 'function') return;
    if (!isAdminToken(token, ADMIN_TOKEN)) return ack({ error: '관리자 토큰이 올바르지 않습니다' });
    socket.data.admin = true;
    socket.join('admins');
    ack({ joinUrl: joinUrl(), defaultUrl: PUBLIC_URL, min: MIN_QUESTIONS });
  });

  socket.on('admin:url', (url, ack) => {
    if (!socket.data.admin || typeof ack !== 'function') return;
    const v = validateJoinUrl(url);
    if (v.error) return ack({ error: v.error });
    settings.joinUrl = v.url;
    saveSettings(settings);
    ack({ joinUrl: joinUrl() });
    io.to('admins').emit('admin:url', joinUrl()); // every open big screen redraws its QR
  });

  socket.on('admin:start', (ack) => {
    if (!socket.data.admin) return;
    const res = start(game, Date.now());
    if (typeof ack === 'function') ack(res);
    if (res.ok) { io.to('players').emit('game:treasures', treasureLayout(game)); broadcast(); }
  });

  socket.on('admin:reset', () => {
    if (!socket.data.admin) return;
    for (const p of reset(game)) if (p.online) io.to(p.socketId).emit('player:correct', { x: p.x, z: p.z });
    io.to('players').emit('game:treasures', []);
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
  console.log(`players: ${joinUrl()}`);
  console.log(`admin:   http://localhost:${PORT}/admin?token=${ADMIN_TOKEN}`);
  console.log(`game length: ${GAME_SECONDS}s`);
});
