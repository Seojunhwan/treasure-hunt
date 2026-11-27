import { test, expect } from 'vitest';
import { createGame as create, join, move, snapshot, start, reset, tick, remainingMs, isAdminToken, openTreasure, answerTreasure, ranking, treasureLayout, inspectOffice, ticketTotals } from '../server/game.js';
import * as map from '../shared/map.js';
import { MIN_QUESTIONS } from '../shared/constants.js';
import { validateQuestions } from '../server/questions.js';

const T0 = 1_000_000;
const MIN15 = 15 * 60 * 1000;
const { SPAWN, TREASURE_SPOTS, PICKUP_TREASURE_SPOTS, NOTE_TREASURE_SPOTS, DESK_INTERACTIONS, CDRAGON } = map;
const QS = (n = MIN_QUESTIONS) => Array.from({ length: n }, (_, i) => ({ id: 'q' + i, q: '문제 ' + i, choices: ['가', '나', '다'], answer: i % 3, explain: '설명 ' + i }));
const createGame = (n) => create(MIN15, QS(n));

test('join validates nickname length', () => {
  const g = createGame();
  expect(join(g, { name: '   ' }, T0).error).toBeTruthy();
  expect(join(g, { name: 'a'.repeat(13) }, T0).error).toBeTruthy();
  expect(join(g, { name: '가나다라마바사아자차카타' }, T0).player.name).toBe('가나다라마바사아자차카타'); // 12 chars
});

test('duplicate names get a number', () => {
  const g = createGame();
  join(g, { name: '산타' }, T0);
  expect(join(g, { name: '산타' }, T0).player.name).toBe('산타2');
  expect(join(g, { name: '산타' }, T0).player.name).toBe('산타3');
});

test('rejoin with token returns the same player with score and position', () => {
  const g = createGame();
  const { player } = join(g, { name: '루돌프' }, T0);
  player.score = 3; player.online = false;
  const again = join(g, { token: player.token, name: '딴이름' }, T0 + 5000).player;
  expect(again).toBe(player);
  expect(again.name).toBe('루돌프');
  expect(again.score).toBe(3);
});

test('same name without token reclaims an offline scoreless player, but not one with points', () => {
  const g = createGame();
  const a = join(g, { name: '눈송이' }, T0).player;
  a.online = false;
  expect(join(g, { name: '눈송이' }, T0).player).toBe(a);
  const b = join(g, { name: '별' }, T0).player;
  b.online = false; b.score = 2;
  expect(join(g, { name: '별' }, T0).player.name).toBe('별2');
});

test('new players spawn inside the plaza', () => {
  const g = createGame();
  for (let i = 0; i < 50; i++) {
    const p = join(g, { name: 'p' + i }, T0).player;
    expect(Math.hypot(p.x - SPAWN.x, p.z - SPAWN.z)).toBeLessThanOrEqual(SPAWN.r);
  }
});

test('move: normal speed accepted, teleport rejected, garbage rejected', () => {
  const g = createGame();
  g.phase = 'playing';
  const p = join(g, { name: 'a' }, T0).player;
  expect(move(g, p, { x: p.x + 0.5, z: p.z, ry: 0 }, T0 + 100)).toBe(true);
  expect(move(g, p, { x: p.x + 30, z: p.z, ry: 0 }, T0 + 200)).toBe(false);
  expect(move(g, p, { x: NaN, z: 0, ry: 0 }, T0 + 300)).toBe(false);
  expect(move(g, p, null, T0 + 300)).toBe(false);
});

test('move: clamped to spawn plaza while waiting', () => {
  const g = createGame();
  const p = join(g, { name: 'a' }, T0).player;
  Object.assign(p, { x: SPAWN.x + SPAWN.r - 0.5, z: SPAWN.z });
  move(g, p, { x: SPAWN.x + SPAWN.r + 0.3, z: SPAWN.z, ry: 0 }, T0 + 1000);
  expect(p.x).toBeCloseTo(SPAWN.x + SPAWN.r);
});

