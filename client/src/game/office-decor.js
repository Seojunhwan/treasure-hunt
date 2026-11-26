import * as THREE from 'three';
import { OFFICE_LAYOUT } from '../../../shared/maps/office.js';
import { place } from './kit.js';

const WARM_YELLOW = 0xe4b746;

export async function addOfficeDecor(scene, mergeStatic) {
  const { floor: mainFloor, corridor, doors, furniture, deskSections } = OFFICE_LAYOUT;
  const details = new THREE.Group();
  const paint = (color) => new THREE.MeshLambertMaterial({ color });
  const carpet = [paint(0x798e8a), paint(0x8999a6)];
  const yellow = paint(WARM_YELLOW);
  const shadow = makeContactShadow();

  function floor(x, z, width, depth, y, material) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    details.add(mesh);
  }

  // Carpet islands follow the shared desk positions. Their edges stay off the walking routes.
  for (const [index, { z: rowZ, left: leftBank, right: rightBank }] of deskSections.entries()) {
    for (const bank of [leftBank, rightBank]) {
      const left = bank[0].x - bank[0].w / 2 - 0.62;
      const last = bank.at(-1);
      const right = last.x + last.w / 2 + 0.62;
      floor((left + right) / 2, rowZ, right - left, 5.05, 0.021, carpet[index % 2]);
    }
  }

  for (const { name, x, z, w, d } of furniture) {
    if (x <= mainFloor.w / 2 && (name === 'desk' || name === 'chairDesk' || name === 'pottedPlant')) {
      floor(x, z, w + 0.86, d + 0.8, 0.026, shadow);
    }
  }

  const entry = doors.find(({ id }) => id === 'entry');
  floor(corridor.x, corridor.z, corridor.w - 0.36, corridor.d - 0.24, 0.018, paint(0xc5d3c9));
  floor(entry.x, entry.z - 1.65, entry.width, 1.75, 0.024, paint(0x3b514f));
  floor(entry.x, entry.z - 2.46, entry.width, 0.12, 0.028, yellow);
  scene.add(entrySign(entry));

  const books = [paint(0xa14844), paint(0xe4d4aa), paint(0x516c81)];
  const mugBody = paint(0xe9b638);
  const mugInside = paint(0x705541);
  const closestRow = deskSections.at(-1);
  const featured = closestRow.right.filter(({ z }) => z > closestRow.z);
  const props = [];
  for (const [index, desk] of featured.entries()) {
    const x = desk.x - 0.5;
    const z = desk.z + 0.12;
    if (index === 0) {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.087, 0.22, 8), mugBody);
      mug.position.set(x, desk.h + 0.11, z);
      const inset = new THREE.Mesh(new THREE.CircleGeometry(0.078, 8), mugInside);
      inset.rotation.x = -Math.PI / 2;
      inset.position.set(x, desk.h + 0.221, z);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.051, 0.017, 4, 8), mugBody);
      handle.position.set(x + 0.098, desk.h + 0.126, z);
      details.add(mug, inset, handle);
    } else if (index === 1) {
      books.forEach((material, level) => {
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.044, 0.24), material);
        book.position.set(x, desk.h + 0.022 + level * 0.044, z);
        book.rotation.y = level === 1 ? -0.17 : 0.08;
        details.add(book);
      });
    } else if (index === 2) {
      props.push(place(details, 'furniture-kit', 'plantSmall2', x, desk.h, z, 0, { scale: 2 }));
    }
  }

  await Promise.all(props);
  scene.add(mergeStatic(details));
}

function makeContactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(23, 38, 36, 0.34)');
  gradient.addColorStop(0.52, 'rgba(23, 38, 36, 0.22)');
  gradient.addColorStop(1, 'rgba(23, 38, 36, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false,
  });
}

function entrySign({ x, z, width }) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#253d3b';
  ctx.fillRect(0, 0, 640, 256);
  ctx.fillStyle = '#edc24c';
  ctx.fillRect(0, 0, 18, 256);
  ctx.font = '700 66px system-ui, sans-serif';
  ctx.fillText('CHANNEL', 62, 116);
  ctx.fillStyle = '#f9f1d9';
  ctx.fillText('CLAN', 62, 192);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.28),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  sign.rotation.y = Math.PI;
  sign.position.set(x - width / 2 - 2.15, 1.63, z - 0.135);
  return sign;
}
