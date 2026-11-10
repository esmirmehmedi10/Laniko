(() => {
  const CART_KEY = "shop-cart-v1";
  const fmt = (n) => new Intl.NumberFormat("en-LU", { style: "currency", currency: "EUR" }).format(n);
  const $ = (id) => document.getElementById(id);

  let products = [];
  let cart = load(); // { [productId]: quantity }

  function load() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch { return {}; }
  }
  function save() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }
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

  function renderProducts() {
    $("products").innerHTML = products.map((p) => `
      <article class="card">
        <button class="imgbtn" data-view="${esc(p.id)}" aria-label="View ${esc(p.name)} in 3D">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
          <span class="badge3d">3D</span>
        </button>
        <div class="body">
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description)}</p>
          <span class="price">${fmt(p.price)}</span>
          <button data-add="${esc(p.id)}">Add to cart</button>
        </div>
      </article>`).join("");
    watchImages($("products"));
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
    $("viewer").hidden = false;
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
    save();
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

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.view) openViewer(t.dataset.view);
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

  async function init() {
    const params = new URLSearchParams(location.search);
    if (params.get("canceled")) showStatus("Checkout canceled. Your cart is still here.", true);
    try {
      const res = await fetch("/products.json", { cache: "no-cache" });
      products = await res.json();
      renderProducts();
    } catch {
      $("products").textContent = "Could not load products.";
    }
    renderCart();
  }
  init();
})();
