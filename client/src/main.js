import * as THREE from 'three';
import { createControls, isDesktop } from './game/controls.js';
import { createFollowCamera } from './game/camera.js';
import { buildWorld } from './game/world.js';
import { createAtmosphere } from './game/atmosphere.js';
import { createPost } from './game/post.js';
import { createRemotePlayers, makeLabel, makeDeskNameplate } from './game/players.js';
import { createAvatar, variantFor } from './game/avatar.js';
import { createOpening } from './game/opening.js';
import { createTreasures } from './game/treasures.js';
import { createHint } from './game/hint.js';
import { unlockAudio, play, startAmbient, isMuted, setMuted } from './game/audio.js';
import { createFx, createTrail } from './game/fx.js';
import { createProps } from './game/physics.js';
import { createDeskHighlight } from './game/office-desk-details.js';
import { connect } from './net.js';
import { showBanner, goFullscreen } from './install.js';
import { mmss } from './format.js';
import { MOVE_SPEED, PLAYER_RADIUS, PICKUP_RADIUS, PICKUP_HEIGHT, HINT_SECONDS, JUMP_SPEED, QUIZ_SECONDS } from '../../shared/constants.js';
import { resolveCollision, resolvePlayerCollision, clampToCircle, verticalStep, lineOfSight, treasureInSight, treasureTarget } from '../../shared/collision.js';
import { interactionInReach } from '../../shared/office-interactions.js';
import * as map from '../../shared/map.js';

const { SPAWN, INTERIORS, MAP_THEME, CDRAGON, DESK_INTERACTIONS = [] } = map;
const officeTargets = CDRAGON ? [...DESK_INTERACTIONS, CDRAGON] : DESK_INTERACTIONS;
const officeLobby = MAP_THEME === 'office';
const personalGifts = !!map.PICKUP_TREASURE_SPOTS;
const noteHunt = map.PICKUP_TREASURE_SPOTS?.some(({ kind }) => kind === 'note') ?? false;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // full retina res costs too much fps on mid-range phones
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const atmosphere = createAtmosphere(scene);
buildWorld(scene); // async: furniture pops in as it loads

const LEADER_SCALE = 1.5;
const leader = {
  name: 'zinga.k',
  line: noteHunt ? '라운지에 쪽지를 숨겨 뒀어요. 식탁 위부터 살펴봐요.' : '가운데 복도에서 공기청정기 옆 책상을 살펴봐요.',
  variant: 'male-f',
  x: SPAWN.x + 0.9, z: SPAWN.z - 2.7, reach: 3.2,
};
const leaderDialog = document.getElementById('leader-dialog');
const closeLeaderButton = leaderDialog.querySelector('button');
const speakerName = document.querySelector('#leader-name span');
const speakerLine = document.getElementById('leader-line');

function addLeader(npc) {
  const avatar = createAvatar(npc.variant, { scale: LEADER_SCALE });
  const label = makeLabel(`${npc.name} · 리더 NPC`);
  label.position.y *= LEADER_SCALE;
  avatar.root.add(label);
  avatar.root.position.set(npc.x, 0, npc.z);
  avatar.root.rotation.y = npc.ry ?? Math.PI;
  scene.add(avatar.root);
  return avatar;
}

const leaderAvatar = MAP_THEME === 'office' ? addLeader(leader) : null;
const cdragonAvatar = noteHunt && CDRAGON ? addLeader(CDRAGON) : null;
const deskHighlight = noteHunt ? createDeskHighlight(scene, map.FURNITURE) : null;
if (noteHunt) {
  const monitors = map.FURNITURE.filter(({ name }) => name === 'computerScreen');
  for (const desk of DESK_INTERACTIONS) {
    if (!desk.name) continue;
    const monitor = monitors.find(({ x, z }) => x === desk.x && Math.abs(z - desk.z) < 0.9);
    if (!monitor) continue;
    scene.add(makeDeskNameplate(desk.name, monitor, desk.side));
  }
}

const opening = leaderAvatar ? createOpening(scene, leader, document.getElementById('opening-card')) : null;

