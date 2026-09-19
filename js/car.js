// ============================================================================
//  Subaru XV — кузов лофтом по поперечным сечениям. Остекление, оптика,
//  чёрный обвес и решётка не накладываются сверху, а вырезаются прямо
//  в оболочке — поэтому ничего не торчит и силуэт остаётся цельным.
//  Габарит 4485 × 1800 × 1615, база 2665, клиренс 220, колёса 225/60 R17.
// ============================================================================
import * as THREE from '../lib/three.module.js';

const L = 4.485, WHEEL_R = 0.335;

// сечения: x — от переднего бампера; wb/wt — полуширина низа/верха; yb/yt — низ/верх
const SEC = [
  { x: 0.00, wb: 0.44, wt: 0.40, yb: 0.56, yt: 0.76 },
  { x: 0.10, wb: 0.66, wt: 0.60, yb: 0.44, yt: 0.84 },
  { x: 0.26, wb: 0.80, wt: 0.74, yb: 0.37, yt: 0.89 },
  { x: 0.48, wb: 0.855, wt: 0.80, yb: 0.34, yt: 0.915 },
  { x: 0.80, wb: 0.885, wt: 0.835, yb: 0.325, yt: 0.94 },
  { x: 1.16, wb: 0.897, wt: 0.855, yb: 0.32, yt: 0.975 },
  { x: 1.46, wb: 0.90, wt: 0.862, yb: 0.32, yt: 1.03 },
  { x: 1.72, wb: 0.90, wt: 0.835, yb: 0.32, yt: 1.16 },
  { x: 1.98, wb: 0.90, wt: 0.775, yb: 0.32, yt: 1.38 },
  { x: 2.20, wb: 0.899, wt: 0.742, yb: 0.32, yt: 1.515 },
  { x: 2.52, wb: 0.897, wt: 0.735, yb: 0.32, yt: 1.565 },
  { x: 2.92, wb: 0.895, wt: 0.733, yb: 0.32, yt: 1.572 },
  { x: 3.24, wb: 0.892, wt: 0.730, yb: 0.32, yt: 1.560 },
  { x: 3.56, wb: 0.888, wt: 0.724, yb: 0.322, yt: 1.518 },
  { x: 3.84, wb: 0.883, wt: 0.715, yb: 0.328, yt: 1.418 },
  { x: 4.06, wb: 0.876, wt: 0.706, yb: 0.336, yt: 1.268 },
  { x: 4.24, wb: 0.860, wt: 0.690, yb: 0.352, yt: 1.108 },
  { x: 4.38, wb: 0.796, wt: 0.640, yb: 0.404, yt: 0.972 },
  { x: 4.462, wb: 0.60, wt: 0.50, yb: 0.50, yt: 0.86 },
];

const RING = 30;

function ringPoint(s, t) {
  const a = t * Math.PI * 2;
  const cz = Math.cos(a), cy = Math.sin(a);
  const p = 2.7;
  const k = Math.pow(Math.abs(cz), 2 / p) * Math.sign(cz);
  const m = Math.pow(Math.abs(cy), 2 / p) * Math.sign(cy);
  const wMid = (s.wb + s.wt) / 2, wAmp = (s.wb - s.wt) / 2;
  const w = wMid - wAmp * m;
  const yMid = (s.yb + s.yt) / 2, yAmp = (s.yt - s.yb) / 2;
  return [s.x, yMid + yAmp * m, k * w];
}

