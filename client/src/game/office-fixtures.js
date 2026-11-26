import * as THREE from 'three';
import { OFFICE_LAYOUT } from '../../../shared/maps/office.js';
import { load } from './kit.js';

export async function addFixtures(scene, mergeStatic) {
  const { airPurifiers, floorProps, waterDispenser: dispenser } = OFFICE_LAYOUT;
  const details = new THREE.Group();
  details.add(waterDispenser(dispenser), ...airPurifiers.map(airPurifier));
  await Promise.all(floorProps.map(({ model, x, z, w, h, d, q }) =>
    placeSizedOfficeModel(details, model, x, 0, z, w, h, d, q),
  ));
  scene.add(mergeStatic(details));
}

const paint = (color) => new THREE.MeshLambertMaterial({ color });

function block(parent, w, h, d, x, y, z, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
}

export async function placeSizedOfficeModel(parent, name, x, y, z, w, h, d, q) {
  const model = await load('furniture-kit', name);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  const group = new THREE.Group();
  group.add(model);
  const turned = q % 2 === 1;
  group.scale.set((turned ? d : w) / size.x, h / size.y, (turned ? w : d) / size.z);
  group.rotation.y = q * Math.PI / 2;
  group.position.set(x, y, z);
  parent.add(group);
}

function waterDispenser({ x, z, w, d, h }) {
  const group = new THREE.Group();
  const shell = paint(0xf0eee4);
  const recess = paint(0x537479);
  const water = paint(0x76bdce);
  const lid = paint(0x5898a9);
  const bodyHeight = h - 0.56;
  const front = d / 2 - 0.035;

  block(group, w, bodyHeight, d - 0.075, 0, bodyHeight / 2, -0.0375, shell);
  block(group, w * 0.64, 0.39, 0.04, 0, 0.80, front, recess);
  block(group, w * 0.69, 0.055, 0.105, 0, 0.61, d / 2 - 0.0525, recess);
  block(group, 0.085, 0.075, 0.07, -0.092, 0.94, d / 2 - 0.035, paint(0x74b8d6));
  block(group, 0.085, 0.075, 0.07, 0.092, 0.94, d / 2 - 0.035, paint(0xd98e7b));
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.17, 0.46, 10), water);
  bottle.position.y = bodyHeight + 0.23;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.205, 0.10, 10), lid);
  cap.position.y = h - 0.05;
  group.add(bottle, cap);
  group.position.set(x, 0, z);
  group.rotation.y = -Math.PI / 2;
  return group;
}

function airPurifier({ x, z, w, d, h, q }) {
  const group = new THREE.Group();
  const shell = paint(0xf1ede4);
  const vents = paint(0x758b88);
  const accent = paint(0x5ca590);
  const front = d / 2 - 0.022;
  block(group, w, h - 0.052, d - 0.055, 0, (h - 0.052) / 2, -0.0275, shell);
  block(group, w * 0.9, 0.052, d * 0.94, 0, h - 0.026, -0.015, vents);
  for (let line = 0; line < 5; line++) {
    block(group, w * 0.7, 0.018, 0.04, 0, 0.27 + line * 0.063, front, vents);
  }
  block(group, 0.064, 0.023, 0.04, 0, h - 0.135, front, accent);
  group.position.set(x, 0, z);
  group.rotation.y = q * Math.PI / 2;
  return group;
}
