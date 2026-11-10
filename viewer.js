// 3D viewer (Three.js, loaded from a CDN through the import map in index.html).
//
// What happens when it opens:
//   0.0s  the animated background is already there (CSS) and the WebGL background fades in over it
//   ~0.1s the still life is built: bottle + this perfume's ingredients (roses, wood, fruit, ...)
//   then  everything rises out of a glossy dark surface while spinning in, and light smoke starts
//         curling up from the ingredients
//   ~1.3s drag to rotate, pinch to zoom
//
// Everything is generated in code (no model files): opal glass body, lathe-turned polished gold cap,
// foil label, procedural roses / wood / fruit / berries / lavender / resin, soft shadows and a
// reflection in the surface.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const hash3 = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
function seeded(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let s = h >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const DEFAULT_THEME = { bgDark: "#0b0907", glow: "#8a6a2f", smoke: "#d9b96a" };

// ================================================================ label textures

function drawSpaced(g, text, cx, y, spacing) {
  const chars = [...text];
  const widths = chars.map((c) => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  g.textAlign = "left";
  chars.forEach((c, i) => { g.fillText(c, x, y); x += widths[i] + spacing; });
}

// mode "color": the visible label. mode "orm": roughness (green) + metalness (blue),
// so the gold ink reflects like real foil while the rest of the label stays matte.
function drawLabel(product, mode) {
  const W = 1024, H = 1280;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const serif = '"Cormorant Garamond", "Times New Roman", Georgia, serif';
  const BG = mode === "color" ? product.labelColor || "#efe3c8" : "rgb(0,125,0)";
  const INK = mode === "color" ? product.labelInk || "#d9b96a" : "rgb(0,55,255)";
  g.fillStyle = BG; g.fillRect(0, 0, W, H);
  g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(36, 36, W - 72, H - 72);
  g.lineWidth = 3; g.strokeRect(62, 62, W - 124, H - 124);
  g.fillStyle = INK; g.textBaseline = "middle";
  g.font = `600 118px ${serif}`;
  drawSpaced(g, "LANIKO", W / 2, 290, 34);
  const divider = (y) => {
    g.fillStyle = INK;
    g.fillRect(170, y - 1.5, W / 2 - 170 - 36, 3);
    g.fillRect(W / 2 + 36, y - 1.5, W / 2 - 170 - 36, 3);
    g.save(); g.translate(W / 2, y); g.rotate(Math.PI / 4); g.fillRect(-12, -12, 24, 24); g.restore();
  };
  divider(430);
  const words = product.name.toUpperCase().split(" ");
  g.fillStyle = INK; g.font = `600 92px ${serif}`;
  const lines = words.length > 1 ? [words[0], words.slice(1).join(" ")] : words;
  const top = lines.length === 1 ? 650 : 610;
  lines.forEach((line, i) => drawSpaced(g, line, W / 2, top + i * 120, 14));
  divider(880);
  g.fillStyle = INK; g.font = `500 48px ${serif}`;
  drawSpaced(g, "EXTRAIT DE PARFUM", W / 2, 985, 9);
  g.font = `500 42px ${serif}`;
  drawSpaced(g, "50 ML  ·  45 %", W / 2, 1075, 7);
  return c;
}

function makeLabelMaps(product, anisotropy) {
  const map = new THREE.CanvasTexture(drawLabel(product, "color"));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = anisotropy;
  const orm = new THREE.CanvasTexture(drawLabel(product, "orm"));
  orm.anisotropy = anisotropy;
  return { map, orm };
}

// ================================================================ generic helpers

function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function radialTexture(stops, size = 256) {
  return canvasTexture(size, size, (g) => {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([p, color]) => grad.addColorStop(p, color));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  });
}

// parametric surface: fn(u, v) -> [x, y, z], u and v in 0..1
function gridGeo(nu, nv, fn) {
  const pos = [], idx = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) pos.push(...fn(i / nu, j / nv));
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// copy of `base` moved by `matrix`, painted with a vertex colour (so many pieces merge into one mesh)
function coloredPiece(base, matrix, color) {
  const g = base.clone();
  g.applyMatrix4(matrix);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

const at = (obj, x, z, yaw = 0, y = 0) => {
  obj.position.set(x, y, z);
  obj.rotation.y = yaw;
  return obj;
};

// ================================================================ lighting environment

// A dark studio with a few large soft-boxes. This is what the gold, glass and foil reflect,
// so it needs strong contrast: bright panels against a dark gradient.
function makeStudioEnvironment() {
  const env = new THREE.Scene();
  const dome = new THREE.SphereGeometry(14, 48, 24);
  const cols = [];
  const p = dome.attributes.position;
  const bottom = new THREE.Color(0x0d0906), mid = new THREE.Color(0x2c2218), top = new THREE.Color(0x5a4c3a);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) / 14 + 1) / 2; // 0 bottom .. 1 top
    const c = t < 0.5 ? bottom.clone().lerp(mid, t * 2) : mid.clone().lerp(top, (t - 0.5) * 2);
    cols.push(c.r, c.g, c.b);
  }
  dome.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  env.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  const panel = (w, h, color, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(7, 9, new THREE.Color(10, 9, 7.6), [6, 4, 6]);        // big warm key
  panel(2.2, 10, new THREE.Color(7, 7.4, 8.6), [-6.5, 3, 5]);  // tall cool strip, left
  panel(2, 10, new THREE.Color(9, 8, 6.6), [7.5, 3, -3]);      // rim strip, right-back
  panel(2, 10, new THREE.Color(8, 7.4, 6.6), [-5, 3, -7.5]);   // rim strip, left-back
  panel(10, 4, new THREE.Color(5, 4.8, 4.4), [0, 9, 0]);       // overhead
  panel(8, 2, new THREE.Color(2.5, 2.3, 2), [0, 0.8, 8]);      // low front fill
  panel(1.2, 1.2, new THREE.Color(18, 17, 15), [3, 5, 8]);     // hot spot for sparkle
  return env;
}