/** к какой части кузова относится точка оболочки */
function zoneOf(p) {
  const x = p[0], y = p[1], az = Math.abs(p[2]);
  // остекление
  if (y > 1.07) {
    if (x > 1.99 && x < 3.86 && az > 0.31 && y < 1.50) return 'glass';
    if (x >= 1.74 && x <= 2.20) return 'glass';
    if (x >= 3.84 && x <= 4.22) return 'glass';
  }
  // фары
  if (x < 0.40 && y > 0.70 && y < 0.95 && az > 0.38) return 'lampF';
  // решётка
  if (x < 0.13 && y > 0.66 && y < 0.90 && az <= 0.50) return 'grille';
  // фонари
  if (x > 4.20 && y > 0.84 && y < 1.10 && az > 0.50) return 'lampR';
  // нижний обвес и пороги
  if (y < 0.44) return 'plastic';
  // колёсные арки
  for (const ax of [1.05, 3.42]) {
    const d = Math.hypot(x - ax, y - WHEEL_R - 0.02);
    if (d > WHEEL_R + 0.015 && d < WHEEL_R + 0.155 && y > 0.36 && az > 0.62) return 'plastic';
  }
  return 'body';
}

function loftBody(mats) {
  const buf = {};
  const put = (zone, pts) => { (buf[zone] || (buf[zone] = [])).push(...pts); };
  const P = (i, t) => ringPoint(SEC[i], t);
  for (let i = 0; i < SEC.length - 1; i++) {
    for (let j = 0; j < RING; j++) {
      const t0 = j / RING, t1 = (j + 1) / RING;
      const a = P(i, t0), b = P(i, t1), c = P(i + 1, t1), d = P(i + 1, t0);
      const zs = [zoneOf(a), zoneOf(b), zoneOf(c), zoneOf(d)];
      // квад целиком в зоне — красим зоной, иначе кузовом
      const z = zs.every(v => v === zs[0]) ? zs[0] : 'body';
      put(z, [...a, ...b, ...c, ...a, ...c, ...d]);
    }
  }
  // торцы
  for (const [idx, dir] of [[0, -1], [SEC.length - 1, 1]]) {
    const s = SEC[idx];
    const cx = [s.x, (s.yb + s.yt) / 2, 0];
    for (let j = 0; j < RING; j++) {
      const a = ringPoint(s, j / RING), b = ringPoint(s, (j + 1) / RING);
      put('body', dir < 0 ? [...cx, ...b, ...a] : [...cx, ...a, ...b]);
    }
  }
  const grp = new THREE.Group();
  for (const [zone, arr] of Object.entries(buf)) {
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
    g2.computeVertexNormals();
    const m = new THREE.Mesh(g2, mats[zone] || mats.body);
    m.castShadow = true; m.receiveShadow = true;
    grp.add(m);
  }
  return grp;
}

/** колесо с диском, спицами и тормозным диском */
function wheel(tyre, rim, chrome, dark) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.215, 30), tyre);
  t.rotation.x = Math.PI / 2; t.castShadow = true; t.receiveShadow = true;
  g.add(t);
  const shoulder = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.012, 0.042, 8, 30), tyre);
  g.add(shoulder);
  for (const s of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R * 0.66, WHEEL_R * 0.66, 0.016, 26), dark);
    face.rotation.x = Math.PI / 2; face.position.z = s * 0.106;
    g.add(face);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.046, WHEEL_R * 1.10, 0.024), rim);
      sp.position.z = s * 0.113;
      sp.rotation.z = (i / 5) * Math.PI * 2 + 0.3;
      g.add(sp);
    }
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R * 0.66, 0.022, 6, 26), rim);
    rimRing.position.z = s * 0.112;
    g.add(rimRing);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.026, 14), chrome);
    hub.rotation.x = Math.PI / 2; hub.position.z = s * 0.122;
    g.add(hub);
  }
  return g;
}

