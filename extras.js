// Loaded on demand: the scent evolution timeline, the mood finder, the shareable scent card and the gift unboxing.
// app.js hands over the same small context as for features.js: { I, products, esc, fmt, byId, openDetail, change, updateLock }.
import { ART, NOTE_INFO } from "/features.js";

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// =====================================================================================================
// scent evolution: slide from the first spray to eight hours later and watch top, heart and base notes fade in and out
// =====================================================================================================
const sstep = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const CURVES = {                                   // how strongly a layer is smelled, 0..1, m = minutes after spraying
  top: (m) => Math.exp(-m / 45),
  heart: (m) => (0.18 + 0.82 * sstep(m / 70)) * Math.exp(-Math.max(0, m - 170) / 190),
  base: (m) => (0.1 + 0.9 * sstep(m / 220)) * (1 - 0.12 * sstep((m - 360) / 120)),
};
const minutesAt = (s) => 480 * (s / 100) ** 2;   // the slider is stretched at the start, where most of the change happens

export function tiersOf(notes) {
  const n = notes.length, nt = n >= 5 ? 2 : 1, nb = n >= 5 ? 2 : 1;
  return { top: notes.slice(0, nt), heart: notes.slice(nt, Math.max(nt, n - nb)), base: notes.slice(Math.max(nt, n - nb)) };
}

