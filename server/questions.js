import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TREASURE_SPOTS } from '../shared/map.js';

const DIR = fileURLToPath(new URL('../data/', import.meta.url));
const FILE = DIR + 'questions.json';
const SAMPLE = DIR + 'questions.sample.json';
export const MAX_QUESTIONS = TREASURE_SPOTS.length; // one hiding spot per question

const str = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

// Admin input crosses a trust boundary: check everything, return { list } or { error }.
export function validateQuestions(input) {
  if (!Array.isArray(input)) return { error: '문제 목록 형식이 올바르지 않아요' };
  if (input.length > MAX_QUESTIONS) return { error: `문제는 최대 ${MAX_QUESTIONS}개까지 넣을 수 있어요 (숨길 자리 수)` };
  const list = [];
  for (const [i, raw] of input.entries()) {
    const n = i + 1;
    const q = str(raw?.q);
    if (q.length < 1 || q.length > 200) return { error: `${n}번: 문제는 1~200자로 적어주세요` };
    if (!Array.isArray(raw.choices) || raw.choices.length < 2 || raw.choices.length > 6) return { error: `${n}번: 보기는 2~6개여야 해요` };
    const choices = raw.choices.map((c) => str(c));
    if (choices.some((c) => c.length < 1 || c.length > 60)) return { error: `${n}번: 보기는 각각 1~60자로 적어주세요` };
    if (new Set(choices).size !== choices.length) return { error: `${n}번: 같은 보기가 두 번 있어요` };
    if (!Number.isInteger(raw.answer) || raw.answer < 0 || raw.answer >= choices.length) return { error: `${n}번: 정답을 골라주세요` };
    const explain = str(raw.explain ?? '');
    if (explain.length > 200) return { error: `${n}번: 설명은 200자 이내로 적어주세요` };
    const id = typeof raw.id === 'string' && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : randomUUID().slice(0, 8);
    list.push({ id, q, choices, answer: raw.answer, explain });
  }
  if (new Set(list.map((x) => x.id)).size !== list.length) return { error: '문제 id가 겹쳐요' };
  return { list };
}

export function loadQuestions() {
  const path = existsSync(FILE) ? FILE : SAMPLE;
  const res = validateQuestions(JSON.parse(readFileSync(path, 'utf8')));
  if (res.error) throw new Error(`${path}: ${res.error}`);
  if (path === SAMPLE) saveQuestions(res.list);
  return res.list;
}

// write-then-rename so a crash mid-save never leaves a half-written file
export function saveQuestions(list) {
  writeFileSync(FILE + '.tmp', JSON.stringify(list, null, 2) + '\n');
  renameSync(FILE + '.tmp', FILE);
}