test('snapshot lists online players only and never leaks tokens', () => {
  const g = createGame();
  join(g, { name: 'a' }, T0);
  join(g, { name: 'b' }, T0).player.online = false;
  const s = snapshot(g, T0);
  expect(s.players.map((p) => p.name)).toEqual(['a']);
  expect(JSON.stringify(s)).not.toContain(g.players.keys().next().value);
});

test('start → 15 min countdown → ended, and only from waiting', () => {
  const g = createGame();
  expect(remainingMs(g, T0)).toBe(MIN15);
  expect(start(g, T0).ok).toBe(true);
  expect(start(g, T0 + 10).error).toBeTruthy();
  expect(remainingMs(g, T0 + 60_000)).toBe(MIN15 - 60_000);
  expect(tick(g, T0 + MIN15 - 1)).toBe(false);
  expect(tick(g, T0 + MIN15)).toBe(true);
  expect(g.phase).toBe('ended');
  expect(remainingMs(g, T0 + MIN15 + 5000)).toBe(0);
});

test('ended: movement frozen', () => {
  const g = createGame();
  const p = join(g, { name: 'a' }, T0).player;
  start(g, T0); tick(g, T0 + MIN15);
  expect(move(g, p, { x: p.x + 0.1, z: p.z, ry: 0 }, T0 + MIN15 + 100)).toBe(false);
});

test('opening holds players and treasures until the full round starts', () => {
  const g = create(MIN15, QS(), 6500);
  const p = join(g, { name: 'a' }, T0).player;
  Object.assign(p, { x: SPAWN.x + SPAWN.r, z: SPAWN.z });
  expect(start(g, T0).ok).toBe(true);
  expect(start(g, T0 + 100).error).toBeTruthy();
  expect(snapshot(g, T0 + 1500)).toMatchObject({ phase: 'opening', openingRemainingMs: 5000, remainingMs: MIN15, treasureCount: 0 });
  expect(treasureLayout(g)).toEqual([]);
  expect(move(g, p, { x: p.x + 0.4, z: p.z, ry: 0 }, T0 + 100)).toBe(true);
  expect(p.x).toBeCloseTo(SPAWN.x + SPAWN.r);
  expect(openTreasure(g, p, 0, T0 + 100).result).toBe('invalid');
  expect(tick(g, T0 + 6499)).toBe(false);
  expect(tick(g, T0 + 6540)).toBe(true);
  expect(snapshot(g, T0 + 6540)).toMatchObject({ phase: 'playing', openingRemainingMs: 0, remainingMs: MIN15, treasureCount: MIN_QUESTIONS });
  expect(move(g, p, { x: p.x + 0.4, z: p.z, ry: 0 }, T0 + 6550)).toBe(true);
  expect(p.x).toBeGreaterThan(SPAWN.x + SPAWN.r);
  expect(tick(g, T0 + 6640)).toBe(false);
});

test('reset cancels a pending opening and a new round uses its own deadline', () => {
  const g = create(MIN15, QS(), 6500);
  start(g, T0);
  reset(g);
  expect(tick(g, T0 + 6500)).toBe(false);
  expect(snapshot(g, T0 + 6500)).toMatchObject({ phase: 'waiting', openingRemainingMs: 0, treasureCount: 0 });
  expect(start(g, T0 + 7000).ok).toBe(true);
  expect(tick(g, T0 + 13499)).toBe(false);
  expect(tick(g, T0 + 13500)).toBe(true);
});

test('start: players can leave the plaza right away (no teleport rejection after a long wait)', () => {
  const g = createGame();
  const p = join(g, { name: 'a' }, T0).player;
  start(g, T0 + 600_000);
  expect(move(g, p, { x: p.x + 0.5, z: p.z, ry: 0 }, T0 + 600_100)).toBe(true);
});