export function mountEvolution(ctx, host, p) {
  const { I, esc } = ctx, t = I.t;
  const body = host.querySelector(".evo-body");
  if (!body || !(p.notes || []).length) return;
  const tr = tiersOf(p.notes);
  let uid = 0;
  const icon = (n) => {
    const info = NOTE_INFO[n] || ["aromatic", "#d9b96a"], k = ++uid;
    const svg = ART[info[0]]().replace(/id="rg"/g, `id="rg${k}"`).replace(/url\(#rg\)/g, `url(#rg${k})`);
    return `<div class="evo-note" style="--nc:${info[1]}"><svg class="evo-ico" viewBox="0 0 120 120" aria-hidden="true">${svg}</svg><span>${esc(I.noteName(n))}</span></div>`;
  };
  const tier = (k, a, b) => tr[k].length
    ? `<div class="evo-tier" data-tier="${k}"><div class="evo-tl"><b>${esc(t(a))}</b><em>${esc(t(b))}</em></div><div class="evo-notes">${tr[k].map(icon).join("")}</div><i class="evo-bar"><b></b></i></div>` : "";
  const mark = (m, label) => `<span style="inset-inline-start:${(Math.sqrt(m / 480) * 100).toFixed(1)}%">${esc(label)}</span>`;
  body.innerHTML = `
    <p class="evo-sub">${esc(t("evoSub"))}</p>
    <div class="evo-time"><strong data-evo-time>${esc(t("evoNow"))}</strong><button class="evo-play" data-evo-play aria-label="${esc(t("evoPlay"))}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path class="ico-play" d="M8 5v14l11-7z"/><path class="ico-pause" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg></button></div>
    <input class="evo-range" type="range" min="0" max="100" step="0.1" value="0" aria-label="${esc(t("evoSlider"))}">
    <div class="evo-scale" aria-hidden="true">${mark(0, t("evoNow"))}${mark(60, t("evoHr", { n: 1 }))}${mark(180, t("evoHr", { n: 3 }))}${mark(480, t("evoHr", { n: 8 }))}</div>
    <div class="evo-tiers">${tier("top", "evoTop", "evoTopWhen")}${tier("heart", "evoHeart", "evoHeartWhen")}${tier("base", "evoBase", "evoBaseWhen")}</div>`;
  const range = body.querySelector(".evo-range"), timeEl = body.querySelector("[data-evo-time]"), play = body.querySelector("[data-evo-play]");
  const rows = [...body.querySelectorAll(".evo-tier")];
  const label = (m) => {
    if (m < 2) return t("evoNow");
    if (m < 60) return t("evoMin", { n: Math.round(m < 15 ? m : m / 5) * (m < 15 ? 1 : 5) });
    return t("evoHr", { n: Math.round(m / 30) / 2 });
  };
  const apply = (s) => {
    const m = minutesAt(s);
    timeEl.textContent = label(m);
    rows.forEach((r) => {
      const v = CURVES[r.dataset.tier](m);
      r.style.setProperty("--k", v.toFixed(3));
      r.classList.toggle("faint", v < 0.12);
    });
  };
  let raf = 0;
  const stop = () => { cancelAnimationFrame(raf); raf = 0; play.classList.remove("on"); };
  range.addEventListener("input", () => { stop(); apply(+range.value); });
  play.addEventListener("click", () => {
    if (raf) { stop(); return; }
    if (+range.value >= 99) { range.value = 0; apply(0); }
    play.classList.add("on");
    const from = +range.value, t0 = performance.now(), D = 11000 * (1 - from / 100) + 800;
    const step = (now) => {
      if (!host.isConnected) return;
      const u = clamp01((now - t0) / D), s = from + (100 - from) * u;
      range.value = s; apply(s);
      if (u < 1) raf = requestAnimationFrame(step); else stop();
    };
    raf = requestAnimationFrame(step);
  });
  apply(0);
}

// =====================================================================================================
// mood finder: describe a feeling, a place or a memory; the shop answers with a perfume
// =====================================================================================================
// Words (word starts, any of the 8 languages; Arabic and Chinese match anywhere) -> what the person is after.
const CONCEPTS = [
  { w: "evening night nacht abend soir nuit noite noche notte sera tarde party fest feier soiree festa fiesta fête date romant love liebe amour amor amore cocktail dinner cena dîner club dance tanz danse baile ballo ليل مساء سهر حب رومانس عشاء حفلة 夜 晚 约会 派对 浪漫 爱 晚餐 舞", v: { when: ["evening"], feel: ["warm", "dark"] } },
  { w: "day morning morgen matin manha manhã mañana mattina office work arbeit büro travail trabalho trabajo lavoro bureau spring frühling printemps primavera summer sommer été verão verano estate sun sonne soleil sol sole beach strand plage praia playa spiaggia sea meer mer mar mare ocean ozean océan oceano breeze brise fresh frisch frais fresco fraîche clean sauber propre limpio pulito light leicht léger ligero leggero citrus zitrus citron limón limone travel reise voyage viagem viaje viaggio walk spazier promenade paseo passeggiata صباح يوم عمل صيف ربيع شمس بحر شاطئ منعش نسيم خفيف 白天 早晨 早上 工作 春 夏 阳光 海 沙滩 清新 清爽 轻盈 旅行 散步", v: { when: ["day"], feel: ["fresh"], power: ["soft", "medium"] } },
  { w: "special wedding hochzeit mariage casamento boda matrimonio gala celebration feier célébration celebração celebración anniversary jubiläum anniversaire aniversário aniversario anniversario christmas weihnacht noël natal navidad natale luxury luxus luxe lujo lusso elegan royal queen königin reine rainha reina regina gift geschenk cadeau presente regalo prestige diamond gold or ouro oro مناسبة زفاف عرس فخامة أنيق ملكي هدية عيد 婚礼 婚 庆典 纪念 圣诞 奢华 优雅 皇家 礼物 金", v: { when: ["special"], power: ["medium", "bold"] } },
  { w: "cozy gemütlich douillet aconchegante acogedor accogliente winter hiver inverno invierno inverno fireplace kamin cheminée lareira chimenea camino snow schnee neige neve nieve blanket decke couverture cobertor manta coperta autumn herbst automne outono otoño autunno warm warm chaud quente cálido caldo vanilla vanille baunilha vainilla vaniglia sweet süß sucré doce dulce dolce comfort trost confort home zuhause maison casa grandmother oma grand-mère avó abuela nonna cuddle kuscheln câlin tea tee thé chá té tè دافئ شتاء خريف فانيلا حلو جدة منزل مريح 温暖 冬 秋 壁炉 雪 香草 甜 奶奶 外婆 家 舒适 茶", v: { feel: ["warm"], power: ["soft", "medium"] } },
  { w: "mystery mystère misterio mistero mysteri dark dunkel sombre escuro oscuro scuro forest wald forêt floresta bosque foresta smoke rauch fumée fumaça humo fumo rain regen pluie chuva lluvia pioggia storm sturm tempête tempestade tormenta tempesta gothic goth leather leder cuir couro cuero pelle secret geheim secret segredo secreto segreto midnight mitternacht minuit meia-noite medianoche mezzanotte black schwarz noir preto negro nero shadow schatten ombre sombra ombra gloom غموض غامق ظلام غابة دخان مطر عاصفة سري سواد 神秘 黑 暗 森林 烟 雨 风暴 皮革 秘密 午夜 阴影", v: { feel: ["dark"], when: ["evening"] } },
  { w: "bold strong stark fort forte fuerte intens power macht puissan poder potente potenza confident selbstbewusst confiant confiante sicuro leader chef líder fire feuer feu fogo fuego passion leidenschaft paixão pasión passione red rot rouge vermelho rojo rosso sexy sensual wild قوي جريء ثقة شغف نار أحمر جذاب 强烈 大胆 自信 力量 火 热情 红 性感 狂野", v: { power: ["bold"], feel: ["warm", "dark"] } },
  { w: "soft sanft doux doce suave morbido gentle zart délicat delicado delicato subtle dezent subtil sutil sottile calm ruhig calme calmo tranquil quiet leise silencieux silencioso peace frieden paix paz pace spa innocent unschuld innocent inocente innocente pure rein pur puro white weiß blanc branco blanco bianco cloud wolke nuage nuvem nube nuvola lullaby ناعم هادئ هدوء سلام نقي أبيض سحاب 柔和 温柔 安静 平静 宁静 纯 白 云 淡雅", v: { power: ["soft"], feel: ["fresh", "warm"] } },
  { w: "flower blume fleur flor fiore blossom blüte rose roses jasmin jasmine orchid orchidee orchidée orquídea garden garten jardin jardim jardín giardino meadow wiese prairie prado prato bouquet بستان زهر ورد وردة ياسمين حديقة أوركيد 花 玫瑰 茉莉 兰 花园 花束", v: { when: ["day", "special"], feel: ["fresh", "warm"] } },
];
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const CJKAR = /[؀-ۿ一-鿿]/;
const CONCEPT_TERMS = CONCEPTS.map((c) => ({ v: c.v, terms: [...new Set(c.w.split(/\s+/).map(norm).filter(Boolean))] }));

export function moodMatch(text, products) {
  const q = norm(text), tokens = q.split(/[^a-z؀-ۿ一-鿿]+/).filter(Boolean);
  const votes = {};
  let hits = 0;
  CONCEPT_TERMS.forEach((c) => {
    const hit = c.terms.some((term) => (CJKAR.test(term) ? q.includes(term) : term.length >= 3 && tokens.some((tk) => tk.startsWith(term))));
    if (!hit) return;
    hits++;
    Object.entries(c.v).forEach(([attr, vals]) => vals.forEach((val) => { votes[attr + ":" + val] = (votes[attr + ":" + val] || 0) + 1; }));
  });
  if (!hits) return null;
  const score = (p) => Object.entries(votes).reduce((s, [key, n]) => {
    const [attr, val] = key.split(":");
    const k = ((p.profile && p.profile[attr]) || []).indexOf(val);
    return s + n * (k === 0 ? 2 : k === 1 ? 1 : 0);
  }, 0);
  const ranked = products.map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s || (a.p.rank || 9) - (b.p.rank || 9));
  return ranked.length && ranked[0].s > 0 ? ranked[0].p : null;
}

async function askModel(text, lang) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch("/api/mood", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang }), signal: ctl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.id ? data : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