// ================================================================ the bottle

function capProfile(R, H, r, seg = 8) {
  const V = (x, y) => new THREE.Vector2(x, y);
  const pts = [V(0, 0), V(R - r, 0)];
  for (let i = 1; i <= seg; i++) {
    const a = (i / seg) * (Math.PI / 2);
    pts.push(V(R - r + Math.sin(a) * r, r - Math.cos(a) * r));
  }
  pts.push(V(R, H - r));
  for (let i = 1; i <= seg; i++) {
    const a = (i / seg) * (Math.PI / 2);
    pts.push(V(R - r + Math.cos(a) * r, H - r + Math.sin(a) * r));
  }
  pts.push(V(0, H));
  return pts;
}

// Turned-metal cap profile: rounded lower lip, a fine groove, slight taper, big rounded top edge,
// and a shallow ring recess on the top face. Corners are doubled so they stay crisp.
function detailedCapProfile() {
  const P = [];
  const V = (x, y) => P.push(new THREE.Vector2(x, y));
  const corner = (x, y) => { V(x, y); V(x, y); };
  const arc = (cx, cy, r, a0, a1, n) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      V(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
  };
  V(0, 0);
  V(0.46, 0);
  arc(0.46, 0.03, 0.03, -Math.PI / 2, 0, 6); // lower lip -> (0.49, 0.03)
  corner(0.49, 0.12);
  corner(0.474, 0.135); // groove
  corner(0.474, 0.155);
  corner(0.49, 0.17);
  V(0.497, 0.6); // slight taper
  arc(0.447, 0.6, 0.05, 0, Math.PI / 2, 8); // top edge -> (0.447, 0.65)
  V(0.42, 0.65);
  corner(0.415, 0.642); // recessed ring on the top face
  corner(0.37, 0.642);
  corner(0.365, 0.65);
  V(0, 0.65);
  return P;
}

// Bottle stands on y = 0 and is about 2.74 units tall.
function buildBottle(maps) {
  const g = new THREE.Group();

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xf1e8d4,
    roughness: 0.22,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    ior: 1.5,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xfff3dc),
    sheenRoughness: 0.45,
  });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.9, 0.9, 12, 0.13), glass);
  body.position.y = 0.95;
  g.add(body);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.5),
    new THREE.MeshStandardMaterial({
      map: maps.map,
      metalnessMap: maps.orm,
      roughnessMap: maps.orm,
      metalness: 1,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  label.position.set(0, 0.9, 0.452);
  g.add(label);

  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xf6d27c,
    metalness: 1,
    roughness: 0.11,
    clearcoat: 0.25,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.3,
  });
  const goldSoft = new THREE.MeshStandardMaterial({ color: 0xd9b25e, metalness: 1, roughness: 0.28, envMapIntensity: 1.1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.55, metalness: 0 });

  const collar = new THREE.Mesh(new THREE.LatheGeometry(capProfile(0.31, 0.15, 0.02, 4), 64), goldSoft);
  collar.position.y = 1.9;
  const gap = new THREE.Mesh(new THREE.CylinderGeometry(0.425, 0.425, 0.035, 64), black);
  gap.position.y = 2.0725;
  const cap = new THREE.Mesh(new THREE.LatheGeometry(detailedCapProfile(), 96), gold);
  cap.position.y = 2.09;
  cap.scale.set(0.87, 1, 0.87); // keeps the cap inside the 0.9-deep body
  g.add(collar, gap, cap);
  return g;
}

// ================================================================ ingredients (props)

function petalGeo(len, width) {
  return gridGeo(7, 8, (u, v) => {
    const s = Math.sin(Math.PI * Math.pow(u, 0.8));
    const w = width * 0.5 * Math.pow(s, 0.8);
    const z = (v * 2 - 1) * w;
    const y = 0.35 * width * Math.pow(v * 2 - 1, 2) * s;
    return [u * len, y, z];
  });
}

function makeStarFlower(rand, { petals = 5, len = 0.3, width = 0.2, color = 0xfdfbf4, pitch = 0.45, center = 0xe8d27a } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.5, sheen: 0.8, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xffffff),
    side: THREE.DoubleSide, emissive: new THREE.Color(color), emissiveIntensity: 0.05,
  });
  for (let i = 0; i < petals; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / petals) * TAU + (rand() - 0.5) * 0.12;
    const m = new THREE.Mesh(petalGeo(len, width), mat);
    m.rotation.z = pitch + (rand() - 0.5) * 0.12;
    pivot.add(m);
    g.add(pivot);
  }
  const c = new THREE.Mesh(
    new THREE.SphereGeometry(len * 0.13, 12, 8),
    new THREE.MeshStandardMaterial({ color: center, roughness: 0.6 })
  );
  c.position.y = len * 0.1;
  g.add(c);
  return g;
}

