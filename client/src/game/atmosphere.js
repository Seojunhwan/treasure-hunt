import * as THREE from 'three';
import { LAMPS } from '../../../shared/map.js';

export const HORIZON = 0x30365e; // fog and the bottom of the sky share this so the edge melts away

function radialTexture(inner, outer = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Night sky, stars, moon, falling snow and the street lamps' glow. All fake light: no
// dynamic lights, so it costs a phone almost nothing.
export function createAtmosphere(scene) {
  scene.fog = new THREE.Fog(HORIZON, 22, 80);
  scene.background = new THREE.Color(HORIZON);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x070b22) }, mid: { value: new THREE.Color(0x1b2048) }, bottom: { value: new THREE.Color(HORIZON) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.8, h)) : mix(bottom, mid, smoothstep(-0.05, 0.15, h)); gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);

  const starPos = [];
  for (let i = 0; i < 700; i++) {
    const u = Math.random() * Math.PI * 2, v = 0.12 + Math.random() * 0.88;
    const r = Math.sqrt(1 - v * v);
    starPos.push(Math.cos(u) * r * 280, v * 280, Math.sin(u) * r * 280);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
  scene.add(stars);

  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,250,230,1)', 'rgba(255,250,230,0)'), fog: false, depthWrite: false }));
  moon.scale.setScalar(60);
  moon.position.set(-120, 150, -160);
  scene.add(moon);
  const moonCore = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false }));
  moonCore.position.copy(moon.position);
  moonCore.lookAt(0, 0, 0);
  scene.add(moonCore);

  // street lamps (posts are merged into the static world): one draw call for all halos, one for all light pools
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(LAMPS.flatMap((l) => [l.x, 2.55, l.z]), 3));
  const haloMat = new THREE.PointsMaterial({ map: radialTexture('rgba(255,190,110,0.9)'), size: 2.4, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  scene.add(new THREE.Points(haloGeo, haloMat));
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,170,90,0.55)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }), LAMPS.length);
  LAMPS.forEach((l, i) => pools.setMatrixAt(i, new THREE.Matrix4().makeTranslation(l.x, 0.03, l.z)));
  scene.add(pools);

  // snow: a box of flakes that travels with the camera
  const N = 1400, BOX = 36, HGT = 18;
  const flakes = new Float32Array(N * 3), speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    flakes.set([(Math.random() - 0.5) * BOX, Math.random() * HGT, (Math.random() - 0.5) * BOX], i * 3);
    speed[i] = 0.8 + Math.random() * 1.2;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(flakes, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: radialTexture('rgba(255,255,255,1)'), size: 0.16, transparent: true, depthWrite: false, opacity: 0.95 }));
  snow.frustumCulled = false;
  scene.add(snow);

  let t = 0;
  return {
    update(dt, cam) {
      t += dt;
      sky.position.copy(cam.position);
      stars.position.copy(cam.position);
      const wind = Math.sin(t * 0.3) * 0.6 + 0.4;
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        flakes[k + 1] -= speed[i] * dt;
        flakes[k] += (wind + Math.sin(t * 1.3 + i) * 0.3) * dt;
        if (flakes[k + 1] < 0) flakes[k + 1] += HGT;
        // wrap around the camera so snow is always falling where we look
        const cx = cam.position.x, cz = cam.position.z;
        if (flakes[k] - cx > BOX / 2) flakes[k] -= BOX; else if (flakes[k] - cx < -BOX / 2) flakes[k] += BOX;
        if (flakes[k + 2] - cz > BOX / 2) flakes[k + 2] -= BOX; else if (flakes[k + 2] - cz < -BOX / 2) flakes[k + 2] += BOX;
      }
      snowGeo.attributes.position.needsUpdate = true;
      haloMat.size = 2.35 + Math.sin(t * 7) * 0.05 + Math.sin(t * 13) * 0.04; // gentle flicker
    },
  };
}
