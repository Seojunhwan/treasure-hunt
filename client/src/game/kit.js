// Assembles houses from Kenney modular pieces. Units are tiles (1 = one wall piece); callers scale the result.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();
export async function load(pack, name) {
  const key = pack + '/' + name;
  if (!cache.has(key)) cache.set(key, loader.loadAsync(`/assets/${pack}/${name}.glb`).then((g) => { g.scene.userData.animations = g.animations; return g.scene; }));
  // SkeletonUtils.clone keeps skinned meshes bound to their own bones; Object3D.clone breaks them
  const o = cloneSkinned(await cache.get(key));
  o.userData.animations = (await cache.get(key)).userData.animations;
  return o;
}

export async function place(parent, pack, name, x, y, z, rotY = 0, opts = {}) {
  const o = await load(pack, name);
  o.userData.name = name;
  o.position.set(x, y, z);
  o.rotation.y = rotY;
  if (opts.mirrorX) o.scale.x = -1;
  if (opts.scale) o.scale.multiplyScalar(opts.scale);
  parent.add(o);
  return o;
}

const D90 = Math.PI / 2;

// Holiday Kit log cabin, 2 tiles wide (x), depth tiles long (z), gable roof with ridge along z.
// cabin-wall sits on a tile's +z edge; rotations move it to other edges.
export async function holidayCabin({ depth = 3, door = 'front', snow = true } = {}) {
  const g = new THREE.Group();
  const P = 'holiday-kit';
  const zs = Array.from({ length: depth }, (_, i) => i - (depth - 1) / 2);
  const zf = zs.at(-1), zb = zs[0];
  const jobs = [];
  // front/back walls
  for (const x of [-0.5, 0.5]) {
    jobs.push(place(g, P, door === 'front' && x === 0.5 ? 'cabin-doorway' : 'cabin-window-a', x, 0, zf, 0));
    jobs.push(place(g, P, 'cabin-wall', x, 0, zb, Math.PI));
  }
  // side walls
  for (const z of zs) {
    jobs.push(place(g, P, z === 0 ? 'cabin-window-b' : 'cabin-wall', 0.5, 0, z, D90));
    jobs.push(place(g, P, z === 0 ? 'cabin-window-b' : 'cabin-wall', -0.5, 0, z, -D90));
  }
  // corner posts
  jobs.push(place(g, P, 'cabin-corner', -0.5, 0, zf, 0), place(g, P, 'cabin-corner', 0.5, 0, zf, D90),
    place(g, P, 'cabin-corner', 0.5, 0, zb, Math.PI), place(g, P, 'cabin-corner', -0.5, 0, zb, -D90));
  // roof
  const roof = snow ? 'cabin-roof-snow' : 'cabin-roof';
  for (const z of zs) {
    jobs.push(place(g, P, roof, 0.5, 1, z, 0), place(g, P, roof, -0.5, 1, z, Math.PI));
  }
  // gable triangles
  jobs.push(place(g, P, 'cabin-wall-roof', 0.5, 1, zf, 0), place(g, P, 'cabin-wall-roof', -0.5, 1, zf, 0, { mirrorX: true }),
    place(g, P, 'cabin-wall-roof', 0.5, 1, zb, Math.PI, { mirrorX: true }), place(g, P, 'cabin-wall-roof', -0.5, 1, zb, Math.PI));
  await Promise.all(jobs);
  return g;
}

// Warm "lamp is on inside" panels that show through window openings at night.
const GLOWS = [new THREE.MeshBasicMaterial({ color: 0xffb35c }), new THREE.MeshBasicMaterial({ color: 0xffd28a })];
const glowGeo = new THREE.PlaneGeometry(0.42, 0.5);
function addGlow(piece) {
  if (Math.random() < 0.25) return; // some rooms are dark
  const q = new THREE.Mesh(glowGeo, GLOWS[Math.random() < 0.6 ? 0 : 1]);
  q.position.set(0.47, 0.55, 0); // just inside the wall's outer face
  q.rotation.y = Math.PI / 2;
  piece.add(q);
}

// Fantasy Town Kit house, 2 x depth tiles. Its wall piece sits on a tile's +x edge.
export async function townHouse({ depth = 3, roof = 'roof-high', wall = 'wall', windowPiece = 'wall-window-glass', door = 'wall-door', floors = 1, glow = false } = {}) {
  const g = new THREE.Group();
  const P = 'fantasy-town-kit';
  const zs = Array.from({ length: depth }, (_, i) => i - (depth - 1) / 2);
  const zf = zs.at(-1), zb = zs[0];
  const jobs = [];
  for (let f = 0; f < floors; f++) {
    for (const x of [-0.5, 0.5]) {
      jobs.push(place(g, P, f === 0 && x === 0.5 ? door : windowPiece, x, f, zf, -D90));
      jobs.push(place(g, P, f ? windowPiece : wall, x, f, zb, D90));
    }
    for (const z of zs) {
      jobs.push(place(g, P, z === 0 || f ? windowPiece : wall, 0.5, f, z, 0));
      jobs.push(place(g, P, z === 0 || f ? windowPiece : wall, -0.5, f, z, Math.PI));
    }
  }
  // roof pieces are high on their +x edge, so the left tile keeps rotation 0
  for (const z of zs) jobs.push(place(g, P, roof, -0.5, floors, z, 0), place(g, P, roof, 0.5, floors, z, Math.PI));
  const pieces = await Promise.all(jobs);
  if (glow) for (const p of pieces) if (/window/.test(p.userData.name)) addGlow(p);
  return g;
}
