// Loaded on demand from the product page:
//  - openChapter: a short scrolling "fairytale chapter" for one perfume (cover, once upon a scent, top / heart / base notes, when to wear it, the end),
//    silent (no voice, no music).
//  - openAtmosphere: a full-screen, slow scene of light and smoke in the perfume's colours, with its own quiet music, for winding down.
// Both are plain DOM + canvas + Web Audio (no libraries). ctx = { I, esc, fmt, change, updateLock }.
import { ART, NOTE_INFO } from "/features.js";
import { tiersOf } from "/extras.js";
import { createMusic } from "/music.js";

const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const PREF = "laniko-ch-music";
const musicWanted = () => { try { return localStorage.getItem(PREF) !== "off"; } catch { return true; } };
const saveMusic = (on) => { try { localStorage.setItem(PREF, on ? "on" : "off"); } catch { /* private mode */ } };
const lower = (I, s) => ["en", "fr", "pt", "it", "es"].includes(I.lang) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const joinList = (I, arr) => {
  try { return new Intl.ListFormat(I.lang, { style: "long", type: "conjunction" }).format(arr); } catch { return arr.join(", "); }
};
const noteLabel = (I, n) => I.lang === "en" ? n : lower(I, I.noteName(n));
const ROMAN = ["I", "II", "III"];
const SPEAKER = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" stroke="none"/><path class="w1" d="M15 9.2a4 4 0 0 1 0 5.6" fill="none"/><path class="w2" d="M17.4 6.8a7.4 7.4 0 0 1 0 10.4" fill="none"/><path class="mute" d="M4 20 20 4" fill="none"/></svg>';
const ORNAMENT = '<svg class="ch-orn" viewBox="0 0 120 14" aria-hidden="true"><path d="M0 7H48M72 7H120" /><path d="M60 1.5 63.5 7 60 12.5 56.5 7Z" /></svg>';

