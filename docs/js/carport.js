// ============================================================================
//  НАВЕС-ПАРКОВКА — по фотографии заказчика.
//  Единый объём под общей плоской кровлей с широким выносом:
//   • тёмный фриз по периметру, над ним светлая вертикальная рейка;
//   • открытая часть на два машино-места на тонких антрацитовых стойках;
//   • закрытая хозпостройка в том же объёме — вертикальная светлая рейка,
//     тёмная входная дверь, порог-ступень;
//   • подшивка потолка тёмная с линейными светильниками.
// ============================================================================
import * as THREE from '../lib/three.module.js';
import { CARPORT as C } from './design.js';

function box(w, h, d, mat, p, rot) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(p[0], p[1], p[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** экран из вертикальной рейки: ламели с просветом, в стальной обвязке */
function slatWall(M, len, h, pos, rot = 0, gap = 0.022, w = 0.07, solid = false) {
  const g = new THREE.Group();
  const step = w + gap;
  const n = Math.max(1, Math.floor(len / step));
  const start = -(n - 1) * step / 2;
  const geo = new THREE.BoxGeometry(w, h, 0.034);
  if (solid) {
    const back = box(len, h, 0.02, M.ceilDark, [0, 0, -0.026]);
    g.add(back);
  }
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, M.woodLight);
    m.position.set(start + i * step, 0, 0);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  // обвязка: тёмная рамка по контуру, как на фото
  g.add(box(len + 0.09, 0.075, 0.055, M.steel, [0, h / 2 + 0.038, 0.004]));
  g.add(box(len + 0.09, 0.075, 0.055, M.steel, [0, -h / 2 - 0.038, 0.004]));
  g.add(box(0.075, h + 0.15, 0.055, M.steel, [-len / 2 - 0.038, 0, 0.004]));
  g.add(box(0.075, h + 0.15, 0.055, M.steel, [len / 2 + 0.038, 0, 0.004]));
  g.position.set(pos[0], pos[1], pos[2]);
  g.rotation.y = rot;
  return g;
}

export function buildCarport(M) {
  const root = new THREE.Group();
  root.name = 'Навес-парковка с хозпостройкой';
  //  При rotated пятно развёрнуто: вдоль u идёт ширина навеса, вглубь по v —
  //  длина машино-места. Локальные оси самого объёма не меняются: x — глубина,
  //  −z — ширина; разворот выполняет placeCarport в build.js.
  const rot = !!C.rotated;
  const Wd = rot ? C.v[1] - C.v[0] : C.u[1] - C.u[0];        // глубина (локальная x)
  const Dp = rot ? C.u[1] - C.u[0] : C.v[1] - C.v[0];        // ширина (локальная z)
  const stD = rot ? C.store.u[1] - C.store.u[0]
                  : C.store.v[1] - C.store.v[0];             // хозпостройка
  //  отступ хозпостройки от начала объёма: она может стоять не в первом торце,
  //  а в дальнем (по правке Павла — справа при въезде, в восточном торце)
  const s0 = rot ? C.store.u[0] - C.u[0] : C.store.v[0] - C.v[0];
  const H = C.hRidge;                            // низ кровельной плиты
  const ovF = 1.25, ovS = 0.55;                  // вынос кровли: вперёд и по бокам
  const RW = Wd + ovF + ovS, RD = Dp + ovS * 2;
  const rxc = Wd / 2 + (ovF - ovS) / 2;          // центр кровли по глубине
  const friezeH = 0.16, slatBandH = 0.30;        // тёмный фриз + светлая полоса рейки

  // ------------- стойки: профиль 120×120 -------------
  const sA0 = -s0, sB0 = -(s0 + stD);
  const colU = [0.16, Wd - 0.16];
  //  стойки только по краям и по границе хозблока — промежуточная убрана
  //  по правке Павла: она стояла посреди проезда между машинами
  const colV = [-0.16, sA0, sB0, -Dp + 0.16].filter((z, i, a) => a.indexOf(z) === i);
  for (const x of colU) for (const z of colV) {
    root.add(box(0.12, H - 0.02, 0.12, M.steel, [x, (H - 0.02) / 2, z]));
    root.add(box(0.20, 0.03, 0.20, M.steel, [x, 0.016, z]));
    // узел примыкания к балке — накладка, как на фото
    root.add(box(0.17, 0.22, 0.17, M.steel, [x, H - 0.13, z]));
  }
  // продольные балки по стойкам
  for (const x of colU)
    root.add(box(0.14, 0.26, Dp, M.steel, [x, H - 0.14, -Dp / 2]));

  // ------------- кровельный блок -------------
  // подшивка потолка
  root.add(box(RW - 0.06, 0.04, RD - 0.06, M.ceilDark, [rxc, H + 0.02, -Dp / 2]));
  // тело плиты
  root.add(box(RW, 0.10, RD, M.steel, [rxc, H + 0.09, -Dp / 2]));
  // тёмный фриз по периметру
  root.add(box(RW + 0.02, friezeH, RD + 0.02, M.steel, [rxc, H + 0.15 + friezeH / 2, -Dp / 2]));
  // светлая полоса вертикальной рейки над фризом (главный акцент фасада)
  const bandY = H + 0.15 + friezeH + slatBandH / 2;
  const bandRow = (len, along, x, z) => {
    const w = 0.055, gap = 0.022, step = w + gap;
    const n = Math.floor(len / step);
    const start = -(n - 1) * step / 2;
    for (let i = 0; i < n; i++) {
      const off = start + i * step;
      root.add(box(along === 'x' ? w : 0.05, slatBandH, along === 'x' ? 0.05 : w, M.woodLight,
        along === 'x' ? [x + off, bandY, z] : [x, bandY, z + off]));
    }
  };
  bandRow(RW, 'x', rxc, ovS);
  bandRow(RW, 'x', rxc, -Dp - ovS);
  bandRow(RD, 'z', Wd + ovF, -Dp / 2);
  bandRow(RD, 'z', -ovS, -Dp / 2);
  // тёмный кант поверху
  root.add(box(RW + 0.06, 0.07, RD + 0.06, M.steel, [rxc, bandY + slatBandH / 2 + 0.03, -Dp / 2]));

  // ------------- линейные светильники в подшивке -------------
  for (const z of [-1.2, -Dp * 0.45, -Dp + 0.9]) {
    const l = box(Wd * 0.68, 0.02, 0.07, M.lampGlow, [Wd * 0.52, H + 0.002, z]);
    l.castShadow = false;
    root.add(l);
  }

  // ------------- ХОЗПОСТРОЙКА в объёме навеса -------------
  const sH = H - 0.16;
  const sA = -s0, sB = -(s0 + stD);            // границы блока по локальной z
  const sc = (sA + sB) / 2;
  // стены: рейка по глухой подложке
  root.add(slatWall(M, stD, sH, [0.07, sH / 2, sc], Math.PI / 2, 0.022, 0.07, true));        // запад
  root.add(slatWall(M, stD, sH, [Wd - 0.07, sH / 2, sc], Math.PI / 2, 0.022, 0.07, true));   // восток
  root.add(slatWall(M, Wd - 0.2, sH, [Wd / 2, sH / 2, sA - 0.07], 0, 0.022, 0.07, true));    // торец 1
  root.add(slatWall(M, Wd - 0.2, sH, [Wd / 2, sH / 2, sB + 0.07], 0, 0.022, 0.07, true));    // торец 2
  // входная дверь с восточной стороны
  root.add(box(0.09, 2.10, 1.00, M.gate, [Wd - 0.03, 1.05, sc]));
  root.add(box(0.05, 1.96, 0.88, M.woodLight, [Wd + 0.02, 1.03, sc]));
  root.add(box(0.04, 0.05, 0.36, M.steel, [Wd + 0.05, 1.05, sc - 0.32]));   // ручка
  // порог-ступень
  root.add(box(0.44, 0.10, 1.55, M.curb, [Wd + 0.30, 0.05, sc]));

  // ------------- задняя стенка над парковкой (ветрозащита) -------------
  root.add(slatWall(M, Dp - stD - 0.3, H - 0.55, [0.07, (H - 0.55) / 2 + 0.06,
    -(Dp - stD) / 2], Math.PI / 2, 0.026, 0.07, false));

  // ------------- отбойные бортики по краю площадки -------------
  root.add(box(0.10, 0.09, Dp - stD - 0.4, M.curb, [0.32, 0.045, -(Dp - stD) / 2]));

  root.userData.spec = {
    area: +(Wd * Dp).toFixed(1),
    store: +(Wd * stD).toFixed(1),
    park: +(Wd * (Dp - stD)).toFixed(1),
  };
  return root;
}