// player is the position/rotation anchor; the model is attached once we know our id
const player = new THREE.Group();
player.visible = false;
scene.add(player);
let myAvatar = null;
const fx = createFx(scene);
const others = createRemotePlayers(scene, fx);
const treasures = createTreasures(scene, fx, personalGifts);
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
const projectedTarget = new THREE.Vector3();
function projectTarget(target) {
  projectedTarget.fromArray(target).project(view.camera);
  return Math.abs(projectedTarget.x) < 0.9 && Math.abs(projectedTarget.y) < 0.9 &&
    projectedTarget.z >= -1 && projectedTarget.z <= 1;
}
function noteOnScreen(treasure) {
  const { camera } = view;
  camera.updateMatrixWorld();
  return projectTarget(treasureTarget(treasure)) && treasureInSight(camera.position.toArray(), treasure);
}

function officeTargetInView(pos) {
  if (!noteHunt || phase !== 'playing' || !me || !guideEl.hidden) return null;
  const { camera } = view;
  camera.updateMatrixWorld();
  const eye = camera.position.toArray();
  let best = null, bestDistance = Infinity;
  for (const target of officeTargets) {
    if (!interactionInReach(pos, target)) continue;
    const point = [target.x, target.y, target.z];
    if (!projectTarget(point) || !lineOfSight(eye, point)) continue;
    const selected = target === nearbyDesk || target === nearbyLeader;
    const distance = Math.hypot(projectedTarget.x, projectedTarget.y) - (selected ? 0.045 : 0);
    if (distance < bestDistance) { best = target; bestDistance = distance; }
  }
  return best;
}
const post = createPost(renderer, scene, view.camera);
const freeLookBtn = document.getElementById('free-look');
const freeLookHint = freeLookBtn.querySelector('span');
function canFreeLook() {
  return !!me && (phase === 'waiting' || phase === 'playing') &&
    guideEl.hidden && leaderDialog.hidden && !quiz && !camOverride;
}
const controls = createControls(renderer.domElement, {
  canFreeLook,
  onFreeLookChange(active) {
    freeLookBtn.setAttribute('aria-pressed', String(active));
    freeLookHint.hidden = !active;
  },
  onFreeLookError() { toast('자유 시점을 켤 수 없어요. 화면을 드래그해 주세요.'); },
});
freeLookBtn.addEventListener('click', controls.toggleFreeLook);
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
// rAF follows the screen (60/120/144/240Hz); render at most ~120 fps. Due time advances on a grid so a 144Hz
// screen still gets ~120 instead of halving to 72.
const FRAME_MS = 1000 / 120;
let due = 0;
renderer.setAnimationLoop((now) => {
  if (now < due - 1) return;
  due = Math.max(due + FRAME_MS, now);
  if (debug && ++frames && now - fpsAt > 1000) {
    fpsEl.textContent = `${Math.round((frames * 1000) / (now - fpsAt))} fps · ${others.count + (me ? 1 : 0)}명${post.enabled ? ' · FX' : ''}`;
    frames = 0; fpsAt = now;
  }
  const dt = Math.min((now - prev) / 1000, 0.1); // cap avoids a huge jump after the tab was backgrounded
  prev = now;
  const showFreeLook = controls.freeLookAvailable && canFreeLook();
  if (freeLookBtn.hidden === showFreeLook) freeLookBtn.hidden = !showFreeLook;
  if (!showFreeLook) controls.exitFreeLook(true);
  const look = controls.takeLook();
  const openingActive = opening && me && phase === 'opening';
  const openingFocus = openingActive ? opening.update(now) : 0;
  if (!openingActive) view.rotate(look.dx, look.dy);

  others.update(dt);
  const pushers = others.pushers([]);
  const canMove = me && phase !== 'ended' && !openingActive && !quiz && leaderDialog.hidden;
  const m = canMove ? controls.getMove() : { x: 0, y: 0 };
  let walkSpeed = 0;
  leaderAvatar?.update(dt);
  cdragonAvatar?.update(dt);
  if (m.x || m.y) {
    // camera-relative: forward points from camera toward player on the ground plane
    const yaw = view.yaw;
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const vx = (-s * m.y + c * m.x) * MOVE_SPEED;
    const vz = (-c * m.y - s * m.x) * MOVE_SPEED;
    let p = resolveCollision(player.position.x + vx * dt, player.position.z + vz * dt, PLAYER_RADIUS, player.position.y);
    const limitToSpawn = !officeLobby && phase !== 'playing';
    if (limitToSpawn) p = clampToCircle(p.x, p.z, SPAWN);
    const step = resolvePlayerCollision(player.position, p, pushers);
    if (step !== p) {
      const clear = resolveCollision(step.x, step.z, PLAYER_RADIUS, player.position.y);
      const inBounds = !limitToSpawn || Math.hypot(step.x - SPAWN.x, step.z - SPAWN.z) <= SPAWN.r + 1e-6;
      // Player contact can deflect a step into a wall. Keep the previous position in that case.
      p = inBounds && Math.hypot(clear.x - step.x, clear.z - step.z) < 1e-6 ? step : player.position;
    }
    if (dt > 0) walkSpeed = Math.hypot(p.x - player.position.x, p.z - player.position.z) / dt;
    player.position.x = p.x;
    player.position.z = p.z;
    player.rotation.y = Math.atan2(-vx, -vz);
  }
  if (me) {
    if (jumpAsked && grounded && canMove) { vy = JUMP_SPEED; grounded = false; }
    jumpAsked = false;
    const v = verticalStep(player.position.x, player.position.z, player.position.y, vy, grounded, dt);
    player.position.y = v.y; vy = v.vy; grounded = v.grounded;
    myAvatar?.setAir(grounded ? null : vy > 0 ? 'jump' : 'fall');
  }
  myAvatar?.setSpeed(Math.min(walkSpeed, MOVE_SPEED));
  myAvatar?.update(dt);
  tickQuiz(now);
  if (me && dt > 0) pushers.push({ x: player.position.x, z: player.position.z, vx: (player.position.x - lastX) / dt, vz: (player.position.z - lastZ) / dt, r: PLAYER_RADIUS });
  lastX = player.position.x; lastZ = player.position.z;
  props.update(dt, pushers, player.position);
  treasures.update(now, dt);
  fx.update(dt);
  if (me) myTrail(player.position.x, player.position.y, player.position.z, player.rotation.y, grounded ? Math.min(walkSpeed, MOVE_SPEED) : 0);
  const pos = player.position;
  if (camOverride) { view.camera.position.set(...camOverride.pos); view.camera.lookAt(...camOverride.look); }
  else {
    fp += ((me && indoors(pos.x, pos.z) ? 1 : 0) - fp) * (1 - Math.exp(-dt * 5));
    const camDist = view.follow(player.position, dt, fp);
    if (openingFocus) opening.blendCamera(view.camera, openingFocus);
    if (myAvatar) myAvatar.root.visible = openingFocus < 0.95 && camDist > 0.9;
  }
  const near = me && phase === 'playing' && !quiz ? treasures.nearest(pos.x, pos.z) : null;
  // show at PICKUP_RADIUS, keep showing a little past it (server allows PICKUP_TOLERANCE) so a moving thumb still lands
  const reach = pickBtn.hidden ? PICKUP_RADIUS : PICKUP_RADIUS + 0.4;
  const canPick = !!near && near.dist <= reach && Math.abs(near.y - pos.y) <= PICKUP_HEIGHT &&
    treasureInSight([pos.x, pos.y + 1.2, pos.z], near) &&
    (near.kind !== 'note' || noteOnScreen(near));
  const officeTarget = canPick ? null : officeTargetInView(pos);
  const officeLeader = officeTarget === CDRAGON ? officeTarget : null;
  nearbyLeader = noteHunt && canPick ? null : officeLeader ?? (leaderInReach() ? leader : null);
  nearbyDesk = nearbyLeader ? null : officeTarget;
  nearId = canPick ? near.id : null;
  const label = nearbyLeader ? '말 걸기' : nearbyDesk || near?.kind === 'note' ? '살펴보기' : giftAction;
  if (pickLabel.textContent !== label) pickLabel.textContent = label;
  pickBtn.classList.toggle('talk', !!nearbyLeader);
  pickBtn.hidden = !leaderDialog.hidden || !guideEl.hidden || !(nearbyLeader || nearbyDesk || canPick);
  deskHighlight?.set(pickBtn.hidden ? null : nearbyDesk);
  hint.update(now, !noteHunt && near && remaining <= HINT_SECONDS * 1000 ? near.dist : null);
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
const PHASE_MSG = { waiting: officeLobby ? '시작 전까지 사무실과 라운지를 둘러보세요.' : '관리자가 시작하면 출발해요!', opening: '', playing: '', ended: '게임 종료!' };
hudMsg.textContent = PHASE_MSG.waiting;
const net = connect({
  onStatus: () => {
    const s = net.socket;
    showStatus(s.connected);
  },
  onRejoin: restorePlayer,
  onState: (state) => {
    if (state.phase === 'opening') {
      if (phase !== 'opening') {
        guide(false);
        leaderDialog.hidden = true;
      }
      opening?.sync(state.openingRemainingMs);
    } else if (phase === 'opening') {
      opening?.clear();
    }
    if (state.phase !== phase) hudMsg.textContent = PHASE_MSG[state.phase];
    if (state.phase === 'ended' && me) showResult(state.ranking);
    else resultEl.hidden = true;
    if (!noteHunt && state.phase === 'playing' && remaining > HINT_SECONDS * 1000 && state.remainingMs <= HINT_SECONDS * 1000) {
      toast('힌트 시작! 가까울수록 소리가 빨라져요', 'gold');
      play('hint');
    }
    if (me && (phase === 'opening' || (!opening && phase === 'waiting')) && state.phase === 'playing') { toast('출발! 보물을 찾아라'); guide(false); play('start'); }
    if (me && phase === 'playing' && state.phase === 'ended') {
      leaderDialog.hidden = true;
      play('end');
    }
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
  onTreasures: (list) => {
    treasures.setLayout(list);
    if (!list.length) {
      pendingAction = null;
      leaderDialog.hidden = true;
      noteEl.hidden = true;
      setScore(0);
      closeQuiz();
    }
  },
});

const pickBtn = document.getElementById('pickup');
const pickLabel = pickBtn.querySelector('span');
const giftAction = personalGifts ? '줍기' : '열기';
pickLabel.textContent = giftAction;
const scoreEl = document.getElementById('score');
if (noteHunt) {
  scoreEl.setAttribute('aria-label', '내 응모권');
  document.getElementById('score-label').hidden = false;
  document.querySelector('#result .sub').hidden = true;
}
const toastEl = document.getElementById('toast');
let nearId = null, toastTimer = 0;
let pendingAction = null, nearbyDesk = null, nearbyLeader = null;
let vy = 0, grounded = true, jumpAsked = false; // vertical motion of my player
const setScore = (n) => { scoreEl.querySelector('b').textContent = noteHunt ? `${n}장` : n; };
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

// keyboard: F talks to the leader or opens the gift in reach; 1-6 picks a quiz answer
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.repeat) return;
  if (!guideEl.hidden) {
    if (e.code === 'Escape') guide(false);
    else if (e.code === 'Enter') closeGuide();
    return;
  }
  if (!leaderDialog.hidden) { if (e.code === 'Escape') closeLeader(); return; }
  if (quiz) {
    const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
    const btn = n && quizChoices.children[n - 1];
    if (btn) answer(n - 1, btn);
  } else if (e.code === 'KeyF') interact();
  else if (e.code === 'Space') { e.preventDefault(); jumpAsked = true; }
});
// phones: the jump button (pointerdown so it works while the other thumb steers)
const jumpBtn = document.getElementById('jump');
jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); jumpAsked = true; });

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
  interact();
});
pickBtn.addEventListener('click', (e) => { if (e.detail === 0) interact(); });
closeLeaderButton.addEventListener('click', closeLeader);

