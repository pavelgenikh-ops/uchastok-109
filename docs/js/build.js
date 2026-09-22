// ============================================================================
//  Сборка сцены благоустройства
// ============================================================================
import * as THREE from '../lib/three.module.js';
import {
  SITE, LEVELS, WALLS, STEPS, TERR_STEPS, HOUSE, CARPORT, UTILITY,
  PAVING, STEPPING, BEDS, PLANTING, LIGHTS, FENCE, BBQ, pavingFor, steppingFor,
} from './design.js';
import { buildBBQZone, bench, stringLights } from './furniture.js';
import { uv2xy, xy2uv, uAngle, groundZ, groundZuv, terrain, inPoly, stairSpan, SITE_DATA } from './geo.js';
import { makePlant } from './plants.js';
import { buildCarport } from './carport.js';
import { buildSubaruXV } from './car.js';
import { loadCarModel } from './carmodel.js';
import { buildHouse } from './house.js';

const T3 = (x, y, z) => new THREE.Vector3(x, z, -y);     // локальные XY,Z → three
const rnd = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------------------
//  Рельеф
// ---------------------------------------------------------------------------
export function buildTerrainMesh(M, mode = 'design') {
  const t = terrain;
  const arr = mode === 'exist' ? t.exist : t.design;
  const geo = new THREE.PlaneGeometry(
    (t.nx - 1) * t.step, (t.ny - 1) * t.step, t.nx - 1, t.ny - 1);
  const pos = geo.attributes.position;
  //  ВАЖНО: строки PlaneGeometry идут от +y к −y, а после rotateX(−90°) это даёт
  //  обратный порядок по мировой оси Y. Без переворота индекса меш рельефа
  //  оказывается ЗЕРКАЛЬНЫМ по линии север–юг относительно массива отметок:
  //  покрытия и лестницы тогда считаются по одним отметкам, а земля рисуется
  //  по другим — площадки тонут в грунте или висят над ним.
  for (let j = 0; j < t.ny; j++) {
    for (let i = 0; i < t.nx; i++) {
      pos.setZ(j * t.nx + i, arr[(t.ny - 1 - j) * t.nx + i]);
    }
  }
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, M.grass);   // рельеф и есть газон: см. комментарий к buildLawn
  // центр плоскости → смещаем в начало сетки
  mesh.position.set(t.x0 + (t.nx - 1) * t.step / 2, 0, -(t.y0 + (t.ny - 1) * t.step / 2));
  mesh.receiveShadow = true;
  mesh.name = 'Рельеф';
  return mesh;
}

// ---------------------------------------------------------------------------
//  Покрытия: полигон в (u,v) → меш, прилегающий к рельефу
// ---------------------------------------------------------------------------
function triangulateUV(polyUV, maxEdge = 0.6) {   // мельче — точнее ложится на бровки
  const pts2 = polyUV.map(p => new THREE.Vector2(p[0], p[1]));
  let tris = THREE.ShapeUtils.triangulateShape(pts2, []).map(t => t.map(i => polyUV[i]));
  // подразбиение длинных треугольников — чтобы покрытие шло по рельефу
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    const next = [];
    for (const tr of tris) {
      const e = [0, 1, 2].map(i => Math.hypot(tr[(i + 1) % 3][0] - tr[i][0], tr[(i + 1) % 3][1] - tr[i][1]));
      const mx = Math.max(...e);
      if (mx <= maxEdge) { next.push(tr); continue; }
      const i = e.indexOf(mx), a = tr[i], b = tr[(i + 1) % 3], c = tr[(i + 2) % 3];
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      next.push([a, m, c], [m, b, c]);
      changed = true;
    }
    tris = next;
    if (!changed) break;
  }
  return tris;
}

