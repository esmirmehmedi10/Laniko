// Background music for the About story: a very soft, slow "scent cloud". There is no melody to compete with the narrator:
// only warm sustained chords that rise and fade into one another (D, G, Bm, A), kept low in pitch and darkened, with a
// faint glassy shimmer now and then, all inside a long reverb. It is made live with Web Audio (no audio files) and is
// meant to be felt rather than heard, far behind the voice.

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const STEP = 8;                                                                // the default pace: a new chord every 8 seconds, each one lasting about 16 (they overlap)
const NORM = 0.022;                                                            // overall loudness (the player scales it further)

// One quiet colour for the About story and one for each perfume's chapter: the chords, how dark the sound is (cut-off in Hz),
// how slowly it moves (step in seconds) and how much glassy shimmer floats on top. "air" is a faint bed of breath-like noise, used by the atmosphere mode.
const ABOUT = {
  chords: [
    [50, 57, 61, 64],   // Dmaj9 (no 3rd doubled): D3 A3 C#4 E4
    [43, 55, 59, 66],   // Gmaj7: G2 G3 B3 F#4
    [47, 54, 61, 66],   // Bm9-ish: B2 F#3 C#4 F#4
    [45, 52, 59, 64],   // Asus: A2 E3 B3 E4
  ],
  cut: 700, step: 8, shimmer: 1,
};
export const PRESETS = {
  about: ABOUT,
  "blanc-royal": ABOUT,                                                     // warm and luminous: the house sound
  "reve-paradoxe": { chords: [[43, 55, 62, 66], [48, 55, 64, 67], [45, 57, 62, 69], [50, 57, 64, 66]], cut: 1000, step: 7, shimmer: 1.5 },   // Lydian: bright, curious, a little unresolved
  "noir-prestige": { chords: [[38, 45, 53, 60], [34, 46, 53, 62], [36, 43, 51, 58], [38, 45, 52, 57]], cut: 460, step: 10, shimmer: .5 },       // low D minor: slow, deep, candle-lit
  "rouge-absolu": { chords: [[41, 53, 60, 64], [45, 52, 60, 67], [38, 50, 57, 65], [43, 55, 59, 64]], cut: 820, step: 8, shimmer: .8 },        // F, Am, Dm, G: warm and a little aching
  "bleu-eternel": { chords: [[48, 55, 59, 64], [52, 59, 66, 71], [45, 52, 60, 67], [43, 50, 59, 66]], cut: 1100, step: 9, shimmer: 1.6 },      // open and airy, like a deep blue hour
};

function impulse(ctx, sec = 6, decay = 2) {                                    // a made-up hall: darkening noise that fades away slowly
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let y = 0;
    for (let i = 0; i < n; i++) { y += 0.18 * ((Math.random() * 2 - 1) - y); d[i] = y * Math.pow(1 - i / n, decay); }
  }
  return b;
}

