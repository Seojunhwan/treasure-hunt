// Dev-only page: lays out every model of a pack in a labelled grid. /catalog.html?pack=holiday-kit&filter=cabin
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const q = new URLSearchParams(location.search);
const pack = q.get('pack') ?? 'holiday-kit';
const filter = q.get('filter') ?? '';
const cols = Number(q.get('cols') ?? 10), gap = Number(q.get('gap') ?? 2.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x334455);
scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(5, 10, 7); scene.add(sun);

function label(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 40;
  const g = c.getContext('2d'); g.font = '22px sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(text, 128, 28);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
  s.scale.set(2.2, 0.35, 1); return s;
}

const index = await (await fetch('/assets/index.json')).json();
const files = index[pack].filter((f) => f.includes(filter));
const loader = new GLTFLoader();
const sizes = {};
await Promise.all(files.map(async (f, i) => {
  const gltf = await loader.loadAsync(`/assets/${pack}/${f}`);
  const x = (i % cols) * gap, z = Math.floor(i / cols) * gap;
  gltf.scene.position.set(x, 0, z);
  scene.add(gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene), sz = box.getSize(new THREE.Vector3());
  sizes[f] = [sz.x, sz.y, sz.z].map((v) => +v.toFixed(2));
  const l = label(f.replace(/\.gl.+$/, '')); l.position.set(x, -0.2, z + 0.9); scene.add(l);
}));
const rows = Math.ceil(files.length / cols);
const cx = ((cols - 1) * gap) / 2, cz = ((rows - 1) * gap) / 2;
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 500);
const span = Math.max(cols, rows) * gap;
camera.position.set(cx, span * 0.95, cz + span * 0.75);
camera.lookAt(cx, 0, cz);
renderer.render(scene, camera);
window.__sizes = sizes;
document.title = 'ready';
