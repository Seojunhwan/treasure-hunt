import * as THREE from 'three';
import { createControls, isDesktop } from './game/controls.js';
import { createFollowCamera } from './game/camera.js';
import { buildWorld } from './game/world.js';
import { createAtmosphere } from './game/atmosphere.js';
import { createPost } from './game/post.js';
import { createRemotePlayers } from './game/players.js';
import { createAvatar, variantFor } from './game/avatar.js';
import { createTreasures } from './game/treasures.js';
import { createHint } from './game/hint.js';
import { unlockAudio, play, startAmbient, isMuted, setMuted } from './game/audio.js';
import { createFx, createTrail } from './game/fx.js';
import { createProps } from './game/physics.js';
import { connect } from './net.js';
import { showBanner, goFullscreen } from './install.js';
import { mmss } from './format.js';
import { MOVE_SPEED, PLAYER_RADIUS, PICKUP_RADIUS, PICKUP_HEIGHT, HINT_SECONDS, FALL_SPEED, QUIZ_SECONDS } from '../../shared/constants.js';
import { resolveCollision, clampToCircle, heightAt, lineOfSight } from '../../shared/collision.js';
import { SPAWN, INTERIORS } from '../../shared/map.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // full retina res costs too much fps on mid-range phones
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const atmosphere = createAtmosphere(scene);
buildWorld(scene); // async: houses pop in as they load

// player is the position/rotation anchor; the model is attached once we know our id
const player = new THREE.Group();
player.visible = false;
scene.add(player);
let myAvatar = null;
const fx = createFx(scene);
const others = createRemotePlayers(scene, fx);
const treasures = createTreasures(scene, fx);
let stepCount = 0;
const props = createProps(scene, (strength) => play('bump', { volume: 0.25 + strength * 0.5, rate: 0.85 + Math.random() * 0.3 }));
let lastX = 0, lastZ = 0;
const myTrail = createTrail(fx, (speed) => {
  const running = speed > 3.5;
  if (running && stepCount++ % 2) return; // running: every other footprint, or it patters
  play('step' + ((Math.random() * 4) | 0), running ? { volume: 0.32, rate: 0.72 + Math.random() * 0.08 } : { volume: 0.26, rate: 0.92 + Math.random() * 0.1 });
});
let fp = 0; // 0 third person … 1 first person (inside houses)
const indoors = (x, z) => INTERIORS.some((b) => Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2);

const view = createFollowCamera();
const post = createPost(renderer, scene, view.camera);
const controls = createControls(renderer.domElement);
if (isDesktop) document.body.classList.add('desktop'); // shows key hints (F, 1-5), hides phone-only copy
let me = null; // { id, name } once joined
let phase = 'waiting';
let camOverride = null; // dev: fixed camera for screenshots
let remaining = Infinity;
const hint = createHint(document.getElementById('glow'));
addEventListener('pointerdown', unlockAudio);

