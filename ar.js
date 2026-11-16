// Our own augmented-reality view (WebXR, Android Chrome / Brave / Samsung Internet).
// Why not just <model-viewer>: its surface search only listens for large "plane" hits, which takes a long time to appear.
// Here the hit test also accepts feature points, so the ring shows up within a second or two, and the visitor taps to put the bottle down.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const FLAT = 0.7;          // surface normal this close to "up" counts as floor / table
const SLOW_MS = 7000;      // after this long without any surface, offer "place in front of me"
const LOST_MS = 900;       // a hit that disappears for this long hides the ring again

export async function supported() {
  try { return !!(navigator.xr && (await navigator.xr.isSessionSupported("immersive-ar"))); } catch { return false; }
}

// ---------- model (kept between visits; bottom of the bottle sits on y = 0, centred) ----------
const models = new Map();
export function prepare(url) {
  if (!models.has(url)) {
    const p = new GLTFLoader().loadAsync(url).then((g) => {
      const root = g.scene;
      const box = new THREE.Box3().setFromObject(root);
      const c = box.getCenter(new THREE.Vector3());
      root.position.set(-c.x, -box.min.y, -c.z);
      root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      const holder = new THREE.Group();
      holder.add(root);
      holder.userData.cm = box.getSize(new THREE.Vector3()).y * 100;   // real height (model units are metres)
      return holder;
    });
    p.catch(() => models.delete(url));
    models.set(url, p);
  }
  return models.get(url);
}

// ---------- choose the best surface among the hit-test results (nearest first) ----------
// A flat one (floor, table) wins; otherwise the nearest point is used and marked as "rough".
export function pickHit(results, space) {
  let rough = null;
  for (const r of results) {
    const pose = r.getPose(space);
    if (!pose) continue;
    const m = pose.transform.matrix;                   // column-major; m[5] = how much the surface normal points up
    const flat = m[5] > FLAT;
    const h = { x: m[12], y: m[13], z: m[14], flat };
    if (flat) return h;
    if (!rough) rough = h;
  }
  return rough;
}

function buildUI(L) {
  const root = document.createElement("div");
  root.className = "ar-ui";
  root.innerHTML =
    '<button type="button" class="ar-x" data-ar="exit"></button>' +
    '<div class="ar-scan" aria-hidden="true"><i></i></div>' +
    '<p class="ar-hint" role="status"></p>' +
    '<div class="ar-row"><button type="button" class="ar-b" data-ar="now" hidden></button><button type="button" class="ar-b" data-ar="move" hidden></button>' +
    '<span class="ar-size" hidden><button type="button" class="ar-b ar-sq" data-ar="minus" aria-label="−">−</button><button type="button" class="ar-b" data-ar="real"></button><button type="button" class="ar-b ar-sq" data-ar="plus" aria-label="+">+</button></span></div>';
  const q = (s) => root.querySelector(s);
  q(".ar-x").setAttribute("aria-label", L.exit);
  q(".ar-x").textContent = "✕";
  q('[data-ar="now"]').textContent = L.now;
  q('[data-ar="move"]').textContent = L.move;
  return { root, size: q(".ar-size"), minus: q('[data-ar="minus"]'), plus: q('[data-ar="plus"]'), real: q('[data-ar="real"]'), hint: q(".ar-hint"), scan: q(".ar-scan"), exit: q('[data-ar="exit"]'), now: q('[data-ar="now"]'), move: q('[data-ar="move"]') };
}

