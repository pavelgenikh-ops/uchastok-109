// ============================================================================
//  Зона барбекю и садовая мебель (МАФ)
// ============================================================================
import * as THREE from '../lib/three.module.js';
import { BBQ } from './design.js';

const rnd = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function box(w, h, d, mat, p, rot) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(p[0], p[1], p[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(r1, r2, h, mat, p, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  m.position.set(p[0], p[1], p[2]);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------------------
//  Пергола-навес над обеденной зоной: стальной каркас + деревянные ламели
// ---------------------------------------------------------------------------
export function pergola(M, w, d, h) {
  const g = new THREE.Group();
  g.name = 'Пергола над обеденной зоной';
  const c = 0.13;
  for (const [x, z] of [[c / 2, -c / 2], [w - c / 2, -c / 2], [c / 2, -d + c / 2], [w - c / 2, -d + c / 2]])
    g.add(box(c, h, c, M.steel, [x, h / 2, z]));
  // обвязка
  g.add(box(w, 0.16, 0.10, M.steel, [w / 2, h - 0.08, -c / 2]));
  g.add(box(w, 0.16, 0.10, M.steel, [w / 2, h - 0.08, -d + c / 2]));
  g.add(box(0.10, 0.16, d, M.steel, [c / 2, h - 0.08, -d / 2]));
  g.add(box(0.10, 0.16, d, M.steel, [w - c / 2, h - 0.08, -d / 2]));
  // ламели покрытия
  const n = Math.round(d / 0.26);
  for (let i = 0; i <= n; i++)
    g.add(box(w - 0.06, 0.055, 0.115, M.woodLight, [w / 2, h + 0.02, -0.14 - i * ((d - 0.28) / n)]));
  // боковой экран из вертикальной рейки (со стороны ветра)
  for (let i = 0; i <= 12; i++)
    g.add(box(0.045, h * 0.62, 0.045, M.woodLight, [0.12, h * 0.31, -0.3 - i * ((d - 0.6) / 12)]));
  return g;
}

// ---------------------------------------------------------------------------
//  Барбекю-комплекс: мангал, гриль, рабочая столешница, дровница
// ---------------------------------------------------------------------------
export function grillStation(M) {
  const g = new THREE.Group();
  g.name = 'Барбекю-комплекс';
  const W = 3.2, D = 0.78, H = 0.92;
  // тумба из камня
  g.add(box(W, H, D, M.stoneWall, [0, H / 2, 0]));
  // столешница
  g.add(box(W + 0.12, 0.07, D + 0.12, M.curb, [0, H + 0.035, 0]));
  // мангальная секция с порталом
  g.add(box(1.25, 1.85, D + 0.16, M.stoneWall, [-W / 2 + 0.62, 0.92, 0]));
  const hole = box(0.95, 0.52, D + 0.22, M.lampGlow, [-W / 2 + 0.62, 0.98, 0]);
  hole.castShadow = false; g.add(hole);
  // вытяжной зонт и труба
  g.add(box(1.4, 0.34, D + 0.3, M.steel, [-W / 2 + 0.62, 1.94, 0]));
  g.add(cyl(0.14, 0.14, 1.5, M.steel, [-W / 2 + 0.62, 2.75, 0], 10));
  // решётка гриля
  g.add(box(0.9, 0.05, 0.62, M.steel, [W / 2 - 1.0, H + 0.09, 0]));
  // дровница
  g.add(box(1.0, 0.62, D - 0.1, M.trim, [W / 2 - 0.52, 0.31, 0]));
  for (let i = 0; i < 8; i++) {
    const l = cyl(0.06, 0.06, 0.62, M.bark,
      [W / 2 - 0.52 + (rnd(i) - 0.5) * 0.7, 0.14 + Math.floor(i / 3) * 0.14, 0], 7);
    l.rotation.x = Math.PI / 2;
    g.add(l);
  }
  return g;
}

// ---------------------------------------------------------------------------
//  Очаг-кострище с бортом из камня
// ---------------------------------------------------------------------------
export function firePit(M, r = 0.95) {
  const g = new THREE.Group();
  g.name = 'Очаг-кострище';
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.06, 0.42, 22), M.stoneWall);
  ring.position.y = 0.21; ring.castShadow = true; ring.receiveShadow = true;
  g.add(ring);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.22, r - 0.22, 0.10, 20), M.gravel);
  inner.position.y = 0.36; g.add(inner);
  // дрова шалашом
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.283;
    const l = cyl(0.045, 0.055, 0.72, M.bark, [Math.cos(a) * 0.2, 0.62, Math.sin(a) * 0.2], 6);
    l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(l);
  }
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 8), M.lampGlow);
  fl.position.y = 0.72; fl.castShadow = false;
  fl.name = 'пламя';
  g.add(fl);
  return g;
}

