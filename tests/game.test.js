import { test, expect } from 'vitest';
import { createGame, join, move, snapshot } from '../server/game.js';
import { SPAWN } from '../shared/map.js';

const T0 = 1_000_000;

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
  const s = snapshot(g);
  expect(s.players.map((p) => p.name)).toEqual(['a']);
  expect(JSON.stringify(s)).not.toContain(g.players.keys().next().value);
});
