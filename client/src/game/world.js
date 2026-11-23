import * as THREE from 'three';
import { MAP_HALF, SPAWN, BUILDINGS } from '../../../shared/map.js';

// shortcut: grey boxes stand in for the village until the art pass (Task 13)
export function buildWorld(scene) {
  scene.background = new THREE.Color(0xbfd4e6);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2), new THREE.MeshLambertMaterial({ color: 0xf4f7fb }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  scene.add(new THREE.GridHelper(MAP_HALF * 2, 50, 0x9fb3c8, 0xd5dee8));

  const plaza = new THREE.Mesh(new THREE.RingGeometry(SPAWN.r - 0.3, SPAWN.r, 48), new THREE.MeshBasicMaterial({ color: 0x4a90d9 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(SPAWN.x, 0.02, SPAWN.z);
  scene.add(plaza);

  const mat = new THREE.MeshLambertMaterial({ color: 0xa88b6a });
  for (const b of BUILDINGS) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    m.position.set(b.x, b.h / 2, b.z);
    scene.add(m);
  }
}
