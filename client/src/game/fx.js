import * as THREE from 'three';
import { MAP_THEME } from '../../../shared/map.js';

export function softDot(inner = 'rgba(255,255,255,1)') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function footprintTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(70,80,120,0.55)';
  g.beginPath(); g.ellipse(16, 22, 10, 16, 0, 0, Math.PI * 2); g.fill(); // sole
  g.beginPath(); g.ellipse(16, 52, 8, 9, 0, 0, Math.PI * 2); g.fill(); // heel
  return new THREE.CanvasTexture(c);
}

// Particles (confetti, snow puffs) and footprints. Each is one draw call.
export function createFx(scene) {
  const N = 700;
  const pos = new Float32Array(N * 3).fill(-999), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N), grav = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, map: softDot(), vertexColors: true, transparent: true, depthWrite: false }));
  points.frustumCulled = false;
  scene.add(points);
  let next = 0;
  const c = new THREE.Color();

  const FP = 500;
  const prints = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.34).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: footprintTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), FP);
  const hidden = new THREE.Matrix4().makeTranslation(0, -999, 0);
  for (let i = 0; i < FP; i++) prints.setMatrixAt(i, hidden);
  prints.frustumCulled = false;
  scene.add(prints);
  let nextPrint = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();

  return {
    burst(x, y, z, { count = 40, colors = [0xffd23f, 0xff5e5b, 0x7bdff2, 0xb388ff, 0xffffff], speed = 4, upward = 4, gravity = 9, ttl = 1.2 } = {}) {
      for (let k = 0; k < count; k++) {
        const i = next; next = (next + 1) % N;
        const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
        pos.set([x, y, z], i * 3);
        vel.set([Math.cos(a) * s, upward * (0.5 + Math.random()), Math.sin(a) * s], i * 3);
        c.set(colors[k % colors.length]);
        col.set([c.r, c.g, c.b], i * 3);
        life[i] = ttl * (0.7 + Math.random() * 0.3);
        grav[i] = gravity;
      }
    },
    footprint(x, z, ry, side) {
      const ox = Math.cos(ry) * 0.14 * side, oz = -Math.sin(ry) * 0.14 * side; // to the left/right of the walking direction
      q.setFromAxisAngle(up, ry);
      m4.compose(v.set(x + ox, 0.025, z + oz), q, one);
      prints.setMatrixAt(nextPrint, m4);
      nextPrint = (nextPrint + 1) % FP; // oldest prints get reused: the trail "melts" from the far end
      prints.instanceMatrix.needsUpdate = true;
    },
    update(dt) {
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        const k = i * 3;
        if (life[i] <= 0) { pos[k + 1] = -999; continue; }
        vel[k + 1] -= grav[i] * dt;
        pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
        if (pos[k + 1] < 0.02) { pos[k + 1] = 0.02; vel[k] *= 0.6; vel[k + 2] *= 0.6; vel[k + 1] = 0; }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

// Leaves alternating footprints (and a snow puff when running) behind something that walks on the ground.
export function createTrail(fx, onStep) {
  let lx = null, lz = null, side = 1;
  return (x, y, z, ry, speed) => {
    if (lx === null || y > 0.05) { lx = x; lz = z; return; } // off the ground (stairs, decks) leaves no prints
    if (Math.hypot(x - lx, z - lz) < 0.65) return;
    lx = x; lz = z; side = -side;
    if (MAP_THEME !== 'office') fx.footprint(x, z, ry, side);
    onStep?.(speed);
    if (MAP_THEME !== 'office' && speed > 3.5) fx.burst(x, 0.05, z, { count: 4, colors: [0xffffff, 0xe6eeff], speed: 0.8, upward: 1.6, gravity: 5, ttl: 0.5 });
  };
}