test('reset: back to waiting, scores zero, everyone inside the plaza', () => {
  const g = createGame();
  const p = join(g, { name: 'a' }, T0).player;
  start(g, T0);
  Object.assign(p, { x: 40, z: 40, score: 5, scoredAt: T0 + 1 });
  reset(g);
  expect(g.phase).toBe('waiting');
  expect(p.score).toBe(0);
  expect(Math.hypot(p.x - SPAWN.x, p.z - SPAWN.z)).toBeLessThanOrEqual(SPAWN.r);
});

test('admin token check', () => {
  expect(isAdminToken('secret', 'secret')).toBe(true);
  expect(isAdminToken('secreT', 'secret')).toBe(false);
  expect(isAdminToken('', 'secret')).toBe(false);
  expect(isAdminToken(undefined, 'secret')).toBe(false);
});

const playing = (n) => { const g = createGame(n); start(g, T0); return g; };
const standOn = (p, t) => Object.assign(p, { x: t.x, z: t.z, y: t.y });
const right = (g, id) => g.questions.find((q) => q.id === g.treasures[id].qid).answer;
const wrong = (g, id) => (right(g, id) + 1) % 3;

test('start needs at least 25 questions and lays out one gift per question', () => {
  const few = createGame(MIN_QUESTIONS - 1);
  expect(start(few, T0).error).toMatch(/25/);
  expect(few.phase).toBe('waiting');
  const g = createGame(30);
  expect(start(g, T0).ok).toBe(true);
  expect(g.treasures).toHaveLength(30);
  const keys = new Set(g.treasures.map((t) => t.x + ',' + t.z + ',' + t.y));
  expect(keys.size).toBe(30); // all on different spots
  expect(start(createGame(TREASURE_SPOTS.length + 1), T0).error).toBeTruthy();
});

test('quiz: opening shows the question but never the answer', () => {
  const g = playing();
  const p = join(g, { name: 'a' }, T0).player;
  standOn(p, g.treasures[0]);
  const r = openTreasure(g, p, 0, T0);
  expect(r.result).toBe('quiz');
  expect(r.choices).toEqual(['가', '나', '다']);
  expect(JSON.stringify(r)).not.toMatch(/answer|설명/);
});

test('quiz: must be near, on the same floor, and not before the start', () => {
  const g = createGame();
  const p = join(g, { name: 'a' }, T0).player;
  expect(openTreasure(g, p, 0, T0).result).toBe('invalid'); // waiting: no gifts yet
  start(g, T0);
  const t = g.treasures[0];
  Object.assign(p, { x: t.x + 5, z: t.z, y: t.y });
  expect(openTreasure(g, p, 0, T0).result).toBe('far');
  Object.assign(p, { x: t.x, z: t.z, y: t.y + 3 });
  expect(openTreasure(g, p, 0, T0).result).toBe('far');
  expect(openTreasure(g, p, 999, T0).result).toBe('invalid');
  expect(openTreasure(g, p, '1', T0).result).toBe('invalid');
});

test('quiz: right answer takes the gift', () => {
  const g = playing();
  const p = join(g, { name: 'a' }, T0).player;
  standOn(p, g.treasures[2]);
  openTreasure(g, p, 2, T0);
  expect(answerTreasure(g, p, 2, right(g, 2), T0 + 3000).result).toBe('ok');
  expect(p.score).toBe(1);
  expect(snapshot(g, T0).found).toEqual([2]);
});

