import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { load, townHouse } from './kit.js';
import { S, MAP_HALF, SPAWN, HOUSES, TOWERS, PROPS, ROOMS, LAMPS, FURNITURE_SCALE, SCAFFOLDS, LOFT_FLOORS, HOUSE_STAIRS, houseSize, rot } from '../../../shared/map.js';

const Q = Math.PI / 2;

// Static scenery is built from the shared map data, then merged into a handful of meshes:
// hundreds of kit pieces would otherwise be hundreds of draw calls on a phone.
export async function buildWorld(scene) {
  scene.add(new THREE.HemisphereLight(0x8a9ad6, 0x2a2238, 1.25));
  const moon = new THREE.DirectionalLight(0xa8b8ff, 0.7);
  moon.position.set(-30, 50, 20);
  scene.add(moon);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_HALF * 4, MAP_HALF * 4), new THREE.MeshLambertMaterial({ color: 0xc9d3ea }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const road = new THREE.MeshLambertMaterial({ color: 0xa7a2b8 });
  for (const [w, d] of [[8, MAP_HALF * 2], [MAP_HALF * 2, 8]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), road);
    m.rotation.x = -Math.PI / 2; m.position.y = 0.01;
    scene.add(m);
  }
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(SPAWN.r + 2, 40), road);
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(SPAWN.x, 0.015, SPAWN.z);
  scene.add(plaza);

  const statics = new THREE.Group();
  const put = (o, x, y, z, q = 0, s = 1) => { o.position.set(x, y, z); o.rotation.y = q * Q; o.scale.multiplyScalar(s); statics.add(o); return o; };
  const jobs = [];

  // c: centre the model on its spot (kit origins sit on a corner)
  const furnish = (h, f, y) => {
    const [dx, dz] = rot(h.rot, f.lx, f.lz);
    jobs.push(load(f.pack ?? 'furniture-kit', f.name).then((o) => {
      if (!f.c) return put(o, h.x + dx, y + 0.03, h.z + dz, h.rot + f.rot, f.s ?? FURNITURE_SCALE);
      const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      o.position.set(-c.x, 0, -c.z);
      const g = new THREE.Group(); g.add(o);
      put(g, h.x + dx, y + 0.03, h.z + dz, h.rot + f.rot, f.s ?? FURNITURE_SCALE);
    }));
  };
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a5236 }), steps = new THREE.MeshLambertMaterial({ color: 0x8f6243 });
  for (const f of LOFT_FLOORS) put(new THREE.Mesh(new THREE.BoxGeometry(f.w, 0.15, f.d), wood), f.x, f.y - 0.075, f.z);
  for (const r of HOUSE_STAIRS) {
    const n = 10, along = r.axis === 'x' ? r.w : r.d, up = r.y1 > r.y0;
    for (let i = 0; i < n; i++) {
      const hgt = Math.max(r.y0, r.y1) * ((up ? i + 1 : n - i) / n), c = -along / 2 + (along / n) * (i + 0.5);
      const geo = r.axis === 'x' ? new THREE.BoxGeometry(along / n, hgt, r.d) : new THREE.BoxGeometry(r.w, hgt, along / n);
      put(new THREE.Mesh(geo, steps), r.x + (r.axis === 'x' ? c : 0), hgt / 2, r.z + (r.axis === 'z' ? c : 0));
    }
  }
  // Christmas on every house: a wreath over the door, candy canes either side, snow drifts at two corners
  const deco = (h, pack, name, lx, y, lz, s, q = 0) => {
    const [dx, dz] = rot(h.rot, lx, lz);
    jobs.push(load(pack, name).then((o) => put(o, h.x + dx, y, h.z + dz, h.rot + q, s)));
  };
  for (const h of HOUSES) {
    const { w, d } = houseSize(h);
    deco(h, 'holiday-kit', 'wreath-decorated', S / 2, 1.95, d / 2 + 0.16, 1.2);
    deco(h, 'holiday-kit', 'candy-cane-red', S / 2 - 0.95, 0, d / 2 + 0.3, 2.2);
    deco(h, 'holiday-kit', 'candy-cane-green', S / 2 + 0.95, 0, d / 2 + 0.3, 2.2, 2);
    deco(h, 'holiday-kit', 'snow-pile', -w / 2 - 0.15, 0, d / 2 + 0.1, 2);
    deco(h, 'holiday-kit', 'snow-pile', w / 2 + 0.15, 0, -d / 2 - 0.1, 2.4, 1);
  }

  for (const h of HOUSES) {
    const wood = h.wood ? { wall: 'wall-wood', windowPiece: 'wall-wood-window-shutters', door: 'wall-wood-door' } : {};
    const opts = { depth: h.d, floors: h.floors, glow: !h.open, ...wood };
    if (h.open) opts.door = h.wood ? 'wall-wood-doorway-square' : 'wall-doorway-square';
    jobs.push(townHouse(opts).then((g) => put(g, h.x, 0, h.z, h.rot, S)));
    if (!h.open) continue;
    const { w, d } = houseSize(h);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, d - 0.3), new THREE.MeshLambertMaterial({ color: 0x7a5236 }));
    floor.rotation.x = -Math.PI / 2;
    put(floor, h.x, 0.02, h.z, 0);
    floor.rotation.z = h.rot * Q;
    for (const f of ROOMS[h.room]) furnish(h, f, 0);
    for (const f of ROOMS[h.loft] ?? []) furnish(h, f, S);
  }

  for (const t of TOWERS) jobs.push(tower(t).then((g) => put(g, t.x, 0, t.z, t.rot)));
  for (const p of PROPS) jobs.push(load(p.pack, p.name).then((o) => put(o, p.x, p.y ?? 0, p.z, p.rot ?? 0, p.s ?? S)));
  for (const s of SCAFFOLDS) jobs.push(load('survival-kit', 'structure-floor').then((o) => put(o, s.x, 0, s.z, 0, 5)));
  for (const l of LAMPS) jobs.push(load('fantasy-town-kit', 'lantern').then((o) => put(o, l.x, 0, l.z, 0, 2.6)));

  await Promise.all(jobs);
  scene.add(mergeStatic(statics));
}

