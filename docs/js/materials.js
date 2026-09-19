// ============================================================================
//  Процедурные текстуры и материалы (без внешних ассетов)
// ============================================================================
import * as THREE from '../lib/three.module.js';

const cache = new Map();
function tex(key, w, h, draw, repX = 1, repY = 1) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
const rnd = (s) => { let x = Math.sin(s) * 10000; return x - Math.floor(x); };

// --- вертикальная разноширинная доска (фасад дома) -------------------------
export function boardTexture(color = '#4d5f47', seed = 1) {
  return tex('board' + color + seed, 512, 512, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    let x = 0, i = 0;
    while (x < w) {
      const bw = [26, 34, 44, 30, 38][Math.floor(rnd(seed + i) * 5)];
      const sh = (rnd(seed + i * 3.1) - 0.5) * 22;
      g.fillStyle = shade(color, sh);
      g.fillRect(x, 0, bw - 2, h);
      g.fillStyle = 'rgba(0,0,0,.35)';       // теневой шов
      g.fillRect(x + bw - 2, 0, 2, h);
      // продольная фактура
      for (let k = 0; k < 8; k++) {
        g.fillStyle = `rgba(0,0,0,${0.03 + rnd(seed + i + k) * 0.05})`;
        g.fillRect(x + rnd(seed + i * 7 + k) * bw, 0, 1, h);
      }
      x += bw; i++;
    }
  }, 6, 3);
}

// --- горизонтальная рейка (цоколь, ограждения, навес) ----------------------
export function slatTexture(color = '#2b2b2d', gap = 0.32) {
  return tex('slat' + color + gap, 256, 256, (g, w, h) => {
    g.fillStyle = '#17181a'; g.fillRect(0, 0, w, h);
    const n = 12, hh = h / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = shade(color, (rnd(i * 2.3) - 0.5) * 16);
      g.fillRect(0, i * hh, w, hh * (1 - gap));
    }
  }, 4, 4);
}

// --- фальцевая кровля ------------------------------------------------------
export function seamRoofTexture(color = '#2b2b2d') {
  return tex('seam' + color, 256, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = shade(color, 16); g.fillRect(x, 0, 3, h);
      g.fillStyle = shade(color, -22); g.fillRect(x + 3, 0, 2, h);
    }
    g.fillStyle = 'rgba(255,255,255,.04)';
    for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 1);
  }, 10, 6);
}

// --- брусчатка вибропрессованная 200×100 -----------------------------------
export function paveTexture(base = '#9c9a95') {
  return tex('pave' + base, 512, 512, (g, w, h) => {
    g.fillStyle = '#6e6c68'; g.fillRect(0, 0, w, h);
    const bw = 64, bh = 32;
    for (let r = 0, y = 0; y < h; y += bh, r++) {
      const off = (r % 2) * bw / 2;
      for (let x = -bw; x < w + bw; x += bw) {
        g.fillStyle = shade(base, (rnd(x * 0.13 + y * 0.31) - 0.5) * 20);
        g.fillRect(x + off + 1.5, y + 1.5, bw - 3, bh - 3);
      }
    }
  }, 14, 14);
}

