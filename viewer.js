// 3D bottle viewer (Three.js, loaded from a CDN through the import map in index.html).
//
// Sequence when opened:
//   1. an animated background fades in (drifting smoke + golden dust, tinted per perfume)
//   2. the lights come up and the bottle rises out of a glossy dark surface while spinning in
//   3. the person can drag to rotate and pinch to zoom
//
// The bottle is built procedurally: opal glass body with clear-coat, a lathe-turned gold cap,
// and a front label with real metallic foil (gold areas use a metalness map).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

const DEFAULT_THEME = { bgDark: "#0b0907", glow: "#8a6a2f", smoke: "#d9b96a" };

// ---------------------------------------------------------------- label textures

function drawSpaced(g, text, cx, y, spacing) {
  const chars = [...text];
  const widths = chars.map((c) => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  g.textAlign = "left";
  chars.forEach((c, i) => {
    g.fillText(c, x, y);
    x += widths[i] + spacing;
  });
}

// mode "color": the visible label. mode "orm": roughness (green) + metalness (blue) map,
// so the gold ink reflects like foil while the rest of the label stays matte.
function drawLabel(product, mode) {
  const W = 1024, H = 1280;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const serif = '"Cormorant Garamond", "Times New Roman", Georgia, serif';
  const BG = mode === "color" ? product.labelColor || "#efe3c8" : "rgb(0,125,0)";
  const INK = mode === "color" ? product.labelInk || "#d9b96a" : "rgb(0,55,255)";

  g.fillStyle = BG;
  g.fillRect(0, 0, W, H);

  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.strokeRect(36, 36, W - 72, H - 72);
  g.lineWidth = 3;
  g.strokeRect(62, 62, W - 124, H - 124);

  g.fillStyle = INK;
  g.textBaseline = "middle";

  g.font = `600 118px ${serif}`;
  drawSpaced(g, "LANIKO", W / 2, 290, 34);

  const divider = (y) => {
    g.fillStyle = INK;
    g.fillRect(170, y - 1.5, W / 2 - 170 - 36, 3);
    g.fillRect(W / 2 + 36, y - 1.5, W / 2 - 170 - 36, 3);
    g.save();
    g.translate(W / 2, y);
    g.rotate(Math.PI / 4);
    g.fillRect(-12, -12, 24, 24);
    g.restore();
  };
  divider(430);

  const words = product.name.toUpperCase().split(" ");
  g.fillStyle = INK;
  g.font = `600 92px ${serif}`;
  const lines = words.length > 1 ? [words[0], words.slice(1).join(" ")] : words;
  const top = lines.length === 1 ? 650 : 610;
  lines.forEach((line, i) => drawSpaced(g, line, W / 2, top + i * 120, 14));

  divider(880);
  g.fillStyle = INK;
  g.font = `500 48px ${serif}`;
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
  orm.anisotropy = anisotropy; // data texture: keep linear (no colour space)
  return { map, orm };
}

// ---------------------------------------------------------------- small helpers

function radialTexture(stops, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([p, color]) => grad.addColorStop(p, color));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// A dark studio with a few bright soft-boxes. This is what the gold and glass reflect.
function makeStudioEnvironment() {
  const env = new THREE.Scene();
  env.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(12, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0x15110d, side: THREE.BackSide })
    )
  );
  const panel = (w, h, color, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(6, 8, new THREE.Color(9, 8.3, 7.2), [6, 3, 5]); // warm key
  panel(3, 9, new THREE.Color(5, 5.3, 6.2), [-7, 2, 3]); // cool strip, left
  panel(9, 2.5, new THREE.Color(6, 5.6, 5), [0, 8, 1]); // top
  panel(2.5, 10, new THREE.Color(7, 6.4, 5.6), [-3, 2, -8]); // rim strip, behind
  panel(10, 3, new THREE.Color(2.2, 2, 1.8), [0, -1, -8]); // low back fill
  return env;
}

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

// Bottle stands on y = 0 and is about 2.74 units tall.
function buildBottle(maps) {
  const g = new THREE.Group();

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xf4ecda,
    roughness: 0.16,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    ior: 1.5,
    sheen: 0.3,
    sheenColor: new THREE.Color(0xfff3dc),
    sheenRoughness: 0.5,
  });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.9, 0.9, 10, 0.09), glass);
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
    color: 0xf0c35f,
    metalness: 1,
    roughness: 0.18,
    clearcoat: 0.4,
    clearcoatRoughness: 0.1,
  });
  const darkGold = new THREE.MeshStandardMaterial({ color: 0x9a7424, metalness: 1, roughness: 0.35 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.6, metalness: 0 });

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 48), darkGold);
  collar.position.y = 1.98;
  const gap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 48), black);
  gap.position.y = 2.075;
  const cap = new THREE.Mesh(new THREE.LatheGeometry(capProfile(0.5, 0.65, 0.045), 72), gold);
  cap.position.y = 2.09;
  g.add(collar, gap, cap);

  return g;
}

function makeDust(count, size, opacity, color, sprite) {
  const positions = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 1] = Math.random() * 6.5;
    positions[i * 3 + 2] = -4 + Math.random() * 6;
    speed[i] = 0.08 + Math.random() * 0.22;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size,
    map: sprite,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.userData = { positions, speed, phase, baseOpacity: opacity };
  return points;
}

