import * as THREE from 'three';
import { CAMERA_DISTANCE, CAMERA_MIN_PITCH, CAMERA_MAX_PITCH, LOOK_SENSITIVITY } from '../../../shared/constants.js';

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
      const h = CAMERA_DISTANCE * Math.cos(pitch);
      camera.position.set(target.x + Math.sin(yaw) * h, target.y + CAMERA_DISTANCE * Math.sin(pitch), target.z + Math.cos(yaw) * h);
      camera.lookAt(target.x, target.y + 1, target.z);
    },
  };
}