test('quiz: wrong answer = no second chance for that player, but others can still take it', () => {
  const g = playing();
  const a = join(g, { name: 'a' }, T0).player, b = join(g, { name: 'b' }, T0).player;
  standOn(a, g.treasures[1]); standOn(b, g.treasures[1]);
  openTreasure(g, a, 1, T0);
  const r = answerTreasure(g, a, 1, wrong(g, 1), T0 + 1000);
  expect(r).toMatchObject({ result: 'wrong', answer: ['가', '나', '다'][right(g, 1)], explain: '설명 1' });
  expect(openTreasure(g, a, 1, T0 + 2000).result).toBe('tried');
  expect(answerTreasure(g, a, 1, right(g, 1), T0 + 2000).result).toBe('tried');
  openTreasure(g, b, 1, T0 + 2000);
  expect(answerTreasure(g, b, 1, right(g, 1), T0 + 3000).result).toBe('ok');
});

test('quiz: no lock, first correct answer wins, the slower one hears "taken"', () => {
  const g = playing();
  const a = join(g, { name: 'a' }, T0).player, b = join(g, { name: 'b' }, T0).player;
  standOn(a, g.treasures[3]); standOn(b, g.treasures[3]);
  expect(openTreasure(g, a, 3, T0).result).toBe('quiz');
  expect(openTreasure(g, b, 3, T0 + 10).result).toBe('quiz');
  expect(answerTreasure(g, b, 3, right(g, 3), T0 + 2000).result).toBe('ok');
  expect(answerTreasure(g, a, 3, right(g, 3), T0 + 2100).result).toBe('taken');
  expect(a.score + b.score).toBe(1);
});

test('quiz: 20 s limit — late or timed-out answers count as wrong, reopening keeps the clock', () => {
  const g = playing();
  const p = join(g, { name: 'a' }, T0).player;
  standOn(p, g.treasures[4]);
  openTreasure(g, p, 4, T0);
  expect(openTreasure(g, p, 4, T0 + 15000).remainingMs).toBe(5000);
  expect(answerTreasure(g, p, 4, right(g, 4), T0 + 22000)).toMatchObject({ result: 'wrong', timeout: true });
  standOn(p, g.treasures[5]);
  openTreasure(g, p, 5, T0);
  expect(answerTreasure(g, p, 5, null, T0 + 20000)).toMatchObject({ result: 'wrong', timeout: true });
  standOn(p, g.treasures[6]);
  openTreasure(g, p, 6, T0);
  expect(openTreasure(g, p, 6, T0 + 21000).result).toBe('tried'); // closed the app and came back
});

test('quiz: answering without opening is refused', () => {
  const g = playing();
  const p = join(g, { name: 'a' }, T0).player;
  expect(answerTreasure(g, p, 0, 0, T0).result).toBe('invalid');
});

test('personal gifts open after the intro, score once per player, and survive rejoin until reset', () => {
  const spot = { x: SPAWN.x, y: 0, z: SPAWN.z };
  const g = create(MIN15, [], 6500, [spot]);
  const a = join(g, { name: 'a' }, T0).player, b = join(g, { name: 'b' }, T0).player;
  expect(start(g, T0)).toEqual({ ok: true });
  expect(treasureLayout(g)).toEqual([]);
  expect(openTreasure(g, a, 0, T0 + 1000).result).toBe('invalid');
  tick(g, T0 + 6500);
  expect(treasureLayout(g)).toEqual([{ id: 0, ...spot }]);
  Object.assign(a, { x: spot.x + 5, y: spot.y, z: spot.z });
  expect(openTreasure(g, a, 0, T0 + 6600).result).toBe('far');
  standOn(a, spot);
  standOn(b, spot);
  expect(openTreasure(g, a, 0, T0 + 6700)).toEqual({ result: 'ok', score: 1 });
  expect(openTreasure(g, a, 0, T0 + 6800)).toEqual({ result: 'collected', score: 1 });
  expect(openTreasure(g, b, 0, T0 + 6900)).toEqual({ result: 'ok', score: 1 });
  expect(g.phase).toBe('playing');
  expect(snapshot(g, T0 + 6900).found).toEqual([]);
  const rejoined = join(g, { token: a.token }, T0 + 7000).player;
  expect([...rejoined.collected]).toEqual([0]);
  expect(openTreasure(g, a, 0, g.endsAt).result).toBe('invalid');
  reset(g);
  expect(a.collected.size).toBe(0);
  expect(a.score).toBe(0);
});

