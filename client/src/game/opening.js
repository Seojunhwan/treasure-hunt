import * as THREE from 'three';
import { OPENING_MS } from '../../../shared/constants.js';
import { load } from './kit.js';

const GREETING_MS = 600;
const GIFTS_MS = 3500;
const RETURN_MS = 750;
const GIFT_LOOKS = ['present-a-cube', 'present-b-round', 'present-a-rectangle'];
const smooth = (n) => {
  const t = THREE.MathUtils.clamp(n, 0, 1);
  return t * t * (3 - 2 * t);
};

export function createOpening(scene, leader, card) {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(leader.x - 2.4, 2.9, leader.z + 4.7);
  const target = new THREE.Vector3(leader.x - 0.55, 1.3, leader.z + 0.45);
  camera.lookAt(target);
  const line = card.querySelector('p');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const gifts = new THREE.Group();
  gifts.visible = false;
  scene.add(gifts);
  for (let i = 0; i < 6; i++) {
    const gift = new THREE.Group();
    gifts.add(gift);
    load('holiday-kit', GIFT_LOOKS[i % GIFT_LOOKS.length])
      .then((model) => gift.add(model))
      .catch((error) => console.error('Could not load an opening gift', error));
  }

  let deadline = 0;
  let elapsed = 0;
  return {
    sync(remainingMs) {
      deadline = performance.now() + remainingMs;
    },
    clear() {
      elapsed = 0;
      card.hidden = true;
      gifts.visible = false;
    },
    update(now) {
      elapsed = Math.min(OPENING_MS, Math.max(elapsed, OPENING_MS - (deadline - now)));
      const message = elapsed >= GIFTS_MS
        ? '사무실 곳곳에 선물을 숨겨뒀어요. 찾아볼까요?'
        : '채널클랜 여러분, 송년회 축하해요! 올 한 해도 고생 많았어요.';
      if (line.textContent !== message) line.textContent = message;
      card.hidden = elapsed < GREETING_MS || elapsed >= OPENING_MS - RETURN_MS;
      gifts.visible = elapsed >= GIFTS_MS && elapsed < OPENING_MS - RETURN_MS;
      if (gifts.visible) {
        gifts.children.forEach((gift, i) => {
          const age = elapsed - GIFTS_MS - i * 85;
          gift.visible = age >= 0;
          if (!gift.visible) return;
          const t = reducedMotion.matches ? 1 : Math.min(1, age / 950);
          const side = (i - 2.5) * 0.7;
          const spread = t * (2 - t);
          gift.position.set(leader.x - 0.55 + side * spread, 1.5 - 1.2 * t + 5.4 * t * (1 - t),
            leader.z + 0.35 + (i % 2 === 0 ? 1.35 : 1) * t);
          gift.rotation.set(0.35 * Math.sin(Math.PI * t), i + 5 * t, 0.18 * Math.sin(Math.PI * t));
          gift.scale.setScalar(1.05 * (1 - 0.75 * smooth((age - 1400) / 450)));
        });
      }

      if (reducedMotion.matches) return 1;
      return smooth(elapsed / GREETING_MS) * smooth((OPENING_MS - elapsed) / RETURN_MS);
    },
    blendCamera(view, amount) {
      view.position.lerp(camera.position, amount);
      view.quaternion.slerp(camera.quaternion, amount);
    },
  };
}