// An open rose made of nested, scalloped petal cups (lathe shells with wavy rims).
function makeRose(rand, color = 0xf3e7d3, size = 0.85) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.55, sheen: 1, sheenRoughness: 0.4,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45),
    side: THREE.DoubleSide, emissive: new THREE.Color(color), emissiveIntensity: 0.06,
  });
  const layers = [
    { R: 0.055, H: 0.3, k: 3, f: 0.0 },
    { R: 0.085, H: 0.32, k: 3, f: 0.05 },
    { R: 0.12, H: 0.33, k: 4, f: 0.12 },
    { R: 0.165, H: 0.32, k: 4, f: 0.25 },
    { R: 0.215, H: 0.3, k: 5, f: 0.4 },
    { R: 0.27, H: 0.26, k: 5, f: 0.6 },
    { R: 0.33, H: 0.2, k: 6, f: 0.85 },
  ];
  layers.forEach((L, i) => {
    const pts = [];
    const n = 14;
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const r = L.R * (0.28 + 0.72 * Math.sin((t * Math.PI) / 2)) + L.f * L.R * 0.6 * Math.pow(t, 2.6);
      pts.push(new THREE.Vector2(r, t * L.H));
    }
    const geo = new THREE.LatheGeometry(pts, 56);
    const pos = geo.attributes.position;
    const phase = i * 2.399;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      const t = y / L.H;
      const lobe = Math.cos(L.k * Math.atan2(z, x) + phase);
      const s = 1 + 0.16 * t * t * lobe;
      pos.setXYZ(v, x * s, y - 0.06 * L.H * Math.pow(t, 3) * (1 - lobe), z * s);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.position.y = -i * 0.012 + 0.09;
    m.rotation.y = phase;
    g.add(m);
  });
  g.scale.setScalar(size);
  g.rotation.x = (rand() - 0.5) * 0.18;
  g.rotation.z = (rand() - 0.5) * 0.18;
  return g;
}

function scatterPetals(rand, count, color, x0, x1, z0, z1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.55, sheen: 1, sheenRoughness: 0.4,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4),
    side: THREE.DoubleSide, emissive: new THREE.Color(color), emissiveIntensity: 0.05,
  });
  for (let i = 0; i < count; i++) {
    const L = 0.22 * (0.8 + rand() * 0.5), W = 0.17 * (0.8 + rand() * 0.4);
    const geo = gridGeo(8, 8, (u, v) => {
      const s = Math.sin(Math.PI * u);
      const w = W * 0.5 * Math.pow(s, 0.7) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, u * 1.3)));
      return [(u - 0.5) * L, 0.05 * Math.pow(2 * v - 1, 2) * s + 0.02 * (u - 0.5), (v * 2 - 1) * w];
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(lerp(x0, x1, rand()), 0.008, lerp(z0, z1, rand()));
    m.rotation.y = rand() * TAU;
    m.rotation.z = (rand() - 0.5) * 0.2;
    g.add(m);
  }
  return g;
}

const podMaterial = () =>
  new THREE.MeshPhysicalMaterial({ color: 0x2a160b, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 });

function makePodBundle(rand, count = 3, len = 1.1) {
  const g = new THREE.Group();
  const mat = podMaterial();
  const r = 0.028;
  for (let k = 0; k < count; k++) {
    const pts = [];
    const n = 5;
    const sway = (rand() - 0.5) * 0.3;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(new THREE.Vector3(
        (t - 0.5) * len * (0.9 + rand() * 0.15),
        r + 0.004 + Math.sin(t * Math.PI) * 0.012 + (k === 1 ? r * 1.6 : 0) * Math.sin(t * Math.PI),
        k * 0.07 - 0.07 + Math.sin(t * Math.PI * 1.3 + sway * 6) * 0.1
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, r, 8, false), mat));
    const capGeo = new THREE.SphereGeometry(r, 8, 6);
    const c1 = new THREE.Mesh(capGeo, mat); c1.position.copy(pts[0]);
    const c2 = new THREE.Mesh(capGeo, mat); c2.position.copy(pts[n]);
    g.add(c1, c2);
  }
  return g;
}

function woodTextures(rand, base, dark, light) {
  const side = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rand() * w;
      g.strokeStyle = rand() < 0.5 ? dark : light;
      g.globalAlpha = 0.08 + rand() * 0.22;
      g.lineWidth = 0.6 + rand() * 2.4;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + rand() * 16 - 8, 80, x + rand() * 16 - 8, 170, x + rand() * 10 - 5, h);
      g.stroke();
    }
    g.globalAlpha = 1;
  });
  side.wrapS = side.wrapT = THREE.RepeatWrapping;
  const cap = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cx = w / 2 + (rand() - 0.5) * 18, cy = h / 2 + (rand() - 0.5) * 18;
    let flip = false;
    for (let r = 128; r > 3; r -= 5 + rand() * 6) {
      g.fillStyle = flip ? dark : light;
      g.globalAlpha = 0.35;
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
      flip = !flip;
    }
    g.globalAlpha = 1;
  });
  return { side, cap };
}