export function pavingMesh(polyUV, mat, lift = 0.025, mode = 'design') {
  const tris = triangulateUV(polyUV);
  const verts = [], uvs = [];
  for (const tr of tris) {
    for (const [u, v] of tr) {
      const [x, y] = uv2xy(u, v);
      verts.push(x, groundZ(x, y, mode) + lift, -y);
      uvs.push(u / 4, v / 4);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

/** бордюр/поребрик по контуру полигона */
function curbLoop(polyUV, M, h = 0.10, w = 0.08, mode = 'design') {
  const g = new THREE.Group();
  const n = polyUV.length;
  for (let i = 0; i < n; i++) {
    const a = polyUV[i], b = polyUV[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(len / 1.5));
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps, t1 = (s + 1) / steps;
      const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
      const p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      const [x0, y0] = uv2xy(...p0), [x1, y1] = uv2xy(...p1);
      const z0 = groundZ(x0, y0, mode), z1 = groundZ(x1, y1, mode);
      const seg = Math.hypot(x1 - x0, y1 - y0);
      const box = new THREE.Mesh(new THREE.BoxGeometry(seg, h, w), M.curb);
      box.position.set((x0 + x1) / 2, (z0 + z1) / 2 + h / 2 - 0.02, -(y0 + y1) / 2);
      box.rotation.y = Math.atan2(y1 - y0, x1 - x0);
      box.receiveShadow = true; box.castShadow = true;
      g.add(box);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
//  Шаговые плиты по газону
// ---------------------------------------------------------------------------
export function steppingPath(pathUV, M, step = 0.78, mode = 'design') {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.60, 0.05, 0.40);
  let acc = 0, idx = 0;
  const segs = [];
  for (let i = 0; i < pathUV.length - 1; i++) {
    const a = pathUV[i], b = pathUV[i + 1];
    segs.push({ a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) });
  }
  const total = segs.reduce((s, x) => s + x.len, 0);
  for (let d = 0.2; d < total; d += step) {
    let rest = d, seg = null, t = 0;
    for (const s of segs) { if (rest <= s.len) { seg = s; t = rest / s.len; break; } rest -= s.len; }
    if (!seg) break;
    const u = seg.a[0] + (seg.b[0] - seg.a[0]) * t;
    const v = seg.a[1] + (seg.b[1] - seg.a[1]) * t;
    const [x, y] = uv2xy(u, v);
    const m = new THREE.Mesh(geo, M.slab);
    m.position.set(x, groundZ(x, y, mode) + 0.03, -y);
    const dir = Math.atan2(seg.b[1] - seg.a[1], seg.b[0] - seg.a[0]);
    m.rotation.y = -dir + (rnd(idx) - 0.5) * 0.10;
    m.receiveShadow = true; m.castShadow = true;
    g.add(m); idx++;
  }
  g.userData.count = idx;
  return g;
}

// ---------------------------------------------------------------------------
//  Подпорные стенки и ступени
// ---------------------------------------------------------------------------
export function buildWalls(M, mode = 'design', C = {}) {
  //  в варианте «Тёплое дерево» стенки облицованы деревом, в остальных — камень
  const wallMat = C.woodWalls ? M.woodLight : M.stoneWall;
  const g = new THREE.Group();
  g.name = 'Подпорные стенки и лестницы';
  let totalLen = 0, totalFace = 0;

  for (const w of WALLS) {
    const [v0, v1] = w.v;
    // верх стенки — единая горизонтальная отметка на всю длину: по верхней террасе
    let zTopMax = -Infinity;
    for (let v = v0; v <= v1; v += 0.5)
      zTopMax = Math.max(zTopMax, groundZuv(w.u + 0.45, v, mode));
    const zCap = zTopMax + 0.06;

    // проёмы под лестницы, чтобы стенка не шла сквозь них
    const gaps = STEPS.filter(st => Math.abs(st.u - w.u) < 0.01)
      .map(st => [st.v - st.w / 2 - 0.12, st.v + st.w / 2 + 0.12]);
    const inGap = (v) => gaps.some(([a, b]) => v > a && v < b);

    const seg = 0.6;
    const n = Math.ceil((v1 - v0) / seg);
    for (let s2 = 0; s2 < n; s2++) {
      const va = v0 + (v1 - v0) * (s2 / n), vb = v0 + (v1 - v0) * ((s2 + 1) / n);
      const vm = (va + vb) / 2;
      if (inGap(vm)) continue;
      const zBot = groundZuv(w.u - 0.75, vm, mode) - 0.35;   // заглубление ниже нижней террасы
      const h = zCap - zBot;
      const [xa, ya] = uv2xy(w.u, va), [xb, yb] = uv2xy(w.u, vb);
      const len = Math.hypot(xb - xa, yb - ya) + 0.02;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, h, len), wallMat);
      box.position.set((xa + xb) / 2, zCap - h / 2, -(ya + yb) / 2);
      box.rotation.y = uAngle() + Math.PI / 2;
      box.castShadow = true; box.receiveShadow = true;
      g.add(box);
      //  цокольный ряд: чуть шире тела стенки — читается как конструкция,
      //  а не как плита, воткнутая в грунт
      const zGrd = groundZuv(w.u - 0.75, vm, mode);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.30, len), M.curb);
      plinth.position.set((xa + xb) / 2, zGrd - 0.06, -(ya + yb) / 2);
      plinth.rotation.y = uAngle() + Math.PI / 2;
      plinth.castShadow = true; plinth.receiveShadow = true;
      g.add(plinth);
      totalLen += len - 0.02;
      totalFace += (len - 0.02) * Math.max(0.2, zCap - groundZuv(w.u - 0.75, vm, mode));
    }
    // накрывная плита — сплошной ровной лентой поверху
    for (let s2 = 0; s2 < n; s2++) {
      const va = v0 + (v1 - v0) * (s2 / n), vb = v0 + (v1 - v0) * ((s2 + 1) / n);
      const vm = (va + vb) / 2;
      if (inGap(vm)) continue;
      const [xa, ya] = uv2xy(w.u, va), [xb, yb] = uv2xy(w.u, vb);
      const len = Math.hypot(xb - xa, yb - ya) + 0.02;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.075, len), M.curb);
      cap.position.set((xa + xb) / 2, zCap + 0.037, -(ya + yb) / 2);
      cap.rotation.y = uAngle() + Math.PI / 2;
      cap.castShadow = true; cap.receiveShadow = true;
      g.add(cap);
    }
  }

  // ---------------- лестницы: марш со щёчками и площадкой ----------------
  for (const st of STEPS) {
    //  геометрия марша берётся из geo.js — теми же числами там вырезан рельеф,
    //  иначе ступени повисают над откосом или тонут в нём
    const { zT: zUp, dz, n, rise, tread, len } = stairSpan(st);
    const grp = new THREE.Group();
    const [bx, by] = uv2xy(st.u, st.v);
    grp.position.set(bx, 0, -by);
    grp.rotation.y = uAngle();

    const u0 = 0.30;   // кромка верхней площадки — совпадает с uTop в geo.js
    for (let i = 0; i < n; i++) {
      // проступь: верх i-й ступени лежит на отметке zUp - rise*i,
      // поэтому первая вровень с верхней площадкой, последняя — над нижней
      const stepGeo = new THREE.BoxGeometry(tread + 0.05, rise + 0.10, st.w);
      const m = new THREE.Mesh(stepGeo, M.curb);
      m.position.set(u0 - i * tread, zUp - rise * (i + 0.5) - 0.05, 0);
      m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
      // подступёнок в камне
      const ris = new THREE.Mesh(new THREE.BoxGeometry(0.07, rise, st.w), wallMat);
      ris.position.set(u0 - i * tread - tread / 2, zUp - rise * (i + 0.5) - 0.05, 0);
      ris.receiveShadow = true;
      grp.add(ris);
    }
    // боковые щёчки — наклонные, по уклону марша, с накрывкой поверху
    //  щёчки набираются блоками по ступеням: сплошная наклонная плита торчала бы
    //  острым концом над газоном, а ступенчатая садится на землю по всей длине
    const slope = Math.atan2(dz, len);
    const zFoot = zUp - dz - 0.45;                      // подошва щеки — ниже нижней площадки
    for (const side of [-1, 1]) {
      const sz = side * (st.w / 2 + 0.09);
      for (let i = 0; i < n; i++) {
        const zStepTop = zUp - rise * i + 0.16;         // на 16 см выше проступи — бортик
        const h = zStepTop - zFoot;
        const blk = new THREE.Mesh(new THREE.BoxGeometry(tread + 0.02, h, 0.18), wallMat);
        blk.position.set(u0 - i * tread, zStepTop - h / 2, sz);
        blk.castShadow = true; blk.receiveShadow = true;
        grp.add(blk);
      }
      // накрывка щеки — наклонная лента по уклону марша
      const top = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(len, dz) + 0.1, 0.07, 0.26), M.curb);
      top.position.set(u0 - len / 2 + 0.15, zUp - dz / 2 + 0.19, sz);
      top.rotation.z = slope;
      top.castShadow = true;
      grp.add(top);
    }
    // площадка внизу марша
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, st.w + 0.3), M.curb);
    pad.position.set(u0 - len - 0.45, zUp - dz + 0.02, 0);
    pad.receiveShadow = true;
    grp.add(pad);
    g.add(grp);
  }

  g.userData.spec = { len: +totalLen.toFixed(1), face: +totalFace.toFixed(1) };
  return g;
}

