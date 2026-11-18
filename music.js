// Background music for the About story: "a quiet room of scent". A slow, soft waltz for felt piano in D major, with a
// warm string haze underneath and a few celesta sparkles, drowned in a long reverb. It is composed here (a fixed
// eight-bar theme that repeats, the second time with a lower harmony), and played live with Web Audio: no audio files.
// It is meant to sit far behind the narrator's voice.

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const BPM = 54, BEAT = 60 / BPM;                                              // slow 3/4
const NORM = 0.2;                                                              // overall loudness of the engine (the player scales it further)

// bar by bar: low bass note, and the chord played on beats 2 and 3 (the classic waltz "oom-pah-pah")
const BARS = [
  { bass: 43, chord: [59, 62, 66] },   // Gmaj7
  { bass: 38, chord: [54, 57, 61] },   // Dmaj7
  { bass: 43, chord: [59, 62, 66] },   // Gmaj7
  { bass: 38, chord: [54, 57, 61] },   // Dmaj7
  { bass: 47, chord: [62, 66, 69] },   // Bm7
  { bass: 40, chord: [55, 59, 62] },   // Em7
  { bass: 45, chord: [61, 64, 69] },   // A
  { bass: 38, chord: [54, 57, 61] },   // Dmaj7
];
// the theme: [beat, note, length in beats]; 24 beats = 8 bars
const THEME = [
  [0, 78, 2], [2, 76, 1], [3, 74, 2], [5, 73, 1], [6, 71, 2], [8, 74, 1], [9, 73, 3],
  [12, 74, 2], [14, 78, 1], [15, 76, 2], [17, 74, 1], [18, 73, 1], [19, 76, 1], [20, 81, 1], [21, 78, 3],
];

function impulse(ctx, sec = 5, decay = 2.2) {                                  // a made-up hall: darkening noise that fades away
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let y = 0;
    for (let i = 0; i < n; i++) { y += 0.22 * ((Math.random() * 2 - 1) - y); d[i] = y * Math.pow(1 - i / n, decay); }
  }
  return b;
}

export function buildEngine(ctx) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -26; comp.knee.value = 30; comp.ratio.value = 2.5; comp.attack.value = 0.03; comp.release.value = 0.5;
  const out = ctx.createGain(); out.gain.value = 0; comp.connect(out); out.connect(ctx.destination);
  const dry = ctx.createGain(); dry.gain.value = 1; dry.connect(comp);
  const send = ctx.createGain(); const conv = ctx.createConvolver(); conv.buffer = impulse(ctx);
  const wet = ctx.createGain(); wet.gain.value = 0.62; send.connect(conv); conv.connect(wet); wet.connect(comp);

  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const route = (node, pan, wetAmt) => {
    let n = node;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
    n.connect(dry); const s = ctx.createGain(); s.gain.value = wetAmt; n.connect(s); s.connect(send);
  };

  // felt piano: a few slightly stretched harmonics that die away slowly, a soft hammer thump, and a low-pass that closes as the note fades
  const piano = (m, t, vel, pan = 0) => {
    const f = hz(m), dur = Math.max(2.4, Math.min(6, 6.4 - (m - 36) * 0.06));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(vel * 0.3, t + 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.3;
    lp.frequency.setValueAtTime(Math.min(4200, f * 6), t); lp.frequency.exponentialRampToValueAtTime(Math.max(500, f * 2), t + 1.6);
    [1, 0.5, 0.26, 0.13, 0.07, 0.035].forEach((a, h) => {
      const o = ctx.createOscillator(), ga = ctx.createGain(), k = h + 1;
      o.type = "sine"; o.frequency.value = f * k * (1 + 0.0003 * k * k); ga.gain.value = a; o.connect(ga); ga.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    });
    const hs = ctx.createBufferSource(), hf = ctx.createBiquadFilter(), hg = ctx.createGain();       // the felt hammer
    hs.buffer = noise; hf.type = "lowpass"; hf.frequency.value = Math.min(2200, f * 3); hg.gain.setValueAtTime(vel * 0.35, t); hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    hs.connect(hf); hf.connect(hg); hg.connect(g); hs.start(t);
    lp.connect(g); route(g, pan, 0.5 + (m > 70 ? 0.15 : 0));
  };
  // celesta: a small, glassy bell
  const celesta = (m, t, vel, pan = 0) => {
    const f = hz(m), g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    [[1, 1], [2.0, 0.25], [4.1, 0.08]].forEach(([mul, a]) => { const o = ctx.createOscillator(), ga = ctx.createGain(); o.type = "sine"; o.frequency.value = f * mul; ga.gain.value = a; o.connect(ga); ga.connect(g); o.start(t); o.stop(t + 2.6); });
    route(g, pan, 0.8);
  };
  // strings: a slow swell of the chord's low notes, hardly there
  const haze = (notes, t, dur) => {
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 0.3;
    const g = ctx.createGain(), peak = 0.03;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.5);
    notes.forEach((m) => [[-5, "triangle"], [5, "sine"]].forEach(([c, type]) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz(m); o.detune.value = c; o.connect(lp); o.start(t); o.stop(t + dur + 1.6); }));
    lp.connect(g); route(g, 0, 0.7);
  };

  // ---- the score, one beat at a time ----
  let beat = 0;
  const step = (t) => {
    const cycle = Math.floor(beat / 24), at = beat % 24, bar = Math.floor(at / 3), k = at % 3, B = BARS[bar];
    if (k === 0) { piano(B.bass, t, 0.34, -0.15); if (bar % 2 === 0) haze([B.bass + 12, B.bass + 19, B.chord[0]], t, BEAT * 6); }
    else B.chord.forEach((m, j) => piano(m, t + j * 0.018 + Math.random() * 0.01, 0.12 - j * 0.012, -0.1 + j * 0.1));           // soft chord, notes rolled a hair apart
    THEME.forEach(([b, m, len]) => {
      if (b !== at) return;
      piano(m, t + Math.random() * 0.012, 0.3, 0.2);
      if (cycle % 2 === 1) piano(m - 9, t + 0.02, 0.1, -0.25);                                                                  // second time round: a lower harmony underneath
    });
    if (at === 9 || at === 21) [0, 1, 2, 3].forEach((j) => celesta(B.chord[j % 3] + 24 + (j > 2 ? 12 : 0), t + 0.4 + j * 0.28, 0.05 - j * 0.006, -0.4 + j * 0.25));   // a few sparkles at the end of each half
    beat++;
  };
  const chime = (t) => { [86, 90, 93].forEach((m, k) => celesta(m, t + k * 0.16, 0.04 - k * 0.008, -0.3 + k * 0.3)); };
  return { step, chime, out, ctx };
}

