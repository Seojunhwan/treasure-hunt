import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export function addLoungeDetails(scene, {
  mirrorPillar, shopWall, front, diningTables, shelves, ramenCounter, cafeService, cafeCounters, borderPlants, stairSeats,
}, mergeStatic) {
  function panel(w, h, x, y, z, angle, canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = angle;
    scene.add(mesh);
  }

  for (const [box, color] of [[mirrorPillar, 0xd9d0c0], [shopWall, 0x47403b]]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(box.w, box.h, box.d),
      new THREE.MeshLambertMaterial({ color }));
    mesh.position.set(box.x, box.h / 2, box.z);
    scene.add(mesh);
  }

  const mirror = document.createElement('canvas');
  mirror.width = 384;
  mirror.height = 512;
  const glass = mirror.getContext('2d');
  glass.fillStyle = '#958b7d';
  glass.fillRect(0, 0, 384, 512);
  const reflection = glass.createLinearGradient(0, 0, 384, 512);
  reflection.addColorStop(0, '#b7ccce');
  reflection.addColorStop(0.45, '#ecf4ee');
  reflection.addColorStop(0.61, '#c9d9d9');
  reflection.addColorStop(1, '#aabfc1');
  glass.fillStyle = reflection;
  glass.fillRect(10, 10, 364, 492);
  glass.fillStyle = '#f0f6ef88';
  glass.beginPath();
  glass.moveTo(10, 185); glass.lineTo(374, 65); glass.lineTo(374, 103); glass.lineTo(10, 224);
  glass.fill();
  const mirrorZ = mirrorPillar.z - mirrorPillar.d / 2;
  panel(1.88, 2.48, mirrorPillar.x, 1.55, mirrorZ - 0.012, Math.PI, mirror);
  addMirrorReflection(scene, mirrorPillar.x, mirrorZ - 0.017);

  const banner = document.createElement('canvas');
  banner.width = 1536;
  banner.height = 256;
  const ink = banner.getContext('2d');
  ink.fillStyle = '#a63842';
  ink.fillRect(0, 0, 1536, 256);
  ink.strokeStyle = '#ebce98';
  ink.lineWidth = 4;
  ink.strokeRect(18, 17, 1500, 222);
  ink.fillStyle = '#fff5df';
  ink.font = '700 92px system-ui, sans-serif';
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  ink.fillText('채널클랜 송년회를 축하합니다!', 768, 132, 1380);
  panel(14, 2.15, shopWall.x, 1.98, shopWall.z - shopWall.d / 2 - 0.012, Math.PI, banner);
  panel(3.4, 1.16, shopWall.x - 9.5, 1.6, shopWall.z - shopWall.d / 2 - 0.012, Math.PI, yearEndCards());

  function label(text, w, h, x, y, z, angle) {
    const sign = document.createElement('canvas');
    sign.width = 640;
    sign.height = 128;
    const mark = sign.getContext('2d');
    mark.fillStyle = '#394b47';
    mark.fillRect(0, 0, 640, 128);
    mark.fillStyle = '#fff1d9';
    mark.font = '700 72px system-ui, sans-serif';
    mark.textAlign = 'center';
    mark.textBaseline = 'middle';
    mark.fillText(text, 320, 67, 590);
    panel(w, h, x, y, z, angle, sign);
  }
  const cafeWallX = shopWall.x - 20.78;
  label('카페', 4.2, 0.72, cafeWallX, 2.35, front + 20.5, Math.PI / 2);
  label('사내매점', 4.2, 0.72, shopWall.x, 2.35, front + 53.88, Math.PI);

  const props = new THREE.Group();
  addTableware(props, diningTables);
  stockShelves(props, shelves);
  addRamenStation(props, ramenCounter, label);
  for (const { napkins, cups } of cafeService) addCafeServiceProps(props, napkins, cups);
  const coffeeCounter = cafeCounters[1];
  addCupStacks(props, coffeeCounter.x, coffeeCounter.h, coffeeCounter.z, [[0.46, 4], [0.69, 5]], 0xe1caa4, 0x893d47);
  addBorderPlanters(props, borderPlants);
  addStairSeatFinish(props, stairSeats);
  scene.add(mergeStatic(props));
}