// ---------------------------------------------------------------------------
//  Ограждение
// ---------------------------------------------------------------------------
export function buildFence(M, mode = 'design') {
  const g = new THREE.Group();
  g.name = 'Ограждение и въездная группа';
  const B = SITE_DATA.boundary;
  const H = FENCE.h;
  let len = 0, posts = 0, pickets = 0;

  const picketGeo = new THREE.BoxGeometry(0.09, 1, 0.022);
  for (let i = 0; i < B.length; i++) {
    const a = B[i], b = B[(i + 1) % B.length];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const isEast = i === 1;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);

    // верх полотна — единая прямая на всю сторону: по наивысшей точке рельефа
    let zMax = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      zMax = Math.max(zMax, groundZ(x, y, mode));
    }
    const zTop = zMax + H;

    // сплошное полотно: шаг штакетин постоянный по всей стороне
    const step = 0.135;
    const n = Math.floor((segLen - 0.30) / step);
    for (let k = 0; k <= n; k++) {
      const d = 0.15 + k * step;
      const t = d / segLen;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      if (isEast) {
        const [, vm] = xy2uv(x, y);
        const gt = FENCE.gate.v, wk = FENCE.wicket.v;
        if ((vm > gt[0] - 0.1 && vm < gt[1] + 0.1) || (vm > wk[0] - 0.1 && vm < wk[1] + 0.1)) continue;
      }
      const zg = groundZ(x, y, mode);
      const hh = zTop - (zg + 0.26);                 // от верха цоколя до общего верха
      const pk = new THREE.Mesh(picketGeo, M.fence);
      pk.scale.y = hh;
      pk.position.set(x, zg + 0.26 + hh / 2, -y);
      pk.rotation.y = ang;
      pk.castShadow = true; pk.receiveShadow = true;
      g.add(pk);
      pickets++;
    }

    // цоколь и лаги — непрерывной лентой, мелкими звеньями по рельефу
    const nSeg = Math.max(2, Math.round(segLen / 1.2));
    for (let sI = 0; sI < nSeg; sI++) {
      const t0 = sI / nSeg, t1 = (sI + 1) / nSeg;
      const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
      const p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      if (isEast) {
        const [, vm] = xy2uv(mid[0], mid[1]);
        const gt = FENCE.gate.v, wk = FENCE.wicket.v;
        if ((vm > gt[0] && vm < gt[1]) || (vm > wk[0] && vm < wk[1])) continue;
      }
      const z0 = groundZ(p0[0], p0[1], mode), z1 = groundZ(p1[0], p1[1], mode);
      const zm = (z0 + z1) / 2;
      const segW = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.02;
      const base = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.30, 0.15), M.fenceBase);
      base.position.set(mid[0], zm + 0.13, -mid[1]);
      base.rotation.y = ang;
      base.receiveShadow = true; base.castShadow = true;
      g.add(base);
      // лаги — на постоянных отметках от верха полотна, поэтому строго горизонтальны
      for (const dy of [0.28, 1.12]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.05, 0.035), M.fenceRail);
        rail.position.set(mid[0], zTop - dy, -mid[1]);
        rail.rotation.y = ang;
        g.add(rail);
      }
      len += segW - 0.02;
    }

    // столбы по углам стороны и через 2,5 м
    const nPost = Math.max(1, Math.round(segLen / 2.5));
    for (let k = 0; k <= nPost; k++) {
      const t = k / nPost;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      if (isEast) {
        const [, vm] = xy2uv(x, y);
        const gt = FENCE.gate.v, wk = FENCE.wicket.v;
        if ((vm > gt[0] + 0.2 && vm < gt[1] - 0.2) || (vm > wk[0] + 0.2 && vm < wk[1] - 0.2)) continue;
      }
      const zg = groundZ(x, y, mode);
      const hh = zTop + 0.06 - zg;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, hh, 0.11), M.fenceRail);
      post.position.set(x, zg + hh / 2, -y);
      post.rotation.y = ang;
      post.castShadow = true;
      g.add(post);
      posts++;
    }
  }

  // ворота откатные и калитка
  const leaf = (uPos, vMid, w, hh) => {
    const [x, y] = uv2xy(uPos, vMid);
    const z = groundZ(x, y, mode);
    const gr = new THREE.Group();
    gr.position.set(x, z, -y);
    gr.rotation.y = uAngle();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.07, hh, w), M.fenceRail);
    frame.position.y = hh / 2 + 0.06; frame.castShadow = true;
    gr.add(frame);
    const n = Math.floor(w / 0.135);
    for (let k = 0; k < n; k++) {
      const pk = new THREE.Mesh(new THREE.BoxGeometry(0.024, hh - 0.16, 0.09), M.fence);
      pk.position.set(-0.045, hh / 2 + 0.06, -w / 2 + 0.08 + k * 0.135);
      pk.castShadow = true;
      gr.add(pk);
    }
    return gr;
  };
  g.add(leaf(SITE.U, (FENCE.gate.v[0] + FENCE.gate.v[1]) / 2, FENCE.gate.w, 1.80));
  g.add(leaf(SITE.U, (FENCE.wicket.v[0] + FENCE.wicket.v[1]) / 2, FENCE.wicket.w, 1.80));

  g.userData.spec = { len: +len.toFixed(1), posts, pickets };
  return g;
}

