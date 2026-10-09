/** Procedural audio: all SFX and music are synthesized with WebAudio — no asset files. */

let ctx: AudioContext | null = null;
let master: GainNode, sfxBus: GainNode, musicBus: GainNode, reverb: ConvolverNode, reverbSend: GainNode;
let musicOn = true, sfxOn = true;
let musicTimer: number | null = null;

function impulse(c: AudioContext, sec = 2.8, decay = 2.5) {
  const len = c.sampleRate * sec;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3;
  comp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.7 : 0; sfxBus.connect(comp);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.32 : 0; musicBus.connect(comp);
  reverb = ctx.createConvolver(); reverb.buffer = impulse(ctx);
  reverbSend = ctx.createGain(); reverbSend.gain.value = 0.5;
  reverbSend.connect(reverb); reverb.connect(comp);
  if (musicOn) startMusic();
}

export function setSound(on: boolean) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.7 : 0; }
export function setMusic(on: boolean) {
  musicOn = on;
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.4);
  if (on) startMusic(); else stopMusic();
}
export function suspendAudio(s: boolean) { if (!ctx) return; if (s) ctx.suspend(); else ctx.resume(); }

function env(g: GainNode, t: number, a: number, peak: number, d: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(freq: number, t: number, dur: number, o: { type?: OscillatorType; vol?: number; attack?: number; bus?: AudioNode; slide?: number; rev?: number; detune?: number } = {}) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + dur);
  if (o.detune) osc.detune.value = o.detune;
  const g = ctx.createGain();
  env(g, t, o.attack ?? 0.005, o.vol ?? 0.3, dur);
  osc.connect(g);
  g.connect(o.bus ?? sfxBus);
  if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(reverbSend); }
  osc.start(t); osc.stop(t + dur + (o.attack ?? 0.005) + 0.05);
}

function noise(t: number, dur: number, o: { vol?: number; freq?: number; q?: number; type?: BiquadFilterType; bus?: AudioNode; rev?: number; sweep?: number } = {}) {
  if (!ctx) return;
  const len = Math.ceil(ctx.sampleRate * (dur + 0.05));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = o.type ?? 'bandpass'; f.frequency.setValueAtTime(o.freq ?? 1200, t); f.Q.value = o.q ?? 1;
  if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
  const g = ctx.createGain(); env(g, t, 0.004, o.vol ?? 0.3, dur);
  src.connect(f); f.connect(g); g.connect(o.bus ?? sfxBus);
  if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(reverbSend); }
  src.start(t); src.stop(t + dur + 0.05);
}

const N = (semi: number) => 440 * Math.pow(2, (semi - 9) / 12); // semitones from C4

let lastPlay: Record<string, number> = {};
export function sfx(name: string) {
  if (!ctx || !sfxOn) return;
  const now = ctx.currentTime;
  if ((lastPlay[name] ?? 0) > now - 0.04) return;
  lastPlay[name] = now;
  const t = now + 0.01;
  switch (name) {
    case 'click':
      tone(N(19), t, 0.06, { type: 'triangle', vol: 0.18 });
      tone(N(26), t + 0.015, 0.05, { type: 'sine', vol: 0.1 });
      break;
    case 'open':
      noise(t, 0.22, { freq: 600, sweep: 2600, q: 0.8, vol: 0.12 });
      tone(N(14), t, 0.18, { type: 'triangle', vol: 0.12, rev: 0.3 });
      break;
    case 'close':
      noise(t, 0.16, { freq: 2200, sweep: 500, q: 0.8, vol: 0.08 });
      break;
    case 'collect':
      [0, 4, 7, 12].forEach((s, i) => tone(N(24 + s), t + i * 0.045, 0.22, { type: 'triangle', vol: 0.14, rev: 0.3 }));
      noise(t, 0.12, { freq: 6000, q: 2, vol: 0.06 });
      break;
    case 'coins':
      for (let i = 0; i < 6; i++) tone(N(31 + (i % 3) * 3), t + i * 0.035, 0.12, { type: 'square', vol: 0.04 });
      break;
    case 'build':
      for (let i = 0; i < 3; i++) { noise(t + i * 0.12, 0.08, { freq: 900, q: 3, vol: 0.25 }); tone(N(7), t + i * 0.12, 0.08, { type: 'square', vol: 0.06 }); }
      break;
    case 'complete':
      [0, 4, 7, 12, 16].forEach((s, i) => tone(N(12 + s), t + i * 0.08, 0.5, { type: 'triangle', vol: 0.16, rev: 0.6 }));
      tone(N(0), t, 0.9, { type: 'sine', vol: 0.15, rev: 0.4 });
      break;
    case 'error':
      tone(N(-5), t, 0.16, { type: 'square', vol: 0.06 });
      tone(N(-8), t + 0.09, 0.2, { type: 'square', vol: 0.06 });
      break;
    case 'summon':
      for (let i = 0; i < 14; i++) tone(N(12 + i * 2), t + i * 0.05, 0.3, { type: 'sine', vol: 0.06, rev: 0.8 });
      noise(t, 1.0, { freq: 400, sweep: 8000, q: 1.2, vol: 0.12, rev: 0.6 });
      break;
    case 'legendary':
      [0, 7, 12, 16, 19, 24].forEach((s, i) => tone(N(7 + s), t + i * 0.06, 1.6, { type: 'sawtooth', vol: 0.045, attack: 0.03, rev: 0.9 }));
      [0, 12, 19].forEach((s) => tone(N(-5 + s), t, 2, { type: 'triangle', vol: 0.12, rev: 0.6 }));
      break;
    case 'battle':
      for (let i = 0; i < 5; i++) {
        noise(t + i * 0.14 + Math.random() * 0.05, 0.12, { freq: 2500 + Math.random() * 2000, q: 6, vol: 0.18 });
        noise(t + i * 0.14, 0.2, { freq: 150, type: 'lowpass', vol: 0.25 });
      }
      break;
    case 'victory':
      [[0, 0.0], [4, 0.15], [7, 0.3], [12, 0.45]].forEach(([s, d]) => tone(N(12 + s), t + d, 0.6, { type: 'sawtooth', vol: 0.06, attack: 0.02, rev: 0.6 }));
      [0, 4, 7, 12].forEach((s) => tone(N(12 + s), t + 0.65, 1.4, { type: 'triangle', vol: 0.1, rev: 0.8 }));
      break;
    case 'defeat':
      [7, 3, 0, -5].forEach((s, i) => tone(N(s), t + i * 0.22, 0.6, { type: 'triangle', vol: 0.12, rev: 0.6 }));
      break;
    case 'horn':
      tone(N(-5), t, 0.9, { type: 'sawtooth', vol: 0.07, attack: 0.08, rev: 0.7 });
      tone(N(2), t + 0.25, 0.9, { type: 'sawtooth', vol: 0.06, attack: 0.08, rev: 0.7 });
      break;
    case 'alarm':
      for (let i = 0; i < 3; i++) tone(N(-2), t + i * 0.45, 0.35, { type: 'sawtooth', vol: 0.08, attack: 0.05, rev: 0.5, slide: 0.8 });
      break;
    case 'levelup':
      [0, 4, 7, 11, 14].forEach((s, i) => tone(N(19 + s), t + i * 0.06, 0.4, { type: 'sine', vol: 0.12, rev: 0.7 }));
      break;
    case 'page':
      noise(t, 0.09, { freq: 3500, q: 0.6, vol: 0.06 });
      break;
  }
}