// ---------------------------------------------------------------------------
//  Обеденный стол со скамьями
// ---------------------------------------------------------------------------
export function diningSet(M) {
  const g = new THREE.Group();
  g.name = 'Обеденная группа на 8 персон';
  const W = 2.2, D = 1.0, H = 0.75;
  g.add(box(W, 0.06, D, M.woodLight, [0, H, 0]));
  for (let i = 0; i < 5; i++)
    g.add(box(W - 0.08, 0.035, D / 5.6, M.deck, [0, H + 0.035, -D / 2 + 0.12 + i * (D - 0.24) / 4]));
  for (const [x, z] of [[-W / 2 + 0.18, -D / 2 + 0.14], [W / 2 - 0.18, -D / 2 + 0.14],
                        [-W / 2 + 0.18, D / 2 - 0.14], [W / 2 - 0.18, D / 2 - 0.14]])
    g.add(box(0.08, H, 0.08, M.trim, [x, H / 2, z]));
  // скамьи
  for (const zs of [-1, 1]) {
    g.add(box(W - 0.2, 0.06, 0.34, M.woodLight, [0, 0.45, zs * 0.86]));
    for (const xs of [-1, 1])
      g.add(box(0.07, 0.45, 0.30, M.trim, [xs * (W / 2 - 0.34), 0.225, zs * 0.86]));
  }
  return g;
}

// ---------------------------------------------------------------------------
//  Лаунж-кресло
// ---------------------------------------------------------------------------
export function loungeChair(M) {
  const g = new THREE.Group();
  g.name = 'Лаунж-кресло';
  g.add(box(0.82, 0.12, 0.80, M.woodLight, [0, 0.38, 0]));
  g.add(box(0.82, 0.10, 0.74, M.slatWarm, [0, 0.46, 0]));
  g.add(box(0.82, 0.62, 0.10, M.slatWarm, [0, 0.72, -0.34], [0.18, 0, 0]));
  for (const [x, z] of [[-0.35, -0.32], [0.35, -0.32], [-0.35, 0.32], [0.35, 0.32]])
    g.add(box(0.07, 0.38, 0.07, M.trim, [x, 0.19, z]));
  return g;
}

// ---------------------------------------------------------------------------
//  Скамья садовая
// ---------------------------------------------------------------------------
export function bench(M) {
  const g = new THREE.Group();
  g.name = 'Скамья садовая';
  for (let i = 0; i < 4; i++)
    g.add(box(1.7, 0.045, 0.10, M.woodLight, [0, 0.45, -0.18 + i * 0.12]));
  for (let i = 0; i < 3; i++)
    g.add(box(1.7, 0.10, 0.045, M.woodLight, [0, 0.62 + i * 0.13, -0.26]));
  for (const x of [-0.72, 0.72]) {
    g.add(box(0.08, 0.45, 0.46, M.trim, [x, 0.225, -0.06]));
    g.add(box(0.08, 0.42, 0.06, M.trim, [x, 0.66, -0.26]));
  }
  return g;
}

// ---------------------------------------------------------------------------
//  Гирлянда ретро-ламп над патио
// ---------------------------------------------------------------------------
export function stringLights(M, pts, h = 2.6, sag = 0.35) {
  const g = new THREE.Group();
  g.name = 'Гирлянда';
  const bulbGeo = new THREE.SphereGeometry(0.055, 8, 6);
  for (let s = 0; s < pts.length; s++) {
    const a = pts[s], b = pts[(s + 1) % pts.length];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const y = h - Math.sin(t * Math.PI) * sag;
      const bl = new THREE.Mesh(bulbGeo, M.lampGlow);
      bl.position.set(x, y, z);
      g.add(bl);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
//  Сборка всей зоны барбекю (координаты в системе группы: X=u, Z=-v)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
//  Спортивно-игровой комплекс: шведская стенка с турником и брусьями,
//  канат и кольца. Ставится вместо мангального комплекса в варианте Б.
// ---------------------------------------------------------------------------
export function sportComplex(M) {
  const g = new THREE.Group();
  const H = 2.55, W = 2.40;
  // две пары стоек 100×100
  for (const dz of [-W / 2, W / 2]) for (const dx of [-0.05, 1.85]) {
    g.add(box(0.10, H, 0.10, M.trim, [dx, H / 2, dz]));
  }
  //  ВАЖНО: Object3D.add() возвращает саму группу, а не добавленный объект.
  //  Поворачивать надо меш ДО добавления, иначе крутится вся конструкция.
  const bar = (r, len, p) => {
    const m = cyl(r, r, len, M.steel, p, 10);
    m.rotation.x = Math.PI / 2;          // ось цилиндра — поперёк стенки
    return m;
  };
  // перекладины шведской стенки — шаг 220 мм
  for (let i = 0; i < 10; i++) g.add(bar(0.022, W - 0.10, [-0.05, 0.42 + i * 0.22, 0]));
  // верхняя обвязка и турник
  for (const dz of [-W / 2, W / 2])
    g.add(box(2.10, 0.10, 0.10, M.trim, [0.90, H, dz]));
  g.add(bar(0.024, W - 0.10, [1.85, H - 0.18, 0]));
  // брусья
  for (const dz of [-0.28, 0.28]) {
    g.add(box(1.30, 0.07, 0.07, M.trim, [1.10, 1.36, dz]));
    g.add(box(0.08, 1.36, 0.08, M.steel, [0.50, 0.68, dz]));
    g.add(box(0.08, 1.36, 0.08, M.steel, [1.70, 0.68, dz]));
  }
  // канат — свисает вертикально с верхней обвязки
  g.add(cyl(0.018, 0.018, 1.75, M.woodLight, [0.95, H - 0.90, -0.78], 8));
  // кольца на стропах
  for (const dz of [0.55, 0.85]) {
    g.add(cyl(0.008, 0.008, 1.20, M.steel, [0.95, H - 0.62, dz], 6));
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 14), M.woodLight);
    r.position.set(0.95, H - 1.24, dz);
    r.castShadow = true; g.add(r);
  }
  return g;
}

