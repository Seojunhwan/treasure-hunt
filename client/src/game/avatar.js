// Kenney Mini Characters (CC0) with idle / walk / sprint / pick-up clips.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const VARIANTS = [
  'female-a', 'female-b', 'female-c', 'female-d', 'female-e', 'female-f',
  'male-a', 'male-b', 'male-c', 'male-d', 'male-e', 'male-f', 'male-g', 'alien', 'robot', 'worker',
];
const HEIGHT = 1.7;

const loader = new GLTFLoader();
const cache = new Map();
// Loaded on first use, so a phone only downloads the looks it actually sees.
function loadVariant(v) {
  if (!cache.has(v)) cache.set(v, loader.loadAsync(`/assets/mini-characters/character-${v}.glb`));
  return cache.get(v);
}

export const variantFor = (id) => VARIANTS[parseInt(id.slice(0, 6), 16) % VARIANTS.length];

// Returns immediately; the model pops in when loaded. root faces -z at rotation 0 (game convention).
export function createAvatar(variant) {
  const root = new THREE.Group();
  let mixer = null, actions = {}, current = null, onceAction = null;
  const play = (name) => {
    if (onceAction || current === name || !actions[name]) return;
    actions[name].reset().fadeIn(0.15).play();
    actions[current]?.fadeOut(0.15);
    current = name;
  };
  loadVariant(variant).then((gltf) => {
    const model = cloneSkinned(gltf.scene);
    const h = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
    model.scale.setScalar(HEIGHT / h);
    model.rotation.y = Math.PI; // Kenney models face +z
    root.add(model);
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    const p = actions['pick-up'];
    if (p) { p.setLoop(THREE.LoopOnce); p.clampWhenFinished = false; }
    mixer.addEventListener('finished', () => { onceAction = null; const c = current; current = null; play(c ?? 'idle'); });
    play('idle');
  });
  return {
    root,
    // speed in m/s picks the clip
    setSpeed(v) { play(v < 0.3 ? 'idle' : v < 3.5 ? 'walk' : 'sprint'); },
    pickUp() {
      const p = actions['pick-up'];
      if (!p) return;
      actions[current]?.fadeOut(0.1);
      p.reset().fadeIn(0.1).play();
      onceAction = p;
    },
    update(dt) { mixer?.update(dt); },
  };
}
