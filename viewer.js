// 3D viewer (Three.js, loaded from a CDN through the import map in index.html).
//
// The product photo is the background. It is a copy of the photo with the original bottle taken out
// (a "plate", extended downwards so the bottle sits in the middle of the screen). The smoke that is
// already in the photo is animated by smoke-bg.js; nothing is added to the picture. Only the bottle
// is 3D: it turns once, then sways gently; drag to rotate, pinch / wheel to zoom.
//
// The bottle is generated in code (no model file): opal glass body, lathe-turned polished gold cap,
// vector foil label with the Laniko logo.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createSmokeBackground } from "./smoke-bg.js";

const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const hash3 = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
const DEFAULT_THEME = { bgDark: "#0b0907", glow: "#8a6a2f", smoke: "#d9b96a" };

// ================================================================ label textures

// The Laniko monogram (same path as logo.svg), drawn as vector onto the label.
const LOGO_PATH = "M7.62 674L66 671.27L103.11 585L100 582L9 582L5.57 579C5.56 575.35 5.51 564.38 5.5 557.08C5.49 549.77 5.5 542.46 5.5 535.15C5.5 527.84 5.5 520.54 5.5 513.23C5.5 505.92 5.5 498.61 5.5 491.3C5.5 484 5.5 476.69 5.5 469.38C5.5 462.07 5.5 454.76 5.5 447.46C5.5 440.15 5.5 432.84 5.5 425.53C5.5 418.22 5.5 410.92 5.5 403.61C5.5 396.3 5.5 388.99 5.5 381.68C5.5 374.38 5.5 367.07 5.5 359.76C5.5 352.45 5.5 345.14 5.5 337.84C5.5 330.53 5.5 323.22 5.5 315.91C5.5 308.6 5.5 301.3 5.5 293.99C5.5 286.68 5.5 279.37 5.5 272.06C5.5 264.76 5.5 257.45 5.5 250.14C5.5 242.83 5.5 235.52 5.5 228.22C5.5 220.91 5.5 213.6 5.5 206.29C5.5 198.98 5.5 191.68 5.5 184.37C5.5 177.06 5.5 169.75 5.5 162.44C5.5 155.14 5.5 147.83 5.5 140.52C5.5 133.21 5.5 125.9 5.5 118.6C5.5 111.29 5.5 103.98 5.5 96.67C5.5 89.36 5.42 82.06 5.5 74.75C5.58 67.44 5.82 60.14 5.98 52.84C6.15 45.53 6.41 38.23 6.5 30.92C6.59 23.62 6.51 12.65 6.51 9L10 5.54L98 5.54L101.71 8L101.71 491.1L139.2 491.1L271.56 183L368 181.8C369.72 185.1 375.08 194.87 378.33 201.58C381.59 208.29 384.49 215.21 387.51 222.05C390.52 228.9 393.45 235.78 396.41 242.64C399.38 249.5 402.38 256.36 405.32 263.23C408.26 270.11 411.17 276.99 414.06 283.89C416.94 290.79 419.75 297.72 422.62 304.62C425.48 311.53 428.36 318.43 431.23 325.33C434.11 332.24 436.98 339.14 439.87 346.04C442.76 352.93 445.69 359.81 448.59 366.7C451.49 373.6 454.35 380.5 457.26 387.39C460.16 394.28 463.1 401.16 466.03 408.04C468.96 414.92 471.9 421.8 474.85 428.67C477.8 435.54 480.82 442.38 483.74 449.26C486.65 456.15 489.46 463.08 492.36 469.97C495.26 476.86 498.25 483.72 501.12 490.62C503.99 497.53 506.75 504.48 509.6 511.39C512.44 518.3 515.31 525.21 518.19 532.11C521.07 539.01 523.98 545.9 526.87 552.79C529.76 559.69 532.62 566.6 535.51 573.5C538.39 580.39 541.26 587.3 544.18 594.18C547.09 601.07 550.05 607.94 553 614.81C555.94 621.68 558.95 628.53 561.87 635.41C564.78 642.3 567.78 649.17 570.47 656.13C573.16 663.09 576.74 673.68 578 677.19C573.96 677.41 561.88 678.29 553.79 678.5C545.7 678.71 537.57 678.64 529.47 678.47C521.37 678.3 513.26 677.91 505.18 677.5C497.1 677.09 485.02 676.25 480.99 676C479.47 672.6 474.86 662.42 471.85 655.59C468.84 648.77 465.91 641.91 462.95 635.07C459.99 628.22 457.03 621.38 454.08 614.53C451.13 607.68 448.2 600.83 445.27 593.97C442.34 587.11 439.46 580.23 436.52 573.38C433.57 566.53 430.55 559.71 427.59 552.87C424.63 546.03 421.69 539.17 418.73 532.33C415.77 525.48 412.8 518.64 409.83 511.8C406.86 504.96 403.87 498.13 400.91 491.29C397.94 484.45 394.99 477.6 392.04 470.75C389.09 463.9 386.17 457.04 383.23 450.19C380.29 443.33 377.35 436.48 374.41 429.63C371.47 422.78 368.53 415.92 365.6 409.07C362.66 402.21 359.73 395.35 356.79 388.5C353.86 381.65 350.86 374.81 347.97 367.94C345.07 361.07 342.23 354.18 339.41 347.27C336.59 340.37 333.95 333.39 331.04 326.53C328.14 319.66 323.51 309.5 322 306.09L319.83 306L239.63 491L353.78 493L352.13 581L201.76 583L141.89 721C144.06 724.04 150.41 733.28 154.92 739.26C159.42 745.24 164.24 751.01 168.92 756.86C173.6 762.71 178.32 768.53 183.01 774.38C187.71 780.22 192.38 786.08 197.07 791.93C201.76 797.78 206.48 803.6 211.15 809.47C215.81 815.34 220.38 821.28 225.06 827.13C229.75 832.99 234.53 838.76 239.25 844.59C243.96 850.41 248.7 856.22 253.37 862.09C258.03 867.96 262.46 874.04 267.24 879.79C272.01 885.54 279.54 893.81 282 896.61C282 892.85 282.11 881.58 282.03 874.06C281.94 866.53 281.59 859.01 281.5 851.49C281.41 843.96 281.5 836.43 281.5 828.9C281.5 821.38 281.5 813.85 281.5 806.32C281.5 798.79 281.5 791.27 281.5 783.74C281.5 776.21 281.5 768.68 281.5 761.16C281.5 753.63 281.44 746.1 281.5 738.57C281.56 731.05 281.81 719.76 281.87 716L339 714.49L341.49 712L340 679.87L282 678.2L283 636.65L372.26 636.65L372.26 678L361.87 681C361.81 683.8 361.31 692.28 361.5 697.81C361.69 703.33 362.75 711.41 363 714.13L371 714.62L372.49 717L374 834.66L486 719.84C489.78 719.62 501.13 718.61 508.71 718.5C516.29 718.39 523.89 719.03 531.49 719.2C539.08 719.37 546.68 719.45 554.28 719.5C561.88 719.55 569.5 719.25 577.08 719.5C584.65 719.75 595.96 720.75 599.73 721L444.58 884C447.02 886.76 454.24 895.15 459.22 900.59C464.2 906.03 469.38 911.29 474.45 916.65C479.52 922.01 484.54 927.42 489.64 932.75C494.74 938.09 500.02 943.25 505.05 948.65C510.08 954.04 514.79 959.73 519.81 965.14C524.83 970.55 530.1 975.72 535.14 981.11C540.19 986.49 545.1 992 550.09 997.44C555.08 1002.87 560.11 1008.27 565.1 1013.71C570.08 1019.14 575.05 1024.6 580.01 1030.06C584.97 1035.53 589.91 1041.01 594.85 1046.49C599.79 1051.97 604.95 1057.32 609.65 1062.96C614.34 1068.6 620.77 1077.44 623 1080.34L500 1078.15L374 941.03L372 1051.2L292 1050.15L102.46 819L98.83 818L98.83 1162.09C101.87 1160.06 111.15 1154.28 117.04 1149.94C122.94 1145.6 128.33 1140.47 134.21 1136.05C140.08 1131.63 146.12 1127.38 152.3 1123.4C158.49 1119.42 164.82 1115.64 171.31 1112.17C177.79 1108.71 184.44 1105.5 191.21 1102.63C197.97 1099.76 204.9 1097.2 211.9 1094.94C218.89 1092.68 226.01 1090.68 233.18 1089.06C240.34 1087.43 247.62 1086.17 254.91 1085.2C262.2 1084.22 269.55 1083.54 276.89 1083.18C284.23 1082.82 291.6 1082.8 298.95 1083.02C306.3 1083.24 313.68 1083.61 320.98 1084.5C328.27 1085.39 335.54 1086.74 342.7 1088.37C349.87 1090.01 356.98 1092.02 363.97 1094.3C370.96 1096.58 377.87 1099.17 384.63 1102.06C391.39 1104.95 398.04 1108.17 404.52 1111.64C411.01 1115.1 417.36 1118.87 423.53 1122.87C429.7 1126.86 435.74 1131.12 441.55 1135.62C447.37 1140.12 453.06 1144.83 458.42 1149.85C463.78 1154.88 468.82 1160.28 473.73 1165.76C478.65 1171.23 483.42 1176.86 487.89 1182.69C492.37 1188.53 496.66 1194.54 500.59 1200.75C504.52 1206.96 508.12 1213.41 511.47 1219.95C514.83 1226.5 517.91 1233.2 520.7 1240C523.48 1246.8 526.01 1253.75 528.2 1260.76C530.38 1267.78 532.26 1274.93 533.79 1282.12C535.32 1289.3 536.48 1296.6 537.38 1303.89C538.29 1311.19 539 1318.55 539.22 1325.89C539.44 1333.24 539.17 1340.62 538.72 1347.95C538.28 1355.29 537.6 1362.64 536.55 1369.92C535.5 1377.19 534.13 1384.45 532.42 1391.6C530.71 1398.75 528.63 1405.84 526.29 1412.81C523.95 1419.77 521.33 1426.68 518.37 1433.41C515.41 1440.14 512.09 1446.74 508.55 1453.18C505.01 1459.63 501.22 1465.97 497.14 1472.08C493.06 1478.2 488.64 1484.11 484.07 1489.87C479.5 1495.63 474.79 1501.32 469.73 1506.65C464.66 1511.98 459.23 1516.97 453.71 1521.83C448.19 1526.68 442.49 1531.38 436.61 1535.78C430.72 1540.18 424.61 1544.34 418.37 1548.24C412.14 1552.13 405.72 1555.76 399.19 1559.15C392.67 1562.55 386.01 1565.74 379.23 1568.6C372.46 1571.45 365.54 1574.01 358.55 1576.3C351.56 1578.58 344.47 1580.66 337.31 1582.3C330.14 1583.94 322.86 1585.13 315.58 1586.15C308.3 1587.18 300.96 1588.05 293.62 1588.44C286.29 1588.83 278.89 1588.77 271.54 1588.49C264.2 1588.21 256.84 1587.64 249.54 1586.77C242.24 1585.9 234.95 1584.75 227.75 1583.26C220.55 1581.77 213.4 1579.93 206.36 1577.82C199.31 1575.72 192.31 1573.36 185.49 1570.63C178.66 1567.9 172 1564.71 165.41 1561.45C158.81 1558.2 152.27 1554.79 145.91 1551.09C139.56 1547.39 133.31 1543.46 127.29 1539.24C121.27 1535.03 115.46 1530.47 109.79 1525.79C104.12 1521.11 98.58 1516.24 93.27 1511.15C87.96 1506.07 82.84 1500.75 77.93 1495.27C73.03 1489.79 68.32 1484.11 63.85 1478.27C59.37 1472.44 55.1 1466.42 51.07 1460.27C47.03 1454.12 43.19 1447.83 39.64 1441.39C36.08 1434.96 32.74 1428.37 29.74 1421.66C26.74 1414.94 24.07 1408.06 21.66 1401.11C19.24 1394.17 17.06 1387.11 15.25 1379.99C13.43 1372.87 11.91 1365.64 10.76 1358.38C9.61 1351.13 8.9 1343.78 8.35 1336.45C7.81 1329.11 7.64 1321.74 7.5 1314.39C7.36 1307.03 7.5 1299.66 7.5 1292.3C7.5 1284.94 7.5 1277.58 7.5 1270.22C7.5 1262.86 7.5 1255.5 7.5 1248.14C7.5 1240.78 7.5 1233.42 7.5 1226.06C7.5 1218.7 7.5 1211.33 7.5 1203.97C7.5 1196.61 7.5 1189.25 7.5 1181.89C7.5 1174.53 7.5 1167.17 7.5 1159.81C7.5 1152.45 7.5 1145.09 7.5 1137.73C7.5 1130.37 7.5 1123.01 7.5 1115.64C7.5 1108.28 7.5 1100.92 7.5 1093.56C7.5 1086.2 7.5 1078.84 7.5 1071.48C7.5 1064.12 7.5 1056.76 7.5 1049.4C7.5 1042.04 7.5 1034.68 7.5 1027.32C7.5 1019.95 7.5 1012.59 7.5 1005.23C7.5 997.87 7.5 990.51 7.5 983.15C7.5 975.79 7.5 968.43 7.5 961.07C7.5 953.71 7.5 946.35 7.5 938.99C7.5 931.63 7.5 924.26 7.5 916.9C7.5 909.54 7.5 902.18 7.5 894.82C7.5 887.46 7.5 880.1 7.5 872.74C7.5 865.38 7.5 858.02 7.5 850.66C7.5 843.3 7.5 835.94 7.5 828.58C7.5 821.21 7.5 813.85 7.5 806.49C7.5 799.13 7.5 791.77 7.5 784.41C7.5 777.05 7.5 769.69 7.5 762.33C7.5 754.97 7.5 747.61 7.5 740.25C7.5 732.89 7.5 725.52 7.5 718.16C7.5 710.8 7.48 703.44 7.5 696.08C7.52 688.72 7.6 677.68 7.62 674ZM125.67 1338.01A161.65 161.65 0 1 0 448.97 1338.01A161.65 161.65 0 1 0 125.67 1338.01Z";
const LOGO_W = 631, LOGO_H = 1595;
let logoPath2D = null;

