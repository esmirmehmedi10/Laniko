(() => {
  const CART_KEY = "shop-cart-v1";
  const WISH_KEY = "shop-wishlist-v1";
  const fmt = (n) => new Intl.NumberFormat("en-LU", { style: "currency", currency: "EUR" }).format(n);
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

  // ---- pages (hash routing: #/perfumes, #/top-sellers, #/wishlist) ----
  const ROUTES = {
    "perfumes": {
      title: "The Collection",
      sub: "Extrait de Parfum · 50 ml",
      list: () => products,
      empty: "No perfumes to show yet.",
    },
    "top-sellers": {
      title: "Top sellers",
      sub: "The fragrances our customers come back for.",
      list: () => products.filter((p) => p.rank).sort((a, b) => a.rank - b.rank),
      empty: "Our top sellers will appear here soon.",
    },
    "wishlist": {
      title: "Your wishlist",
      sub: "Saved on this device.",
      list: () => wish.map(byId).filter(Boolean),
      empty: "Nothing saved yet. Tap the heart on any perfume to keep it here.",
    },
  };

  function currentRoute() {
    const m = location.hash.match(/^#\/([\w-]+)/);
    return m && ROUTES[m[1]] ? m[1] : "perfumes";
  }

  const HEART = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

  function cardHTML(p, route) {
    const liked = wish.includes(p.id);
    const rank = route === "top-sellers" && p.rank ? `<span class="rank" aria-label="Number ${p.rank}">${p.rank}</span>` : "";
    return `
      <article class="card">
        <div class="media">
          <button class="imgbtn" data-view="${esc(p.id)}" aria-label="View ${esc(p.name)} in 3D">
            <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
            <span class="badge3d">3D</span>
          </button>
          <button class="heart${liked ? " on" : ""}" data-wish="${esc(p.id)}" aria-pressed="${liked}" aria-label="Save ${esc(p.name)} to wishlist">${HEART}</button>
          ${rank}
        </div>
        <div class="body">
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description)}</p>
          <span class="price">${fmt(p.price)}</span>
          <button class="add" data-add="${esc(p.id)}">Add to cart</button>
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
    $("page-title").textContent = cfg.title;
    $("page-sub").textContent = cfg.sub;
    const list = cfg.list();
    if (!list.length) {
      const cta = route === "wishlist" ? '<p><a class="link-btn" href="#/perfumes">Browse the collection</a></p>' : "";
      $("products").innerHTML = `<div class="empty"><p>${esc(cfg.empty)}</p>${cta}</div>`;
      return;
    }
    $("products").innerHTML = list.map((p) => cardHTML(p, route)).join("");
    watchImages($("products"));
  }

  // ---- wishlist ----
  function updateWishUI() {
    const el = $("tab-wish-count");
    el.textContent = wish.length;
    el.hidden = wish.length === 0;
  }

  function toggleWish(id) {
    const i = wish.indexOf(id);
    if (i >= 0) { wish.splice(i, 1); toast("Removed from wishlist"); }
    else { wish.push(id); toast("Saved to wishlist"); }
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
    $("viewer-hint").textContent = "Drag to rotate · pinch to zoom";
    const stage = $("viewer-stage");
    stage.innerHTML = "";
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
    } catch (e) {
      console.error("3D viewer failed", e);
      stage.innerHTML = `<img src="${esc(p.image)}" alt="${esc(p.name)}">`;
      $("viewer-hint").textContent = "3D view isn't available on this device.";
    }
  }

  function closeViewer() {
    if (viewer) { viewer.dispose(); viewer = null; }
    viewerProductId = null;
    $("viewer").hidden = true;
    $("viewer-stage").innerHTML = "";
    document.body.style.overflow = "";
  }

  // ---- cart ----
  function renderCart() {
    // Drop items that no longer exist in the catalog
    Object.keys(cart).forEach((id) => { if (!byId(id)) delete cart[id]; });
    const ids = Object.keys(cart);
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
              <button data-dec="${esc(id)}" aria-label="Less">−</button>
              <span>${cart[id]}</span>
              <button data-inc="${esc(id)}" aria-label="More">+</button>
            </div>
          </div>`;
        }).join("")
      : "<p class='small'>Your cart is empty.</p>";
    watchImages($("cart-items"));
    saveJSON(CART_KEY, cart);
  }

  function change(id, delta) {
    cart[id] = Math.min(20, (cart[id] || 0) + delta);
    if (cart[id] <= 0) delete cart[id];
    renderCart();
  }

  async function checkout() {
    const btn = $("checkout-btn");
    btn.disabled = true;
    btn.textContent = "Redirecting…";
    try {
      const items = Object.entries(cart).map(([id, quantity]) => ({ id, quantity }));
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      showStatus(e.message || "Something went wrong. Please try again.", true);
      btn.disabled = false;
      btn.textContent = "Checkout";
    }
  }

  function showStatus(msg, warn) {
    const el = $("status");
    el.textContent = msg;
    el.className = "notice" + (warn ? " warn" : "");
    el.hidden = false;
  }

  // ---- events ----
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.view) openViewer(t.dataset.view);
    else if (t.dataset.wish) toggleWish(t.dataset.wish);
    else if (t.dataset.add) { change(t.dataset.add, 1); $("cart").hidden = false; }
    else if (t.dataset.inc) change(t.dataset.inc, 1);
    else if (t.dataset.dec) change(t.dataset.dec, -1);
  });
  $("cart-btn").addEventListener("click", () => { $("cart").hidden = !$("cart").hidden; });
  $("cart-close").addEventListener("click", () => { $("cart").hidden = true; });
  $("checkout-btn").addEventListener("click", checkout);
  $("viewer-close").addEventListener("click", closeViewer);
  $("viewer-add").addEventListener("click", () => {
    if (viewerProductId) change(viewerProductId, 1);
    closeViewer();
    $("cart").hidden = false;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("viewer").hidden) closeViewer(); });
  window.addEventListener("hashchange", () => {
    $("cart").hidden = true;
    renderPage();
    window.scrollTo(0, 0);
  });

  // fetch the 3D code in the background once the page is idle, so opening a viewer is instant
  function warmViewer() {
    const go = () => import("/viewer.js").catch(() => {});
    if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 4000 });
    else setTimeout(go, 2000);
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    if (params.get("canceled")) showStatus("Checkout canceled. Your cart is still here.", true);
    updateWishUI();
    $("page-title").textContent = ROUTES[currentRoute()].title;
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
      $("products").textContent = "Could not load products.";
    }
    renderCart();
  }
  init();
})();
