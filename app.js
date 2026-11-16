(() => {
  const CART_KEY = "shop-cart-v1";
  const WISH_KEY = "shop-wishlist-v1";
  const PROMO_KEY = "laniko-promo-seen";
  const I = window.I18N;
  const t = I.t;
  const fmt = (n) => I.fmtMoney(n);
  const $ = (id) => document.getElementById(id);

  const loadJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  };
  const saveJSON = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  let products = [], sets = [];     // sets: the Discovery Set (not a perfume: no page, no quiz)
  let cart = loadJSON(CART_KEY, {}); // { [productId]: quantity }
  let wish = loadJSON(WISH_KEY, []); // [productId, ...]
  const byId = (id) => products.find((p) => p.id === id) || sets.find((p) => p.id === id);
  const nameOf = (p) => (p.kind === "set" ? t("setName") : p.name);
  const descOf = (p) => I.desc(p.id) || p.description;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Retry a failed image once (covers a deploy that was still finishing)
  function watchImages(root) {
    root.querySelectorAll("img").forEach((img) => {
      img.addEventListener("error", () => {
        if (img.dataset.retry) return;
        img.dataset.retry = "1";
        setTimeout(() => {
          img.src = img.src.split("&r=")[0] + (img.src.includes("?") ? "&" : "?") + "r=" + Date.now();
        }, 1500);
      });
    });
  }

  // ---- toast (optionally with one action button, e.g. "View cart" or "Undo") ----
  let toastTimer;
  function toast(msg, action) {
    const el = $("toast");
    el.textContent = "";
    const span = document.createElement("span"); span.textContent = msg; el.appendChild(span);
    if (action) {
      const b = document.createElement("button");
      b.className = "toast-act"; b.textContent = action.label;
      b.addEventListener("click", () => { el.hidden = true; clearTimeout(toastTimer); action.fn(); });
      el.appendChild(b);
    }
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, action ? 4600 : 1800);
  }
  const addedToast = () => toast(t("addedToCart"), { label: t("viewCart"), fn: () => { $("cart").hidden = false; } });

  // features that are loaded only when needed
  const featureCtx = () => ({ I, esc, products, fmt, byId, openDetail, change, updateLock });
  const loadFeatures = () => import("/features.js");
  const loadExtras = () => import("/extras.js");

  // ---- pages: the home page is the plain address (/); the others are #/top-sellers and #/wishlist ----
  const ROUTES = {
    "perfumes": { title: "collectionTitle", sub: "collectionSub", list: () => products, empty: "emptyPerfumes" },
    "top-sellers": { title: "topTitle", sub: "topSub", list: () => products.filter((p) => p.rank).sort((a, b) => a.rank - b.rank), empty: "emptyTop" },
    "wishlist": { title: "wishTitle", sub: "wishSub", list: () => wish.map(byId).filter(Boolean), empty: "emptyWish" },
    "compare": { title: "cmpTitle", sub: "cmpSub", list: () => products, empty: "emptyPerfumes", custom: true },
    "shared": { title: "sharedTitle", sub: "sharedSub", list: () => sharedIds().map(byId).filter(Boolean), empty: "emptyWish" },
  };
  const sharedIds = () => { const m = location.hash.match(/^#\/shared\/([\w,-]+)/); return m ? m[1].split(",").filter(Boolean).slice(0, 12) : []; };

  function currentRoute() {
    const m = location.hash.match(/^#\/([\w-]+)/);
    return m && ROUTES[m[1]] ? m[1] : "perfumes";
  }

  const HEART = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

  function cardHTML(p, route) {
    const liked = wish.includes(p.id);
    const rank = route === "top-sellers" && p.rank ? `<span class="rank">${p.rank}</span>` : "";
    return `
      <article class="card">
        <div class="media">
          <button class="imgbtn" data-open="${esc(p.id)}" aria-label="${esc(p.name)}">
            <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
            <span class="pic-desc">${esc(descOf(p))}</span>
          </button>
          <button class="heart${liked ? " on" : ""}" data-wish="${esc(p.id)}" aria-pressed="${liked}" aria-label="${esc(t("saveWish", { name: p.name }))}">${HEART}</button>
          ${rank}
        </div>
        <div class="body">
          <h3 data-open="${esc(p.id)}">${esc(p.name)}</h3>
          <span class="price">${fmt(p.price)}</span>
          <button class="add" data-add="${esc(p.id)}">${esc(t("add"))}</button>
        </div>
      </article>`;
  }

  function setCardHTML(s) {
    return `
      <article class="card set-card">
        <div class="media">
          <img src="${esc(s.image)}" alt="${esc(nameOf(s))}" loading="lazy">
          <span class="set-chip">${esc(t("setChip"))}</span>
        </div>
        <div class="body">
          <h3>${esc(nameOf(s))}</h3>
          <p class="set-sub">${esc(t("setSub"))}</p>
          <p class="set-credit">${esc(t("setCredit", { amount: fmt(s.credit || s.price) }))}</p>
          <span class="price">${fmt(s.price)}</span>
          <button class="add" data-add="${esc(s.id)}">${esc(t("add"))}</button>
        </div>
      </article>`;
  }

  const ICON_SHARE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 12v7h14v-7"/></svg>';
  function pageActions(route) {
    const el = $("page-actions");
    let h = "";
    if (route === "perfumes") h = `<button class="act" data-act="quiz">${esc(t("findScent"))}</button><button class="act" data-act="mood">${esc(t("moodBtn"))}</button><button class="act" data-act="compare">${esc(t("compareBtn"))}</button>`;
    else if (route === "wishlist" && wish.length) h = `<button class="act" data-act="share">${ICON_SHARE}<span>${esc(t("shareWish"))}</span></button>`;
    else if (route === "shared" && sharedIds().length) h = `<button class="act gold" data-act="saveall">${esc(t("saveAllWish"))}</button>`;
    el.className = "page-actions" + (route === "perfumes" ? " row" : "");
    el.innerHTML = h;
  }

  function renderPage() {
    const route = currentRoute();
    const cfg = ROUTES[route];
    document.querySelectorAll(".tabs a").forEach((a) => {
      if (a.dataset.route === route) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    $("page-title").textContent = t(cfg.title);
    $("page-sub").textContent = t(cfg.sub);
    if (!products.length) return;
    pageActions(route);
    if (cfg.custom) { loadFeatures().then((m) => { if (currentRoute() === route) m.renderCompare(featureCtx(), $("products")); }); return; }
    const list = cfg.list();
    if (!list.length) {
      const cta = route === "wishlist" ? `<p><a class="link-btn" href="/">${esc(t("browse"))}</a></p>` : "";
      $("products").innerHTML = `<div class="empty"><p>${esc(t(cfg.empty))}</p>${cta}</div>`;
      return;
    }
    $("products").innerHTML = list.map((p) => cardHTML(p, route)).join("") + (route === "perfumes" ? sets.map(setCardHTML).join("") : "");
    watchImages($("products"));
  }

  async function shareWishlist() {
    const url = location.origin + "/#/shared/" + wish.join(",");
    const data = { title: t("shareTitle"), text: t("shareText"), url };
    try {
      if (navigator.share) { await navigator.share(data); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); toast(t("linkCopied")); }
    catch { window.prompt(t("shareWish"), url); }
  }

  // navigation without reloading; "/" and "#/perfumes" are the same page; #/perfume/<id> is a product page
  let lastHref = location.href;
  // each list page remembers how far it was scrolled; going back (history) restores it, tapping a tab starts at the top
  let freshNav = false, curKey = /^#\/perfume\//.test(location.hash) ? "/" : (location.hash || "/"), scrollTimer = 0;
  const SCROLL_KEY = "laniko-scroll";
  let scrollMem = {};
  try { scrollMem = JSON.parse(sessionStorage.getItem(SCROLL_KEY)) || {}; } catch {}
  window.addEventListener("scroll", () => {
    if (detailId || !$("viewer").hidden) return;
    scrollMem[curKey] = window.scrollY;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify(scrollMem)); } catch {} }, 250);
  }, { passive: true });
  // a gift link (#/gift/...) opens the unboxing on top of the shop
  let giftShown = false;
  function syncGift() {
    const m = location.hash.match(/^#\/gift\/([\w-]+)/);
    if (!m || !products.length || giftShown) return;
    giftShown = true;
    loadExtras().then((x) => {
      const g = x.giftDecode(m[1]);
      if (!g) { giftShown = false; return; }
      x.openGift(featureCtx(), g, { onClose: () => { giftShown = false; history.replaceState(null, "", "/"); lastHref = location.href; renderPage(); } });
    }).catch(() => { giftShown = false; });
  }
  function onRoute() {
    if (location.href === lastHref) return;   // hashchange and popstate both fire: handle once
    lastHref = location.href;
    $("cart").hidden = true;
    syncGift();
    const wasOpen = !!detailId;
    syncDetail();
    if (!detailId) {
      renderPage();
      if (!wasOpen) {
        curKey = location.hash || "/";
        window.scrollTo(0, freshNav ? 0 : (scrollMem[curKey] || 0));
      }
    }
    freshNav = false;
  }
  function goHome() {
    freshNav = true;
    if (detailId) hideDetail();
    if (location.hash || location.pathname !== "/") history.pushState(null, "", "/");
    onRoute();
  }
  window.addEventListener("hashchange", onRoute);
  window.addEventListener("popstate", onRoute);
  // an old link with #/perfumes shows the plain address
  if (/^#\/?(perfumes)?$/.test(location.hash)) {
    history.replaceState(null, "", location.pathname + location.search);
    lastHref = location.href;
  }

  // ---- wishlist ----
  function updateWishUI() {
    const el = $("tab-wish-count");
    el.textContent = wish.length;
    el.hidden = wish.length === 0;
  }

  function toggleWish(id) {
    const i = wish.indexOf(id);
    if (i >= 0) { wish.splice(i, 1); toast(t("removedWish")); }
    else { wish.push(id); toast(t("savedWish")); }
    saveJSON(WISH_KEY, wish);
    updateWishUI();
    if (currentRoute() === "wishlist") {
      renderPage();
    } else {
      document.querySelectorAll("[data-wish]").forEach((b) => {
        const on = wish.includes(b.dataset.wish);
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
      });
    }
  }

  // ---- product page ----
  let detailId = null, detailAnim = null, detailPushed = false, detailObs = null, restorePd = true, snd = null;
  const closeNoteSheet = () => { const b = document.querySelector('#detail .ns-back'); if (b) b.remove(); };
  const detailIdFromHash = () => { const m = location.hash.match(/^#\/perfume\/([\w-]+)/); return m ? m[1] : null; };

  let flyImg = null;
  function openDetail(id, fromImg) {          // from a click: a new history entry, so the back button closes it
    if (!byId(id)) return;
    flyImg = fromImg || null;
    detailPushed = true;
    location.hash = "#/perfume/" + id;
  }
  // the card's picture grows into the product page's picture
  function flyIn() {
    const img = flyImg; flyImg = null;
    if (!img || !img.isConnected || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !img.animate) return;
    const from = img.getBoundingClientRect();
    if (from.width < 20 || from.bottom < 0 || from.top > innerHeight) return;
    const wrap = $("detail");
    wrap.classList.add("fly");
    const to = $("pd-stage").getBoundingClientRect();
    const c = document.createElement("img");
    c.src = img.currentSrc || img.src; c.alt = ""; c.className = "fly-img";
    Object.assign(c.style, { left: from.left + "px", top: from.top + "px", width: from.width + "px", height: from.height + "px" });
    document.body.appendChild(c);
    const a = c.animate([
      { left: from.left + "px", top: from.top + "px", width: from.width + "px", height: from.height + "px", borderRadius: "12px", objectPosition: "50% 50%" },
      { left: to.left + "px", top: to.top + "px", width: to.width + "px", height: to.height + "px", borderRadius: "0px", objectPosition: "50% 12%" },
    ], { duration: 640, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    const end = () => { c.remove(); wrap.classList.remove("fly"); };
    a.onfinish = () => { const f = c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: "forwards" }); f.onfinish = end; };
    a.oncancel = end;
    setTimeout(end, 1500);
  }
  function closeDetail() {
    if (!detailId) return;
    if (detailPushed) { detailPushed = false; history.back(); }
    else { history.replaceState(null, "", "/"); lastHref = location.href; hideDetail(); renderPage(); }
  }
  function syncDetail() {
    const id = detailIdFromHash();
    if (id && byId(id)) showDetail(id); else if (detailId) hideDetail();
  }

  function detailHTML(p) {
    const notes = (p.notes || []).map((n) => `<li><button class="note-chip" data-note="${esc(n)}">${esc(I.noteName(n))}</button></li>`).join("");
    const others = products.filter((o) => o.id !== p.id);
    const related = others.length ? `<section class="pd-s pd-rel"><h2>${esc(t("alsoLike"))}</h2><div class="rel-row">${others.map((o) => `<button class="rel" data-rel="${esc(o.id)}"><img src="${esc(o.image)}" alt="" loading="lazy"><span>${esc(o.name)}</span><em>${fmt(o.price)}</em></button>`).join("")}</div></section>` : "";
    const row = (k, v) => `<div><dt>${esc(t(k))}</dt><dd>${esc(v)}</dd></div>`;
    return `
      <section class="pd-s pd-intro">
        <h1>${esc(p.name)}</h1>
        <p class="pd-sub">${esc(t("pdConcVal"))} · ${esc(t("pdSizeVal"))}</p>
        <p class="pd-price">${fmt(p.price)}</p>
      </section>
      <section class="pd-s"><h2>${esc(t("pdAbout"))}</h2><p class="pd-desc">${esc(descOf(p))}</p></section>
      ${notes ? `<section class="pd-s"><h2>${esc(t("pdNotes"))}</h2><ul class="pd-notes">${notes}</ul></section>` : ""}
      ${notes ? `<section class="pd-s pd-evo" data-evo><h2>${esc(t("evoTitle"))}</h2><div class="evo-body"></div></section>` : ""}
      <section class="pd-s"><h2>${esc(t("pdDetails"))}</h2><dl class="pd-dl">
        ${row("pdConc", t("pdConcVal"))}${row("pdSize", t("pdSizeVal"))}${row("pdShip", t("pdShipVal", { price: fmt(5) }))}${row("pdPay", t("pdPayVal"))}
      </dl></section>
      ${related}
      <section class="pd-s pd-end"><img src="/logo.svg" alt="Laniko" width="18" height="44"></section>`;
  }

  function fillDetail(p) {
    $("pd-price").textContent = fmt(p.price);
    $("pd-pic").setAttribute("aria-label", t("view3d", { name: p.name }));
    $("pd-poster").alt = p.name;
    $("pd-inner").innerHTML = detailHTML(p);
    const sc = $("pd-scroll");
    // enough text to scroll through, so the animation is not over in a flick
    $("pd-inner").style.minHeight = Math.round(sc.clientHeight * 2.1) + "px";
    if (detailObs) detailObs.disconnect();
    detailObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in"); }), { root: sc, threshold: 0.12 });
    $("pd-inner").querySelectorAll(".pd-s").forEach((el) => detailObs.observe(el));
    const evo = $("pd-inner").querySelector("[data-evo]");
    if (evo) loadExtras().then((m) => { if (detailId === p.id && evo.isConnected) m.mountEvolution(featureCtx(), evo, p); }).catch(() => {});
  }

  function showDetail(id) {
    const p = byId(id);
    if (!p || detailId === id) return;
    if (detailId) hideDetail();
    detailId = id;
    const d = $("detail");
    const th = p.theme || {};
    d.style.setProperty("--v-dark", th.bgDark || "#0d0c0a");
    d.style.setProperty("--v-glow", th.glow || "#8a6a2f");
    d.hidden = false;
    document.body.style.overflow = "hidden";
    $("pd-scroll").scrollTop = 0;
    $("pd-stage").style.setProperty("--p", "0");
    const poster = $("pd-poster");
    poster.style.opacity = "1";
    poster.onerror = () => { poster.onerror = null; poster.src = p.image; };
    poster.src = `/images/seq/${p.id}/00.webp`;
    fillDetail(p);
    updateSndBtn();
    flyIn();
    requestAnimationFrame(() => d.classList.add("on"));
    if (restorePd) {                                   // after a reload: back to where the visitor was reading
      restorePd = false;
      try { const y = +sessionStorage.getItem("laniko-pd-" + id); if (y > 0) $("pd-scroll").scrollTop = y; } catch {}
    }
    if (p.model) fetch(p.model).catch(() => {});          // the 3D model is fetched while the customer reads
    import("/detail-anim.js").then((m) => m.createScrollAnimation({
      stage: $("pd-stage"), canvas: $("pd-canvas"), mist: $("pd-mist"), poster, scroller: $("pd-scroll"),
      base: `/images/seq/${p.id}`, reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      hooks: { onCap: () => snd && snd.cap(), onSpray: (a, pw) => snd && snd.spray(a, pw) },
    })).then((a) => { if (detailId !== id) { if (a) a.dispose(); return; } detailAnim = a; }).catch((e) => console.warn("scroll animation unavailable", e));
  }
  let pdSaveTimer = 0;
  $("pd-scroll").addEventListener("scroll", () => {
    if (!detailId) return;
    clearTimeout(pdSaveTimer);
    pdSaveTimer = setTimeout(() => { try { sessionStorage.setItem("laniko-pd-" + detailId, String($("pd-scroll").scrollTop)); } catch {} }, 250);
  }, { passive: true });
  function hideDetail() {
    if (!detailId) return;
    try { sessionStorage.setItem("laniko-pd-" + detailId, String($("pd-scroll").scrollTop)); } catch {}
    detailId = null;
    closeNoteSheet();
    if (detailAnim) { detailAnim.dispose(); detailAnim = null; }
    if (detailObs) { detailObs.disconnect(); detailObs = null; }
    const d = $("detail");
    d.classList.remove("on");
    d.hidden = true;
    const c = $("pd-canvas"), m = $("pd-mist");
    c.getContext("2d").clearRect(0, 0, c.width, c.height); m.getContext("2d").clearRect(0, 0, m.width, m.height);
    $("pd-inner").innerHTML = "";
    updateLock();
  }
  // ---- sound and haptics (off until the visitor turns them on) ----
  const soundWanted = () => { try { return localStorage.getItem("laniko-sound") === "1"; } catch { return false; } };
  function updateSndBtn() {
    const on = soundWanted();
    const b = $("snd-btn");
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", t(on ? "soundOnAria" : "soundOffAria"));
    b.classList.toggle("on", on);
    if (on && !snd) import("/sound.js").then((m) => { snd = m; }).catch(() => {});
  }
  async function toggleSound() {
    try {
      const m = await import("/sound.js");
      snd = m;
      m.setEnabled(!m.isEnabled());
    } catch (e) { console.warn("sound unavailable", e); }
    updateSndBtn();
  }

  // the page behind must not scroll while a window is open
  function updateLock() {
    document.body.style.overflow = (detailId || !$("viewer").hidden || gate || promo) ? "hidden" : "";
  }

  // ---- 3D viewer ----
  let viewer = null;
  let viewerProductId = null;

  async function openViewer(id) {
    const p = byId(id);
    if (!p) return;
    enableTilt();
    enableShake();
    viewerProductId = id;
    $("viewer-title").textContent = p.name;
    $("viewer-price").textContent = fmt(p.price);
    $("viewer-hint").textContent = t("viewerHint") + (window.matchMedia("(pointer: coarse)").matches && "DeviceMotionEvent" in window ? " · " + t("shakeHint") : "");
    $("viewer-ar").hidden = true;
    const stage = $("viewer-stage");
    stage.innerHTML = "";
    // the description appears under the bottle, word by word (new elements, so the animation restarts on every open)
    const desc = $("viewer-desc");
    desc.classList.remove("zoomed");
    const joiner = I.lang === "zh" ? "" : " ";
    desc.innerHTML = '<span class="vd-rule"></span><p>' +
      I.splitWords(descOf(p)).map((w, i) => `<span class="vd-w" style="--i:${i}">${esc(w)}</span>`).join(joiner) + "</p>";
    // the themed background is plain CSS, so it is on screen in the very first frame
    const th = p.theme || {};
    const v = $("viewer");
    v.style.setProperty("--v-dark", th.bgDark || "#0d0c0a");
    v.style.setProperty("--v-glow", th.glow || "#8a6a2f");
    v.style.setProperty("--v-smoke", th.smoke || "#d9b96a");
    v.hidden = false;
    document.body.style.overflow = "hidden";
    try {
      const mod = await import("/viewer.js");
      if (viewerProductId !== id || $("viewer").hidden) return; // closed meanwhile
      viewer = mod.createBottleViewer(stage, p);
      stage.addEventListener("vp-zoom", (e) => desc.classList.toggle("zoomed", e.detail > 1.15));
      stage.addEventListener("vp-cap", () => { if (snd) snd.cap(); });
      stage.addEventListener("vp-spray", (e) => { if (snd) snd.spray(e.detail.amount, e.detail.power); });
      if (soundWanted() && !snd) import("/sound.js").then((m) => { snd = m; }).catch(() => {});
      setupAR(p);
    } catch (e) {
      console.error("3D viewer failed", e);
      stage.innerHTML = `<img src="${esc(p.image)}" alt="${esc(p.name)}">`;
      $("viewer-hint").textContent = t("viewerFail");
    }
  }

  function closeViewer() {
    disableTilt();
    disableShake();
    teardownAR();
    if (viewer) { viewer.dispose(); viewer = null; }
    viewerProductId = null;
    $("viewer").hidden = true;
    $("viewer-stage").innerHTML = "";
    $("viewer-desc").innerHTML = "";
    updateLock();
  }

  // ---- cart ----
  function renderCart() {
    // Drop items that no longer exist in the catalog (only once the catalog is known)
    if (products.length) Object.keys(cart).forEach((id) => { if (!byId(id)) delete cart[id]; });
    const ids = Object.keys(cart).filter((id) => byId(id));
    const count = ids.reduce((s, id) => s + cart[id], 0);
    const subtotal = ids.reduce((s, id) => s + byId(id).price * cart[id], 0);
    $("cart-count").textContent = count;
    $("cart-subtotal").textContent = fmt(subtotal);
    $("checkout-btn").disabled = count === 0;
    $("cart-items").innerHTML = ids.length
      ? ids.map((id) => {
          const p = byId(id);
          return `
          <div class="line">
            <img src="${esc(p.image)}" alt="">
            <div class="info"><strong>${esc(nameOf(p))}</strong><br>${fmt(p.price)}</div>
            <div class="qty">
              <button data-dec="${esc(id)}" aria-label="${esc(t("less"))}">−</button>
              <span>${cart[id]}</span>
              <button data-inc="${esc(id)}" aria-label="${esc(t("more"))}">+</button>
            </div>
            <button class="trash" data-del="${esc(id)}" aria-label="${esc(t("removeItem"))}" title="${esc(t("removeItem"))}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button>
          </div>`;
        }).join("")
      : `<p class='small'>${esc(t("cartEmpty"))}</p>`;
    watchImages($("cart-items"));
    syncGiftUI();
    if (products.length) saveJSON(CART_KEY, cart);
  }

  // ---- gift: wrapping and message are sent with the order; the buyer gets a link that opens an animated gift box ----
  const GIFT_KEY = "laniko-gift", GIFT_LAST = "laniko-gift-last";
  let gift = Object.assign({ on: false, from: "", msg: "", wrap: "ivory" }, loadJSON(GIFT_KEY, {}));
  const giftData = () => ({
    i: Object.keys(cart).filter((id) => byId(id)).slice(0, 5),
    f: gift.from.trim().slice(0, 40), m: gift.msg.trim().slice(0, 240), w: gift.wrap, l: I.lang,
  });
  function syncGiftUI() {
    const box = $("gift");
    box.hidden = !Object.keys(cart).some((id) => byId(id));
    $("gift-on").checked = gift.on;
    $("gift-body").hidden = !gift.on;
    if (document.activeElement !== $("gift-from")) $("gift-from").value = gift.from;
    if (document.activeElement !== $("gift-msg")) $("gift-msg").value = gift.msg;
    document.querySelectorAll('input[name="gift-wrap"]').forEach((r) => { r.checked = r.value === gift.wrap; });
  }
  function saveGift() { saveJSON(GIFT_KEY, gift); }
  $("gift-on").addEventListener("change", (e) => { gift.on = e.target.checked; $("gift-body").hidden = !gift.on; saveGift(); });
  $("gift-from").addEventListener("input", (e) => { gift.from = e.target.value; saveGift(); });
  $("gift-msg").addEventListener("input", (e) => { gift.msg = e.target.value; saveGift(); });
  document.querySelectorAll('input[name="gift-wrap"]').forEach((r) => r.addEventListener("change", () => { if (r.checked) { gift.wrap = r.value; saveGift(); } }));
  $("gift-preview").addEventListener("click", () => loadExtras().then((m) => m.openGift(featureCtx(), giftData(), { preview: true })));

  function removeLine(id) {
    const q = cart[id];
    if (!q) return;
    delete cart[id];
    renderCart();
    toast(t("removedFromCart"), { label: t("undo"), fn: () => { cart[id] = q; renderCart(); } });
  }

  function change(id, delta) {
    cart[id] = Math.min(20, (cart[id] || 0) + delta);
    if (cart[id] <= 0) delete cart[id];
    renderCart();
  }

  async function checkout() {
    const btn = $("checkout-btn");
    btn.disabled = true;
    btn.textContent = t("redirecting");
    try {
      const items = Object.entries(cart).map(([id, quantity]) => ({ id, quantity }));
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, lang: I.lang, gift: gift.on ? { from: gift.from, message: gift.msg, wrap: gift.wrap } : undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error("checkout");
      try { if (gift.on) localStorage.setItem(GIFT_LAST, JSON.stringify(giftData())); else localStorage.removeItem(GIFT_LAST); } catch {}
      window.location.href = data.url;
    } catch (e) {
      showStatus(t("checkoutFail"), true);
      btn.disabled = false;
      btn.textContent = t("checkout");
    }
  }

  function showStatus(msg, warn) {
    const el = $("status");
    el.textContent = msg;
    el.className = "notice" + (warn ? " warn" : "");
    el.hidden = false;
  }

  // ---- language: first-visit gate + switcher ----
  let gate = null;
  function showGate(first) {
    if (gate) return;
    const current = first ? I.guess() : I.lang;
    gate = document.createElement("div");
    gate.className = "lang-gate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.innerHTML = `
      ${first ? "" : `<button class="gate-x" aria-label="${esc(t("closeLang"))}">✕</button>`}
      <img class="gate-logo" src="/logo.svg" alt="Laniko" width="30" height="74">
      <h1 class="gate-title"${first ? ' aria-label="Choose your language"' : ""}>${first ? '<span class="gate-cycle" lang="en">Choose your language</span>' : esc(t("chooseLang"))}</h1>
      ${first ? "" : `<p class="gate-sub">${esc(t("chooseSub"))}</p>`}
      <div class="gate-list">
        ${I.LANGS.map((l, i) => `<button class="gate-btn${!first && l.code === I.lang ? " on" : ""}" data-lang="${l.code}" lang="${l.code}" dir="${l.dir}" style="--i:${i}">${esc(l.name)}</button>`).join("")}
      </div>`;
    document.body.appendChild(gate);
    document.body.style.overflow = "hidden";
    if (first) {
      // the title says "choose your language" in every language, one after the other
      const cyc = gate.querySelector(".gate-cycle");
      let n = 0;
      const timer = setInterval(() => {
        if (!gate || !cyc.isConnected) { clearInterval(timer); return; }
        cyc.classList.add("swap");
        setTimeout(() => {
          n = (n + 1) % I.LANGS.length;
          const l = I.LANGS[n];
          cyc.textContent = I.phrase(l.code, "chooseLang"); cyc.lang = l.code; cyc.dir = l.dir;
          cyc.classList.remove("swap");
        }, 380);
      }, 1900);
    }
    const pick = (code) => {
      I.setLang(code);
      closeGate();
      if (first) productsReady.then(() => setTimeout(showPromo, 650));
    };
    gate.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.lang) pick(b.dataset.lang);
      else closeGate();
    });
    if (!first) gate.addEventListener("keydown", (e) => { if (e.key === "Escape") closeGate(); });
    const target = gate.querySelector(`[data-lang="${current}"]`) || gate.querySelector(".gate-btn");
    if (target) target.focus({ preventScroll: true });
  }
  function closeGate() {
    if (!gate) return;
    const g = gate; gate = null;
    g.classList.add("out");
    setTimeout(() => g.remove(), 450);
    updateLock();
  }

  function applyLanguage() {
    $("lang-short").textContent = I.info.short;
    applyTheme(root.dataset.theme || "light");
    updateSndBtn();
    renderPage();
    renderCart();
    if (detailId) { fillDetail(byId(detailId)); if (detailAnim) detailAnim.refresh(); }
    if (!$("status").hidden && $("status").dataset.canceled) showStatus(t("canceled"), true);
  }
  I.onChange(applyLanguage);

  // ---- advertisement for the new fragrance ----
  let promo = null;
  function showPromo() {
    const p = products.find((x) => x.featured);
    if (!p || promo) return;
    try { sessionStorage.setItem(PROMO_KEY, "1"); } catch {}
    promo = document.createElement("div");
    promo.className = "promo-back";
    const notes = t("promoNotes");
    promo.innerHTML = `
      <div class="promo" role="dialog" aria-modal="true" aria-label="${esc(t("promoAria"))}" style="--p-dark:${esc((p.theme && p.theme.bgDark) || "#07150e")}">
        <button class="promo-x" aria-label="${esc(t("promoClose"))}">✕</button>
        <div class="promo-img">
          <img src="${esc(p.image)}" alt="${esc(p.name)}">
          <span class="promo-chip">${esc(t("promoNew"))}</span>
        </div>
        <div class="promo-body">
          <h2 class="promo-title pr-in" style="--d:.55s">${esc(p.name)}</h2>
          <span class="promo-rule pr-in" style="--d:.7s"></span>
          <p class="promo-tag pr-in" style="--d:.8s">${esc(t("promoTag"))}</p>
          <p class="promo-text pr-in" style="--d:.95s">${esc(t("promoBody"))}</p>
          <ul class="promo-notes pr-in" style="--d:1.1s">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
          <p class="promo-meta pr-in" style="--d:1.2s">${esc(t("promoMeta"))} · <strong>${fmt(p.price)}</strong></p>
          <button class="promo-cta pr-in" style="--d:1.3s" data-promo="discover">${esc(t("promoCta"))}</button>
          <button class="promo-add pr-in" style="--d:1.4s" data-promo="add">${esc(t("add"))}</button>
          <button class="promo-later pr-in" style="--d:1.5s" data-promo="close">${esc(t("promoLater"))}</button>
        </div>
      </div>`;
    document.body.appendChild(promo);
    document.body.style.overflow = "hidden";
    promo.addEventListener("click", (e) => {
      if (e.target === promo) return closePromo();
      const b = e.target.closest("button");
      if (!b) return;
      if (b.classList.contains("promo-x") || b.dataset.promo === "close") closePromo();
      else if (b.dataset.promo === "discover") { closePromo(); setTimeout(() => openDetail(p.id), 250); }
      else if (b.dataset.promo === "add") { change(p.id, 1); closePromo(); addedToast(); }
    });
    promo.querySelector(".promo-cta").focus({ preventScroll: true });
  }
  function closePromo() {
    if (!promo) return;
    const el = promo; promo = null;
    el.classList.add("out");
    setTimeout(() => el.remove(), 400);
    updateLock();
  }

  // ---- light / dark mode: follows the phone until the visitor chooses ----
  const root = document.documentElement;
  function applyTheme(mode) {
    root.dataset.theme = mode;
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", mode === "dark" ? "#0f0e0c" : "#fafaf8");
    $("theme-btn").setAttribute("aria-label", t(mode === "dark" ? "toLight" : "toDark"));
  }
  $("theme-btn").addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("laniko-theme", next); } catch {}
    applyTheme(next);
  });
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!localStorage.getItem("laniko-theme")) applyTheme(e.matches ? "dark" : "light");
    });
  } catch {}

  // ---- intro: the logo draws itself on the very first visit ----
  function showIntro() {
    return new Promise(async (resolve) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return resolve();
      let svg = "";
      try { svg = await (await fetch("/logo.svg")).text(); } catch { return resolve(); }
      const el = document.createElement("div");
      el.className = "intro";
      el.innerHTML = svg.replace("<svg", '<svg class="intro-logo" aria-hidden="true"');
      const path = el.querySelector("path");
      if (!path) return resolve();
      path.setAttribute("pathLength", "1");
      document.body.appendChild(el);
      document.body.style.overflow = "hidden";
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        el.classList.add("out");
        setTimeout(() => { el.remove(); updateLock(); resolve(); }, 650);
      };
      requestAnimationFrame(() => el.classList.add("go"));
      el.addEventListener("click", finish);
      setTimeout(finish, 3400);
    });
  }

  // ---- phone tilt moves the light on the 3D bottle (iPhone asks for permission once) ----
  let tiltHandler = null;
  function enableTilt() {
    const D = window.DeviceOrientationEvent;
    if (!D || tiltHandler) return;
    const start = () => {
      let base = null;
      tiltHandler = (e) => {
        if (e.gamma == null || e.beta == null || !viewer) return;
        if (base === null) base = e.beta;
        viewer.tilt(e.gamma, e.beta - base);
      };
      window.addEventListener("deviceorientation", tiltHandler);
    };
    if (typeof D.requestPermission === "function") D.requestPermission().then((r) => { if (r !== "denied") start(); }).catch(() => {});
    else start();
  }
  function disableTilt() {
    if (tiltHandler) window.removeEventListener("deviceorientation", tiltHandler);
    tiltHandler = null;
  }

  // ---- shake to spray: three quick jolts make the bottle spray (the Spray button does the same without a phone) ----
  let shakeHandler = null;
  function enableShake() {
    if (shakeHandler || !("DeviceMotionEvent" in window)) return;
    const start = () => {
      let last = null, spikeAt = 0, spikes = 0, firstAt = 0;
      shakeHandler = (e) => {
        const a = e.accelerationIncludingGravity;
        if (!a || a.x == null || !viewer) return;
        if (last) {
          const d = Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z), now = performance.now();
          if (d > 22 && now - spikeAt > 90) {
            spikeAt = now;
            if (now - firstAt > 900) { spikes = 0; firstAt = now; }
            if (++spikes >= 3) { spikes = 0; viewer.spray(); }
          }
        }
        last = { x: a.x, y: a.y, z: a.z };
      };
      window.addEventListener("devicemotion", shakeHandler);
    };
    const D = window.DeviceMotionEvent;
    if (typeof D.requestPermission === "function") D.requestPermission().then((r) => { if (r !== "denied") start(); }).catch(() => {});
    else start();
  }
  function disableShake() {
    if (shakeHandler) window.removeEventListener("devicemotion", shakeHandler);
    shakeHandler = null;
  }

  // ---- AR: the bottle in your own room, in real size. Google's <model-viewer> does the work (WebXR / Scene Viewer on
  // Android, Quick Look on iPhone). The button appears only when the phone can really do it. ----
  const AR_LIB = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js";
  let arEl = null;
  function teardownAR() { if (arEl) { arEl.remove(); arEl = null; } $("viewer-ar").hidden = true; }
  async function setupAR(p) {
    if (!p.model) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (!coarse) return;                                    // AR is for phones and tablets
    try {
      if (!customElements.get("model-viewer")) await import(AR_LIB);
      if (viewerProductId !== p.id || $("viewer").hidden) return;
      const mv = document.createElement("model-viewer");
      mv.setAttribute("src", new URL(p.model, location.origin).href);
      mv.setAttribute("alt", p.name);
      mv.setAttribute("ar", ""); mv.setAttribute("ar-modes", "webxr scene-viewer quick-look");
      mv.setAttribute("ar-scale", "fixed"); mv.setAttribute("ar-placement", "floor");
      mv.setAttribute("loading", "eager");
      mv.style.cssText = "position:fixed;left:-20px;top:-20px;width:8px;height:8px;opacity:0;pointer-events:none";
      document.body.appendChild(mv);
      arEl = mv;
      mv.addEventListener("load", () => { if (arEl === mv && mv.canActivateAR) $("viewer-ar").hidden = false; });
    } catch (e) { console.warn("AR unavailable", e); }
  }
  $("viewer-ar").addEventListener("click", () => { if (arEl && arEl.canActivateAR) arEl.activateAR(); });
  $("viewer-spray").addEventListener("click", () => {
    if (!viewer) return;
    if (snd) snd.wake();                          // a tap is what lets browsers start audio
    viewer.spray();
  });

  // ---- events ----
  document.addEventListener("click", (e) => {
    if (e.target.closest(".tabs a, .brand")) freshNav = true;
    const link = e.target.closest("a[data-route='perfumes'], a.link-btn[href='/']");
    if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); goHome(); return; }
    const nb = e.target.closest("[data-note]");
    if (nb) { const p = byId(detailId); loadFeatures().then((m) => m.openNote(featureCtx(), nb.dataset.note, p && p.notes)); return; }
    const rl = e.target.closest("[data-rel]");
    if (rl) { history.replaceState(null, "", "#/perfume/" + rl.dataset.rel); lastHref = location.href; syncDetail(); return; }
    const act = e.target.closest("[data-act]");
    if (act) {
      const a = act.dataset.act;
      if (a === "quiz") loadFeatures().then((m) => m.openQuiz(featureCtx()));
      else if (a === "mood") loadExtras().then((m) => m.openMood(featureCtx()));
      else if (a === "compare") { freshNav = true; location.hash = "#/compare"; }
      else if (a === "share") shareWishlist();
      else if (a === "saveall") { sharedIds().forEach((id) => { if (byId(id) && !wish.includes(id)) wish.push(id); }); saveJSON(WISH_KEY, wish); updateWishUI(); toast(t("savedAll")); }
      return;
    }
    const op = e.target.closest("[data-open]");
    if (op) { openDetail(op.dataset.open, (op.closest(".card") && op.closest(".card").querySelector(".media img")) || (op.querySelector && op.querySelector("img")) || op.closest(".cmp-head")?.querySelector("img")); return; }
    const t_ = e.target.closest("button");
    if (!t_) return;
    if (t_.dataset.view) openViewer(t_.dataset.view);
    else if (t_.dataset.wish) toggleWish(t_.dataset.wish);
    else if (t_.dataset.add) { change(t_.dataset.add, 1); addedToast(); }
    else if (t_.dataset.inc) change(t_.dataset.inc, 1);
    else if (t_.dataset.dec) change(t_.dataset.dec, -1);
    else if (t_.dataset.del) removeLine(t_.dataset.del);
  });
  $("lang-btn").addEventListener("click", () => showGate(false));
  $("pd-back").addEventListener("click", closeDetail);
  $("snd-btn").addEventListener("click", toggleSound);
  $("pd-pic").addEventListener("click", () => { if (detailId) openViewer(detailId); });
  $("pd-add").addEventListener("click", () => { if (detailId) { change(detailId, 1); addedToast(); } });
  $("cart-btn").addEventListener("click", () => { $("cart").hidden = !$("cart").hidden; });
  $("cart-close").addEventListener("click", () => { $("cart").hidden = true; });
  $("checkout-btn").addEventListener("click", checkout);
  $("viewer-close").addEventListener("click", closeViewer);
  $("viewer-add").addEventListener("click", () => {
    if (viewerProductId) change(viewerProductId, 1);
    closeViewer();
    addedToast();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (promo) closePromo();
    else if (gate && I.hasChoice()) closeGate();
    else if (!$("viewer").hidden) closeViewer();
    else if (detailId) closeDetail();
  });

  // fetch the 3D code in the background once the page is idle, so opening a viewer is instant
  function warmViewer() {
    const go = () => { import("/viewer.js").catch(() => {}); };
    if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 4000 });
    else setTimeout(go, 2000);
  }
  // start fetching a perfume's 3D model as soon as a finger / pointer lands on its photo
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest && e.target.closest("[data-view]");
    const p = b && byId(b.dataset.view);
    if (p && p.model) fetch(p.model).catch(() => {});
  }, { passive: true });

  let resolveProducts;
  const productsReady = new Promise((r) => { resolveProducts = r; });

  async function init() {
    const params = new URLSearchParams(location.search);
    if (params.get("canceled")) { $("status").dataset.canceled = "1"; showStatus(t("canceled"), true); }
    I.applyStatic();
    $("lang-short").textContent = I.info.short;
    updateWishUI();
    $("page-title").textContent = t(ROUTES[currentRoute()].title);
    $("page-sub").textContent = t(ROUTES[currentRoute()].sub);

    // first visit: the customer chooses the language before anything else; the advertisement follows
    applyTheme(root.dataset.theme || "light");
    const gl = location.hash.match(/^#\/gift\/([\w-]+)/);
    if (gl && !I.hasChoice()) {                       // a gift link: straight to the surprise, in the sender's language
      try {
        const g = JSON.parse(decodeURIComponent(escape(atob(gl[1].replace(/-/g, "+").replace(/_/g, "/")))));
        if (g && g.l) I.setLang(g.l);
      } catch {}
    } else if (!I.hasChoice()) showIntro().then(() => showGate(true));

    try {
      const res = await fetch("/products.json", { cache: "no-cache" });
      const all = await res.json();
      products = all.filter((p) => !p.kind);
      sets = all.filter((p) => p.kind === "set");
      // forget wishlist entries for products that no longer exist
      wish = wish.filter((id) => byId(id));
      saveJSON(WISH_KEY, wish);
      updateWishUI();
      renderPage();
      syncDetail();
      syncGift();
      warmViewer();
      try {
        const nav = performance.getEntriesByType("navigation")[0];
        if (nav && (nav.type === "reload" || nav.type === "back_forward") && !detailId && scrollMem[curKey]) window.scrollTo(0, scrollMem[curKey]);
      } catch {}
    } catch {
      $("products").textContent = t("loadFail");
    }
    renderCart();
    resolveProducts();

    // returning visitor: the advertisement once per visit
    if (I.hasChoice() && !gl) {
      let seen = false;
      try { seen = !!sessionStorage.getItem(PROMO_KEY); } catch {}
      if (!seen && !params.get("canceled")) setTimeout(showPromo, 1400);
    }
  }
  init();
})();
