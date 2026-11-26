import { buildLoungeLayout } from './lounge.js';

// Plan view: +x is right, +z is down. A short passage connects the entrance to the lounge.
export const MAP_THEME = 'office';
export const OFFICE_SCALE = 1.2;
const officeFloor = { x: 0, z: 0, w: 34.24, d: 44.24 };
const officeCorridor = { x: 13.4, z: 0, w: 7.2, d: 44 };
const officeSpawn = { x: officeCorridor.x, z: 18.5, r: 2.2 };
export const INTERIORS = [];
export const RAMPS = [];

// Each row of islands has an eight-seat bank on the left and a six-seat bank on the right.
const deskRows = [-16.5, -7.5, 1.5, 10.5];
const DESK_BANKS = [
  { x: -10.5, desksPerSide: 4 },
  { x: 3.4, desksPerSide: 3 },
];
const DESK = { w: 1.74, h: 0.82, d: 1.15 };
const DESK_SPACING = 1.8;
const deskPositions = [];
for (const rowZ of deskRows) {
  for (const { x, desksPerSide } of DESK_BANKS) {
    const firstX = x - (desksPerSide - 1) * DESK_SPACING / 2;
    for (let column = 0; column < desksPerSide; column++) {
      const seatX = firstX + column * DESK_SPACING;
      for (const side of [-1, 1]) {
        deskPositions.push({ x: seatX, z: rowZ + side * DESK.d / 2, side, q: side < 0 ? 0 : 2 });
      }
    }
  }
}

const workstations = deskPositions.flatMap(({ x, z, side, q }) => [
  { name: 'desk', x, z, ...DESK, q, y: 0, solid: true },
  { name: 'chairDesk', x, z: z + side * 1.08, w: 0.68, h: 1.03, d: 0.72, q, y: 0, solid: true },
  { name: 'computerScreen', x, z: z - side * 0.29, w: 0.7, h: 0.52, d: 0.19, q, y: DESK.h },
  { name: 'computerKeyboard', x, z: z + side * 0.18, w: 0.55, h: 0.045, d: 0.18, q, y: DESK.h },
]);
const plants = [-20, -11.8, -2.8, 6.2, 16.3].map((z) => ({
  name: 'pottedPlant', x: -15.9, z, w: 0.72, h: 1.45, d: 0.72, q: 0, y: 0, solid: true,
}));
const officeFurniture = [...workstations, ...plants];

const restroomWidth = 3.6;
const doorHeight = 2.5;
const wallThickness = 0.24;
const leftEdge = -17;
const rightEdge = officeCorridor.x + officeCorridor.w / 2;
const southEdge = 22;
const openPanelWidth = 1.05;

const entry = { x: 10.4, z: southEdge };
const restroom = { x: rightEdge, z: 18.5 };
const passageNorth = officeFloor.z + officeFloor.d / 2;
const passageDepth = 5 / OFFICE_SCALE;
const passage = {
  x: entry.x, z: passageNorth + passageDepth / 2, w: 6.6 / OFFICE_SCALE, d: passageDepth, h: 3.6 / OFFICE_SCALE,
};
const passageFloor = { ...passage, w: passage.w + 2 * wallThickness, color: 0xe3d6c2 };
const passageLeft = passage.x - passage.w / 2;
const passageRight = passage.x + passage.w / 2;
const passageCeiling = { ...passageFloor, y: passage.h, h: wallThickness };
const restroomStart = restroom.z - restroomWidth / 2;
const restroomEnd = restroom.z + restroomWidth / 2;

const officeDoors = [
  {
    ...entry, id: 'entry', label: '사무실 입구', axis: 'x', width: passage.w, height: doorHeight,
    panel: { x: passageRight - openPanelWidth / 2, z: entry.z, w: openPanelWidth, d: 0.12, h: doorHeight },
  },
  {
    ...restroom, id: 'restroom', label: '화장실', axis: 'z', width: restroomWidth, height: doorHeight,
    panel: { ...restroom, w: 0.12, d: restroomWidth, h: doorHeight },
  },
];