// ---------- start a session. Must be called straight from a tap (browsers require it). ----------
export async function startAR(url, L, opts = {}) {
  const model = await prepare(url);
  const ui = buildUI(L);
  document.body.appendChild(ui.root);

  let session;
  try {
    session = await (opts.xr || navigator.xr).requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay", "anchors", "light-estimation"],
      domOverlay: { root: ui.root },
    });
  } catch (e) { ui.root.remove(); throw e; }

  const renderer = opts.renderer || new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.xr.enabled = true;
  if (renderer.shadowMap) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  renderer.xr.setReferenceSpaceType("local");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  if (!opts.noEnv) {
    try {
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;   // so the glass and gold look like glass and gold
      pm.dispose();
    } catch (e) { console.warn("AR environment", e); }
  }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(0.12, 0.6, 0.18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  Object.assign(sun.shadow.camera, { left: -0.2, right: 0.2, top: 0.2, bottom: -0.2, near: 0.1, far: 1.5 });
  sun.shadow.bias = -0.0008;

  // stage = bottle + its soft shadow, positioned on the surface
  const stage = new THREE.Group();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.ShadowMaterial({ opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.0005;
  shadow.receiveShadow = true;
  stage.add(shadow, sun, sun.target, model);
  stage.visible = false;
  scene.add(stage);

  // ring on the surface the camera has found
  const reticle = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xd9b96a, transparent: true, opacity: 0.95, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.085, 0.1, 48).rotateX(-Math.PI / 2), ringMat);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24).rotateX(-Math.PI / 2), ringMat);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.125, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
  reticle.add(ring, dot, halo);
  reticle.visible = false;
  scene.add(reticle);

  // ----- state -----
  let mode = "scan";                  // scan -> ready (surface found) -> placed
  let hit = null, lastHitAt = 0, popAt = 0, hintKey = "";
  const t0 = performance.now();
  let hitSource = null, viewerSpace = null, ended = false;
  let anchor = null, wantAnchor = null;           // an anchor keeps the bottle glued to the spot even when the phone corrects its map
  const cm = model.userData.cm || 10.4;
  const MIN = 0.3, MAX = 4;

  function say(key) {
    if (hintKey === key) return;
    hintKey = key;
    ui.hint.textContent = L[key];
  }
  function show(on) {
    reticle.visible = on;
    stage.visible = on || mode === "placed";
    ui.scan.hidden = mode !== "scan";
  }
  function place(h) {
    mode = "placed";
    stage.position.set(h.x, h.y, h.z);
    const c = camera.matrixWorld.elements;                      // turn the front of the bottle towards the visitor
    model.rotation.y = Math.atan2(c[12] - h.x, c[14] - h.z);
    stage.scale.setScalar(1);
    popAt = performance.now();
    show(false);
    say("placed");
    ui.move.hidden = false;
    ui.now.hidden = true;
    ui.size.hidden = false;
    wantAnchor = { x: h.x, y: h.y, z: h.z };
    sizeLabel();
    try { navigator.vibrate && navigator.vibrate(14); } catch { /* not supported */ }
  }
  function onSelect() {
    if (mode === "placed" || !hit) return;
    place(hit);
  }
  function placeInFront() {
    if (mode === "placed") return;
    const e = camera.matrixWorld.elements;
    let fx = -e[8], fz = -e[10];                                 // camera looks down -Z
    const n = Math.hypot(fx, fz) || 1;
    fx /= n; fz /= n;
    place({ x: e[12] + fx * 0.6, y: e[13] - 0.55, z: e[14] + fz * 0.6, flat: false });
  }
  function setScale(k) { stage.scale.setScalar(Math.min(MAX, Math.max(MIN, k))); sizeLabel(); }
  function sizeLabel() {
    const k = stage.scale.x, h = (cm * k).toFixed(1);
    ui.real.textContent = Math.abs(k - 1) < 0.005 ? L.real + " · " + h + " cm" : h + " cm · 1:1";
  }
  function startMoving() {
    try { anchor && anchor.delete(); } catch { /* gone */ }
    anchor = null; wantAnchor = null;
    ui.size.hidden = true;
    mode = hit && performance.now() - lastHitAt < LOST_MS ? "ready" : "scan";
    ui.move.hidden = true;
    say(mode === "ready" ? (hit.flat ? "tap" : "tapRough") : "scan");
    show(mode === "ready");
    stage.visible = mode === "ready";
  }

  session.addEventListener("select", onSelect);
  ui.root.addEventListener("beforexrselect", (e) => { if (e.target && e.target.closest && e.target.closest("button")) e.preventDefault(); });
  ui.exit.addEventListener("click", () => session.end());
  ui.now.addEventListener("click", placeInFront);
  ui.move.addEventListener("click", startMoving);
  ui.minus.addEventListener("click", () => setScale(stage.scale.x / 1.15));
  ui.plus.addEventListener("click", () => setScale(stage.scale.x * 1.15));
  ui.real.addEventListener("click", () => setScale(1));

  // one finger turns the bottle, two fingers resize it (after it is placed)
  const ptrs = new Map();
  let pinch0 = 0, scale0 = 1;
  ui.root.addEventListener("pointerdown", (e) => {
    if (e.target.closest && e.target.closest("button")) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y) || 1; scale0 = stage.scale.x; }
  });
  ui.root.addEventListener("pointermove", (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p || mode !== "placed") return;
    if (ptrs.size === 1) model.rotation.y += (e.clientX - p.x) * 0.012;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      setScale(scale0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch0));
    }
  });
  const up = (e) => ptrs.delete(e.pointerId);
  ui.root.addEventListener("pointerup", up);
  ui.root.addEventListener("pointercancel", up);

  // ----- hit test: planes AND feature points, so a surface shows up quickly -----
  try {
    viewerSpace = await session.requestReferenceSpace("viewer");
    try { hitSource = await session.requestHitTestSource({ space: viewerSpace, entityTypes: ["plane", "point"] }); }
    catch { hitSource = await session.requestHitTestSource({ space: viewerSpace }); }
  } catch (e) { console.warn("AR hit test", e); }

  say("scan");
  ui.scan.hidden = false;
  await renderer.xr.setSession(session);

  function frame(time, xrFrame) {
    if (ended) return;
    const now = performance.now();
    if (xrFrame && hitSource && mode !== "placed") {
      const h = pickHit(xrFrame.getHitTestResults(hitSource), renderer.xr.getReferenceSpace());
      if (h) {
        lastHitAt = now;
        if (!hit || mode === "scan") { hit = { ...h }; } else {              // glide instead of jumping
          hit.x += (h.x - hit.x) * 0.4; hit.y += (h.y - hit.y) * 0.4; hit.z += (h.z - hit.z) * 0.4; hit.flat = h.flat;
        }
        if (mode === "scan") { mode = "ready"; ui.now.hidden = true; }
        reticle.position.set(hit.x, hit.y, hit.z);
        stage.position.set(hit.x, hit.y, hit.z);
        ringMat.color.setHex(hit.flat ? 0xd9b96a : 0xffffff);
        ringMat.opacity = hit.flat ? 0.95 : 0.7;
        say(hit.flat ? "tap" : "tapRough");
        show(true);
        const s = 1 + Math.sin(now / 260) * 0.05;                              // gentle pulse
        ring.scale.set(s, 1, s); halo.scale.set(1.08 - (s - 1), 1, 1.08 - (s - 1));
      } else if (mode === "ready" && now - lastHitAt > LOST_MS) {
        mode = "scan"; hit = null; say("scan"); show(false);
      }
      if (mode === "scan" && now - t0 > SLOW_MS) { say("slow"); ui.now.hidden = false; }
    }
    if (mode === "placed" && xrFrame) {
      const space = renderer.xr.getReferenceSpace();
      if (wantAnchor && xrFrame.createAnchor) {                                 // pin the bottle to the real world
        const w = wantAnchor; wantAnchor = null;
        try {
          xrFrame.createAnchor(new XRRigidTransform({ x: w.x, y: w.y, z: w.z, w: 1 }), space)
            .then((a) => { if (mode === "placed" && !ended) anchor = a; else a.delete(); }).catch(() => {});
        } catch { /* anchors not available: the bottle simply stays at its spot */ }
      }
      if (anchor) {
        const pose = xrFrame.getPose(anchor.anchorSpace, space);
        if (pose) { const t = pose.transform.position; stage.position.set(t.x, t.y, t.z); }
      }
    }
    if (popAt) {                                                                // small "settle" when placed
      const k = Math.min(1, (now - popAt) / 260);
      model.scale.setScalar(0.85 + 0.15 * (1 - Math.pow(1 - k, 3)));
      if (k >= 1) { popAt = 0; model.scale.setScalar(1); }
    }
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  function cleanup() {
    if (ended) return;
    ended = true;
    try { renderer.setAnimationLoop(null); } catch { /* already gone */ }
    try { hitSource && hitSource.cancel(); } catch { /* already gone */ }
    stage.remove(model);
    model.scale.setScalar(1);
    ui.root.remove();
    try { renderer.dispose(); } catch { /* already gone */ }
  }
  session.addEventListener("end", cleanup);
  return { session, end: () => session.end(), _frame: frame, _ui: ui, _stage: stage, _state: () => ({ mode, hit }) };
}
