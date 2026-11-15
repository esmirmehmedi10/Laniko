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

  let products = [];
  let cart = loadJSON(CART_KEY, {}); // { [productId]: quantity }
  let wish = loadJSON(WISH_KEY, []); // [productId, ...]
  const byId = (id) => products.find((p) => p.id === id);
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

  // ---- toast ----
  let toastTimer;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
  }

  // ---- pages: the home page is the plain address (/); the others are #/top-sellers and #/wishlist ----
  const ROUTES = {
    "perfumes": { title: "collectionTitle", sub: "collectionSub", list: () => products, empty: "emptyPerfumes" },
    "top-sellers": { title: "topTitle", sub: "topSub", list: () => products.filter((p) => p.rank).sort((a, b) => a.rank - b.rank), empty: "emptyTop" },
    "wishlist": { title: "wishTitle", sub: "wishSub", list: () => wish.map(byId).filter(Boolean), empty: "emptyWish" },
  };

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
          <button class="imgbtn" data-view="${esc(p.id)}" aria-label="${esc(t("view3d", { name: p.name }))}">
            <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
            <span class="badge3d">3D</span>
            <span class="pic-desc">${esc(descOf(p))}</span>
          </button>
          <button class="heart${liked ? " on" : ""}" data-wish="${esc(p.id)}" aria-pressed="${liked}" aria-label="${esc(t("saveWish", { name: p.name }))}">${HEART}</button>
          ${rank}
        </div>
        <div class="body">
          <h3>${esc(p.name)}</h3>
          <span class="price">${fmt(p.price)}</span>
          <button class="add" data-add="${esc(p.id)}">${esc(t("add"))}</button>
        </div>
      </article>`;
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
    const list = cfg.list();
    if (!list.length) {
      const cta = route === "wishlist" ? `<p><a class="link-btn" href="/">${esc(t("browse"))}</a></p>` : "";
      $("products").innerHTML = `<div class="empty"><p>${esc(t(cfg.empty))}</p>${cta}</div>`;
      return;
    }
    $("products").innerHTML = list.map((p) => cardHTML(p, route)).join("");
    watchImages($("products"));
  }

  // navigation without reloading; "/" and "#/perfumes" are the same page
  let lastHref = location.href;
  function onRoute() {
    if (location.href === lastHref) return;   // hashchange and popstate both fire: handle once
    lastHref = location.href;
    $("cart").hidden = true;
    renderPage();
    window.scrollTo(0, 0);
  }
  function goHome() {
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

  // ---- 3D viewer ----
  let viewer = null;
  let viewerProductId = null;

  async function openViewer(id) {
    const p = byId(id);
    if (!p) return;
    viewerProductId = id;
    $("viewer-title").textContent = p.name;
    $("viewer-price").textContent = fmt(p.price);
    $("viewer-hint").textContent = t("viewerHint");
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
    } catch (e) {
      console.error("3D viewer failed", e);
      stage.innerHTML = `<img src="${esc(p.image)}" alt="${esc(p.name)}">`;
      $("viewer-hint").textContent = t("viewerFail");
    }
  }

  function closeViewer() {
    if (viewer) { viewer.dispose(); viewer = null; }
    viewerProductId = null;
    $("viewer").hidden = true;
    $("viewer-stage").innerHTML = "";
    $("viewer-desc").innerHTML = "";
    document.body.style.overflow = "";
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
            <div class="info"><strong>${esc(p.name)}</strong><br>${fmt(p.price)}</div>
            <div class="qty">
              <button data-dec="${esc(id)}" aria-label="${esc(t("less"))}">−</button>
              <span>${cart[id]}</span>
              <button data-inc="${esc(id)}" aria-label="${esc(t("more"))}">+</button>
            </div>
          </div>`;
        }).join("")
      : `<p class='small'>${esc(t("cartEmpty"))}</p>`;
    watchImages($("cart-items"));
    if (products.length) saveJSON(CART_KEY, cart);
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
        body: JSON.stringify({ items, lang: I.lang }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error("checkout");
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
      <h1 class="gate-title">${first ? "Choose your language" : esc(t("chooseLang"))}</h1>
      <p class="gate-sub">${first ? "Wählen Sie Ihre Sprache · Choisissez votre langue · اختر لغتك · 请选择语言" : esc(t("chooseSub"))}</p>
      <div class="gate-list">
        ${I.LANGS.map((l, i) => `<button class="gate-btn${!first && l.code === I.lang ? " on" : ""}" data-lang="${l.code}" lang="${l.code}" dir="${l.dir}" style="--i:${i}">${esc(l.name)}</button>`).join("")}
      </div>`;
    document.body.appendChild(gate);
    document.body.style.overflow = "hidden";
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
    document.body.style.overflow = "";
  }

  function applyLanguage() {
    $("lang-short").textContent = I.info.short;
    renderPage();
    renderCart();
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
      else if (b.dataset.promo === "discover") { closePromo(); setTimeout(() => openViewer(p.id), 200); }
      else if (b.dataset.promo === "add") { change(p.id, 1); closePromo(); $("cart").hidden = false; }
    });
    promo.querySelector(".promo-cta").focus({ preventScroll: true });
  }
  function closePromo() {
    if (!promo) return;
    const el = promo; promo = null;
    el.classList.add("out");
    setTimeout(() => el.remove(), 400);
    if (!gate && $("viewer").hidden) document.body.style.overflow = "";
  }

  // ---- events ----
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-route='perfumes'], a.link-btn[href='/']");
    if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); goHome(); return; }
    const t_ = e.target.closest("button");
    if (!t_) return;
    if (t_.dataset.view) openViewer(t_.dataset.view);
    else if (t_.dataset.wish) toggleWish(t_.dataset.wish);
    else if (t_.dataset.add) { change(t_.dataset.add, 1); $("cart").hidden = false; }
    else if (t_.dataset.inc) change(t_.dataset.inc, 1);
    else if (t_.dataset.dec) change(t_.dataset.dec, -1);
  });
  $("lang-btn").addEventListener("click", () => showGate(false));
  $("cart-btn").addEventListener("click", () => { $("cart").hidden = !$("cart").hidden; });
  $("cart-close").addEventListener("click", () => { $("cart").hidden = true; });
  $("checkout-btn").addEventListener("click", checkout);
  $("viewer-close").addEventListener("click", closeViewer);
  $("viewer-add").addEventListener("click", () => {
    if (viewerProductId) change(viewerProductId, 1);
    closeViewer();
    $("cart").hidden = false;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (promo) closePromo();
    else if (gate && I.hasChoice()) closeGate();
    else if (!$("viewer").hidden) closeViewer();
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
    if (!I.hasChoice()) showGate(true);

    try {
      const res = await fetch("/products.json", { cache: "no-cache" });
      products = await res.json();
      // forget wishlist entries for products that no longer exist
      wish = wish.filter((id) => byId(id));
      saveJSON(WISH_KEY, wish);
      updateWishUI();
      renderPage();
      warmViewer();
    } catch {
      $("products").textContent = t("loadFail");
    }
    renderCart();
    resolveProducts();

    // returning visitor: the advertisement once per visit
    if (I.hasChoice()) {
      let seen = false;
      try { seen = !!sessionStorage.getItem(PROMO_KEY); } catch {}
      if (!seen && !params.get("canceled")) setTimeout(showPromo, 1400);
    }
  }
  init();
})();