const loungeAreaRatio = 1.5;
const loungeWidth = officeFloor.w * Math.sqrt(loungeAreaRatio);
const loungeDepth = officeFloor.d * Math.sqrt(loungeAreaRatio);
const loungeNorth = passageNorth + passage.d;
const loungeFloor = { x: passage.x, z: loungeNorth + loungeDepth / 2, w: loungeWidth, d: loungeDepth, color: 0xe7d6bb };
const loungeWest = loungeFloor.x - loungeWidth / 2;
const loungeEast = loungeFloor.x + loungeWidth / 2;
const loungeSouth = loungeNorth + loungeDepth;

function wallAlongX(z, from, to) {
  return { x: (from + to) / 2, z, w: to - from, d: wallThickness, h: 2.6 };
}

function wallAlongZ(x, from, to) {
  return { x, z: (from + to) / 2, w: wallThickness, d: to - from, h: 2.6 };
}

const officeWalls = [
  wallAlongX(-22, -officeFloor.w / 2, officeFloor.w / 2),
  wallAlongX(southEdge, -officeFloor.w / 2, passageLeft),
  wallAlongX(southEdge, passageRight, officeFloor.w / 2),
  wallAlongZ(leftEdge, -22, southEdge),
  wallAlongZ(rightEdge, -22, restroomStart),
  wallAlongZ(rightEdge, restroomEnd, southEdge),
];
const passageWalls = [passageLeft - wallThickness / 2, passageRight + wallThickness / 2].map((x) => ({
  ...wallAlongZ(x, southEdge, loungeNorth), h: passage.h,
}));

const desks = officeFurniture.filter(({ name }) => name === 'desk');
const deskSections = deskRows.map((z) => {
  const row = desks.filter((desk) => Math.abs(desk.z - z) < 1);
  return { z, left: row.filter(({ x }) => x < 0), right: row.filter(({ x }) => x >= 0) };
});

// A long panel divides the facing rows. A short return closes the corridor end.
const panelThickness = 0.065;
const panelHeight = 0.38;
const deskPartitions = [];
for (const { z, left, right } of deskSections) {
  for (const bank of [left, right]) {
    const first = bank[0];
    const last = bank.at(-1);
    const start = first.x - first.w / 2;
    const end = last.x + last.w / 2;
    const centerWidth = end - start - panelThickness;
    deskPartitions.push(
      { x: start + centerWidth / 2, z, w: centerWidth, d: panelThickness, y: first.h, h: panelHeight },
      { x: end - panelThickness / 2, z, w: panelThickness, d: first.d * 2, y: first.h, h: panelHeight },
    );
  }
}

const leftDeskPanels = deskSections.map(({ z, right }) => {
  const first = right[0];
  const w = panelThickness;
  const h = panelHeight;
  return { x: first.x - first.w / 2 + w / 2, z, w, d: first.d * 2, y: first.h, h };
});

// Dimensions are world-space footprints, including rotated cabinets and shelves.
const storageProps = [
  { model: 'bookcaseOpenLow', x: -16.41, z: -8.9, w: 0.67, d: 2.4, h: 1.0, q: 1, stand: true },
  { model: 'bookcaseOpenLow', x: -16.41, z: 18.25, w: 0.67, d: 2.4, h: 1.0, q: 1, stand: true },
  { model: 'cardboardBoxClosed', x: -15.6, z: 19.38, w: 0.65, d: 0.58, h: 0.48, q: 0, stand: true },
  { model: 'cardboardBoxOpen', x: -15.7, z: 20.21, w: 0.55, d: 0.57, h: 0.52, q: 0, stand: true },
];

const seatProps = deskSections.flatMap(({ z: rowZ, left, right }) =>
  [...left, ...right].flatMap((desk) => {
    const side = Math.sign(desk.z - rowZ);
    const x = desk.x + side * 0.60;
    return [
      { model: 'cabinetBedDrawer', x, z: desk.z + side * 0.85, w: 0.42, d: 0.46, h: 0.65, q: side > 0 ? 0 : 2, stand: true },
      { model: 'trashcan', x, z: desk.z + side * 1.27, w: 0.28, d: 0.28, h: 0.36, q: 0 },
    ];
  }),
);
const floorProps = [...storageProps, ...seatProps];

const waterDispenser = {
  x: restroom.x - 0.47,
  z: restroomStart - 0.65,
  w: 0.66, d: 0.66, h: 1.67,
};