test('a shared note issues one ticket while personal notes issue one per player; totals include zero and offline', () => {
  const note = { x: SPAWN.x, y: 0, z: SPAWN.z, kind: 'note' };
  const g = create(MIN15, [], 0, [{ ...note, shared: true }, note]);
  const [a, b, c] = ['A', 'B', 'C'].map((name) => join(g, { name }, T0).player);
  join(g, { name: 'Old player' }, T0).player.online = false;
  for (const p of [a, b]) standOn(p, note);
  start(g, T0);
  expect(openTreasure(g, a, 0, T0 + 10)).toEqual({ result: 'ok', score: 1, shared: true });
  expect(openTreasure(g, b, 0, T0 + 10).result).toBe('taken');
  expect(openTreasure(g, a, 0, T0 + 10)).toEqual({ result: 'collected', score: 1 });
  expect(openTreasure(g, a, 1, T0 + 20).result).toBe('ok');
  expect(openTreasure(g, b, 1, T0 + 20).result).toBe('ok');
  a.online = false;
  c.online = false;
  expect(snapshot(g, T0 + 100).found).toEqual([0]);
  expect(ticketTotals(g)).toEqual([
    { id: a.id, name: 'A', tickets: 2 }, { id: b.id, name: 'B', tickets: 1 }, { id: c.id, name: 'C', tickets: 0 },
  ]);
  reset(g);
  expect(ticketTotals(g)).toEqual([{ id: b.id, name: 'B', tickets: 0 }]);
});

test.skipIf(!NOTE_TREASURE_SPOTS)('office ticket layout has twenty unique shared notes and one personal note', () => {
  expect(PICKUP_TREASURE_SPOTS.filter(({ shared }) => shared)).toHaveLength(20);
  expect(PICKUP_TREASURE_SPOTS.filter(({ shared }) => !shared)).toHaveLength(1);
  expect(new Set(PICKUP_TREASURE_SPOTS.map(({ x, z }) => `${x},${z}`)).size).toBe(21);
});

test.skipIf(!NOTE_TREASURE_SPOTS)('office interactions keep clue, repeat, and unique seat progress per player', () => {
  const g = create(MIN15, [], 0, NOTE_TREASURE_SPOTS);
  const a = join(g, { name: 'A' }, T0).player;
  const b = join(g, { name: 'B' }, T0).player;
  const inspect = (player, id, now = T0 + 1000) => {
    const target = id === CDRAGON.id ? CDRAGON : DESK_INTERACTIONS.find((desk) => desk.id === id);
    Object.assign(player, { x: target.x, y: 0, z: target.z + (target.side ?? 1) * 2.1 });
    return inspectOffice(g, player, id, now);
  };
  expect(inspect(a, 'benny').result).toBe('invalid');
  start(g, T0);
  expect(inspectOffice(g, b, 'dion', T0 + 1000).result).toBe('far');
  expect(inspect(a, 'benny').result).toBe('look');
  expect(inspect(a, 'cdragon').result).toBe('dialogue');
  expect(inspect(b, 'benny').result).toBe('look');
  expect(inspect(a, 'benny')).toMatchObject({ result: 'reward', score: 1 });
  expect(inspect(a, 'benny').result).toBe('look');

  const steps = Array.from({ length: 4 }, () => inspect(a, 'dion'));
  expect(steps.every(({ result }) => result === 'look')).toBe(true);
  expect(new Set(steps.map(({ text }) => text)).size).toBe(4);
  expect(inspect(b, 'dion').text).toBe(steps[0].text);
  expect(inspect(join(g, { token: a.token }, T0 + 2000).player, 'dion')).toMatchObject({ result: 'reward', score: 2 });
  expect(inspect(a, 'dion').result).toBe('look');

  expect(inspect(a, 'daisy').text).toContain(`(3/${DESK_INTERACTIONS.length})`);
  for (const { id } of DESK_INTERACTIONS) {
    if (id !== 'daisy') expect(inspect(a, id).result).toBe('look');
  }
  expect(inspect(b, 'daisy').result).toBe('look');
  expect(inspect(a, 'daisy')).toMatchObject({ result: 'reward', score: 3 });
  expect(inspect(a, 'daisy').result).toBe('look');
  expect(inspect(a, 'daisy', g.endsAt).result).toBe('invalid');
  reset(g);
  start(g, T0 + 5000);
  expect(inspect(a, 'benny', T0 + 6000).result).toBe('look');
  expect(inspect(a, 'dion', T0 + 6000).text).toBe(steps[0].text);
  expect(a.score).toBe(0);
});