function stepDust(points, dt, time) {
  const { positions, speed, phase } = points.userData;
  const n = speed.length;
  for (let i = 0; i < n; i++) {
    positions[i * 3 + 1] += speed[i] * dt;
    positions[i * 3] += Math.sin(time * 0.4 + phase[i]) * 0.0025;
    if (positions[i * 3 + 1] > 6.8) {
      positions[i * 3 + 1] = -0.2;
      positions[i * 3] = (Math.random() - 0.5) * 9;
    }
  }
  points.geometry.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------- animated background

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

  // domain-warped fbm = slow, curling smoke that drifts upward
  vec2 q = vec2(fbm(p * 1.1 + vec2(0.0, t * 2.0)), fbm(p * 1.1 + vec2(5.2, 1.3) - t));
  float s = fbm(p * 1.5 + 2.4 * q + vec2(t * 1.5, -t * 3.0));
  float smoke = smoothstep(0.32, 0.92, s);

  float d = length(p * vec2(0.85, 0.7) - vec2(0.0, 0.15));
  float glow = exp(-d * d * 1.7);

  vec3 col = uDark * (1.0 - 0.35 * d);
  col += uGlow * glow * 0.85;
  col += uSmoke * smoke * (0.22 + 0.78 * glow) * 0.75;
  col *= smoothstep(2.3, 0.5, length(p)); // vignette

  gl_FragColor = vec4(col * uFade, 1.0);
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------- viewer

export function createBottleViewer(container, product) {
  const theme = { ...DEFAULT_THEME, ...(product.theme || {}) };
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);

  // --- background pass (its own scene so it is always behind everything)
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

  // --- main scene
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = makeStudioEnvironment();
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 60);
  camera.position.set(0, 1.9, 10.5);

  const key = new THREE.DirectionalLight(0xfff1d6, 1.2);
  key.position.set(3, 5, 5);
  const rim = new THREE.DirectionalLight(new THREE.Color(theme.smoke), 1.0);
  rim.position.set(-4, 3, -5);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.2));

  // glossy dark surface that fades out into the background
  const floorAlpha = radialTexture([[0, "#ffffff"], [0.35, "#ffffff"], [1, "#000000"]]);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(12, 64),
    new THREE.MeshStandardMaterial({
      color: 0x0b0a09,
      roughness: 0.22,
      metalness: 0.6,
      transparent: true,
      opacity: 0.72,
      alphaMap: floorAlpha,
      depthWrite: false,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = 1;
  scene.add(floor);

  const shadowTex = radialTexture([[0, "rgba(0,0,0,0.75)"], [0.55, "rgba(0,0,0,0.3)"], [1, "rgba(0,0,0,0)"]]);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  shadow.renderOrder = 2;
  scene.add(shadow);

  // bottle + its mirrored reflection in the surface
  const maps = makeLabelMaps(product, renderer.capabilities.getMaxAnisotropy());
  const bottle = buildBottle(maps);
  const reflection = bottle.clone();
  reflection.scale.y = -1;
  const rig = new THREE.Group();
  rig.add(bottle, reflection);
  rig.visible = false;
  scene.add(rig);

  // golden dust + a few large soft bokeh discs
  const sprite = radialTexture([[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]], 64);
  const dust = makeDust(140, 0.07, 0.85, new THREE.Color(theme.smoke), sprite);
  const bokeh = makeDust(22, 0.42, 0.18, new THREE.Color(theme.glow).lerp(new THREE.Color(0xffd98a), 0.5), sprite);
  scene.add(dust, bokeh);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.3, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 5;
  controls.maxDistance = 11;
  controls.minPolarAngle = 0.75;
  controls.maxPolarAngle = 1.62;
  controls.enabled = false; // switched on once the intro has finished
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    bgMat.uniforms.uRes.value.set(w, h);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // --- intro timeline (seconds)
  const T_BG = 1.4;
  const T_BOTTLE_START = 1.1;
  const T_BOTTLE = 2.0;
  const T_CAM = 3.1;
  const T_END = T_BOTTLE_START + T_BOTTLE;
  let time = reduceMotion ? T_END + 1 : 0;
  let introDone = false;
  const FINAL_YAW = 0.55;

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;

    const bgT = easeInOut(clamp01(time / T_BG));
    bgMat.uniforms.uFade.value = bgT;
    bgMat.uniforms.uTime.value = time;
    dust.material.opacity = dust.userData.baseOpacity * bgT;
    bokeh.material.opacity = bokeh.userData.baseOpacity * bgT;
    stepDust(dust, dt, time);
    stepDust(bokeh, dt * 0.6, time);

    const b = clamp01((time - T_BOTTLE_START) / T_BOTTLE);
    if (b > 0) {
      rig.visible = true;
      const e = easeOut(b);
      rig.position.y = lerp(-0.4, 0, e);
      rig.scale.setScalar(lerp(0.9, 1, e));
      rig.rotation.y = FINAL_YAW - (1 - e) * Math.PI * 1.5;
      renderer.toneMappingExposure = lerp(0.55, 1.1, easeInOut(b));
    } else {
      renderer.toneMappingExposure = 0.55;
    }
    shadow.material.opacity = easeOut(b);

    if (!introDone) {
      const c = easeOut(clamp01(time / T_CAM));
      camera.position.set(0, 1.9, lerp(10.5, 7.8, c));
      if (time >= Math.max(T_END, T_CAM)) {
        introDone = true;
        controls.enabled = true;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.6;
      }
    }

    controls.update();
    renderer.clear();
    renderer.render(bgScene, bgCam);
    renderer.clearDepth();
    renderer.render(scene, camera);
  });

  return {
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      const texKeys = ["map", "alphaMap", "metalnessMap", "roughnessMap"];
      const disposeObject = (o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          texKeys.forEach((k) => { if (o.material[k]) o.material[k].dispose(); });
          o.material.dispose();
        }
      };
      scene.traverse(disposeObject);
      bgScene.traverse(disposeObject);
      envScene.traverse(disposeObject);
      if (scene.environment) scene.environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
