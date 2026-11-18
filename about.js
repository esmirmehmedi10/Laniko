// "About us": the brand text as a story, one sentence per scene. Each scene has a gold line drawing that draws itself
// when it scrolls into view, and the sentence appears word by word. Everything is plain SVG + CSS (no libraries).

import { createMusic } from "/music.js";

// ---- tiny helpers for the drawings (viewBox 0 0 200 200) ----
const P = (i, d, cls = "") => `<path class="dr ${cls}" pathLength="1" style="--i:${i}" d="${d}"/>`;      // a line that draws itself
const F = (i, d, cls = "") => `<path class="fi ${cls}" style="--i:${i}" d="${d}"/>`;                      // a filled shape that fades in
const circ = (cx, cy, r) => `M${cx - r},${cy} a${r},${r} 0 1 0 ${2 * r},0 a${r},${r} 0 1 0 ${-2 * r},0`;
const spark = (cx, cy, s) => `M${cx},${cy - s} L${cx + s * .25},${cy - s * .25} L${cx + s},${cy} L${cx + s * .25},${cy + s * .25} L${cx},${cy + s} L${cx - s * .25},${cy + s * .25} L${cx - s},${cy} L${cx - s * .25},${cy - s * .25} Z`;
const drop = (cx, cy, s) => `M${cx},${cy - s * 1.5} C${cx - s * .2},${cy - s * .6} ${cx - s},${cy - s * .2} ${cx - s},${cy + s * .35} a${s},${s} 0 0 0 ${2 * s},0 C${cx + s},${cy - s * .2} ${cx + s * .2},${cy - s * .6} ${cx},${cy - s * 1.5} Z`;
const heart = (cx, cy, s) => { const y = cy - .11 * s + 1.5;      // the box of the shape is centred on (cx, cy); +1.5 because a heart's weight sits in its upper half
  return `M${cx},${y + .95 * s} C${cx - .35 * s},${y + .6 * s} ${cx - s},${y + .15 * s} ${cx - s},${y - .3 * s} C${cx - s},${y - .75 * s} ${cx - .3 * s},${y - .95 * s} ${cx},${y - .4 * s} C${cx + .3 * s},${y - .95 * s} ${cx + s},${y - .75 * s} ${cx + s},${y - .3 * s} C${cx + s},${y + .15 * s} ${cx + .35 * s},${y + .6 * s} ${cx},${y + .95 * s} Z`; };
const svg = (inner) => `<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">${inner}</svg>`;

// the Laniko bottle: square glass body, framed label, collar and a tall cap
const bottle = (o = 0) =>
  P(o, "M66,92 h68 a6,6 0 0 1 6,6 v70 a6,6 0 0 1 -6,6 h-68 a6,6 0 0 1 -6,-6 v-70 a6,6 0 0 1 6,-6 z") +
  P(o + 1, "M74,110 h52 v46 h-52 z") + P(o + 2, "M80,116 h40 v34 h-40 z") + P(o + 2, "M90,92 v-8 h20 v8") +
  P(o + 3, "M86,84 v-34 a4,4 0 0 1 4,-4 h20 a4,4 0 0 1 4,4 v34") + P(o + 4, "M94,56 v22 M100,56 v22 M106,56 v22", "thin") +
  F(o + 5, drop(100, 134, 5.5));

