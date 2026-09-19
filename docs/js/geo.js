// ============================================================================
//  Система координат и рельеф
//  Локальные XY = МСК минус origin (X — восток, Y — север), Z — абс. отметка.
//  Three.js:  x = X,  y = Z(высота),  z = -Y   (север = -Z)
// ============================================================================
import { LEVELS, WALLS, STEPS, DRIVE } from './design.js';

export let SITE_DATA = null;

// углы участка: D(ЮЗ) C(ЮВ) B(СВ) A(СЗ)
let D, eU, eV, invDet, uvA, uvB;

export function initGeo(site) {
  SITE_DATA = site;
  const B4 = site.boundary;           // [СЗ, СВ, ЮВ, ЮЗ] в порядке обхода
  const A = B4[0], Bc = B4[1], C = B4[2], Dd = B4[3];
  D = Dd;
  const du = [C[0] - Dd[0], C[1] - Dd[1]];
  const dv = [A[0] - Dd[0], A[1] - Dd[1]];
  const lu = Math.hypot(du[0], du[1]), lv = Math.hypot(dv[0], dv[1]);
  eU = [du[0] / lu, du[1] / lu];
  eV = [dv[0] / lv, dv[1] / lv];
  const det = eU[0] * eV[1] - eV[0] * eU[1];
  invDet = 1 / det;
  uvA = lv; uvB = lu;
  buildTerrain();
  return { lu, lv };
}

/** (u,v) участка → локальные XY */
export function uv2xy(u, v) {
  return [D[0] + eU[0] * u + eV[0] * v, D[1] + eU[1] * u + eV[1] * v];
}
/** локальные XY → (u,v) */
export function xy2uv(x, y) {
  const dx = x - D[0], dy = y - D[1];
  return [(dx * eV[1] - eV[0] * dy) * invDet, (eU[0] * dy - dx * eU[1]) * invDet];
}
/** азимут оси u (для разворота объектов параллельно границам), рад */
export function uAngle() { return Math.atan2(eU[1], eU[0]); }

// ---------------------------------------------------------------------------
//  РЕЛЬЕФ
// ---------------------------------------------------------------------------
const GRID = { step: 0.5, pad: 6 };
export const terrain = { nx: 0, ny: 0, x0: 0, y0: 0, exist: null, design: null };

function idw(px, py, pts, k = 8, power = 2) {
  // k ближайших точек, обратные квадраты расстояний
  const near = [];
  for (const p of pts) {
    const d2 = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d2 < 1e-6) return p.z;
    if (near.length < k) { near.push([d2, p.z]); near.sort((a, b) => a[0] - b[0]); }
    else if (d2 < near[k - 1][0]) { near[k - 1] = [d2, p.z]; near.sort((a, b) => a[0] - b[0]); }
  }
  let sw = 0, sv = 0;
  for (const [d2, z] of near) { const w = 1 / Math.pow(d2, power / 2); sw += w; sv += w * z; }
  return sv / sw;
}

