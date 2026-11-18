// Loaded on demand from the product page: openChapter, a short silent scrolling "fairytale chapter" for one perfume
// (cover, once upon a scent, top / heart / base notes, when to wear it, the end). No voice, no music.
// Plain DOM, no libraries. ctx = { I, esc, fmt, change, updateLock }.
import { ART, NOTE_INFO } from "/features.js";
import { tiersOf } from "/extras.js";

const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lower = (I, s) => ["en", "fr", "pt", "it", "es"].includes(I.lang) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const joinList = (I, arr) => {
  try { return new Intl.ListFormat(I.lang, { style: "long", type: "conjunction" }).format(arr); } catch { return arr.join(", "); }
};
const noteLabel = (I, n) => I.lang === "en" ? n : lower(I, I.noteName(n));
const ROMAN = ["I", "II", "III"];
const ORNAMENT = '<svg class="ch-orn" viewBox="0 0 120 14" aria-hidden="true"><path d="M0 7H48M72 7H120" /><path d="M60 1.5 63.5 7 60 12.5 56.5 7Z" /></svg>';

let uid = 0;
function noteIcon(n) {
  const info = NOTE_INFO[n] || ["aromatic", "#d9b96a"], k = ++uid;
  const svg = ART[info[0]]().replace(/id="rg"/g, `id="chrg${k}"`).replace(/url\(#rg\)/g, `url(#chrg${k})`);
  return `<svg viewBox="0 0 120 120" aria-hidden="true">${svg}</svg>`;
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

  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    document.removeEventListener("keydown", onKey);
    io.disconnect();
    el.classList.add("out"); setTimeout(() => el.remove(), 380);
    ctx.updateLock(); if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  el.querySelector(".ch-x").addEventListener("click", close);
  dots.addEventListener("click", (e) => { const d = e.target.closest("[data-i]"); if (d) secs[+d.dataset.i].scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); });
  el.querySelector(".ch-scrollhint").addEventListener("click", () => secs[1].scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }));
  const add = el.querySelector(".ch-add");
  add.addEventListener("click", () => {
    ctx.change(p.id, 1); add.classList.add("done"); add.textContent = t("addedToCart");
    setTimeout(() => { add.classList.remove("done"); add.textContent = t("add") + " · " + fmt(p.price); }, 2200);
  });
  return { close };
}