function makeLog(rand, { len = 1.0, radius = 0.17, base = "#b58a58", dark = "#6b4a2a", light = "#d3aa78" } = {}) {
  const { side, cap } = woodTextures(rand, base, dark, light);
  const geo = new THREE.CylinderGeometry(radius, radius * 0.92, len, 10, 6, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const j = 1 + 0.1 * Math.sin(3 * a + 1.7) + 0.07 * Math.sin(5 * a + y * 2.3) + 0.05 * Math.sin(2 * a - y * 4.1);
    pos.setXYZ(i, x * j, y, z * j);
  }
  geo.computeVertexNormals();
  const sideMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.82 });
  const capMat = new THREE.MeshStandardMaterial({ map: cap, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, [sideMat, capMat, capMat]);
  mesh.rotation.z = Math.PI / 2;
  mesh.position.y = radius * 0.95;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

function makeResin(rand, { size = 0.1, color = 0xc8741a, emissive = 0x4a2204 } = {}) {
  const geo = new THREE.IcosahedronGeometry(size, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 0.82 + 0.36 * hash3(Math.round(x * 997), Math.round(y * 997), Math.round(z * 997));
    pos.setXYZ(i, x * k, y * k * 0.8, z * k * 1.1);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05,
    emissive, emissiveIntensity: 0.6, flatShading: true, ior: 1.55,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = size * 0.7;
  m.rotation.set((rand() - 0.5) * 0.4, rand() * TAU, (rand() - 0.5) * 0.4);
  const g = new THREE.Group();
  g.add(m);
  return g;
}

function faceTexture() {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = "#f4a15a"; g.beginPath(); g.arc(128, 128, 127, 0, TAU); g.fill();
    g.fillStyle = "#fbe8d8"; g.beginPath(); g.arc(128, 128, 114, 0, TAU); g.fill();
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU + 0.06, a1 = ((i + 1) / n) * TAU - 0.06;
      const grad = g.createRadialGradient(128, 128, 10, 128, 128, 104);
      grad.addColorStop(0, "#e5405f"); grad.addColorStop(1, "#f27a86");
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 104, a0, a1); g.closePath(); g.fill();
    }
    g.fillStyle = "#fbe8d8"; g.beginPath(); g.arc(128, 128, 11, 0, TAU); g.fill();
  });
}

function makeGrapefruitHalf(rand) {
  const g = new THREE.Group();
  const r = 0.4;
  const rind = new THREE.MeshPhysicalMaterial({ color: 0xf08a4b, roughness: 0.6, sheen: 0.4, sheenColor: new THREE.Color(0xffc48a) });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 20, 0, TAU, Math.PI / 2, Math.PI / 2), rind);
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(r * 0.995, 48),
    new THREE.MeshPhysicalMaterial({ map: faceTexture(), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 })
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.002;
  g.add(dome, face);
  g.rotation.x = 0.55;
  g.rotation.z = (rand() - 0.5) * 0.3;
  g.position.y = r;
  const outer = new THREE.Group();
  outer.add(g);
  return outer;
}

function makeSlice(rand) {
  const faceMat = new THREE.MeshPhysicalMaterial({ map: faceTexture(), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xf4a15a, roughness: 0.6 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.045, 40), [rimMat, faceMat, faceMat]);
  m.position.y = 0.024;
  m.rotation.z = (rand() - 0.5) * 0.1;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

function makeSaffron(rand) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xc2260c, roughness: 0.45, emissive: 0x3a0a02 });
  for (let i = 0; i < 9; i++) {
    const a = rand() * TAU, L = 0.35 + rand() * 0.2;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const pts = [
      V(0, 0.01, 0),
      V(Math.cos(a) * L * 0.4, 0.02 + rand() * 0.03, Math.sin(a) * L * 0.4),
      V(Math.cos(a + 0.5) * L * 0.8, 0.01 + rand() * 0.02, Math.sin(a + 0.5) * L * 0.8),
      V(Math.cos(a + 0.3) * L, 0.01, Math.sin(a + 0.3) * L),
    ];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.006, 4, false), mat));
  }
  return g;
}

function makeRaspberry(rand) {
  const R = 0.12;
  const base = new THREE.SphereGeometry(0.038, 10, 8);
  const pieces = [];
  const rings = [[0, 1], [0.45, 6], [0.9, 11], [1.35, 15]];
  const m4 = new THREE.Matrix4();
  rings.forEach(([phi, n]) => {
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU + phi;
      m4.makeTranslation(R * Math.sin(phi) * Math.cos(th), R * Math.cos(phi) * 1.15, R * Math.sin(phi) * Math.sin(th));
      const shade = 0.85 + rand() * 0.3;
      pieces.push(coloredPiece(base, m4, new THREE.Color(0xb3122e).multiplyScalar(shade)));
    }
  });
  const berry = new THREE.Mesh(
    mergeGeometries(pieces),
    new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.25 })
  );
  const back = new THREE.Mesh(
    new THREE.CircleGeometry(R * Math.sin(1.35), 20),
    new THREE.MeshStandardMaterial({ color: 0x4a0712, roughness: 0.7, side: THREE.DoubleSide })
  );
  back.rotation.x = Math.PI / 2;
  back.position.y = R * Math.cos(1.35) * 1.15;
  const inner = new THREE.Group();
  inner.add(berry, back);
  inner.rotation.x = 1.2;
  inner.rotation.z = (rand() - 0.5) * 0.8;
  inner.position.y = 0.12;
  const g = new THREE.Group();
  g.add(inner);
  return g;
}

