import * as THREE from 'three';
import { load } from './kit.js';
import { LOUNGE, OFFICE_LAYOUT, OFFICE_SCALE } from '../../../shared/maps/office.js';
import { addOfficeDecor } from './office-decor.js';
import { addDeskDetails } from './office-desk-details.js';
import { addFixtures } from './office-fixtures.js';
import { addLoungeDetails } from './lounge-decor.js';

export async function buildOfficeWorld(scene, mergeStatic) {
  const office = new THREE.Group();
  office.scale.setScalar(OFFICE_SCALE);
  scene.add(office);
  addLoungeDetails(office, OFFICE_LAYOUT.lounge, mergeStatic);
  await Promise.all([
    buildArchitecture(office, mergeStatic),
    addOfficeDecor(office, mergeStatic),
    addDeskDetails(office, mergeStatic),
    addFixtures(office, mergeStatic),
  ]);

  scene.add(loungeSign());
}

async function buildArchitecture(scene, mergeStatic) {
  const { floor: mainFloor, corridor, floorExtensions, passage, doors, walls: wallLayout, furniture } = OFFICE_LAYOUT;
  scene.add(new THREE.HemisphereLight(0xfff7e8, 0x879594, 1.65));
  const sun = new THREE.DirectionalLight(0xfff4dd, 1.35);
  sun.position.set(-16, 35, 24);
  scene.add(sun);

  const statics = new THREE.Group();
  const material = (color) => new THREE.MeshLambertMaterial({ color });
  const walls = material(0xf2ede2);
  const trim = material(0x40534e);
  const yellow = material(0xe6bd37);
  const glass = new THREE.MeshLambertMaterial({
    color: 0xabc9c5, transparent: true, opacity: 0.58, depthWrite: false,
  });

  function block({ x, z, w, d, h }, material, y = h / 2, parent = statics) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
  }

  function floor({ x, z, w, d }, color, height) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material(color));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, height, z);
    statics.add(mesh);
  }

  block({ ...mainFloor, h: 0.36 }, walls, -0.2);
  floor(mainFloor, 0xeee8db, 0);
  floor(corridor, 0xdbe6e0, 0.012);
  for (const extension of floorExtensions) {
    const y = extension.y ?? 0;
    block({ ...extension, h: 0.37 }, material(extension.color ?? 0xdbe6e0), y - 0.2);
    floor(extension, extension.color ?? 0xdbe6e0, y);
  }
  floor({ ...corridor, x: corridor.x - corridor.w / 2, w: 0.10 }, 0xe6bd37, 0.016);

  for (const wall of wallLayout) {
    block(wall, walls);
    block({ ...wall, w: wall.w + 0.02, d: wall.d + 0.02, h: 0.09 }, trim);
  }
  addPassageLights(statics, passage);

  for (const door of doors) {
    const { x, z, width, height, panel, axis } = door;
    const alongX = axis === 'x';
    const jamb = alongX ? { w: 0.08, d: 0.24 } : { w: 0.24, d: 0.08 };
    for (const side of [-1, 1]) {
      const offset = side * (width - 0.08) / 2;
      block({ x: x + (alongX ? offset : 0), z: z + (alongX ? 0 : offset), ...jamb, h: height }, trim);
    }
    const header = alongX ? { w: width, d: 0.24 } : { w: 0.24, d: width };
    block({ x, z, ...header, h: 0.16 }, trim, height);
    block(panel, glass, panel.h / 2, scene);
    block({ ...panel, w: panel.w + 0.04, d: panel.d + 0.04, h: 0.08 }, yellow, 1.18);
    scene.add(doorSign(door));
  }

  // The architecture is visible while the models load.
  scene.add(mergeStatic(statics));
  const placedFurniture = await Promise.all(furniture.map(loadFurniture));
  const models = new THREE.Group();
  models.add(...placedFurniture);
  scene.add(mergeStatic(models));
}

function addPassageLights(parent, { x, z, w, d, h }) {
  function panel(width, height, material, px, py, pz, rx, ry = 0) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(px, py, pz);
    mesh.rotation.set(rx, ry, 0);
    parent.add(mesh);
  }

  // The roof is opaque from inside and open in the overhead map view.
  const ceiling = new THREE.MeshLambertMaterial({ color: 0xf3efe6 });
  panel(w, d, ceiling, x, h, z, Math.PI / 2);

  const channel = new THREE.MeshBasicMaterial({ color: 0x958a78 });
  const light = new THREE.MeshBasicMaterial({ color: 0xdffced, toneMapped: false });
  const count = 3;
  for (let i = 1; i <= count; i++) {
    const ringZ = z - d / 2 + i * d / (count + 1);
    for (const [material, band, inset] of [[channel, 0.15, 0.018], [light, 0.063, 0.023]]) {
      panel(w - 2 * inset, band, material, x, inset, ringZ, -Math.PI / 2);
      panel(w - 2 * inset, band, material, x, h - inset, ringZ, Math.PI / 2);
      panel(band, h - 2 * inset, material, x - w / 2 + inset, h / 2, ringZ, 0, Math.PI / 2);
      panel(band, h - 2 * inset, material, x + w / 2 - inset, h / 2, ringZ, 0, -Math.PI / 2);
    }
  }
}

function doorSign({ x, z, height, label, axis }) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#344746';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff6d8';
  ctx.font = '600 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 56);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.48),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  const angle = axis === 'x' ? Math.PI : -Math.PI / 2;
  sign.rotation.y = angle;
  sign.position.set(x + Math.sin(angle) * 0.14, height + 0.27, z + Math.cos(angle) * 0.14);
  return sign;
}

async function loadFurniture({ name, pack = 'furniture-kit', x, z, w, h, d, q, y }) {
  const model = await load(pack, name);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  const item = new THREE.Group();
  item.add(model);
  const quarterTurn = q % 2 !== 0;
  item.scale.set((quarterTurn ? d : w) / size.x, h / size.y, (quarterTurn ? w : d) / size.z);
  item.rotation.y = q * Math.PI / 2;
  item.position.set(x, y, z);
  return item;
}

function loungeSign() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#344746';
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = '#f7de92';
  ctx.fillRect(0, 0, 12, 160);
  ctx.font = '700 67px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LOUNGE', 260, 82);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.65 * OFFICE_SCALE, 0.83 * OFFICE_SCALE),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  sign.position.set(LOUNGE.x + OFFICE_SCALE, 1.77 * OFFICE_SCALE, LOUNGE.z - LOUNGE.d / 2 + 0.16 * OFFICE_SCALE);
  return sign;
}