function leaderInReach() {
  if (!leaderAvatar || !me || quiz || (phase !== 'waiting' && phase !== 'playing') || !guideEl.hidden) return false;
  const { x, y, z } = player.position;
  return Math.hypot(x - leader.x, z - leader.z) <= leader.reach && y <= PICKUP_HEIGHT &&
    lineOfSight([x, y + 1.2, z], [leader.x, 1.2, leader.z]);
}

function interact() {
  if (phase === 'opening' || !leaderDialog.hidden || !guideEl.hidden) return;
  if (nearbyLeader === leader) showLeader(leader.name, leader.line);
  else if (nearbyLeader === CDRAGON && CDRAGON) inspect(CDRAGON.id);
  else if (nearId !== null) openGift();
  else if (nearbyDesk) inspect(nearbyDesk.id);
}

function showLeader(name, line) {
  play('click');
  speakerName.textContent = name;
  speakerLine.textContent = line;
  leaderDialog.hidden = false;
  closeLeaderButton.focus();
}

function closeLeader() {
  leaderDialog.hidden = true;
  pickBtn.hidden = false;
  pickBtn.focus();
}

function requestNearbyAction(event, id, onResult) {
  if (pendingAction || phase !== 'playing' || !net.socket.connected) return;
  const request = {};
  pendingAction = request;
  const { x, y, z } = player.position;
  net.socket.timeout(3000).emit(event, { id, x, y, z }, (err, res) => {
    if (pendingAction !== request) return;
    pendingAction = null;
    if (err) toast('연결을 확인하고 다시 눌러 주세요');
    else if (res.result === 'far') toast('조금 더 가까이 가세요');
    else onResult(res);
  });
}

