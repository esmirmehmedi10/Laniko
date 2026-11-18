// Background music for the About story: a slow fairytale lullaby, made live with Web Audio (no audio files).
// A music-box melody and a soft harp arpeggio float over a warm string pad, in D major (D - Bm - G - A), with a big
// dreamy reverb and a faint echo. A little harp glissando plays whenever the story moves on to the next scene.

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const BPM = 60, EIGHTH = 60 / BPM / 2;                                   // very slow: half a second per eighth note
const CHORDS = [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]];   // D, Bm, G, A
const BASS = [38, 35, 31, 33];
const ARP = [0, 1, 2, 3, 2, 1, 2, 1];                                       // harp pattern over the four chord notes
const PC = new Set([2, 4, 6, 7, 9, 11, 1]);                                 // D major
const MEL = []; for (let m = 69; m <= 90; m++) if (PC.has(m % 12)) MEL.push(m);
const PENTA = [74, 78, 81, 83, 86, 90, 93, 95];                              // glissando notes (D major pentatonic-ish, high)

function impulse(ctx, sec = 4.2, decay = 2.4) {                              // a made-up cathedral: darkening noise that fades out
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let y = 0;
    for (let i = 0; i < n; i++) { y += 0.28 * ((Math.random() * 2 - 1) - y); d[i] = y * Math.pow(1 - i / n, decay); }
  }
  return b;
}

export function buildEngine(ctx) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 24; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
  const out = ctx.createGain(); out.gain.value = 0; comp.connect(out); out.connect(ctx.destination);

  const dry = ctx.createGain(); dry.gain.value = 1; dry.connect(comp);
  const send = ctx.createGain(); send.gain.value = 1;
  const conv = ctx.createConvolver(); conv.buffer = impulse(ctx);
  const wet = ctx.createGain(); wet.gain.value = 0.7; send.connect(conv); conv.connect(wet); wet.connect(comp);
  const dl = ctx.createDelay(2); dl.delayTime.value = EIGHTH * 3;           // a faint, dotted echo
  const fb = ctx.createGain(); fb.gain.value = 0.3; const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 2400;
  const ew = ctx.createGain(); ew.gain.value = 0.22;
  send.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(ew); ew.connect(comp); ew.connect(conv);

  const padLP = ctx.createBiquadFilter(); padLP.type = "lowpass"; padLP.frequency.value = 850; padLP.Q.value = 0.4;
  const padOut = ctx.createGain(); padOut.gain.value = 0.55; padLP.connect(padOut); padOut.connect(dry); padOut.connect(send);

  const route = (node, t, pan, wetAmt) => {                                  // dry + reverb send, placed left/right
    let n = node;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
    n.connect(dry); const s = ctx.createGain(); s.gain.value = wetAmt; n.connect(s); s.connect(send);
  };
  const env = (g, t, peak, attack, decay) => {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };

  // music box: a bright, short bell with two soft overtones
  const box = (m, t, vel, pan = 0) => {
    const f = hz(m), g = ctx.createGain(); env(g, t, vel, 0.004, 2.2);
    [[1, 1, "sine"], [2.01, 0.28, "sine"], [3.97, 0.1, "sine"], [5.4, 0.04, "sine"]].forEach(([mul, a, type]) => {
      const o = ctx.createOscillator(), ga = ctx.createGain(); o.type = type; o.frequency.value = f * mul; ga.gain.value = a;
      o.connect(ga); ga.connect(g); o.start(t); o.stop(t + 2.4);
    });
    route(g, t, pan, 0.75);
  };
  // harp: a soft plucked tone, rounder than the box
  const harp = (m, t, vel, pan = 0) => {
    const g = ctx.createGain(); env(g, t, vel, 0.006, 1.6);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 1.2);
    [[1, 1, "triangle"], [2, 0.18, "sine"]].forEach(([mul, a, type]) => {
      const o = ctx.createOscillator(), ga = ctx.createGain(); o.type = type; o.frequency.value = hz(m) * mul; ga.gain.value = a;
      o.connect(ga); ga.connect(lp); o.start(t); o.stop(t + 1.9);
    });
    lp.connect(g); route(g, t, pan, 0.55);
  };
  // strings: slow swell of a chord, two slightly detuned voices per note
  const pad = (notes, bass, t, dur) => {
    [...notes.map((n) => n - 12), ...notes, bass].forEach((m, k) => {
      const g = ctx.createGain(), peak = m === bass ? 0.07 : 0.032;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 2.4); g.gain.setValueAtTime(peak, t + dur - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 2.6);
      [[-5, "sine"], [6, "triangle"]].forEach(([cents, type]) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz(m); o.detune.value = cents; o.connect(g); o.start(t); o.stop(t + dur + 2.8);
      });
      g.connect(padLP);
    });
  };

  // ---- the score, one eighth note at a time ----
  let i = 0, mi = 6, rest = 0, lastSpark = 0;
  const step = (t) => {
    const bar = Math.floor(i / 8) % 4, k = i % 8, chord = CHORDS[bar];
    if (k === 0) pad(chord, BASS[bar], t, EIGHTH * 8);
    const pool = [chord[0], chord[1], chord[2], chord[0] + 12];
    harp(pool[ARP[k]], t, k === 0 ? 0.09 : 0.045 + (k % 2) * 0.01, ((k % 4) - 1.5) * 0.18);
    if (k === 0) harp(BASS[bar] + 12, t, 0.07, -0.2);
    // melody: a gentle random walk on the D major scale; it lands on a chord note at the start of each bar and rests now and then
    if (rest > 0) rest--;
    else if (k % 2 === 0 && (k === 0 || Math.random() < 0.62)) {
      const r = Math.random(); mi += r < 0.28 ? -1 : r < 0.56 ? 1 : r < 0.7 ? -2 : r < 0.84 ? 2 : 0;
      if (mi < 1) mi = 3; if (mi > MEL.length - 2) mi = MEL.length - 4;
      if (k === 0) { const tones = MEL.map((m, x) => [m, x]).filter(([m]) => chord.some((c) => (c - m) % 12 === 0)); mi = tones.reduce((b, c) => Math.abs(c[1] - mi) < Math.abs(b[1] - mi) ? c : b)[1]; }
      box(MEL[mi], t + rnd(0, 0.012), k === 0 ? 0.2 : 0.14, 0.25 + rnd(-0.1, 0.1));
      if (Math.random() < 0.12) rest = 2;
    }
    // a faint sparkle high above, now and then
    if (t - lastSpark > 5 && Math.random() < 0.07) { lastSpark = t; box(PENTA[4 + Math.floor(rnd(0, 4))] + 12, t + 0.2, 0.05, rnd(-0.6, 0.6)); }
    i++;
  };
  const chime = (t) => { const s = PENTA.slice(0, 6 + Math.floor(rnd(0, 2))); s.forEach((m, k) => harp(m, t + k * 0.085, 0.07, -0.5 + k * 0.17)); box(s[s.length - 1] + 12, t + s.length * 0.085, 0.07, 0.3); };
  return { step, chime, out, ctx };
}

