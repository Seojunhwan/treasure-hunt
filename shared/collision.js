import { MAP_HALF, BUILDINGS } from './map.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Pushes a circle (x, z, r) out of every box and back inside the map. Pushing out along
// the contact normal is what makes the player slide along walls instead of sticking.
export function resolveCollision(x, z, r, boxes = BUILDINGS) {
  for (const b of boxes) {
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