function buildTerrain() {
  const b = SITE_DATA.boundary;
  const xs = b.map(p => p[0]), ys = b.map(p => p[1]);
  const x0 = Math.min(...xs) - GRID.pad, x1 = Math.max(...xs) + GRID.pad;
  const y0 = Math.min(...ys) - GRID.pad, y1 = Math.max(...ys) + GRID.pad;
  const nx = Math.ceil((x1 - x0) / GRID.step) + 1;
  const ny = Math.ceil((y1 - y0) / GRID.step) + 1;
  const pts = SITE_DATA.elev;

  const exist = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      exist[j * nx + i] = idw(x0 + i * GRID.step, y0 + j * GRID.step, pts);
    }
  }

  // --- проектная планировка: террасы + сглаживание переходов ---
  const design = new Float32Array(exist);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * GRID.step, y = y0 + j * GRID.step;
      const [u, v] = xy2uv(x, y);
      const idx = j * nx + i;
      if (u < -1 || u > uvB + 1 || v < -1 || v > uvA + 1) continue; // вне участка — как есть
      design[idx] = designZ(u, v, exist[idx]);
    }
  }
  // лёгкое сглаживание проектной поверхности (3 прохода), чтобы бровки не рвались
  const tmp = new Float32Array(design);
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const k = j * nx + i;
        tmp[k] = (design[k] * 4 + design[k - 1] + design[k + 1] + design[k - nx] + design[k + nx]) / 8;
      }
    }
    design.set(tmp);
  }

  // Сглаживание размывает уступ между террасами в пологий откос — тогда
  // подпорная стенка перестаёт держать грунт, а марш повисает над склоном.
  // Возвращаем расчётные отметки в полосе ±1,4 м от каждой стенки; в проёмах
  // под лестницы там уже лежит наклонная плоскость марша из designZ.
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * GRID.step, y = y0 + j * GRID.step;
      const [u, v] = xy2uv(x, y);
      if (u < -1 || u > uvB + 1 || v < -1 || v > uvA + 1) continue;
      const idx = j * nx + i;
      let sharp = false;
      for (const w of WALLS) {
        if (v < w.v[0] - 0.4 || v > w.v[1] + 0.4) continue;
        if (Math.abs(u - w.u) <= 1.4 && !(DRIVE && v > DRIVE.v[0] - 1.0 && v < DRIVE.v[1] + 1.0)) { sharp = true; break; }
      }
      if (!sharp) for (const st of STEPS) {          // и по всей длине марша
        const s = stairSpan(st);
        if (Math.abs(v - st.v) > st.w / 2 + 0.45) continue;
        if (u > s.uTop + 0.3 || u < s.uTop - s.len - 0.9) continue;
        sharp = true; break;
      }
      if (sharp) design[idx] = designZ(u, v, exist[idx]);
    }
  }

  Object.assign(terrain, { nx, ny, x0, y0, exist, design, step: GRID.step });
}

/**
 * Геометрия марша: считается ОДИН раз здесь, чтобы рельеф (вырез под лестницу)
 * и сами ступени в build.js строились по одним и тем же числам.
 * Отметки берутся за пределами марша — на теле верхней и нижней террас.
 */
export function stairSpan(st) {
  const zT = terraceZ(st.u + 1.6, st.v, 0);
  const zB = terraceZ(st.u - 3.2, st.v, 0);
  const dz = Math.max(0.30, zT - zB);
  const n = Math.max(2, Math.round(dz / 0.15));
  const tread = 0.33;
  return { zT, zB, dz, n, tread, rise: dz / n, len: n * tread, uTop: st.u + 0.30 };
}

/** отметка по террасам, без вырезов под лестницы */
function terraceZ(u, v, zNat) {
  const T = LEVELS.terrace;
  const lerp = (t, a, b) => a + (b - a) * t;
  let z;
  if (u >= T.entry.u[0]) {
    // въездная терраса: у границы террас 83,55 → у ворот 84,55
    const t = (u - T.entry.u[0]) / (T.entry.u[1] - T.entry.u[0]);
    z = lerp(t, T.entry.z1, T.entry.z0);
  } else if (u >= T.house.u[0]) {
    const t = (u - T.house.u[0]) / (T.house.u[1] - T.house.u[0]);
    z = T.house.z1 + (T.house.z0 - T.house.z1) * t;
  } else if (u >= T.garden.u[0]) {
    const t = (u - T.garden.u[0]) / (T.garden.u[1] - T.garden.u[0]);
    z = T.garden.z1 + (T.garden.z0 - T.garden.z1) * t;
  } else {
    // лесная зона — рельеф естественный, только сглаживаем стык
    const t = Math.max(0, Math.min(1, u / T.wild.u[1]));
    const zt = T.wild.z1 + (T.wild.z0 - T.wild.z1) * t;
    z = zNat * (1 - t * 0.7) + zt * (t * 0.7);
  }
  // небольшой поперечный уклон к северу для водоотвода (0,5 %)
  z += (v - uvA / 2) * 0.005;
  return z;
}

