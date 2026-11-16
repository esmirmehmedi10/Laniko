// Optional sound and haptics for the product film: the cap coming off the bottle and the atomiser spraying.
// Everything is synthesised with Web Audio (no audio files). Off until the visitor turns it on; the choice is remembered.
//
// Cap: a friction-fit cap does three things - it grips and creaks as it is drawn off the neck (a short, swelling
// "shhk"), it lets go with a hollow pop (the cap's cavity and the glass neck ring for a few tens of milliseconds)
// and it gives a small knock when it is clear. Spray: a pump click, then a turbulent rush of air (broadband
// noise, bright, with fast random flutter and a low body of air) that lasts as long as the visitor keeps scrolling
// through the spray, and a soft click of the pump springing back.
const KEY = "laniko-sound";
let ctx = null, master = null, room = null, enabled = false, lastBuzz = 0;
let noiseBuf = null, flutterBuf = null;
let air = null;                         // the always-running spray chain {gain, bright, body, flutter}
let spraying = false, sprayStart = 0, sprayTimer = 0;

try { enabled = localStorage.getItem(KEY) === "1"; } catch { /* private mode */ }

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

function makeBuffers(c) {
  const sr = c.sampleRate;
  // pink-ish noise (Paul Kellet filter): less harsh than white, closer to real air and plastic noise
  noiseBuf = c.createBuffer(1, sr * 3, sr);
  const d = noiseBuf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    // half white, half pink: keeps the top end that makes a spray sound like a spray
    d[i] = (0.5 * (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.22 + 0.5 * w) * 0.9; b6 = w * 0.115926;
  }
  // slow random wobble (about 30 Hz) that makes the airflow flutter instead of hiss evenly
  flutterBuf = c.createBuffer(1, sr * 2, sr);
  const f = flutterBuf.getChannelData(0);
  let y = 0, peak = 0.0001;
  for (let i = 0; i < f.length; i++) { y += (Math.random() * 2 - 1 - y) * 0.006; f[i] = y; peak = Math.max(peak, Math.abs(y)); }
  for (let i = 0; i < f.length; i++) f[i] /= peak;
}

function makeRoom(c) {                     // a tiny, dry room so the sounds do not float in a void
  const len = Math.floor(c.sampleRate * 0.28), ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 120 ? i / 120 : 1);
  }
  const conv = c.createConvolver(); conv.buffer = ir;
  return conv;
}

function loopSource(c, buf, offset) {
  const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, offset); return s;
}

// builds the whole graph on any (real or offline) context
function build(c) {
  makeBuffers(c);
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.002; comp.release.value = 0.12;
  const m = c.createGain(); m.gain.value = 0.9; m.connect(comp); comp.connect(c.destination);
  const r = makeRoom(c), wet = c.createGain(); wet.gain.value = 0.16; r.connect(wet); wet.connect(m);
  const bus = c.createGain(); bus.connect(m); bus.connect(r);
  master = bus; room = r;

  // --- the atomiser: bright rush + low body of air, both fluttering, behind one gain
  const gain = c.createGain(); gain.gain.value = 0;
  const flutter = c.createGain(); flutter.gain.value = 0.75;           // base level of the flutter stage
  const lfo = loopSource(c, flutterBuf, 0), lfoDepth = c.createGain(); lfoDepth.gain.value = 0.28;
  lfo.connect(lfoDepth); lfoDepth.connect(flutter.gain);
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1700; hp.Q.value = 0.6;
  const bright = c.createBiquadFilter(); bright.type = "peaking"; bright.frequency.value = 5600; bright.gain.value = 7; bright.Q.value = 0.8;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 12000;
  const src = loopSource(c, noiseBuf, 0);
  src.connect(hp); hp.connect(bright); bright.connect(lp); lp.connect(flutter);
  const bodyBp = c.createBiquadFilter(); bodyBp.type = "bandpass"; bodyBp.frequency.value = 850; bodyBp.Q.value = 0.55;
  const bodyG = c.createGain(); bodyG.gain.value = 0.4;
  const src2 = loopSource(c, noiseBuf, 1.3);
  src2.connect(bodyBp); bodyBp.connect(bodyG); bodyG.connect(flutter);
  flutter.connect(gain); gain.connect(bus);
  air = { gain, bright, body: bodyG };
  return c;
}

function ensure() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = build(new AC());
  return true;
}

export const isEnabled = () => enabled;
export function setEnabled(on) {
  enabled = !!on;
  try { localStorage.setItem(KEY, enabled ? "1" : "0"); } catch { /* ignore */ }
  if (enabled) { if (ensure()) knock(ctx, master, ctx.currentTime, 0.45, 0.9); buzz(14); }
  return enabled;
}
function buzz(ms) { try { if (enabled && navigator.vibrate) navigator.vibrate(ms); } catch { /* not supported */ } }

