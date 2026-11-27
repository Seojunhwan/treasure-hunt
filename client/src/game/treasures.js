import * as THREE from 'three';
import { load } from './kit.js';
import { softDot } from './fx.js';
import { TREASURE_SPOTS } from '../../../shared/map.js';

const LOOKS = ['present-a-cube', 'present-b-cube', 'present-a-round', 'present-b-round', 'present-a-rectangle', 'present-b-rectangle'];
const MAX = TREASURE_SPOTS.length;
const PAPER_HALF_DEPTH = 0.13;
const PAPER_GEOMETRY = new THREE.BoxGeometry(0.24, 0.004, PAPER_HALF_DEPTH);
const PAPER_UNDER = new THREE.MeshLambertMaterial({ color: 0xdfcfaf });
const PAPER_TOP = new THREE.MeshLambertMaterial({ color: 0xf5e5c5 });

function addFoldedNote(group) {
  const bottom = new THREE.Mesh(PAPER_GEOMETRY, PAPER_UNDER);
  bottom.position.y = 0.004;
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.008, -PAPER_HALF_DEPTH / 2);
  hinge.rotation.x = Math.PI - 0.28;
  const flap = new THREE.Mesh(PAPER_GEOMETRY, PAPER_TOP);
  flap.position.z = -PAPER_HALF_DEPTH / 2;
  hinge.add(flap);
  group.add(bottom, hinge);
  return hinge;
}

export function createTreasures(scene, fx, personal = false) {
  let items = [];
  const haloPos = new Float32Array(MAX * 3).fill(-999);
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  const haloMat = new THREE.PointsMaterial({ map: softDot('rgba(255,215,120,0.85)'), size: 1.5, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  if (personal) haloMat.opacity = 0.65;
  const halos = new THREE.Points(haloGeo, haloMat);
  halos.frustumCulled = false;
  scene.add(halos);
  const setHalo = (it, on) => { haloPos.set(on ? [it.t.x, it.t.y + 0.5, it.t.z] : [0, -999, 0], it.slot * 3); haloGeo.attributes.position.needsUpdate = true; };
  const hide = (it) => { it.g.visible = false; it.pop = 0; setHalo(it, false); };
  const byId = (id) => items.find((it) => it.t.id === id);

  return {
    // The layout is empty before the start.
    setLayout(list) {
      for (const it of items) scene.remove(it.g);
      haloPos.fill(-999);
      haloGeo.attributes.position.needsUpdate = true;
      items = list.slice(0, MAX).map((t, slot) => {
        const g = new THREE.Group();
        g.position.set(t.x, t.y, t.z);
        scene.add(g);
        const fold = t.kind === 'note' ? addFoldedNote(g) : null;
        if (!fold) load('holiday-kit', LOOKS[t.id % LOOKS.length]).then((o) => { o.scale.setScalar(personal ? 1.2 : 1.6); g.add(o); });
        const it = { t, g, slot, fold, pop: 0, tried: false };
        if (!fold) setHalo(it, true);
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
      if (!it.fold) fx.burst(it.t.x, it.t.y + 0.6, it.t.z);
    },
    nearest(x, z) {
      let best = null;
      for (const { t, g, pop, tried } of items) {
        if (!g.visible || pop || tried) continue;
        const dist = Math.hypot(t.x - x, t.z - z);
        if (!best || dist < best.dist) best = { ...t, dist };
      }
      return best;
    },
    update(now, dt) {
      haloMat.size = (personal ? 0.9 : 1.4) + Math.sin(now * 0.004) * 0.25;
      for (const it of items) {
        if (!it.g.visible) continue;
        if (it.pop) {
          it.pop += dt;
          if (it.fold) {
            const open = THREE.MathUtils.smoothstep(it.pop, 0, 0.35);
            it.fold.rotation.x = (Math.PI - 0.28) * (1 - open);
            it.g.position.y = it.t.y + open * 0.38;
            if (it.pop > 0.6) hide(it);
          } else {
            it.g.scale.setScalar(1 + it.pop * 4);
            if (it.pop > 0.18) hide(it);
          }
          continue;
        }
        if (it.fold) continue;
        it.g.rotation.y = now * 0.0008 + it.t.id;
        it.g.position.y = it.t.y + 0.15 + Math.sin(now * 0.002 + it.t.id) * 0.12;
      }
    },
  };
}
