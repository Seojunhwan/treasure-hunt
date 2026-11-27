import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { MOVE_SPEED, NAME_MAX, SPEED_TOLERANCE, PICKUP_RADIUS, PICKUP_TOLERANCE, PICKUP_HEIGHT, RANKING_SIZE, MIN_QUESTIONS, QUIZ_SECONDS } from '../shared/constants.js';
import * as map from '../shared/map.js';
import { clampToCircle, treasureInSight, MIN_GROUND_Y } from '../shared/collision.js';

const { SPAWN, TREASURE_SPOTS } = map;
const QUIZ_MS = QUIZ_SECONDS * 1000;
const QUIZ_GRACE = 1500; // network slack on the 20 s answer window

// phase: waiting → optional opening → playing → ended
export function createGame(durationMs, questions = [], openingMs = 0, pickupSpots = null) {
  return {
    phase: 'waiting', durationMs, endsAt: 0, openingMs, openingEndsAt: 0,
    players: new Map(), // keyed by secret token
    questions, pickupSpots,
    noteHunt: pickupSpots?.some(({ kind }) => kind === 'note') ?? false,
    sharedTicketCount: pickupSpots?.filter(({ shared }) => shared).length ?? 0,
    ticketParticipants: new Set(),
    treasures: [],
  };
}

export function setQuestions(state, list) { state.questions = list; }

// Returns { ok: true } or { error } (shown to the admin).
export function start(state, now, rand = Math.random) {
  if (state.phase !== 'waiting') return { error: '대기 중일 때만 시작할 수 있어요' };
  if (!state.pickupSpots) {
    const n = state.questions.length;
    if (n < MIN_QUESTIONS) return { error: `문제가 최소 ${MIN_QUESTIONS}개 필요해요 (지금 ${n}개)` };
    if (n > TREASURE_SPOTS.length) return { error: `문제는 최대 ${TREASURE_SPOTS.length}개까지예요 (지금 ${n}개)` };
  }
  if (state.noteHunt) {
    for (const player of state.players.values()) if (player.online) state.ticketParticipants.add(player.id);
  }
  if (state.openingMs > 0) {
    state.phase = 'opening';
    state.openingEndsAt = now + state.openingMs;
  } else {
    beginHunt(state, now, rand);
  }
  return { ok: true };
}

function beginHunt(state, now, rand) {
  if (state.pickupSpots) {
    state.treasures = state.pickupSpots.map((spot, id) => ({ id, ...spot }));
  } else {
    const spots = TREASURE_SPOTS.map((spot) => [rand(), spot]).sort((a, b) => a[0] - b[0]);
    state.treasures = state.questions.map((q, id) => ({ id, ...spots[id][1], qid: q.id, foundBy: null }));
  }
  state.phase = 'playing';
  state.openingEndsAt = 0;
  state.endsAt = now + state.durationMs;
  for (const p of state.players.values()) { p.lastMoveAt = now; p.attempts = new Map(); p.tried = new Set(); } // leaving the plaza is not a teleport
}

export const treasureLayout = (state) => state.treasures.map(({ id, x, y, z, kind, cover }) => ({
  id, x, y, z,
  ...(kind ? { kind } : {}),
  ...(cover ? { cover } : {}),
}));

// Back to the plaza with zero scores. Returns the players whose position the server changed.
export function reset(state) {
  state.phase = 'waiting';
  state.endsAt = 0;
  state.openingEndsAt = 0;
  state.treasures = [];
  state.ticketParticipants.clear();
  for (const p of state.players.values()) {
    Object.assign(p, spawnPoint(), { y: 0, score: 0, scoredAt: 0, attempts: new Map(), tried: new Set() });
    p.collected.clear();
  }
  return [...state.players.values()];
}

export function tick(state, now, rand = Math.random) {
  if (state.phase === 'opening' && now >= state.openingEndsAt) {
    beginHunt(state, now, rand);
    return true;
  }
  if (state.phase === 'playing' && now >= state.endsAt) {
    state.phase = 'ended';
    return true;
  }
  return false;
}

export const remainingMs = (state, now) =>
  state.phase === 'playing' ? Math.max(0, state.endsAt - now) : state.phase === 'ended' ? 0 : state.durationMs;

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
  const accept = (player) => {
    if (state.noteHunt && (state.phase === 'opening' || state.phase === 'playing')) state.ticketParticipants.add(player.id);
    return { player };
  };
  if (typeof token === 'string' && state.players.has(token)) return accept(state.players.get(token));
  const clean = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  const len = [...clean].length;
  if (len < 1 || len > NAME_MAX) return { error: `닉네임은 1~${NAME_MAX}자로 입력해 주세요` };
  // Home-screen web apps on iOS don't share storage with Safari, so the same person arrives
  // without their token. Let them take back an offline name with no round progress.
  for (const p of state.players.values()) {
    if (p.name === clean && !p.online && p.score === 0) return accept(p);
  }
  const t = typeof token === 'string' && TOKEN_RE.test(token) ? token : randomUUID();
  const player = {
    token: t, id: randomUUID().slice(0, 8), name: uniqueName(state, clean, t),
    ...spawnPoint(), y: 0, ry: 0,
    score: 0, scoredAt: 0, lastMoveAt: now, online: true,
    attempts: new Map(), // treasure id -> when its quiz was opened
    tried: new Set(), // treasure ids this player answered wrong (no second chance)
    collected: new Set(),
  };
  state.players.set(t, player);
  return accept(player);
}