const airPurifiers = deskSections.map(({ z, left }) => {
  const last = left.at(-1);
  return { x: last.x + last.w / 2 + 0.36, z, w: 0.52, d: 0.52, h: 0.82, q: 1 };
});

const loungeWalls = [
  wallAlongX(loungeNorth, loungeWest, passageLeft),
  wallAlongX(loungeNorth, passageRight, loungeEast),
  wallAlongX(loungeSouth, loungeWest, loungeEast),
  wallAlongZ(loungeWest, loungeNorth, loungeSouth),
  wallAlongZ(loungeEast, loungeNorth, loungeSouth),
];
const lounge = buildLoungeLayout(loungeFloor);

// The renderer builds from the layout as authored and scales the office group once.
// Exports below are in game coordinates, including positions used for NPCs and collision.
export const OFFICE_LAYOUT = {
  floor: officeFloor,
  corridor: officeCorridor,
  floorExtensions: [passageFloor, ...lounge.floors],
  lounge,
  passage,
  doors: officeDoors,
  walls: [...officeWalls, ...passageWalls, ...loungeWalls],
  furniture: [...officeFurniture, ...lounge.furniture],
  deskSections,
  deskPartitions: [...deskPartitions, ...leftDeskPanels],
  floorProps,
  waterDispenser,
  airPurifiers,
};

function scaledPoint({ x, z }) {
  return { x: x * OFFICE_SCALE, z: z * OFFICE_SCALE };
}

function scaledFootprint(box) {
  return { ...scaledPoint(box), w: box.w * OFFICE_SCALE, d: box.d * OFFICE_SCALE };
}

function scaledSolid(box) {
  return { ...scaledFootprint(box), h: box.h * OFFICE_SCALE, y: (box.y ?? 0) * OFFICE_SCALE };
}

export const FLOOR = scaledFootprint(officeFloor);
export const CORRIDOR = scaledFootprint(officeCorridor);
export const LOUNGE = scaledFootprint(loungeFloor);
export const GROUND_LEVELS = lounge.floors.filter(({ y }) => y < 0)
  .map((surface) => ({ ...scaledFootprint(surface), y: surface.y * OFFICE_SCALE }));
export const LOUNGE_PASSAGE = scaledSolid(passage);
export const MAP_HALF = Math.ceil(Math.max(loungeSouth, loungeEast, Math.abs(loungeWest)) * OFFICE_SCALE + 1);
export const SPAWN = { ...scaledPoint(officeSpawn), r: officeSpawn.r * OFFICE_SCALE };
export const OFFICE_DOORS = officeDoors.map((door) => ({
  ...door, ...scaledPoint(door), width: door.width * OFFICE_SCALE, height: door.height * OFFICE_SCALE,
  panel: scaledSolid(door.panel),
}));
export const FURNITURE = OFFICE_LAYOUT.furniture.map((item) => ({ ...item, ...scaledSolid(item) }));
export const COLLIDERS = [
  ...OFFICE_LAYOUT.walls, passageCeiling, ...officeDoors.map(({ panel }) => panel), ...officeFurniture.filter(({ solid }) => solid),
  ...OFFICE_LAYOUT.deskPartitions, ...floorProps, waterDispenser, ...airPurifiers, ...lounge.featureSolids, ...lounge.furniture.filter(({ solid }) => solid),
].map(scaledSolid);
export const PLATFORMS = [
  ...workstations.filter(({ solid }) => solid), ...floorProps.filter(({ stand }) => stand), ...lounge.furniture.filter(({ solid }) => solid),
].map((box) => ({ ...scaledFootprint(box), y: ((box.y ?? 0) + box.h) * OFFICE_SCALE }));

const officeTreasures = [
  ...deskPositions.map(({ x, z, side }) => ({ x, z: z + side * 0.4, y: DESK.h })),
  ...deskRows.flatMap((z) => [-15.1, -5.6, -2.5, 7.9, officeCorridor.x].map((x) => ({ x, z: z + 3.5, y: 0 }))),
];

export const TREASURE_SPOTS = [
  ...officeTreasures,
  ...lounge.treasures,
].map((spot) => ({ ...scaledPoint(spot), y: spot.y * OFFICE_SCALE }));