// ---------------------------------------------------------------------------
//  Освещение (корпуса + точки света)
// ---------------------------------------------------------------------------
export function buildLights(M, mode = 'design') {
  const g = new THREE.Group();
  g.name = 'Освещение';
  const glows = [];
  const add = (u, v, kind) => {
    const [x, y] = uv2xy(u, v);
    const z = groundZ(x, y, mode);
    if (kind === 'bollard') {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.60, 10), M.lampBody);
      b.position.set(x, z + 0.30, -y); b.castShadow = true; g.add(b);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.09, 10), M.lampGlow);
      c.position.set(x, z + 0.55, -y); g.add(c);
      glows.push({ x, y, z: z + 0.55, i: 0.5, d: 5 });
    } else if (kind === 'post') {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.0, 10), M.lampBody);
      p.position.set(x, z + 1.5, -y); p.castShadow = true; g.add(p);
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), M.lampBody);
      hd.position.set(x, z + 3.02, -y); g.add(hd);
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.17), M.lampGlow);
      c.position.set(x, z + 2.94, -y); g.add(c);
      glows.push({ x, y, z: z + 2.94, i: 1.5, d: 13 });
    } else if (kind === 'facade') {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.20, 0.10), M.lampBody);
      f.position.set(x, z + 2.2, -y); g.add(f);
      glows.push({ x, y, z: z + 2.2, i: 0.6, d: 4.5 });
    } else {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), M.lampBody);
      s.position.set(x, z + 0.06, -y); g.add(s);
      glows.push({ x, y, z: z + 0.10, i: 0.9, d: 6 });
    }
  };
  LIGHTS.bollard.pts.forEach(p => add(p[0], p[1], 'bollard'));
  LIGHTS.post.pts.forEach(p => add(p[0], p[1], 'post'));
  LIGHTS.facade.pts.forEach(p => add(p[0], p[1], 'facade'));
  LIGHTS.spot.pts.forEach(p => add(p[0], p[1], 'spot'));
  g.userData.glows = glows;
  return g;
}

