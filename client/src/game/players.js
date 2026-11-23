import * as THREE from 'three';
import { createAvatar, variantFor } from './avatar.js';
import { createTrail } from './fx.js';

function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(text, 128, 32);
  g.fillStyle = '#fff'; g.fillText(text, 128, 32);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false }));
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = 2.1;
  return sprite;
}

// Other players. shortcut: exponential smoothing toward the latest snapshot instead of
// buffered interpolation; upgrade if movement looks jerky on real phones.
export function createRemotePlayers(scene, fx) {
  const others = new Map();
  return {
    sync(list, selfId) {
      const seen = new Set();
      for (const p of list) {
        if (p.id === selfId) continue;
        seen.add(p.id);
        let o = others.get(p.id);
        if (!o) {
          const avatar = createAvatar(variantFor(p.id));
          const label = makeLabel(p.name);
          avatar.root.add(label);
          avatar.root.position.set(p.x, p.y ?? 0, p.z);
          scene.add(avatar.root);
          o = { avatar, label, target: p, trail: createTrail(fx) };
          others.set(p.id, o);
        }
        o.target = p;
      }
      for (const [id, o] of others) {
        if (seen.has(id)) continue;
        scene.remove(o.avatar.root);
        o.label.material.map.dispose(); o.label.material.dispose();
        others.delete(id);
      }
    },
    update(dt) {
      const k = 1 - Math.exp(-dt * 12);
      for (const { avatar, target, trail } of others.values()) {
        const p = avatar.root.position;
        const dx = (target.x - p.x) * k, dz = (target.z - p.z) * k;
        p.x += dx; p.z += dz;
        p.y += ((target.y ?? 0) - p.y) * k;
        avatar.root.rotation.y = target.ry;
        const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
        avatar.setSpeed(speed);
        trail(p.x, p.y, p.z, target.ry, speed);
        avatar.update(dt);
      }
    },
    pickUp(id) { others.get(id)?.avatar.pickUp(); },
    get count() { return others.size; },
  };
}
