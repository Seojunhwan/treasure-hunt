import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAvatar } from './game/avatar.js';
import { mergeStatic } from './game/world.js';
import { buildOfficeWorld } from './game/office-world.js';
import { FLOOR, LOUNGE, LOUNGE_PASSAGE, OFFICE_DOORS, OFFICE_LAYOUT, OFFICE_SCALE, TREASURE_SPOTS } from '../../shared/maps/office.js';

const params = new URLSearchParams(location.search);
const officePoint = (x, y, z) => new THREE.Vector3(x * OFFICE_SCALE, y * OFFICE_SCALE, z * OFFICE_SCALE);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe3e9ea);
const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 1, 600);
const overviewNorth = FLOOR.z - FLOOR.d / 2;
const overviewSouth = LOUNGE.z + LOUNGE.d / 2;
const overviewWest = Math.min(FLOOR.x - FLOOR.w / 2, LOUNGE.x - LOUNGE.w / 2);
const overviewEast = Math.max(FLOOR.x + FLOOR.w / 2, LOUNGE.x + LOUNGE.w / 2);
const overview = {
  x: (overviewWest + overviewEast) / 2,
  z: (overviewNorth + overviewSouth) / 2,
  w: overviewEast - overviewWest,
  d: overviewSouth - overviewNorth,
};

function frameRoom({ x, z, w, d }, fromEntrance = false) {
  const height = Math.max(d, w / camera.aspect) * 1.2 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const target = new THREE.Vector3(x, 0, z);
  return { target, pos: target.clone().add(new THREE.Vector3(height * 0.05, height, height * (fromEntrance ? -0.28 : 0.28))) };
}

const initial = frameRoom(overview);
camera.position.copy(initial.pos);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(initial.target);
controls.enableDamping = true;
controls.minDistance = 7; controls.maxDistance = 450;
controls.maxPolarAngle = Math.PI * 0.46;

const frontRowZ = OFFICE_LAYOUT.deskSections.at(-1).z;
const avatar = createAvatar('male-a');
const deskAvatarPosition = officePoint(7.25, 0, frontRowZ + 1.65);
avatar.root.position.copy(deskAvatarPosition);
avatar.root.rotation.y = Math.PI + 0.2;
scene.add(avatar.root);

const markerGroup = new THREE.Group(); markerGroup.visible = false; scene.add(markerGroup);
const markerMat = new THREE.MeshBasicMaterial({ color: 0xd99424, depthTest: false });
for (const [i, p] of TREASURE_SPOTS.entries()) {
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), markerMat);
  marker.position.set(p.x, p.y + 0.5, p.z);
  marker.rotation.y = Math.PI / 4; marker.renderOrder = 10; marker.userData.id = i;
  markerGroup.add(marker);
}
document.getElementById('gifts').onclick = (event) => {
  markerGroup.visible = !markerGroup.visible;
  event.currentTarget.setAttribute('aria-pressed', String(markerGroup.visible));
  event.currentTarget.classList.toggle('active', markerGroup.visible);
};
const views = document.querySelectorAll('[data-zone]');
const entry = OFFICE_DOORS.find(({ id }) => id === 'entry');
let destination = null;
views.forEach((button) => button.onclick = () => {
  const zone = button.dataset.zone;
  views.forEach((other) => other.classList.toggle('active', other === button));
  avatar.root.position.copy(deskAvatarPosition);
  avatar.root.rotation.y = Math.PI + 0.2;
  if (zone === 'lounge') {
    destination = frameRoom(LOUNGE, true);
  } else if (zone === 'mirror') {
    const { x, z, d } = OFFICE_LAYOUT.lounge.mirrorPillar;
    const face = z - d / 2;
    destination = { target: officePoint(x, 1.55, face), pos: officePoint(x, 2.45, face - 6.2) };
    avatar.root.position.copy(officePoint(x + 0.68, 0, face - 2.6));
    avatar.root.rotation.y = Math.PI - 0.3;
  } else if (zone === 'passage') {
    const { x, z, h } = LOUNGE_PASSAGE;
    destination = {
      target: new THREE.Vector3(x, h / 2, z - 0.25),
      pos: new THREE.Vector3(x, h / 2, z + 7.4),
    };
  } else if (zone === 'entry') {
    destination = {
      target: new THREE.Vector3(entry.x, 0, entry.z),
      pos: new THREE.Vector3(entry.x - 4, 24, entry.z + 9),
    };
  } else if (zone === 'desks') {
    destination = {
      target: officePoint(3, 0.7, frontRowZ),
      pos: officePoint(9, 7.5, frontRowZ + 8),
    };
  } else {
    destination = frameRoom(overview);
  }
});
controls.addEventListener('start', () => { destination = null; });
const initialView = Array.from(views).find((button) => button.dataset.zone === params.get('view'));
initialView?.click();
const status = document.getElementById('status');
try {
  await buildOfficeWorld(scene, mergeStatic);
  status.hidden = true;
  document.documentElement.dataset.ready = 'true';
} catch (error) {
  status.textContent = '사무실에 가구를 불러오지 못했습니다.';
  console.error(error);
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});
let previousFrame = performance.now();
renderer.setAnimationLoop((now) => {
  avatar.update(Math.min((now - previousFrame) / 1000, 0.1));
  previousFrame = now;
  if (destination) {
    camera.position.lerp(destination.pos, 0.065); controls.target.lerp(destination.target, 0.065);
    if (camera.position.distanceTo(destination.pos) < 0.02) destination = null;
  }
  controls.update(); renderer.render(scene, camera);
});
window.__office = { scene, camera, controls, markers: markerGroup, treasureCount: TREASURE_SPOTS.length };
