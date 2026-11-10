// 3D bottle viewer (Three.js, loaded from a CDN through the import map in index.html).
// Builds a simple perfume bottle: cream glass body, gold cap, and a front label
// that is drawn from the product's name and colours.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

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

function makeLabelTexture(product, maxAnisotropy) {
  const W = 1024, H = 1280;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const bg = product.labelColor || "#efe3c8";
  const ink = product.labelInk || "#d9b96a";
  const serif = '"Cormorant Garamond", "Times New Roman", Georgia, serif';

  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = ink;
  g.lineWidth = 8;
  g.strokeRect(36, 36, W - 72, H - 72);
  g.lineWidth = 3;
  g.strokeRect(62, 62, W - 124, H - 124);

  g.fillStyle = ink;
  g.textBaseline = "middle";

  g.font = `600 118px ${serif}`;
  drawSpaced(g, "LANIKO", W / 2, 290, 34);

  const divider = (y) => {
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
  g.font = `600 92px ${serif}`;
  const lines = words.length > 1 ? [words[0], words.slice(1).join(" ")] : words;
  const top = lines.length === 1 ? 650 : 610;
  lines.forEach((line, i) => drawSpaced(g, line, W / 2, top + i * 120, 14));

  divider(880);
  g.font = `500 48px ${serif}`;
  drawSpaced(g, "EXTRAIT DE PARFUM", W / 2, 985, 9);
  g.font = `500 42px ${serif}`;
  drawSpaced(g, "50 ML  ·  45 %", W / 2, 1075, 7);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBottleViewer(container, product) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.3, 7.6);

  const key = new THREE.DirectionalLight(0xfff1d6, 1.6);
  key.position.set(3, 4, 5);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));

  const bottle = new THREE.Group();

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(1.5, 1.9, 0.9, 6, 0.08),
    new THREE.MeshPhysicalMaterial({
      color: 0xf3ead8,
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    })
  );
  bottle.add(body);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.5),
    new THREE.MeshStandardMaterial({
      map: makeLabelTexture(product, renderer.capabilities.getMaxAnisotropy()),
      roughness: 0.45,
      metalness: 0.15,
    })
  );
  label.position.set(0, -0.05, 0.452);
  bottle.add(label);

  const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.22 });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 48), gold);
  collar.position.y = 1.02;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.65, 64), gold);
  cap.position.y = 1.415;
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.52, 0.06, 64),
    new THREE.MeshStandardMaterial({ color: 0xb8922a, metalness: 1, roughness: 0.3 })
  );
  ring.position.y = 1.12;
  bottle.add(collar, cap, ring);

  bottle.position.y = -0.4;
  bottle.rotation.y = 0.55;
  scene.add(bottle);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 4.5;
  controls.maxDistance = 11;
  controls.minPolarAngle = 0.7;
  controls.maxPolarAngle = 2.3;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 2.2;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      if (scene.environment) scene.environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