// Returns true if accepted. A rejected move means the client should snap back to the server position.
export function move(state, player, msg, now) {
  if (state.phase === 'ended') return false; // frozen after the whistle
  const { x, z, ry } = msg ?? {};
  const y = msg?.y ?? 0;
  if (![x, z, y, ry].every(Number.isFinite) || y < MIN_GROUND_Y || y > 10) return false;
  const dt = Math.min((now - player.lastMoveAt) / 1000, 1);
  const allowed = MOVE_SPEED * SPEED_TOLERANCE * dt + 0.5; // +0.5 m absorbs network jitter
  if (Math.hypot(x - player.x, z - player.z) > allowed) return false;
  const p = state.phase !== 'playing' ? clampToCircle(x, z, SPAWN) : { x, z };
  Object.assign(player, p, { y, ry, air: msg.air === true, lastMoveAt: now });
  return true;
}

const treasureOf = (state, id) => (Number.isInteger(id) ? state.treasures[id] : undefined);
const questionOf = (state, t) => state.questions.find((q) => q.id === t.qid);

function addPoint(player, now) {
  player.score += 1;
  player.scoredAt = now;
}

export function openTreasure(state, player, id, now) {
  const t = treasureOf(state, id);
  if (state.phase !== 'playing' || !t || (state.pickupSpots && now >= state.endsAt)) return { result: 'invalid' };
  if (player.collected.has(id)) return { result: 'collected', score: player.score };
  if (t.foundBy) return { result: 'taken' };
  if (player.tried.has(id)) return { result: 'tried' };
  if (Math.hypot(player.x - t.x, player.z - t.z) > PICKUP_RADIUS + PICKUP_TOLERANCE) return { result: 'far' };
  if (Math.abs((player.y ?? 0) - t.y) > PICKUP_HEIGHT) return { result: 'far' };
  if (!treasureInSight([player.x, (player.y ?? 0) + 1.2, player.z], t)) return { result: 'far' };
  if (state.pickupSpots) {
    if (t.shared) t.foundBy = player.id;
    player.collected.add(id);
    addPoint(player, now);
    return { result: 'ok', score: player.score, ...(t.shared ? { shared: true } : {}) };
  }
  if (!player.attempts.has(id)) player.attempts.set(id, now); // reopening keeps the original clock
  const left = QUIZ_MS - (now - player.attempts.get(id));
  if (left <= 0) { player.tried.add(id); return { result: 'tried' }; } // closed the app to dodge the timer
  const q = questionOf(state, t);
  return { result: 'quiz', question: q.q, choices: q.choices, remainingMs: left };
}

// Returns { result: 'ok' } | { result: 'wrong', answer, explain } | { result: 'taken' | 'tried' | 'invalid' }.
// choice = null means the timer ran out.
export function answerTreasure(state, player, id, choice, now) {
  const t = treasureOf(state, id);
  if (state.phase !== 'playing' || !t || !player.attempts.has(id)) return { result: 'invalid' };
  if (player.tried.has(id)) return { result: 'tried' };
  if (t.foundBy) return { result: 'taken' };
  const q = questionOf(state, t);
  const late = now - player.attempts.get(id) > QUIZ_MS + QUIZ_GRACE;
  if (!late && choice === q.answer) {
    t.foundBy = player.id;
    addPoint(player, now);
    if (state.treasures.every((x) => x.foundBy)) state.phase = 'ended';
    return { result: 'ok' };
  }
  player.tried.add(id); // one shot per gift; others can still take it
  return { result: 'wrong', answer: q.choices[q.answer], explain: q.explain, timeout: late || choice === null };
}

// Score high → low; on a tie whoever reached that score first ranks higher.
export function ranking(state) {
  return [...state.players.values()]
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || a.scoredAt - b.scoredAt)
    .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, score: p.score }));
}

export function ticketTotals(state) {
  return [...state.players.values()]
    .filter((player) => state.phase === 'waiting' ? player.online : state.ticketParticipants.has(player.id))
    .map(({ id, name, score }) => ({ id, name, tickets: score }))
    .sort((a, b) => b.tickets - a.tickets || a.name.localeCompare(b.name, 'ko'));
}

export function snapshot(state, now) {
  const players = [];
  for (const p of state.players.values()) if (p.online) players.push({ id: p.id, name: p.name, x: p.x, y: p.y ?? 0, z: p.z, ry: p.ry, air: !!p.air });
  return {
    phase: state.phase,
    remainingMs: remainingMs(state, now),
    openingRemainingMs: state.phase === 'opening' ? Math.max(0, state.openingEndsAt - now) : 0,
    players,
    found: state.treasures.filter((t) => t.foundBy).map((t) => t.id),
    treasureCount: state.treasures.length,
    pickupCount: state.pickupSpots?.length ?? 0,
    noteHunt: state.noteHunt,
    sharedTicketCount: state.sharedTicketCount,
    questionCount: state.questions.length,
    // full list once it's over so every phone can find its own rank
    ranking: state.phase === 'ended' ? ranking(state) : ranking(state).slice(0, RANKING_SIZE),
  };
}