function makeBlueberries(rand, count = 7) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x27356b, roughness: 0.38, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x8fa4d8),
  });
  const crown = new THREE.MeshStandardMaterial({ color: 0x151a33, roughness: 0.8, side: THREE.DoubleSide });
  const geo = new THREE.SphereGeometry(0.065, 18, 14);
  const crownGeo = new THREE.CircleGeometry(0.02, 5);
  for (let i = 0; i < count; i++) {
    const a = rand() * TAU, d = Math.sqrt(rand()) * 0.22;
    const s = 0.85 + rand() * 0.35;
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(s, s * 0.9, s);
    m.position.set(Math.cos(a) * d, 0.062 * s, Math.sin(a) * d);
    const c = new THREE.Mesh(crownGeo, crown);
    c.rotation.x = -Math.PI / 2;
    c.position.set(m.position.x, m.position.y + 0.056 * s, m.position.z);
    g.add(m, c);
  }
  return g;
}

function makeLavender(rand, sprigs = 5, len = 1.1) {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x6a8a45, roughness: 0.7 });
  const budMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const budBase = new THREE.SphereGeometry(0.018, 6, 5);
  const m4 = new THREE.Matrix4();
  for (let s = 0; s < sprigs; s++) {
    const spread = (s - (sprigs - 1) / 2) * 0.12;
    const bow = (rand() - 0.5) * 0.1;
    const pts = [0, 0.33, 0.66, 1].map((t) => new THREE.Vector3(t * len, 0.03 + Math.sin(t * Math.PI) * 0.03 + s * 0.004, spread * (0.3 + t) + bow * Math.sin(t * Math.PI)));
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.008, 5, false), stemMat));
    const pieces = [];
    for (let k = 0; k < 22; k++) {
      const t = 0.6 + 0.38 * (k / 21);
      const p = curve.getPoint(t);
      for (const sgn of [-1, 1]) {
        m4.makeScale(1.5, 1, 1);
        m4.setPosition(p.x + (rand() - 0.5) * 0.01, p.y + 0.016 * sgn * 0.8, p.z + 0.016 * sgn * (rand() < 0.5 ? 1 : -1));
        const c = new THREE.Color(rand() < 0.5 ? 0x7b5fb8 : 0x9b7fd8);
        pieces.push(coloredPiece(budBase, m4, c));
      }
    }
    g.add(new THREE.Mesh(mergeGeometries(pieces), budMat));
  }
  return g;
}

function makePepper(rand, count = 14, x0 = 0, x1 = 0.6, z0 = 0.9, z1 = 1.2) {
  const base = new THREE.SphereGeometry(0.024, 8, 6);
  const m4 = new THREE.Matrix4();
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const s = 0.85 + rand() * 0.4;
    m4.makeScale(s, s, s);
    m4.setPosition(lerp(x0, x1, rand()), 0.022 * s, lerp(z0, z1, rand()));
    pieces.push(coloredPiece(base, m4, new THREE.Color(rand() < 0.7 ? 0x1c1612 : 0x3a2a1c)));
  }
  return new THREE.Mesh(mergeGeometries(pieces), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 }));
}

