import * as THREE from 'three';
import { TREASURES } from '../../../shared/map.js';

// shortcut: gold boxes stand in for treasure chests until the art pass (Task 14)
export function createTreasures(scene) {
  const geo = new THREE.BoxGeometry(0.7, 0.5, 0.5);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffc83d, emissive: 0x553300 });
  const meshes = TREASURES.map((t) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(t.x, 0.35, t.z);
    scene.add(m);
    return m;
  });
  return {
    setFound(ids) {
      const found = new Set(ids);
      meshes.forEach((m, i) => { m.visible = !found.has(i); });
    },
    hide(id) { meshes[id].visible = false; },
    nearest(x, z) {
      let best = null;
      meshes.forEach((m, id) => {
        if (!m.visible) return;
        const dist = Math.hypot(m.position.x - x, m.position.z - z);
        if (!best || dist < best.dist) best = { id, dist };
      });
      return best;
    },
    update(t) {
      for (const m of meshes) if (m.visible) m.rotation.y = t * 0.0015;
    },
  };
}
