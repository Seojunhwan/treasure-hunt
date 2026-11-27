// Left and right below are seen from the entrance, facing +z.
export function buildLoungeLayout(floor) {
  const front = floor.z - floor.d / 2;
  const point = (x, z) => ({ x: floor.x + x, z: front + z });
  const pit = { ...point(0, 25), w: 22, d: 24 };
  const bottom = { ...pit, w: pit.w - 4, d: pit.d - 4, y: -0.6, color: 0xcbbca8 };
  const floors = [bottom];
  function rim(outer, inner, y, color) {
    const w = (outer.w - inner.w) / 2;
    const d = (outer.d - inner.d) / 2;
    return [
      ...[-1, 1].map((side) => ({ x: outer.x + side * (inner.w + w) / 2, z: outer.z, w, d: outer.d, y, color })),
      { x: outer.x, z: (outer.z + inner.z) / 2 - (outer.d + inner.d) / 4, w: inner.w,
        d: d + inner.z - outer.z, y, color },
      { x: outer.x, z: (outer.z + inner.z) / 2 + (outer.d + inner.d) / 4, w: inner.w,
        d: d + outer.z - inner.z, y, color },
    ];
  }
  const middle = { ...pit, w: pit.w - 2, d: pit.d - 2 };
  const upperTreadY = -0.2;
  floors.push(...rim(floor, pit, 0, floor.color), ...rim(pit, middle, upperTreadY, 0xd5c8b5),
    ...rim(middle, bottom, -0.4, 0xbca990));

  const object = (name, x, z, w, d, h, q = 0, y = 0, solid = true) =>
    ({ name, ...point(x, z), w, d, h, q, y, solid });
  const mirrorPillar = { ...point(0, 4.6), w: 2.4, d: 1.65, h: 3.1 };
  const shopWall = { ...point(0, 43.6), w: 25, d: 0.35, h: 3.35 };
  const partyTree = object('tree-decorated', 9.55, 41.75, 1.68, 1.68, 3.05, 1);
  const pillarWreath = {
    name: 'wreath-decorated', x: mirrorPillar.x + mirrorPillar.w / 2 + 0.14,
    z: mirrorPillar.z, w: 0.26, d: 0.70, h: 0.80, q: 1, y: 1.58, solid: false,
  };

  const diningX = 15.4;
  const diningRows = [12, 19.5, 27, 34.5];
  const diningTables = diningRows.map((z) => object('table', diningX, z, 3.45, 1.8, 0.77, 1));
  const diningChairs = diningRows.flatMap((z) =>
    [-1, 1].flatMap((side) => [-1.29, -0.43, 0.43, 1.29].map((offset) =>
      object('chairModernCushion', diningX + offset, z + side * 1.28, 0.52, 0.56, 0.85, side < 0 ? 0 : 2))));
  const tablePlants = [[0, 'plantSmall1', 0.5], [2, 'plantSmall3', -1.2]].map(([index, name, offset]) =>
    object(name, diningX + offset, diningRows[index] - 0.14, 0.22, 0.22, 0.32, 0, diningTables[index].h, false));

  const cafeService = [5, 31.4].map((z) => ({
    napkins: object('kitchenBar', -19.4, z, 0.92, 1.55, 0.98, 1),
    cups: object('kitchenBar', -19.4, z + 1.6, 0.92, 1.55, 0.98, 1),
    drinks: object('kitchenSink', -19.4, z + 3.25, 0.92, 1.55, 1.14, 1),
    waste: object('trashcan', -19.4, z + 4.8, 0.72, 0.84, 0.94),
  }));
  const cafeCounters = [16.4, 18.2, 20, 21.8, 23.6].map((z) =>
    object('kitchenBar', -16.5, z, 0.9, 1.75, 0.98, 1));
  const cafe = [
    ...cafeCounters,
    object('kitchenCoffeeMachine', -16.46, 18.2, 0.64, 0.55, 0.45, 1, 0.98, false),
    ...cafeCounters.slice(-2).map(({ x, z, h }) => ({
      name: 'kitchenBlender', x: x + 0.05, z, w: 0.45, d: 0.38, h: 0.45, q: 1, y: h, solid: false,
    })),
    object('kitchenFridge', -19.1, 17.2, 1.0, 0.86, 1.93, 1),
    ...[19.2, 21, 22.8, 24.6].map((z) => object('kitchenCabinet', -19, z, 0.65, 1.75, 0.92, 1)),
    ...cafeService.flatMap((station) => Object.values(station)),
  ];

  const seats = [-5.25, 5.25].flatMap((x) => [20.3, 29.7].flatMap((z) => [
    object('loungeDesignSofa', x, z + 2.15, 3.05, 1, 0.83, 2, bottom.y),
    object('tableRound', x, z, 1.55, 1.55, 0.62, 0, bottom.y),
    object('loungeDesignChair', x - 1.05, z - 1.7, 0.94, 0.99, 0.84, 0, bottom.y),
    object('loungeDesignChair', x + 1.05, z - 1.7, 0.94, 0.99, 0.84, 0, bottom.y),
  ]));
  const ottomans = [[-7.4, 20.3], [2.9, 20.3], [7.4, 29.7]].map(([x, z]) =>
    object('loungeSofaOttoman', x, z, 0.82, 0.82, 0.46, 0, bottom.y));
  const treadCenterX = (pit.w + middle.w) / 4;
  const stairSeats = [-1, 1].flatMap((side) => [19, 30.5].map((z) => ({
    ...point(side * treadCenterX, z), w: 0.8, d: 2.45, y: upperTreadY, h: 0.0083,
  })));

  const frontShelfZ = 47.2;
  const shelves = [
    ...[2.4, 7].map((x) => object('bookcaseOpen', x, 51.7, 2.5, 0.88, 2.0, 2)),
    ...[-10.7, -8].map((x) => object('bookcaseOpen', x, frontShelfZ, 2.5, 0.88, 2.0, 2)),
    ...[-5.5, -3.1, -0.7].map((x) => object('bookcaseOpenLow', x, frontShelfZ, 2.0, 0.72, 0.95, 2)),
  ];
  const ramenCounter = [-7, -5.25, -3.5].map((x) => object('kitchenBar', x, 52.2, 1.7, 1.08, 0.98, 2));
  const counters = [4.7, 6.35, 8].map((x) => object('kitchenBar', x, 45.6, 1.6, 0.88, 0.98));
  const checkout = counters[1];
  const shop = [
    ...shelves,
    ...ramenCounter,
    object('kitchenFridgeLarge', 0, 51.7, 1.6, 0.9, 2.15, 2),
    ...counters,
    { name: 'computerScreen', x: checkout.x, z: checkout.z + 0.12, w: 0.43, d: 0.20, h: 0.34,
      q: 0, y: checkout.h, solid: false },
    object('cardboardBoxOpen', 10.3, 51.1, 0.68, 0.55, 0.55),
    object('cardboardBoxClosed', 11.05, 51.35, 0.72, 0.63, 0.50, 1),
  ];
  const plants = [[-18, 10], [18.6, 7], [-12.7, 36], [12.7, 36], [-15.8, 44], [15.8, 44]]
    .map(([x, z]) => object('pottedPlant', x, z, 0.65, 0.65, 1.25));
  const broad = { name: 'plant_bushDetailed', w: 1.35, d: 1.35, h: 0.81, y: 0.30 };
  const pointed = { name: 'plant_bushTriangle', w: 1.08, d: 1.23, h: 0.80, y: 0.35 };
  const upright = { name: 'plant_flatTall', w: 0.90, d: 0.90, h: 0.94, y: 0.44 };
  const borderPlants = [
    { x: -12.25, row: [broad, upright, pointed, broad, upright] },
    { x: 12.25, row: [pointed, broad, upright, pointed, broad] },
  ].flatMap(({ x, row }) => row.map(({ name, w, d, h, y }, index) => ({
    ...object(name, x, 15.5 + index * 4.5, w, d, h, index % 4, y), pack: 'nature-kit',
  })));
  const featureSolids = [mirrorPillar, shopWall];
  const furniture = [
    ...diningTables, ...diningChairs, ...tablePlants, ...cafe, ...seats, ...ottomans,
    ...shop, ...plants, ...borderPlants,
    ...[partyTree, pillarWreath].map((decoration) => ({ ...decoration, pack: 'holiday-kit' })),
  ];
  const treasures = [
    { ...point(-3, 24.7), y: bottom.y },
    { ...point(5.25, 29.7), y: bottom.y + 0.62 },
    { ...point(18.4, 29.5), y: 0 },
    { ...point(-10, 48), y: 0 },
  ];
  const pickupTreasures = [
    { ...point(-3.6, 5.7), y: 0 }, // beside the entrance pillar
    { ...point(diningX + 0.9, diningRows[1]), y: diningTables[1].h },
    { ...point(5.25, 20.3), y: bottom.y + 0.62 },
    { ...point(-5.25, 33), y: bottom.y }, // behind the sofa
    { ...point(-16.5, 16.4), y: cafeCounters[0].h },
    { ...point(11.8, 49.6), y: 0 }, // shop corner, beyond the banner wall
  ];
  const [firstTable] = diningTables;
  const [, hidingPlant] = tablePlants;
  const [, secondCooker] = ramenCounter;
  const noteTreasures = [
    { x: firstTable.x - 1.35, y: firstTable.h, z: firstTable.z - 0.17 },
    { x: hidingPlant.x, y: hidingPlant.y, z: hidingPlant.z + 0.17, cover: hidingPlant },
    { x: secondCooker.x + 0.58, y: secondCooker.h, z: secondCooker.z - 0.29 },
  ];
  return {
    floors, pit, bottom, mirrorPillar, shopWall, featureSolids, furniture, treasures, pickupTreasures, noteTreasures,
    front, diningTables, shelves, ramenCounter, cafeService, cafeCounters, borderPlants, stairSeats,
  };
}
