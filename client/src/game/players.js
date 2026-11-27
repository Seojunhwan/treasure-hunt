import * as THREE from 'three';
import { createAvatar, variantFor } from './avatar.js';
import { createTrail } from './fx.js';

export function makeLabel(text, { nameplate = false } = {}) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; // without it the cream text was read as linear: far too bright
  const font = nameplate ? '48px Jua' : '36px Jua';
  const draw = () => {
    g.clearRect(0, 0, 256, 64);
    g.font = `${font}, system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (nameplate) {
      g.beginPath();
      g.roundRect(12, 3, 232, 58, 12);
      g.fillStyle = '#f8ce52';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#795919';
      g.stroke();
      g.fillStyle = '#302205';
    } else {
      g.lineWidth = 7; g.strokeStyle = 'rgba(20,14,10,.75)'; g.strokeText(text, 128, 34, 244);
      g.fillStyle = '#fbf3e2';
    }
    g.fillText(text, 128, 34, nameplate ? 218 : 244);
    tex.needsUpdate = true;
  };
  draw();
  document.fonts.load(font, text).then(draw); // redraw once the needed font slices arrive
  // dimmed under the bloom threshold so names read clearly instead of glowing like lamps
  const tint = nameplate ? 0.85 : 0.62;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, color: new THREE.Color(tint, tint, tint) }));
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = 2.1;
  return sprite;
}

// Other players are drawn a little in the past (DELAY) so there are always two snapshots to blend
// between: steady motion and a steady speed for the walk/run animation, at the cost of 120 ms lag.
const DELAY = 120;
const lerpAngle = (a, b, t) => a + (Math.atan2(Math.sin(b - a), Math.cos(b - a))) * t;

export function createRemotePlayers(scene, fx) {
  const others = new Map();
  return {
    sync(list, selfId) {
      const now = performance.now();
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
          o = { avatar, label, buf: [], speed: 0, trail: createTrail(fx) };
          others.set(p.id, o);
        }
        o.buf.push({ t: now, x: p.x, y: p.y ?? 0, z: p.z, ry: p.ry, air: !!p.air });
        if (o.buf.length > 8) o.buf.shift();
      }
      for (const [id, o] of others) {
        if (seen.has(id)) continue;
        scene.remove(o.avatar.root);
        o.label.material.map.dispose(); o.label.material.dispose();
        others.delete(id);
      }
    },
    update(dt) {
      const renderT = performance.now() - DELAY;
      for (const o of others.values()) {
        const { avatar, buf, trail } = o;
        // newest pair (a, b) that brackets renderT; before/after the buffer just hold the end
        let i = buf.length - 1;
        while (i > 0 && buf[i - 1].t > renderT) i--;
        const a = buf[Math.max(0, i - 1)], b = buf[i];
        const t = b.t > a.t ? Math.min(1, Math.max(0, (renderT - a.t) / (b.t - a.t))) : 1;
        const pos = avatar.root.position;
        const px = pos.x, pz = pos.z;
        pos.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
        if (dt > 0) { o.vx = (pos.x - px) / dt; o.vz = (pos.z - pz) / dt; }
        avatar.root.rotation.y = lerpAngle(a.ry, b.ry, t);
        const seg = b.t > a.t && renderT <= b.t ? Math.hypot(b.x - a.x, b.z - a.z) / ((b.t - a.t) / 1000) : 0;
        o.speed += (seg - o.speed) * (1 - Math.exp(-dt * 8)); // smoothed so the clip doesn't flicker
        avatar.setAir(b.air ? (b.y > a.y ? 'jump' : 'fall') : null);
        avatar.setSpeed(o.speed);
        trail(pos.x, pos.y, pos.z, avatar.root.rotation.y, b.air ? 0 : o.speed);
        avatar.update(dt);
      }
    },
    pickUp(id) { others.get(id)?.avatar.pickUp(); },
    // where everyone is and how fast they move, for pushable props
    pushers(out) {
      for (const o of others.values()) {
        const p = o.avatar.root.position;
        out.push({ x: p.x, z: p.z, vx: o.vx ?? 0, vz: o.vz ?? 0, r: 0.4 });
      }
      return out;
    },
    get count() { return others.size; },
  };
}