// 5 x 5 m deck at 2.5 m on four posts, railings, stairs on the local +z side (left half).
async function tower() {
  const g = new THREE.Group();
  const P = 'fantasy-town-kit';
  const add = async (name, x, y, z, ry) => { const o = await load(P, name); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(S); g.add(o); };
  const jobs = [];
  const deckY = S - 0.15;
  for (const x of [-S / 2, S / 2]) for (const z of [-S / 2, S / 2]) jobs.push(add('planks', x, deckY, z, 0));
  for (const x of [-S + 0.15, S - 0.15]) for (const z of [-S + 0.15, S - 0.15]) jobs.push(add('pillar-wood', x, 0, z, 0));
  // fence pieces sit on a tile's +x edge: rotate to reach the others
  for (const x of [-S / 2, S / 2]) jobs.push(add('fence', x, S, -S / 2, Q));
  for (const z of [-S / 2, S / 2]) jobs.push(add('fence', -S / 2, S, z, Math.PI), add('fence', S / 2, S, z, 0));
  jobs.push(add('fence', S / 2, S, S / 2, -Q));
  jobs.push(add('stairs-wide-wood', -S / 2, 0, 1.5 * S, Q));
  await Promise.all(jobs);
  return g;
}

function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh) return;
    const m = o.material;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) return;
    g.applyMatrix4(o.matrixWorld);
    const key = [m.type, m.map?.source.uuid ?? 'none', m.color?.getHexString(), m.transparent].join('|');
    if (!groups.has(key)) groups.set(key, { material: m, geos: [] });
    groups.get(key).geos.push(g);
  });
  const out = new THREE.Group();
  for (const { material, geos } of groups.values()) out.add(new THREE.Mesh(mergeGeometries(geos), material));
  // meshes without uvs (plain colored planes) stay as they are
  const plain = [];
  root.traverse((o) => { if (o.isMesh && !o.geometry.attributes.uv) plain.push(o); });
  for (const o of plain) { o.updateMatrixWorld(true); o.matrix.copy(o.matrixWorld); o.matrixAutoUpdate = false; out.add(o); }
  return out;
}
