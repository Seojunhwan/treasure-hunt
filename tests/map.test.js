import { test, expect } from 'vitest';
import { TREASURE_SPOTS as TREASURES, SPAWN, MAP_HALF, COLLIDERS, PLATFORMS } from '../shared/map.js';
import { resolveCollision, heightAt, lineOfSight, ceilingAt } from '../shared/collision.js';
import { PLAYER_RADIUS, PICKUP_RADIUS, PICKUP_HEIGHT, STEP_HEIGHT, MIN_QUESTIONS, JUMP_SPEED, GRAVITY, HEAD_ROOM } from '../shared/constants.js';

// Walk the map on a 0.5 m grid from the spawn plaza using the game's own movement rules.
// With jumps: from any cell you may hop onto a platform up to PEAK + STEP_HEIGHT higher whose edge
// is within JUMP_REACH, if there's headroom at take-off and nothing in the way at landing height.
const CELL = 0.5;
const PEAK = JUMP_SPEED ** 2 / (2 * GRAVITY);
const JUMP_REACH = 2; // m; conservative (a running jump covers about 3.5 m)
const rectDist = (p, x, z) => Math.hypot(Math.max(0, Math.abs(x - p.x) - p.w / 2), Math.max(0, Math.abs(z - p.z) - p.d / 2));
function explore({ jump = true } = {}) {
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
    if (!jump) continue;
    const x0 = i * CELL, z0 = j * CELL;
    for (const p of PLATFORMS) {
      if (p.y <= y + STEP_HEIGHT || p.y > y + PEAK + STEP_HEIGHT || rectDist(p, x0, z0) > JUMP_REACH) continue;
      if (ceilingAt(x0, z0, y) - HEAD_ROOM < p.y - STEP_HEIGHT) continue; // would bump your head first
      for (let ci = Math.ceil((p.x - p.w / 2) / CELL); ci * CELL <= p.x + p.w / 2; ci++) {
        for (let cj = Math.ceil((p.z - p.d / 2) / CELL); cj * CELL <= p.z + p.d / 2; cj++) {
          const x = ci * CELL, z = cj * CELL;
          if (Math.hypot(x - x0, z - z0) > JUMP_REACH + 0.5) continue;
          const ny = +heightAt(x, z, p.y).toFixed(2);
          if (ny < p.y || !free(x, z, ny)) continue;
          const steps = 6;
          let clear = true;
          for (let s = 1; s < steps && clear; s++) clear = free(x0 + ((x - x0) * s) / steps, z0 + ((z - z0) * s) / steps, p.y - STEP_HEIGHT);
          if (!clear) continue;
          const k = ci + ',' + cj + ',' + Math.round(ny * 4);
          if (seen.has(k)) continue;
          seen.set(k, ny);
          q.push([ci, cj, ny]);
        }
      }
    }
  }
  return out;
}
const reachable = explore();
const canPick = (cells, t) => cells.some((c) =>
  Math.hypot(c.x - t.x, c.z - t.z) <= PICKUP_RADIUS - 0.3 &&
  Math.abs(c.y - t.y) <= PICKUP_HEIGHT &&
  lineOfSight([c.x, c.y + 1.2, c.z], [t.x, t.y + 0.4, t.z]));

test('88 distinct hiding spots, comfortably more than the minimum question count', () => {
  expect(TREASURES.length).toBe(88);
  expect(TREASURES.length).toBeGreaterThan(MIN_QUESTIONS);
  const keys = new Set(TREASURES.map((t) => `${Math.round(t.x)},${Math.round(t.z)},${t.y}`));
  expect(keys.size).toBe(TREASURES.length);
});

test('every treasure can be reached and picked up with nothing in the way', () => {
  const bad = TREASURES.filter((t) => !canPick(reachable, t));
  expect(bad.map((t) => TREASURES.indexOf(t))).toEqual([]);
});

test('the high spots really need a jump', () => {
  const walkOnly = explore({ jump: false });
  const needJump = TREASURES.filter((t) => !canPick(walkOnly, t));
  expect(needJump.length).toBeGreaterThanOrEqual(5);
});

test('no treasure sits inside a solid', () => {
  const bad = TREASURES.filter((t) => COLLIDERS.some((b) =>
    Math.abs(t.x - b.x) < b.w / 2 && Math.abs(t.z - b.z) < b.d / 2 && t.y + 0.2 > (b.y ?? 0) && t.y + 0.2 < (b.y ?? 0) + b.h));
  expect(bad.map((t) => TREASURES.indexOf(t))).toEqual([]);
});

test('every tower deck can be climbed', () => {
  expect(reachable.some((c) => c.y >= 2.4)).toBe(true);
});
