(() => {
  const CART_KEY = "shop-cart-v1";
  const WISH_KEY = "shop-wishlist-v1";
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

  // ---- pages: the home page is the plain address (/); the others are #/discover and #/wishlist ----
  const ROUTES = {
    "perfumes": { title: "collectionTitle", sub: "collectionSub", list: () => products, empty: "emptyPerfumes" },
    "discover": { title: "disTitle", sub: "disSub", discover: true },
    "wishlist": { title: "wishTitle", sub: "wishSub", list: () => wish.map(byId).filter(Boolean), empty: "emptyWish" },
    "compare": { title: "cmpTitle", sub: "cmpSub", list: () => products, empty: "emptyPerfumes", custom: true },
    "about": { title: "abTab", sub: "abTag", story: true },
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
    if (route === "wishlist" && wish.length) h = `<button class="act" data-act="share">${ICON_SHARE}<span>${esc(t("shareWish"))}</span></button>`;
    else if (route === "shared" && sharedIds().length) h = `<button class="act gold" data-act="saveall">${esc(t("saveAllWish"))}</button>`;
    el.className = "page-actions";
    el.innerHTML = h;
  }

  // the Discover page: three guided ways to find a perfume, shown as quiet numbered cards
  const DIS_ICONS = {
    quiz: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="17"/><path d="M30.5 17.5 27 27l-9.5 3.5L21 21z"/><circle cx="24" cy="24" r="1.6" class="f"/></svg>',
    mood: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 11h30a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H25l-8 7v-7H9a3 3 0 0 1-3-3V14a3 3 0 0 1 3-3z"/><path d="M16 21.500c2-2.5 3.5-2.5 5.5 0s3.5 2.5 5.5 0 3.5-2.5 5 0"/></svg>',
    compare: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="16" width="14" height="22" rx="2"/><path d="M11 16v-4h6v4"/><rect x="27" y="16" width="14" height="22" rx="2"/><path d="M31 16v-4h6v4"/><path d="M7 26h14M27 26h14"/></svg>',
  };
  function discoverHTML() {
    const cards = [["quiz", "disQzT", "disQzD"], ["mood", "disMdT", "disMdD"], ["compare", "disCpT", "disCpD"]];
    return `<div class="dis">${cards.map(([act, ti, de]) => `
      <button class="dis-card" type="button" data-act="${act}">
        <span class="dis-ico">${DIS_ICONS[act]}</span>
        <span class="dis-t">${esc(t(ti))}</span>
        <span class="dis-d">${esc(t(de))}</span>
        <span class="dis-go">${esc(t("disGo"))}<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 12h15M14 6l6 6-6 6"/></svg></span>
      </button>`).join("")}</div>`;
  }

  // ---- the "New" pop-up: the newest fragrance in a quiet gold-framed window, opened from the gold tab ----
  let newEl = null;
  function openNewPopup() {
    const p = products.find((x) => x.featured);
    if (!p || newEl) return;
    const th = p.theme || {}, tagKey = "chT_" + p.id.replace(/-/g, "_"), tag = t(tagKey) === tagKey ? "" : t(tagKey);
    const el = document.createElement("div");
    el.className = "nwp-back"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", t("newTab") + " · " + p.name);
    el.innerHTML = `<div class="nwp"><button class="nwp-x" type="button" aria-label="${esc(t("closeLang"))}">✕</button>
      <article class="nw-card" style="--bg:${th.bgDark || "#0c0a07"};--gl:${th.glow || "#c9a25a"}">
        <a class="nw-img" href="#/perfume/${esc(p.id)}" aria-label="${esc(p.name)}"><img src="${esc(p.image)}" alt="${esc(p.name)}"></a>
        <div class="nw-body">
          <p class="nw-kick"><span>✦</span> ${esc(t("newTab"))}</p>
          <h3>${esc(p.name)}</h3>
          ${tag ? `<p class="nw-tag">${esc(tag)}</p>` : ""}
          <p class="nw-desc">${esc(descOf(p))}</p>
          <p class="nw-notes">${(p.notes || []).map((n) => `<span>${esc(I.noteName(n))}</span>`).join("")}</p>
          <div class="nw-cta"><a class="nw-go" href="#/perfume/${esc(p.id)}">${esc(t("newGo"))}</a><button class="nw-story" type="button">${esc(t("chRead"))}</button></div>
        </div>
      </article></div>`;
    document.body.appendChild(el);
    newEl = el; updateLock();
    requestAnimationFrame(() => el.classList.add("in"));
    const close = () => {
      if (!newEl) return; newEl = null; el.classList.remove("in"); el.classList.add("out"); updateLock();
      document.removeEventListener("keydown", onKey, true);
      setTimeout(() => el.remove(), 380);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", onKey, true);
    el.addEventListener("click", (e) => {
      if (e.target === el || e.target.closest(".nwp-x")) return close();
      if (e.target.closest("a.nw-img, a.nw-go")) { close(); return; }                      // the link then opens the perfume page
      if (e.target.closest(".nw-story")) { close(); import("/chapter.js").then((m) => m.openChapter(featureCtx(), p)); }
    });
    el.querySelector(".nwp-x").focus({ preventScroll: true });
  }
  $("tab-new").addEventListener("click", (e) => { e.preventDefault(); openNewPopup(); });

  function renderPage() {
    const route = currentRoute();
    const cfg = ROUTES[route];
    document.querySelectorAll(".tabs a").forEach((a) => {
      if (a.dataset.route === (route === "compare" ? "discover" : route)) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const curTab = document.querySelector(".tabs a[aria-current]");                      // keep the open page's tab in view in the sideways-scrolling row
    if (curTab && curTab.parentElement) { const row = curTab.parentElement; row.scrollTo({ left: curTab.offsetLeft - (row.clientWidth - curTab.offsetWidth) / 2, behavior: "smooth" }); }
    updateNewTab();
    $("page-title").textContent = t(cfg.title);
    $("page-sub").textContent = t(cfg.sub);
    // "About us" is a story, not a product list
    document.querySelector(".page-head").hidden = !!cfg.story;
    $("page-actions").hidden = !!cfg.story;
    $("products").hidden = !!cfg.story;
    $("story").hidden = !cfg.story;
    if (cfg.story) {
      import("/about.js").then((m) => { if (currentRoute() === "about") m.mountStory({ I, esc }, $("story")); });
      return;
    }
    import("/about.js").then((m) => m.unmountStory()).catch(() => {});
    if (!products.length) return;
    pageActions(route);
    if (cfg.discover) { $("products").innerHTML = discoverHTML(); return; }
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
  // ---- swipe left / right to move between the pages (New, Perfumes, Discover, Wishlist, About us)
  (() => {
    let sx = 0, sy = 0, st = 0, ok = false;
    const blocked = (el) => {
      if (document.body.style.overflow === "hidden" || detailId || !$("cart").hidden) return true;
      for (let n = el; n && n !== document.body && n.nodeType === 1; n = n.parentElement) {
        if (/^(INPUT|TEXTAREA|SELECT|CANVAS)$/.test(n.tagName) || n.classList.contains("tabs")) return true;
        const cs = getComputedStyle(n);
        if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 2) return true;       // a row that scrolls sideways keeps its own swipe
      }
      return false;
    };
    document.addEventListener("touchstart", (e) => {
      ok = e.touches.length === 1 && !blocked(e.target);
      if (ok) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }
    }, { passive: true });
    document.addEventListener("touchend", (e) => {
      if (!ok) return; ok = false;
      const t0 = e.changedTouches[0], dx = t0.clientX - sx, dy = t0.clientY - sy;
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.7 || Date.now() - st > 800) return;
      const tabs = [...document.querySelectorAll(".tabs a")].filter((x) => !x.hidden);
      const route = currentRoute(), at = tabs.findIndex((x) => x.dataset.route === (route === "compare" ? "discover" : route));
      if (at < 0) return;
      const rtl = document.documentElement.dir === "rtl";
      const to = tabs[at + (dx > 0 ? -1 : 1) * (rtl ? -1 : 1)];                                        // swipe right = the page on the left
      if (!to) return;
      to.click();
      if (to.id === "tab-new") return;                                                                   // the New tab opens a pop-up window: nothing to slide
      const m = document.querySelector("main");
      m.classList.remove("sw-l", "sw-r"); void m.offsetWidth; m.classList.add(dx > 0 ? "sw-l" : "sw-r");
      setTimeout(() => m.classList.remove("sw-l", "sw-r"), 450);
    }, { passive: true });
  })();
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
        ${(p.notes || []).length && p.kind !== "set" ? `<div class="pd-acts"><button class="pd-act" type="button" data-chapter><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C7 4 9.5 4.3 12 6c2.5-1.7 5-2 8-.5V19c-3-1.5-5.5-1.2-8 .5C9.5 17.8 7 17.5 4 19z"/><path d="M12 6v13.500"/></svg>${esc(t("chRead"))}</button></div>` : ""}
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
    document.body.style.overflow = (detailId || !$("viewer").hidden || gate || welcomeEl || introEl || newEl) ? "hidden" : "";
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
        body: JSON.stringify({ items, lang: I.lang, country: country || undefined, gift: gift.on ? { from: gift.from, message: gift.msg, wrap: gift.wrap } : undefined }),
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

  // ---- language and country: asked once on the first visit, changeable any time (language button, or "Change" in the cart) ----
  const COUNTRY_KEY = "laniko-country";
  const SHIP_TO = ["LU", "BE", "FR", "DE", "NL"];       // keep in step with SHIPPING_COUNTRIES in functions/api/checkout.js
  const COUNTRIES = SHIP_TO;                              // the countries offered in the shop: only where we deliver
  let country = "";
  try { country = localStorage.getItem(COUNTRY_KEY) || ""; } catch {}
  if (country && !COUNTRIES.includes(country)) { country = ""; try { localStorage.removeItem(COUNTRY_KEY); } catch {} }   // an old choice that is no longer offered: ask again
  const countryName = (c) => {
    try { return new Intl.DisplayNames([I.lang], { type: "region" }).of(c) || c; } catch { return c; }
  };
  function guessCountry() {                              // from the phone's region setting, e.g. de-LU
    for (const l of navigator.languages || [navigator.language]) {
      const m = /[-_]([A-Za-z]{2})$/.exec(l || "");
      if (m && COUNTRIES.includes(m[1].toUpperCase())) return m[1].toUpperCase();
    }
    return "LU";
  }
  function renderCountryLine() {
    const el = $("cart-country");
    if (!country) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `${esc(t("ctryLine"))}: <strong>${esc(countryName(country))}</strong> · <button type="button" class="linklike" data-ctry-change>${esc(t("ctryChange"))}</button>`;
  }
  function setCountry(c) {
    country = c;
    try { localStorage.setItem(COUNTRY_KEY, c); } catch {}
    renderCountryLine();
  }
  $("cart-country").addEventListener("click", (e) => { if (e.target.closest("[data-ctry-change]")) showGate(false); });

  // mode: true = very first visit (language, then country) · "country" = only the country · false = both, with a close button
  let gate = null, welcomeEl = null, introEl = null, introAfterGate = false;
  function showGate(mode, promoAfter) {
    if (gate) return;
    const first = mode === true;
    let step = first ? "lang" : mode === "country" ? "country" : "both";
    gate = document.createElement("div");
    gate.className = "lang-gate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    document.body.appendChild(gate);
    document.body.style.overflow = "hidden";
    let timer = 0;
    const logo = '<img class="gate-logo" src="/logo.svg" alt="Laniko" width="30" height="74">';
    const closeBtn = () => `<button class="gate-x" aria-label="${esc(t("closeLang"))}">✕</button>`;
    const langList = () => `<div class="gate-list">${I.LANGS.map((l, i) => `<button class="gate-btn${step === "both" && l.code === I.lang ? " on" : ""}" data-lang="${l.code}" lang="${l.code}" dir="${l.dir}" style="--i:${i}">${esc(l.name)}</button>`).join("")}</div>`;
    // the country bar: tap it and the five countries appear (no typing, so no keyboard pops up)
    const ctryBlock = () => `<div class="ctry-combo">
      <button type="button" class="ctry-input" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="ctry-lb" aria-label="${esc(t("ctryTitle"))}"><span class="${country ? "" : "ph"}">${esc(country ? countryName(country) : t("ctryPh"))}</span></button>
      <ul id="ctry-lb" class="ctry-lb" role="listbox" hidden></ul>
    </div>`;
    let closeList = () => {};
    const wireCombo = () => {
      const bar = gate.querySelector(".ctry-input"), ul = gate.querySelector(".ctry-lb");
      if (!bar) return;
      let act = COUNTRIES.indexOf(country), open = false;          // act = the row marked with the keyboard (-1: none)
      const paint = () => {
        ul.innerHTML = COUNTRIES.map((c, k) => `<li role="option" id="co-${c}" data-country="${c}" class="${k === act ? "hl" : ""}${c === country ? " on" : ""}" aria-selected="${c === country}">${esc(countryName(c))}</li>`).join("");
        if (act >= 0) bar.setAttribute("aria-activedescendant", "co-" + COUNTRIES[act]); else bar.removeAttribute("aria-activedescendant");
      };
      const setOpen = (o) => { open = o; ul.hidden = !o; bar.setAttribute("aria-expanded", String(o)); if (o) paint(); };
      closeList = () => setOpen(false);
      const choose = (c) => {
        setCountry(c);
        const sp = bar.firstElementChild; sp.textContent = countryName(c); sp.classList.remove("ph");
        setOpen(false);
        if (step !== "both") finish();
      };
      bar.addEventListener("click", () => setOpen(!open));
      bar.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!open) setOpen(true);
          else { act = act < 0 ? (e.key === "ArrowDown" ? 0 : COUNTRIES.length - 1) : (act + (e.key === "ArrowDown" ? 1 : -1) + COUNTRIES.length) % COUNTRIES.length; paint(); }
        } else if ((e.key === "Enter" || e.key === " ") && open && act >= 0) { e.preventDefault(); choose(COUNTRIES[act]); }
        else if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); }
      });
      bar.addEventListener("keyup", (e) => { if (e.key === " ") e.preventDefault(); });
      ul.addEventListener("click", (e) => { const li = e.target.closest("li[data-country]"); if (li) choose(li.dataset.country); });
      if (step === "country") setOpen(true);                    // asked for the country: the five choices are shown right away
    };
    const render = () => {
      clearInterval(timer);
      if (step === "lang") gate.innerHTML = `${logo}<h1 class="gate-title" aria-label="Choose your language"><span class="gate-cycle" lang="en">Choose your language</span></h1>${langList()}`;
      else if (step === "country") gate.innerHTML = `${closeBtn()}${logo}<h1 class="gate-title">${esc(t("ctryTitle"))}</h1>${ctryBlock()}`;
      else gate.innerHTML = `${closeBtn()}${logo}<h1 class="gate-title">${esc(t("chooseLang"))}</h1><p class="gate-sub">${esc(t("chooseSub"))}</p>${langList()}<h2 class="gate-title gate-title2">${esc(t("ctryTitle"))}</h2>${ctryBlock()}`;
      const cyc = gate.querySelector(".gate-cycle");
      if (cyc) {
        // the title says "choose your language" in every language, one after the other
        let n = 0;
        timer = setInterval(() => {
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
      wireCombo();
      const target = gate.querySelector(".gate-btn.on") || (step === "country" ? null : gate.querySelector(".gate-btn"));
      if (target) target.focus({ preventScroll: true });
    };
    const finish = () => {
      clearInterval(timer);
      closeGate();
    };
    gate.addEventListener("click", (e) => {
      if (e.target.closest(".ctry-combo")) return;               // the country bar handles its own clicks
      closeList();
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.lang) {
        I.setLang(b.dataset.lang);
        if (step === "lang") { if (country) finish(); else { step = "country"; render(); } }
        else { closeGate(); goHome(); }                          // picked from the header: the window closes and the homepage appears in the new language
      } else { clearInterval(timer); closeGate(); }
    });
    render();
  }
  function closeGate() {
    if (!gate) return;
    const g = gate; gate = null;
    g.classList.add("out");
    setTimeout(() => g.remove(), 450);
    updateLock();
    if (introAfterGate) { introAfterGate = false; setTimeout(playIntro, 380); }       // first visit: the language and country window comes first, then the introduction in that language
  }

  // ---- the brand introduction: plays after the doors open (and after the language window on a first visit), before the homepage ----
  function playIntro() {
    if (introEl) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = document.createElement("div");
    el.className = "intro"; el.id = "intro"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Laniko");
    el.innerHTML = `<div class="in-bg"></div><div class="in-vig"></div>
      <button class="in-skip" type="button">${esc(t("inSkip"))}</button>
      <div class="in-stage">
        <section class="in-s" data-i="0"><svg class="in-logo" viewBox="0 0 631 1595" fill="url(#wl-gold)" aria-hidden="true" focusable="false"><use href="#wl-logo-shape"/></svg><p class="in-kick">${esc(t("inKick"))}</p><h2 class="in-brand">LANIKO</h2></section>
        <section class="in-s" data-i="1"><p class="in-rule"></p><h2 class="in-big">${esc(t("abTag"))}</h2></section>
        <section class="in-s" data-i="2"><p class="in-line">${esc(t("inL1"))}</p><p class="in-line in-soft">${esc(t("inL2"))}</p></section>
        <section class="in-s" data-i="3"><p class="in-rule"></p><p class="in-line">${esc(t("inL3"))}</p><p class="in-line in-soft">${esc(t("inL4"))}</p></section>
        <section class="in-s in-last" data-i="4"><p class="in-big">${esc(t("abEnd1"))}</p><p class="in-big in-gold">${esc(t("abEnd2"))}</p><button class="in-go" type="button">${esc(t("inGo"))}</button></section>
      </div>
      <div class="in-dots" aria-hidden="true">${[0, 1, 2, 3, 4].map((k) => `<i data-i="${k}"></i>`).join("")}</div>`;
    document.body.appendChild(el);
    introEl = el; updateLock();
    const S = [...el.querySelectorAll(".in-s")], D = [...el.querySelectorAll(".in-dots i")];
    const HOLD = reduced ? [2600, 3000, 4000, 4200] : [3400, 3600, 4600, 4800];            // how long each scene stays before the next
    let at = -1, timer = 0, done = false;
    const show = (i) => {
      if (done) return;
      clearTimeout(timer);
      if (i >= S.length) return;
      S.forEach((s, k) => { s.classList.toggle("on", k === i); s.classList.toggle("past", k < i); });
      D.forEach((d, k) => d.classList.toggle("on", k <= i));
      at = i;
      el.classList.toggle("last", i === S.length - 1);
      if (i < HOLD.length) timer = setTimeout(() => show(i + 1), HOLD[i]);
    };
    const finish = () => {
      if (done) return; done = true; clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      el.classList.add("out");
      setTimeout(() => { el.remove(); introEl = null; updateLock(); window.scrollTo(0, 0); }, reduced ? 300 : 900);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); finish(); } else if (e.key === "Enter") { e.preventDefault(); if (at >= S.length - 1) finish(); else show(at + 1); } };
    document.addEventListener("keydown", onKey);
    el.querySelector(".in-skip").addEventListener("click", (e) => { e.stopPropagation(); finish(); });
    el.querySelector(".in-go").addEventListener("click", (e) => { e.stopPropagation(); finish(); });
    el.addEventListener("click", () => { if (at < S.length - 1) show(at + 1); });                // a tap moves on to the next scene
    show(0);
  }

  function applyLanguage() {
    $("lang-short").textContent = I.info.short;
    applyTheme(root.dataset.theme || "light");
    updateSndBtn();
    renderPage();
    renderCart();
    renderCountryLine();
    if (detailId) { fillDetail(byId(detailId)); if (detailAnim) detailAnim.refresh(); }
    if (!$("status").hidden && $("status").dataset.canceled) showStatus(t("canceled"), true);
  }
  I.onChange(applyLanguage);

  // ---- the new fragrance has its own gold tab, left of "Perfumes"; it opens the pop-up ----
  function updateNewTab() {
    const tab = $("tab-new"), p = products.find((x) => x.featured);
    if (!tab) return;
    tab.hidden = !p;
    if (p) tab.setAttribute("aria-label", t("newTab") + " · " + p.name);
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

  // ---- welcome: every visit starts with the golden doors; a tap opens them. Tilting the phone (or moving the mouse) moves the light. ----
  // the doors do not cut through the logo: they part along its right-hand outline, so the logo stays whole on the left door.
  // points are (x, y) as fractions of the logo's width and height (computed from the logo's real shape plus a safety margin)
  const DOOR_CUT = [[0.6437, -0.15], [0.6437, 0.1141], [0.9525, 0.4019], [0.972, 0.4301], [0.9984, 0.4451], [0.9984, 0.4583], [0.9889, 0.4658], [0.7994, 0.5448], [0.7851, 0.5542], [0.7989, 0.5636], [0.9968, 0.6483], [0.9984, 0.6953], [0.8717, 0.7423], [0.858, 0.7498], [0.8906, 0.7875], [0.9065, 0.8213], [0.9065, 0.8495], [0.8986, 0.8721], [0.8605, 0.9154], [0.8225, 0.9398], [0.7876, 0.9567], [0.6917, 0.9925], [0.6764, 1.0013], [0.496, 1.0671]];
  function showWelcome(onEnter) {
    return new Promise((resolve) => {
      window.__lanikoReady = true;
      const el = $("welcome");
      if (!el || !document.documentElement.classList.contains("has-welcome")) { onEnter(false); return resolve(); }
      welcomeEl = el;
      updateLock();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const label = $("wl-enter-t");
      // the word "Enter" changes language every 2 seconds, through all 8 languages, starting with the visitor's own
      let n = Math.max(0, I.LANGS.findIndex((l) => l.code === (I.hasChoice() ? I.lang : "en")));
      const showWord = () => { const l = I.LANGS[n]; label.textContent = I.phrase(l.code, "welEnter"); label.lang = l.code; label.dir = l.dir; };
      showWord();
      const cyc = setInterval(() => {
        label.classList.add("swap");
        setTimeout(() => { n = (n + 1) % I.LANGS.length; showWord(); label.classList.remove("swap"); }, 380);
      }, 2000);
      // parallax: phone tilt (Android) or mouse / finger drag; eased so it never jumps
      let tx = 0, ty = 0, gx = 0, gy = 0, raf = 0, base = null;
      const step = () => {
        raf = 0;
        tx += (gx - tx) * 0.12; ty += (gy - ty) * 0.12;
        el.style.setProperty("--tx", tx.toFixed(1) + "px"); el.style.setProperty("--ty", ty.toFixed(1) + "px");
        if (Math.abs(gx - tx) > 0.1 || Math.abs(gy - ty) > 0.1) raf = requestAnimationFrame(step);
      };
      const aim = (x, y) => { gx = x; gy = y; if (!raf) raf = requestAnimationFrame(step); };
      const onMove = (e) => aim(-(e.clientX / innerWidth - 0.5) * 26, -(e.clientY / innerHeight - 0.5) * 18);
      const onTilt = (e) => {
        if (e.gamma == null || e.beta == null) return;
        if (base === null) base = e.beta;
        aim(-Math.max(-30, Math.min(30, e.gamma)) / 30 * 14, -Math.max(-25, Math.min(25, e.beta - base)) / 25 * 10);
      };
      const D = window.DeviceOrientationEvent;
      const tiltOn = !reduced && D && typeof D.requestPermission !== "function";   // iPhone would need a permission pop-up: it uses finger drag instead
      if (!reduced) el.addEventListener("pointermove", onMove);
      if (tiltOn) window.addEventListener("deviceorientation", onTilt);
      let opened = false;
      const open = () => {
        if (opened) return; opened = true;
        try { sessionStorage.setItem("laniko-welcome", "1"); } catch {}
        clearInterval(cyc);
        el.removeEventListener("pointermove", onMove);
        if (tiltOn) window.removeEventListener("deviceorientation", onTilt);
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        // measure the logo where it is right now and cut the two doors along its outline
        const lr = el.querySelector(".wl-logo").getBoundingClientRect(), Wd = el.clientWidth, Hd = el.clientHeight;
        const mid = DOOR_CUT.slice(1).map(([u, v]) => [lr.left + u * lr.width, lr.top + v * lr.height]);
        const line = [[lr.left + DOOR_CUT[0][0] * lr.width, 0], ...mid, [mid[mid.length - 1][0], Hd]];
        const pts = line.map((p) => p[0].toFixed(1) + "px " + p[1].toFixed(1) + "px").join(", ");
        el.querySelector(".wl-l").style.clipPath = `polygon(0px 0px, ${pts}, 0px ${Hd}px)`;
        el.querySelector(".wl-r").style.clipPath = `polygon(${pts}, ${Wd}px ${Hd}px, ${Wd}px 0px)`;
        el.classList.add("open");
        onEnter(true);                                         // the first-visit window appears right behind the opening doors
        setTimeout(() => {
          document.removeEventListener("keydown", onKey);
          if (tiltOn) window.removeEventListener("deviceorientation", onTilt);
          if (raf) cancelAnimationFrame(raf);
          el.remove(); welcomeEl = null;
          document.documentElement.classList.remove("has-welcome");
          updateLock();
          resolve();
        }, reduced ? 650 : 1750);
      };
      el.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });   // stops the browser from painting its own tap highlight on the touched element
      el.addEventListener("mousedown", (e) => e.preventDefault());           // no text selection or focus highlight on a tap
      let down = null;
      el.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
      el.addEventListener("pointerup", (e) => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 14) open(); down = null; });   // opens on the touch itself, without waiting for the click
      el.addEventListener("click", open);
      const onKey = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };     // keyboard users: Enter or Space
      document.addEventListener("keydown", onKey);
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
  // AR. First choice: our own WebXR view (ar.js): live ring on any surface the camera finds, tap to place.
  // Fallback: Google's <model-viewer> (iPhone Quick Look, or phones without WebXR).
  let arEl = null, arNative = null;
  function teardownAR() { if (arEl) { arEl.remove(); arEl = null; } arNative = null; $("viewer-ar").hidden = true; }
  const arLabels = () => ({ scan: t("arScan"), tap: t("arTap"), tapRough: t("arTapRough"), placed: t("arPlaced"), move: t("arMove"), exit: t("arExit"), now: t("arNow"), slow: t("arSlow"), real: t("arReal"), weak: t("arWeak") });
  async function setupModelViewer(p) {
    if (!customElements.get("model-viewer")) await import(AR_LIB);
    if (viewerProductId !== p.id || $("viewer").hidden) return;
    const mv = document.createElement("model-viewer");
    mv.setAttribute("src", new URL(p.arModel || p.model, location.origin).href);
    mv.setAttribute("alt", p.name);
    mv.setAttribute("ar", ""); mv.setAttribute("ar-modes", "webxr scene-viewer quick-look");
    mv.setAttribute("ar-scale", "fixed"); mv.setAttribute("ar-placement", "floor");
    mv.setAttribute("loading", "eager");
    mv.style.cssText = "position:fixed;left:-20px;top:-20px;width:8px;height:8px;opacity:0;pointer-events:none";
    document.body.appendChild(mv);
    arEl = mv;
    mv.addEventListener("load", () => { if (arEl === mv && mv.canActivateAR) $("viewer-ar").hidden = false; });
  }
  async function setupAR(p) {
    if (!p.model && !p.arModel) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;      // AR is for phones and tablets
    const url = new URL(p.arModel || p.model, location.origin).href;
    try {
      const mod = await import("/ar.js");
      if (await mod.supported()) {
        await mod.prepare(url);                                       // load the light model first, so the tap can open AR at once
        if (viewerProductId !== p.id || $("viewer").hidden) return;
        arNative = { mod, url, p };
        $("viewer-ar").hidden = false;
        return;
      }
    } catch (e) { console.warn("Own AR view unavailable", e); }
    try { await setupModelViewer(p); } catch (e) { console.warn("AR unavailable", e); }
  }
  $("viewer-ar").addEventListener("click", async () => {
    if (arNative) {
      const { mod, url, p } = arNative;
      try { await mod.startAR(url, arLabels()); return; }
      catch (e) {
        console.warn("Own AR view failed, using the standard one", e);
        arNative = null;
        try {
          await setupModelViewer(p);
          if (arEl && !arEl.canActivateAR) await new Promise((res) => { arEl.addEventListener("load", res, { once: true }); setTimeout(res, 5000); });
          if (arEl && arEl.canActivateAR) arEl.activateAR(); else $("viewer-ar").hidden = true;
        } catch { $("viewer-ar").hidden = true; }
        return;
      }
    }
    if (arEl && arEl.canActivateAR) arEl.activateAR();
  });
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
    const ch = e.target.closest("[data-chapter]");
    if (ch) { const p = byId(detailId); if (p) import("/chapter.js").then((m) => m.openChapter(featureCtx(), p)); return; }
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
    if (gate && I.hasChoice()) closeGate();
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
    }
    // every visit starts with the welcome doors; language and country are asked only while they are not known yet
    const askChoices = (afterDoors) => {
      if (gl) return;
      const intro = afterDoors && (!location.hash || location.hash === "#/" || location.hash === "#/perfumes");   // the introduction follows the opening doors only; deep links (a shared list, a gift, a perfume) go straight to their page
      if (!I.hasChoice()) { if (intro) introAfterGate = true; showGate(true, true); }
      else if (!country) { if (intro) introAfterGate = true; showGate("country", true); }
      else if (intro) playIntro();
    };
    const welcomed = showWelcome(askChoices);

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
    renderCountryLine();
    resolveProducts();

  }
  init();
})();