// Label texture: 1600 x 2327 (same proportions as the printed label).
const LABEL_W = 1600, LABEL_H = 2327;

// mode "color": the visible label.
// mode "orm":   roughness (green) + metalness (blue): gold ink is shiny metal, the paper stays matte.
// mode "emit":  ink only, on black. It lifts the ink a little so the text stays readable even where
//               the metal would reflect a dark part of the studio.
function drawLabel(product, mode, scale = 1) {
  const W = LABEL_W, H = LABEL_H;
  const c = document.createElement("canvas");
  c.width = Math.round(W * scale); c.height = Math.round(H * scale);
  const g = c.getContext("2d");
  g.scale(scale, scale);
  const serif = '"Cormorant Garamond", "Times New Roman", Georgia, serif';
  const BG = mode === "color" ? product.labelColor || "#efe3c8" : mode === "orm" ? "rgb(0,125,0)" : "#000";
  const INK = mode === "color" ? product.labelInk || "#d9b96a" : mode === "orm" ? "rgb(0,95,205)" : product.labelInk || "#d9b96a";
  g.fillStyle = BG; g.fillRect(0, 0, W, H);
  g.fillStyle = INK; g.strokeStyle = INK;
  g.textBaseline = "alphabetic";
  g.textAlign = "left";

  // double frame
  g.lineWidth = 14; g.strokeRect(46, 46, W - 92, H - 92);
  g.lineWidth = 6; g.strokeRect(80, 80, W - 160, H - 160);

  // text of a given cap height, letter-spaced to an exact width, centred on (cx, cy)
  const CAP = 0.63; // cap height / font size for Cormorant Garamond
  const line = (text, weight, capH, targetW, cy) => {
    let px = capH / CAP;
    const chars = [...text];
    const measure = () => { g.font = `${weight} ${px}px ${serif}`; return chars.map((ch) => g.measureText(ch).width); };
    let adv = measure();
    let nat = adv.reduce((p, q) => p + q, 0);
    const minGap = px * 0.05;
    if (nat + minGap * (chars.length - 1) > targetW) { // narrow fonts fit as asked; wide fallbacks shrink a bit
      px *= targetW / (nat + minGap * (chars.length - 1));
      adv = measure();
      nat = adv.reduce((p, q) => p + q, 0);
    }
    const gap = Math.min((targetW - nat) / (chars.length - 1), px * 0.4);
    const total = nat + gap * (chars.length - 1);
    let x = W / 2 - total / 2;
    chars.forEach((ch, i) => { g.fillText(ch, x, cy + capH / 2); x += adv[i] + gap; });
  };
  const divider = (y, half) => {
    const gapW = 34;
    g.fillRect(W / 2 - half, y - 3, half - gapW, 6);
    g.fillRect(W / 2 + gapW, y - 3, half - gapW, 6);
    g.save(); g.translate(W / 2, y); g.rotate(Math.PI / 4); g.fillRect(-13, -13, 26, 26); g.restore();
  };

  // monogram
  if (!logoPath2D) logoPath2D = new Path2D(LOGO_PATH);
  const lh = 0.27 * H, k = lh / LOGO_H;
  g.save();
  g.translate(W / 2 - (LOGO_W * k) / 2, 0.105 * H);
  g.scale(k, k);
  g.fill(logoPath2D, "evenodd");
  g.restore();

  // name, tracked so the longer line spans 62 % of the label
  const words = product.name.toUpperCase().split(" ");
  const lines = words.length > 1 ? [words[0], words.slice(1).join(" ")] : words;
  const capH = 0.05 * H;
  g.font = `600 ${capH / CAP}px ${serif}`;
  const longest = lines.reduce((p, q) => (q.length > p.length ? q : p), "");
  const natLong = [...longest].reduce((p, ch) => p + g.measureText(ch).width, 0);
  const track = (0.62 * W - natLong) / (longest.length - 1);
  lines.forEach((t, i) => {
    const nat = [...t].reduce((p, ch) => p + g.measureText(ch).width, 0);
    line(t, 600, capH, nat + track * (t.length - 1), (0.505 + 0.092 * i) * H);
  });
  divider(0.745 * H, 0.34 * W);
  line("EXTRAIT DE PARFUM", 600, 0.027 * H, 0.58 * W, 0.805 * H);
  line("50 ML  \u2022  45 %", 600, 0.028 * H, 0.36 * W, 0.885 * H);
  return c;
}

