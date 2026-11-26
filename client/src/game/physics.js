import * as THREE from 'three';
import { resolveCollision } from '../../../shared/collision.js';
import { load } from './kit.js';
import { MAP_THEME } from '../../../shared/map.js';

// Pushable props: snowballs roll, sleds slide, little snowmen wobble. A few sit in the spawn
// plaza on purpose: something to kick around while waiting for the start.
// shortcut: each phone simulates its own copy (pushed by every player it can see), so copies can
// drift apart a little between phones. Fine for toys that never hide treasures; make it
// server-authoritative if props ever matter to the game.
export const BODIES = MAP_THEME === 'office' ? [] : [
  ...[[3, -9, 0.55], [-3.2, -10, 0.45], [5.5, 4.5, 0.6], [-6, -3, 0.4], [2.2, 30, 0.6], [-2.5, -36, 0.5], [30, 2.5, 0.55], [-36, -2.4, 0.5], [16, -40, 0.6], [-18, 40, 0.55], [38, -30, 0.45], [-30, 20, 0.6]]
    .map(([x, z, r]) => ({ kind: 'snowball', x, z, r, mass: r * 3 })),
  ...[[-2.6, 14, 0.3], [27, -33, 1.2], [-33, 39, 2.4], [12, 36, 0.8]].map(([x, z, ry]) => ({ kind: 'sled', x, z, r: 0.7, ry, mass: 2 })),
  ...[[-5.5, 6, 0], [6, -5.5, 2], [-21, 28, 1], [33, -20, 3], [-45, -5, 1]].map(([x, z, ry]) => ({ kind: 'snowman', x, z, r: 0.45, ry, mass: 2.5 })),
];
const FRICTION = 2.2; // 1/s
const BOUNCE = 0.45;

export function createProps(scene, onBump) {
  const snowMat = new THREE.MeshLambertMaterial({ color: 0xf2f5ff });
  const ballGeo = new THREE.IcosahedronGeometry(1, 2);
  const bodies = BODIES.map((b) => {
    const o = new THREE.Group();
    const s = { ...b, vx: 0, vz: 0, ry: b.ry ?? 0, tilt: 0, tiltV: 0, o, inner: null };
    if (b.kind === 'snowball') {
      const m = new THREE.Mesh(ballGeo, snowMat);
      m.scale.setScalar(b.r);
      m.position.y = b.r;
      s.inner = m;
      o.add(m);
    } else {
      load('holiday-kit', b.kind === 'sled' ? 'sled' : 'snowman').then((m) => { m.scale.setScalar(b.kind === 'sled' ? 1.8 : 1.1); o.add(m); });
    }
    o.position.set(b.x, 0, b.z);
    scene.add(o);
    return s;
  });

  const q = new THREE.Quaternion(), axis = new THREE.Vector3();
  let bumpCooldown = 0;
  return {
    // pushers: [{ x, z, vx, vz, r }] — every player we can see
    bodies,
    update(dt, pushers, listener) {
      bumpCooldown -= dt;
      for (const b of bodies) {
        for (const p of pushers) {
          const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz), min = b.r + p.r;
          if (d >= min || d < 1e-6) continue;
          const nx = dx / d, nz = dz / d;
          b.x += nx * (min - d); b.z += nz * (min - d); // never overlap a player
          const along = Math.min(6, p.vx * nx + p.vz * nz); // how hard they walked into it (capped: teleport-y frames spike)
          if (along > 0) {
            // kick it up to a bit faster than the walker (lighter things fly further), never accumulate
            const want = along * (1.3 / Math.sqrt(b.mass)), vn = b.vx * nx + b.vz * nz;
            if (vn < want) { b.vx += nx * (want - vn); b.vz += nz * (want - vn); }
            if (along > 1.5 && bumpCooldown <= 0 && Math.hypot(b.x - listener.x, b.z - listener.z) < 12) {
              onBump?.(Math.min(1, along / 5));
              bumpCooldown = 0.25;
            }
          }
        }
      }
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.r + b.r;
        if (d >= min || d < 1e-6) continue;
        const nx = dx / d, nz = dz / d, push = (min - d) / 2;
        a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
        const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz; // closing speed
        if (rel > 0) {
          const imp = (1 + BOUNCE) * rel / (1 / a.mass + 1 / b.mass);
          a.vx -= imp / a.mass * nx; a.vz -= imp / a.mass * nz;
          b.vx += imp / b.mass * nx; b.vz += imp / b.mass * nz;
        }
      }
      const f = Math.exp(-FRICTION * dt);
      for (const b of bodies) {
        const ox = b.x, oz = b.z;
        b.x += b.vx * dt; b.z += b.vz * dt;
        const p = resolveCollision(b.x, b.z, b.r, 0);
        if (p.x !== b.x || p.z !== b.z) {
          // hit a wall: bounce off its normal
          const nx = p.x - b.x, nz = p.z - b.z, nl = Math.hypot(nx, nz) || 1;
          const vn = (b.vx * nx + b.vz * nz) / nl;
          if (vn < 0) { b.vx -= (1 + BOUNCE) * vn * nx / nl; b.vz -= (1 + BOUNCE) * vn * nz / nl; }
          b.x = p.x; b.z = p.z;
        }
        b.vx *= f; b.vz *= f;
        const speed = Math.hypot(b.vx, b.vz);
        if (speed < 0.02) { b.vx = b.vz = 0; }
        b.o.position.set(b.x, 0, b.z);
        if (b.kind === 'snowball' && speed > 0) {
          // roll: rotate about the axis perpendicular to travel, by distance / radius
          axis.set(b.vz, 0, -b.vx).normalize();
          q.setFromAxisAngle(axis, Math.hypot(b.x - ox, b.z - oz) / b.r);
          b.inner.quaternion.premultiply(q);
        } else if (b.kind === 'sled') {
          if (speed > 0.3) b.ry += Math.atan2(Math.sin(Math.atan2(b.vx, b.vz) - b.ry), Math.cos(Math.atan2(b.vx, b.vz) - b.ry)) * (1 - Math.exp(-dt * 4));
          b.o.rotation.y = b.ry;
        } else if (b.kind === 'snowman') {
          // damped spring wobble, kicked by speed
          b.tiltV += (-60 * b.tilt - 6 * b.tiltV + speed * 6) * dt;
          b.tilt += b.tiltV * dt;
          b.o.rotation.set(0, 0, 0);
          if (speed > 0.01) { axis.set(b.vz, 0, -b.vx).normalize(); b.o.quaternion.setFromAxisAngle(axis, Math.max(-0.5, Math.min(0.5, b.tilt))); }
          b.o.rotateY(b.ry);
        }
      }
    },
  };
}