// --- плитняк / крупная плита -----------------------------------------------
export function slabTexture(base = '#b6b3ad') {
  return tex('slab' + base, 512, 512, (g, w, h) => {
    g.fillStyle = '#84817b'; g.fillRect(0, 0, w, h);
    const s = 128;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      g.fillStyle = shade(base, (rnd(x * 0.7 + y * 1.3) - 0.5) * 18);
      g.fillRect(x + 3, y + 3, s - 6, s - 6);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(0,0,0,${rnd(x + y + k) * 0.05})`;
        g.fillRect(x + rnd(k * 1.7 + x) * s, y + rnd(k * 2.9 + y) * s, 2, 2);
      }
    }
  }, 8, 8);
}

// --- террасная доска -------------------------------------------------------
export function deckTexture(base = '#a78b62') {
  return tex('deck' + base, 512, 256, (g, w, h) => {
    g.fillStyle = '#6b573a'; g.fillRect(0, 0, w, h);
    const n = 8, bh = h / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = shade(base, (rnd(i * 5.1) - 0.5) * 20);
      g.fillRect(0, i * bh + 1.5, w, bh - 3);
      for (let k = 0; k < 26; k++) {
        g.fillStyle = `rgba(80,55,28,${0.06 + rnd(i + k) * 0.1})`;
        g.fillRect(rnd(i * 3 + k) * w, i * bh + 2 + rnd(k) * (bh - 6), 30 + rnd(k * 2) * 60, 1);
      }
    }
  }, 6, 3);
}

// --- газон -----------------------------------------------------------------
export function grassTexture(base = '#5f8a3a') {
  return tex('grass' + base, 512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) {
      const x = rnd(i * 1.7) * w, y = rnd(i * 3.3) * h;
      const v = (rnd(i * 5.9) - 0.5) * 46;
      g.strokeStyle = shade(base, v);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd(i * 7.1) - 0.5) * 2, y - 2 - rnd(i * 11) * 3); g.stroke();
    }
    // полосы стрижки
    for (let y = 0; y < h; y += 64) {
      g.fillStyle = `rgba(255,255,255,${(y / 64) % 2 ? 0.035 : 0})`;
      g.fillRect(0, y, w, 64);
    }
  }, 22, 22);
}

// --- грунт цветника / кора -------------------------------------------------
export function mulchTexture(base = '#4a3524') {
  return tex('mulch' + base, 256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = rnd(i * 2.1) * w, y = rnd(i * 4.3) * h;
      g.fillStyle = shade(base, (rnd(i * 6.7) - 0.4) * 40);
      g.save(); g.translate(x, y); g.rotate(rnd(i) * 3.14);
      g.fillRect(0, 0, 3 + rnd(i * 9) * 7, 2); g.restore();
    }
  }, 10, 10);
}

// --- гранитная крошка / отсыпка --------------------------------------------
export function gravelTexture(base = '#8e8b86') {
  return tex('gravel' + base, 256, 256, (g, w, h) => {
    g.fillStyle = '#6a6762'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4200; i++) {
      const x = rnd(i * 1.3) * w, y = rnd(i * 2.9) * h, r = 1 + rnd(i * 5.1) * 2.6;
      g.fillStyle = shade(base, (rnd(i * 8.3) - 0.5) * 46);
      g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill();
    }
  }, 12, 12);
}

// --- фактура лицевой поверхности плиты (для одного элемента) ---------------
export function stoneFaceTexture(base = '#bcb9b3') {
  return tex('sface' + base, 128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = (rnd(i * 3.7) - 0.5) * 34;
      g.fillStyle = shade(base, v);
      g.fillRect(rnd(i * 1.9) * w, rnd(i * 5.3) * h, 1 + rnd(i) * 3, 1 + rnd(i * 2) * 3);
    }
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
  }, 1, 1);
}

// --- камень подпорной стенки ------------------------------------------------
export function stoneWallTexture(base = '#8b8378') {
  return tex('swall' + base, 512, 256, (g, w, h) => {
    g.fillStyle = '#4e483f'; g.fillRect(0, 0, w, h);
    const rows = 7, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd(r * 3.1) * 60;
      while (x < w) {
        const bw = 44 + rnd(x + r * 7) * 60;
        g.fillStyle = shade(base, (rnd(x * 0.3 + r * 2.7) - 0.5) * 34);
        g.fillRect(x + 2, r * rh + 2, bw - 4, rh - 4);
        x += bw;
      }
    }
  }, 6, 2);
}

// --- кирпич столбов ограждения ---------------------------------------------
export function brickTexture(base = '#b9b2a6') {
  return tex('brick' + base, 256, 256, (g, w, h) => {
    g.fillStyle = '#7d766a'; g.fillRect(0, 0, w, h);
    const bw = 64, bh = 26;
    for (let r = 0, y = 0; y < h; y += bh, r++) {
      const off = (r % 2) * bw / 2;
      for (let x = -bw; x < w + bw; x += bw) {
        g.fillStyle = shade(base, (rnd(x + y * 3) - 0.5) * 22);
        g.fillRect(x + off + 1.5, y + 1.5, bw - 3, bh - 3);
      }
    }
  }, 2, 4);
}

/** оттенок цвета в hex — для палитр вариантов дизайна */
export function shadeHex(hex, amt) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const p = [cl(((n >> 16) & 255) + amt), cl(((n >> 8) & 255) + amt), cl((n & 255) + amt)];
  return '#' + p.map(v => v.toString(16).padStart(2, '0')).join('');
}
function shade(hex, amt) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl(((n >> 16) & 255) + amt), g = cl(((n >> 8) & 255) + amt), b = cl((n & 255) + amt);
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
//  Готовые материалы
// ---------------------------------------------------------------------------
export function makeMaterials(concept = null) {
  const C = concept || { pave: '#9c9a95', bed: '#4a3524', lawn: '#5f8a3a' };
  const M = {};
  const std = (o) => new THREE.MeshStandardMaterial(o);

  M.wall      = std({ map: boardTexture('#4d5f47', 1), roughness: 0.86, metalness: 0.02 });
  M.wallGable = std({ map: boardTexture('#4d5f47', 7), roughness: 0.86, metalness: 0.02 });
  M.plinth    = std({ map: slatTexture('#2e2e30', 0.22), roughness: 0.9 });
  M.roof      = std({ map: seamRoofTexture('#2b2b2d'), roughness: 0.55, metalness: 0.35 });
  M.trim      = std({ color: 0x232326, roughness: 0.7, metalness: 0.15 });
  M.steel     = std({ color: 0x35363a, roughness: 0.45, metalness: 0.75 });
  M.woodLight = std({ map: boardTexture('#b08a5e', 3), roughness: 0.84 });
  M.slatWarm  = std({ map: slatTexture('#c08b4a', 0.36), roughness: 0.8 });
  M.slatDark  = std({ map: slatTexture('#2a2a2c', 0.34), roughness: 0.85 });
  M.deck      = std({ map: deckTexture('#a78b62'), roughness: 0.82 });
  M.glass     = std({ color: 0x9dc0d4, roughness: 0.08, metalness: 0.55, transparent: true, opacity: 0.55 });
  M.pave      = std({ map: paveTexture(C.pave), roughness: 0.94 });
  M.paveDrive = std({ map: paveTexture(shadeHex(C.pave, -14)), roughness: 0.94 });
  M.slab      = std({ map: slabTexture(shadeHex(C.pave, 22)), roughness: 0.9 });
  // отдельные элементы мощения — раскладываются инстансами поверх основания
  M.paveUnit  = std({ color: new THREE.Color(C.pave), roughness: 0.92, metalness: 0.02 });
  M.slabUnit  = std({ map: stoneFaceTexture(shadeHex(C.pave, 26)), roughness: 0.88 });
  M.sandBase  = std({ color: 0x6a6660, roughness: 1.0 });
  M.grass     = std({ map: grassTexture(C.lawn), roughness: 1.0 });
  M.grassDry  = std({ map: grassTexture(shadeHex(C.lawn, 10)), roughness: 1.0 });
  M.mulch     = std({ map: mulchTexture(C.bed), roughness: 1.0 });
  M.gravel    = std({ map: gravelTexture('#8e8b86'), roughness: 0.98 });
  M.stoneWall = std({ map: stoneWallTexture('#8b8378'), roughness: 0.92 });
  M.brick     = std({ map: brickTexture('#b9b2a6'), roughness: 0.9 });
  M.fence     = std({ color: 0x8d9296, roughness: 0.62, metalness: 0.28 });        // штакетник серый
  M.fenceRail = std({ color: 0x6f7478, roughness: 0.5, metalness: 0.45 });         // лаги и столбы
  M.fenceBase = std({ color: 0x7c8084, roughness: 0.85, metalness: 0.1 });         // цоколь
  M.curb      = std({ color: 0xa8a59e, roughness: 0.92 });
  M.ceilDark  = std({ color: 0x24262a, roughness: 0.82, metalness: 0.15 });   // подшивка навеса
  M.gate      = std({ color: 0x33373c, roughness: 0.55, metalness: 0.5 });    // секционные ворота
  M.bark      = std({ color: 0x5a4632, roughness: 0.95 });
  M.barkPine  = std({ color: 0x7d5a3c, roughness: 0.95 });
  M.leafD     = std({ color: 0x4f7c34, roughness: 0.95 });
  M.leafC     = std({ color: 0x2f5a3c, roughness: 0.95 });
  M.leafBush  = std({ color: 0x5c8a3e, roughness: 0.95 });
  M.flower    = std({ color: 0xd8cfe6, roughness: 0.9 });
  M.lampBody  = std({ color: 0x2c2d30, roughness: 0.5, metalness: 0.6 });
  M.lampGlow  = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  M.water     = std({ color: 0x4a7fa8, roughness: 0.12, metalness: 0.4 });
  return M;
}
