// ============================================================================
//  Растительность. Кроны собираются из пересекающихся плоскостей с
//  процедурными alpha-текстурами хвои/листвы — это даёт силуэт живого
//  растения вместо геометрического примитива.
// ============================================================================
import * as THREE from '../lib/three.module.js';

const rnd = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const G = {};
const geo = (k, f) => (G[k] || (G[k] = f()));
const TEX = {};

function alphaTex(key, draw, size = 512) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  TEX[key] = t;
  return t;
}

// --- хвойная лапа: ярусы «щёток» от ствола ---------------------------------
function coniferTex(tone = 0) {
  return alphaTex('conif' + tone, (g, S) => {
    const cx = S / 2;
    const base = [42 + tone, 78 + tone, 48 + tone];
    for (let tier = 0; tier < 13; tier++) {
      const ty = S * 0.06 + (tier / 12) * S * 0.88;
      const halfW = (S * 0.46) * Math.pow(tier / 12, 0.78) + S * 0.02;
      const n = 26 + Math.floor(halfW / 5);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const t = rnd(tier * 31 + i * 7);
        const len = halfW * (0.35 + t * 0.65);
        const y0 = ty + (rnd(tier + i * 3) - 0.5) * S * 0.035;
        const droop = len * (0.22 + rnd(i + tier) * 0.3);
        const sh = 1 - 0.34 * rnd(i * 5 + tier);
        g.strokeStyle = `rgba(${base[0] * sh | 0},${base[1] * sh | 0},${base[2] * sh | 0},0.96)`;
        g.lineWidth = 2.2 + rnd(i * 2.3) * 2.6;
        g.beginPath();
        g.moveTo(cx, y0);
        g.quadraticCurveTo(cx + side * len * 0.6, y0 + droop * 0.35, cx + side * len, y0 + droop);
        g.stroke();
        // иголки на лапе
        g.lineWidth = 1;
        for (let k = 0; k < 7; k++) {
          const kt = 0.25 + k / 9;
          const px = cx + side * len * kt, py = y0 + droop * kt * kt;
          g.beginPath(); g.moveTo(px, py);
          g.lineTo(px + (rnd(k + i) - 0.5) * 9, py + 4 + rnd(k * 3) * 7);
          g.stroke();
        }
      }
    }
  });
}

// --- лиственная крона: масса мелких листьев --------------------------------
function deciduousTex(tone = 0) {
  return alphaTex('decid' + tone, (g, S) => {
    const cx = S / 2, cy = S * 0.46, rx = S * 0.46, ry = S * 0.42;
    for (let i = 0; i < 5200; i++) {
      const a = rnd(i * 1.7) * 6.283;
      const r = Math.pow(rnd(i * 3.1), 0.45);
      const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
      // рваный край кроны
      if (r > 0.86 && rnd(i * 9.7) > 0.45) continue;
      const sh = 0.55 + 0.45 * (1 - r) + (rnd(i * 5.3) - 0.5) * 0.3;
      g.fillStyle = `rgba(${(64 * sh + 18) | 0},${(122 * sh + 26) | 0},${(48 * sh + 14) | 0},0.95)`;
      const s = 4 + rnd(i * 7.9) * 7;
      g.save(); g.translate(x, y); g.rotate(rnd(i) * 3.14);
      g.beginPath(); g.ellipse(0, 0, s, s * 0.62, 0, 0, 6.283); g.fill();
      g.restore();
    }
    // просветы
    for (let i = 0; i < 26; i++) {
      const a = rnd(i * 2.9) * 6.283, r = rnd(i * 4.4) * 0.8;
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.arc(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, 7 + rnd(i) * 16, 0, 6.283);
      g.fill();
      g.globalCompositeOperation = 'source-over';
    }
  });
}

