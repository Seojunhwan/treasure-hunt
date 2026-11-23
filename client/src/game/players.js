import * as THREE from 'three';

const body = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
const noseGeo = new THREE.BoxGeometry(0.2, 0.2, 0.3);
const noseMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

export function makeAvatar(color) {
  const mesh = new THREE.Mesh(body, new THREE.MeshLambertMaterial({ color }));
  mesh.position.y = 0.9;
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 0.4, -0.45); // shows which way the capsule faces
  mesh.add(nose);
  return mesh;
}

function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(text, 128, 32);
  g.fillStyle = '#fff'; g.fillText(text, 128, 32);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false }));
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = 1.3;
  return sprite;
}

const colorFor = (id) => new THREE.Color().setHSL((parseInt(id.slice(0, 6), 16) % 360) / 360, 0.6, 0.55);

// Other players. shortcut: exponential smoothing toward the latest snapshot instead of
// buffered interpolation; upgrade if movement looks jerky on real phones.
export function createRemotePlayers(scene) {
  const others = new Map();
  return {
    sync(list, selfId) {
      const seen = new Set();
      for (const p of list) {
        if (p.id === selfId) continue;
        seen.add(p.id);
        let o = others.get(p.id);
        if (!o) {
          const mesh = makeAvatar(colorFor(p.id));
          mesh.add(makeLabel(p.name));
          mesh.position.set(p.x, 0.9, p.z);
          scene.add(mesh);
          o = { mesh, target: p };
          others.set(p.id, o);
        }
        o.target = p;
      }
      for (const [id, o] of others) {
        if (seen.has(id)) continue;
        scene.remove(o.mesh);
        o.mesh.material.dispose();
        const label = o.mesh.children.find((c) => c.isSprite);
        label.material.map.dispose(); label.material.dispose();
        others.delete(id);
      }
    },
    update(dt) {
      const k = 1 - Math.exp(-dt * 12);
      for (const { mesh, target } of others.values()) {
        mesh.position.x += (target.x - mesh.position.x) * k;
        mesh.position.z += (target.z - mesh.position.z) * k;
        mesh.rotation.y = target.ry;
      }
    },
    get count() { return others.size; },
  };
}
