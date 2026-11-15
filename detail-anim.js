// Scroll-linked animation of the product page: as the customer scrolls the text, the bottle turns once, the cap
// lifts off and the perfume sprays. The frames are rendered from the 3D model (tools/render_sequence.py);
// the scroll position (how far) picks the frame and the scroll speed sets how fast the animation follows and how
// forceful the spray is. The mist is drawn live on a second canvas.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export async function createScrollAnimation({ stage, canvas, mist, poster, scroller, base, reduce }) {
  let meta = null;
  try {
    const r = await fetch(base + "/meta.json");
    if (r.ok) meta = await r.json();
  } catch { /* no frames: the page still shows the plain picture */ }
  if (!meta) return null;

  const N = meta.frames, T = meta.turn, C = meta.cap, PR = meta.press;
  const nozzle = meta.nozzle || { x: 0.5, y: 0.3 };
  const FW = 750, FH = 1000;          // size of one frame
  const frames = new Array(N).fill(null);
  let disposed = false;

  // ---- loading: the first picture at once, then every 4th frame, then the rest
  const load = (i) => new Promise((res) => {
    if (frames[i] || disposed) return res();
    const im = new Image();
    im.decoding = "async";
    im.onload = () => { frames[i] = im; res(); kick(); };
    im.onerror = () => res();
    im.src = `${base}/${String(i).padStart(2, "0")}.webp`;
  });
  const order = [0];
  for (let i = 4; i < N; i += 4) order.push(i);
  for (let i = 1; i < N; i++) if (!order.includes(i)) order.push(i);
  order.push(N - 1);
  (async () => {
    await load(0);
    if (poster) poster.style.opacity = "0";
    const queue = order.slice(1);
    const worker = async () => { while (queue.length && !disposed) await load(queue.shift()); };
    await Promise.all([worker(), worker(), worker()]);
  })();
  const nearest = (i) => {
    for (let d = 0; d < N; d++) {
      if (frames[i - d]) return frames[i - d];
      if (frames[i + d]) return frames[i + d];
    }
    return null;
  };

  // ---- scroll position -> frame
  const frameAt = (p) => {
    if (p <= 0.5) return (p / 0.5) * (T - 1);                         // the bottle turns once
    if (p <= 0.52) return T - 1 + (p - 0.5) / 0.02;
    if (p <= 0.8) return T + ((p - 0.52) / 0.28) * (C - 1);           // the cap lifts off
    if (p <= 0.92) return T + C - 1 + ((p - 0.8) / 0.12) * PR;       // the spray button goes down
    return N - 1;
  };
  const SPRAY_A = 0.8, SPRAY_B = 0.95;

  // ---- drawing
  const ctx = canvas.getContext("2d");
  const mctx = mist.getContext("2d");
  let cw = 1, ch = 1, dpr = 1, sc = 1, dx = 0, dy = 0;
  const layout = () => {
    cw = stage.clientWidth || 1; ch = stage.clientHeight || 1;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [canvas, mist]) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    sc = Math.max(cw / FW, ch / FH);                  // the frame fills the stage (cover) ...
    dx = (cw - FW * sc) / 2;
    dy = (ch - FH * sc) * 0.12;                       // ... showing mostly the upper part (the cap goes up there)
    kick();
  };
  const ro = new ResizeObserver(layout);
  ro.observe(stage);

  let target = 0, shown = 0, p = 0, lastP = 0, lastT = 0, vel = 0, sprayed = 0;
  let raf = 0, lastTick = 0;

  const draw = () => {
    const i0 = clamp(Math.floor(shown), 0, N - 1), i1 = Math.min(N - 1, i0 + 1), a = shown - i0;
    const A = nearest(i0), B = nearest(i1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (A) ctx.drawImage(A, dx, dy, FW * sc, FH * sc);
    if (B && B !== A && a > 0.01) { ctx.globalAlpha = a; ctx.drawImage(B, dx, dy, FW * sc, FH * sc); ctx.globalAlpha = 1; }
  };

  // ---- mist (soft puffs and fine droplets leaving the nozzle; how forceful depends on how fast the page is scrolled)
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  {
    const g = sprite.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,246,226,1)"); gr.addColorStop(0.4, "rgba(255,240,214,.55)"); gr.addColorStop(1, "rgba(255,236,205,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  const parts = [];
  const nozzlePx = () => ({ x: dx + nozzle.x * FW * sc, y: dy + nozzle.y * FH * sc });
  const emit = (count, power) => {
    const o = nozzlePx(), k = cw / 390;
    for (let n = 0; n < count; n++) {
      const droplet = Math.random() < 0.3;
      const ang = (-12 + (Math.random() - 0.5) * 40) * Math.PI / 180;
      const sp = (droplet ? 520 : 300) * k * power * (0.6 + Math.random() * 0.7);
      parts.push({
        x: o.x + Math.random() * 14 * power, y: o.y + (Math.random() - 0.5) * 5,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        r0: droplet ? 1 : 4 * k, r1: droplet ? 2.2 : (18 + Math.random() * 34) * k,
        life: droplet ? 0.5 + Math.random() * 0.5 : 0.9 + Math.random() * 0.9, age: -Math.random() * 0.3,
        a: droplet ? 0.7 : 0.04 + Math.random() * 0.05, droplet,
      });
    }
  };
  const stepMist = (dt) => {
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, cw, ch);
    if (!parts.length) return;
    mctx.globalCompositeOperation = "lighter";
    const k = cw / 390;
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.age += dt;
      if (q.age < 0) continue;
      const u = q.age / q.life;
      if (u >= 1) { parts.splice(i, 1); continue; }
      const drag = Math.exp(-(q.droplet ? 1.6 : 2.6) * dt);
      q.vx *= drag; q.vy = q.vy * drag - (q.droplet ? -260 * k : 40 * k) * dt;   // droplets fall, puffs drift up
      q.x += q.vx * dt; q.y += q.vy * dt;
      const r = q.r0 + (q.r1 - q.r0) * Math.sqrt(u);
      mctx.globalAlpha = q.a * (1 - u) * (1 - u) * (q.droplet ? 1 : Math.min(1, u * 3.5));
      mctx.drawImage(sprite, q.x - r, q.y - r, r * 2, r * 2);
    }
    mctx.globalAlpha = 1;
    mctx.globalCompositeOperation = "source-over";
  };

  // ---- the animation loop only runs while something moves
  const tick = (ts) => {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.05, lastTick ? (ts - lastTick) / 1000 : 0.016);
    lastTick = ts;
    // the picture follows the scroll position; the faster the page moves, the faster it follows
    shown += (target - shown) * (reduce ? 1 : 1 - Math.exp(-dt * 10));
    if (Math.abs(target - shown) < 0.004) shown = target;
    draw();
    stepMist(dt);
    if (shown !== target || parts.length) raf = requestAnimationFrame(tick);
    else lastTick = 0;
  };
  function kick() { if (!raf && !disposed) raf = requestAnimationFrame(tick); }

  const onScroll = () => {
    const range = scroller.scrollHeight - scroller.clientHeight;
    const now = performance.now();
    p = range > 0 ? clamp(scroller.scrollTop / range, 0, 1) : 0;
    target = frameAt(p);
    stage.style.setProperty("--p", p.toFixed(4));
    const dt = Math.max(0.008, (now - lastT) / 1000);
    const v = Math.abs(p - lastP) / dt;                       // scroll speed in "whole pages per second"
    vel = vel * 0.5 + v * 0.5;
    if (!reduce) {
      if (p < 0.74) sprayed = 0;                              // scrolled back up: it can spray again
      if (p > lastP && p > SPRAY_A) {
        const from = Math.max(lastP, SPRAY_A), to = Math.min(p, SPRAY_B);
        if (to > from && sprayed < 1) {
          const frac = (to - from) / (SPRAY_B - SPRAY_A);
          sprayed += frac;
          emit(Math.max(3, Math.round(frac * 170)), 0.55 + clamp(vel, 0, 3) * 0.5);   // amount scrolled -> amount of mist, speed -> force
        }
      }
    }
    lastP = p; lastT = now;
    kick();
  };
  scroller.addEventListener("scroll", onScroll, { passive: true });
  layout();
  onScroll();

  return {
    refresh() { layout(); onScroll(); },
    dispose() { disposed = true; ro.disconnect(); scroller.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); },
  };
}
