// The village. Everything here is shared by server and client: colliders, walkable surfaces and treasures
// are derived from the same structure list the client renders, so they can't drift apart.
export const S = 2.5; // one Kenney kit tile, in metres
export const MAP_HALF = 50; // playable area spans -50..50 on x and z
export const SPAWN = { x: 0, z: 0, r: 8 };
export const TREASURE_COUNT = 40;
const T = 0.3; // collider wall thickness
const DOOR = 1.4; // door gap width

// rot = quarter turns; the door (local +z) then faces 0: +z, 1: +x, 2: -z, 3: -x.
// open: has a doorway and an interior (room = furniture template).
export const HOUSES = [
  // west side of the main avenue, doors face east
  { x: -9, z: -40, rot: 1, d: 3, floors: 2, wood: true },
  { x: -9, z: -30, rot: 1, d: 2, floors: 1, open: true, room: 'bedroom' },
  { x: -9, z: -21, rot: 1, d: 3, floors: 2 },
  { x: -9, z: -12, rot: 1, d: 2, floors: 1, wood: true },
  { x: -9, z: 12, rot: 1, d: 2, floors: 1 },
  { x: -9, z: 21, rot: 1, d: 3, floors: 1, open: true, room: 'kitchen' },
  { x: -9, z: 30, rot: 1, d: 2, floors: 2, wood: true },
  { x: -9, z: 40, rot: 1, d: 3, floors: 1 },
  // east side, doors face west
  { x: 9, z: -40, rot: 3, d: 2, floors: 1 },
  { x: 9, z: -31, rot: 3, d: 3, floors: 2, wood: true },
  { x: 9, z: -21, rot: 3, d: 2, floors: 1, open: true, room: 'storage' },
  { x: 9, z: -12, rot: 3, d: 2, floors: 2 },
  { x: 9, z: 12, rot: 3, d: 3, floors: 1, open: true, room: 'bedroom' },
  { x: 9, z: 22, rot: 3, d: 2, floors: 2, wood: true },
  { x: 9, z: 31, rot: 3, d: 2, floors: 1 },
  { x: 9, z: 40, rot: 3, d: 3, floors: 2 },
  // north side of the cross street, doors face south
  { x: -40, z: -9, rot: 0, d: 2, floors: 1, wood: true },
  { x: -31, z: -9, rot: 0, d: 3, floors: 2 },
  { x: -21, z: -9, rot: 0, d: 2, floors: 1, open: true, room: 'kitchen' },
  { x: 21, z: -9, rot: 0, d: 2, floors: 2, wood: true },
  { x: 31, z: -9, rot: 0, d: 3, floors: 1 },
  { x: 40, z: -9, rot: 0, d: 2, floors: 1, open: true, room: 'storage' },
  // south side, doors face north
  { x: -40, z: 9, rot: 2, d: 2, floors: 2 },
  { x: -31, z: 9, rot: 2, d: 2, floors: 1, wood: true },
  { x: -21, z: 9, rot: 2, d: 3, floors: 2 },
  { x: 21, z: 9, rot: 2, d: 3, floors: 1 },
  { x: 31, z: 9, rot: 2, d: 2, floors: 2, wood: true },
  { x: 40, z: 9, rot: 2, d: 2, floors: 1 },
];

// Lookout towers: a 5 x 5 m deck at 2.5 m, stairs down on the local +z side (left half).
export const TOWERS = [
  { x: -30, z: -30, rot: 0 },
  { x: 30, z: 28, rot: 2 },
  { x: -28, z: 33, rot: 1 },
];