/**
 * Проектная отметка с вырезом под марши лестниц: в полосе марша поверхность
 * идёт наклонной плоскостью от верхней террасы к нижней, иначе ступени
 * повисают над откосом либо тонут в нём.
 */
export function designZ(u, v, zNat) {
  let z = terraceZ(u, v, zNat);
  //  ПОЛОСА ПРОЕЗДА к ЛОС: здесь террас нет — непрерывный уклон от въездной
  //  площадки вниз, иначе машина откачки не спустится (на уступах она встанет).
  //  К краям полосы уклон плавно сопрягается с террасами.
  if (DRIVE) {
    const half = (DRIVE.v[1] - DRIVE.v[0]) / 2, vc = (DRIVE.v[0] + DRIVE.v[1]) / 2;
    const dv = Math.abs(v - vc);
    if (dv < half + 1.4 && u >= DRIVE.u[0] - 1.0 && u <= DRIVE.u[1] + 1.0) {
      const uu = Math.max(DRIVE.u[0], Math.min(DRIVE.u[1], u));
      const t = (uu - DRIVE.u[0]) / (DRIVE.u[1] - DRIVE.u[0]);
      const zLo = terraceZ(DRIVE.u[0] - 1.2, v, zNat);
      const zHi = terraceZ(DRIVE.u[1] + 1.2, v, zNat);
      let zD = zLo + (zHi - zLo) * t;
      if (dv > half) {                       // сопряжение с соседним рельефом
        const k = (half + 1.4 - dv) / 1.4;
        zD = z + (zD - z) * Math.max(0, Math.min(1, k));
      }
      z = zD;
    }
  }
  for (const st of STEPS) {
    const half = st.w / 2 + 0.25;
    const dv = Math.abs(v - st.v);
    if (dv > half) continue;
    const s = stairSpan(st);
    const uB = s.uTop - s.len;
    if (u > s.uTop || u < uB - 0.6) continue;
    const t = Math.min(1, (s.uTop - u) / s.len);
    //  земля идёт по НИЗУ подступёнков, а не по линии проступей: иначе газон
    //  (он лежит сплошным ковром по рельефу) топит ступени и виден только силуэт.
    //  У подножия вырез сходит в ноль — ямы перед маршем не возникает.
    //  дополнительная врезка 12 см в верхней части марша: газон лежит сплошным
    //  ковром по рельефу, и без неё ступени выступают на 2–6 см и не читаются.
    //  К подножию врезка сходит в ноль — марш выходит на отметку нижней террасы.
    let zStair = s.zT - s.dz * t - s.rise * (1 - t) - 0.12 * (1 - t * t);
    // к краям полосы марш сходит на нет, чтобы не рвать поверхность
    if (dv > st.w / 2 - 0.1) {
      const k = (half - dv) / 0.35;
      zStair = z + (zStair - z) * Math.max(0, Math.min(1, k));
    }
    z = zStair;
  }
  return z;
}

/** отметка поверхности по локальным XY */
export function groundZ(x, y, mode = 'design') {
  const t = terrain;
  const arr = mode === 'exist' ? t.exist : t.design;
  const fx = (x - t.x0) / t.step, fy = (y - t.y0) / t.step;
  const i = Math.max(0, Math.min(t.nx - 2, Math.floor(fx)));
  const j = Math.max(0, Math.min(t.ny - 2, Math.floor(fy)));
  const dx = fx - i, dy = fy - j;
  const a = arr[j * t.nx + i], b = arr[j * t.nx + i + 1];
  const c = arr[(j + 1) * t.nx + i], d = arr[(j + 1) * t.nx + i + 1];
  return (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy;
}

/** отметка по (u,v) */
export function groundZuv(u, v, mode = 'design') {
  const [x, y] = uv2xy(u, v);
  return groundZ(x, y, mode);
}

/** точка внутри полигона */
export function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function polyArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}
export function polyPerim(pts, close = true) {
  let s = 0;
  const n = close ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += Math.hypot(x2 - x1, y2 - y1);
  }
  return s;
}
/** длина ломаной в (u,v) — метры */
export const pathLen = (p) => polyPerim(p, false);