function makeLabelMaps(product, anisotropy) {
  const map = new THREE.CanvasTexture(drawLabel(product, "color"));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = anisotropy;
  const orm = new THREE.CanvasTexture(drawLabel(product, "orm", 0.5));
  orm.anisotropy = anisotropy;
  const emit = new THREE.CanvasTexture(drawLabel(product, "emit", 0.5));
  emit.colorSpace = THREE.SRGBColorSpace;
  emit.anisotropy = anisotropy;
  return { map, orm, emit };
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

// ================================================================ lighting environment

// A dark studio with a few large soft-boxes. This is what the gold, glass and foil reflect,
// so it needs strong contrast: bright panels against a dark gradient.
function makeStudioEnvironment() {
  const env = new THREE.Scene();
  const dome = new THREE.SphereGeometry(14, 48, 24);
  const cols = [];
  const p = dome.attributes.position;
  const bottom = new THREE.Color(0x060403), mid = new THREE.Color(0x14100b), top = new THREE.Color(0x2a2118);
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
  // Polished metal only looks like metal when it reflects dark areas next to bright, sharp-edged
  // lights. So: a dark studio with tall strip lights. Seen on a cylinder (the cap), the dark front
  // becomes a dark vertical band with bright bands on each side, like in the product photos.
  panel(2.2, 11, new THREE.Color(12, 11, 9), [5.2, 2, 7]);      // front-right strip (wide, bright)
  panel(1.2, 11, new THREE.Color(9, 9.4, 10.5), [-4.6, 2, 7.4]); // front-left strip (narrow, cool)
  panel(1.6, 11, new THREE.Color(7, 6.4, 5.4), [-9, 2, 2.5]);   // left side strip
  panel(1.6, 11, new THREE.Color(8, 7.2, 6), [9, 2, 2.5]);      // right side strip
  panel(2, 11, new THREE.Color(9, 8, 6.6), [7.5, 3, -4]);       // rim strip, right-back
  panel(2, 11, new THREE.Color(8, 7.4, 6.6), [-5, 3, -8]);      // rim strip, left-back
  panel(11, 5, new THREE.Color(6, 5.7, 5.2), [0, 9, 1]);        // overhead softbox (top faces)
  panel(1.4, 1.4, new THREE.Color(20, 19, 17), [4.5, 6, 6]);    // small hot spot for sparkle
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
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.9, 1.1, 12, 0.13), glass);
  body.position.y = 0.95;
  g.add(body);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.6),
    new THREE.MeshStandardMaterial({
      map: maps.map,
      metalnessMap: maps.orm,
      roughnessMap: maps.orm,
      emissiveMap: maps.emit,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.4,
      metalness: 1,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  label.position.set(0, 0.88, 0.554);
  g.add(label);

  const gold = new THREE.MeshStandardMaterial({
    color: 0xf2c870,
    metalness: 1,
    roughness: 0.075, // mirror-polished
    envMapIntensity: 1.8,
  });
  const goldSoft = new THREE.MeshStandardMaterial({ color: 0xd9b25e, metalness: 1, roughness: 0.2, envMapIntensity: 1.5 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.55, metalness: 0 });

  const collar = new THREE.Mesh(new THREE.LatheGeometry(capProfile(0.38, 0.15, 0.02, 4), 64), goldSoft);
  collar.position.y = 1.9;
  const gap = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.035, 64), black);
  gap.position.y = 2.0725;
  const cap = new THREE.Mesh(new THREE.LatheGeometry(detailedCapProfile(), 160), gold);
  cap.position.y = 2.09;
  g.add(collar, gap, cap);
  return g;
}