// What sits around each perfume. Coordinates are x (left/right) and z (towards the viewer).
// `smoke` lists where light smoke rises from: [x, y, z, size].
const RECIPES = {
  "blanc-royal": (R) => ({
    items: [
      at(makeRose(R, 0xf3e7d3, 0.7), -1.3, -0.1, R() * TAU),
      at(makeRose(R, 0xefe0c8, 0.55), -0.8, 0.92, R() * TAU),
      at(makeStarFlower(R, { petals: 5, len: 0.28, width: 0.3, color: 0xfbf6ec, pitch: 0.4, center: 0xe2c56a }), -1.45, 0.78, R() * TAU, 0.02),
      scatterPetals(R, 6, 0xf3e7d3, -1.6, -0.3, 1.05, 1.35),
      at(makePodBundle(R, 3, 1.0), 1.2, 0.95, -0.5),
      at(makeResin(R, { size: 0.11, color: 0xe9cf8a, emissive: 0x5a4210 }), 1.3, -0.2),
      at(makeResin(R, { size: 0.09, color: 0xe3c57c, emissive: 0x5a4210 }), 0.4, 1.15),
    ],
    smoke: [[1.3, 0.2, -0.2, 0.8], [0.4, 0.15, 1.15, 0.7], [-1.3, 0.35, -0.1, 0.9], [-1.45, 0.2, 0.78, 0.7], [-0.8, 0.3, 0.92, 0.7]],
  }),
  "reve-paradoxe": (R) => ({
    items: [
      at(makeRose(R, 0x8d1423, 0.72), -1.3, -0.15, R() * TAU),
      at(makeGrapefruitHalf(R), -1.2, 0.9, 0.4),
      at(makeSlice(R), 0.95, 0.95, R() * TAU),
      at(makeSlice(R), 1.45, 0.4, R() * TAU),
      at(makeSaffron(R), 0.2, 1.15, R() * TAU),
      at(makeResin(R, { size: 0.11 }), 1.4, -0.35),
      at(makeResin(R, { size: 0.09 }), 0.5, 1.3),
      scatterPetals(R, 4, 0x8d1423, -1.6, -0.9, -0.95, -0.45),
    ],
    smoke: [[1.4, 0.2, -0.35, 0.8], [0.5, 0.15, 1.3, 0.7], [-1.2, 0.6, 0.9, 0.9], [-1.3, 0.35, -0.15, 0.9], [0.2, 0.1, 1.15, 0.6]],
  }),
  "noir-prestige": (R) => ({
    items: [
      at(makeLog(R, { len: 1.0, radius: 0.17, base: "#4a3020", dark: "#241409", light: "#6a4a30" }), 1.2, 0.15, 1.35),
      at(makeLog(R, { len: 0.8, radius: 0.13, base: "#5a3a26", dark: "#2a170a", light: "#7a5638" }), 1.6, 0.55, 1.8),
      at(makePodBundle(R, 3, 1.0), -1.2, 0.85, 0.5),
      at(makePepper(R, 16, -0.2, 0.7, 0.9, 1.25), 0, 0),
      at(makeResin(R, { size: 0.11, color: 0x9a4a12, emissive: 0x3a1a04 }), -1.35, -0.2),
      at(makeResin(R, { size: 0.09, color: 0xa85a18, emissive: 0x3a1a04 }), 0.9, -0.8),
    ],
    smoke: [[1.2, 0.4, 0.15, 0.9], [1.6, 0.3, 0.55, 0.8], [-1.35, 0.2, -0.2, 0.7], [0.9, 0.2, -0.8, 0.7], [-1.2, 0.15, 0.85, 0.6]],
  }),
  "rouge-absolu": (R) => ({
    items: [
      at(makeRose(R, 0x9c1426, 0.7), -1.3, -0.1, R() * TAU),
      at(makeRose(R, 0x8a1020, 0.55), -0.85, -0.98, R() * TAU),
      at(makeRaspberry(R), -1.05, 0.92, R() * TAU),
      at(makeRaspberry(R), -0.6, 1.12, R() * TAU),
      at(makeRaspberry(R), -1.5, 0.6, R() * TAU),
      at(makeLog(R, { len: 0.95, radius: 0.16, base: "#3b2417", dark: "#1c0f07", light: "#5a3a26" }), 1.2, 0.1, 1.35),
      at(makeLog(R, { len: 0.7, radius: 0.13, base: "#442a1b", dark: "#1f1109", light: "#62402b" }), 1.6, 0.5, 1.8),
      at(makeResin(R, { size: 0.11 }), 0.7, 1.1),
      at(makeResin(R, { size: 0.09 }), 1.2, -0.75),
      scatterPetals(R, 4, 0x9c1426, -1.5, -0.5, 1.2, 1.4),
    ],
    smoke: [[1.2, 0.4, 0.1, 0.9], [1.6, 0.3, 0.5, 0.7], [0.7, 0.15, 1.1, 0.7], [-1.3, 0.35, -0.1, 0.9], [-0.85, 0.3, -0.98, 0.8]],
  }),
  "bleu-eternel": (R) => ({
    items: [
      at(makeLavender(R, 5, 1.1), -0.45, 0.85, Math.PI),
      at(makeStarFlower(R, { petals: 5, len: 0.2, width: 0.1, color: 0xfdfbf4, pitch: 0.25, center: 0xe8d27a }), -0.7, 1.2, R() * TAU, 0.03),
      at(makeStarFlower(R, { petals: 5, len: 0.2, width: 0.1, color: 0xfdfbf4, pitch: 0.25, center: 0xe8d27a }), -1.1, 1.3, R() * TAU, 0.03),
      at(makeStarFlower(R, { petals: 5, len: 0.2, width: 0.1, color: 0xfdfbf4, pitch: 0.25, center: 0xe8d27a }), -1.5, 0.2, R() * TAU, 0.03),
      at(makeBlueberries(R, 7), 0.95, 0.95),
      at(makeLog(R, { len: 0.9, radius: 0.15, base: "#6a5442", dark: "#3a2c20", light: "#8a7058" }), 1.3, -0.15, 1.4),
      at(makeResin(R, { size: 0.1 }), 0.65, -0.8),
      at(makeResin(R, { size: 0.09 }), 1.6, 0.5),
    ],
    smoke: [[-1.0, 0.2, 0.85, 0.8], [-0.7, 0.15, 1.2, 0.6], [1.3, 0.3, -0.15, 0.8], [0.65, 0.2, -0.8, 0.7], [0.95, 0.2, 0.95, 0.6]],
  }),
};

const FALLBACK_RECIPE = (R) => ({
  items: [
    at(makeLog(R, { len: 0.9, radius: 0.15 }), 1.25, 0.1, 1.4),
    at(makeResin(R, { size: 0.1 }), 0.8, 1.0),
    at(makeResin(R, { size: 0.09 }), -1.2, 0.6),
  ],
  smoke: [[1.25, 0.3, 0.1, 0.8], [0.8, 0.15, 1.0, 0.7], [-1.2, 0.15, 0.6, 0.7]],
});

// ================================================================ light smoke

