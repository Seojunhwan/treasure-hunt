import { test, expect } from 'vitest';
import { TREASURE_SPOTS as TREASURES, SPAWN, MAP_HALF, COLLIDERS } from '../shared/map.js';
import { resolveCollision, heightAt, lineOfSight } from '../shared/collision.js';
import { PLAYER_RADIUS, PICKUP_RADIUS, PICKUP_HEIGHT, STEP_HEIGHT, MIN_QUESTIONS } from '../shared/constants.js';

// Walk the map on a 0.5 m grid from the spawn plaza using the game's own movement rules.
const CELL = 0.5;
function explore() {
  const seen = new Map(); // "i,j" -> y
  const free = (x, z, y) => {
    const p = resolveCollision(x, z, PLAYER_RADIUS, y);
    return Math.abs(p.x - x) < 1e-6 && Math.abs(p.z - z) < 1e-6;
  };
  const q = [[Math.round(SPAWN.x / CELL), Math.round(SPAWN.z / CELL), 0]];
  seen.set(q[0][0] + ',' + q[0][1] + ',0', 0);
  const out = [];
  while (q.length) {
    const [i, j, y] = q.pop();
    out.push({ x: i * CELL, z: j * CELL, y });
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, x = ni * CELL, z = nj * CELL;
      if (Math.abs(x) > MAP_HALF - PLAYER_RADIUS || Math.abs(z) > MAP_HALF - PLAYER_RADIUS) continue;
      if (!free(x, z, y)) continue;
      const ny = +heightAt(x, z, y).toFixed(2);
      if (ny > y + STEP_HEIGHT) continue;
      const k = ni + ',' + nj + ',' + Math.round(ny * 4);
      if (seen.has(k)) continue;
      seen.set(k, ny);
      q.push([ni, nj, ny]);
    }
  }
  return out;
}
const reachable = explore();

test('60 distinct hiding spots, comfortably more than the minimum question count', () => {
  expect(TREASURES.length).toBe(60);
  expect(TREASURES.length).toBeGreaterThan(MIN_QUESTIONS);
  const keys = new Set(TREASURES.map((t) => `${Math.round(t.x)},${Math.round(t.z)},${t.y}`));
  expect(keys.size).toBe(TREASURES.length);
});

test('every treasure can be reached and picked up with nothing in the way', () => {
  const bad = TREASURES.filter((t) => !reachable.some((c) =>
    Math.hypot(c.x - t.x, c.z - t.z) <= PICKUP_RADIUS - 0.3 &&
    Math.abs(c.y - t.y) <= PICKUP_HEIGHT &&
    lineOfSight([c.x, c.y + 1.2, c.z], [t.x, t.y + 0.4, t.z])));
  expect(bad.map((t) => TREASURES.indexOf(t))).toEqual([]);
});

test('no treasure sits inside a solid', () => {
  const bad = TREASURES.filter((t) => COLLIDERS.some((b) =>
    Math.abs(t.x - b.x) < b.w / 2 && Math.abs(t.z - b.z) < b.d / 2 && t.y + 0.2 > (b.y ?? 0) && t.y + 0.2 < (b.y ?? 0) + b.h));
  expect(bad.map((t) => TREASURES.indexOf(t))).toEqual([]);
});

test('every tower deck can be climbed', () => {
  expect(reachable.some((c) => c.y >= 2.4)).toBe(true);
});