// ================================================================ viewer

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

export function createBottleViewer(container, product) {
  if (!product.plate || !product.bottle) throw new Error("no photo plate for this product");
  const theme = { ...DEFAULT_THEME, ...(product.theme || {}) };
  const B = product.bottle; // { ar, cx, bw, bottom, photoFrac }: where the bottle is in the plate
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let disposed = false, failed = false;

  // --- DOM layers (the picture is plain HTML, so it is always there):
  //   blurred fill, the original photo (shown instantly), the plate (same photo, bottle taken out and
  //   extended downwards so the bottle sits in the centre), light effects, then the WebGL canvas.
  container.classList.add("vp");
  container.style.setProperty("--v-glow", theme.glow);
  container.style.setProperty("--v-smoke", theme.smoke);
  const fillImg = el("img", "vp-fill", container);
  const photoImg = el("img", "vp-photo", container);
  const plateImg = el("img", "vp-plate", container);
  const bgCanvas = el("canvas", "vp-bg", container);
  bgCanvas.style.visibility = "hidden";
  const maskImg = new Image();
  maskImg.src = product.smokeMask || "";
  fillImg.alt = ""; plateImg.alt = ""; photoImg.alt = product.name;
  let bg = null;
  photoImg.style.height = B.photoFrac * 100 + "%";
  photoImg.src = product.image;
  plateImg.decoding = "async";
  plateImg.src = product.plate;
  fillImg.src = product.plate;
  plateImg.style.visibility = "hidden";

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "vp-canvas";
  container.appendChild(renderer.domElement);

  // --- the bottle (the only 3D thing)
  const camera = new THREE.PerspectiveCamera(20, 1, 1, 200);
  const D = 30;           // camera distance; far enough that perspective is gentle
  const FRONT = 0.55;     // front face of the bottle body
  const scene = new THREE.Scene();
  const anchor = new THREE.Group(); // sits at the base of the bottle
  scene.add(anchor);
  const rig = new THREE.Group();    // yaw / pitch
  anchor.add(rig);
  let envTexture = null, pmrem = null, envScene = null;
  let built = false, plateReady = false, started = false, shown = false;
  let W = 1, H = 1, kPx = 100;

  const fail = (err) => {
    if (failed) return;
    failed = true;
    console.error("3D viewer failed", err);
    renderer.setAnimationLoop(null);
    renderer.domElement.style.display = "none";
    if (bg) bg.stop();
    bgCanvas.style.visibility = "hidden";
    plateImg.style.visibility = "hidden";
    photoImg.style.visibility = "visible"; // the plain photo still works
  };

  const layout = () => {
    W = container.clientWidth || 1;
    H = container.clientHeight || 1;
    renderer.setSize(W, H, false);
    const plateH = H, plateW = H * B.ar;
    // pixels per world unit, measured on the front face of the bottle body (1.5 units wide)
    kPx = (B.bw * plateW) / 1.5;
    camera.fov = (2 * Math.atan(H / (2 * kPx * (D - FRONT))) * 180) / Math.PI;
    camera.aspect = W / H;
    camera.position.set(0, 0, D);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const cxPx = (W - plateW) / 2 + B.cx * plateW;
    const bottomPx = B.bottom * plateH;
    anchor.position.set((cxPx - W / 2) / kPx, (H / 2 - bottomPx) / kPx, 0);
    if (bg) bg.resize(H, B.ar, Math.min(window.devicePixelRatio || 1, 2));
  };
  const ro = new ResizeObserver(layout);
  ro.observe(container);
  layout();

  // --- wait until the plate is decoded
  const loadPlate = async () => {
    try {
      if (plateImg.decode) await plateImg.decode();
      else await new Promise((res, rej) => { plateImg.onload = res; plateImg.onerror = rej; });
    } catch { /* fall through */ }
    if (disposed) return;
    plateReady = !!plateImg.naturalWidth;
    if (!plateReady) { fail(new Error("plate image missing")); return; }
    try {
      if (maskImg.decode) await maskImg.decode();
      if (maskImg.naturalWidth && !disposed) {
        bg = createSmokeBackground(bgCanvas, plateImg, maskImg);
        if (bg && !bg.ok) { bg.dispose(); bg = null; }
        if (bg) bg.resize(H, B.ar, Math.min(window.devicePixelRatio || 1, 2));
      }
    } catch (err) { console.warn("smoke animation unavailable", err); bg = null; } // the still photo is used
  };

  // --- build the bottle scene
  const build = () => {
    if (disposed || failed) return;
    try {
      pmrem = new THREE.PMREMGenerator(renderer);
      envScene = makeStudioEnvironment();
      envTexture = pmrem.fromScene(envScene, 0.03).texture;
      scene.environment = envTexture;

      const key = new THREE.DirectionalLight(0xfff1d6, 2.0);
      key.position.set(-3, 5, 7);
      const rim = new THREE.DirectionalLight(new THREE.Color(theme.smoke), 1.1);
      rim.position.set(5, 3, -4);
      scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.5));

      const maps = makeLabelMaps(product, renderer.capabilities.getMaxAnisotropy());
      rig.add(buildBottle(maps));

      // soft contact shadow behind the foot of the bottle
      const blobTex = radialTexture([[0, "rgba(0,0,0,0.7)"], [0.5, "rgba(0,0,0,0.32)"], [1, "rgba(0,0,0,0)"]]);
      const blob = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 0.55),
        new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })
      );
      blob.position.set(0, 0.02, -0.7);
      blob.renderOrder = 4;
      anchor.add(blob);

      built = true;
      layout();
    } catch (err) {
      fail(err);
    }
  };

  // --- interaction
  let interacted = false;
  let yawFree = 0, yawVel = 0, pitch = 0, zoom = 1, zoomTarget = 1;
  let swayYaw = 0;
  const ptrs = new Map();
  let pinchD = 0;
  const dom = renderer.domElement;
  dom.addEventListener("pointerdown", (e) => {
    dom.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); }
    if (!interacted) { interacted = true; yawFree = swayYaw; }
    yawVel = 0;
  });
  dom.addEventListener("pointermove", (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchD > 0) zoomTarget = Math.min(1.8, Math.max(1, zoomTarget * (d / pinchD)));
      pinchD = d;
    } else {
      yawFree += dx * 0.011;
      yawVel = dx * 0.011 * 60;
      pitch = Math.min(0.25, Math.max(-0.2, pitch + dy * 0.004));
    }
  });
  const up = (e) => { ptrs.delete(e.pointerId); pinchD = 0; };
  dom.addEventListener("pointerup", up);
  dom.addEventListener("pointercancel", up);
  dom.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomTarget = Math.min(1.8, Math.max(1, zoomTarget * Math.exp(-e.deltaY * 0.0012)));
  }, { passive: false });

  // --- animation
  let time = 0, frames = 0, tStart = 0;
  const clock = new THREE.Clock();
  const fontReady = document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load('600 100px "Cormorant Garamond"').catch(() => {}), new Promise((r) => setTimeout(r, 600))])
    : Promise.resolve();

  renderer.setAnimationLoop(() => {
    if (failed) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;
    frames++;
    if (frames === 2) setTimeout(() => { fontReady.then(build); }, 0);
    if (!built || !plateReady) return; // the photo is showing meanwhile
    if (!started) { started = true; tStart = time; }
    const tb = time - tStart;

    try {
      // bottle: one full turn at the start, then a gentle sway until the user takes over
      const spin = reduceMotion ? 0 : easeInOut(clamp01(tb / 1.4)) * TAU;
      swayYaw = reduceMotion ? 0 : 0.55 * Math.sin(Math.max(0, tb - 1.4) * 0.8) * clamp01((tb - 1.4) / 0.8);
      if (interacted) {
        yawFree += yawVel * dt;
        yawVel *= Math.exp(-2.6 * dt);
      }
      rig.rotation.y = (interacted ? yawFree : swayYaw) + (interacted ? 0 : spin);
      rig.rotation.x = interacted ? pitch : 0;
      zoom += (zoomTarget - zoom) * Math.min(1, dt * 8);
      anchor.scale.setScalar(zoom);

      renderer.clear();
      renderer.render(scene, camera);
    } catch (err) {
      fail(err);
      return;
    }

    if (!shown) {
      // the bottle has really been drawn: swap the photo for the plate (original bottle taken out)
      shown = true;
      plateImg.style.visibility = "visible";
      photoImg.style.visibility = "hidden";
      if (bg) {
        bg.draw(0);
        bgCanvas.style.visibility = "visible";
        if (!reduceMotion) bg.start();
      }
    }
  });

  loadPlate();

  return {
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      if (bg) bg.dispose();
      const texKeys = ["map", "alphaMap", "metalnessMap", "roughnessMap", "emissiveMap"];
      const disposeObject = (o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => {
          texKeys.forEach((k) => { if (m[k]) m[k].dispose(); });
          m.dispose();
        });
      };
      scene.traverse(disposeObject);
      if (envScene) envScene.traverse(disposeObject);
      if (envTexture) envTexture.dispose();
      if (pmrem) pmrem.dispose();
      renderer.dispose();
      container.classList.remove("vp");
      container.innerHTML = "";
    },
  };
}