// ---------------------------------------------------------------------------
//  СТУПЕНИ С ТЕРРАС И КРЫЛЬЦА
//  Настоящие марши: верх — отметка настила, низ — земля перед маршем.
//  Раньше спуск был обозначен полоской мощения, и ступеней не было видно.
// ---------------------------------------------------------------------------
export function buildTerraceSteps(M, mode = 'design') {
  const g = new THREE.Group();
  g.name = 'Ступени с террас и крыльца';
  const DIR = { south: [0, -1], north: [0, 1], west: [-1, 0], east: [1, 0] };

  for (const s of TERR_STEPS) {
    const d = DIR[s.dir] || DIR.south;
    const zTop = LEVELS.FF + (s.top || 0);
    //  землю щупаем в 1,5 м от кромки — там, куда марш приземляется
    const [gx, gy] = uv2xy(s.u + d[0] * 1.5, s.v + d[1] * 1.5);
    const zBot = groundZ(gx, gy, mode);
    const dz = Math.max(0.18, zTop - zBot);
    const n = Math.max(1, Math.round(dz / 0.17));
    const rise = dz / n, tread = 0.32;

    const grp = new THREE.Group();
    const [bx, by] = uv2xy(s.u, s.v);
    grp.position.set(bx, 0, -by);
    //  разворачиваем марш: ось X группы смотрит наружу от террасы
    const extra = { south: -Math.PI / 2, north: Math.PI / 2, west: Math.PI, east: 0 }[s.dir] || 0;
    grp.rotation.y = uAngle() + extra;
    grp.name = s.id + ' ' + s.name;

    //  Ступени в цвет террасы: тот же настил, что и сама терраса (правка 22.09.2026)
    for (let i = 0; i < n; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(tread + 0.04, rise + 0.08, s.w), M.deck);
      step.position.set(0.16 + i * tread, zTop - rise * (i + 0.5) - 0.04, 0);
      step.castShadow = true; step.receiveShadow = true;
      grp.add(step);
      const ris = new THREE.Mesh(new THREE.BoxGeometry(0.06, rise, s.w), M.deck);
      ris.position.set(0.16 + i * tread - tread / 2, zTop - rise * (i + 0.5) - 0.04, 0);
      ris.receiveShadow = true;
      grp.add(ris);
    }
    //  площадка у подножия, чтобы марш не обрывался в траву
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, s.w + 0.2), M.slab);
    pad.position.set(0.16 + n * tread + 0.45, zTop - dz - 0.02, 0);
    pad.receiveShadow = true;
    grp.add(pad);

    g.add(grp);
  }
  return g;
}

// ---------------------------------------------------------------------------
//  Хозблок и ЛОС
// ---------------------------------------------------------------------------
export function buildUtility(M, mode = 'design') {
  const g = new THREE.Group();
  g.name = 'ЛОС и инженерные колодцы';

  //  СУЩЕСТВУЮЩИЙ септик по съёмке 17.09.2026: люк с отметкой верха крышки,
  //  самотёчная канализация от дома (L=16,1 м) и сброс воды (L=7,2 м).
  //  Заказчик отметил в модели «не нанесён септик» — это он и есть.
  const ex = SITE_DATA && SITE_DATA.existing;
  if (ex && ex.septic) {
    const s = ex.septic;
    const zLid = s.lidZ;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(s.d / 2, s.d / 2, 0.12, 24), M.steel);
    lid.position.set(s.p[0], zLid + 0.06, -s.p[1]);
    lid.castShadow = true; lid.receiveShadow = true;
    lid.name = s.name;
    g.add(lid);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(s.d / 2 + 0.06, 0.05, 6, 24), M.lampBody);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(s.p[0], zLid + 0.02, -s.p[1]);
    g.add(ring);

    //  трассы показываем лентой по поверхности — глубина заложения 0,2 м,
    //  в 3D важен сам факт и направление, а не отрисовка траншеи
    const line = (pts, mat, w) => {
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 0.05) continue;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, w), mat);
        seg.position.set(mx, groundZ(mx, my, mode) + 0.03, -my);
        seg.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
        seg.receiveShadow = true;
        g.add(seg);
      }
    };
    if (ex.sewer) line(ex.sewer.pts, M.steel, 0.22);
    if (ex.outfall) line(ex.outfall.pts, M.lampBody, 0.16);
  }

  const l = UTILITY.los;
  for (const uu of [l.u[0] + 0.6, l.u[1] - 0.6]) {
    const [x, y] = uv2xy(uu, (l.v[0] + l.v[1]) / 2);
    const zz = groundZ(x, y, mode);
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.10, 18), M.lampBody);
    hatch.position.set(x, zz + 0.04, -y);
    hatch.receiveShadow = true;
    g.add(hatch);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.035, 6, 20), M.steel);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, zz + 0.05, -y);
    g.add(rim);
  }
  return g;
}

