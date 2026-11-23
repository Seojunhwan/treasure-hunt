import * as THREE from 'three';
import { createControls } from './game/controls.js';
import { createFollowCamera } from './game/camera.js';
import { buildWorld } from './game/world.js';
import { makeAvatar, createRemotePlayers } from './game/players.js';
import { connect } from './net.js';
import { showBanner, goFullscreen } from './install.js';
import { MOVE_SPEED, PLAYER_RADIUS } from '../../shared/constants.js';
import { resolveCollision, clampToCircle } from '../../shared/collision.js';
import { SPAWN } from '../../shared/map.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // full retina res costs too much fps on mid-range phones
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
buildWorld(scene);

const player = makeAvatar(0xd94a4a);
player.visible = false;
scene.add(player);
const others = createRemotePlayers(scene);

const view = createFollowCamera();
const controls = createControls(renderer.domElement);
let me = null; // { id, name } once joined
let phase = 'waiting';

// CSS sizes the canvas to the screen; we follow whatever size it ends up with. iOS fires
// resize before the rotation finishes, so watching the canvas itself is the reliable signal.
function resize() {
  const { clientWidth: w, clientHeight: h } = renderer.domElement;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  view.camera.aspect = w / h;
  view.camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(renderer.domElement);
resize();

const debug = new URLSearchParams(location.search).has('debug');
const fpsEl = document.getElementById('fps');
let frames = 0, fpsAt = 0;
let prev = 0;
renderer.setAnimationLoop((now) => {
  if (debug && ++frames && now - fpsAt > 1000) {
    fpsEl.textContent = `${Math.round((frames * 1000) / (now - fpsAt))} fps · ${others.count + (me ? 1 : 0)}명`;
    frames = 0; fpsAt = now;
  }
  const dt = Math.min((now - prev) / 1000, 0.1); // cap avoids a huge jump after the tab was backgrounded
  prev = now;
  const look = controls.takeLook();
  view.rotate(look.dx, look.dy);

  const m = me ? controls.getMove() : { x: 0, y: 0 };
  if (m.x || m.y) {
    // camera-relative: forward points from camera toward player on the ground plane
    const s = Math.sin(view.yaw), c = Math.cos(view.yaw);
    const vx = (-s * m.y + c * m.x) * MOVE_SPEED;
    const vz = (-c * m.y - s * m.x) * MOVE_SPEED;
    let p = resolveCollision(player.position.x + vx * dt, player.position.z + vz * dt, PLAYER_RADIUS);
    if (phase === 'waiting') p = clampToCircle(p.x, p.z, SPAWN);
    player.position.x = p.x;
    player.position.z = p.z;
    player.rotation.y = Math.atan2(-vx, -vz);
  }
  others.update(dt);
  view.follow(player.position);
  renderer.render(scene, view.camera);
});

const status = document.getElementById('status');
const net = connect({
  onStatus: () => {
    const s = net.socket;
    status.textContent = s.connected ? `${me ? me.name + ' · ' : ''}연결됨 · ${s.io.engine.transport.name}` : '연결 끊김, 재연결 중…';
  },
  onState: (state) => {
    phase = state.phase;
    others.sync(state.players, me?.id);
  },
  onCorrect: ({ x, z }) => player.position.set(x, player.position.y, z),
});

function enter(res) {
  me = { id: res.id, name: res.name };
  player.position.set(res.x, 0.9, res.z);
  player.visible = true;
  joinForm.hidden = true;
  status.textContent = `${me.name} · 연결됨 · ${net.socket.io.engine.transport.name}`;
  net.startSending(() => ({ x: player.position.x, z: player.position.z, ry: player.rotation.y }));
}

const joinForm = document.getElementById('join');
const nameInput = document.getElementById('name');
const joinError = document.getElementById('join-error');
nameInput.addEventListener('blur', () => scrollTo(0, 0)); // iOS keyboard can leave the page shifted
joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  goFullscreen(); // needs the tap, so before any await
  nameInput.blur();
  joinError.textContent = '';
  const res = await net.join(nameInput.value);
  if (res.error) joinError.textContent = res.error;
  else enter(res);
});

// Returning player (refresh, locked phone): skip the form.
const saved = net.savedName();
if (saved) net.join(saved).then((res) => (res.error ? (joinForm.hidden = false) : enter(res)));
else joinForm.hidden = false;
showBanner();

if (import.meta.env.DEV) window.__game = { player, view, others }; // lets browser automation read state