// ---------- building blocks (take a context so they can also be rendered offline) ----------
function noiseHit(c, dest, t, { dur, type = "bandpass", freq, Q = 1, vol = 0.2, attack = 0.002, curve = 1, offset }) {
  const s = c.createBufferSource(); s.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur * curve);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, offset == null ? rnd(0, 2) : offset, attack + dur * curve + 0.02);
}
function ring(c, dest, t, freq, vol, decay, drop = 1) {      // a damped resonance: the ring of plastic, glass or a cavity
  const o = c.createOscillator(), g = c.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(freq, t); if (drop !== 1) o.frequency.exponentialRampToValueAtTime(freq * drop, t + decay);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.0015); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + decay + 0.02);
}
function knock(c, dest, t, vol = 1, pitch = 1) {              // a small hard "tok": a click with a short body
  noiseHit(c, dest, t, { dur: 0.012, freq: 3200 * pitch, Q: 1.4, vol: 0.32 * vol });
  ring(c, dest, t, 780 * pitch, 0.2 * vol, 0.05, 0.8);
  ring(c, dest, t, 2350 * pitch, 0.07 * vol, 0.03);
}

// the cap: grip and creak, a hollow pop, a small knock when it is clear
function playCap(c, dest, t) {
  // 1. creak/friction while the cap is drawn off the neck: filtered noise that swells in uneven little steps
  const dur = 0.13, s = c.createBufferSource(); s.buffer = noiseBuf;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 3.2;
  bp.frequency.setValueAtTime(1500, t); bp.frequency.exponentialRampToValueAtTime(2700, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 1; i <= 8; i++) g.gain.linearRampToValueAtTime(0.02 + (i / 8) * 0.13 * rnd(0.6, 1.2), t + (dur * i) / 8);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.006);
  s.connect(bp); bp.connect(g); g.connect(dest); s.start(t, rnd(0, 2), dur + 0.05);
  // 2. the release: air rushes into the cap and its cavity rings (a hollow "pop"), plus the glass neck's thump
  const p = t + dur;
  noiseHit(c, dest, p, { dur: 0.02, freq: 1900, Q: 0.9, vol: 0.35, attack: 0.001 });
  ring(c, dest, p, 1020, 0.30, 0.085, 0.86);      // cavity resonance, sagging a little as the air escapes
  ring(c, dest, p, 1930, 0.13, 0.05);              // the plastic/metal skin
  ring(c, dest, p, 3150, 0.05, 0.03);
  ring(c, dest, p, 235, 0.26, 0.07, 0.7);          // thump of the neck letting go
  // 3. a small knock as the cap comes clear of the bottle
  knock(c, dest, p + 0.1, 0.5, 1.12);
}

// pump click when the atomiser is pressed, and the softer one when it springs back
function pumpClick(c, dest, t, vol) {
  noiseHit(c, dest, t, { dur: 0.008, freq: 4200, Q: 1.6, vol: 0.3 * vol, attack: 0.0008 });
  ring(c, dest, t, 1150, 0.16 * vol, 0.028, 0.75);
  ring(c, dest, t + 0.006, 320, 0.12 * vol, 0.03);
}

// ---------- public ----------
export function cap() {
  if (!enabled) return;
  buzz([10, 30, 16]);
  if (!ensure()) return;
  playCap(ctx, master, ctx.currentTime + 0.02);
}

// called all the time while the visitor scrolls through the spray: amount 0..1, power ~0.7..1.8
export function spray(amount, power) {
  if (!enabled || !ensure()) return;
  const t = ctx.currentTime, pw = clamp(power, 0.6, 1.8);
  const level = clamp(0.16 + amount * 1.3 * Math.min(pw, 1.6) * 0.5, 0.16, 0.5);
  const g = air.gain.gain;
  g.cancelScheduledValues(t);
  if (!spraying) {                                                    // the press: click, then a fast rush of air
    spraying = true; sprayStart = performance.now();
    pumpClick(ctx, master, t, 1);
    g.setValueAtTime(Math.max(g.value, 0.0001), t);
    g.linearRampToValueAtTime(level * 1.25, t + 0.018);              // the first burst is a little stronger
    g.setTargetAtTime(level, t + 0.05, 0.05);
  } else {
    g.setValueAtTime(Math.max(g.value, 0.0001), t);
    g.setTargetAtTime(level, t, 0.025);
  }
  // stronger scrolling = harder pump = brighter, thinner rush
  air.bright.frequency.setTargetAtTime(5000 + pw * 900, t, 0.05);
  air.body.gain.setTargetAtTime(0.5 - Math.min(pw, 1.6) * 0.15, t, 0.05);
  clearTimeout(sprayTimer);
  sprayTimer = setTimeout(endSpray, 130);
  const now = performance.now();
  if (now - lastBuzz > 70) { lastBuzz = now; buzz(Math.round(clamp(8 + amount * 300, 8, 34))); }
}
function endSpray() {
  if (!ctx || !spraying) return;
  const t = ctx.currentTime, longSpray = performance.now() - sprayStart > 220;
  const g = air.gain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(g.value, 0.0001), t);
  g.setTargetAtTime(0, t, 0.045);                                     // the rush dies away quickly, with a last bit of air
  if (longSpray) pumpClick(ctx, master, t + 0.07, 0.5);              // the pump springing back
  spraying = false;
}

// for testing: render the sounds on an OfflineAudioContext
export function _render(oc, what) {
  build(oc);
  if (what === "cap") playCap(oc, master, 0.05);
  else {
    pumpClick(oc, master, 0.05, 1);
    const g = air.gain.gain; g.setValueAtTime(0.0001, 0.05); g.linearRampToValueAtTime(0.28 * 1.25, 0.068); g.setTargetAtTime(0.22, 0.1, 0.05);
    g.setTargetAtTime(0, 0.62, 0.045); pumpClick(oc, master, 0.69, 0.5);
  }
}