export function buildSubaruXV(color = 0x1b3f73) {
  const g = new THREE.Group();
  g.name = 'Subaru XV';

  const mats = {
    body: new THREE.MeshPhysicalMaterial({
      color, roughness: 0.18, metalness: 0.68, clearcoat: 0.85, clearcoatRoughness: 0.08,
      side: THREE.DoubleSide,
    }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x1c1e21, roughness: 0.9, metalness: 0.04, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x0d151c, roughness: 0.04, metalness: 0.08, transparent: true, opacity: 0.72,
      clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide,
    }),
    lampF: new THREE.MeshPhysicalMaterial({
      color: 0xd9e4ec, roughness: 0.06, metalness: 0.25, clearcoat: 1,
      emissive: 0x33495c, emissiveIntensity: 0.5, side: THREE.DoubleSide,
    }),
    lampR: new THREE.MeshPhysicalMaterial({
      color: 0x8e161c, roughness: 0.1, clearcoat: 1,
      emissive: 0x5a0d11, emissiveIntensity: 0.7, side: THREE.DoubleSide,
    }),
    grille: new THREE.MeshStandardMaterial({ color: 0x131416, roughness: 0.68, metalness: 0.35, side: THREE.DoubleSide }),
  };
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.14, metalness: 0.96 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x9aa0a7, roughness: 0.26, metalness: 0.88 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.55, metalness: 0.5 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x131315, roughness: 0.97 });
  const plastic = mats.plastic;

  g.add(loftBody(mats));

  // --- стойки кузова ---
  for (const s of [-1, 1]) {
    const bp = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.40, 0.03), plastic);
    bp.position.set(2.92, 1.30, s * 0.762); g.add(bp);
    const ap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.03), plastic);
    ap.position.set(2.03, 1.26, s * 0.74); ap.rotation.z = -0.62; g.add(ap);
    const dp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.03), plastic);
    dp.position.set(3.90, 1.28, s * 0.73); dp.rotation.z = 0.70; g.add(dp);
  }

  // --- рейлинги ---
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.042, 0.05), chrome);
    rail.position.set(2.72, 1.598, s * 0.585); g.add(rail);
    for (const x of [2.13, 3.31]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.045), chrome);
      leg.position.set(x, 1.565, s * 0.585); g.add(leg);
    }
  }

  // --- пороги и защита днища ---
  for (const s of [-1, 1]) {
    const sill = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.10, 0.07), plastic);
    sill.position.set(2.24, 0.375, s * 0.878); g.add(sill);
  }
  const skidF = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.035, 0.80), chrome);
  skidF.position.set(0.28, 0.335, 0); g.add(skidF);
  const skidR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.78), chrome);
  skidR.position.set(4.22, 0.352, 0); g.add(skidR);

  // --- противотуманки, шильд, номер ---
  for (const s of [-1, 1]) {
    const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.02, 12), mats.lampF);
    fog.rotation.z = Math.PI / 2;
    fog.position.set(0.075, 0.505, s * 0.52); g.add(fog);
  }
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.125), chrome);
  badge.position.set(0.028, 0.815, 0); g.add(badge);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, 0.50), chrome);
  plate.position.set(0.045, 0.60, 0); g.add(plate);
  const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, 0.50), chrome);
  plateR.position.set(4.455, 0.72, 0); g.add(plateR);

  // --- зеркала и ручки ---
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.085), plastic);
    arm.position.set(2.06, 1.20, s * 0.905); g.add(arm);
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.09, 0.07), mats.body);
    mir.position.set(2.05, 1.225, s * 0.965); g.add(mir);
    const mirGl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.055), mats.glass);
    mirGl.position.set(2.14, 1.225, s * 0.965); g.add(mirGl);
    for (const x of [2.60, 3.50]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.028), chrome);
      h.position.set(x, 1.005, s * 0.898); g.add(h);
    }
    for (const x of [2.22, 3.06]) {
      const ln = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.62, 0.01), plastic);
      ln.position.set(x, 0.72, s * 0.896); g.add(ln);
    }
  }
  // антенна-плавник
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 4), mats.body);
  fin.rotation.z = -0.35;
  fin.position.set(3.62, 1.52, 0); g.add(fin);

  // --- колёса ---
  for (const ax of [1.05, 3.42]) for (const s of [-1, 1]) {
    const w = wheel(tyre, rim, chrome, dark);
    w.position.set(ax, WHEEL_R, s * 0.782);
    g.add(w);
  }

  g.children.forEach(c => { c.position.x -= L / 2; });
  return g;
}
