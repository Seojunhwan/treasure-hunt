import { test, expect } from 'vitest';
import { resolveCollision, clampToCircle, rayCast } from '../shared/collision.js';
import { BUILDINGS, SPAWN, MAP_HALF } from '../shared/map.js';

const box = [{ x: 0, z: 0, w: 4, d: 4, h: 3 }]; // spans -2..2
const r = 0.5;

test('head-on: pushed back to the wall face', () => {
  expect(resolveCollision(-2.2, 0, r, box)).toEqual({ x: -2.5, z: 0 });
});

test('slides: motion along the wall is kept, only the into-wall part is removed', () => {
  const p = resolveCollision(-2.3, 1.0, r, box);
  expect(p.x).toBeCloseTo(-2.5);
  expect(p.z).toBeCloseTo(1.0);
});

test('corner: pushed out diagonally to exactly r from the corner', () => {
  const p = resolveCollision(2.2, 2.2, r, box);
  expect(Math.hypot(p.x - 2, p.z - 2)).toBeCloseTo(r);
});

test('center inside box: exits through the nearest face', () => {
  expect(resolveCollision(1.8, 0, r, box)).toEqual({ x: 2.5, z: 0 });
});

test('free space untouched', () => {
  expect(resolveCollision(5, 5, r, box)).toEqual({ x: 5, z: 5 });
});

test('map edge clamps', () => {
  expect(resolveCollision(80, -80, r, [])).toEqual({ x: MAP_HALF - r, z: -(MAP_HALF - r) });
});

test('clampToCircle keeps points inside spawn', () => {
  expect(clampToCircle(3, 0, SPAWN)).toEqual({ x: 3, z: 0 });
  const p = clampToCircle(20, 0, SPAWN);
  expect(p.x).toBeCloseTo(SPAWN.x + SPAWN.r);
});

test('map data: no building overlaps the spawn plaza', () => {
  for (const b of BUILDINGS) {
    const p = resolveCollision(SPAWN.x, SPAWN.z, SPAWN.r, [b]);
    expect(p).toEqual({ x: SPAWN.x, z: SPAWN.z });
  }
});

test('roof boxes (base above head height) do not block walking', () => {
  const roof = [{ x: 0, z: 0, w: 4, d: 4, h: 0.4, y: 4 }];
  expect(resolveCollision(0, 0, r, roof)).toEqual({ x: 0, z: 0 });
});

test('rayCast: hits the near face, misses beside, respects max and box height', () => {
  const wall = [{ x: 0, z: -5, w: 10, d: 1, h: 3 }]; // face at z = -4.5
  expect(rayCast([0, 1, 0], [0, 0, -1], 20, wall)).toBeCloseTo(4.5);
  expect(rayCast([20, 1, 0], [0, 0, -1], 20, wall)).toBe(20);
  expect(rayCast([0, 1, 0], [0, 0, -1], 3, wall)).toBe(3);
  expect(rayCast([0, 5, 0], [0, 0, -1], 20, wall)).toBe(20); // passes over the wall
  expect(rayCast([0, 1, 0], [0, 0, 1], 20, wall)).toBe(20); // pointing away
});