// ---------------------------------------------------------------------------
//  Проектные посадки
// ---------------------------------------------------------------------------
export function buildPlanting(M, mode = 'design', C = {}) {
  const g = new THREE.Group();
  g.name = 'Проектные посадки';
  let i = 0;
  //  вариант дизайна меняет ассортимент: в «Лесном саду» вместо штамбовых клёнов
  //  местная рябина, в «Строгой геометрии» злаки уступают стриженым шарам
  const swapCls = { 'Рябина обыкновенная': 'ballTree', 'Самшит стриженый шаром': 'bush' };
  for (const rec0 of PLANTING) {
    const swapTo = C.plantSwap && C.plantSwap[rec0.sp];
    const rec = swapTo
      ? { ...rec0, sp: swapTo, cls: swapCls[swapTo] || rec0.cls,
          h: swapTo === 'Самшит стриженый шаром' ? 0.7 : rec0.h }
      : rec0;
    for (const [u, v] of rec.pts) {
      const [x, y] = uv2xy(u, v);
      let h = rec.h * (0.86 + rnd(i * 3.7) * 0.28);
      if (rec.cls === 'grassTall' && C.grassBoost) h *= C.grassBoost;
      const p = makePlant(rec.cls, M, h, i + 100);
      p.position.set(x, groundZ(x, y, mode), -y);
      p.rotation.y = rnd(i * 5.1) * 6.28;
      p.userData = { sp: rec.sp, h: +h.toFixed(1) };
      g.add(p); i++;
    }
  }
  g.userData.count = i;
  return g;
}

// ---------------------------------------------------------------------------
//  Покрытия и цветники целиком
// ---------------------------------------------------------------------------
const MAT_BY_KIND = { pave: 'paveDrive', slab: 'slab', stone: 'slab', deck: 'deck', gravel: 'gravel' };

/** контур покрытия → путь по его длинной оси, для замены на шаговые плиты */
function polyAxis(poly) {
  const us = poly.map(q => q[0]), vs = poly.map(q => q[1]);
  const u0 = Math.min(...us), u1 = Math.max(...us);
  const v0 = Math.min(...vs), v1 = Math.max(...vs);
  return (u1 - u0) >= (v1 - v0)
    ? [[u0 + 0.3, (v0 + v1) / 2], [u1 - 0.3, (v0 + v1) / 2]]
    : [[(u0 + u1) / 2, v0 + 0.3], [(u0 + u1) / 2, v1 - 0.3]];
}

export function buildHardscape(M, mode = 'design', C = {}) {
  const list = pavingFor(C.id);
  const g = new THREE.Group();
  g.name = 'Покрытия';
  for (const p0 of list) {
    //  вариант дизайна может сменить материал покрытия или вовсе заменить его
    //  плитами по газону — контур при этом остаётся, меняется способ отделки
    const kind = (C.retype && C.retype[p0.id]) || p0.kind;
    const p = { ...p0, kind };
    if (C.toStepping && C.toStepping.includes(p.id)) {
      const st = steppingPath(polyAxis(p.poly), M, 0.72 * (C.steppingScale || 1), mode);
      st.name = `${p.id} ${p.name} — плиты по газону`;
      g.add(st);
      continue;
    }
    // подложка — песчаное основание, поверх неё раскладываются элементы
    const baseMat = p.kind === 'deck' ? M.deck : p.kind === 'gravel' ? M.gravel
      : p.kind === 'pave' ? M.pave : M.slab;
    const base = pavingMesh(p.poly, baseMat,
      p.kind === 'deck' ? 0.10 : 0.02, mode);
    base.name = `${p.id} ${p.name}`;
    g.add(base);
    const units = pavingUnits(p.poly, p.kind, M, mode, C.pattern);
    if (units) { units.name = `${p.id} — элементы мощения`; g.add(units); }
    if (p.edge || C.curbAll) g.add(curbLoop(p.poly, M, 0.13, 0.09, mode));
    // лаги террасного настила видны по торцу
    if (p.kind === 'deck') {
      const us = p.poly.map(q => q[0]), vs = p.poly.map(q => q[1]);
      const uc = (Math.min(...us) + Math.max(...us)) / 2;
      for (const vv of [Math.min(...vs), Math.max(...vs)]) {
        const [x, y] = uv2xy(uc, vv);
        const z = groundZ(x, y, mode);
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(...us) - Math.min(...us), 0.22, 0.08), M.trim);
        b.position.set(x, z + 0.02, -y);
        b.rotation.y = uAngle();
        b.receiveShadow = true; b.castShadow = true;
        g.add(b);
      }
    }
  }
  return g;
}

export function buildStepping(M, mode = 'design', C = {}) {
  const g = new THREE.Group();
  g.name = 'Шаговые дорожки';
  let n = 0;
  for (const s of steppingFor(C.id)) {
    const p = steppingPath(s.path, M, 0.78, mode);
    p.name = `${s.id} ${s.name}`;
    n += p.userData.count;
    g.add(p);
  }
  g.userData.count = n;
  return g;
}

