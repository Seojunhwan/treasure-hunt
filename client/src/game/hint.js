import { HINT_RANGE, PICKUP_RADIUS } from '../../../shared/constants.js';
import { audioCtx, sfxOut } from './audio.js';

// "Hot and cold" for the last minutes: beeps speed up and the screen edge glows as you
// approach the nearest unfound treasure. The glow covers phones on silent.
function beep(closeness) {
  const ctx = audioCtx();
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.frequency.value = 600 + 600 * closeness; // higher pitch when closer
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(gain).connect(sfxOut());
  osc.start(t);
  osc.stop(t + 0.1);
}

export function createHint(glowEl) {
  let nextBeep = 0, shownOpacity = -1;
  const setGlow = (o) => {
    if (Math.abs(o - shownOpacity) < 0.02) return;
    shownOpacity = o;
    glowEl.style.opacity = o.toFixed(2);
  };
  return {
    // dist: metres to the nearest unfound treasure, or null when the hint is off
    update(now, dist) {
      if (dist === null || dist > HINT_RANGE) return setGlow(0);
      const closeness = 1 - Math.max(0, dist - PICKUP_RADIUS) / (HINT_RANGE - PICKUP_RADIUS); // 0 far → 1 at pickup range
      setGlow(0.15 + 0.85 * closeness);
      if (now >= nextBeep) {
        beep(closeness);
        nextBeep = now + 1200 - 1080 * closeness; // 1.2 s far → 0.12 s close
      }
    },
  };
}
