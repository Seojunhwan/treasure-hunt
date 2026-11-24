import * as THREE from 'three';
import { load } from './kit.js';
import { softDot } from './fx.js';
import { TREASURE_SPOTS } from '../../../shared/map.js';

const LOOKS = ['present-a-cube', 'present-b-cube', 'present-a-round', 'present-b-round', 'present-a-rectangle', 'present-b-rectangle'];
const MAX = TREASURE_SPOTS.length; // one gift per question at most

// Gift boxes from the Holiday Kit: they sit where they're hidden, turn slowly and glow so a sharp eye can spot them.
// The server decides where they are each game (one per quiz question), so the set is rebuilt on start.
export function createTreasures(scene, fx) {
  let items = [];
  const haloPos = new Float32Array(MAX * 3).fill(-999);
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  const haloMat = new THREE.PointsMaterial({ map: softDot('rgba(255,215,120,0.85)'), size: 1.5, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const halos = new THREE.Points(haloGeo, haloMat);
  halos.frustumCulled = false;
  scene.add(halos);
  const setHalo = (it, on) => { haloPos.set(on ? [it.t.x, it.t.y + 0.5, it.t.z] : [0, -999, 0], it.slot * 3); haloGeo.attributes.position.needsUpdate = true; };
  const hide = (it) => { it.g.visible = false; it.pop = 0; setHalo(it, false); };
  const byId = (id) => items.find((it) => it.t.id === id);

  return {
    // list: [{ id, x, y, z }] for this game; [] before the start
    setLayout(list) {
      for (const it of items) scene.remove(it.g);
      haloPos.fill(-999);
      items = list.slice(0, MAX).map((t, slot) => {
        const g = new THREE.Group();
        g.position.set(t.x, t.y, t.z);
        scene.add(g);
        load('holiday-kit', LOOKS[t.id % LOOKS.length]).then((o) => { o.scale.setScalar(1.6); g.add(o); });
        const it = { t, g, slot, pop: 0, tried: false };
        setHalo(it, true);
        return it;
      });
    },
    setFound(ids) {
      const found = new Set(ids);
      for (const it of items) if (found.has(it.t.id) && it.g.visible && !it.pop) hide(it);
    },
    // a gift this player already got wrong: greyed out, no glow, no open button
    markTried(id) {
      const it = byId(id);
      if (!it || it.tried) return;
      it.tried = true;
      setHalo(it, false);
      it.g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.35); } });
    },
    collect(id) {
      const it = byId(id);
      if (!it || !it.g.visible || it.pop) return;
      it.pop = 0.001;
      fx.burst(it.t.x, it.t.y + 0.6, it.t.z);
    },
    nearest(x, z) {
      let best = null;
      for (const { t, g, pop, tried } of items) {
        if (!g.visible || pop || tried) continue;
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
          if (it.pop > 0.18) hide(it);
          continue;
        }
        it.g.rotation.y = now * 0.0008 + it.t.id;
      }
    },
  };
}
