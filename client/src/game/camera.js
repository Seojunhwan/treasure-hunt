import * as THREE from 'three';
import { CAMERA_DISTANCE, CAMERA_MIN_PITCH, CAMERA_MAX_PITCH, LOOK_SENSITIVITY } from '../../../shared/constants.js';
import { rayCast } from '../../../shared/collision.js';

const PIVOT_Y = 1.4; // orbit around the head, not the feet
const WALL_GAP = 0.3; // keep the lens this far in front of a wall

// Orbit camera that trails a target. yaw 0 = camera on +z side looking toward -z.
export function createFollowCamera() {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  let yaw = 0, pitch = 0.45, dist = CAMERA_DISTANCE;
  const look = new THREE.Vector3();
  let first = true;
  return {
    camera,
    get yaw() { return yaw; },
    rotate(dx, dy) {
      yaw -= dx * LOOK_SENSITIVITY;
      pitch = THREE.MathUtils.clamp(pitch + dy * LOOK_SENSITIVITY, CAMERA_MIN_PITCH, CAMERA_MAX_PITCH);
    },
    // fp: 0 = third person, 1 = first person (eased by the caller)
    follow(target, dt = 1, fp = 0) {
      // eased pivot gives the camera a little weight; stairs and landings no longer jolt it
      const k = first ? 1 : 1 - Math.exp(-dt * 10);
      first = false;
      look.x += (target.x - look.x) * k; look.y += (target.y + PIVOT_Y - look.y) * k; look.z += (target.z - look.z) * k;
      const o = [look.x, look.y, look.z];
      const d = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
      // walls hide what's behind them (treasures in houses stay hidden from outside); pull in at once, ease back out
      const reach = CAMERA_DISTANCE * (1 - fp);
      const want = Math.max(0.5 * (1 - fp), rayCast(o, d, reach) - WALL_GAP * (1 - fp));
      dist = want < dist ? want : dist + (want - dist) * (1 - Math.exp(-dt * 4));
      const eye = fp * 0.2; // eyes sit a bit above the orbit pivot
      camera.position.set(o[0] + d[0] * dist, o[1] + d[1] * dist + eye, o[2] + d[2] * dist);
      // third person looks at the pivot; first person looks ahead along the view direction
      const ahead = Math.max(0, 1 - dist);
      camera.lookAt(look.x - d[0] * ahead * 3, look.y + eye - d[1] * ahead * 3, look.z - d[2] * ahead * 3);
      return dist;
    },
  };
}
