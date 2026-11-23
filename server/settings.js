import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Admin-edited settings that outlive a restart. Today only the join address shown on the big screen.
const DIR = fileURLToPath(new URL('../data/', import.meta.url));
const FILE = DIR + 'settings.json';

// http(s) only, so the QR can't point phones at a javascript: or file: URL
export function validateJoinUrl(input) {
  const s = typeof input === 'string' ? input.trim() : '';
  if (!s) return { url: '' }; // empty = back to the default address
  if (s.length > 300) return { error: '주소가 너무 길어요' };
  let u;
  try { u = new URL(s); } catch { return { error: '주소 형식이 올바르지 않아요 (예: https://game.example.com)' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'http:// 또는 https:// 로 시작해야 해요' };
  return { url: u.href };
}

export function loadSettings() {
  try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return {}; }
}

export function saveSettings(settings) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE + '.tmp', JSON.stringify(settings, null, 2));
  renameSync(FILE + '.tmp', FILE);
}
