// Loaded on demand: explorable scent notes, the scent quiz and the compare page.
// app.js hands over a small context object: { I, products, esc, fmt, openDetail, change, byId, updateLock }.

// ---------- scent notes ----------
export const NOTE_INFO = {   // family and a colour for the illustration (keys are the English note names used in products.json)
  "white rose": ["floral", "#f2e3cf"], "orchid": ["floral", "#d9a2cf"], "velvet rose": ["floral", "#b2304a"], "crimson rose": ["floral", "#c8142f"], "white jasmine": ["floral", "#f6f0e2"],
  "red grapefruit": ["citrus", "#ee5b43"],
  "saffron": ["spicy", "#ee8a1f"], "black pepper": ["spicy", "#8d8d86"],
  "smoked sandalwood": ["woody", "#9a7650"], "precious woods": ["woody", "#8a5a34"], "smooth wood": ["woody", "#b99063"],
  "Bourbon vanilla": ["sweet", "#e9c98f"], "dark vanilla": ["sweet", "#8a5733"],
  "golden resin": ["resin", "#e0a82e"], "amber": ["resin", "#cf7f1f"],
  "ripe raspberry": ["fruity", "#cf1f66"], "dark berries": ["fruity", "#6a3a86"],
  "lavender": ["aromatic", "#9a87d1"],
};
const rot = (n, f) => Array.from({ length: n }, (_, i) => f(i, (360 / n) * i)).join("");