const ART = {
  // hero: the bottle, with scent rising from it
  hero: svg(bottle(0) + P(6, "M100,40 c-9,-8 9,-14 0,-22", "sw") + P(7, "M88,38 c-8,-6 6,-12 -2,-18", "sw s2") + P(7, "M112,38 c8,-6 -6,-12 2,-18", "sw s3")),
  // 1: born from a conviction: a flower opens from a single drop
  born: svg(F(0, drop(100, 168, 9)) + P(1, "M100,152 C100,132 98,108 100,84", "") +
    P(2, "M100,134 C84,132 72,122 70,110 C84,110 96,118 100,134") + P(3, "M100,120 C116,118 128,108 130,96 C116,96 104,104 100,120") +
    P(4, "M100,84 C88,70 90,52 100,42 C110,52 112,70 100,84") + P(5, "M100,84 C84,80 70,68 68,56 C82,54 96,66 100,84") +
    P(5, "M100,84 C116,80 130,68 132,56 C118,54 104,66 100,84") + P(6, "M100,84 C86,88 70,86 62,76 C74,70 92,74 100,84") +
    P(6, "M100,84 C114,88 130,86 138,76 C126,70 108,74 100,84") + F(7, circ(100, 68, 3.2)) + P(8, spark(152, 44, 9), "sw s2") + P(9, spark(52, 58, 6), "sw s3")),
  // 2: a mirror that holds an invisible signature
  mirror: svg(P(0, "M58,85 a42,52 0 1 0 84,0 a42,52 0 1 0 -84,0") + P(1, "M66,85 a34,44 0 1 0 68,0 a34,44 0 1 0 -68,0", "thin") +
    P(2, "M95,138 C94,150 96,164 96,178 h8 C104,164 106,150 105,138") +
    P(3, "M76,98 c6,-22 12,-26 14,-10 c2,14 6,16 10,-2 c3,-12 8,-12 10,0 c1,8 6,8 14,-8", "sign") + P(5, "M72,62 l10,-9 M84,52 l5,-5", "thin")),
  // 3: true luxury does not announce itself: a crown behind a veil
  crown: svg(P(0, "M58,128 L50,78 L78,102 L100,64 L122,102 L150,78 L142,128 Z") + P(1, "M58,138 H142") + F(2, circ(50, 76, 3.2)) + F(2, circ(100, 62, 3.2)) + F(2, circ(150, 76, 3.2)) +
    P(3, "M36,52 Q100,26 164,52 M36,52 C58,92 54,138 40,172 M164,52 C142,92 146,138 160,172", "veil")),
  // 4: sensed, felt, remembered: ripples spreading from a heart
  ripples: svg(P(0, heart(100, 98, 25)) +
    P(2, circ(100, 98, 38), "br") + P(3, circ(100, 98, 58), "br b2 dim") + P(4, circ(100, 98, 78), "br b3 dimmer")),
  // 5: anchored in individuality: an anchor under a star
  anchor: svg(P(0, circ(100, 46, 9)) + P(1, "M100,55 V160") + P(2, "M80,76 H120") + P(3, "M52,126 C58,156 80,168 100,168 C120,168 142,156 148,126") +
    P(4, "M44,134 L53,118 L63,136") + P(4, "M156,134 L147,118 L137,136") + P(5, spark(154, 50, 11), "sw") + P(6, spark(46, 66, 6), "sw s2")),
  // 6: contrast: smooth waves on one half, sharp rays on the other
  contrast: svg(P(0, "M100,42 A58,58 0 0 0 100,158") + P(1, "M100,42 A58,58 0 0 1 100,158") + P(2, "M100,42 V158", "thin") +
    P(3, "M57,86 q4.5,-7 9,0 t9,0 t9,0 M57,100 q4.5,-7 9,0 t9,0 t9,0 M57,114 q4.5,-7 9,0 t9,0 t9,0") +
    P(4, "M114,74 l10,13 l-10,13 l10,13 l-10,13", "") + P(5, "M131,93 l13,-6 M131,107 l13,6", "thin")),
  // 7: not following trends: a crowd of lines going one way, one gold path breaking free
  trend: svg([62, 86, 110, 134, 158].map((y, k) => P(k * .4, `M36,${y} H146 M138,${y - 5} L146,${y} L138,${y + 5}`, "dimmer")).join("") +
    P(2, "M36,110 C74,110 98,112 112,92 C124,74 132,56 160,48", "free") + P(5, spark(164, 44, 10), "sw")),
  // 8: to evoke emotion: an eye that holds a drop of scent
  eye: svg(P(0, "M26,104 Q100,44 174,104 Q100,164 26,104 Z") + P(1, circ(100, 104, 23)) + F(2, drop(100, 104, 8), "") +
    P(3, "M58,80 L50,66 M80,66 L75,50 M100,60 V42 M120,66 L125,50 M142,80 L150,66", "thin") + F(4, circ(110, 94, 2.6))),
  // 9: every detail matters: a cut gem
  gem: svg(P(0, "M70,66 H130 L160,100 L100,162 L40,100 Z") + P(1, "M40,100 H160") + P(2, "M70,66 L84,100 L100,162 L116,100 L130,66", "thin") +
    P(3, "M84,100 L100,66 L116,100", "thin") + P(4, spark(44, 56, 8), "sw") + P(5, spark(160, 58, 6), "sw s2") + P(6, spark(100, 36, 5), "sw s3")),
  // 10: every composition has purpose: the pyramid of notes (top, heart, base)
  pyramid: svg(P(0, "M100,40 L162,156 H38 Z") + P(1, "M76.5,84 H123.5") + P(2, "M57.2,120 H142.8") + F(3, drop(100, 68, 6)) +
    P(4, circ(100, 102, 9), "thin") + P(4, circ(100, 102, 4), "thin") + P(5, "M100,128 l12,10 l-12,10 l-12,-10 z", "")),
  // 11: a story that words cannot express: an open book, the story rising as smoke
  book: svg(P(0, "M100,150 C80,138 56,136 34,142 V74 C56,68 80,70 100,82 Z") + P(0, "M100,150 C120,138 144,136 166,142 V74 C144,68 120,70 100,82 Z") +
    P(2, "M46,94 C60,92 76,94 88,100 M46,108 C60,106 76,108 88,114 M46,122 C60,120 76,122 88,128 M112,100 C124,94 140,92 154,94 M112,114 C124,108 140,106 154,108 M112,128 C124,122 140,120 154,122", "thin") +
    P(4, "M100,78 C86,66 114,60 100,48 C88,38 112,30 102,16", "sw") + P(5, "M92,70 C84,62 96,56 90,48", "sw s2 thin")),
  // 12: not just a fragrance: the bottle with a halo of sparks
  statement: svg(`<g transform="translate(0,12)">${bottle(0)}</g>` + P(6, spark(40, 60, 9), "sw") + P(7, spark(162, 50, 12), "sw s2") + P(8, spark(150, 108, 6), "sw s3") + P(8, spark(34, 118, 5), "sw")),
  // 13: a statement without words: an empty speech bubble holding a drop of scent
  bubble: svg(P(0, "M40,52 H160 a12,12 0 0 1 12,12 V120 a12,12 0 0 1 -12,12 H112 L92,160 L90,132 H40 a12,12 0 0 1 -12,-12 V64 a12,12 0 0 1 12,-12 Z") +
    F(2, drop(100, 92.9, 12), "") + P(3, circ(100, 92, 36), "br dim thin")),
  // end: a radiant star: discover, define
  end: svg(P(0, spark(100, 100, 46)) + P(1, circ(100, 100, 66), "thin dim") +
    Array.from({ length: 16 }, (_, k) => { const a = k * Math.PI / 8, r1 = 74, r2 = k % 2 ? 82 : 90; return P(2 + k * .12, `M${(100 + Math.cos(a) * r1).toFixed(1)},${(100 + Math.sin(a) * r1).toFixed(1)} L${(100 + Math.cos(a) * r2).toFixed(1)},${(100 + Math.sin(a) * r2).toFixed(1)}`, "thin"); }).join("")),
};

