import { test, expect } from 'vitest';
import { resolveCollision, clampToCircle, rayCast, heightAt, lineOfSight } from '../shared/collision.js';
import { COLLIDERS, SPAWN, MAP_HALF } from '../shared/map.js';

const box = [{ x: 0, z: 0, w: 4, d: 4, h: 3 }]; // spans -2..2
const r = 0.5;

test('head-on: pushed back to the wall face', () => {
  expect(resolveCollision(-2.2, 0, r, 0, box)).toEqual({ x: -2.5, z: 0 });
});

test('slides: motion along the wall is kept, only the into-wall part is removed', () => {
  const p = resolveCollision(-2.3, 1.0, r, 0, box);
  expect(p.x).toBeCloseTo(-2.5);
  expect(p.z).toBeCloseTo(1.0);
});

test('corner: pushed out diagonally to exactly r from the corner', () => {
  const p = resolveCollision(2.2, 2.2, r, 0, box);
  expect(Math.hypot(p.x - 2, p.z - 2)).toBeCloseTo(r);
});

test('center inside box: exits through the nearest face', () => {
  expect(resolveCollision(1.8, 0, r, 0, box)).toEqual({ x: 2.5, z: 0 });
});

test('free space untouched', () => {
  expect(resolveCollision(5, 5, r, 0, box)).toEqual({ x: 5, z: 5 });
});

test('map edge clamps', () => {
  expect(resolveCollision(80, -80, r, 0, [])).toEqual({ x: MAP_HALF - r, z: -(MAP_HALF - r) });
});

test('clampToCircle keeps points inside spawn', () => {
  expect(clampToCircle(3, 0, SPAWN)).toEqual({ x: 3, z: 0 });
  const p = clampToCircle(20, 0, SPAWN);
  expect(p.x).toBeCloseTo(SPAWN.x + SPAWN.r);
});

test('map data: nothing solid inside the spawn plaza', () => {
  for (const b of COLLIDERS) {
    const p = resolveCollision(SPAWN.x, SPAWN.z, SPAWN.r, 0, [b]);
    expect(p).toEqual({ x: SPAWN.x, z: SPAWN.z });
  }
});

test('roof boxes (base above head height) do not block walking', () => {
  const roof = [{ x: 0, z: 0, w: 4, d: 4, h: 0.4, y: 4 }];
  expect(resolveCollision(0, 0, r, 0, roof)).toEqual({ x: 0, z: 0 });
});

test('rayCast: hits the near face, misses beside, respects max and box height', () => {
  const wall = [{ x: 0, z: -5, w: 10, d: 1, h: 3 }]; // face at z = -4.5
  expect(rayCast([0, 1, 0], [0, 0, -1], 20, wall)).toBeCloseTo(4.5);
  expect(rayCast([20, 1, 0], [0, 0, -1], 20, wall)).toBe(20);
  expect(rayCast([0, 1, 0], [0, 0, -1], 3, wall)).toBe(3);
  expect(rayCast([0, 5, 0], [0, 0, -1], 20, wall)).toBe(20); // passes over the wall
  expect(rayCast([0, 1, 0], [0, 0, 1], 20, wall)).toBe(20); // pointing away
});

test('vertical: a railing up on a deck blocks people on the deck, not people below', () => {
  const rail = [{ x: 0, z: 0, w: 4, d: 0.2, h: 1.1, y: 2.5 }];
  expect(resolveCollision(0, 0.3, r, 0, rail)).toEqual({ x: 0, z: 0.3 });
  expect(resolveCollision(0, 0.3, r, 2.5, rail).z).toBeCloseTo(0.6);
});

test('heightAt: ground, deck only within step reach, ramp interpolates', () => {
  const deck = [{ x: 0, z: 0, w: 4, d: 4, y: 2.5 }];
  const ramp = [{ x: 0, z: 4, w: 2, d: 4, axis: 'z', y0: 2.5, y1: 0 }]; // z 2..6, high at z=2
  expect(heightAt(10, 10, 0, deck, ramp)).toBe(0);
  expect(heightAt(0, 0, 0, deck, ramp)).toBe(0); // can't jump onto the deck from the ground
  expect(heightAt(0, 0, 2.4, deck, ramp)).toBe(2.5);
  expect(heightAt(0, 6, 0, deck, ramp)).toBeCloseTo(0);
  expect(heightAt(0, 5.5, 0, deck, ramp)).toBeCloseTo(0.3125);
  expect(heightAt(0, 4, 1, deck, ramp)).toBeCloseTo(1.25);
  expect(heightAt(0, 4, 0, deck, ramp)).toBe(0); // walking under the middle of the ramp? too high to step on
});

test('lineOfSight: blocked by a wall, clear around it', () => {
  const wall = [{ x: 0, z: 0, w: 4, d: 0.3, h: 3 }];
  expect(lineOfSight([0, 1, -2], [0, 1, 2], wall)).toBe(false);
  expect(lineOfSight([5, 1, -2], [5, 1, 2], wall)).toBe(true);
});