export function openMood(ctx) {
  const { I, esc, products, fmt } = ctx, t = I.t;
  const wrap = document.createElement("div");
  wrap.className = "qz-back";
  wrap.innerHTML = `<div class="qz" role="dialog" aria-modal="true" aria-label="${esc(t("moodTitle"))}"></div>`;
  document.body.appendChild(wrap);
  document.body.style.overflow = "hidden";
  const box = wrap.firstElementChild;
  const close = () => { wrap.classList.add("out"); setTimeout(() => wrap.remove(), 350); document.removeEventListener("keydown", onKey); ctx.updateLock(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  let last = "";

  const form = (msg) => {
    box.innerHTML = `
      <button class="qz-x" data-md="close" aria-label="${esc(t("qzClose"))}">✕</button>
      <p class="qz-step">${esc(t("moodKicker"))}</p>
      <h2 class="qz-q">${esc(t("moodTitle"))}</h2>
      <textarea class="md-text" rows="3" maxlength="200" placeholder="${esc(t("moodPh"))}" aria-label="${esc(t("moodTitle"))}">${esc(last)}</textarea>
      ${msg ? `<p class="md-msg">${esc(msg)}</p>` : ""}
      <div class="md-ex">${[1, 2, 3, 4].map((k) => `<button data-md-ex="${k}">${esc(t("moodEx" + k))}</button>`).join("")}</div>
      <button class="qz-main" data-md="go">${esc(t("moodGo"))}</button>`;
    const ta = box.querySelector("textarea");
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } });
    setTimeout(() => ta.focus({ preventScroll: true }), 80);
  };
  const go = async () => {
    const text = box.querySelector("textarea").value.trim();
    last = text;
    if (text.length < 3) { form(t("moodTry")); return; }
    box.innerHTML = `<p class="qz-step">${esc(t("moodKicker"))}</p><div class="md-wait"><span></span><span></span><span></span></div><p class="md-wait-t">${esc(t("moodWait"))}</p>`;
    const started = performance.now();
    const ai = await askModel(text, I.lang);
    let pick = ai && ctx.byId(ai.id) && !ctx.byId(ai.id).kind ? ctx.byId(ai.id) : null, why = pick ? String(ai.reason || "").slice(0, 280) : "";
    if (!pick) { pick = moodMatch(text, products); why = ""; }
    const left = 1100 - (performance.now() - started);           // a short pause, so the answer feels considered
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    if (!wrap.isConnected) return;
    if (!pick) { form(t("moodTry")); return; }
    result(pick, why);
  };
  const result = (best, why) => {
    box.innerHTML = `
      <button class="qz-x" data-md="close" aria-label="${esc(t("qzClose"))}">✕</button>
      <p class="qz-step">${esc(t("qzMatch"))}</p>
      <div class="qz-res">
        <img src="${esc(best.image)}" alt="${esc(best.name)}">
        <h2>${esc(best.name)}</h2>
        ${why ? `<p class="md-why">${esc(why)}</p>` : `<p class="md-why">${esc(I.desc(best.id) || best.description)}</p>`}
        <p class="qz-price">${fmt(best.price)}</p>
        <button class="qz-main" data-md-open="${esc(best.id)}">${esc(t("qzDiscover"))}</button>
        <button class="qz-sec" data-md-add="${esc(best.id)}">${esc(t("add"))}</button>
        <button class="qz-sec" data-md-card="${esc(best.id)}">${esc(t("scardBtn"))}</button>
      </div>
      <button class="qz-back-btn" data-md="again">${esc(t("qzAgain"))}</button>`;
  };
  box.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.md === "close") close();
    else if (b.dataset.md === "go") go();
    else if (b.dataset.md === "again") form();
    else if (b.dataset.mdEx) { box.querySelector("textarea").value = t("moodEx" + b.dataset.mdEx); box.querySelector("textarea").focus({ preventScroll: true }); }
    else if (b.dataset.mdOpen) { const id = b.dataset.mdOpen; close(); setTimeout(() => ctx.openDetail(id), 260); }
    else if (b.dataset.mdAdd) { ctx.change(b.dataset.mdAdd, 1); close(); }
    else if (b.dataset.mdCard) { b.disabled = true; await shareScentCard(ctx, ctx.byId(b.dataset.mdCard)); b.disabled = false; }
  });
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  form();
}