// ---- the live player ----
export function createMusic() {
  let ctx = null, eng = null, timer = 0, next = 0, on = false, lvl = 1;
  const BASE = 0.9;
  const tick = () => {
    if (!ctx || !on) return;
    while (next < ctx.currentTime + 0.7) { eng.step(next); next += EIGHTH; }
  };
  return {
    start() {
      if (on) return;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      if (!ctx) { ctx = new AC(); eng = buildEngine(ctx); }
      if (ctx.state === "suspended") ctx.resume();
      on = true; next = ctx.currentTime + 0.15;
      const g = eng.out.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(Math.max(g.value, 0.0001), ctx.currentTime); g.linearRampToValueAtTime(BASE * lvl, ctx.currentTime + 3);
      clearInterval(timer); timer = setInterval(tick, 120); tick();
    },
    stop() {
      if (!on || !ctx) return; on = false; clearInterval(timer);
      const g = eng.out.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(g.value, ctx.currentTime); g.linearRampToValueAtTime(0, ctx.currentTime + 1.4);
    },
    level(x) { lvl = x; if (on && ctx) eng.out.gain.setTargetAtTime(BASE * lvl, ctx.currentTime, 0.4); },     // quieter while the voice is reading
    chime() { if (on && ctx) eng.chime(ctx.currentTime + 0.05); },
    pause() { if (ctx && on) { clearInterval(timer); ctx.suspend(); } },
    resume() { if (ctx && on) { ctx.resume(); next = ctx.currentTime + 0.1; clearInterval(timer); timer = setInterval(tick, 120); } },
    dispose() { on = false; clearInterval(timer); if (ctx) { try { ctx.close(); } catch {} ctx = null; eng = null; } },
    get on() { return on; },
  };
}

// for testing: render some seconds offline
export function _render(oc, seconds) {
  const e = buildEngine(oc); e.out.gain.value = 0.9;
  for (let t = 0.05; t < seconds; t += EIGHTH) e.step(t);
  e.chime(seconds * 0.5);
  return oc.startRendering();
}
