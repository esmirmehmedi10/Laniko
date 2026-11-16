// Scroll-linked film of the product page. The frames are rendered from the 3D model (tools/render_sequence.py):
//   1. the bottle turns once            2. the camera pushes in and tilts down onto the cap
//   3. the cap lifts off and flies away 4. the spray button is pressed and the perfume sprays
// How far the page is scrolled picks the frame; how fast it is scrolled sets how forceful the spray is.
// The mist is simulated live (fine jet, soft cloud, droplets) on a second canvas, from the nozzle position and direction stored per frame.
//
// Speed: the frames are kept as compressed files and only a window around the current frame (plus a few key frames)
// is decoded into ImageBitmaps, off the main thread, so scrolling never waits for a decode and memory stays small.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

export async function createScrollAnimation({ stage, canvas, mist, poster, scroller, base, reduce }) {
  let meta = null;
  try {
    const r = await fetch(base + "/meta.json");
    if (r.ok) meta = await r.json();
  } catch { /* no frames: the page still shows the plain picture */ }
  if (!meta || meta.v !== 2) return null;

  const N = meta.frames, T = meta.turn, PU = meta.push, LF = meta.lift, PR = meta.press;
  const NZ = meta.nz;                       // per frame: nozzle x, y (0..1), spray direction (camera space), zoom
  const FW = 750, FH = 1000;                // logical size of one frame (the pictures are 900 x 1200)
  const HOLD = N - PR - 1;                  // last frame before the button goes down
  let disposed = false;

  // ---- loading: compressed files first (key frames first), decoded on demand
  const blobs = new Array(N).fill(null);
  const bmps = new Array(N).fill(null);
  const pending = new Set();
  const useBitmap = typeof createImageBitmap === "function";
  const KEY = 16;                           // every 16th frame stays decoded
  const url = (i) => `${base}/${String(i).padStart(2, "0")}.webp`;
  let cur = 0, dirn = 1;
  let loadedFirst = false;

  const decode = (i) => {
    if (bmps[i] || pending.has(i) || !blobs[i]) return;
    pending.add(i);
    const done = (bm) => {
      pending.delete(i);
      if (disposed || !keep(i)) { if (bm && bm.close) bm.close(); return; }
      bmps[i] = bm; kick();
    };
    if (useBitmap) createImageBitmap(blobs[i]).then(done, () => pending.delete(i));
    else {
      const im = new Image(); const u = URL.createObjectURL(blobs[i]);
      im.onload = () => { URL.revokeObjectURL(u); done(im); }; im.onerror = () => pending.delete(i); im.src = u;
    }
  };
  const keep = (i) => i % KEY === 0 || i === N - 1 || (i >= cur - 5 && i <= cur + 18) || !useBitmap;
  const manage = () => {
    // decode what is about to be needed (more ahead of the scroll direction), release what is far away
    const a = dirn >= 0 ? 5 : 18, b = dirn >= 0 ? 18 : 5;
    for (let i = Math.max(0, cur - a); i <= Math.min(N - 1, cur + b); i++) decode(i);
    if (useBitmap) for (let i = 0; i < N; i++) if (bmps[i] && !keep(i)) { bmps[i].close && bmps[i].close(); bmps[i] = null; }
  };
  const fetchFrame = async (i) => {
    if (blobs[i] || disposed) return;
    try { const r = await fetch(url(i)); if (r.ok) blobs[i] = await r.blob(); } catch { /* skip */ }
    if (blobs[i]) { if (Math.abs(i - cur) < 24 || i % KEY === 0) decode(i); if (!loadedFirst && i === 0) { loadedFirst = true; if (poster) poster.style.opacity = "0"; } kick(); }
  };
  const order = [0];
  for (let i = KEY; i < N; i += KEY) order.push(i);
  for (let i = 1; i < N; i++) if (!order.includes(i)) order.push(i);
  (async () => {
    await fetchFrame(0);
    const queue = order.slice(1);
    const worker = async () => { while (queue.length && !disposed) await fetchFrame(queue.shift()); };
    await Promise.all([worker(), worker(), worker(), worker()]);
  })();

  const nearest = (i) => {
    for (let d = 0; d < N; d++) {
      if (bmps[i - d]) return bmps[i - d];
      if (bmps[i + d]) return bmps[i + d];
    }
    return null;
  };

  // ---- scroll position -> frame
  const S1 = 0.28, S2 = 0.40, S3 = 0.58, S4 = 0.66, S5 = 0.90;     // end of: turn, push-in, cap lift, pause, press
  const frameAt = (p) => {
    if (p <= S1) return (p / S1) * (T - 1);
    if (p <= S2) return lerp(T - 1, T + PU - 1, (p - S1) / (S2 - S1));
    if (p <= S3) return lerp(T + PU - 1, T + PU + LF - 1, (p - S2) / (S3 - S2));
    if (p <= S4) return T + PU + LF - 1;
    if (p <= S5) return lerp(HOLD, N - 1, (p - S4) / (S5 - S4));
    return N - 1;
  };
  const SPRAY_A = 0.685, SPRAY_B = 0.90;

  // ---- drawing
  const ctx = canvas.getContext("2d");
  const mctx = mist.getContext("2d");
  let cw = 1, ch = 1, dpr = 1, mdpr = 1, sc = 1, dx = 0, dy = 0, k = 1;
  let range = 1;
  const layout = () => {
    cw = stage.clientWidth || 1; ch = stage.clientHeight || 1;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    mdpr = Math.min(dpr, 1.25);                      // the mist is soft anyway: a smaller canvas is much cheaper
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    mist.width = Math.round(cw * mdpr); mist.height = Math.round(ch * mdpr);
    sc = Math.max(cw / FW, ch / FH);                  // the frame fills the stage (cover) ...
    dx = (cw - FW * sc) / 2;
    dy = (ch - FH * sc) * 0.12;                       // ... showing mostly the upper part (the action is up there)
    k = cw / 390;
    range = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    lastKey = "";
    kick();
  };
  const ro = new ResizeObserver(layout);
  ro.observe(stage);

  let target = 0, shown = 0, p = 0, lastP = 0, lastT = 0, vel = 0, sprayed = 0, lastKey = "";
  let raf = 0, lastTick = 0;

  const draw = () => {
    const i0 = clamp(Math.floor(shown), 0, N - 1), i1 = Math.min(N - 1, i0 + 1);
    let a = shown - i0; if (a < 0.03) a = 0; else if (a > 0.97) a = 1;
    const A = nearest(i0), B = a > 0 ? nearest(i1) : null;
    const key = i0 + ":" + a.toFixed(2) + ":" + (A ? 1 : 0) + (B ? 1 : 0) + cw + ch;
    if (key === lastKey) return;
    lastKey = key;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (!A) return;
    ctx.globalAlpha = 1;
    ctx.drawImage(A, dx, dy, FW * sc, FH * sc);
    if (B && B !== A && a > 0) { ctx.globalAlpha = a; ctx.drawImage(B, dx, dy, FW * sc, FH * sc); ctx.globalAlpha = 1; }
  };

  // ---- mist. A real atomiser makes an almost invisible cone of tiny droplets that is dense on the axis, widens quickly,
  // slows down within a hand's width and then hangs as a fine fog that swirls. Three layers, all fake-3D (x, y in pixels, z towards the viewer):
  //   haze     thousands of tiny, very faint soft specks: together they make the smooth, widening cone
  //   droplets crisp 1 px points / short streaks at the leading edge and around the cone
  //   fog      a few big, very faint puffs that linger and drift
  const fogSprite = document.createElement("canvas");
  fogSprite.width = fogSprite.height = 64;
  {
    const g = fogSprite.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    [[0, 1], [0.2, 0.72], [0.42, 0.34], [0.65, 0.1], [0.85, 0.02], [1, 0]].forEach(([o, a]) => gr.addColorStop(o, `rgba(246,246,243,${a})`));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  const parts = [];
  const MAXP = 1700;

  // nozzle position, spray direction and zoom at the frame that is shown now
  const nozzleNow = () => {
    const f = clamp(shown, 0, N - 1), i = Math.floor(f), j = Math.min(N - 1, i + 1), t = f - i;
    const a = NZ[i], b = NZ[j], m = (n) => lerp(a[n], b[n], t);
    return { x: dx + m(0) * FW * sc, y: dy + m(1) * FH * sc, ux: m(2), uy: m(3), uz: m(4), zoom: m(5) };
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;      // roughly -1..1, bell shaped
  // a random direction inside a cone (half angle in degrees) around the spray direction; dense on the axis
  const coneDir = (n, deg) => {
    let ux = n.ux, uy = -n.uy, uz = n.uz;                       // screen y points down
    const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
    let ax = -uz, ay = 0, az = ux;                              // any vector perpendicular to u
    let al = Math.hypot(ax, ay, az); if (al < 0.05) { ax = 0; ay = 1; az = 0; al = 1; }
    ax /= al; ay /= al; az /= al;
    const bx = uy * az - uz * ay, by = uz * ax - ux * az, bz = ux * ay - uy * ax;
    const th = Math.tan(deg * Math.PI / 180 * Math.abs(gauss())), ph = Math.random() * Math.PI * 2;
    const c = Math.cos(ph) * th, s = Math.sin(ph) * th;
    const x = ux + ax * c + bx * s, y = uy + ay * c + by * s, z = uz + az * c + bz * s;
    const m = Math.hypot(x, y, z); return [x / m, y / m, z / m];
  };
  const emit = (amount, power) => {            // amount: share of the whole spray (0..1), power: how forcefully (scroll speed)
    const n = nozzleNow(), kk = k * Math.max(0.8, n.zoom / 2.6);
    const room = MAXP - parts.length; if (room <= 0) return;
    const cnt = (x) => Math.min(room, Math.max(1, Math.round(x * amount)));
    const mk = (o) => {
      const d = coneDir(n, o.cone), sp = o.speed * kk * power * rnd(0.7, 1.2), st = rnd(0, 6) * kk;
      parts.push({
        kind: o.kind, ox: n.x, oy: n.y, x: d[0] * st, y: d[1] * st, z: d[2] * st,
        vx: d[0] * sp, vy: d[1] * sp, vz: d[2] * sp, drag: o.drag * rnd(0.85, 1.15), grav: o.grav * kk, buoy: o.buoy * kk, turb: o.turb * kk,
        r0: o.r0 * kk, r1: o.r1 * kk, life: rnd(o.life[0], o.life[1]), age: -rnd(0, o.delay), a: o.a * rnd(0.7, 1.25), ph: Math.random() * 6.28, px: 0, py: 0,
      });
    };
    for (let i = cnt(760); i > 0; i--) mk({ kind: 0, cone: 17, speed: 1050, drag: 2.5, grav: 0, buoy: 14, turb: 70, r0: rnd(3, 7), r1: rnd(24, 58), life: [0.8, 1.7], delay: 0.18, a: 0.1 });
    for (let i = cnt(420); i > 0; i--) mk({ kind: 1, cone: 20, speed: 1250, drag: 2.0, grav: 90, buoy: 0, turb: 25, r0: rnd(0.8, 1.5), r1: 0, life: [0.3, 0.9], delay: 0.14, a: 0.7 });
    for (let i = cnt(46); i > 0; i--) mk({ kind: 2, cone: 14, speed: 420, drag: 1.9, grav: 0, buoy: 26, turb: 110, r0: rnd(14, 24), r1: rnd(46, 90), life: [1.4, 2.6], delay: 0.22, a: 0.045 });
  };
  const stepMist = (dt) => {
    if (!parts.length) { if (mistDirty) { mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, mist.width, mist.height); mistDirty = false; } return; }
    mistDirty = true;
    mctx.setTransform(mdpr, 0, 0, mdpr, 0, 0);
    mctx.clearRect(0, 0, cw, ch);
    mctx.fillStyle = "rgb(252,252,250)";
    const ZC = 1100 * k;
    const t = performance.now() / 1000;
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.age += dt;
      if (q.age < 0) continue;
      const u = q.age / q.life;
      if (u >= 1) { parts.splice(i, 1); continue; }
      const drag = Math.exp(-q.drag * dt);
      q.vx *= drag; q.vy *= drag; q.vz *= drag;
      // turbulence grows as the spray slows down and mixes with the air; a little warm air lifts the fog
      const tb = q.turb * (0.25 + q.age * 1.8) * dt;
      q.vx += Math.sin(t * 5.3 + q.ph + q.y * 0.045) * tb;
      q.vy += (Math.cos(t * 4.1 + q.ph * 1.7 + q.x * 0.045) * tb) + (q.grav - q.buoy) * dt;
      q.px = q.x; q.py = q.y;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z = Math.min(q.z + q.vz * dt, ZC * 0.8);
      const f = 1 / (1 - q.z / ZC);              // things that come towards the viewer get bigger and spread faster
      const sx = q.ox + q.x * f, sy = q.oy + q.y * f;
      if (q.kind === 1) {                       // droplet: a crisp point, a short streak while it is fast
        const r = Math.max(1, q.r0 * f * 1.3);                                         // a drop: a tiny bright square (cheap to draw, reads as a point)
        mctx.globalAlpha = q.a * (1 - u);
        mctx.fillRect(sx - r / 2, sy - r / 2, r, r);
      } else {                                  // haze / fog: a very faint soft speck that grows as it spreads
        const r = (q.r0 + (q.r1 - q.r0) * Math.sqrt(u)) * f;
        mctx.globalAlpha = q.a * Math.min(1, u * 8) * (1 - u) * (1 - u);
        mctx.drawImage(fogSprite, sx - r, sy - r, r * 2, r * 2);
      }
    }
    mctx.globalAlpha = 1;
  };
  let mistDirty = false;

  // ---- the animation loop only runs while something moves
  const tick = (ts) => {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.05, lastTick ? (ts - lastTick) / 1000 : 0.016);
    lastTick = ts;
    // the picture follows the scroll position; the faster the page moves, the faster it follows
    const before = shown;
    shown += (target - shown) * (reduce ? 1 : 1 - Math.exp(-dt * 11));
    if (Math.abs(target - shown) < 0.004) shown = target;
    const c = Math.round(shown);
    if (c !== cur) { dirn = shown >= before ? 1 : -1; cur = c; manage(); }
    draw();
    stepMist(dt);
    if (shown !== target || parts.length) raf = requestAnimationFrame(tick);
    else lastTick = 0;
  };
  function kick() { if (!raf && !disposed) raf = requestAnimationFrame(tick); }

  let setP = -1;
  const onScroll = () => {
    const now = performance.now();
    p = clamp(scroller.scrollTop / range, 0, 1);
    target = frameAt(p);
    if (p < 0.12 || setP < 0.12) { stage.style.setProperty("--p", p.toFixed(3)); setP = p; }
    const dt = Math.max(0.008, (now - lastT) / 1000);
    const v = Math.abs(p - lastP) / dt;                       // scroll speed in "whole pages per second"
    vel = vel * 0.5 + v * 0.5;
    if (!reduce) {
      if (p < 0.62) sprayed = 0;                              // scrolled back up: it can spray again
      if (p > lastP && p > SPRAY_A) {
        const from = Math.max(lastP, SPRAY_A), to = Math.min(p, SPRAY_B);
        if (to > from && sprayed < 1) {
          const frac = (to - from) / (SPRAY_B - SPRAY_A);
          sprayed += frac;
          emit(Math.min(1, frac), 0.7 + clamp(vel, 0, 3) * 0.35);   // amount scrolled -> amount of mist, speed -> force
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
    dispose() {
      disposed = true; ro.disconnect(); scroller.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      bmps.forEach((b, i) => { if (b && b.close) b.close(); bmps[i] = null; });
    },
  };
}
