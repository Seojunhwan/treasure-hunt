import { MAP_HALF, BUILDINGS } from './map.js';
import { PLAYER_HEIGHT } from './constants.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Pushes a circle (x, z, r) out of every box and back inside the map. Pushing out along
// the contact normal is what makes the player slide along walls instead of sticking.
export function resolveCollision(x, z, r, boxes = BUILDINGS) {
  for (const b of boxes) {
    if ((b.y ?? 0) >= PLAYER_HEIGHT) continue; // roofs: walk underneath
    const minX = b.x - b.w / 2, maxX = b.x + b.w / 2, minZ = b.z - b.d / 2, maxZ = b.z + b.d / 2;
    const dx = x - clamp(x, minX, maxX), dz = z - clamp(z, minZ, maxZ);
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 0) {
      const d = Math.sqrt(d2);
      x += (dx / d) * (r - d);
      z += (dz / d) * (r - d);
    } else {
      // center is inside the box: leave through the nearest face
      const exits = [[minX - r - x, 0], [maxX + r - x, 0], [0, minZ - r - z], [0, maxZ + r - z]];
      const [ex, ez] = exits.reduce((a, e) => (Math.abs(e[0] + e[1]) < Math.abs(a[0] + a[1]) ? e : a));
      x += ex; z += ez;
    }
  }
  const lim = MAP_HALF - r;
  return { x: clamp(x, -lim, lim), z: clamp(z, -lim, lim) };
}

export function clampToCircle(x, z, c) {
  const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
  return d <= c.r ? { x, z } : { x: c.x + (dx / d) * c.r, z: c.z + (dz / d) * c.r };
}

// Distance along a ray (origin o, unit direction d) to the first box it hits, capped at max.
// Boxes are the map's: x/z center, w/d size, h height, optional y base. Slab method.
export function rayCast(o, d, max, boxes = BUILDINGS) {
  let best = max;
  for (const b of boxes) {
    const y0 = b.y ?? 0;
    const lo = [b.x - b.w / 2, y0, b.z - b.d / 2], hi = [b.x + b.w / 2, y0 + b.h, b.z + b.d / 2];
    let t0 = 0, t1 = best;
    for (let i = 0; i < 3 && t0 <= t1; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) t0 = Infinity; continue; }
      let a = (lo[i] - o[i]) / d[i], z = (hi[i] - o[i]) / d[i];
      if (a > z) [a, z] = [z, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, z);
    }
    if (t0 <= t1 && t0 < best) best = t0;
  }
  return best;
}
