import * as map from './map.js';
import { PLAYER_RADIUS, PLAYER_HEIGHT, STEP_HEIGHT, GRAVITY, MAX_FALL, HEAD_ROOM } from './constants.js';

const { MAP_HALF, COLLIDERS, PLATFORMS, RAMPS, GROUND_LEVELS = [] } = map;
export const MIN_GROUND_Y = Math.min(0, ...GROUND_LEVELS.map(({ y }) => y));

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

export function firstPlayerContact(from, to, players) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  if (!lengthSquared) return null;
  let time = 1, blocker = null;
  for (const other of players) {
    if (Math.abs(from.y - other.y) >= PLAYER_HEIGHT) continue;
    const x = from.x - other.x, z = from.z - other.z;
    const radius = 2 * PLAYER_RADIUS;
    const gap = x * x + z * z - radius * radius;
    const approach = x * dx + z * dz;
    // Players already overlapping on spawn or after interpolation can walk apart.
    if (gap < -1e-8 || approach >= -1e-8) continue;
    const discriminant = approach * approach - gap * lengthSquared;
    if (discriminant <= 0) continue;
    const hit = Math.max(0, (-approach - Math.sqrt(discriminant)) / lengthSquared);
    if (hit < time) { time = hit; blocker = other; }
  }
  return blocker ? { x: from.x + dx * time, y: from.y, z: from.z + dz * time, blocker } : null;
}

// Stop at contact and keep only the sideways part of the remaining step.
export function resolvePlayerCollision(from, to, players) {
  const contact = firstPlayerContact(from, to, players);
  if (!contact) return to;
  const normalX = (contact.x - contact.blocker.x) / (2 * PLAYER_RADIUS);
  const normalZ = (contact.z - contact.blocker.z) / (2 * PLAYER_RADIUS);
  const into = (to.x - contact.x) * normalX + (to.z - contact.z) * normalZ;
  const slide = { x: to.x - normalX * into, z: to.z - normalZ * into };
  const nextContact = firstPlayerContact(contact, slide, players);
  return nextContact ? { x: nextContact.x, z: nextContact.z } : slide;
}

const inside = (s, x, z) => Math.abs(x - s.x) <= s.w / 2 && Math.abs(z - s.z) <= s.d / 2;

export const groundHeight = (x, z) => GROUND_LEVELS.find((surface) => inside(surface, x, z))?.y ?? 0;

// Height of the highest surface under (x, z) that a walker at height y can step onto.
export function heightAt(x, z, y = 0, platforms = PLATFORMS, ramps = RAMPS) {
  let h = groundHeight(x, z);
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

// Lowest roof, deck or slab over (x, z) that starts above a walker standing at y (Infinity if open sky).
export function ceilingAt(x, z, y, boxes = COLLIDERS, platforms = PLATFORMS) {
  let c = Infinity;
  for (const b of boxes) {
    const by = b.y ?? 0;
    if (by >= y + STEP_HEIGHT && by < c && Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2) c = by;
  }
  for (const p of platforms) if (p.y > y + STEP_HEIGHT && p.y - 0.15 < c && inside(p, x, z)) c = p.y - 0.15;
  return c;
}

const SNAP_DOWN = 0.35; // a grounded walker follows stairs and ramps down instead of hopping off them

// One frame of vertical motion: gravity, head bumps, landing. vy > 0 is up.
export function verticalStep(x, z, y, vy, grounded, dt) {
  vy = Math.max(vy - GRAVITY * dt, -MAX_FALL);
  let ny = y + vy * dt;
  if (vy > 0) {
    const c = ceilingAt(x, z, y);
    if (ny + HEAD_ROOM > c) { ny = Math.max(y, c - HEAD_ROOM); vy = 0; }
  }
  const ground = heightAt(x, z, Math.max(y, ny)); // rising past a ledge within step reach lands on it
  if (ny <= ground || (grounded && vy <= 0 && y - ground <= SNAP_DOWN)) return { y: ground, vy: 0, grounded: true };
  return { y: ny, vy, grounded: false };
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

export function treasureTarget({ x, y, z, kind }) {
  return [x, y + (kind === 'note' ? 0.025 : 0.4), z];
}

export function treasureInSight(origin, treasure) {
  const target = treasureTarget(treasure);
  const { cover } = treasure;
  return lineOfSight(origin, target) && (!cover || lineOfSight(origin, target, [cover]));
}