// CSS sizes the canvas to the screen; we follow whatever size it ends up with. iOS fires
// resize before the rotation finishes, so watching the canvas itself is the reliable signal.
function resize() {
  const { clientWidth: w, clientHeight: h } = renderer.domElement;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  post.setSize(w, h);
  view.camera.aspect = w / h;
  view.camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(renderer.domElement);
resize();

const debug = new URLSearchParams(location.search).has('debug');
const fpsEl = document.getElementById('fps');
// debug: tap the fps badge to flip post-processing and compare on the phone
fpsEl.addEventListener('pointerdown', () => post.toggle());
let frames = 0, fpsAt = 0;
let prev = 0;
renderer.setAnimationLoop((now) => {
  if (debug && ++frames && now - fpsAt > 1000) {
    fpsEl.textContent = `${Math.round((frames * 1000) / (now - fpsAt))} fps · ${others.count + (me ? 1 : 0)}명${post.enabled ? ' · FX' : ''}`;
    frames = 0; fpsAt = now;
  }
  const dt = Math.min((now - prev) / 1000, 0.1); // cap avoids a huge jump after the tab was backgrounded
  prev = now;
  const look = controls.takeLook();
  view.rotate(look.dx, look.dy);

  const m = me && phase !== 'ended' && !quiz ? controls.getMove() : { x: 0, y: 0 };
  myAvatar?.setSpeed(Math.hypot(m.x, m.y) * MOVE_SPEED);
  myAvatar?.update(dt);
  if (m.x || m.y) {
    // camera-relative: forward points from camera toward player on the ground plane
    const s = Math.sin(view.yaw), c = Math.cos(view.yaw);
    const vx = (-s * m.y + c * m.x) * MOVE_SPEED;
    const vz = (-c * m.y - s * m.x) * MOVE_SPEED;
    const y = player.position.y;
    let p = resolveCollision(player.position.x + vx * dt, player.position.z + vz * dt, PLAYER_RADIUS, y);
    if (phase === 'waiting') p = clampToCircle(p.x, p.z, SPAWN);
    player.position.x = p.x;
    player.position.z = p.z;
    const ground = heightAt(p.x, p.z, y);
    player.position.y = ground >= y ? ground : Math.max(ground, y - FALL_SPEED * dt); // climb instantly, fall smoothly
    player.rotation.y = Math.atan2(-vx, -vz);
  }
  tickQuiz(now);
  others.update(dt);
  const pushers = others.pushers([]);
  if (me && dt > 0) pushers.push({ x: player.position.x, z: player.position.z, vx: (player.position.x - lastX) / dt, vz: (player.position.z - lastZ) / dt, r: 0.4 });
  lastX = player.position.x; lastZ = player.position.z;
  props.update(dt, pushers, player.position);
  treasures.update(now, dt);
  fx.update(dt);
  if (me) myTrail(player.position.x, player.position.y, player.position.z, player.rotation.y, Math.hypot(m.x, m.y) * MOVE_SPEED);
  const pos = player.position;
  const near = me && phase === 'playing' && !quiz ? treasures.nearest(pos.x, pos.z) : null;
  // show at PICKUP_RADIUS, keep showing a little past it (server allows PICKUP_TOLERANCE) so a moving thumb still lands
  const reach = pickBtn.hidden ? PICKUP_RADIUS : PICKUP_RADIUS + 0.4;
  const canPick = !!near && near.dist <= reach && Math.abs(near.y - pos.y) <= PICKUP_HEIGHT &&
    lineOfSight([pos.x, pos.y + 1.2, pos.z], [near.x, near.y + 0.4, near.z]);
  if (pickBtn.hidden === canPick) pickBtn.hidden = !canPick; // touch the DOM only on change
  nearId = canPick ? near.id : null;
  hint.update(now, near && remaining <= HINT_SECONDS * 1000 ? near.dist : null);
  if (camOverride) { view.camera.position.set(...camOverride.pos); view.camera.lookAt(...camOverride.look); }
  else {
    fp += ((me && indoors(pos.x, pos.z) ? 1 : 0) - fp) * (1 - Math.exp(-dt * 5));
    const camDist = view.follow(player.position, dt, fp);
    if (myAvatar) myAvatar.root.visible = camDist > 0.9; // don't look at the inside of our own head
  }
  atmosphere.update(dt, view.camera);
  post.render(now);
});

const status = document.getElementById('status');
const debugNet = new URLSearchParams(location.search).has('debug');
function showStatus(connected) {
  status.classList.toggle('ok', connected);
  status.querySelector('.name').textContent = connected ? (me ? me.name : '연결됨') : '다시 연결하는 중…';
  status.querySelector('.net').textContent = debugNet && connected ? net.socket.io.engine.transport.name : '';
}
const hudTimer = document.getElementById('timer');
const hudMsg = document.getElementById('msg');
const PHASE_MSG = { waiting: '관리자가 시작하면 출발해요!', playing: '', ended: '게임 종료!' };
hudMsg.textContent = PHASE_MSG.waiting;
const net = connect({
  onStatus: () => {
    const s = net.socket;
    showStatus(s.connected);
  },
  onState: (state) => {
    if (state.phase !== phase) hudMsg.textContent = PHASE_MSG[state.phase];
    if (state.phase === 'ended' && me) showResult(state.ranking);
    else resultEl.hidden = true;
    if (state.phase === 'playing' && remaining > HINT_SECONDS * 1000 && state.remainingMs <= HINT_SECONDS * 1000) {
      toast('힌트 시작! 가까울수록 소리가 빨라져요', 'gold');
      play('hint');
    }
    if (me && phase === 'waiting' && state.phase === 'playing') { toast('출발! 보물을 찾아라'); guide(false); play('start'); }
    if (me && phase === 'playing' && state.phase === 'ended') play('end');
    phase = state.phase;
    guideBtn.hidden = !me || phase !== 'waiting';
    if (me && phase === 'waiting' && !guideShown) { guideShown = true; guide(true); }
    remaining = state.remainingMs;
    hudTimer.textContent = mmss(state.remainingMs);
    hudTimer.parentElement.parentElement.classList.toggle('urgent', state.phase === 'playing' && state.remainingMs <= 60_000);
    others.sync(state.players, me?.id);
    treasures.setFound(state.found);
  },
  onCorrect: ({ x, z }) => { player.position.x = x; player.position.z = z; },
  onFound: (playerId, treasureId) => { others.pickUp(playerId); treasures.collect(treasureId); if (quiz?.id === treasureId) closeQuiz('taken'); },
  onTreasures: (list) => { treasures.setLayout(list); if (!list.length) closeQuiz(); },
});

const pickBtn = document.getElementById('pickup');
const scoreEl = document.getElementById('score');
const toastEl = document.getElementById('toast');
let nearId = null, toastTimer = 0;
const setScore = (n) => { scoreEl.querySelector('b').textContent = n; };
function toast(text, tone = '') {
  toastEl.textContent = text;
  toastEl.className = tone;
  toastEl.style.animation = 'none'; void toastEl.offsetWidth; toastEl.style.animation = ''; // replay the drop-in
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1600);
}
// --- quiz: each gift has its own question; one shot per player, first right answer takes it ---
const quizEl = document.getElementById('quiz');
const quizQ = quizEl.querySelector('.q');
const quizChoices = quizEl.querySelector('.choices');
const quizBar = quizEl.querySelector('.bar i');
const noteEl = document.getElementById('note');
let quiz = null; // { id, deadline, answered }
let noteTimer = 0;

