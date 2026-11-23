import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Warm grade + soft vignette, in linear space before the output conversion.
const Grade = {
  uniforms: { tDiffuse: { value: null }, warmth: { value: new THREE.Vector3(1.06, 1.0, 0.94) }, vignette: { value: 0.35 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 warmth; uniform float vignette; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb *= warmth;
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, 1.12); // a touch more saturation
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - vignette * smoothstep(0.35, 0.85, d);
      gl_FragColor = c;
    }`,
};

const KEY = 'treasure-hunt-post';
const MIN_FPS = 40; // iPhone with bloom + 45 bots held the 50s (2026-11-24)

// Bloom makes windows and lamps glow. It's the most expensive thing on screen, so it turns
// itself off for good on phones that can't hold the frame rate (?post=0/1 forces it).
export function createPost(renderer, scene, camera) {
  const forced = new URLSearchParams(location.search).get('post');
  let enabled = forced !== null ? forced === '1' : localStorage.getItem(KEY) !== 'off';
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.6);
  composer.addPass(bloom);
  composer.addPass(new ShaderPass(Grade));
  composer.addPass(new OutputPass());

  let frames = 0, since = 0, bad = 0, windows = 0;
  return {
    get enabled() { return enabled; },
    toggle() { enabled = !enabled; frames = 0; since = 0; bad = 0; windows = 0; },
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      bloom.resolution.set(w / 2, h / 2); // half-res bloom: plenty for soft glows
    },
    render(now) {
      if (!enabled) return renderer.render(scene, camera);
      composer.render();
      if (forced !== null) return;
      // keep watching; if this phone falls below MIN_FPS, drop the effect and remember that
      if (!since) since = now;
      frames++;
      const t = now - since;
      if (t > 4000) {
        // skip the first window (assets still loading); two slow windows in a row = this phone can't
        windows++;
        bad = windows > 1 && (frames * 1000) / t < MIN_FPS && document.visibilityState === 'visible' ? bad + 1 : 0;
        if (bad >= 2) {
          enabled = false;
          localStorage.setItem(KEY, 'off');
        }
        frames = 0; since = now;
      }
    },
  };
}
