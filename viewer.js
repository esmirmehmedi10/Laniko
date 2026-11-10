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
function drawLabel(product, mode) {
  const W = LABEL_W, H = LABEL_H;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
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
  const orm = new THREE.CanvasTexture(drawLabel(product, "orm"));
  orm.anisotropy = anisotropy;
  const emit = new THREE.CanvasTexture(drawLabel(product, "emit"));
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
  label.position.set(0, 0.93, 0.452);
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
  const cap = new THREE.Mesh(new THREE.LatheGeometry(detailedCapProfile(), 160), gold);
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
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
      // make sure the label font is ready so the label text is drawn in it, but never wait long
      const fontReady = document.fonts && document.fonts.load
        ? Promise.race([document.fonts.load('600 100px "Cormorant Garamond"').catch(() => {}), new Promise((r) => setTimeout(r, 700))])
        : Promise.resolve();
      fontReady.then(build);
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
      const texKeys = ["map", "alphaMap", "metalnessMap", "roughnessMap", "emissiveMap"];
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