// Free-standing props. box = collider [w, d, h] in metres before rotation (omit for walk-through props).
export const PROPS = [
  { pack: 'holiday-kit', name: 'tree-decorated-snow', x: 0, z: -14, s: 5, box: [1.6, 1.6, 4] },
  { pack: 'fantasy-town-kit', name: 'fountain-round', x: 28, z: -28, s: 2.4, box: [4.6, 4.6, 0.9] },
  { pack: 'fantasy-town-kit', name: 'stall-red', x: 22, z: -36, rot: 2, s: 2.4, box: [2.4, 1.2, 1.1] },
  { pack: 'fantasy-town-kit', name: 'stall-green', x: 34, z: -36, rot: 2, s: 2.4, box: [2.4, 1.2, 1.1] },
  { pack: 'fantasy-town-kit', name: 'stall-red', x: 38, z: -22, rot: 3, s: 2.4, box: [1.2, 2.4, 1.1] },
  { pack: 'fantasy-town-kit', name: 'cart', x: 19, z: -24, rot: 1, s: 2.4, box: [1.6, 2.6, 1.2] },
  { pack: 'fantasy-town-kit', name: 'cart', x: -24, z: 24, rot: 0, s: 2.4, box: [1.6, 2.6, 1.2] },
  { pack: 'holiday-kit', name: 'snowman-hat', x: 24, z: 22, s: 2, box: [1.4, 1.4, 2.4] },
  { pack: 'holiday-kit', name: 'snowman', x: -38, z: -24, s: 2, box: [1.4, 1.4, 2] },
  { pack: 'holiday-kit', name: 'sled-long', x: 36, z: 38, rot: 1, s: 2.4 },
  { pack: 'holiday-kit', name: 'rocks-large', x: -42, z: 42, s: 1.4, box: [4, 3.4, 2.2] },
  { pack: 'holiday-kit', name: 'rocks-large', x: 42, z: -44, rot: 2, s: 1.4, box: [4, 3.4, 2.2] },
  { pack: 'holiday-kit', name: 'snow-bunker', x: 20, z: 40, s: 2.4, box: [3.2, 2, 1.3] },
  { pack: 'holiday-kit', name: 'bench', x: -4, z: -20, rot: 1, s: 2.2 },
  { pack: 'holiday-kit', name: 'bench', x: 4, z: 20, rot: 3, s: 2.2 },
  { pack: 'fantasy-town-kit', name: 'cart-high', x: 44, z: 22, rot: 0, s: 2.4, box: [1.6, 2.6, 1.6] },
  { pack: 'holiday-kit', name: 'train-locomotive', x: -36, z: -42, rot: 1, s: 2.4, box: [1.4, 3.2, 2] },
];
// Street lamps along both streets and around the plaza (visual light + a thin post collider).
export const LAMPS = [
  [7, 7], [-7, 7], [7, -7], [-7, -7],
  ...[-44, -34, -24, -16, 16, 24, 34, 44].flatMap((z) => [[-4.7, z], [4.7, z]]),
  ...[-46, -36, -26, -16, 16, 26, 36, 46].flatMap((x) => [[x, -4.7], [x, 4.7]]),
].map(([x, z]) => ({ x, z }));

// Snowy pines fill the four outer blocks; each gets a trunk collider.
const PINES = [
  [-22, -44], [-44, -34], [-40, -16], [-18, -38], [-46, -46], [-26, -18], [-18, -26],
  [22, -46], [46, -38], [46, -46], [18, -16],
  [-44, 24], [-18, 18], [-22, 44], [-36, 46], [-46, 16], [-16, 30],
  [18, 30], [44, 16], [24, 46], [46, 46], [38, 20], [16, 44],
];
for (const [i, [x, z]] of PINES.entries()) {
  PROPS.push({ pack: 'holiday-kit', name: ['tree-snow-a', 'tree-snow-b', 'tree-snow-c'][i % 3], x, z, rot: i % 4, s: 2.6 + (i % 3) * 0.4, box: [0.8, 0.8, 4] });
}