// --- куст ------------------------------------------------------------------
function bushTex(key, rgb, flower) {
  return alphaTex('bush' + key, (g, S) => {
    const cx = S / 2, cy = S * 0.62, rx = S * 0.46, ry = S * 0.38;
    for (let i = 0; i < 3400; i++) {
      const a = rnd(i * 1.3) * 6.283, r = Math.pow(rnd(i * 2.7), 0.5);
      const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
      if (y > S * 0.97) continue;
      if (r > 0.84 && rnd(i * 6.1) > 0.4) continue;
      const sh = 0.55 + 0.5 * (1 - r) + (rnd(i * 4.1) - 0.5) * 0.28;
      g.fillStyle = `rgba(${(rgb[0] * sh) | 0},${(rgb[1] * sh) | 0},${(rgb[2] * sh) | 0},0.95)`;
      const s = 3.4 + rnd(i * 8.3) * 5.5;
      g.save(); g.translate(x, y); g.rotate(rnd(i) * 3.14);
      g.beginPath(); g.ellipse(0, 0, s, s * 0.66, 0, 0, 6.283); g.fill();
      g.restore();
    }
    if (flower) {
      for (let i = 0; i < 46; i++) {
        const a = rnd(i * 5.7) * 6.283, r = 0.25 + rnd(i * 3.3) * 0.62;
        const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r - S * 0.04;
        g.fillStyle = flower;
        for (let k = 0; k < 9; k++) {
          const aa = rnd(i * 10 + k) * 6.283, rr = rnd(i + k * 3) * 11;
          g.beginPath();
          g.arc(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr, 3.4 + rnd(k + i) * 2.4, 0, 6.283);
          g.fill();
        }
      }
    }
  });
}

// --- злаки -----------------------------------------------------------------
function grassTallTex() {
  return alphaTex('grassTall', (g, S) => {
    const cx = S / 2;
    for (let i = 0; i < 230; i++) {
      const side = rnd(i) > 0.5 ? 1 : -1;
      const lean = (0.1 + rnd(i * 3.1) * 0.5) * side;
      const h = S * (0.45 + rnd(i * 2.3) * 0.5);
      const sh = 0.6 + rnd(i * 7.7) * 0.5;
      g.strokeStyle = `rgba(${(150 * sh) | 0},${(160 * sh) | 0},${(96 * sh) | 0},0.95)`;
      g.lineWidth = 2 + rnd(i * 5.1) * 2;
      g.beginPath();
      g.moveTo(cx + (rnd(i * 9.1) - 0.5) * S * 0.28, S);
      g.quadraticCurveTo(cx + lean * S * 0.22, S - h * 0.6, cx + lean * S * 0.5, S - h);
      g.stroke();
    }
    // метёлки
    for (let i = 0; i < 46; i++) {
      const side = rnd(i * 2.1) > 0.5 ? 1 : -1;
      const lean = (0.15 + rnd(i * 4.3) * 0.45) * side;
      const h = S * (0.62 + rnd(i * 1.7) * 0.34);
      g.fillStyle = `rgba(214,200,164,0.92)`;
      const x = cx + lean * S * 0.5, y = S - h;
      for (let k = 0; k < 16; k++) {
        g.beginPath();
        g.ellipse(x + (rnd(i + k) - 0.5) * 12, y + k * 3.2, 2.6, 5, lean * 0.4, 0, 6.283);
        g.fill();
      }
    }
  });
}

// --- материалы крон --------------------------------------------------------
const MATS = {};
function crossMat(key, tex) {
  if (MATS[key]) return MATS[key];
  MATS[key] = new THREE.MeshStandardMaterial({
    map: tex, transparent: false, alphaTest: 0.42, side: THREE.DoubleSide,
    roughness: 0.95, metalness: 0,
  });
  return MATS[key];
}