// =====================================================================================================
// shareable scent card: a 1080 x 1920 picture for stories and chats, drawn on a canvas
// =====================================================================================================
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function spaced(c, text, x, y, sp) {                     // centred, letter-spaced text (Arabic must stay joined: no spacing)
  if (!sp) { c.textAlign = "center"; c.fillText(text, x, y); return; }
  const chars = [...text], w = chars.reduce((s, ch) => s + c.measureText(ch).width + sp, 0) - sp;
  let cx = x - w / 2;
  c.textAlign = "left";
  chars.forEach((ch) => { c.fillText(ch, cx, y); cx += c.measureText(ch).width + sp; });
}
function fitFont(c, text, weight, size, family, maxW) {
  let s = size;
  c.font = `${weight} ${s}px ${family}`;
  while (c.measureText(text).width > maxW && s > 40) { s -= 4; c.font = `${weight} ${s}px ${family}`; }
  return s;
}

export async function makeScentCard(ctx, p) {
  const { I } = ctx, t = I.t, W = 1080, H = 1920, ar = I.lang === "ar";
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  const th = p.theme || {};
  const serif = '"Cormorant Garamond", "Times New Roman", Georgia, serif';
  const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  try { await Promise.race([document.fonts.load('600 100px "Cormorant Garamond"'), new Promise((r) => setTimeout(r, 900))]); } catch { /* fallback font */ }
  const [img, logo] = await Promise.all([loadImg(p.image), loadImg("/logo.svg").catch(() => null)]);
  // background: the perfume's own colours
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.bgDark || "#14100a"); g.addColorStop(0.55, "#0c0a07"); g.addColorStop(1, "#050403");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const rg = c.createRadialGradient(W / 2, 900, 80, W / 2, 900, 900);
  rg.addColorStop(0, (th.glow || "#c9a25a") + "55"); rg.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = rg; c.fillRect(0, 0, W, H);
  c.direction = ar ? "rtl" : "ltr";
  // logo in gold
  if (logo) {
    const lh = 150, lw = lh * (logo.naturalWidth / logo.naturalHeight || 0.4);
    const oc = document.createElement("canvas"); oc.width = Math.ceil(lw); oc.height = lh;
    const o = oc.getContext("2d"); o.drawImage(logo, 0, 0, lw, lh); o.globalCompositeOperation = "source-in"; o.fillStyle = "#d9b96a"; o.fillRect(0, 0, lw, lh);
    c.drawImage(oc, (W - lw) / 2, 84);
  }
  c.fillStyle = "#d9b96a"; c.textBaseline = "alphabetic";
  c.font = `500 34px ${sans}`;
  spaced(c, (ar ? t("scardTitle") : t("scardTitle").toLocaleUpperCase(I.lang)), W / 2, 330, ar ? 0 : 9);
  // the picture, framed
  const x = 90, y = 380, w = 900, h = 1200, r = 26;
  c.save();
  c.beginPath(); c.roundRect(x, y, w, h, r); c.clip();
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  c.drawImage(img, x + (w - img.naturalWidth * k) / 2, y + (h - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
  c.restore();
  c.lineWidth = 3; c.strokeStyle = "rgba(217,185,106,.75)"; c.beginPath(); c.roundRect(x, y, w, h, r); c.stroke();
  // name, notes, address
  c.fillStyle = "#f6ecd2";
  fitFont(c, p.name, 600, 138, serif, 900);
  spaced(c, p.name, W / 2, 1730, 0);
  c.fillStyle = "#cdbd93";
  const raw = (p.notes || []).slice(0, 4).map((n) => I.noteName(n)).join("  ·  ");
  const notes = ar ? raw : raw.toLocaleUpperCase(I.lang), nsp = ar ? 0 : 3;
  let ns = 32; c.font = `500 ${ns}px ${sans}`;
  while (ns > 18 && c.measureText(notes).width + notes.length * nsp > 900) { ns -= 2; c.font = `500 ${ns}px ${sans}`; }
  spaced(c, notes, W / 2, 1796, nsp);
  c.fillStyle = "rgba(217,185,106,.7)"; c.font = `400 30px ${sans}`;
  spaced(c, location.host, W / 2, 1866, 0);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
}

export async function shareScentCard(ctx, p) {
  const { I } = ctx;
  let blob;
  try { blob = await makeScentCard(ctx, p); } catch (e) { console.error("scent card failed", e); return "fail"; }
  const file = new File([blob], `laniko-${p.id}.png`, { type: "image/png" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: I.t("scardTitle"), text: `${p.name} · Laniko` });
      return "shared";
    }
  } catch (e) { if (e && e.name === "AbortError") return "cancel"; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return "saved";
}