function celebratePickup(score) {
  myAvatar?.pickUp();
  setScore(score);
  play('pickup');
}

function inspect(id) {
  requestNearbyAction('office:inspect', id, (res) => {
    if (res.result === 'dialogue') {
      if (Number.isInteger(res.score)) setScore(res.score);
      showLeader(res.title, res.text);
    }
    else if (res.result === 'look') {
      if (Number.isInteger(res.score)) setScore(res.score);
      play('click');
      note(res.title, res.text);
    }
    else if (res.result === 'reward') {
      celebratePickup(res.score);
      if (id === CDRAGON?.id) showLeader(res.title, res.text);
      else note(res.title, res.text);
      toast('개인 응모권 +1장', 'gold');
    }
  });
}

function openGift() {
  if (nearId === null || quiz || phase !== 'playing' || !net.socket.connected) return;
  const id = nearId;
  const { x, y, z } = player.position;
  if (personalGifts) {
    requestNearbyAction('treasure:open', id, (res) => {
      if (res.result === 'ok') {
        treasures.collect(id);
        celebratePickup(res.score);
        toast(noteHunt ? `${res.shared ? '공유' : '개인'} 응모권 +1장` : `보물 ${res.score}개째!`, 'gold');
      } else if (res.result === 'collected') {
        treasures.setFound([id]);
        setScore(res.score);
      } else if (res.result === 'taken') {
        treasures.setFound([id]);
        toast('다른 참가자가 먼저 가져갔어요');
      }
    });
    return;
  }
  play('click');
  net.socket.emit('treasure:open', { id, x, y, z }, (res) => {
    if (res.result === 'quiz') openQuiz(id, res.question, res.choices, res.remainingMs);
    else if (res.result === 'taken') { play('taken'); toast('앗, 한발 늦었어요'); }
    else if (res.result === 'tried') { treasures.markTried(id); toast('이미 도전한 선물이에요'); }
    else if (res.result === 'far') toast('조금 더 가까이 가세요');
  });
}

