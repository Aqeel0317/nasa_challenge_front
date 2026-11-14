// Small sound effects made on the fly with the Web Audio API (no audio files).
// Browsers only allow sound after a click, so call unlock() from a click handler.
let ctx = null;
let master = null;
let muted = false;

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : level;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
}
let level = 0.55;
export const setMuted = (m) => { muted = m; if (master) master.gain.value = m ? 0 : level; };
// Quieter effects under a voice-over
export const setLevel = (v) => { level = v; if (master && !muted) master.gain.value = v; };

const noiseBuffer = (seconds) => {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  return b;
};

function env(node, t, attack, hold, release, peak = 1) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + attack);
  node.gain.setValueAtTime(peak, t + attack + hold);
  node.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
}

function tone(freq, start, dur, { type = "sine", peak = 0.3, attack = 0.01, glideTo } = {}) {
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  env(g, t, attack, 0, dur, peak);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
}

function noise(start, dur, { type = "bandpass", from = 400, to = 4000, q = 1, peak = 0.4, attack = 0.05 } = {}) {
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.2);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  env(g, t, attack, dur * 0.2, dur * 0.8, peak);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.2);
}

const SOUNDS = {
  whoosh: () => noise(0, 0.9, { from: 300, to: 3500, q: 0.8, peak: 0.35, attack: 0.25 }),
  chime: () => [880, 1108.7, 1318.5].forEach((f, i) => tone(f, i * 0.09, 1.2, { peak: 0.16 })),
  ping: () => tone(1567.98, 0, 0.35, { peak: 0.18 }),
  blip: () => tone(660, 0, 0.12, { type: "triangle", peak: 0.15, glideTo: 990 }),
  tick: () => tone(2200, 0, 0.04, { type: "square", peak: 0.05 }),
  pop: () => tone(420, 0, 0.14, { type: "sine", peak: 0.25, glideTo: 860 }),
  thunder: () => { noise(0, 2.6, { type: "lowpass", from: 900, to: 90, q: 0.5, peak: 0.6, attack: 0.02 }); tone(55, 0, 1.6, { peak: 0.35, glideTo: 35 }); },
  boom: () => { tone(110, 0, 1.1, { peak: 0.6, glideTo: 30, attack: 0.005 }); noise(0, 0.5, { type: "lowpass", from: 2500, to: 200, peak: 0.35, attack: 0.005 }); },
  sizzle: () => noise(0, 3.2, { type: "highpass", from: 5000, to: 7000, q: 0.7, peak: 0.08, attack: 0.6 }),
  finale: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.12, 2, { type: "triangle", peak: 0.12 })),
};

export function play(name) {
  if (!ctx || muted || !SOUNDS[name]) return;
  try { SOUNDS[name](); } catch { /* audio is a bonus; never break the page */ }
}
