import * as THREE from 'three';
import { createControls } from './game/controls.js';
import { createFollowCamera } from './game/camera.js';
import { buildWorld } from './game/world.js';
import { makeAvatar, createRemotePlayers } from './game/players.js';
import { createTreasures } from './game/treasures.js';
import { createHint, unlockAudio } from './game/hint.js';
import { connect } from './net.js';
import { showBanner, goFullscreen } from './install.js';
import { mmss } from './format.js';
import { MOVE_SPEED, PLAYER_RADIUS, PICKUP_RADIUS, HINT_SECONDS } from '../../shared/constants.js';
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
const treasures = createTreasures(scene);

const view = createFollowCamera();
const controls = createControls(renderer.domElement);
let me = null; // { id, name } once joined
let phase = 'waiting';
let remaining = Infinity;
const hint = createHint(document.getElementById('glow'));
addEventListener('pointerdown', unlockAudio); // returning players skip the join tap

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

  const m = me && phase !== 'ended' ? controls.getMove() : { x: 0, y: 0 };
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
  treasures.update(now);
  const near = me && phase === 'playing' ? treasures.nearest(player.position.x, player.position.z) : null;
  const canPick = !!near && near.dist <= PICKUP_RADIUS;
  if (pickBtn.hidden === canPick) pickBtn.hidden = !canPick; // touch the DOM only on change
  nearId = canPick ? near.id : null;
  hint.update(now, near && remaining <= HINT_SECONDS * 1000 ? near.dist : null);
  view.follow(player.position);
  renderer.render(scene, view.camera);
});

const status = document.getElementById('status');
const hudTimer = document.getElementById('timer');
const hudMsg = document.getElementById('msg');
const PHASE_MSG = { waiting: '관리자가 시작하면 출발해요!', playing: '', ended: '게임 종료!' };
hudMsg.textContent = PHASE_MSG.waiting;
const net = connect({
  onStatus: () => {
    const s = net.socket;
    status.textContent = s.connected ? `${me ? me.name + ' · ' : ''}연결됨 · ${s.io.engine.transport.name}` : '연결 끊김, 재연결 중…';
  },
  onState: (state) => {
    if (state.phase !== phase) hudMsg.textContent = PHASE_MSG[state.phase];
    if (state.phase === 'ended' && me) showResult(state.ranking);
    else resultEl.hidden = true;
    if (state.phase === 'playing' && remaining > HINT_SECONDS * 1000 && state.remainingMs <= HINT_SECONDS * 1000) {
      toast('💡 힌트 시작! 보물에 가까울수록 소리가 빨라져요');
    }
    phase = state.phase;
    remaining = state.remainingMs;
    hudTimer.textContent = mmss(state.remainingMs);
    others.sync(state.players, me?.id);
    treasures.setFound(state.found);
  },
  onCorrect: ({ x, z }) => player.position.set(x, player.position.y, z),
});

const pickBtn = document.getElementById('pickup');
const scoreEl = document.getElementById('score');
const toastEl = document.getElementById('toast');
let nearId = null, toastTimer = 0;
const setScore = (n) => { scoreEl.textContent = `💎 ${n}`; };
function toast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1600);
}
pickBtn.addEventListener('click', () => {
  if (nearId === null) return;
  const id = nearId;
  net.socket.emit('treasure:pickup', { id, x: player.position.x, z: player.position.z }, ({ result, score }) => {
    setScore(score);
    if (result === 'ok') { treasures.hide(id); toast(`🎉 보물 획득! (${score}개)`); }
    else if (result === 'taken') { treasures.hide(id); toast('앗, 한발 늦었어요!'); }
    else if (result === 'far') toast('조금 더 가까이 가세요');
  });
});

const resultEl = document.getElementById('result');
function showResult(ranking) {
  const mine = ranking.find((r) => r.id === me.id);
  const text = mine ? `${mine.rank}위 · 보물 ${mine.score}개` : '이번엔 보물을 못 찾았어요';
  if (resultEl.hidden || resultEl.dataset.text !== text) {
    resultEl.dataset.text = text;
    resultEl.querySelector('.mine').textContent = text;
    resultEl.hidden = false;
  }
}

function enter(res) {
  me = { id: res.id, name: res.name };
  setScore(res.score);
  scoreEl.hidden = false;
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
  unlockAudio();
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

if (import.meta.env.DEV) window.__game = { player, view, others, treasures, setRemaining: (ms) => { remaining = ms; } }; // lets browser automation read state