// ---- the live player ----
export function createMusic() {
  let ctx = null, eng = null, timer = 0, next = 0, on = false, lvl = 1;
  const BASE = 0.55 * NORM;
  const tick = () => {
    if (!ctx || !on) return;
    while (next < ctx.currentTime + 0.8) { eng.step(next); next += BEAT; }
  };
  return {
    start() {
      if (on) return;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      if (!ctx) { ctx = new AC(); eng = buildEngine(ctx); }
      if (ctx.state === "suspended") ctx.resume();
      on = true; next = ctx.currentTime + 0.2;
      const g = eng.out.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(Math.max(g.value, 0.0001), ctx.currentTime); g.linearRampToValueAtTime(BASE * lvl, ctx.currentTime + 4);
      clearInterval(timer); timer = setInterval(tick, 150); tick();
    },
    stop() {
      if (!on || !ctx) return; on = false; clearInterval(timer);
      const g = eng.out.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(g.value, ctx.currentTime); g.linearRampToValueAtTime(0, ctx.currentTime + 1.6);
    },
    level(x) { lvl = x; if (on && ctx) eng.out.gain.setTargetAtTime(BASE * lvl, ctx.currentTime, 0.4); },
    chime() { if (on && ctx) eng.chime(ctx.currentTime + 0.05); },
    pause() { if (ctx && on) { clearInterval(timer); ctx.suspend(); } },
    resume() { if (ctx && on) { ctx.resume(); next = ctx.currentTime + 0.1; clearInterval(timer); timer = setInterval(tick, 150); } },
    dispose() { on = false; clearInterval(timer); if (ctx) { try { ctx.close(); } catch {} ctx = null; eng = null; } },
    get on() { return on; },
  };
}

// for testing: render some seconds offline at the playing level
export function _render(oc, seconds, level = 1) {
  const e = buildEngine(oc); e.out.gain.value = 0.55 * NORM * level;
  for (let t = 0.05; t < seconds; t += BEAT) e.step(t);
  e.chime(seconds * 0.5);
  return oc.startRendering();
}
