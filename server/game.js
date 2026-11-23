import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { MOVE_SPEED, NAME_MAX, SPEED_TOLERANCE, PICKUP_RADIUS, PICKUP_TOLERANCE, PICKUP_HEIGHT, RANKING_SIZE, MIN_QUESTIONS, QUIZ_SECONDS } from '../shared/constants.js';
import { SPAWN, TREASURE_SPOTS } from '../shared/map.js';
import { clampToCircle, lineOfSight } from '../shared/collision.js';

const QUIZ_MS = QUIZ_SECONDS * 1000;
const QUIZ_GRACE = 1500; // network slack on the 20 s answer window

// phase: 'waiting' (stuck in spawn plaza) → 'playing' → 'ended'
// One gift per quiz question, laid out on a random subset of the hiding spots when the game starts.
export function createGame(durationMs, questions = []) {
  return {
    phase: 'waiting', durationMs, endsAt: 0,
    players: new Map(), // keyed by secret token
    questions,
    treasures: [],
  };
}

export function setQuestions(state, list) { state.questions = list; }

// Returns { ok: true } or { error } (shown to the admin).
export function start(state, now, rand = Math.random) {
  if (state.phase !== 'waiting') return { error: '대기 중일 때만 시작할 수 있어요' };
  const n = state.questions.length;
  if (n < MIN_QUESTIONS) return { error: `문제가 최소 ${MIN_QUESTIONS}개 필요해요 (지금 ${n}개)` };
  if (n > TREASURE_SPOTS.length) return { error: `문제는 최대 ${TREASURE_SPOTS.length}개까지예요 (지금 ${n}개)` };
  const spots = TREASURE_SPOTS.map((_, i) => [rand(), i]).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, i]) => TREASURE_SPOTS[i]);
  state.treasures = state.questions.map((q, id) => ({ id, ...spots[id], qid: q.id, foundBy: null }));
  state.phase = 'playing';
  state.endsAt = now + state.durationMs;
  for (const p of state.players.values()) { p.lastMoveAt = now; p.attempts = new Map(); p.tried = new Set(); } // leaving the plaza is not a teleport
  return { ok: true };
}

export const treasureLayout = (state) => state.treasures.map(({ id, x, y, z }) => ({ id, x, y, z }));

// Back to the plaza with zero scores. Returns the players whose position the server changed.
export function reset(state) {
  state.phase = 'waiting';
  state.endsAt = 0;
  state.treasures = [];
  for (const p of state.players.values()) {
    Object.assign(p, spawnPoint(), { y: 0, score: 0, scoredAt: 0, attempts: new Map(), tried: new Set() });
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
    attempts: new Map(), // treasure id -> when its quiz was opened
    tried: new Set(), // treasure ids this player answered wrong (no second chance)
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
  Object.assign(player, p, { y, ry, air: msg.air === true, lastMoveAt: now });
  return true;
}

const treasureOf = (state, id) => (Number.isInteger(id) ? state.treasures[id] : undefined);
const questionOf = (state, t) => state.questions.find((q) => q.id === t.qid);

// Tapping a gift opens its quiz. No lock: several people may answer the same gift at once,
// and the first correct answer to reach the server takes it.
// Returns { result: 'quiz', question, choices, remainingMs } or { result: 'taken' | 'tried' | 'far' | 'invalid' }.
export function openTreasure(state, player, id, now) {
  const t = treasureOf(state, id);
  if (state.phase !== 'playing' || !t) return { result: 'invalid' };
  if (t.foundBy) return { result: 'taken' };
  if (player.tried.has(id)) return { result: 'tried' };
  if (Math.hypot(player.x - t.x, player.z - t.z) > PICKUP_RADIUS + PICKUP_TOLERANCE) return { result: 'far' };
  if (Math.abs((player.y ?? 0) - t.y) > PICKUP_HEIGHT) return { result: 'far' };
  if (!lineOfSight([player.x, (player.y ?? 0) + 1.2, player.z], [t.x, t.y + 0.4, t.z])) return { result: 'far' }; // no grabbing through walls
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
    player.score += 1;
    player.scoredAt = now; // earlier wins a tie
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

export function snapshot(state, now) {
  const players = [];
  for (const p of state.players.values()) if (p.online) players.push({ id: p.id, name: p.name, x: p.x, y: p.y ?? 0, z: p.z, ry: p.ry, air: !!p.air });
  return {
    phase: state.phase,
    remainingMs: remainingMs(state, now),
    players,
    found: state.treasures.filter((t) => t.foundBy).map((t) => t.id),
    treasureCount: state.treasures.length,
    questionCount: state.questions.length,
    // full list once it's over so every phone can find its own rank
    ranking: state.phase === 'ended' ? ranking(state) : ranking(state).slice(0, RANKING_SIZE),
  };
}
