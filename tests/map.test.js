import { test, expect } from 'vitest';
import {
  COLLIDERS, FLOOR, FURNITURE, LOUNGE, LOUNGE_PASSAGE, MAP_HALF, OFFICE_DOORS, OFFICE_LAYOUT, OFFICE_SCALE, SPAWN,
  TREASURE_SPOTS as TREASURES,
} from '../shared/map.js';
import { resolveCollision, lineOfSight, ceilingAt, groundHeight } from '../shared/collision.js';
import { PLAYER_RADIUS, PICKUP_RADIUS, PICKUP_HEIGHT, MIN_QUESTIONS, STEP_HEIGHT } from '../shared/constants.js';

const CELL = 0.25;
function canStand(x, z) {
  const p = resolveCollision(x, z, PLAYER_RADIUS, groundHeight(x, z));
  return Math.abs(p.x - x) < 1e-6 && Math.abs(p.z - z) < 1e-6;
}

// Flood fill from the spawn on foot, so an isolated bank or blocked entrance fails the map test.
function walkableCells() {
  const queue = [[Math.round(SPAWN.x / CELL), Math.round(SPAWN.z / CELL)]];
  const seen = new Set();
  const out = [];
  while (queue.length) {
    const [i, j] = queue.pop();
    const key = `${i},${j}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const x = i * CELL, z = j * CELL;
    if (Math.abs(x) >= MAP_HALF || Math.abs(z) >= MAP_HALF || !canStand(x, z)) continue;
    const y = groundHeight(x, z);
    out.push({ x, y, z });
    for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (Math.abs(groundHeight(ni * CELL, nj * CELL) - y) <= STEP_HEIGHT) queue.push([ni, nj]);
    }
  }
  return out;
}

test('four banks of eight desks on the left and six on the right', () => {
  const desks = FURNITURE.filter(({ name }) => name === 'desk');
  const leftRows = new Map();
  const rightRows = new Map();
  for (const { x, z } of desks) {
    const rows = x < 0 ? leftRows : rightRows;
    rows.set(z, (rows.get(z) ?? 0) + 1);
  }
  expect([...leftRows.values()]).toEqual(Array(8).fill(4));
  expect([...rightRows.values()]).toEqual(Array(8).fill(3));
});

test('the office entrance is on the water-dispenser side and reachable on foot from spawn', () => {
  const entry = OFFICE_DOORS.find(({ id }) => id === 'entry');
  const dispenserX = OFFICE_LAYOUT.waterDispenser.x * OFFICE_SCALE;
  expect(Math.abs(entry.x - dispenserX)).toBeLessThan(Math.abs(entry.x - FLOOR.x));
  expect(entry.x + entry.width / 2).toBeLessThan(FLOOR.x + FLOOR.w / 2);
  expect(entry.x).toBe(LOUNGE_PASSAGE.x);
  expect(entry.z).toBeGreaterThan(SPAWN.z);
  expect(entry.axis).toBe('x');
  for (let x = SPAWN.x; x >= entry.x; x -= CELL) {
    expect(canStand(x, SPAWN.z)).toBe(true);
  }
  for (let z = SPAWN.z; z <= entry.z + 1; z += CELL) {
    expect(canStand(entry.x, z)).toBe(true);
  }
});

test('the right wall closes the old lounge opening and keeps the restroom door', () => {
  const restroom = OFFICE_DOORS.find(({ id }) => id === 'restroom');
  expect(restroom.axis).toBe('z');
  expect(restroom.x).toBeGreaterThan(SPAWN.x);
  expect(canStand(restroom.x, restroom.z)).toBe(false);
  expect(canStand(restroom.x, 7.5 * OFFICE_SCALE)).toBe(false);
});

test('the full office floor and desks retain their current dimensions', () => {
  const desk = FURNITURE.find(({ name }) => name === 'desk');
  expect(FLOOR.w).toBeCloseTo(41.088);
  expect(FLOOR.d).toBeCloseTo(53.088);
  expect(desk.w).toBeCloseTo(2.088);
  expect(desk.h).toBeCloseTo(0.984);
});

test('panels divide facing rows and screen the ends of each bank', () => {
  const clear = (from, to) => lineOfSight(from.map((n) => n * OFFICE_SCALE), to.map((n) => n * OFFICE_SCALE));
  for (const { z, left, right } of OFFICE_LAYOUT.deskSections) {
    for (const bank of [left, right]) {
      const first = bank[0];
      const last = bank.at(-1);
      const y = first.h + 0.2;
      const side = first.d / 2;
      expect(clear([first.x, y, z - side], [first.x, y, z + side])).toBe(false);
      expect(clear([first.x, y, z + side], [last.x, y, z + side])).toBe(true);
      expect(clear([last.x, y, z + side], [last.x + 1.2, y, z + side])).toBe(false);
      expect(clear([first.x - 1.2, y, z + side], [first.x, y, z + side])).toBe(bank === left);
    }
  }
});

test('a wide, covered passage connects the entrance to the lounge', () => {
  const { x, z, w, d, h } = LOUNGE_PASSAGE;
  expect(x).toBe(LOUNGE.x);
  expect(d).toBeCloseTo(5);
  expect(w).toBeGreaterThan(d);
  expect(z - d / 2).toBeCloseTo(FLOOR.z + FLOOR.d / 2);
  expect(z + d / 2).toBeCloseTo(LOUNGE.z - LOUNGE.d / 2);
  expect(ceilingAt(x, z, 0)).toBeCloseTo(h);
  expect(canStand(x - w / 2, z)).toBe(false);
  expect(canStand(x + w / 2, z)).toBe(false);
  expect(LOUNGE.w * LOUNGE.d).toBeCloseTo(1.5 * FLOOR.w * FLOOR.d);
  for (let step = SPAWN.z; step <= z + d / 2 + 1; step += CELL) {
    expect(canStand(x, step)).toBe(true);
  }
  expect(canStand(x, LOUNGE.z + LOUNGE.d / 2)).toBe(false);
});

test('the sunken lounge has walkable steps on all sides and two routes around each divider', () => {
  const { pit, mirrorPillar, shopWall } = OFFICE_LAYOUT.lounge;
  const scale = OFFICE_SCALE;
  expect(mirrorPillar.x * scale).toBe(LOUNGE_PASSAGE.x);
  const center = groundHeight(pit.x * scale, pit.z * scale);
  expect(center).toBeCloseTo(-0.72);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const edge = dx ? pit.w / 2 : pit.d / 2;
    for (const [inset, y] of [[-0.5, 0], [0.5, -0.24], [1.5, -0.48], [2.5, center]]) {
      expect(groundHeight((pit.x + dx * (edge - inset)) * scale, (pit.z + dz * (edge - inset)) * scale)).toBeCloseTo(y);
    }
  }
  for (const divider of [mirrorPillar, shopWall]) {
    expect(canStand(divider.x * scale, divider.z * scale)).toBe(false);
    for (const side of [-1, 1]) {
      const x = (divider.x + side * (divider.w / 2 + 1)) * scale;
      expect(canStand(x, divider.z * scale)).toBe(true);
    }
  }
});

test('the lounge adds four hiding spots to the original set', () => {
  expect(TREASURES.length).toBe(80);
  const loungeSpots = TREASURES.filter(({ x, z }) =>
    Math.abs(x - LOUNGE.x) < LOUNGE.w / 2 && Math.abs(z - LOUNGE.z) < LOUNGE.d / 2);
  expect(loungeSpots).toHaveLength(4);
  expect(TREASURES.length).toBeGreaterThan(MIN_QUESTIONS);
  const keys = new Set(TREASURES.map((t) => `${Math.round(t.x)},${Math.round(t.z)},${t.y}`));
  expect(keys.size).toBe(TREASURES.length);
});

test('every treasure is reachable on foot and can be picked up without reaching through a wall', () => {
  const reachable = walkableCells();
  const bad = TREASURES.filter((t) => !reachable.some((c) =>
    Math.hypot(c.x - t.x, c.z - t.z) <= PICKUP_RADIUS - 0.3 &&
    Math.abs(t.y - c.y) <= PICKUP_HEIGHT &&
    lineOfSight([c.x, c.y + 1.2, c.z], [t.x, t.y + 0.4, t.z])));
  expect(bad).toEqual([]);
});

test('no treasure sits inside a solid', () => {
  const bad = TREASURES.filter((t) => COLLIDERS.some((b) =>
    Math.abs(t.x - b.x) < b.w / 2 && Math.abs(t.z - b.z) < b.d / 2 &&
    t.y + 0.2 > (b.y ?? 0) && t.y + 0.2 < (b.y ?? 0) + b.h));
  expect(bad).toEqual([]);
});
