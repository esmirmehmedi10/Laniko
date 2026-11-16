// Optional sound and haptics for the product film: a soft click when the cap comes off and a fine hiss while it sprays.
// Everything is synthesised (no audio files). Off until the visitor turns it on; the choice is remembered.
const KEY = "laniko-sound";
let ctx = null, master = null, noiseSrc = null, hissGain = null, enabled = false, lastBuzz = 0;

try { enabled = localStorage.getItem(KEY) === "1"; } catch { /* private mode */ }

function ensure() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  // a looping buffer of white noise, always running; the gain in front of it makes the hiss
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseSrc = ctx.createBufferSource(); noiseSrc.buffer = buf; noiseSrc.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 3200;
  const bp = ctx.createBiquadFilter(); bp.type = "peaking"; bp.frequency.value = 6500; bp.gain.value = 5; bp.Q.value = 0.7;
  hissGain = ctx.createGain(); hissGain.gain.value = 0;
  noiseSrc.connect(hp); hp.connect(bp); bp.connect(hissGain); hissGain.connect(master);
  noiseSrc.start();
  return true;
}

export const isEnabled = () => enabled;
export function setEnabled(on) {
  enabled = !!on;
  try { localStorage.setItem(KEY, enabled ? "1" : "0"); } catch { /* ignore */ }
  if (enabled) { if (ensure()) tick(0.5); buzz(14); }
  return enabled;
}

function tick(vol = 1) {                    // a small, dry click
  if (!enabled || !ensure()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "triangle"; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(380, t + 0.07);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.1);
}

function buzz(ms) { try { if (enabled && navigator.vibrate) navigator.vibrate(ms); } catch { /* not supported */ } }

// the cap comes off: a click and a short, airy "pop"
export function cap() {
  if (!enabled) return;
  buzz([10, 30, 16]);
  if (!ensure()) return;
  tick(1);
  const t = ctx.currentTime + 0.05;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(190, t + 0.12);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.18);
}

// the spray: every bit of scrolling through the spray adds a puff of hiss (amount 0..1, power ~0.7..1.8)
export function spray(amount, power) {
  if (!enabled || !ensure()) return;
  const t = ctx.currentTime, level = Math.min(0.42, 0.08 + amount * 1.6 * Math.min(power, 1.6) * 0.5);
  const p = hissGain.gain;
  p.cancelScheduledValues(t);
  p.setValueAtTime(Math.max(p.value, 0.0001), t);
  p.linearRampToValueAtTime(level, t + 0.02);
  p.setTargetAtTime(0, t + 0.07, 0.07);
  const now = performance.now();
  if (now - lastBuzz > 70) { lastBuzz = now; buzz(Math.round(Math.min(34, 8 + amount * 300))); }
}