/** лежак-шезлонг для зоны костра */
export function sunLounger(M) {
  const g = new THREE.Group();
  for (const dz of [-0.32, 0.32]) {
    g.add(box(1.85, 0.07, 0.07, M.trim, [0, 0.30, dz]));
    g.add(box(0.07, 0.30, 0.07, M.steel, [-0.80, 0.15, dz]));
    g.add(box(0.07, 0.30, 0.07, M.steel, [0.80, 0.15, dz]));
  }
  for (let i = 0; i < 9; i++) g.add(box(0.12, 0.04, 0.74, M.deck, [-0.80 + i * 0.20, 0.36, 0]));
  // приподнятое изголовье
  for (let i = 0; i < 4; i++)
    g.add(box(0.12, 0.04, 0.74, M.deck, [1.00 + i * 0.16, 0.42 + i * 0.09, 0], [0, 0, -0.52]));
  return g;
}

/**
 * Западная зона отдыха. Её наполнение зависит от варианта дизайна:
 *   bbq   — мангальный комплекс, очаг, обеденная группа под перголой (вариант А)
 *   sport — спортивно-игровой комплекс со шведской стенкой, скамьи (вариант Б)
 *   fire  — большой очаг с лежаками на настиле-подиуме (вариант В)
 * Пергола и обеденная группа остаются во всех — это ядро зоны.
 */
export function buildBBQZone(M, place, C = {}) {
  const g = new THREE.Group();
  const zone = C.zone || 'bbq';
  g.name = zone === 'sport' ? 'Спортивно-игровая зона'
         : zone === 'fire' ? 'Зона костра и отдыха' : 'Зона барбекю и отдыха';

  // пергола — во всех вариантах
  const p = BBQ.pergola;
  const pg = pergola(M, p.u[1] - p.u[0], p.v[1] - p.v[0], p.h);
  place(pg, p.u[0], p.v[1]);
  g.add(pg);

  // обеденная группа под перголой — во всех вариантах
  const ds = diningSet(M);
  place(ds, BBQ.table.u, BBQ.table.v, Math.PI / 2);
  g.add(ds);

  if (zone === 'sport') {
    const sp = sportComplex(M);
    place(sp, BBQ.grill.u - 0.6, BBQ.grill.v - 1.2, Math.PI / 2);
    g.add(sp);
    // скамьи для зрителей по краю площадки
    BBQ.lounge.forEach((l, i) => {
      const b = bench(M);
      place(b, l.u, l.v + 0.6, Math.PI / 2 + (i ? Math.PI : 0));
      g.add(b);
    });
  } else if (zone === 'fire') {
    const fp = firePit(M, BBQ.fire.r * 1.35);
    place(fp, BBQ.fire.u, BBQ.fire.v);
    g.add(fp);
    // лежаки вокруг очага
    BBQ.lounge.forEach((l, i) => {
      const ln = sunLounger(M);
      place(ln, l.u, l.v + (i ? 1.0 : -1.0), i ? Math.PI : 0);
      g.add(ln);
    });
    const ln3 = sunLounger(M);
    place(ln3, BBQ.grill.u + 0.4, BBQ.grill.v, Math.PI / 2);
    g.add(ln3);
  } else {
    const gr = grillStation(M);
    place(gr, BBQ.grill.u, BBQ.grill.v, Math.PI / 2);
    g.add(gr);
    const fp = firePit(M, BBQ.fire.r);
    place(fp, BBQ.fire.u, BBQ.fire.v);
    g.add(fp);
    BBQ.lounge.forEach((l, i) => {
      const ch = loungeChair(M);
      place(ch, l.u, l.v, Math.PI / 2 + (i ? 0.3 : -0.3));
      g.add(ch);
    });
  }
  return g;
}