/** крона из n пересекающихся плоскостей */
function crossCrown(mat, w, h, n, seed) {
  const grp = new THREE.Group();
  const gm = geo('plane', () => new THREE.PlaneGeometry(1, 1));
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(gm, mat);
    m.scale.set(w * (0.88 + rnd(seed + i) * 0.24), h * (0.9 + rnd(seed + i * 3) * 0.2), 1);
    m.position.y = h / 2;
    m.rotation.y = (i / n) * Math.PI + rnd(seed + i * 7) * 0.3;
    m.castShadow = true; m.receiveShadow = true;
    grp.add(m);
  }
  return grp;
}

// ---------------------------------------------------------------------------
//  Сосна обыкновенная — голый ствол, крона в верхней трети (сосняк Токсово)
// ---------------------------------------------------------------------------
function pine(M, h, seed) {
  const g = new THREE.Group();
  const r = 0.14 + h * 0.011;
  const tr = new THREE.Mesh(
    geo('trunkTaper', () => new THREE.CylinderGeometry(0.45, 1, 1, 8)), M.barkPine);
  tr.scale.set(r, h * 0.72, r);
  tr.position.y = h * 0.36;
  tr.castShadow = true; tr.receiveShadow = true;
  g.add(tr);
  // нижние сухие сучки
  for (let i = 0; i < 3; i++) {
    const br = new THREE.Mesh(geo('branch', () => new THREE.CylinderGeometry(0.03, 0.06, 1, 5)), M.barkPine);
    const a = rnd(seed + i * 3) * 6.283, L = 0.5 + rnd(seed + i) * 0.7;
    br.scale.set(1, L, 1);
    br.position.set(Math.cos(a) * L * 0.35, h * (0.40 + i * 0.07), Math.sin(a) * L * 0.35);
    br.rotation.z = Math.cos(a) * 1.15; br.rotation.x = -Math.sin(a) * 1.15;
    g.add(br);
  }
  const cw = 3.4 + rnd(seed) * 2.6, ch = h * 0.40;
  const crown = crossCrown(crossMat('pine', coniferTex(0)), cw, ch, 4, seed);
  crown.position.y = h * 0.60;
  g.add(crown);
  return g;
}

// --- ель / молодое хвойное: конус от земли ---------------------------------
function spruce(M, h, seed) {
  const g = new THREE.Group();
  const tr = new THREE.Mesh(geo('trunkTaper', () => new THREE.CylinderGeometry(0.45, 1, 1, 8)), M.bark);
  tr.scale.set(0.07 + h * 0.012, h * 0.3, 0.07 + h * 0.012);
  tr.position.y = h * 0.15;
  g.add(tr);
  const crown = crossCrown(crossMat('spruce', coniferTex(-8)), h * 0.72, h * 0.92, 4, seed + 5);
  crown.position.y = h * 0.07;
  g.add(crown);
  return g;
}

// --- колонновидное (туя Smaragd) -------------------------------------------
function column(M, h, seed) {
  const g = new THREE.Group();
  const crown = crossCrown(crossMat('thuja', coniferTex(10)), h * 0.30, h, 3, seed + 11);
  g.add(crown);
  return g;
}

// --- лиственное дерево -----------------------------------------------------
function decid(M, h, seed) {
  const g = new THREE.Group();
  const r = 0.09 + h * 0.017;
  const tr = new THREE.Mesh(geo('trunkTaper', () => new THREE.CylinderGeometry(0.5, 1, 1, 8)), M.bark);
  tr.scale.set(r, h * 0.52, r);
  tr.position.y = h * 0.26;
  tr.castShadow = true;
  g.add(tr);
  // развилка ветвей
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.283 + rnd(seed + i) * 1.1, L = h * (0.18 + rnd(seed + i * 2) * 0.12);
    const br = new THREE.Mesh(geo('branch', () => new THREE.CylinderGeometry(0.03, 0.08, 1, 5)), M.bark);
    br.scale.set(r * 5, L, r * 5);
    br.position.set(Math.cos(a) * L * 0.3, h * 0.52 + L * 0.35, Math.sin(a) * L * 0.3);
    br.rotation.z = -Math.cos(a) * 0.55; br.rotation.x = Math.sin(a) * 0.55;
    br.castShadow = true;
    g.add(br);
  }
  const cw = h * 0.82, ch = h * 0.56;
  const crown = crossCrown(crossMat('decid', deciduousTex(0)), cw, ch, 4, seed + 3);
  crown.position.y = h * 0.46;
  g.add(crown);
  return g;
}

