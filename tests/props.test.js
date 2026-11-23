import { test, expect } from 'vitest';
import { BODIES } from '../client/src/game/physics.js';
import { TREASURE_SPOTS as TREASURES } from '../shared/map.js';
import { resolveCollision } from '../shared/collision.js';

test('pushable props start in free space', () => {
  const stuck = BODIES.filter((b) => { const p = resolveCollision(b.x, b.z, b.r, 0); return Math.abs(p.x - b.x) > 1e-6 || Math.abs(p.z - b.z) > 1e-6; });
  expect(stuck).toEqual([]);
});

test('pushable props start away from treasures (they must never hide one)', () => {
  const close = BODIES.filter((b) => TREASURES.some((t) => Math.hypot(t.x - b.x, t.z - b.z) < 3));
  expect(close.map((b) => [b.kind, b.x, b.z])).toEqual([]);
});