// Furniture (Kenney Furniture Kit at scale 2.2). lx/lz are house-local; box as for PROPS.
const F = 2.2;
export const ROOMS = {
  bedroom: [
    { name: 'bedDouble', lx: -1.05, lz: -1.1, rot: 0, box: [2.1, 2.5, 0.85] },
    { name: 'bookcaseOpen', lx: 1.75, lz: -1.6, rot: 3, box: [0.6, 0.9, 1.95] },
    { name: 'rugRound', lx: 0.2, lz: 1, rot: 0 },
    { name: 'cardboardBoxOpen', lx: 1.5, lz: 0.6, rot: 1, box: [0.5, 0.85, 0.65] },
    { name: 'lampRoundFloor', lx: -1.8, lz: 1.6, rot: 0 },
  ],
  kitchen: [
    { name: 'kitchenCabinet', lx: -1.2, lz: -2.4, rot: 0, box: [1, 1, 1] },
    { name: 'kitchenCabinet', lx: -0.2, lz: -2.4, rot: 0, box: [1, 1, 1] },
    { name: 'table', lx: -0.6, lz: 0.2, rot: 1, box: [1, 1.85, 0.75] },
    { name: 'chair', lx: -1.6, lz: 0.2, rot: 1, box: [0.45, 0.45, 1] },
    { name: 'chair', lx: 0.4, lz: 0.2, rot: 3, box: [0.45, 0.45, 1] },
    { name: 'pottedPlant', lx: 1.8, lz: -2.6, rot: 0, box: [0.5, 0.5, 1.4] },
  ],
  storage: [
    { name: 'cardboardBoxClosed', lx: -1.6, lz: -1.6, rot: 0, box: [0.5, 0.5, 0.62] },
    { name: 'cardboardBoxOpen', lx: -0.9, lz: -1.7, rot: 0, box: [0.85, 0.5, 0.62] },
    { name: 'cardboardBoxClosed', lx: -1.6, lz: -0.9, rot: 1, box: [0.5, 0.5, 0.62] },
    { name: 'bookcaseOpen', lx: 1.75, lz: -1.2, rot: 3, box: [0.6, 0.9, 1.95] },
    { name: 'coatRack', lx: -1.85, lz: 1.2, rot: 1 },
  ],
};
export const FURNITURE_SCALE = F;

// --- geometry helpers --------------------------------------------------------
// Rotate a local point by q quarter turns (same sense as three.js rotation.y = q * PI / 2).
export function rot(q, lx, lz) {
  switch (((q % 4) + 4) % 4) {
    case 0: return [lx, lz];
    case 1: return [lz, -lx];
    case 2: return [-lx, -lz];
    default: return [-lz, lx];
  }
}
const box = (o, q, lx, lz, w, d, h, y = 0) => {
  const [dx, dz] = rot(q, lx, lz);
  const odd = q % 2 === 1;
  return { x: o.x + dx, z: o.z + dz, w: odd ? d : w, d: odd ? w : d, h, y };
};

export const houseSize = (h) => ({ w: 2 * S, d: h.d * S, H: h.floors * S });

// --- derived: colliders, walkable surfaces ------------------------------------
export const COLLIDERS = []; // { x, z, w, d, h, y } axis-aligned, y = base height
export const PLATFORMS = []; // { x, z, w, d, y } flat walkable tops
export const RAMPS = []; // { x, z, w, d, axis: 'x' | 'z', y0, y1 } height goes y0 → y1 from min to max edge

export const INTERIORS = []; // { x, z, w, d } inside of each open house, for the first-person camera
for (const h of HOUSES) {
  const { w, d, H } = houseSize(h);
  if (h.open) INTERIORS.push(box(h, h.rot, 0, 0, w - 2 * T, d - 2 * T, H));
  const q = h.rot;
  if (h.open) {
    const seg = (a, b) => box(h, q, (a + b) / 2, d / 2 - T / 2, b - a, T, H);
    COLLIDERS.push(
      box(h, q, 0, -d / 2 + T / 2, w, T, H), // back
      box(h, q, -w / 2 + T / 2, 0, T, d, H), // left
      box(h, q, w / 2 - T / 2, 0, T, d, H), // right
      seg(-w / 2, S / 2 - DOOR / 2), seg(S / 2 + DOOR / 2, w / 2), // front, door gap on the right tile
    );
    for (const f of ROOMS[h.room]) if (f.box) COLLIDERS.push(box(h, q, f.lx, f.lz, ...rotSize(f.rot, f.box)));
  } else {
    COLLIDERS.push(box(h, q, 0, 0, w, d, H));
  }
  COLLIDERS.push(box(h, q, 0, 0, w + 0.6, d + 0.6, S * 1.1, H)); // roof: stops the camera, never the walker
}
function rotSize(q, [w, d, h]) { return q % 2 ? [d, w, h] : [w, d, h]; }

