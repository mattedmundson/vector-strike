// All sound is synthesised with WebAudio — no sample files needed.
let ctx = null, master = null, noiseBuf = null;

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function env(g, t, a, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
}

function tone(type, f0, f1, dur, vol) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  env(g, t, 0.005, vol, dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, vol, cutoff0, cutoff1) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff0, t);
  f.frequency.exponentialRampToValueAtTime(cutoff1, t + dur);
  const g = ctx.createGain();
  env(g, t, 0.01, vol, dur);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + dur + 0.05);
}

export const sfx = {
  laser: () => { tone('square', 1800, 180, 0.13, 0.07); tone('sawtooth', 900, 120, 0.1, 0.04); },
  boom: () => noise(0.5, 0.5, 2400, 80),
  bigBoom: () => { noise(2.2, 0.9, 3000, 40); tone('sine', 90, 25, 1.8, 0.5); },
  hit: () => { noise(0.35, 0.7, 5000, 300); tone('sawtooth', 160, 40, 0.4, 0.25); },
  fireball: () => tone('triangle', 300, 600, 0.15, 0.05),
  blip: () => tone('square', 880, 880, 0.08, 0.05),
  alarm: () => { tone('square', 660, 660, 0.12, 0.05); setTimeout(() => tone('square', 440, 440, 0.12, 0.05), 140); },
  bonus: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone('square', f, f, 0.14, 0.06), i * 110)),
};
