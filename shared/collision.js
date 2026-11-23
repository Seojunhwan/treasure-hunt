import { MAP_HALF, COLLIDERS, PLATFORMS, RAMPS } from './map.js';
import { PLAYER_HEIGHT, STEP_HEIGHT } from './constants.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// A box blocks a walker standing at height y if it reaches above their step height and
// starts below their head. So roofs and decks overhead, or posts under a deck, don't block.
const blocks = (b, y) => (b.y ?? 0) + b.h > y + STEP_HEIGHT && (b.y ?? 0) < y + PLAYER_HEIGHT;

// Pushes a circle (x, z, r) at height y out of every blocking box and back inside the map.
// Pushing out along the contact normal is what makes the player slide along walls.
export function resolveCollision(x, z, r, y = 0, boxes = COLLIDERS) {
  for (const b of boxes) {
    if (!blocks(b, y)) continue;
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

const inside = (s, x, z) => Math.abs(x - s.x) <= s.w / 2 && Math.abs(z - s.z) <= s.d / 2;

// Height of the highest surface under (x, z) that a walker at height y can step onto.
export function heightAt(x, z, y = 0, platforms = PLATFORMS, ramps = RAMPS) {
  let h = 0;
  const reach = y + STEP_HEIGHT;
  for (const p of platforms) if (p.y > h && p.y <= reach && inside(p, x, z)) h = p.y;
  for (const r of ramps) {
    if (!inside(r, x, z)) continue;
    const t = r.axis === 'x' ? (x - (r.x - r.w / 2)) / r.w : (z - (r.z - r.d / 2)) / r.d;
    const v = r.y0 + (r.y1 - r.y0) * t;
    if (v > h && v <= reach) h = v;
  }
  return h;
}

export function clampToCircle(x, z, c) {
  const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
  return d <= c.r ? { x, z } : { x: c.x + (dx / d) * c.r, z: c.z + (dz / d) * c.r };
}

// Distance along a ray (origin o, unit direction d) to the first box it hits, capped at max. Slab method.
export function rayCast(o, d, max, boxes = COLLIDERS) {
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

// True if nothing solid sits between two points (used so treasures can't be grabbed through walls).
export function lineOfSight(a, b, boxes = COLLIDERS) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  if (len < 1e-6) return true;
  return rayCast(a, d.map((v) => v / len), len, boxes) >= len - 1e-6;
}
