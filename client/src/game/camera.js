import * as THREE from 'three';
import { CAMERA_DISTANCE, CAMERA_MIN_PITCH, CAMERA_MAX_PITCH, LOOK_SENSITIVITY } from '../../../shared/constants.js';
import { rayCast } from '../../../shared/collision.js';

const PIVOT_Y = 1.4; // orbit around the head, not the feet
const WALL_GAP = 0.3; // keep the lens this far in front of a wall

// Orbit camera that trails a target. yaw 0 = camera on +z side looking toward -z.
export function createFollowCamera() {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  let yaw = 0, pitch = 0.45;
  return {
    camera,
    get yaw() { return yaw; },
    rotate(dx, dy) {
      yaw -= dx * LOOK_SENSITIVITY;
      pitch = THREE.MathUtils.clamp(pitch + dy * LOOK_SENSITIVITY, CAMERA_MIN_PITCH, CAMERA_MAX_PITCH);
    },
    follow(target) {
      const o = [target.x, PIVOT_Y, target.z];
      const d = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
      // so walls hide what's behind them (treasures in houses stay hidden from outside)
      const dist = Math.max(0.5, rayCast(o, d, CAMERA_DISTANCE) - WALL_GAP);
      camera.position.set(o[0] + d[0] * dist, o[1] + d[1] * dist, o[2] + d[2] * dist);
      camera.lookAt(target.x, PIVOT_Y, target.z);
    },
  };
}