function note(title, body) {
  noteEl.querySelector('b').textContent = title;
  noteEl.querySelector('span').textContent = body;
  noteEl.hidden = false;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { noteEl.hidden = true; }, 4500);
}

function openQuiz(id, question, choices, remainingMs) {
  quiz = { id, deadline: performance.now() + remainingMs, answered: false };
  quizQ.textContent = question;
  quizChoices.replaceChildren(...choices.map((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    const key = document.createElement('kbd');
    key.textContent = i + 1;
    b.append(key, c); // admin text as a text node: never innerHTML
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); answer(i, b); });
    return b;
  }));
  quizChoices.className = 'choices n' + choices.length + (choices.length === 2 ? ' ox' : '');
  quizEl.hidden = false;
  pickBtn.hidden = true;
}

function closeQuiz(reason) {
  if (!quiz) return;
  if (reason === 'taken') { play('taken'); toast('앗, 다른 사람이 먼저 맞혔어요'); }
  quiz = null;
  quizEl.hidden = true;
}

function answer(choice, btn) {
  if (!quiz || quiz.answered) return;
  quiz.answered = true;
  btn?.classList.add('picked');
  const id = quiz.id;
  net.socket.emit('treasure:answer', { id, choice }, (res) => {
    setScore(res.score);
    if (res.result === 'ok') { treasures.collect(id); myAvatar?.pickUp(); play('pickup'); toast(`정답! 보물 ${res.score}개째`, 'gold'); }
    else if (res.result === 'wrong') {
      treasures.markTried(id);
      play('taken');
      note(res.timeout ? '시간 초과' : '아쉽게 틀렸어요', `정답은 「${res.answer}」${res.explain ? ' · ' + res.explain : ''}`);
    } else if (res.result === 'taken') { play('taken'); toast('앗, 다른 사람이 먼저 맞혔어요'); }
    quiz = null;
    quizEl.hidden = true;
  });
}

