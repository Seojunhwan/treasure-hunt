import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import { mmss } from './format.js';

const $ = (id) => document.getElementById(id);
const PHASE = { waiting: '입장 중 · 곧 시작해요', playing: '보물을 찾는 중', ended: '게임 종료' };
const token = new URLSearchParams(location.search).get('token');
const socket = io();

function fail(msg) {
  $('error').textContent = msg;
  $('error').hidden = false;
  $('app').hidden = true;
}

socket.on('connect', () => {
  socket.emit('admin:auth', token, (res) => {
    if (res.error) return fail(res.error + ' (서버 콘솔에 출력된 관리자 주소로 접속하세요)');
    $('error').hidden = true;
    $('app').hidden = false;
    $('url').textContent = res.joinUrl;
    $('qlink').href = '/admin/questions?token=' + encodeURIComponent(token);
    minQuestions = res.min;
    QRCode.toString(res.joinUrl, { type: 'svg', margin: 0, color: { dark: '#2b1d14', light: '#fbf3e2' } }).then((svg) => { $('qr').innerHTML = svg; }); // svg is generated locally, not user input
  });
});
socket.on('disconnect', () => { $('phase').textContent = '서버 연결이 끊겼어요. 다시 연결하는 중…'; $('phase').className = 'ribbon'; });

let lastRanking = '';
let minQuestions = 25;
// names are user input: build with textContent, never innerHTML
function el(tag, cls, text) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const row = (r) => {
  const li = el('li', '');
  li.append(el('span', 'r' + (r.rank <= 3 ? ' m' + r.rank : ''), r.rank), el('span', 'n', r.name), el('span', 's', `${r.score}개`));
  return li;
};
function renderRanking(list, ended) {
  $('rank').replaceChildren(...list.map(row));
  $('final').hidden = !ended;
  if (!ended) return;
  // podium order on screen: 2nd, 1st, 3rd
  $('podium').replaceChildren(...[list[1], list[0], list[2]].filter(Boolean).map((r) => {
    const d = el('div', 'place p' + r.rank);
    d.append(el('div', 'r m' + r.rank, r.rank), el('div', 'n', r.name), el('div', 's', `보물 ${r.score}개`));
    return d;
  }));
  $('rest').replaceChildren(...list.slice(3).map(row));
  if (!list.length) $('podium').replaceChildren(el('div', 'n', '아무도 보물을 찾지 못했어요'));
}

socket.on('world:state', (s) => {
  $('timer').textContent = mmss(s.remainingMs);
  $('phase').textContent = PHASE[s.phase];
  $('phase').className = 'ribbon ' + s.phase;
  $('sign').classList.toggle('urgent', s.phase === 'playing' && s.remainingMs <= 60_000);
  $('count').textContent = `${s.players.length}명 접속 중 · 휴대폰으로 접속하세요`;
  const short = s.questionCount < minQuestions;
  $('start').disabled = s.phase !== 'waiting' || short;
  $('qcount').textContent = short ? `문제 ${s.questionCount}개 · 최소 ${minQuestions}개가 있어야 시작할 수 있어요` : `문제 ${s.questionCount}개 · 선물 ${s.questionCount}개를 숨겨요`;
  $('qcount').classList.toggle('warn', short);
  $('left').textContent = s.treasureCount ? `남은 선물 ${s.treasureCount - s.found.length} / ${s.treasureCount}` : `선물 ${s.questionCount}개가 시작과 함께 숨겨져요`;
  $('empty').hidden = s.ranking.length > 0;
  const key = s.phase + JSON.stringify(s.ranking);
  if (key !== lastRanking) { lastRanking = key; renderRanking(s.ranking, s.phase === 'ended'); }
});

$('start').onclick = () => socket.emit('admin:start', (res) => { if (res?.error) alert(res.error); });
$('reset').onclick = $('reset2').onclick = () => {
  if (confirm('점수와 타이머를 초기화하고 모두 스폰 광장으로 돌려보낼까요?')) socket.emit('admin:reset');
};
