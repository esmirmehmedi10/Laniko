// Background music for the About story: a very soft, slow "scent cloud". There is no melody to compete with the narrator:
// only warm sustained chords that rise and fade into one another (D, G, Bm, A), kept low in pitch and darkened, with a
// faint glassy shimmer now and then, all inside a long reverb. It is made live with Web Audio (no audio files) and is
// meant to be felt rather than heard, far behind the voice.

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const STEP = 8;                                                                // a new chord every 8 seconds, each one lasting about 16 (they overlap)
const NORM = 0.022;                                                            // overall loudness (the player scales it further)

const CHORDS = [
  [50, 57, 61, 64],   // Dmaj9 (no 3rd doubled): D3 A3 C#4 E4
  [43, 55, 59, 66],   // Gmaj7: G2 G3 B3 F#4
  [47, 54, 61, 66],   // Bm9-ish: B2 F#3 C#4 F#4
  [45, 52, 59, 64],   // Asus: A2 E3 B3 E4
];

function impulse(ctx, sec = 6, decay = 2) {                                    // a made-up hall: darkening noise that fades away slowly
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let y = 0;
    for (let i = 0; i < n; i++) { y += 0.18 * ((Math.random() * 2 - 1) - y); d[i] = y * Math.pow(1 - i / n, decay); }
  }
  return b;
}

export function buildEngine(ctx) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -30; comp.knee.value = 30; comp.ratio.value = 2; comp.attack.value = 0.05; comp.release.value = 0.6;
  const out = ctx.createGain(); out.gain.value = 0; comp.connect(out); out.connect(ctx.destination);
  const dry = ctx.createGain(); dry.gain.value = 0.7; dry.connect(comp);
  const send = ctx.createGain(); const conv = ctx.createConvolver(); conv.buffer = impulse(ctx);
  const wet = ctx.createGain(); wet.gain.value = 0.8; send.connect(conv); conv.connect(wet); wet.connect(comp);

  // everything below the voice: a gentle low-pass keeps the music out of the range where speech lives (it is mostly low "air")
  const body = ctx.createBiquadFilter(); body.type = "lowpass"; body.frequency.value = 700; body.Q.value = 0.3; body.connect(dry); body.connect(send);
  const lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); lfo.frequency.value = 0.06; lfoGain.gain.value = 160; lfo.connect(lfoGain); lfoGain.connect(body.frequency); lfo.start();   // the "breathing"

  const chord = (notes, t, dur) => {
    notes.forEach((m, k) => {
      const g = ctx.createGain(), peak = (m < 48 ? 0.5 : 0.34) / Math.sqrt(notes.length);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.38); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      [[-7, "triangle"], [0, "sine"], [7, "triangle"]].forEach(([cents, type]) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz(m); o.detune.value = cents + k;
        o.connect(g); o.start(t); o.stop(t + dur + 0.1);
      });
      g.connect(body);
    });
  };
  // a faint shimmer: a high, glassy sine that blooms and melts into the reverb
  const shimmer = (m, t, pan) => {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
    [[1, 1], [2, 0.2]].forEach(([mul, a]) => { const o = ctx.createOscillator(), ga = ctx.createGain(); o.type = "sine"; o.frequency.value = hz(m) * mul; ga.gain.value = a; o.connect(ga); ga.connect(g); o.start(t); o.stop(t + 5.2); });
    let n = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); n = p; }
    const s = ctx.createGain(); s.gain.value = 1; n.connect(s); s.connect(send);                      // wet only: it should arrive as a reflection, not as a note
  };

  let i = 0;
  const step = (t) => {
    const c = CHORDS[i % CHORDS.length];
    chord(c, t, STEP * 2);
    if (i % 2 === 0) shimmer(c[3] + 24, t + 3, -0.5); else shimmer(c[2] + 36, t + 4.5, 0.5);
    i++;
  };
  return { step, out, ctx, STEP };
}

// ---- the live player ----
export function createMusic() {
  let ctx = null, eng = null, timer = 0, next = 0, on = false, lvl = 1;
  const tick = () => {
    if (!ctx || !on) return;
    while (next < ctx.currentTime + 1) { eng.step(next); next += STEP; }
  };
  return {
    start() {
      if (on) return;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      if (!ctx) { ctx = new AC(); eng = buildEngine(ctx); }
      if (ctx.state === "suspended") ctx.resume();
      on = true; next = ctx.currentTime + 0.2;
      const g = eng.out.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(Math.max(g.value, 0.0001), ctx.currentTime); g.linearRampToValueAtTime(NORM * lvl, ctx.currentTime + 6);
      clearInterval(timer); timer = setInterval(tick, 250); tick();
    },
    stop() {
      if (!on || !ctx) return; on = false; clearInterval(timer);
      const g = eng.out.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(g.value, ctx.currentTime); g.linearRampToValueAtTime(0, ctx.currentTime + 2);
    },
    level(x) { lvl = x; if (on && ctx) eng.out.gain.setTargetAtTime(NORM * lvl, ctx.currentTime, 0.9); },     // a little lower between the narrator's sentences, slowly
    chime() {},
    pause() { if (ctx && on) { clearInterval(timer); ctx.suspend(); } },
    resume() { if (ctx && on) { ctx.resume(); next = ctx.currentTime + 0.1; clearInterval(timer); timer = setInterval(tick, 250); } },
    dispose() { on = false; clearInterval(timer); if (ctx) { try { ctx.close(); } catch {} ctx = null; eng = null; } },
    get on() { return on; },
  };
}

// for testing: render some seconds offline at the playing level
export function _render(oc, seconds, level = 1) {
  const e = buildEngine(oc); e.out.gain.value = NORM * level;
  for (let t = 0.05; t < seconds; t += STEP) e.step(t);
  return oc.startRendering();
}