export function buildBeds(M, mode = 'design') {
  const g = new THREE.Group();
  g.name = 'Цветники';
  for (const b of BEDS) {
    const mesh = pavingMesh(b.poly, M.mulch, 0.04, mode);
    mesh.name = `${b.id} ${b.name}`;
    g.add(mesh);
    g.add(curbLoop(b.poly, M, 0.09, 0.05, mode));
  }
  return g;
}

/** газон — вся площадь участка минус покрытия и цветники */
/**
 * Газон отдельным полотном НЕ строится. Он триангулировался по контуру участка
 * с шагом 1,2 м и на уступах между террасами натягивался как тент: у подпорных
 * стенок трава оказывалась на 27–37 см ВЫШЕ покрытий и закрывала их — отсюда
 * «дорожка обрывается» и «газон перекрыл брусчатку». Роль газона выполняет сам
 * рельеф: он построен по сетке 0,5 м и повторяет все бровки. Слой оставлен
 * пустым, чтобы не ломать переключатели в панели слоёв.
 */
export function buildLawn(M, mode = 'design') {
  const g = new THREE.Group();
  g.name = 'Газон';
  return g;
}

// ---------------------------------------------------------------------------
//  Отбор существующих насаждений: убираем те, что попадают в пятна
//  застройки и покрытий — их физически невозможно сохранить.
// ---------------------------------------------------------------------------
function expandRect(r, d) {
  return [[r.u[0] - d, r.v[0] - d], [r.u[1] + d, r.v[0] - d],
          [r.u[1] + d, r.v[1] + d], [r.u[0] - d, r.v[1] + d]];
}
/** дерево в границах участка? */
export function onSiteTest() {
  const B = SITE_DATA.boundary;
  return (t) => inPoly(t.x, t.y, B);
}
export function treeKeeper(C = {}) {
  const zones = [
    expandRect(HOUSE.warm, 1.2), expandRect(HOUSE.terrW, 0.8), expandRect(HOUSE.terrS, 0.8),
    expandRect(HOUSE.porch, 0.6), expandRect(CARPORT, 1.0), expandRect(UTILITY.los, 1.5), expandRect(BBQ.pergola, 0.5),
    ...pavingFor(C.id).map(p => p.poly.map(([u, v]) => [u, v])),
    //  марши лестниц и полосы подпорных стенок — иначе существующее дерево
    //  вырастает прямо в ступенях и марш пропадает за кроной
    ...STEPS.map(st => {
      const s = stairSpan(st), w = st.w / 2 + 0.5;
      return [[s.uTop - s.len - 0.5, st.v - w], [s.uTop + 0.4, st.v - w],
              [s.uTop + 0.4, st.v + w], [s.uTop - s.len - 0.5, st.v + w]];
    }),
    ...WALLS.map(w => [[w.u - 0.6, w.v[0]], [w.u + 0.6, w.v[0]],
                       [w.u + 0.6, w.v[1]], [w.u - 0.6, w.v[1]]]),
  ];
  // небольшой отступ вокруг покрытий
  return (t) => {
    const [u, v] = xy2uv(t.x, t.y);
    for (const z of zones) if (inPoly(u, v, z)) return false;
    return true;
  };
}

// ---------------------------------------------------------------------------
//  Дом, навес, машины — с посадкой по (u,v)
// ---------------------------------------------------------------------------
export function placeHouse(M) {
  const h = buildHouse(M);
  const [x, y] = uv2xy(HOUSE.warm.u[0], HOUSE.warm.v[0]);
  h.position.set(x, LEVELS.FF, -y);
  h.rotation.y = uAngle();
  return h;
}

/** поставить объект в точку (u,v) на поверхность, развернув по осям участка */
export function placer(mode = 'design') {
  return (obj, u, v, extraRot = 0) => {
    const [x, y] = uv2xy(u, v);
    obj.position.set(x, groundZ(x, y, mode), -y);
    obj.rotation.y = uAngle() + extraRot;
    return obj;
  };
}

// ---------------------------------------------------------------------------
//  Зона барбекю и садовая мебель
// ---------------------------------------------------------------------------
export function buildBBQ(M, mode = 'design', C = {}) {
  const g = new THREE.Group();
  g.name = 'Зона барбекю и отдыха';
  g.add(buildBBQZone(M, placer(mode), C));
  // гирлянда над патио — на высоте перголы
  const sp = LIGHTS.string.path.map(([u, v]) => {
    const [x, y] = uv2xy(u, v);
    return [x, -y];
  });
  const zBase = groundZuv(BBQ.fire.u, BBQ.fire.v, mode);
  const sl = stringLights(M, sp, zBase + 2.55, 0.32);
  g.add(sl);
  // скамьи в саду
  const place = placer(mode);
  for (const [u, v, rot] of [[6.0, 20.4, 0.4], [12.0, 6.6, -0.8], [22.0, 4.55, Math.PI]]) {
    const b = bench(M);
    place(b, u, v, rot);
    g.add(b);
  }
  return g;
}