for (const t of TOWERS) {
  const q = t.rot, P = S;
  const stairs = box(t, q, -S / 2, 1.5 * S, S, S, 0);
  // stairs climb toward the deck (local -z)
  const along = q % 2 ? 'x' : 'z';
  const highAtMin = q === 0 || q === 1; // after rotation, is the deck on the ramp's min-coordinate side?
  RAMPS.push({ x: stairs.x, z: stairs.z, w: stairs.w, d: stairs.d, axis: along, y0: highAtMin ? P : 0, y1: highAtMin ? 0 : P });
  PLATFORMS.push({ ...box(t, q, 0, 0, 2 * S, 2 * S, 0), y: P });
  COLLIDERS.push(box(t, q, 0, 0, 2 * S, 2 * S, 0.15, P - 0.15)); // deck slab (camera)
  for (const [px, pz] of [[-S + 0.15, -S + 0.15], [S - 0.15, -S + 0.15], [-S + 0.15, S - 0.15], [S - 0.15, S - 0.15]]) {
    COLLIDERS.push(box(t, q, px, pz, 0.3, 0.3, P)); // posts
  }
  const rail = (lx, lz, w, d) => COLLIDERS.push(box(t, q, lx, lz, w, d, 1.1, P));
  rail(0, -S + 0.1, 2 * S, 0.2); rail(-S + 0.1, 0, 0.2, 2 * S); rail(S - 0.1, 0, 0.2, 2 * S); rail(S / 2, S - 0.1, S, 0.2);
  COLLIDERS.push(box(t, q, -S + 0.1, 1.5 * S, 0.2, S, P), box(t, q, -0.1, 1.5 * S, 0.2, S, P)); // stair side rails
}

for (const p of PROPS) if (p.box) COLLIDERS.push(box(p, p.rot ?? 0, 0, 0, ...p.box));
for (const l of LAMPS) COLLIDERS.push(box(l, 0, 0, 0, 0.35, 0.35, 3));

// --- treasures ----------------------------------------------------------------
// Hiding spots, written relative to the structures so they follow if a house moves.
const inHouse = (i, lx, lz) => { const h = HOUSES[i]; const [dx, dz] = rot(h.rot, lx, lz); return { x: h.x + dx, z: h.z + dz, y: 0 }; };
const behindHouse = (i, lx = 0) => { const h = HOUSES[i]; return inHouse(i, lx, -houseSize(h).d / 2 - 1.2); };
const onTower = (i, lx = 1, lz = -1) => { const t = TOWERS[i]; const [dx, dz] = rot(t.rot, lx, lz); return { x: t.x + dx, z: t.z + dz, y: S }; };
const underTower = (i) => { const t = TOWERS[i]; const [dx, dz] = rot(t.rot, 0.8, -0.8); return { x: t.x + dx, z: t.z + dz, y: 0 }; };
const at = (x, z) => ({ x, z, y: 0 });

const SPOTS = [
  // inside the open houses (indexes into HOUSES)
  inHouse(1, -1.9, 1.2), inHouse(1, 1.75, -0.4),
  inHouse(5, 0.9, -2.6), inHouse(5, -1.9, 1.8),
  inHouse(10, -1.9, 0), inHouse(10, 1.75, 0.2),
  inHouse(12, -1.9, 1.8), inHouse(12, 1.75, -2.6),
  inHouse(18, -1.9, -1.5), inHouse(18, 1.8, 1.5),
  inHouse(21, -1.8, -0.4), inHouse(21, 1.75, 0.3),
  // tower decks and under the decks
  onTower(0), onTower(1), onTower(2),
  underTower(0), underTower(1), underTower(2),
  // behind houses, facing away from the streets
  behindHouse(0), behindHouse(3, 1.5), behindHouse(7, -1.5), behindHouse(9), behindHouse(14), behindHouse(17), behindHouse(22), behindHouse(24, 1), behindHouse(27),
  // alleys between neighbouring houses
  at(-9, -35), at(9, 26.5), at(-26, -9), at(35.5, 9), at(-9, 35),
  // market, props, edges
  at(22, -38.4), at(28, -24.6), at(41.6, -24.5), at(-24, 26.8), at(26, 22), at(-39.5, -26), at(-44.5, 44.5), at(22, 42.2),
];
export const TREASURES = SPOTS.map((p, id) => ({ id, x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: p.y }));