// how-to-play card: opens once on joining before the start, reopens from the ? button while waiting
const guideEl = document.getElementById('guide');
const guideBtn = document.getElementById('guide-btn');
if (personalGifts) {
  for (const section of guideEl.querySelectorAll('[data-quiz-guide]')) section.hidden = true;
  for (const section of guideEl.querySelectorAll('[data-pickup-guide]')) section.hidden = false;
}
if (noteHunt) {
  for (const section of guideEl.querySelectorAll('[data-pickup-guide], [data-hunt-hint]')) section.hidden = true;
  for (const section of guideEl.querySelectorAll('[data-note-guide]')) section.hidden = false;
}
let guideShown = false;
function guide(open) {
  guideEl.hidden = !open;
  if (!open) document.activeElement?.blur(); // so Enter doesn't re-press the ? button that opened it
}
function closeGuide() {
  guide(false);
  controls.startFreeLook();
}
guideEl.querySelector('.close').addEventListener('click', closeGuide);
guideBtn.addEventListener('click', () => guide(true));

const resultEl = document.getElementById('result');
function showResult(ranking) {
  const mine = ranking.find((r) => r.id === me.id);
  const text = noteHunt ? `|내 응모권 ${mine?.score ?? 0}장`
    : mine ? `${mine.rank}|보물 ${mine.score}개` : '|이번엔 보물을 못 찾았어요';
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

function restorePlayer(res) {
  pendingAction = null;
  treasures.setLayout(res.treasures ?? []);
  treasures.setFound(res.collected ?? []);
  if (!res.treasures?.length) closeQuiz();
  for (const id of res.tried ?? []) treasures.markTried(id);
  setScore(res.score);
  player.position.set(res.x, res.y ?? 0, res.z);
}

function enter(res) {
  me = { id: res.id, name: res.name };
  restorePlayer(res);
  if (!myAvatar) { myAvatar = createAvatar(variantFor(res.id)); player.add(myAvatar.root); }
  scoreEl.hidden = false;
  player.visible = true;
  joinForm.hidden = true;
  document.body.classList.remove('lobby');
  showStatus(net.socket.connected);
  net.startSending(() => ({ x: player.position.x, y: player.position.y, z: player.position.z, ry: player.rotation.y, air: !grounded }));
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