test('ranking: score desc, tie goes to who got there first, zero scores hidden', () => {
  const g = playing();
  const [a, b, c] = ['a', 'b', 'c'].map((n) => join(g, { name: n }, T0).player);
  Object.assign(a, { score: 2, scoredAt: T0 + 500 });
  Object.assign(b, { score: 2, scoredAt: T0 + 300 });
  Object.assign(c, { score: 0 });
  expect(ranking(g).map((r) => [r.rank, r.name])).toEqual([[1, 'b'], [2, 'a']]);
});

test('all gifts found ends the game early', () => {
  const g = playing();
  const p = join(g, { name: 'a' }, T0).player;
  for (const t of g.treasures) {
    standOn(p, t);
    openTreasure(g, p, t.id, T0 + 10);
    expect(answerTreasure(g, p, t.id, right(g, t.id), T0 + 20).result).toBe('ok');
  }
  expect(g.phase).toBe('ended');
  expect(p.score).toBe(MIN_QUESTIONS);
});

test('snapshot: top 10 while playing, everyone once ended', () => {
  const g = playing();
  for (let i = 0; i < 15; i++) Object.assign(join(g, { name: 'p' + i }, T0).player, { score: 1, scoredAt: T0 + i });
  expect(snapshot(g, T0).ranking).toHaveLength(10);
  tick(g, T0 + MIN15);
  expect(snapshot(g, T0 + MIN15).ranking).toHaveLength(15);
});

test('reset clears the gifts and everyone\'s quiz history', () => {
  const g = playing();
  const p = join(g, { name: 'a' }, T0).player;
  standOn(p, g.treasures[0]); openTreasure(g, p, 0, T0); answerTreasure(g, p, 0, wrong(g, 0), T0);
  reset(g);
  expect(g.treasures).toEqual([]);
  expect(p.tried.size).toBe(0);
  start(g, T0 + 1000);
  standOn(p, g.treasures[0]);
  expect(openTreasure(g, p, 0, T0 + 1000).result).toBe('quiz');
});

test('question bank validation (admin input)', () => {
  expect(validateQuestions(QS(3)).list).toHaveLength(3);
  expect(validateQuestions('x').error).toBeTruthy();
  expect(validateQuestions([{ q: '', choices: ['a', 'b'], answer: 0 }]).error).toMatch(/1번/);
  expect(validateQuestions([{ q: 'q', choices: ['a'], answer: 0 }]).error).toMatch(/보기/);
  expect(validateQuestions([{ q: 'q', choices: ['a', 'a'], answer: 0 }]).error).toMatch(/같은 보기/);
  expect(validateQuestions([{ q: 'q', choices: ['a', 'b'], answer: 2 }]).error).toMatch(/정답/);
  expect(validateQuestions([{ q: '  공백   정리 ', choices: [' a ', 'b'], answer: 1 }]).list[0]).toMatchObject({ q: '공백 정리', choices: ['a', 'b'] });
  expect(validateQuestions(QS(TREASURE_SPOTS.length + 1)).error).toMatch(/최대/);
});