export const ART = {
  citrus: () => `
    <g class="na-spin"><circle cx="60" cy="60" r="42" fill="var(--nc)" fill-opacity=".22" stroke="var(--nc)" stroke-width="3"/>
    <circle cx="60" cy="60" r="35" fill="none" stroke="var(--nc)" stroke-opacity=".7" stroke-width="1.5"/>
    ${rot(8, (i, a) => `<path d="M60 60 L60 27" stroke="var(--nc)" stroke-width="2" stroke-linecap="round" transform="rotate(${a} 60 60)"/><ellipse cx="60" cy="44" rx="5.5" ry="11" fill="var(--nc)" fill-opacity=".34" transform="rotate(${a + 22.5} 60 60)"/>`)}</g>
    <circle class="na-drop d1" cx="96" cy="86" r="3.5" fill="var(--nc)"/><circle class="na-drop d2" cx="24" cy="80" r="2.6" fill="var(--nc)"/><circle class="na-drop d3" cx="88" cy="40" r="2.2" fill="var(--nc)"/>`,
  floral: () => `
    <g class="na-bloom">${rot(8, (i, a) => `<ellipse cx="60" cy="33" rx="11" ry="24" fill="var(--nc)" fill-opacity="${i % 2 ? ".62" : ".82"}" stroke="rgba(0,0,0,.12)" transform="rotate(${a} 60 60)"/>`)}
    ${rot(5, (i, a) => `<ellipse cx="60" cy="47" rx="6" ry="13" fill="var(--nc)" fill-opacity=".9" stroke="rgba(0,0,0,.14)" transform="rotate(${a + 20} 60 60)"/>`)}
    <circle cx="60" cy="60" r="7" fill="#d9b96a"/></g>
    <circle class="na-twinkle t1" cx="20" cy="30" r="2" fill="#d9b96a"/><circle class="na-twinkle t2" cx="100" cy="92" r="2.4" fill="#d9b96a"/>`,
  spicy: () => `
    <g class="na-sway s1"><path d="M60 108 C50 84 74 62 56 24" fill="none" stroke="var(--nc)" stroke-width="4.5" stroke-linecap="round"/><path d="M56 24 l-7 -10 M56 24 l4 -12 M56 24 l10 -7" stroke="var(--nc)" stroke-width="3" stroke-linecap="round"/></g>
    <g class="na-sway s2"><path d="M60 108 C68 86 46 70 76 34" fill="none" stroke="var(--nc)" stroke-opacity=".75" stroke-width="3.6" stroke-linecap="round"/><path d="M76 34 l-8 -8 M76 34 l5 -10" stroke="var(--nc)" stroke-opacity=".75" stroke-width="2.6" stroke-linecap="round"/></g>
    <g class="na-sway s3"><path d="M60 108 C52 92 40 76 38 48" fill="none" stroke="var(--nc)" stroke-opacity=".6" stroke-width="3.2" stroke-linecap="round"/></g>
    <circle class="na-twinkle t1" cx="28" cy="30" r="2.4" fill="var(--nc)"/><circle class="na-twinkle t2" cx="94" cy="62" r="2" fill="var(--nc)"/><circle class="na-twinkle t3" cx="86" cy="22" r="2.6" fill="var(--nc)"/>`,
  woody: () => `
    ${[40, 32, 25, 18, 11, 5].map((r, i) => `<ellipse class="na-ring r${i}" cx="60" cy="60" rx="${r + 4}" ry="${r}" fill="none" stroke="var(--nc)" stroke-width="${i % 2 ? 2 : 3.4}" stroke-opacity="${0.95 - i * 0.1}" pathLength="1"/>`).join("")}
    <path d="M60 60 L104 44" stroke="var(--nc)" stroke-opacity=".35" stroke-width="2" stroke-dasharray="3 5"/>`,
  sweet: () => `
    <path d="M26 100 C38 60 70 34 100 20" fill="none" stroke="#2a170c" stroke-width="11" stroke-linecap="round"/>
    <path d="M26 100 C38 60 70 34 100 20" fill="none" stroke="var(--nc)" stroke-opacity=".6" stroke-width="3" stroke-linecap="round" transform="translate(-2 -2)"/>
    <path class="na-wisp w1" d="M52 56 C44 46 62 40 54 28 C48 20 60 14 56 6" fill="none" stroke="var(--nc)" stroke-width="3" stroke-linecap="round"/>
    <path class="na-wisp w2" d="M74 62 C66 52 84 46 76 34" fill="none" stroke="var(--nc)" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="44" cy="84" r="1.6" fill="var(--nc)"/><circle cx="52" cy="76" r="1.4" fill="var(--nc)"/><circle cx="62" cy="68" r="1.6" fill="var(--nc)"/>`,
  resin: () => `
    <defs><radialGradient id="rg" cx="38%" cy="32%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".25" stop-color="var(--nc)"/><stop offset="1" stop-color="var(--nc)" stop-opacity=".78"/></radialGradient></defs>
    <path class="na-glow" d="M60 14 C60 14 92 52 92 76 a32 32 0 0 1 -64 0 C28 52 60 14 60 14Z" fill="url(#rg)" stroke="var(--nc)" stroke-width="2"/>
    <path d="M42 78 a18 18 0 0 0 12 17" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3.5" stroke-linecap="round"/>
    <circle class="na-fall" cx="104" cy="30" r="4" fill="var(--nc)"/>`,
  fruity: () => `
    <g class="na-bob b1"><circle cx="42" cy="74" r="19" fill="var(--nc)"/><circle cx="35" cy="67" r="5" fill="#fff" fill-opacity=".45"/></g>
    <g class="na-bob b2"><circle cx="78" cy="74" r="19" fill="var(--nc)" fill-opacity=".88"/><circle cx="71" cy="67" r="5" fill="#fff" fill-opacity=".4"/></g>
    <g class="na-bob b3"><circle cx="60" cy="46" r="19" fill="var(--nc)" fill-opacity=".95"/><circle cx="53" cy="39" r="5" fill="#fff" fill-opacity=".45"/>
    <path d="M60 28 C56 18 66 12 72 14 C70 22 66 28 60 28Z" fill="#5c8a4a"/></g>`,
  aromatic: () => `
    <g class="na-sway s1"><path d="M60 112 L60 30" stroke="#6c8a58" stroke-width="3" stroke-linecap="round"/>
    ${[26, 36, 46, 56, 66, 76].map((y, i) => `<ellipse cx="${60 + (i % 2 ? 6 : -6)}" cy="${y}" rx="5.5" ry="8" fill="var(--nc)" fill-opacity="${0.95 - i * 0.07}" transform="rotate(${i % 2 ? 22 : -22} ${60 + (i % 2 ? 6 : -6)} ${y})"/>`).join("")}</g>
    <g class="na-sway s2"><path d="M60 112 C70 92 84 80 90 52" stroke="#6c8a58" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="90" cy="46" rx="4.4" ry="7" fill="var(--nc)" fill-opacity=".75"/><ellipse cx="86" cy="60" rx="4" ry="6.4" fill="var(--nc)" fill-opacity=".65"/></g>
    <circle class="na-twinkle t1" cx="26" cy="40" r="2" fill="var(--nc)"/><circle class="na-twinkle t2" cx="100" cy="90" r="2.2" fill="var(--nc)"/>`,
};

