// Fake players for load testing: node scripts/loadtest.js --url http://localhost:8080 --bots 45 --seconds 60
import { parseArgs } from 'node:util';
import { io } from 'socket.io-client';
import { MOVE_SPEED, PLAYER_RADIUS, TICK_MS } from '../shared/constants.js';
import { resolveCollision, clampToCircle } from '../shared/collision.js';
import { SPAWN } from '../shared/map.js';

const { values: a } = parseArgs({ options: {
  url: { type: 'string', default: 'http://localhost:8080' },
  bots: { type: 'string', default: '45' },
  seconds: { type: 'string', default: '60' },
} });
const N = Number(a.bots), SECONDS = Number(a.seconds);

const rtts = [];
let maxGap = 0, joined = 0, corrections = 0, disconnects = 0;

function bot(i) {
  const s = io(a.url, { transports: ['websocket'], forceNew: true });
  let pos = null, dir = Math.random() * Math.PI * 2, phase = 'waiting', lastState = 0;
  s.on('disconnect', () => disconnects++);
  s.on('player:correct', (p) => { corrections++; pos = p; });
  s.on('world:state', (st) => {
    const now = performance.now();
    if (lastState) maxGap = Math.max(maxGap, now - lastState);
    lastState = now;
    phase = st.phase;
  });
  s.emit('player:join', { name: 'bot' + i }, (r) => {
    if (r.error) return console.error('join failed', r.error);
    joined++;
    pos = { x: r.x, z: r.z };
    setInterval(() => {
      if (Math.random() < 0.05) dir += (Math.random() - 0.5) * 2;
      const step = (MOVE_SPEED * TICK_MS) / 1000;
      let p = resolveCollision(pos.x + Math.sin(dir) * step, pos.z + Math.cos(dir) * step, PLAYER_RADIUS);
      if (phase === 'waiting') p = clampToCircle(p.x, p.z, SPAWN);
      if (Math.abs(p.x - pos.x) + Math.abs(p.z - pos.z) < step * 0.5) dir += Math.PI / 2; // blocked: turn
      pos = p;
      s.volatile.emit('player:move', { x: p.x, z: p.z, ry: dir });
    }, TICK_MS);
    setInterval(() => {
      const t = performance.now();
      s.emit('net:ping', () => rtts.push(performance.now() - t));
    }, 1000);
  });
  return s;
}

const sockets = Array.from({ length: N }, (_, i) => bot(i));

function report() {
  const sorted = [...rtts].sort((x, y) => x - y);
  const avg = sorted.reduce((s, v) => s + v, 0) / (sorted.length || 1);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  console.log(`joined=${joined}/${N} rtt avg=${avg.toFixed(1)}ms p95=${p95.toFixed(1)}ms max=${(sorted.at(-1) ?? 0).toFixed(1)}ms  snapshot max gap=${maxGap.toFixed(0)}ms  corrections=${corrections} disconnects=${disconnects}`);
  rtts.length = 0; maxGap = 0;
}
const iv = setInterval(report, 5000);
setTimeout(() => { clearInterval(iv); report(); sockets.forEach((s) => s.close()); process.exit(0); }, SECONDS * 1000);
