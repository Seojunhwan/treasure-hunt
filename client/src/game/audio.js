// One AudioContext for everything. iOS only starts audio inside a tap, so unlockAudio()
// is called from tap handlers. Sound files are Kenney CC0 (converted to AAC for iPhone).
const NAMES = ['step0', 'step1', 'step2', 'step3', 'pickup', 'start', 'end', 'hint', 'taken', 'click'];
let ctx = null, master = null, sfxBus = null, musicBus = null;
const buffers = {};
let muted = localStorage.getItem('treasure-hunt-muted') === '1';

export const audioCtx = () => ctx;

export function unlockAudio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
    for (const n of NAMES) {
      fetch(`/sfx/${n}.m4a`).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((buf) => { buffers[n] = buf; }).catch(() => {});
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export const sfxOut = () => sfxBus;

export function play(name, { volume = 1, rate = 1 } = {}) {
  if (!ctx || ctx.state !== 'running' || !buffers[name]) return;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buffers[name];
  src.playbackRate.value = rate;
  g.gain.value = volume;
  src.connect(g).connect(sfxBus);
  src.start();
}

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  localStorage.setItem('treasure-hunt-muted', m ? '1' : '0');
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
}

// --- background: wind + a music-box "Jingle Bells" (1857, public domain), all synthesized ---
let ambientOn = false;
export function startAmbient() {
  if (!ctx || ambientOn) return;
  ambientOn = true;
  // wind: looping brown-ish noise through a slowly swept band-pass
  const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.7;
  const lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); lfo.frequency.value = 0.07; lfoGain.gain.value = 250;
  lfo.connect(lfoGain).connect(bp.frequency);
  const windGain = ctx.createGain(); windGain.gain.value = 0.18;
  noise.connect(bp).connect(windGain).connect(musicBus);
  noise.start(); lfo.start();
  // music box with a little echo for space
  const echo = ctx.createDelay(); echo.delayTime.value = 0.28;
  const fb = ctx.createGain(); fb.gain.value = 0.3;
  const box = ctx.createGain(); box.gain.value = 0.16;
  box.connect(musicBus); box.connect(echo); echo.connect(fb).connect(echo); echo.connect(musicBus);
  const N = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B4: 493.88, G4: 392 };
  const tune = 'E5 1,E5 1,E5 2,E5 1,E5 1,E5 2,E5 1,G5 1,C5 1.5,D5 .5,E5 4,F5 1,F5 1,F5 1.5,F5 .5,F5 1,E5 1,E5 1,E5 .5,E5 .5,E5 1,D5 1,D5 1,E5 1,D5 2,G5 2,'
    + 'E5 1,E5 1,E5 2,E5 1,E5 1,E5 2,E5 1,G5 1,C5 1.5,D5 .5,E5 4,F5 1,F5 1,F5 1.5,F5 .5,F5 1,E5 1,E5 1,E5 .5,E5 .5,G5 1,G5 1,F5 1,D5 1,C5 4';
  const notes = tune.split(',').map((s) => s.split(' '));
  const beat = 60 / 112;
  const note = (f, t) => {
    for (const [mul, amp] of [[1, 1], [2, 0.25], [3, 0.08]]) { // bell-ish partials
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f * mul;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2 / mul);
      o.connect(g).connect(box);
      o.start(t); o.stop(t + 1.3);
    }
  };
  const loop = (start) => {
    let t = start;
    for (const [n, b] of notes) { note(N[n], t); t += Number(b) * beat; }
    const next = t + 6; // breathe between repeats
    setTimeout(() => loop(next), (next - ctx.currentTime - 1) * 1000);
  };
  loop(ctx.currentTime + 0.5);
}
