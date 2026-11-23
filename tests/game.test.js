import { test, expect } from 'vitest';
import { createGame as create, join, move, snapshot, start, reset, tick, remainingMs, isAdminToken, tryPickup, ranking } from '../server/game.js';
import { SPAWN, TREASURES, BUILDINGS, TREASURE_COUNT } from '../shared/map.js';

const T0 = 1_000_000;
const MIN15 = 15 * 60 * 1000;
const createGame = () => create(MIN15);

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
  expect(start(g, T0)).toBe(true);
  expect(start(g, T0 + 10)).toBe(false);
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

const playing = () => { const g = createGame(); start(g, T0); return g; };
const standOn = (p, t) => Object.assign(p, { x: t.x + 1, z: t.z });

test('pickup: only while playing, only when near', () => {
  const g = createGame();
  const p = join(g, { name: 'a' }, T0).player;
  const t = g.treasures[0];
  standOn(p, t);
  expect(tryPickup(g, p, 0, T0)).toBe('invalid'); // waiting
  start(g, T0);
  Object.assign(p, { x: t.x + 5, z: t.z });
  expect(tryPickup(g, p, 0, T0)).toBe('far');
  standOn(p, t);
  expect(tryPickup(g, p, 0, T0)).toBe('ok');
  expect(p.score).toBe(1);
  expect(tryPickup(g, p, 999, T0)).toBe('invalid');
  expect(tryPickup(g, p, '1', T0)).toBe('invalid');
});

test('pickup: two players on the same treasure, exactly one scores', () => {
  const g = playing();
  const a = join(g, { name: 'a' }, T0).player, b = join(g, { name: 'b' }, T0).player;
  standOn(a, g.treasures[3]); standOn(b, g.treasures[3]);
  const results = [tryPickup(g, a, 3, T0 + 1), tryPickup(g, b, 3, T0 + 1)];
  expect(results).toEqual(['ok', 'taken']);
  expect(a.score + b.score).toBe(1);
});

test('ranking: score desc, tie goes to who got there first, zero scores hidden', () => {
  const g = playing();
  const [a, b, c] = ['a', 'b', 'c'].map((n) => join(g, { name: n }, T0).player);
  Object.assign(a, { score: 2, scoredAt: T0 + 500 });
  Object.assign(b, { score: 2, scoredAt: T0 + 300 });
  Object.assign(c, { score: 0 });
  expect(ranking(g).map((r) => [r.rank, r.name])).toEqual([[1, 'b'], [2, 'a']]);
});

test('all 40 found ends the game early', () => {
  const g = playing();
  const p = join(g, { name: 'a' }, T0).player;
  for (const t of g.treasures) { standOn(p, t); expect(tryPickup(g, p, t.id, T0 + 10)).toBe('ok'); }
  expect(g.phase).toBe('ended');
  expect(p.score).toBe(TREASURE_COUNT);
});

test('snapshot: top 10 while playing, everyone once ended', () => {
  const g = playing();
  for (let i = 0; i < 15; i++) Object.assign(join(g, { name: 'p' + i }, T0).player, { score: 1, scoredAt: T0 + i });
  expect(snapshot(g, T0).ranking).toHaveLength(10);
  tick(g, T0 + MIN15);
  expect(snapshot(g, T0 + MIN15).ranking).toHaveLength(15);
});

test('reset restores every treasure', () => {
  const g = playing();
  const p = join(g, { name: 'a' }, T0).player;
  standOn(p, g.treasures[0]); tryPickup(g, p, 0, T0);
  reset(g);
  expect(g.treasures.every((t) => t.foundBy === null)).toBe(true);
});

test('map data: 40 treasures, none inside a building or the spawn plaza', () => {
  expect(TREASURES).toHaveLength(TREASURE_COUNT);
  for (const t of TREASURES) {
    expect(Math.hypot(t.x - SPAWN.x, t.z - SPAWN.z)).toBeGreaterThan(SPAWN.r);
    for (const b of BUILDINGS) if (!b.y) expect(Math.abs(t.x - b.x) > b.w / 2 || Math.abs(t.z - b.z) > b.d / 2).toBe(true);
  }
});