// ---------------------------------------------------------------------------
//  Мощение отдельными элементами — брусчатка и плита читаются как материал
// ---------------------------------------------------------------------------
/**
 * Раскладка элементов мощения. Рисунок зависит от варианта дизайна:
 *   herring — брусчатка 200×100 со смещением ряда («ёлочка»), живой рисунок
 *   rows    — та же брусчатка строгими рядами без смещения, шов в шов
 *   big     — крупный модуль 600×400 с широким швом, минимум линий
 * Рисунок — один из самых заметных признаков варианта: одна и та же площадка
 * читается по-разному, даже если контур не менялся.
 */
export function pavingUnits(polyUV, kind, M, mode = 'design', pattern = 'herring') {
  const P = {
    herring: { paveW: 0.20, paveD: 0.10, stagger: true,  stoneW: 0.40, stoneD: 0.40, gap: 0.006 },
    rows:    { paveW: 0.20, paveD: 0.10, stagger: false, stoneW: 0.60, stoneD: 0.60, gap: 0.010 },
    big:     { paveW: 0.30, paveD: 0.30, stagger: false, stoneW: 0.60, stoneD: 0.40, gap: 0.018 },
  }[pattern] || { paveW: 0.20, paveD: 0.10, stagger: true, stoneW: 0.40, stoneD: 0.40, gap: 0.006 };
  const SPEC = {
    pave:  { w: P.paveW, d: P.paveD, gap: P.gap, h: 0.06, mat: M.paveUnit, stagger: P.stagger },
    stone: { w: P.stoneW, d: P.stoneD, gap: P.gap * 2, h: 0.05, mat: M.slabUnit, stagger: false },
    slab:  { w: 0.60, d: 0.40, gap: 0.015, h: 0.05, mat: M.slabUnit, stagger: false },
  }[kind];
  if (!SPEC) return null;
  const us = polyUV.map(p => p[0]), vs = polyUV.map(p => p[1]);
  const u0 = Math.min(...us), u1 = Math.max(...us);
  const v0 = Math.min(...vs), v1 = Math.max(...vs);
  const stepU = SPEC.w + SPEC.gap, stepV = SPEC.d + SPEC.gap;
  const items = [];
  let row = 0;
  for (let v = v0 + SPEC.d / 2; v <= v1; v += stepV, row++) {
    const off = SPEC.stagger && row % 2 ? stepU / 2 : 0;
    for (let u = u0 + SPEC.w / 2 + off; u <= u1; u += stepU) {
      const hw = SPEC.w / 2 + 0.02, hd = SPEC.d / 2 + 0.02;
      if (!inPoly(u - hw, v - hd, polyUV) || !inPoly(u + hw, v - hd, polyUV)
        || !inPoly(u + hw, v + hd, polyUV) || !inPoly(u - hw, v + hd, polyUV)) continue;
      items.push([u, v]);
    }
  }
  if (!items.length) return null;
  const geo = new THREE.BoxGeometry(SPEC.w, SPEC.h, SPEC.d);
  const mesh = new THREE.InstancedMesh(geo, SPEC.mat, items.length);
  mesh.castShadow = false; mesh.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  items.forEach(([u, v], i) => {
    const [x, y] = uv2xy(u, v);
    const z = groundZ(x, y, mode) + SPEC.h / 2 + 0.015;
    e.set(0, uAngle() + (rnd(i * 3.7) - 0.5) * 0.012, 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, z, -y), q, s);
    mesh.setMatrixAt(i, m4);
    const t = 0.86 + rnd(i * 7.1) * 0.28;
    col.setRGB(t, t, t * (0.985 + rnd(i * 2.3) * 0.03));
    mesh.setColorAt(i, col);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.userData.count = items.length;
  return mesh;
}

export function placeCarport(M, mode = 'design') {
  const g = new THREE.Group();
  g.name = 'Навес и парковка';
  const cp = buildCarport(M);
  //  Группа навеса растёт от точки вставки: глубина по локальной +x, ширина в −z.
  //  Обычная посадка — угол (u0, v0), объём уходит на восток и на север.
  //  Развёрнутая (rotated) — угол (u0, v1): глубина идёт на ЮГ, ширина на ВОСТОК,
  //  дверь хозпостройки смотрит на юг, на въездную площадку.
  const rot = !!CARPORT.rotated;
  const [x, y] = uv2xy(CARPORT.u[0], rot ? CARPORT.v[1] : CARPORT.v[0]);
  const z = groundZ(x, y, mode);
  cp.position.set(x, z + 0.04, -y);
  cp.rotation.y = uAngle() - (rot ? Math.PI / 2 : 0);
  g.add(cp);
  for (const c of CARPORT.cars) {
    const car = loadCarModel(c.color) || buildSubaruXV(c.color);
    const [cx, cy] = uv2xy(c.u, c.v);
    car.position.set(cx, groundZ(cx, cy, mode) + 0.05, -cy);
    car.rotation.y = uAngle() + Math.PI + (c.rot || 0);
    g.add(car);
  }
  return g;
}