function addRamenStation(props, [first, second, supplies], label) {
  const steel = new THREE.MeshLambertMaterial({ color: 0xb6c3c7 });
  const charcoal = new THREE.MeshLambertMaterial({ color: 0x343b3f });
  const brass = new THREE.MeshLambertMaterial({ color: 0xd18c45 });
  const foil = new THREE.MeshLambertMaterial({ color: 0xd9ddde });
  const stock = new THREE.MeshLambertMaterial({ color: 0xb9562c });
  const noodles = new THREE.MeshLambertMaterial({ color: 0xf2c77a });
  const wood = new THREE.MeshLambertMaterial({ color: 0xbb9062 });
  const bowl = new THREE.LatheGeometry([
    [0, 0], [0.16, 0], [0.22, 0.115], [0.22, 0.13], [0.20, 0.13], [0.15, 0.02], [0, 0.02],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 16);
  const plate = new THREE.CylinderGeometry(0.23, 0.23, 0.018, 16);

  [first, second].forEach(({ x, z, h }, index) => {
    place(props, new THREE.BoxGeometry(0.76, 0.085, 0.88), steel, x, h + 0.0425, z - 0.02);
    place(props, plate, charcoal, x, h + 0.094, z - 0.13);
    place(props, new THREE.BoxGeometry(0.66, 0.58, 0.16), steel, x, h + 0.35, z + 0.32);
    place(props, new THREE.BoxGeometry(0.68, 0.18, 0.62), steel, x, h + 0.63, z + 0.12);
    place(props, new THREE.CylinderGeometry(0.036, 0.036, 0.10, 10), charcoal, x, h + 0.49, z - 0.13);
    place(props, new THREE.BoxGeometry(0.088, 0.045, 0.014), brass, x + 0.22, h + 0.64, z - 0.196);
    label(index === 0 ? '03:00' : '00:00', 0.30, 0.10, x - 0.08, h + 0.64, z - 0.2, Math.PI);
  });
  place(props, bowl, foil, first.x, first.h + 0.103, first.z - 0.13);
  place(props, new THREE.CylinderGeometry(0.176, 0.176, 0.01, 16), stock, first.x, first.h + 0.188, first.z - 0.13);
  const noodleLoop = new THREE.TorusGeometry(0.049, 0.011, 5, 11).rotateX(Math.PI / 2);
  for (const [dx, dz] of [[-0.054, -0.026], [0.015, 0.035], [0.06, -0.045]]) {
    place(props, noodleLoop, noodles, first.x + dx, first.h + 0.201, first.z - 0.13 + dz);
  }

  const { x, z, h } = supplies;
  for (let i = 0; i < 4; i++) place(props, bowl, foil, x - 0.38, h + i * 0.046, z);
  const packet = new THREE.BoxGeometry(0.24, 0.035, 0.30);
  const wrap = new THREE.MeshLambertMaterial({ color: 0xc85043 });
  for (const dx of [0.05, 0.33, 0.61]) {
    place(props, packet, wrap, x + dx, h + 0.0175, z + 0.14);
    place(props, new THREE.BoxGeometry(0.18, 0.002, 0.09), noodles, x + dx, h + 0.036, z + 0.14);
  }
  const chopstick = new THREE.BoxGeometry(0.30, 0.012, 0.013);
  for (const dz of [-0.23, -0.20, -0.17, -0.14]) place(props, chopstick, wood, x + 0.33, h + 0.006, z + dz);
}

function yearEndCards() {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 256;
  const ink = canvas.getContext('2d');
  ink.fillStyle = '#394c43';
  ink.fillRect(0, 0, 768, 256);
  ink.fillStyle = '#fae7c2';
  ink.font = '700 40px system-ui, sans-serif';
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  ink.fillText('올해의 한 장면', 384, 47);

  const cards = [['함께한 한 해', '#e7d5ad'], ['올해도 고생했어요', '#e8c2bd'], ['내년에도 잘 부탁해요', '#e5d8bc']];
  ink.font = '700 25px system-ui, sans-serif';
  cards.forEach(([message, color], index) => {
    const x = 28 + index * 240;
    ink.fillStyle = color;
    ink.fillRect(x, 93, 232, 135);
    ink.fillStyle = '#633e3b';
    ink.fillRect(x + 102, 117, 28, 3);
    ink.fillText(message, x + 116, 170, 202);
  });
  return canvas;
}

function addMirrorReflection(scene, x, z) {
  const reflector = new Reflector(new THREE.PlaneGeometry(1.78, 2.38), {
    color: 0xd6e8e5,
    clipBias: 0.001,
    textureWidth: 384,
    textureHeight: 384,
    multisample: 0,
    shader: {
      vertexShader: Reflector.ReflectorShader.vertexShader,
      uniforms: { ...Reflector.ReflectorShader.uniforms, strength: { value: 0 } },
      fragmentShader: /* glsl */`
        uniform vec3 color;
        uniform float strength;
        uniform sampler2D tDiffuse;
        varying vec4 vUv;
        #include <logdepthbuf_pars_fragment>
        void main() {
          if (strength <= 0.0) discard;
          #include <logdepthbuf_fragment>
          vec3 reflected = texture2DProj(tDiffuse, vUv).rgb;
          gl_FragColor = vec4(mix(reflected, color, 0.06), strength);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    },
  });
  reflector.material.transparent = true;
  reflector.material.depthWrite = false;
  reflector.position.set(x, 1.55, z);
  reflector.rotation.y = Math.PI;
  const renderReflection = reflector.onBeforeRender;
  const eye = new THREE.Vector3();
  const center = new THREE.Vector3();
  let lastUpdate = -Infinity;
  reflector.onBeforeRender = function (renderer, world, camera) {
    const strength = this.material.uniforms.strength;
    strength.value = 0;
    eye.setFromMatrixPosition(camera.matrixWorld);
    center.setFromMatrixPosition(this.matrixWorld);
    const distance = eye.distanceTo(center);
    if (eye.z >= center.z || distance >= 19) return;
    if (!renderer.extensions.has('EXT_color_buffer_float') && !renderer.extensions.has('EXT_color_buffer_half_float')) return;

    const now = performance.now();
    if (now - lastUpdate >= 50) {
      renderReflection.call(this, renderer, world, camera);
      lastUpdate = now;
    }
    // Let the existing glass finish show through and fade out the live view at a distance.
    strength.value = 0.86 * (1 - THREE.MathUtils.smoothstep(distance, 14, 19));
  };
  scene.add(reflector);
}

function addStairSeatFinish(props, seats) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 192;
  const grain = canvas.getContext('2d');
  grain.fillStyle = '#b29e83';
  grain.fillRect(0, 0, canvas.width, canvas.height);
  for (let x = 1; x < canvas.width; x += 2) {
    grain.fillStyle = x % 6 === 1 ? '#dcc9ab66' : '#8d74533d';
    grain.fillRect(x, 0, 1, canvas.height);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const finish = new THREE.MeshLambertMaterial({ map });
  for (const { x, y, z, w, d, h } of seats) {
    place(props, new THREE.BoxGeometry(w, h, d), finish, x, y + h / 2, z);
  }
}

function addBorderPlanters(props, plants) {
  const stone = new THREE.MeshLambertMaterial({ color: 0x9c8d7c });
  const terracotta = new THREE.MeshLambertMaterial({ color: 0xb17e66 });
  const soil = new THREE.MeshLambertMaterial({ color: 0x51463b });
  const body = new THREE.CylinderGeometry(1, 0.83, 1, 10);
  const top = new THREE.CylinderGeometry(0.91, 0.91, 0.012, 10);
  for (const { name, x, y, z, w } of plants) {
    const radius = w * 0.385;
    const pot = name === 'plant_flatTall' ? terracotta : stone;
    place(props, body, pot, x, y / 2, z).scale.set(radius, y, radius);
    place(props, top, soil, x, y, z).scale.set(radius, 1, radius);
  }
}

function addCafeServiceProps(props, napkins, cups) {
  const dark = new THREE.MeshLambertMaterial({ color: 0x455956 });
  const paper = new THREE.MeshLambertMaterial({ color: 0xf8efdb });
  place(props, new THREE.BoxGeometry(0.34, 0.23, 0.34), dark, napkins.x, napkins.h + 0.115, napkins.z);
  place(props, new THREE.BoxGeometry(0.08, 0.055, 0.23), paper, napkins.x + 0.15, napkins.h + 0.14, napkins.z);

  place(props, new THREE.BoxGeometry(0.55, 0.045, 0.77), dark, cups.x, cups.h + 0.0225, cups.z);
  addCupStacks(props, cups.x, cups.h + 0.045, cups.z, [[-0.23, 2], [0, 1], [0.23, 3]], 0xa8c7bf);
}

function addCupStacks(props, x, baseY, z, stacks, color, sleeveColor) {
  const cupMaterial = new THREE.MeshLambertMaterial({ color });
  const rimMaterial = new THREE.MeshLambertMaterial({ color: 0xf8efdb });
  const cup = new THREE.CylinderGeometry(0.092, 0.064, 0.17, 12, 1, true);
  const rim = new THREE.TorusGeometry(0.09, 0.007, 6, 12).rotateX(Math.PI / 2);
  const sleeve = sleeveColor && new THREE.CylinderGeometry(0.083, 0.072, 0.06, 12, 1, true);
  const sleeveMaterial = sleeve && new THREE.MeshLambertMaterial({ color: sleeveColor });
  for (const [dz, stackHeight] of stacks) {
    for (let i = 0; i < stackHeight; i++) {
      const y = baseY + i * 0.05;
      place(props, cup, cupMaterial, x, y + 0.085, z + dz);
      place(props, rim, rimMaterial, x, y + 0.17, z + dz);
    }
    if (sleeve) place(props, sleeve, sleeveMaterial, x, baseY + (stackHeight - 1) * 0.05 + 0.08, z + dz);
  }
}

function addTableware(props, tables) {
  const ceramic = [0xf2e9d4, 0x528b82, 0xc56d5b].map((color) => new THREE.MeshLambertMaterial({ color }));
  const cup = new THREE.LatheGeometry([
    [0, 0], [0.065, 0], [0.075, 0.132], [0.063, 0.132], [0.053, 0.022], [0, 0.022],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 12);
  const handle = new THREE.TorusGeometry(0.036, 0.009, 6, 12);
  const wood = new THREE.MeshLambertMaterial({ color: 0x997054 });
  const paper = new THREE.MeshLambertMaterial({ color: 0xf5d89e });
  const tray = new THREE.BoxGeometry(0.52, 0.035, 0.32);
  const snack = new THREE.BoxGeometry(0.13, 0.04, 0.20);
  const cloth = new THREE.MeshLambertMaterial({ color: 0x893d47 });
  const seam = new THREE.MeshLambertMaterial({ color: 0xc5a06a });
  const runner = new THREE.BoxGeometry(2.7, 0.006, 0.38);
  const stitching = new THREE.BoxGeometry(2.62, 0.002, 0.012);

  tables.forEach(({ x, z, h }, index) => {
    if (index % 2 === 1) {
      place(props, runner, cloth, x, h + 0.003, z);
      for (const side of [-1, 1]) place(props, stitching, seam, x, h + 0.007, z + side * 0.162);
    }
    const mugOffsets = index % 2 === 0 ? [-0.44, -0.13] : [0.24, 0.55];
    mugOffsets.forEach((dx, mug) => {
      const material = ceramic[(index + mug) % ceramic.length];
      const mugZ = z + (mug ? 0.17 : -0.16);
      place(props, cup, material, x + dx, h, mugZ);
      place(props, handle, material, x + dx + 0.083, h + 0.073, mugZ);
    });
    if (index % 2 === 0) return;
    place(props, tray, wood, x - 0.42, h + 0.0175, z);
    for (const dx of [-0.57, -0.42, -0.27]) {
      place(props, snack, paper, x + dx, h + 0.055, z);
    }
  });
}

function stockShelves(props, shelves) {
  const packaging = [0xc95f50, 0xd3a043, 0x618775, 0x647ca8]
    .map((color) => new THREE.MeshLambertMaterial({ color }));
  const label = new THREE.MeshLambertMaterial({ color: 0xf2e0b5 });
  const metal = new THREE.MeshLambertMaterial({ color: 0xc9d1cf });
  const carton = new THREE.BoxGeometry(0.22, 0.26, 0.16);
  const cartonBand = new THREE.BoxGeometry(0.222, 0.052, 0.162);
  const can = new THREE.CylinderGeometry(0.075, 0.075, 0.19, 10);
  const lid = new THREE.CylinderGeometry(0.076, 0.076, 0.016, 10);

  shelves.forEach(({ name, x, z, h }, index) => {
    // Shelf board tops as fractions of the normalized Kenney models' heights.
    const levels = name === 'bookcaseOpen' ? [0.148, 0.420, 0.693] : [0.325, 1];
    levels.forEach((level, row) => {
      const y = h * level;
      for (let item = 0; item < 4; item++) {
        const material = packaging[(index + row + Math.floor(item / 2)) % packaging.length];
        const dx = (item - 1.5) * 0.26;
        const boxes = (row + index) % 2 === 0;
        place(props, boxes ? carton : can, material, x + dx, y + (boxes ? 0.13 : 0.095), z);
        place(props, boxes ? cartonBand : lid, boxes ? label : metal,
          x + dx, y + (boxes ? 0.16 : 0.194), z);
      }
    });
  });
}

function place(parent, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