// =====================================================================================================
// gift: a link that opens an animated gift box with a personal message (no server needed: it is all in the link)
// =====================================================================================================
export const WRAPS = ["ivory", "noir", "rouge"];
export const giftEncode = (g) => btoa(unescape(encodeURIComponent(JSON.stringify(g)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function giftDecode(s) {
  try {
    const g = JSON.parse(decodeURIComponent(escape(atob(String(s).replace(/-/g, "+").replace(/_/g, "/")))));
    return g && Array.isArray(g.i) ? g : null;
  } catch { return null; }
}
export const giftLink = (g) => location.origin + "/#/gift/" + giftEncode(g);

export function openGift(ctx, g, { preview = false, onClose } = {}) {
  const { I, esc, byId } = ctx, t = I.t;
  const items = (g.i || []).map(byId).filter(Boolean).slice(0, 5);
  const wrap = WRAPS.includes(g.w) ? g.w : "ivory";
  const el = document.createElement("div");
  el.className = "gf wrap-" + wrap;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
  // gold dust: a few tiny specks that drift upwards, slowly, once the box is open
  const dust = Array.from({ length: 16 }, () => `<i class="gf-sp" style="--x:${(Math.random() * 190 - 95).toFixed(0)}px;--h:${(120 + Math.random() * 150).toFixed(0)}px;--s:${(0.5 + Math.random() * 0.9).toFixed(2)};--w:${(1.4 + Math.random() * 3.2).toFixed(2)}s;--t:${(3.6 + Math.random() * 3).toFixed(1)}s"></i>`).join("");
  const msg = (g.m || "").trim(), from = (g.f || "").trim();
  const GOLD = '<linearGradient id="gfg" x1="0" x2="1"><stop offset="0" stop-color="#9c7630"/><stop offset=".5" stop-color="#f3dd9b"/><stop offset="1" stop-color="#9c7630"/></linearGradient>';
  const SHADE = '<linearGradient id="gfs" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>';
  const ORN = '<svg class="gf-orn" viewBox="0 0 120 14" aria-hidden="true"><path d="M0 7H48M72 7H120"/><path d="M60 1.5 63.5 7 60 12.5 56.5 7Z"/></svg>';
  el.innerHTML = `
    <button class="gf-x" aria-label="${esc(t("qzClose"))}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    <img class="gf-logo" src="/logo.svg" alt="" width="14" height="36">
    <p class="gf-kicker"><span>${esc(preview ? t("giftPreview") : t("giftForYou"))}</span></p>
    <button class="gf-stage" aria-label="${esc(t("giftOpen"))}">
      <span class="gf-floor"></span>
      <span class="gf-beam"></span>
      <span class="gf-items">${items.map((p, i) => `<span class="gf-item" style="--i:${i};--n:${items.length}"><img src="${esc(p.image)}" alt="${esc(p.name)}"></span>`).join("")}</span>
      <span class="gf-box">
        <svg class="gf-body" viewBox="0 0 220 120" aria-hidden="true"><defs>${GOLD}${SHADE}</defs>
          <rect x="10" y="0" width="200" height="120" rx="3" style="fill:var(--bx)"/><rect x="10" y="0" width="200" height="120" rx="3" fill="url(#gfs)"/>
          <rect x="10" y="0" width="200" height="9" fill="#000" opacity=".28"/>
          <rect x="99" y="0" width="22" height="120" fill="url(#gfg)"/><rect x="99" y="0" width="22" height="120" fill="none" stroke="#6e5220" stroke-opacity=".5" stroke-width=".6"/>
          <rect x="10.5" y=".5" width="199" height="119" rx="3" fill="none" stroke="#d9b96a" stroke-opacity=".4"/>
        </svg>
        <svg class="gf-lid" viewBox="0 0 240 96" aria-hidden="true"><defs>${GOLD}${SHADE}</defs>
          <rect x="4" y="46" width="232" height="42" rx="3" style="fill:var(--bx2)"/><rect x="4" y="46" width="232" height="42" rx="3" fill="url(#gfs)"/>
          <rect x="4" y="82" width="232" height="6" fill="#000" opacity=".22"/>
          <rect x="108" y="46" width="24" height="42" fill="url(#gfg)"/><rect x="108" y="46" width="24" height="42" fill="none" stroke="#6e5220" stroke-opacity=".5" stroke-width=".6"/>
          <rect x="4.5" y="46.5" width="231" height="41" rx="3" fill="none" stroke="#d9b96a" stroke-opacity=".5"/>
          <g class="gf-bow">
            <path d="M120 48 C96 22 58 14 56 32 C54 46 92 54 120 48Z" fill="url(#gfg)" stroke="#6e5220" stroke-opacity=".55" stroke-width=".8"/>
            <path d="M120 48 C144 22 182 14 184 32 C186 46 148 54 120 48Z" fill="url(#gfg)" stroke="#6e5220" stroke-opacity=".55" stroke-width=".8"/>
            <path d="M118 49 C100 56 90 74 84 92 L98 86 L106 94 L120 54Z" fill="url(#gfg)" stroke="#6e5220" stroke-opacity=".55" stroke-width=".8"/>
            <path d="M122 49 C140 56 150 74 156 92 L142 86 L134 94 L120 54Z" fill="url(#gfg)" stroke="#6e5220" stroke-opacity=".55" stroke-width=".8"/>
            <ellipse cx="120" cy="48" rx="9" ry="8" fill="url(#gfg)" stroke="#6e5220" stroke-opacity=".6" stroke-width=".8"/>
          </g>
        </svg>
      </span>
      <span class="gf-sparks">${dust}</span>
    </button>
    <div class="gf-foot">
    <p class="gf-hint">${esc(t("giftOpen"))}</p>
    <div class="gf-card">
      ${msg ? `<p class="gf-msg">${esc(msg)}</p>${ORN}` : ""}
      ${from ? `<p class="gf-from">${esc(t("giftFromLine", { name: from }))}</p>` : ""}
      ${items.length ? `<p class="gf-names">${items.map((p) => esc(p.name)).join(" · ")}</p>` : ""}
      <button class="qz-main gf-cta">${esc(preview ? t("qzClose") : t("giftDiscover"))}</button>
    </div>
    </div>`;
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 400); document.removeEventListener("keydown", onKey); ctx.updateLock(); if (onClose) onClose(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    el.classList.add("open");
    setTimeout(() => el.classList.add("shown"), reduce ? 0 : 3000);
    try { if (navigator.vibrate) navigator.vibrate([12, 40, 20]); } catch { /* not supported */ }
  };
  el.querySelector(".gf-stage").addEventListener("click", open);
  el.querySelector(".gf-x").addEventListener("click", close);
  el.querySelector(".gf-cta").addEventListener("click", close);
  return { close, open };
}