const SCENES = [
  { art: "born", key: "ab1" }, { art: "mirror", key: "ab2" }, { art: "crown", key: "ab3" }, { art: "ripples", key: "ab4" },
  { art: "anchor", key: "ab5" }, { art: "contrast", key: "ab6" }, { art: "trend", key: "ab7" }, { art: "eye", key: "ab8" },
  { art: "gem", key: "ab9" }, { art: "pyramid", key: "ab10" }, { art: "book", key: "ab11" },
  { art: "statement", key: "ab12" }, { art: "bubble", key: "ab13" },
];

let stop = null;
const seen = new Set();      // scenes already shown stay shown when the language changes

export function unmountStory() { if (stop) { stop(); stop = null; } }

export function mountStory(ctx, el) {
  unmountStory();
  const { I, esc } = ctx;
  const words = (txt) => I.splitWords(txt).map((w, i) => `<span class="st-w" style="--w:${i}">${esc(w)}</span>`).join(I.lang === "zh" ? "" : " ");
  const scene = (id, art, body) => `<section class="st-scene" data-id="${id}"><figure class="st-art">${ART[art]}</figure>${body}</section>`;
  el.innerHTML =
    scene("hero", "hero", `<h2 class="st-title">${words(I.t("abTitle"))}</h2><p class="st-tag">${words(I.t("abTag"))}</p><span class="st-cue" aria-hidden="true"></span>`) +
    SCENES.map((s, i) => scene("s" + i, s.art, `<p class="st-text">${words(I.t(s.key))}</p>`)).join("") +
    scene("end", "end", `<p class="st-text st-end"><span class="st-line">${words(I.t("abEnd1"))}</span> <span class="st-line">${words(I.t("abEnd2"))}</span></p><a class="act gold st-cta" href="/">${esc(I.t("abCta"))}</a>`) +
    '<div class="st-bar" aria-hidden="true"><i></i></div>';
  const scenes = [...el.querySelectorAll(".st-scene")];
  scenes.forEach((s) => { if (seen.has(s.dataset.id)) s.classList.add("in"); });

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      e.target.classList.toggle("vis", e.isIntersecting);                   // loops only run while a scene is on screen
      if (e.isIntersecting && e.intersectionRatio >= 0.3) { e.target.classList.add("in"); seen.add(e.target.dataset.id); }
    }
  }, { threshold: [0, 0.3, 0.6] });
  scenes.forEach((s) => io.observe(s));

  // ---- narration: a voice reads each scene aloud as it comes into view (the browser's own speech, no download) ----
  const synth = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window ? window.speechSynthesis : null;
  const LANG = { en: "en-US", de: "de-DE", fr: "fr-FR", pt: "pt-PT", it: "it-IT", es: "es-ES", ar: "ar-SA", zh: "zh-CN" };
  let voiceOn = false, spoken = -1, timer = 0, btn = null, noteT = 0, lastScene = -1, musicOn = false;
  const music = createMusic();
  // all voices of the site language, best first: natural / network / female-sounding voices before robotic local ones
  const FEMALE = /female|woman|samantha|karen|moira|serena|tessa|ava|allison|susan|zira|aria|jenny|libby|hazel|sonia|amelie|am[eé]lie|marie|audrey|anna|helena|petra|joana|maria|luciana|alice|elsa|federica|paola|paulina|monica|m[oó]nica|laura|helga|katja|amala|conchita|lucia|elvira|salma|zariyah|laila|ting|mei|tian|xiao|hui|yao|huihui|yunxi|x-(?:iob|iog|tpc|tpf|sfg|gba|gbc|gbg|frc|fra|dea|dec|ita|itb|esa|esc|ptb|ptc|cmn-cn-ccc)/i;
  const MALE = /\bmale\b|daniel|alex|fred|david|mark|james|george|thomas|diego|jorge|luca|paul|stefan|hans|maged|tarik|yunyang|kangkang|x-(?:iol|iom|tpd|gbb|gbd|frb|frd|ded|deb|itc|itd|esd|ptd)/i;
  const voiceList = () => {
    const base = (LANG[I.lang] || "en-US").slice(0, 2).toLowerCase(), want = (LANG[I.lang] || "en-US").toLowerCase();
    const sc = (v) => { const l = v.lang.toLowerCase().replace("_", "-"), n = v.name + " " + (v.voiceURI || "");
      return (l === want ? 3 : 0) + (/natural|neural|premium|enhanced|siri|online/i.test(n) ? 6 : 0) + (/google/i.test(n) ? 2 : 0) + (v.localService ? 0 : 2) + (/network/i.test(n) ? 3 : 0)
        + (MALE.test(n) ? -8 : FEMALE.test(n) ? 5 : 0) - (/compact|espeak|robot/i.test(n) ? 6 : 0); };
    return (synth.getVoices() || []).filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(base)).sort((x, y) => sc(y) - sc(x));
  };
  const saveKey = () => "laniko-voice-" + I.lang;
  const pickVoice = () => {
    const vs = voiceList(); let saved = ""; try { saved = localStorage.getItem(saveKey()) || ""; } catch {}
    return vs.find((v) => v.voiceURI === saved || v.name === saved) || vs[0] || null;
  };
  // the name must be said as one word, never spelled out: "Laniko" (title case), or the local script
  const NAME = { ar: "لانيكو", zh: "拉尼科" };
  const speakable = (t) => t.replace(/laniko/gi, NAME[I.lang] || "Laniko").replace(/[—–]/g, ", ").replace(/\s+/g, " ").trim();
  const sceneText = (sc) => speakable([...sc.querySelectorAll(".st-tag, .st-text, .st-line")].map((n) => n.textContent.trim()).filter(Boolean).join(I.lang === "zh" ? "" : " "));
  // ---- the natural voice (Cloudflare Workers AI, through /api/narrate); the phone's own voice is only the fallback ----
  const NEURAL = ["en", "es", "fr", "zh"];                                      // one soft narrator per language, chosen on the server
  const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
  const player = new Audio(); player.preload = "auto"; try { player.preservesPitch = true; } catch {}
  let aiOff = !NEURAL.includes(I.lang);                                        // set when the server has no voice (or this language has none): then the phone's voice reads
  const sceneIds = (i) => { const id = scenes[i].dataset.id; return id === "hero" ? ["abTag"] : id === "end" ? ["abEnd1", "abEnd2"] : [SCENES[+id.slice(1)].key]; };
  const clips = new Map();
  const clip = (i) => {                                                        // the recording of a scene as a blob URL, fetched once
    const k = I.lang + i;
    if (!clips.has(k)) {
      clips.set(k, fetch("/api/narrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang: I.lang, ids: sceneIds(i) }) })
        .then(async (r) => { if (!r.ok) { if ([501, 403, 400, 404].includes(r.status)) aiOff = true; throw new Error("voice " + r.status); } return URL.createObjectURL(await r.blob()); })
        .catch((e) => { clips.delete(k); throw e; }));
    }
    return clips.get(k);
  };
  const hush = () => { try { player.pause(); player.currentTime = 0; } catch {} };
  const sayBrowser = (i) => {
    if (!synth) return;
    synth.cancel();
    const txt = sceneText(scenes[i]); if (!txt) return;
    setTimeout(() => {                                                       // Chrome and Brave skip a speak() that comes right after a cancel()
      if (!voiceOn || spoken !== i) return;
      const v = pickVoice();
      const parts = txt.match(/[^.!?。！？؟]+[.!?。！？؟]*/g) || [txt];           // one sentence at a time, with a breath between them, like a storyteller
      const next = (k) => {
        if (!voiceOn || spoken !== i || k >= parts.length) return;
        const u = new SpeechSynthesisUtterance(parts[k].trim());
        u.lang = (v && v.lang) || LANG[I.lang] || "en-US"; if (v) u.voice = v;
        u.rate = I.lang === "zh" ? .85 : .86; u.pitch = 1.02; u.volume = 1;
        u.onend = () => setTimeout(() => next(k + 1), 420);
        u.onerror = (e) => { if (e.error && e.error !== "canceled" && e.error !== "interrupted") fail(); };
        synth.speak(u);
      };
      next(0);
    }, 90);
  };
  const say = (i) => {
    if (!voiceOn || i === spoken) return;
    spoken = i; hush(); if (synth) synth.cancel();
    if (aiOff) return sayBrowser(i);
    clip(i).then((url) => {
      if (!voiceOn || spoken !== i) return;
      player.src = url; player.playbackRate = .96; player.volume = .9;
      player.play().catch(() => { aiOff = true; sayBrowser(i); });
      for (const j of [i + 1, i + 2]) if (j < scenes.length) clip(j).catch(() => {});      // fetch the next recordings while this one plays
    }).catch(() => { if (voiceOn && spoken === i) { aiOff = true; sayBrowser(i); } });
  };
  const current = () => {                                                  // the scene that fills most of the screen
    let best = 0, bv = -1; const h = window.innerHeight;
    scenes.forEach((s, i) => { const r = s.getBoundingClientRect(), v = Math.min(r.bottom, h) - Math.max(r.top, 0); if (v > bv) { bv = v; best = i; } });
    return best;
  };
  const label = (txt) => { btn.querySelector(".st-voice-t").textContent = txt; };
  const note = (txt) => { label(txt); btn.classList.add("note"); clearTimeout(noteT); noteT = setTimeout(() => { btn.classList.remove("note"); label(I.t(voiceOn ? "abStop" : "abListen")); }, 3200); };
  const fail = () => { voiceOn = false; btn.classList.remove("on"); btn.setAttribute("aria-pressed", "false"); note(I.t("abNoVoice")); };
  const toggle = () => {
    if (!synth && aiOff) return fail();
    voiceOn = !voiceOn; spoken = -1; clearTimeout(timer);
    btn.classList.toggle("on", voiceOn); btn.setAttribute("aria-pressed", String(voiceOn)); label(I.t(voiceOn ? "abStop" : "abListen"));
    if (voiceOn) {
      musicOn = true; music.level(1); music.start();                                // the story and its quiet music begin together
      try { player.src = SILENT; player.play().catch(() => {}); } catch {}         // the tap unlocks the audio player for the rest of the visit
      try { synth && synth.resume(); } catch {} say(current());
    } else { hush(); if (synth) synth.cancel(); musicOn = false; music.stop(); }    // the tap itself is what lets the browser start the voice
  };
  if (synth || NEURAL.includes(I.lang)) {
    btn = document.createElement("button");
    btn.type = "button"; btn.className = "st-voice"; btn.setAttribute("aria-pressed", "false"); btn.setAttribute("aria-label", I.t("abListen"));
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path class="w1" d="M15 9.2a4 4 0 0 1 0 5.6"/><path class="w2" d="M17.4 6.8a7.4 7.4 0 0 1 0 10.4"/></svg><span class="st-voice-t"></span>';
    label(I.t("abListen")); btn.addEventListener("click", toggle); el.appendChild(btn);
    if (synth) synth.getVoices();                                           // some browsers only fill the voice list after the first call
  }
  const onSpeechScroll = () => {
    if (!voiceOn) return;
    clearTimeout(timer);
    timer = setTimeout(() => { const i = current(); if (i !== lastScene) { lastScene = i; if (musicOn) music.chime(); } say(i); }, 380);     // new scene: a soft celesta chime, then the voice
  };
  const onHide = () => { if (document.hidden) { hush(); if (synth) synth.cancel(); spoken = -1; music.pause(); } else music.resume(); };
  window.addEventListener("scroll", onSpeechScroll, { passive: true });
  document.addEventListener("visibilitychange", onHide);

  // thin progress line along the bottom edge
  const bar = el.querySelector(".st-bar i");
  let raf = 0;
  const upd = () => {
    raf = 0;
    const r = el.getBoundingClientRect();
    const k = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - window.innerHeight)));
    bar.style.transform = `scaleX(${k})`;
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(upd); };
  window.addEventListener("scroll", onScroll, { passive: true });
  upd();
  stop = () => { voiceOn = false; hush(); music.dispose(); clearTimeout(timer); clearTimeout(noteT); if (synth) synth.cancel(); window.removeEventListener("scroll", onSpeechScroll); document.removeEventListener("visibilitychange", onHide); io.disconnect(); window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); el.innerHTML = ""; };
}
