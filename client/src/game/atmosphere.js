import * as THREE from 'three';
import { LAMPS, HOUSES, PROPS, houseSize, rot } from '../../../shared/map.js';

export const HORIZON = 0x37356a; // fog and the bottom of the sky share this so the edge melts away

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
    uniforms: { top: { value: new THREE.Color(0x080a24) }, mid: { value: new THREE.Color(0x24204e) }, bottom: { value: new THREE.Color(HORIZON) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, bottom; varying vec3 vP;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float noise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){ float h = vP.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.8, h)) : mix(bottom, mid, smoothstep(-0.05, 0.15, h));
        // milky way: a soft, cloudy band tilted across the sky
        float b = dot(vP, normalize(vec3(0.55, 0.35, -0.75)));
        float cloud = noise(vP * 9.0) * 0.6 + noise(vP * 23.0) * 0.4;
        c += vec3(0.2, 0.16, 0.32) * exp(-b * b * 40.0) * cloud * smoothstep(0.02, 0.35, h);
        gl_FragColor = vec4(c, 1.0); }`,
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

  // a shooting star every few seconds: a short streak that fades out
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  streakGeo.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0, 0, 0], 3));
  const streakMat = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, fog: false, depthWrite: false });
  const streak = new THREE.Line(streakGeo, streakMat);
  streak.frustumCulled = false;
  streak.visible = false;
  scene.add(streak);
  let shoot = null, nextShoot = 4;

  // drifting motes and the twinkling string lights share one point shader (per-point colour, phase, size)
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { t: { value: 0 }, map: { value: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)') } },
    vertexShader: `attribute vec3 color; attribute float phase; attribute float size; uniform float t; varying vec3 vC; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vC = color;
        vA = 0.55 + 0.45 * sin(t * (1.3 + fract(phase * 7.3)) + phase * 6.283);
        gl_PointSize = min(size * (300.0 / -mv.z), 18.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ gl_FragColor = vec4(vC * vA, 1.0) * texture2D(map, gl_PointCoord); }',
  });
  const glowPoints = (pos, col, size) => {
    const n = pos.length / 3, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('phase', new THREE.Float32BufferAttribute(Array.from({ length: n }, Math.random), 1));
    g.setAttribute('size', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => size * (0.7 + Math.random() * 0.6)), 1));
    const p = new THREE.Points(g, glowMat);
    scene.add(p);
    return p;
  };
  const BULBS = [[1, 0.25, 0.2], [0.25, 1, 0.35], [1, 0.8, 0.3], [0.35, 0.55, 1], [1, 0.45, 0.85]];
  // eaves of every house: a bulb every 0.5 m along both long sides, just under the roof edge
  const lp = [], lc = [];
  for (const h of HOUSES) {
    const { w, d, H } = houseSize(h);
    for (const sx of [-1, 1]) for (let z = -d / 2 + 0.2; z <= d / 2 - 0.2; z += 0.5) {
      const [dx, dz] = rot(h.rot, sx * (w / 2 + 0.4), z);
      lp.push(h.x + dx, H - 0.25, h.z + dz);
      lc.push(...BULBS[(lp.length / 3) % BULBS.length].map((v) => v * 1.6));
    }
  }
  // a warm spiral round the big plaza tree
  const tree = PROPS.find((p) => p.name === 'tree-decorated-snow');
  const TH = 2.29 * tree.s, TR = 0.62 * tree.s;
  for (let i = 0; i < 160; i++) {
    const k = i / 160, y = 0.8 + k * (TH - 1.6), r = TR * (1 - y / TH) + 0.25, ang = k * Math.PI * 2 * 6;
    lp.push(tree.x + Math.cos(ang) * r, y, tree.z + Math.sin(ang) * r);
    lc.push(...(i % 3 ? [1.6, 1.3, 0.7] : [1.6, 1.5, 1.35]));
  }
  glowPoints(lp, lc, 0.5);
  // motes: soft lights that hang and drift around the camera
  const M = 160, MBOX = 44, mp = [], mc = [];
  for (let i = 0; i < M; i++) {
    mp.push((Math.random() - 0.5) * MBOX, 0.6 + Math.random() * 7, (Math.random() - 0.5) * MBOX);
    mc.push(...[[1, 0.8, 0.45], [0.55, 0.9, 1], [1, 0.6, 0.85]][i % 3].map((v) => v * 0.7));
  }
  const motes = glowPoints(mp, mc, 0.35);
  motes.frustumCulled = false;
  const moteBase = Float32Array.from(mp), moteArr = motes.geometry.attributes.position.array;

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
      glowMat.uniforms.t.value = t;
      // motes bob and sway around a home spot that wraps to stay near the camera
      for (let i = 0; i < M; i++) {
        const k = i * 3;
        if (moteBase[k] - cam.position.x > MBOX / 2) moteBase[k] -= MBOX; else if (moteBase[k] - cam.position.x < -MBOX / 2) moteBase[k] += MBOX;
        if (moteBase[k + 2] - cam.position.z > MBOX / 2) moteBase[k + 2] -= MBOX; else if (moteBase[k + 2] - cam.position.z < -MBOX / 2) moteBase[k + 2] += MBOX;
        moteArr[k] = moteBase[k] + Math.sin(t * 0.3 + i) * 0.8;
        moteArr[k + 1] = moteBase[k + 1] + Math.sin(t * 0.5 + i * 1.7) * 0.5;
        moteArr[k + 2] = moteBase[k + 2] + Math.cos(t * 0.25 + i * 0.6) * 0.8;
      }
      motes.geometry.attributes.position.needsUpdate = true;
      nextShoot -= dt;
      if (!shoot && nextShoot <= 0) {
        const a0 = Math.random() * Math.PI * 2, el = 0.5 + Math.random() * 0.4;
        const from = new THREE.Vector3(Math.cos(a0) * Math.cos(el), Math.sin(el), Math.sin(a0) * Math.cos(el)).multiplyScalar(240);
        const dir = new THREE.Vector3(Math.random() - 0.5, -0.35, Math.random() - 0.5).normalize();
        shoot = { from, dir, age: 0 };
      }
      if (shoot) {
        shoot.age += dt;
        const k = shoot.age / 0.9, head = shoot.from.clone().addScaledVector(shoot.dir, k * 90).add(cam.position);
        const tail = head.clone().addScaledVector(shoot.dir, -18 * Math.min(1, k * 3));
        streakGeo.attributes.position.array.set([...head.toArray(), ...tail.toArray()]);
        streakGeo.attributes.position.needsUpdate = true;
        streakMat.opacity = Math.sin(Math.min(1, k) * Math.PI);
        streak.visible = k < 1;
        if (k >= 1) { shoot = null; nextShoot = 6 + Math.random() * 9; }
      }
    },
  };
}