export function openNote(ctx, key, siblings) {
  const { I, esc } = ctx;
  const info = NOTE_INFO[key] || ["aromatic", "#d9b96a"];
  const host = document.querySelector("#detail .pd");
  if (!host) return;
  let back = host.querySelector(".ns-back");
  const first = !back;
  if (!back) {
    back = document.createElement("div");
    back.className = "ns-back";
    host.appendChild(back);
    back.addEventListener("click", (e) => {
      if (e.target === back || e.target.closest("[data-ns='close']")) { closeNote(); return; }
      const c = e.target.closest("[data-ns-note]");
      if (c) openNote(ctx, c.dataset.nsNote, siblings);
    });
  }
  const chips = (siblings || []).length > 1
    ? `<div class="ns-chips">${siblings.map((n) => `<button data-ns-note="${esc(n)}"${n === key ? ' class="on"' : ""}>${esc(I.noteName(n))}</button>`).join("")}</div>` : "";
  back.innerHTML = `
    <div class="ns" role="dialog" aria-modal="true" aria-label="${esc(I.noteName(key))}" style="--nc:${info[1]}">
      <button class="ns-x" data-ns="close" aria-label="${esc(I.t("noteClose"))}">✕</button>
      <svg class="ns-art" viewBox="0 0 120 120" aria-hidden="true">${ART[info[0]]()}</svg>
      <p class="ns-kicker">${esc(I.t("noteFamily"))} · ${esc(I.t("fam_" + info[0]))}</p>
      <h3>${esc(I.noteName(key))}</h3>
      <p class="ns-desc">${esc(I.t("famd_" + info[0]))}</p>
      ${chips}
    </div>`;
  if (first) requestAnimationFrame(() => back.classList.add("on"));
  else back.classList.add("on");
}
export function closeNote() {
  const back = document.querySelector("#detail .ns-back");
  if (!back) return;
  back.classList.remove("on");
  setTimeout(() => { if (!back.classList.contains("on")) back.remove(); }, 380);
}

// ---------- scent quiz ----------
const QUESTIONS = [
  { key: "when", q: "q1", a: [["day", "w_day"], ["evening", "w_evening"], ["special", "w_special"]] },
  { key: "feel", q: "q2", a: [["fresh", "f_fresh"], ["warm", "f_warm"], ["dark", "f_dark"]] },
  { key: "power", q: "q3", a: [["soft", "p_soft"], ["medium", "p_medium"], ["bold", "p_bold"]] },
];

export function openQuiz(ctx) {
  const { I, esc, products, fmt } = ctx;
  const t = I.t;
  const wrap = document.createElement("div");
  wrap.className = "qz-back";
  wrap.innerHTML = `<div class="qz" role="dialog" aria-modal="true" aria-label="${esc(t("qzTitle"))}"></div>`;
  document.body.appendChild(wrap);
  document.body.style.overflow = "hidden";
  const box = wrap.firstElementChild;
  const answers = [];
  const close = () => {
    wrap.classList.add("out");
    setTimeout(() => wrap.remove(), 350);
    document.removeEventListener("keydown", onKey);
    ctx.updateLock();
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);

  const score = (p) => QUESTIONS.reduce((s, qn, i) => {
    const arr = (p.profile && p.profile[qn.key]) || [];
    const k = arr.indexOf(answers[i]);
    return s + (k === 0 ? 2 : k === 1 ? 1 : 0);
  }, 0);

  const step = () => {
    const i = answers.length;
    if (i >= QUESTIONS.length) return result();
    const qn = QUESTIONS[i];
    box.innerHTML = `
      <button class="qz-x" data-qz="close" aria-label="${esc(t("qzClose"))}">✕</button>
      <p class="qz-step">${esc(t("qzStep", { n: i + 1 }))}</p>
      <div class="qz-dots">${QUESTIONS.map((_, k) => `<span class="${k < i ? "done" : k === i ? "now" : ""}"></span>`).join("")}</div>
      <h2 class="qz-q">${esc(t(qn.q))}</h2>
      <div class="qz-answers">${qn.a.map(([v, label], n) => `<button data-qz-a="${v}" style="--i:${n}">${esc(t(label))}</button>`).join("")}</div>
      ${i ? `<button class="qz-back-btn" data-qz="back">${esc(t("qzBack"))}</button>` : ""}`;
  };
  const result = () => {
    const ranked = products.map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s || (a.p.rank || 9) - (b.p.rank || 9));
    const best = ranked[0].p, others = ranked.slice(1, 3).map((r) => r.p);
    box.innerHTML = `
      <button class="qz-x" data-qz="close" aria-label="${esc(t("qzClose"))}">✕</button>
      <p class="qz-step">${esc(t("qzMatch"))}</p>
      <div class="qz-res" style="--p-dark:${esc((best.theme && best.theme.bgDark) || "#0d0c0a")}">
        <img src="${esc(best.image)}" alt="${esc(best.name)}">
        <h2>${esc(best.name)}</h2>
        <p class="qz-notes">${(best.notes || []).slice(0, 4).map((n) => esc(I.noteName(n))).join(" · ")}</p>
        <p class="qz-price">${fmt(best.price)}</p>
        <button class="qz-main" data-qz-open="${esc(best.id)}">${esc(t("qzDiscover"))}</button>
        <button class="qz-sec" data-qz-add="${esc(best.id)}">${esc(t("add"))}</button>
        <button class="qz-sec" data-qz-card="${esc(best.id)}">${esc(t("scardBtn"))}</button>
      </div>
      <p class="qz-also">${esc(t("qzAlso"))}</p>
      <div class="qz-others">${others.map((o) => `<button data-qz-open="${esc(o.id)}"><img src="${esc(o.image)}" alt=""><span>${esc(o.name)}</span></button>`).join("")}</div>
      <button class="qz-back-btn" data-qz="again">${esc(t("qzAgain"))}</button>`;
  };
  box.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.qzCard) { b.disabled = true; try { await (await import("/extras.js")).shareScentCard(ctx, ctx.byId(b.dataset.qzCard)); } finally { b.disabled = false; } return; }
    if (b.dataset.qzA) { answers.push(b.dataset.qzA); step(); }
    else if (b.dataset.qz === "close") close();
    else if (b.dataset.qz === "back") { answers.pop(); step(); }
    else if (b.dataset.qz === "again") { answers.length = 0; step(); }
    else if (b.dataset.qzOpen) { const id = b.dataset.qzOpen; close(); setTimeout(() => ctx.openDetail(id), 260); }
    else if (b.dataset.qzAdd) { ctx.change(b.dataset.qzAdd, 1); close(); }
  });
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  step();
}