function makeSmokeTexture() {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  const img = g.createImageData(S, S);
  const vn = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash3(ix, iy, 1.3), b = hash3(ix + 1, iy, 1.3), c2 = hash3(ix, iy + 1, 1.3), d = hash3(ix + 1, iy + 1, 1.3);
    return a + (b - a) * sx + (c2 - a) * sy + (a - b - c2 + d) * sx * sy;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x / S - 0.5) * 2, dy = (y / S - 0.5) * 2;
      const fall = Math.max(0, 1 - Math.hypot(dx, dy));
      const f = fall * fall * (3 - 2 * fall);
      const n = 0.55 * vn(x * 0.07, y * 0.07) + 0.3 * vn(x * 0.16, y * 0.16) + 0.15 * vn(x * 0.33, y * 0.33);
      const a = Math.min(1, f * (0.35 + 1.1 * n));
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createSmoke(emitters, color, tex) {
  const group = new THREE.Group();
  const parts = [];
  emitters.forEach(([ex, ey, ez, scale]) => {
    for (let i = 0; i < 11; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(mat);
      s.renderOrder = 5;
      group.add(s);
      parts.push({
        s, mat, ex, ey, ez, scale: scale || 1,
        life: 3.2 + Math.random() * 2.2, age: Math.random() * 5,
        phase: Math.random() * TAU, drift: (Math.random() - 0.5) * 0.5,
        ox: (Math.random() - 0.5) * 0.12, oz: (Math.random() - 0.5) * 0.12,
      });
    }
  });
  return {
    group,
    update(dt, time, fade) {
      for (const p of parts) {
        p.age += dt;
        if (p.age > p.life) p.age -= p.life;
        const u = p.age / p.life;
        const rise = 2.3 * (u + 0.25 * u * u);
        const curl = Math.sin(u * 5.5 + p.phase) * 0.14 * (0.3 + u) + Math.sin(time * 0.35 + p.phase) * 0.04;
        p.s.position.set(
          p.ex + p.ox + curl + p.drift * u * u,
          p.ey + rise,
          p.ez + p.oz + Math.cos(u * 4.1 + p.phase) * 0.1 * u
        );
        const sc = p.scale * (0.35 + 1.7 * u);
        p.s.scale.set(sc, sc, 1);
        p.mat.rotation = p.phase + u * 0.9;
        p.mat.opacity = 0.2 * fade * Math.pow(Math.sin(Math.PI * u), 1.4);
      }
    },
  };
}

// ================================================================ dust

function makeDust(count, size, opacity, color, sprite) {
  const positions = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 1] = Math.random() * 6.5;
    positions[i * 3 + 2] = -4 + Math.random() * 6;
    speed[i] = 0.08 + Math.random() * 0.22;
    phase[i] = Math.random() * TAU;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size, map: sprite, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.userData = { positions, speed, phase, baseOpacity: opacity };
  return points;
}

function stepDust(points, dt, time) {
  const { positions, speed, phase } = points.userData;
  for (let i = 0; i < speed.length; i++) {
    positions[i * 3 + 1] += speed[i] * dt;
    positions[i * 3] += Math.sin(time * 0.4 + phase[i]) * 0.0025;
    if (positions[i * 3 + 1] > 6.8) {
      positions[i * 3 + 1] = -0.2;
      positions[i * 3] = (Math.random() - 0.5) * 9;
    }
  }
  points.geometry.attributes.position.needsUpdate = true;
}

// ================================================================ animated background shader

const BG_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const BG_FRAG = `
uniform float uTime;
uniform float uFade;
uniform vec2 uRes;
uniform vec3 uDark;
uniform vec3 uGlow;
uniform vec3 uSmoke;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.02 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.0;
  float t = uTime * 0.08;
  vec2 q = vec2(fbm(p * 1.1 + vec2(0.0, t * 2.0)), fbm(p * 1.1 + vec2(5.2, 1.3) - t));
  float s = fbm(p * 1.5 + 2.4 * q + vec2(t * 1.5, -t * 3.0));
  float smoke = smoothstep(0.32, 0.92, s);
  float d = length(p * vec2(0.85, 0.7) - vec2(0.0, 0.15));
  float glow = exp(-d * d * 1.7);
  vec3 col = uDark * (1.0 - 0.35 * d);
  col += uGlow * glow * 0.85;
  col += uSmoke * smoke * (0.22 + 0.78 * glow) * 0.75;
  col *= smoothstep(2.3, 0.5, length(p));
  gl_FragColor = vec4(col * uFade, uFade);
  #include <colorspace_fragment>
}`;

// ================================================================ viewer

