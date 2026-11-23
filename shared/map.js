// Placeholder village. Buildings are axis-aligned boxes: center x/z, width (x), depth (z), height.
export const MAP_HALF = 50; // map spans -50..50 on x and z
export const SPAWN = { x: 0, z: 0, r: 8 };

export const TREASURE_COUNT = 40;
export const BUILDINGS = [
  // enterable house: 12 x 10, door 2 m wide on the south (+z) wall, roof at 4 m
  { x: -30, z: -34.8, w: 12, d: 0.4, h: 4 },
  { x: -35.8, z: -30, w: 0.4, d: 10, h: 4 },
  { x: -24.2, z: -30, w: 0.4, d: 10, h: 4 },
  { x: -33.5, z: -25.2, w: 5, d: 0.4, h: 4 },
  { x: -26.5, z: -25.2, w: 5, d: 0.4, h: 4 },
  { x: -30, z: -30, w: 12, d: 10, h: 0.4, y: 4 },
  { x: -12, z: -32, w: 8, d: 8, h: 5 },
  { x: 8, z: -30, w: 10, d: 12, h: 7 },
  { x: 30, z: -28, w: 14, d: 10, h: 6 },
  { x: -32, z: -8, w: 10, d: 14, h: 5 },
  { x: -20, z: -14, w: 6, d: 6, h: 4 },
  { x: 0, z: -18, w: 6, d: 4, h: 3 },
  { x: 20, z: -10, w: 10, d: 8, h: 5 },
  { x: 16, z: 12, w: 6, d: 8, h: 4 },
  { x: -18, z: 12, w: 8, d: 8, h: 4 },
  { x: 34, z: 8, w: 8, d: 12, h: 6 },
  { x: -34, z: 20, w: 12, d: 8, h: 5 },
  { x: -12, z: 30, w: 10, d: 10, h: 6 },
  { x: 10, z: 28, w: 12, d: 8, h: 5 },
  { x: 30, z: 32, w: 10, d: 10, h: 7 },
  { x: -4, z: 44, w: 16, d: 4, h: 4 },
];

// shortcut: 40 seeded-random spots so server and client agree; replaced by hand-placed hiding spots in Task 16
function placeholderTreasures() {
  let seed = 20261223;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const free = (x, z) =>
    Math.hypot(x - SPAWN.x, z - SPAWN.z) > SPAWN.r + 4 &&
    BUILDINGS.every((b) => (b.y ?? 0) > 0 || Math.abs(x - b.x) > b.w / 2 + 1.5 || Math.abs(z - b.z) > b.d / 2 + 1.5);
  const out = [];
  while (out.length < TREASURE_COUNT) {
    const x = (rnd() * 2 - 1) * (MAP_HALF - 3), z = (rnd() * 2 - 1) * (MAP_HALF - 3);
    if (free(x, z)) out.push({ id: out.length, x: +x.toFixed(2), z: +z.toFixed(2) });
  }
  return out;
}
export const TREASURES = placeholderTreasures();
