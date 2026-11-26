// Admin page for the quiz bank. Edits stay local until "저장"; the server validates everything again.
const token = new URLSearchParams(location.search).get('token') ?? '';
const $ = (id) => document.getElementById(id);
let questions = [], min = 25, max = 60, dirty = false;

const api = (method, body) => fetch('/api/questions', {
  method, headers: { 'x-admin-token': token, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body && JSON.stringify(body),
}).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }));

function message(text, kind = '') { $('msg').textContent = text; $('msg').className = kind; }
function markDirty() { dirty = true; message('저장하지 않은 변경이 있어요'); updateCount(); }
function updateCount() {
  const n = questions.length;
  $('count').textContent = `${n}개 · 최소 ${min} · 최대 ${max}`;
  $('count').classList.toggle('warn', n < min || n > max);
}

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

function render() {
  $('list').replaceChildren(...questions.map((q, qi) => {
    const choices = el('div', { className: 'choices' }, ...q.choices.map((c, ci) => {
      const input = el('input', { type: 'text', value: c, maxLength: 60, placeholder: `보기 ${ci + 1}`, ariaLabel: `${qi + 1}번 보기 ${ci + 1}` });
      input.addEventListener('input', () => { q.choices[ci] = input.value; markDirty(); });
      const radio = el('input', { type: 'radio', name: 'answer' + qi, checked: q.answer === ci });
      radio.addEventListener('change', () => { q.answer = ci; markDirty(); render(); });
      const del = el('button', { type: 'button', className: 'x', textContent: '×', title: '보기 삭제', ariaLabel: '보기 삭제', disabled: q.choices.length <= 2 });
      del.addEventListener('click', () => { q.choices.splice(ci, 1); if (q.answer >= q.choices.length) q.answer = 0; else if (q.answer > ci) q.answer--; markDirty(); render(); });
      return el('div', { className: 'choice' + (q.answer === ci ? ' right' : '') }, el('label', {}, radio, '정답'), input, del);
    }));
    const text = el('textarea', { value: q.q, maxLength: 200, placeholder: '문제를 적어주세요', ariaLabel: `${qi + 1}번 문제` });
    text.addEventListener('input', () => { q.q = text.value; markDirty(); });
    const explain = el('input', { type: 'text', value: q.explain ?? '', maxLength: 200, placeholder: '틀렸을 때 보여줄 짧은 설명 (선택)', ariaLabel: `${qi + 1}번 설명` });
    explain.addEventListener('input', () => { q.explain = explain.value; markDirty(); });
    const addChoice = el('button', { type: 'button', className: 'soft', textContent: '+ 보기', disabled: q.choices.length >= 6 });
    addChoice.addEventListener('click', () => { q.choices.push(''); markDirty(); render(); });
    const del = el('button', { type: 'button', className: 'del', textContent: '문제 삭제' });
    del.addEventListener('click', () => { if (confirm(`${qi + 1}번 문제를 지울까요?`)) { questions.splice(qi, 1); markDirty(); render(); } });
    return el('section', { className: 'q' },
      el('div', { className: 'head' }, el('span', { className: 'num', textContent: `${qi + 1}번` }), el('span', { className: 'spacer' }), del),
      text, choices, el('div', { className: 'row' }, addChoice), el('div', { className: 'explain' }, explain));
  }));
  updateCount();
}

function add(choices) {
  questions.push({ q: '', choices, answer: 0, explain: '' });
  markDirty();
  render();
  const last = $('list').lastElementChild;
  last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  last.querySelector('textarea').focus();
}
$('add').onclick = () => add(['', '', '', '']);
$('addOx').onclick = () => add(['O', 'X']);

$('save').onclick = async () => {
  $('save').disabled = true;
  message('저장하는 중…');
  const { ok, data } = await api('PUT', { questions });
  $('save').disabled = false;
  if (!ok) return message(data.error ?? '저장하지 못했어요', 'err');
  questions = data.questions;
  dirty = false;
  render();
  message(questions.length < min ? `저장했어요. 시작하려면 ${min - questions.length}개 더 필요해요` : '저장했어요', questions.length < min ? 'err' : 'ok');
};

addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
$('back').href = '/admin?token=' + encodeURIComponent(token);

const { ok, data } = await api('GET');
if (!ok) {
  $('error').textContent = (data.error ?? '불러오지 못했어요') + ' (서버 콘솔에 나온 관리자 주소에서 들어와 주세요)';
  $('error').hidden = false;
} else {
  ({ questions, min, max } = data);
  $('app').hidden = false;
  render();
  if (data.phase === 'opening' || data.phase === 'playing') message('게임 중에는 저장할 수 없어요. 끝난 뒤나 리셋한 뒤에 저장해 주세요', 'err');
}