// --- штамбовое шаровидное (клён Globosum) ----------------------------------
function ballTree(M, h, seed) {
  const g = new THREE.Group();
  const r = 0.055 + h * 0.012;
  const tr = new THREE.Mesh(geo('trunkStraight', () => new THREE.CylinderGeometry(1, 1.15, 1, 8)), M.bark);
  tr.scale.set(r, h * 0.62, r);
  tr.position.y = h * 0.31;
  tr.castShadow = true;
  g.add(tr);
  const d = h * 0.52;
  const crown = crossCrown(crossMat('ball', deciduousTex(12)), d, d, 4, seed + 9);
  crown.position.y = h * 0.60;
  g.add(crown);
  return g;
}

// --- кустарники ------------------------------------------------------------
const BUSH_KIND = {
  bush:       { rgb: [92, 138, 62], flower: null },
  bushFlower: { rgb: [78, 122, 58], flower: 'rgba(226,232,206,0.95)' },
  shrubC:     { rgb: [58, 96, 66], flower: null },
  ground:     { rgb: [84, 124, 84], flower: null },
};
function bushPlant(M, h, seed, kind) {
  const k = BUSH_KIND[kind] || BUSH_KIND.bush;
  const mat = crossMat('b' + kind, bushTex(kind, k.rgb, k.flower));
  const w = h * (kind === 'ground' ? 2.6 : 1.55);
  return crossCrown(mat, w, h, 3, seed + 17);
}
function grassTall(M, h, seed) {
  return crossCrown(crossMat('grassTall', grassTallTex()), h * 1.15, h, 3, seed + 23);
}

export function makePlant(kind, M, h, seed) {
  switch (kind) {
    case 'pine': return pine(M, h, seed);
    case 'conifer': return spruce(M, h, seed);
    case 'column': return column(M, h, seed);
    case 'decid': return decid(M, h, seed);
    case 'ballTree': return ballTree(M, h, seed);
    case 'grassTall': return grassTall(M, h, seed);
    case 'shrub': return bushPlant(M, h, seed, 'shrubC');
    default: return bushPlant(M, h, seed, kind);
  }
}

/**
 * Существующая растительность из съёмки.
 * Участок в сосняке («Токсово») — хвойные трактуем как взрослые сосны.
 */
export function buildExisting(trees, M, zAt, keep = () => true, inside = () => true) {
  const site = new THREE.Group(); site.name = 'Существующие насаждения на участке';
  const forest = new THREE.Group(); forest.name = 'Окружающий сосняк (за границей)';
  const n = { pine: 0, decid: 0, shrub: 0 };
  let removed = 0;
  trees.forEach((t, i) => {
    const onSite = inside(t);
    if (onSite && !keep(t)) { removed++; return; }
    let kind, h;
    if (t.cls === 'conifer') { kind = 'pine'; h = 14 + rnd(i) * 7; if (onSite) n.pine++; }
    else if (t.cls === 'decid') { kind = 'decid'; h = 7 + rnd(i * 3) * 4; if (onSite) n.decid++; }
    else { kind = 'shrub'; h = 0.7 + rnd(i * 7) * 0.9; if (onSite) n.shrub++; }
    const p = makePlant(kind, M, h, i + 1);
    p.position.set(t.x, zAt(t.x, t.y), -t.y);
    p.rotation.y = rnd(i * 11) * 6.28;
    p.userData = { existing: true, onSite, kind, h: +h.toFixed(1) };
    (onSite ? site : forest).add(p);
  });
  site.userData.count = n;
  site.userData.removed = removed;
  forest.userData.count = forest.children.length;
  return { site, forest };
}