export function buildEngine(ctx, preset = ABOUT, opts = {}) {
  const CHORDS = preset.chords, STEP = preset.step || 8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -30; comp.knee.value = 30; comp.ratio.value = 2; comp.attack.value = 0.05; comp.release.value = 0.6;
  const out = ctx.createGain(); out.gain.value = 0; comp.connect(out); out.connect(ctx.destination);
  const dry = ctx.createGain(); dry.gain.value = 0.7; dry.connect(comp);
  const send = ctx.createGain(); const conv = ctx.createConvolver(); conv.buffer = impulse(ctx);
  const wet = ctx.createGain(); wet.gain.value = 0.8; send.connect(conv); conv.connect(wet); wet.connect(comp);

  // everything below the voice: a gentle low-pass keeps the music out of the range where speech lives (it is mostly low "air")
  const body = ctx.createBiquadFilter(); body.type = "lowpass"; body.frequency.value = preset.cut || 700; body.Q.value = 0.3; body.connect(dry); body.connect(send);
  const lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); lfo.frequency.value = 0.06; lfoGain.gain.value = (preset.cut || 700) * 0.23; lfo.connect(lfoGain); lfoGain.connect(body.frequency); lfo.start();   // the "breathing"

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
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 * (preset.shimmer || 1), t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
    [[1, 1], [2, 0.2]].forEach(([mul, a]) => { const o = ctx.createOscillator(), ga = ctx.createGain(); o.type = "sine"; o.frequency.value = hz(m) * mul; ga.gain.value = a; o.connect(ga); ga.connect(g); o.start(t); o.stop(t + 5.2); });
    let n = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); n = p; }
    const s = ctx.createGain(); s.gain.value = 1; n.connect(s); s.connect(send);                      // wet only: it should arrive as a reflection, not as a note
  };

  if (opts.air) {                                                         // atmosphere mode: a very faint, slow "room tone" under the chords, like distant air
    const n = ctx.sampleRate * 4, nb = ctx.createBuffer(1, n, ctx.sampleRate), d = nb.getChannelData(0); let y = 0;
    for (let k = 0; k < n; k++) { y += 0.04 * ((Math.random() * 2 - 1) - y); d[k] = y * 3; }
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 420; bp.Q.value = 0.5;
    const ag = ctx.createGain(); ag.gain.value = 0.55;
    const l2 = ctx.createOscillator(), l2g = ctx.createGain(); l2.frequency.value = 0.045; l2g.gain.value = 0.35; l2.connect(l2g); l2g.connect(ag.gain); l2.start();
    src.connect(bp); bp.connect(ag); ag.connect(send); src.start();
  }
  let i = 0;
  const step = (t) => {
    const c = CHORDS[i % CHORDS.length];
    chord(c, t, STEP * 2);
    if (preset.shimmer > 0.7 || i % 2 === 0) { if (i % 2 === 0) shimmer(c[3] + 24, t + 3, -0.5); else shimmer(c[2] + 36, t + 4.5, 0.5); }
    i++;
  };
  return { step, out, ctx, STEP };
}

// ---- the live player ----
export function createMusic(name = "about", opts = {}) {
  const preset = PRESETS[name] || ABOUT, STEP = preset.step || 8, NORM_ = NORM * (opts.gain || 1);
  let ctx = null, eng = null, timer = 0, next = 0, on = false, lvl = 1;
  const tick = () => {
    if (!ctx || !on) return;
    while (next < ctx.currentTime + 1) { eng.step(next); next += STEP; }
  };
  return {
    start() {
      if (on) return;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      if (!ctx) { ctx = new AC(); eng = buildEngine(ctx, preset, opts); }
      if (ctx.state === "suspended") ctx.resume();
      on = true; next = ctx.currentTime + 0.2;
      const g = eng.out.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(Math.max(g.value, 0.0001), ctx.currentTime); g.linearRampToValueAtTime(NORM_ * lvl, ctx.currentTime + 6);
      clearInterval(timer); timer = setInterval(tick, 250); tick();
    },
    stop() {
      if (!on || !ctx) return; on = false; clearInterval(timer);
      const g = eng.out.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(g.value, ctx.currentTime); g.linearRampToValueAtTime(0, ctx.currentTime + 2);
    },
    level(x) { lvl = x; if (on && ctx) eng.out.gain.setTargetAtTime(NORM_ * lvl, ctx.currentTime, 0.9); },     // a little lower between the narrator's sentences, slowly
    chime() {},
    pause() { if (ctx && on) { clearInterval(timer); ctx.suspend(); } },
    resume() { if (ctx && on) { ctx.resume(); next = ctx.currentTime + 0.1; clearInterval(timer); timer = setInterval(tick, 250); } },
    dispose() { on = false; clearInterval(timer); if (ctx) { try { ctx.close(); } catch {} ctx = null; eng = null; } },
    get on() { return on; },
  };
}

// for testing: render some seconds offline at the playing level
export function _render(oc, seconds, level = 1, name = "about", opts = {}) {
  const e = buildEngine(oc, PRESETS[name] || ABOUT, opts), STEP = e.STEP; e.out.gain.value = NORM * level;
  for (let t = 0.05; t < seconds; t += STEP) e.step(t);
  return oc.startRendering();
}
