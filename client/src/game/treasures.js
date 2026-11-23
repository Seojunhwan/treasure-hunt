import * as THREE from 'three';
import { TREASURES } from '../../../shared/map.js';
import { load } from './kit.js';
import { softDot } from './fx.js';

const LOOKS = ['present-a-cube', 'present-b-cube', 'present-a-round', 'present-b-round', 'present-a-rectangle', 'present-b-rectangle'];

// Gift boxes from the Holiday Kit: they float, turn and glow so a sharp eye can spot them.
export function createTreasures(scene, fx) {
  const items = TREASURES.map((t) => {
    const g = new THREE.Group();
    g.position.set(t.x, t.y, t.z);
    scene.add(g);
    load('holiday-kit', LOOKS[t.id % LOOKS.length]).then((o) => { o.scale.setScalar(1.6); g.add(o); });
    return { t, g, pop: 0 };
  });
  const haloPos = new Float32Array(TREASURES.flatMap((t) => [t.x, t.y + 0.5, t.z]));
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  const haloMat = new THREE.PointsMaterial({ map: softDot('rgba(255,215,120,0.85)'), size: 1.5, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  scene.add(new THREE.Points(haloGeo, haloMat));
  const setHalo = (id, on) => { haloPos[id * 3 + 1] = on ? TREASURES[id].y + 0.5 : -999; haloGeo.attributes.position.needsUpdate = true; };
  const hide = (id) => { items[id].g.visible = false; items[id].pop = 0; setHalo(id, false); };

  return {
    setFound(ids) {
      const found = new Set(ids);
      for (const it of items) {
        const isFound = found.has(it.t.id);
        if (isFound && it.g.visible && !it.pop) hide(it.t.id);
        if (!isFound && !it.g.visible) { it.g.visible = true; it.g.scale.setScalar(1); setHalo(it.t.id, true); } // after a reset
      }
    },
    // pop + confetti, then gone
    collect(id) {
      const it = items[id];
      if (!it.g.visible || it.pop) return;
      it.pop = 0.001;
      fx.burst(it.t.x, it.t.y + 0.6, it.t.z);
    },
    nearest(x, z) {
      let best = null;
      for (const { t, g, pop } of items) {
        if (!g.visible || pop) continue;
        const dist = Math.hypot(t.x - x, t.z - z);
        if (!best || dist < best.dist) best = { id: t.id, dist, x: t.x, y: t.y, z: t.z };
      }
      return best;
    },
    update(now, dt) {
      haloMat.size = 1.4 + Math.sin(now * 0.004) * 0.25;
      for (const it of items) {
        if (!it.g.visible) continue;
        if (it.pop) {
          it.pop += dt;
          it.g.scale.setScalar(1 + it.pop * 4);
          if (it.pop > 0.18) hide(it.t.id);
          continue;
        }
        it.g.rotation.y = now * 0.0008 + it.t.id;
        it.g.position.y = it.t.y + 0.15 + Math.sin(now * 0.002 + it.t.id) * 0.12;
      }
    },
  };
}