// keyboard: F opens the gift in reach, 1-6 picks an answer, Esc/Enter closes the guide
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.repeat) return;
  if (!guideEl.hidden) { if (e.code === 'Escape' || e.code === 'Enter') guide(false); return; }
  if (quiz) {
    const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
    const btn = n && quizChoices.children[n - 1];
    if (btn) answer(n - 1, btn);
  } else if (e.code === 'KeyF') openGift();
});

function tickQuiz(now) {
  if (!quiz || quiz.answered) return;
  const left = quiz.deadline - now;
  quizBar.style.transform = `scaleX(${Math.max(0, left / (QUIZ_SECONDS * 1000))})`;
  quizEl.classList.toggle('hurry', left < 5000);
  if (left <= 0) answer(null);
}

// pointerdown, not click: iOS drops clicks while another finger is on the joystick
pickBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openGift();
});
function openGift() {
  if (nearId === null || quiz) return;
  const id = nearId;
  play('click');
  net.socket.emit('treasure:open', { id, x: player.position.x, y: player.position.y, z: player.position.z }, (res) => {
    if (res.result === 'quiz') openQuiz(id, res.question, res.choices, res.remainingMs);
    else if (res.result === 'taken') { play('taken'); toast('앗, 한발 늦었어요'); }
    else if (res.result === 'tried') { treasures.markTried(id); toast('이미 도전한 선물이에요'); }
    else if (res.result === 'far') toast('조금 더 가까이 가세요');
  });
}

// how-to-play card: opens once on joining before the start, reopens from the ? button while waiting
const guideEl = document.getElementById('guide');
const guideBtn = document.getElementById('guide-btn');
let guideShown = false;
function guide(open) {
  guideEl.hidden = !open;
  if (!open) document.activeElement?.blur(); // so Enter doesn't re-press the ? button that opened it
}
guideEl.querySelector('.close').addEventListener('click', () => guide(false));
guideBtn.addEventListener('click', () => guide(true));

const resultEl = document.getElementById('result');
function showResult(ranking) {
  const mine = ranking.find((r) => r.id === me.id);
  const text = mine ? `${mine.rank}|보물 ${mine.score}개` : '|이번엔 보물을 못 찾았어요';
  if (resultEl.hidden || resultEl.dataset.text !== text) {
    resultEl.dataset.text = text;
    const [rank, line] = text.split('|');
    resultEl.querySelector('.rank').textContent = rank ? rank + '위' : '';
    resultEl.querySelector('.mine').textContent = line;
    resultEl.hidden = false;
  }
}

const muteBtn = document.getElementById('mute');
const showMute = () => { muteBtn.classList.toggle('muted', isMuted()); muteBtn.setAttribute('aria-label', isMuted() ? '소리 켜기' : '소리 끄기'); };
muteBtn.addEventListener('click', () => { unlockAudio(); setMuted(!isMuted()); showMute(); });
showMute();
// returning players skip the join tap, so the first touch anywhere starts the music
addEventListener('pointerdown', () => { if (me) startAmbient(); });

function enter(res) {
  me = { id: res.id, name: res.name };
  treasures.setLayout(res.treasures ?? []);
  for (const id of res.tried ?? []) treasures.markTried(id);
  if (!myAvatar) { myAvatar = createAvatar(variantFor(res.id)); player.add(myAvatar.root); }
  setScore(res.score);
  scoreEl.hidden = false;
  player.position.set(res.x, res.y ?? 0, res.z);
  player.visible = true;
  joinForm.hidden = true;
  document.body.classList.remove('lobby');
  showStatus(net.socket.connected);
  net.startSending(() => ({ x: player.position.x, y: player.position.y, z: player.position.z, ry: player.rotation.y }));
}

const joinForm = document.getElementById('join');
const nameInput = document.getElementById('name');
const joinError = document.getElementById('join-error');
nameInput.addEventListener('blur', () => scrollTo(0, 0)); // iOS keyboard can leave the page shifted
joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  goFullscreen(); // needs the tap, so before any await
  unlockAudio();
  startAmbient();
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

if (import.meta.env.DEV) window.__game = { props, renderer, scene, player, view, others, treasures, setRemaining: (ms) => { remaining = ms; }, setCam: (c) => { camOverride = c; } }; // lets browser automation read state