let uid = 0;
function noteIcon(n) {
  const info = NOTE_INFO[n] || ["aromatic", "#d9b96a"], k = ++uid;
  const svg = ART[info[0]]().replace(/id="rg"/g, `id="chrg${k}"`).replace(/url\(#rg\)/g, `url(#chrg${k})`);
  return `<svg viewBox="0 0 120 120" aria-hidden="true">${svg}</svg>`;
}

// a music on/off button that remembers the choice
function musicButton(I, music, btn) {
  const sync = () => { btn.classList.toggle("off", !music.on); btn.setAttribute("aria-pressed", String(music.on)); btn.setAttribute("aria-label", I.t(music.on ? "abMusicOn" : "abMusicOff")); };
  btn.innerHTML = SPEAKER; sync();
  btn.addEventListener("click", () => { if (music.on) { music.stop(); saveMusic(false); } else { music.start(); saveMusic(true); } sync(); });
  return sync;
}

// =====================================================================================================
// the chapter
// =====================================================================================================
export function openChapter(ctx, p, { onClose } = {}) {
  const { I, esc, fmt } = ctx, t = I.t;
  const th = p.theme || {};
  const tr = tiersOf(p.notes || []);
  const tagKey = "chT_" + p.id.replace(/-/g, "_"), tag = t(tagKey) === tagKey ? "" : t(tagKey);
  const when = ((p.profile && p.profile.when) || []).map((w) => lower(I, t("w_" + w))).filter(Boolean);

  const tier = (k, i, title, text) => tr[k].length ? `
    <section class="ch-s ch-tier" data-k="${k}">
      <p class="ch-num rv" style="--d:0s">${ROMAN[i]}</p>
      <h2 class="rv" style="--d:.1s">${esc(t(title))}</h2>
      <div class="ch-icons">${tr[k].map((n, j) => `<figure class="ch-ico rv" style="--d:${(0.3 + j * 0.18).toFixed(2)}s;--nc:${(NOTE_INFO[n] || [0, "#d9b96a"])[1]}"><span>${noteIcon(n)}</span><figcaption>${esc(I.noteName(n))}</figcaption></figure>`).join("")}</div>
      <p class="ch-p rv" style="--d:${(0.45 + tr[k].length * 0.18).toFixed(2)}s">${esc(t(text, { n: joinList(I, tr[k].map((n) => noteLabel(I, n))) }))}</p>
    </section>` : "";

  const el = document.createElement("div");
  el.className = "ch"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", p.name);
  el.style.setProperty("--bg", th.bgDark || "#0c0a07"); el.style.setProperty("--gl", th.glow || "#c9a25a"); el.style.setProperty("--sm", th.smoke || "#f0d9a8");
  el.innerHTML = `
    <div class="ch-glow" aria-hidden="true"></div>
    <div class="ch-chrome">
      <button class="ch-btn ch-x" type="button" aria-label="${esc(t("qzClose"))}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none"/></svg></button>
    </div>
    <nav class="ch-dots" aria-hidden="true"></nav>
    <div class="ch-scroll">
      <section class="ch-s ch-cover">
        <img class="ch-logo rv" style="--d:.1s" src="/logo.svg" alt="" width="20" height="50">
        <p class="ch-kick rv" style="--d:.35s">${esc(t("chKicker"))}</p>
        <h1 class="rv" style="--d:.6s">${esc(p.name)}</h1>
        ${ORNAMENT.replace('class="ch-orn"', 'class="ch-orn rv" style="--d:.95s"')}
        ${tag ? `<p class="ch-tag rv" style="--d:1.15s">${esc(tag)}</p>` : ""}
        <button class="ch-scrollhint rv" type="button" style="--d:1.8s"><span>${esc(t("chScroll"))}</span><i></i></button>
      </section>
      <section class="ch-s ch-once">
        <svg class="ch-spark rv" style="--d:0s" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 23 17 38 20 23 23 20 38 17 23 2 20 17 17Z"/></svg>
        <h2 class="ch-big rv" style="--d:.2s">${esc(t("chOnce"))}</h2>
        <p class="ch-p rv" style="--d:.6s">${esc(t("chOnceS", { n: joinList(I, (p.notes || []).map((n) => noteLabel(I, n))) }))}</p>
      </section>
      ${tier("top", 0, "chTop", "chTopS")}${tier("heart", 1, "chHeart", "chHeartS")}${tier("base", 2, "chBase", "chBaseS")}
      ${when.length ? `<section class="ch-s ch-when">
        <h2 class="rv" style="--d:0s">${esc(t("chWhen"))}</h2>
        ${ORNAMENT.replace('class="ch-orn"', 'class="ch-orn rv" style="--d:.15s"')}
        <p class="ch-big rv" style="--d:.3s">${esc(t("chWhenS", { n: joinList(I, when) }))}</p>
      </section>` : ""}
      <section class="ch-s ch-end">
        <div class="ch-arch rv" style="--d:0s"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>
        <h2 class="ch-name rv" style="--d:.25s">${esc(p.name)}</h2>
        <p class="ch-p rv" style="--d:.45s">${esc(t("chEnd"))}</p>
        <div class="ch-cta rv" style="--d:.65s">
          <button class="ch-add" type="button">${esc(t("add"))} · ${esc(fmt(p.price))}</button>
          <button class="ch-atmo" type="button">${esc(t("chAtmo"))}</button>
        </div>
      </section>
    </div>`;
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";

  const sc = el.querySelector(".ch-scroll"), secs = [...el.querySelectorAll(".ch-s")], dots = el.querySelector(".ch-dots");
  dots.innerHTML = secs.map((_, i) => `<i data-i="${i}"></i>`).join("");
  const setDot = (i) => dots.querySelectorAll("i").forEach((d, k) => d.classList.toggle("on", k === i));
  setDot(0);
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting && e.intersectionRatio >= 0.45) { e.target.classList.add("in"); setDot(secs.indexOf(e.target)); }
  }), { root: sc, threshold: [0.2, 0.45, 0.7] });
  secs.forEach((s) => io.observe(s));
  requestAnimationFrame(() => secs[0].classList.add("in"));

  let atmoOpen = false, closed = false;                                      // the story itself is silent; only the Atmosphere has sound
  const close = () => {
    if (closed) return; closed = true;
    document.removeEventListener("keydown", onKey);
    io.disconnect();
    el.classList.add("out"); setTimeout(() => el.remove(), 380);
    ctx.updateLock(); if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === "Escape" && !atmoOpen) close(); };
  document.addEventListener("keydown", onKey);
  el.querySelector(".ch-x").addEventListener("click", close);
  dots.addEventListener("click", (e) => { const d = e.target.closest("[data-i]"); if (d) secs[+d.dataset.i].scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); });
  el.querySelector(".ch-scrollhint").addEventListener("click", () => secs[1].scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }));
  const add = el.querySelector(".ch-add");
  add.addEventListener("click", () => {
    ctx.change(p.id, 1); add.classList.add("done"); add.textContent = t("addedToCart");
    setTimeout(() => { add.classList.remove("done"); add.textContent = t("add") + " · " + fmt(p.price); }, 2200);
  });
  el.querySelector(".ch-atmo").addEventListener("click", () => {
    atmoOpen = true;
    openAtmosphere(ctx, p, { onClose: () => { atmoOpen = false; document.body.style.overflow = "hidden"; } });
  });
  return { close };
}

// =====================================================================================================
// the atmosphere: slow light and smoke, a faint tone, nothing to do
// =====================================================================================================
const hex = (h) => { h = (h || "#888").replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

export function openAtmosphere(ctx, p, { onClose } = {}) {
  const { I, esc } = ctx, t = I.t;
  const th = p.theme || {};
  const bg = hex(th.bgDark || "#0c0a07"), gl = hex(th.glow || "#c9a25a"), sm = hex(th.smoke || "#f0d9a8");
  const tagKey = "chT_" + p.id.replace(/-/g, "_"), tag = t(tagKey) === tagKey ? "" : t(tagKey);
  const el = document.createElement("div");
  el.className = "am ui"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", t("chAtmo") + " · " + p.name);
  el.style.background = `rgb(${bg})`;
  el.innerHTML = `
    <canvas class="am-cv" aria-hidden="true"></canvas>
    <div class="ch-chrome am-chrome">
      <button class="ch-btn ch-x" type="button" aria-label="${esc(t("qzClose"))}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none"/></svg></button>
      <button class="ch-btn ch-mu" type="button"></button>
    </div>
    <div class="am-cap"><p class="ch-kick">${esc(t("chAtmo"))}</p><h2>${esc(p.name)}</h2>${tag ? `<p class="am-tag">${esc(tag)}</p>` : ""}</div>`;
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";

  // the scene
  const cv = el.querySelector(".am-cv"), g = cv.getContext("2d"), SC = 2;     // drawn at half size on purpose: it is all soft light, and it saves the battery
  let W = 0, H = 0;
  const fit = () => { W = Math.max(2, Math.ceil(innerWidth / SC)); H = Math.max(2, Math.ceil(innerHeight / SC)); cv.width = W; cv.height = H; };
  fit();
  const inten = (p.profile && p.profile.intensity) || 3, pace = (reduced() ? 0.18 : 1) * (1.15 - inten * 0.1);    // stronger perfumes move more slowly
  const R = (a, b) => a + Math.random() * (b - a);
  const blobs = Array.from({ length: 6 }, (_, i) => ({
    ax: R(0.18, 0.4), ay: R(0.12, 0.3), fx: R(0.05, 0.12), fy: R(0.04, 0.1), ph: R(0, 6.28), ph2: R(0, 6.28),
    r: R(0.5, 0.95), c: mix(gl, sm, i % 3 === 0 ? 0.3 : i % 3 === 1 ? 0 : 0.15), a: R(0.1, 0.2),
  }));
  const motes = Array.from({ length: 30 }, () => ({ x: Math.random(), y: Math.random(), s: R(0.4, 1.5), v: R(0.004, 0.012), w: R(0.2, 0.7), ph: R(0, 6.28), tw: R(0.2, 0.6) }));
  const wisps = Array.from({ length: 4 }, (_, i) => ({ x: R(0.15, 0.85), ph: R(0, 6.28), f: R(0.03, 0.06), r: R(0.35, 0.6), o: i / 4 }));
  let t0 = performance.now(), raf = 0, last = 0, hiddenAt = 0;
  const draw = (now) => {
    raf = requestAnimationFrame(draw);
    if (now - last < 33) return;                                              // about 30 frames a second is plenty for something this slow
    const dt = Math.min(0.1, (now - (last || now - 33)) / 1000); last = now;
    const tt = ((now - t0) / 1000) * pace;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = `rgb(${bg})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    const m = Math.max(W, H);
    for (const b of blobs) {
      const x = W * (0.5 + b.ax * Math.sin(tt * b.fx * 6.28 + b.ph)), y = H * (0.5 + b.ay * Math.sin(tt * b.fy * 6.28 + b.ph2)), r = m * b.r * (0.9 + 0.1 * Math.sin(tt * 0.2 + b.ph));
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${b.c},${b.a * (0.8 + 0.2 * Math.sin(tt * 0.13 + b.ph))})`); gr.addColorStop(1, `rgba(${b.c},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    for (const w of wisps) {                                                  // smoke: soft pale clouds that rise slowly and fade
      const k = (tt * w.f + w.o) % 1, x = W * (w.x + 0.12 * Math.sin(tt * 0.12 + w.ph)), y = H * (1.15 - 1.4 * k), r = m * w.r * (0.5 + k * 0.7), a = Math.sin(k * Math.PI) * 0.055;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${sm},${a})`); gr.addColorStop(1, `rgba(${sm},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    const spec = mix(sm, [255, 255, 255], 0.35);
    for (const q of motes) {                                                  // a few specks of light drifting up, like dust in a sunbeam
      q.y -= q.v * dt * pace * 6; if (q.y < -0.05) { q.y = 1.05; q.x = Math.random(); }
      const x = W * (q.x + 0.03 * Math.sin(tt * q.w + q.ph)), y = H * q.y, a = 0.2 + 0.3 * Math.sin(tt * q.tw + q.ph), rr = q.s * (W / 200 + 0.6);
      const gr = g.createRadialGradient(x, y, 0, x, y, rr * 2);
      gr.addColorStop(0, `rgba(${spec},${Math.max(0, a)})`); gr.addColorStop(1, `rgba(${sm},0)`);
      g.fillStyle = gr; g.fillRect(x - rr * 2, y - rr * 2, rr * 4, rr * 4);
    }
    g.globalCompositeOperation = "source-over";                               // a soft vignette keeps the edges deep
    const v = g.createRadialGradient(W / 2, H / 2, m * 0.25, W / 2, H / 2, m * 0.8);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(${bg.map((c) => Math.round(c * 0.3))},0.7)`);
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  };
  raf = requestAnimationFrame(draw);
  const onResize = () => fit();
  window.addEventListener("resize", onResize);

  // music: the perfume's own quiet chords, with a faint breath of air under them
  const music = createMusic(p.id, { gain: 1.5, air: true });
  const wanted = musicWanted();
  const syncMu = musicButton(I, music, el.querySelector(".ch-mu"));
  if (wanted) { music.start(); setTimeout(syncMu, 80); }
  const unlock = () => { if (wanted && !music.on && musicWanted()) { music.start(); syncMu(); } };
  el.addEventListener("pointerdown", unlock, { once: true });

  // keep the screen awake while it plays
  let lock = null;
  const wake = async () => { try { if (navigator.wakeLock && !document.hidden) lock = await navigator.wakeLock.request("screen"); } catch { lock = null; } };
  wake();
  const onVis = () => {
    if (document.hidden) { hiddenAt = performance.now(); music.pause(); cancelAnimationFrame(raf); }
    else { t0 += performance.now() - (hiddenAt || performance.now()); music.resume(); cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); wake(); }
  };
  document.addEventListener("visibilitychange", onVis);

  // the controls and the name fade away after a few seconds; a tap brings them back
  let hideT = 0;
  const showUi = () => { el.classList.add("ui"); clearTimeout(hideT); hideT = setTimeout(() => el.classList.remove("ui"), 5200); };
  showUi();
  el.addEventListener("click", (e) => { if (e.target.closest(".ch-btn")) { showUi(); return; } if (el.classList.contains("ui")) { el.classList.remove("ui"); clearTimeout(hideT); } else showUi(); });

  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    clearTimeout(hideT); cancelAnimationFrame(raf); window.removeEventListener("resize", onResize);
    document.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onVis);
    music.dispose(); try { if (lock) lock.release(); } catch { /* already released */ }
    el.classList.add("out"); setTimeout(() => el.remove(), 500);
    ctx.updateLock(); if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  el.querySelector(".ch-x").addEventListener("click", (e) => { e.stopPropagation(); close(); });
  return { close };
}
