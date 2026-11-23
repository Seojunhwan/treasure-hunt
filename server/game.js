import { randomUUID } from 'node:crypto';
import { MOVE_SPEED, NAME_MAX, SPEED_TOLERANCE } from '../shared/constants.js';
import { SPAWN } from '../shared/map.js';
import { clampToCircle } from '../shared/collision.js';

export function createGame() {
  return { phase: 'waiting', players: new Map() }; // players keyed by secret token
}

const TOKEN_RE = /^[0-9a-f-]{36}$/;

function uniqueName(state, name, token) {
  const taken = new Set([...state.players.values()].filter((p) => p.token !== token).map((p) => p.name));
  if (!taken.has(name)) return name;
  for (let i = 2; ; i++) if (!taken.has(name + i)) return name + i;
}

// Returns { player } or { error }. A known token gets its old player back (name, position, score).
export function join(state, { token, name }, now) {
  if (typeof token === 'string' && state.players.has(token)) return { player: state.players.get(token) };
  const clean = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  const len = [...clean].length;
  if (len < 1 || len > NAME_MAX) return { error: `닉네임은 1~${NAME_MAX}자로 입력해 주세요` };
  // Home-screen web apps on iOS don't share storage with Safari, so the same person arrives
  // without their token. Let them take back their name while it is offline and has no score.
  for (const p of state.players.values()) {
    if (p.name === clean && !p.online && p.score === 0) return { player: p };
  }
  const t = typeof token === 'string' && TOKEN_RE.test(token) ? token : randomUUID();
  const a = Math.random() * Math.PI * 2, r = Math.random() * (SPAWN.r - 1);
  const player = {
    token: t, id: randomUUID().slice(0, 8), name: uniqueName(state, clean, t),
    x: SPAWN.x + Math.cos(a) * r, z: SPAWN.z + Math.sin(a) * r, ry: 0,
    score: 0, scoredAt: 0, lastMoveAt: now, online: true,
  };
  state.players.set(t, player);
  return { player };
}

// Returns true if accepted. A rejected move means the client should snap back to the server position.
export function move(state, player, msg, now) {
  const { x, z, ry } = msg ?? {};
  if (![x, z, ry].every(Number.isFinite)) return false;
  const dt = Math.min((now - player.lastMoveAt) / 1000, 1);
  const allowed = MOVE_SPEED * SPEED_TOLERANCE * dt + 0.5; // +0.5 m absorbs network jitter
  if (Math.hypot(x - player.x, z - player.z) > allowed) return false;
  const p = state.phase === 'waiting' ? clampToCircle(x, z, SPAWN) : { x, z };
  Object.assign(player, p, { ry, lastMoveAt: now });
  return true;
}

export function snapshot(state) {
  const players = [];
  for (const p of state.players.values()) if (p.online) players.push({ id: p.id, name: p.name, x: p.x, z: p.z, ry: p.ry });
  return { phase: state.phase, players };
}