export function createBottleViewer(container, product) {
  const theme = { ...DEFAULT_THEME, ...(product.theme || {}) };
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let disposed = false;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);

  // --- background pass (own scene, drawn first). Alpha fades it in over the CSS background.
  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: BG_VERT,
    fragmentShader: BG_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uDark: { value: new THREE.Color(theme.bgDark) },
      uGlow: { value: new THREE.Color(theme.glow) },
      uSmoke: { value: new THREE.Color(theme.smoke) },
    },
  });
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));

  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 80);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.15, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 4;
  controls.minPolarAngle = 0.75;
  controls.maxPolarAngle = 1.62;
  controls.enabled = false;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  let fitDist = 9;
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    bgMat.uniforms.uRes.value.set(w, h);
    // distance at which the bottle and its ingredients fit on screen (portrait phones need more)
    const t = Math.tan((camera.fov * Math.PI) / 360);
    fitDist = Math.max(1.9 / t, 1.85 / (t * camera.aspect)) + 1.2;
    controls.maxDistance = fitDist * 1.5;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // --- the still life is built right after the first frame so the background shows immediately
  let scene = null, rig = null, smoke = null, dust = null, bokeh = null, shadow = null;
  let envTexture = null, pmrem = null, envScene = null;
  let tBuilt = -1;
  const disposables = [];

  const build = () => {
    if (disposed) return;
    scene = new THREE.Scene();
    pmrem = new THREE.PMREMGenerator(renderer);
    envScene = makeStudioEnvironment();
    envTexture = pmrem.fromScene(envScene, 0.03).texture;
    scene.environment = envTexture;

    const key = new THREE.DirectionalLight(0xfff1d6, 1.2);
    key.position.set(2.5, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4; key.shadow.camera.right = 4;
    key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 20;
    key.shadow.bias = -0.0004;
    key.shadow.camera.updateProjectionMatrix();
    const rim = new THREE.DirectionalLight(new THREE.Color(theme.smoke), 1.0);
    rim.position.set(-4, 3, -5);
    scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.2));

    // glossy dark surface that fades out into the background
    const floorAlpha = radialTexture([[0, "#ffffff"], [0.35, "#ffffff"], [1, "#000000"]]);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(12, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0b0a09, roughness: 0.22, metalness: 0.6, transparent: true,
        opacity: 0.72, alphaMap: floorAlpha, depthWrite: false,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = 1;
    scene.add(floor);

    // soft cast shadows (real shadow map) + a small dark contact patch under the bottle
    const catcher = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.ShadowMaterial({ opacity: 0.5 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = 0.003;
    catcher.receiveShadow = true;
    catcher.renderOrder = 2;
    scene.add(catcher);
    const contactTex = radialTexture([[0, "rgba(0,0,0,0.75)"], [0.55, "rgba(0,0,0,0.3)"], [1, "rgba(0,0,0,0)"]]);
    shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 2.4),
      new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    shadow.renderOrder = 3;
    scene.add(shadow);

    // bottle + this perfume's ingredients
    const R = seeded(product.id || product.name);
    const maps = makeLabelMaps(product, renderer.capabilities.getMaxAnisotropy());
    const stage = new THREE.Group();
    stage.add(buildBottle(maps));
    const recipe = (RECIPES[product.id] || FALLBACK_RECIPE)(R);
    recipe.items.forEach((o) => stage.add(o));
    stage.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    const reflection = stage.clone();
    reflection.scale.y = -1;
    reflection.traverse((o) => { if (o.isMesh) o.castShadow = false; });

    rig = new THREE.Group();
    rig.add(stage, reflection);
    rig.visible = false;
    scene.add(rig);

    // light smoke curling up from the ingredients
    smoke = createSmoke(recipe.smoke, new THREE.Color(theme.smoke).lerp(new THREE.Color(0xffffff), 0.35), makeSmokeTexture());
    scene.add(smoke.group);

    // golden dust + soft bokeh discs
    const sprite = radialTexture([[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]], 64);
    dust = makeDust(140, 0.07, 0.85, new THREE.Color(theme.smoke), sprite);
    bokeh = makeDust(22, 0.42, 0.18, new THREE.Color(theme.glow).lerp(new THREE.Color(0xffd98a), 0.5), sprite);
    scene.add(dust, bokeh);

    tBuilt = time;
  };

  // --- timeline (seconds): background first, then everything else right after
  const T_BG = 0.35;
  const T_BOTTLE = 0.9;
  const T_CAM = 1.2;
  const FINAL_YAW = 0.2;
  let time = 0;
  let frames = 0;
  let introDone = false;
  let buildScheduled = false;

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;
    frames++;

    const bgT = easeOut(clamp01(time / T_BG));
    bgMat.uniforms.uFade.value = bgT;
    bgMat.uniforms.uTime.value = time;

    // build the still life after the first couple of frames have put the background on screen
    if (!buildScheduled && frames >= 2) {
      buildScheduled = true;
      setTimeout(build, 0);
    }

    renderer.clear();
    renderer.render(bgScene, bgCam);

    if (!scene || tBuilt < 0) {
      camera.position.set(0, 2.2, fitDist * 1.25);
      controls.update();
      return;
    }

    const tb = time - tBuilt;
    dust.material.opacity = dust.userData.baseOpacity * bgT;
    bokeh.material.opacity = bokeh.userData.baseOpacity * bgT;
    stepDust(dust, dt, time);
    stepDust(bokeh, dt * 0.6, time);

    const skip = reduceMotion;
    const b = skip ? 1 : clamp01(tb / T_BOTTLE);
    rig.visible = true;
    const e = easeOut(b);
    rig.position.y = lerp(-0.4, 0, e);
    rig.scale.setScalar(lerp(0.9, 1, e));
    rig.rotation.y = FINAL_YAW - (1 - e) * Math.PI * 1.2;
    renderer.toneMappingExposure = lerp(0.55, 1.1, easeInOut(b));
    shadow.material.opacity = e;
    smoke.update(dt, time, skip ? 1 : easeInOut(clamp01((tb - 0.15) / 1.0)));

    if (!introDone) {
      const c = skip ? 1 : easeOut(clamp01(tb / T_CAM));
      camera.position.set(0, 2.2, lerp(fitDist * 1.25, fitDist, c));
      if (tb >= Math.max(T_BOTTLE, T_CAM)) {
        introDone = true;
        controls.enabled = true;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.6;
      }
    }

    controls.update();
    renderer.clearDepth();
    renderer.render(scene, camera);
  });

  return {
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      const texKeys = ["map", "alphaMap", "metalnessMap", "roughnessMap"];
      const disposeObject = (o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => {
          texKeys.forEach((k) => { if (m[k]) m[k].dispose(); });
          m.dispose();
        });
      };
      if (scene) scene.traverse(disposeObject);
      bgScene.traverse(disposeObject);
      if (envScene) envScene.traverse(disposeObject);
      if (envTexture) envTexture.dispose();
      if (pmrem) pmrem.dispose();
      disposables.length = 0;
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