// ---------- compare ----------
let cmp = null;
export function renderCompare(ctx, root) {
  const { I, esc, products, fmt } = ctx, t = I.t;
  if (!cmp || !ctx.byId(cmp[0]) || !ctx.byId(cmp[1])) cmp = [products[0].id, (products[1] || products[0]).id];
  const opts = (sel) => products.map((p) => `<option value="${esc(p.id)}"${p.id === sel ? " selected" : ""}>${esc(p.name)}</option>`).join("");
  const A = ctx.byId(cmp[0]), B = ctx.byId(cmp[1]);
  const bars = (n) => `<span class="cmp-bars" aria-label="${n}/5">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= n ? "on" : ""}"></i>`).join("")}</span>`;
  const label = (p, key, map) => ((p.profile && p.profile[key]) || []).slice(0, 2).map((v) => t(map[v])).join(" · ");
  const W = { day: "w_day", evening: "w_evening", special: "w_special" }, F = { fresh: "f_fresh", warm: "f_warm", dark: "f_dark" };
  const row = (name, fa, fb) => `<div class="cmp-row"><div class="cmp-label">${esc(name)}</div><div class="cmp-cell">${fa}</div><div class="cmp-cell">${fb}</div></div>`;
  const notes = (p) => `<ul class="cmp-notes">${(p.notes || []).map((n) => `<li>${esc(I.noteName(n))}</li>`).join("")}</ul>`;
  const head = (p) => `
    <div class="cmp-head">
      <button class="cmp-pic" data-open="${esc(p.id)}"><img src="${esc(p.image)}" alt="${esc(p.name)}"></button>
      <h3 data-open="${esc(p.id)}">${esc(p.name)}</h3>
      <span class="price">${fmt(p.price)}</span>
    </div>`;
  root.innerHTML = `
    <div class="cmp">
      <div class="cmp-pick">
        <label><span>${esc(t("cmpA"))}</span><select data-cmp="0">${opts(cmp[0])}</select></label>
        <label><span>${esc(t("cmpB"))}</span><select data-cmp="1">${opts(cmp[1])}</select></label>
      </div>
      <div class="cmp-grid">
        <div class="cmp-row cmp-heads">${head(A)}${head(B)}</div>
        ${row(t("cmpIntensity"), bars((A.profile || {}).intensity || 3), bars((B.profile || {}).intensity || 3))}
        ${row(t("cmpWhen"), esc(label(A, "when", W)), esc(label(B, "when", W)))}
        ${row(t("cmpFeel"), esc(label(A, "feel", F)), esc(label(B, "feel", F)))}
        ${row(t("cmpNotes"), notes(A), notes(B))}
        <div class="cmp-row cmp-adds"><button class="primary" data-add="${esc(A.id)}">${esc(t("add"))}</button><button class="primary" data-add="${esc(B.id)}">${esc(t("add"))}</button></div>
      </div>
    </div>`;
  root.querySelectorAll("select[data-cmp]").forEach((s) => s.addEventListener("change", () => {
    cmp[+s.dataset.cmp] = s.value;
    renderCompare(ctx, root);
  }));
}
