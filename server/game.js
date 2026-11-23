import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { MOVE_SPEED, NAME_MAX, SPEED_TOLERANCE, PICKUP_RADIUS, PICKUP_TOLERANCE, PICKUP_HEIGHT, RANKING_SIZE } from '../shared/constants.js';
import { SPAWN, TREASURES } from '../shared/map.js';
import { clampToCircle, lineOfSight } from '../shared/collision.js';

// phase: 'waiting' (stuck in spawn plaza) → 'playing' → 'ended'
export function createGame(durationMs) {
  return {
    phase: 'waiting', durationMs, endsAt: 0,
    players: new Map(), // keyed by secret token
    treasures: TREASURES.map((t) => ({ ...t, foundBy: null })),
  };
}

export function start(state, now) {
  if (state.phase !== 'waiting') return false;
  state.phase = 'playing';
  state.endsAt = now + state.durationMs;
  for (const p of state.players.values()) p.lastMoveAt = now; // leaving the plaza is not a teleport
  return true;
}

// Back to the plaza with zero scores. Returns the players whose position the server changed.
export function reset(state) {
  state.phase = 'waiting';
  state.endsAt = 0;
  for (const t of state.treasures) t.foundBy = null;
  for (const p of state.players.values()) {
    Object.assign(p, spawnPoint(), { y: 0, score: 0, scoredAt: 0 });
  }
  return [...state.players.values()];
}

export function tick(state, now) {
  if (state.phase === 'playing' && now >= state.endsAt) {
    state.phase = 'ended';
    return true;
  }
  return false;
}

export const remainingMs = (state, now) =>
  state.phase === 'playing' ? Math.max(0, state.endsAt - now) : state.phase === 'waiting' ? state.durationMs : 0;

// Constant-time compare so the admin token can't be guessed byte by byte.
export function isAdminToken(given, expected) {
  if (typeof given !== 'string') return false;
  const h = (s) => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(given), h(expected));
}

function spawnPoint() {
  const a = Math.random() * Math.PI * 2, r = Math.random() * (SPAWN.r - 1);
  return { x: SPAWN.x + Math.cos(a) * r, z: SPAWN.z + Math.sin(a) * r };
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
  const player = {
    token: t, id: randomUUID().slice(0, 8), name: uniqueName(state, clean, t),
    ...spawnPoint(), y: 0, ry: 0,
    score: 0, scoredAt: 0, lastMoveAt: now, online: true,
  };
  state.players.set(t, player);
  return { player };
}

// Returns true if accepted. A rejected move means the client should snap back to the server position.
export function move(state, player, msg, now) {
  if (state.phase === 'ended') return false; // frozen after the whistle
  const { x, z, ry } = msg ?? {};
  const y = msg?.y ?? 0;
  if (![x, z, y, ry].every(Number.isFinite) || y < 0 || y > 10) return false;
  const dt = Math.min((now - player.lastMoveAt) / 1000, 1);
  const allowed = MOVE_SPEED * SPEED_TOLERANCE * dt + 0.5; // +0.5 m absorbs network jitter
  if (Math.hypot(x - player.x, z - player.z) > allowed) return false;
  const p = state.phase === 'waiting' ? clampToCircle(x, z, SPAWN) : { x, z };
  Object.assign(player, p, { y, ry, lastMoveAt: now });
  return true;
}

// First request to arrive wins: Node handles one message at a time, so there is no race here.
// Returns 'ok' | 'taken' | 'far' | 'invalid'.
export function tryPickup(state, player, treasureId, now) {
  const t = state.treasures[treasureId];
  if (state.phase !== 'playing' || !t || !Number.isInteger(treasureId)) return 'invalid';
  if (t.foundBy) return 'taken';
  if (Math.hypot(player.x - t.x, player.z - t.z) > PICKUP_RADIUS + PICKUP_TOLERANCE) return 'far';
  if (Math.abs((player.y ?? 0) - t.y) > PICKUP_HEIGHT) return 'far';
  if (!lineOfSight([player.x, (player.y ?? 0) + 1.2, player.z], [t.x, t.y + 0.4, t.z])) return 'far'; // no grabbing through walls
  t.foundBy = player.id;
  player.score += 1;
  player.scoredAt = now; // earlier wins a tie
  if (state.treasures.every((x) => x.foundBy)) state.phase = 'ended';
  return 'ok';
}

// Score high → low; on a tie whoever reached that score first ranks higher.
export function ranking(state) {
  return [...state.players.values()]
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || a.scoredAt - b.scoredAt)
    .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, score: p.score }));
}

export function snapshot(state, now) {
  const players = [];
  for (const p of state.players.values()) if (p.online) players.push({ id: p.id, name: p.name, x: p.x, y: p.y ?? 0, z: p.z, ry: p.ry });
  return {
    phase: state.phase,
    remainingMs: remainingMs(state, now),
    players,
    found: state.treasures.filter((t) => t.foundBy).map((t) => t.id),
    // full list once it's over so every phone can find its own rank
    ranking: state.phase === 'ended' ? ranking(state) : ranking(state).slice(0, RANKING_SIZE),
  };
}