// ———————————————————————————————————————— generative music
const PROG = [
  [2, 5, 9, 14],   // Dm
  [-2, 2, 5, 10],  // Bb
  [5, 9, 12, 17],  // F
  [0, 4, 7, 12],   // C
  [2, 5, 9, 14],   // Dm
  [-5, -1, 2, 7],  // G (dorian lift)
  [-2, 2, 5, 10],  // Bb
  [-3, 1, 4, 9],   // A (dominant)
];
const SCALE = [2, 4, 5, 7, 9, 10, 12, 14, 16, 17, 19, 21];
let bar = 0;

function startMusic() {
  if (!ctx || musicTimer != null) return;
  bar = 0;
  const step = () => {
    if (!ctx) return;
    playBar(ctx.currentTime + 0.1);
    bar++;
  };
  step();
  musicTimer = window.setInterval(step, 4800);
}
function stopMusic() { if (musicTimer != null) { clearInterval(musicTimer); musicTimer = null; } }

function playBar(t: number) {
  if (!ctx) return;
  const chord = PROG[bar % PROG.length];
  const len = 4.8;
  // pad
  for (const s of chord) {
    for (const det of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = N(s - 12);
      osc.detune.value = det;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.022, t + 1.4);
      g.gain.linearRampToValueAtTime(0.018, t + len - 0.6);
      g.gain.linearRampToValueAtTime(0.0001, t + len + 0.6);
      osc.connect(f); f.connect(g); g.connect(musicBus);
      const sr = ctx.createGain(); sr.gain.value = 0.6; g.connect(sr); sr.connect(reverbSend);
      osc.start(t); osc.stop(t + len + 0.8);
    }
  }
  // bass
  tone(N(chord[0] - 24), t, len * 0.9, { type: 'triangle', vol: 0.11, attack: 0.3, bus: musicBus });
  // harp arpeggio
  const pattern = bar % 2 ? [0, 2, 1, 3, 2, 1, 3, 2] : [0, 1, 2, 3, 2, 3, 1, 2];
  pattern.forEach((pi, i) => {
    if (Math.random() < 0.15) return;
    const s = chord[pi] + (i >= 4 ? 12 : 0);
    tone(N(s), t + i * 0.6, 1.4, { type: 'triangle', vol: 0.055, bus: musicBus, rev: 0.7 });
  });
  // melody fragments every other bar
  if (bar % 2 === 1 || Math.random() < 0.3) {
    let idx = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < 4; i++) {
      idx = Math.max(0, Math.min(SCALE.length - 1, idx + Math.floor(Math.random() * 3) - 1));
      tone(N(SCALE[idx] + 12), t + 0.6 + i * 1.0 + Math.random() * 0.1, 1.2, { type: 'sine', vol: 0.045, attack: 0.08, bus: musicBus, rev: 0.9 });
    }
  }
  // soft drum
  if (bar % 4 === 0) {
    noise(t, 0.6, { freq: 90, type: 'lowpass', vol: 0.12, bus: musicBus, rev: 0.4 });
    noise(t + 2.4, 0.5, { freq: 90, type: 'lowpass', vol: 0.08, bus: musicBus, rev: 0.4 });
  }
}
