// ============================================================================
//  ДОМ — проект 304/2026 (Fathers House), посадка по контуру генплана.
//  Длинная сторона (15,40 тёплого контура) идёт С ЮГА НА СЕВЕР,
//  короткая (9,89) — с запада на восток. Конёк — вдоль длинной стороны.
//  Координаты группы: gx = u − u0, gz = −(v − v0), gy = высота от отм. 0,000
// ============================================================================
import * as THREE from '../lib/three.module.js';
import { HOUSE as H, LEVELS } from './design.js';

const W = H.warm, hh = H.h;
const U0 = W.u[0], U1 = W.u[1], V0 = W.v[0], V1 = W.v[1];
const LX = U1 - U0;              // 9,89 — запад-восток (поперёк конька)
const LZ = V1 - V0;              // 15,40 — юг-север (вдоль конька)
const EAVE = H.eave;
const SLOPE = (hh.ridge - hh.cornice) / (LX / 2 + EAVE);

const g = (u, v) => [u - U0, -(v - V0)];

function box(w, h, d, mat, p, rot) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(p[0], p[1], p[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function quad(p1, p2, p3, p4, mat, uvScale = 1) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array([...p1, ...p2, ...p3, ...p1, ...p3, ...p4]), 3));
  const s = uvScale;
  geo.setAttribute('uv', new THREE.BufferAttribute(
    new Float32Array([0, 0, s, 0, s, s, 0, 0, s, s, 0, s]), 2));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function shapeMesh(pts, depth, mat) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** оконный блок с переплётом */
function windowUnit(M, w, h, cols = 2, rows = 1) {
  const grp = new THREE.Group();
  const fr = 0.075;
  grp.add(box(w, fr, 0.12, M.trim, [0, h / 2 - fr / 2, 0]));
  grp.add(box(w, fr, 0.12, M.trim, [0, -h / 2 + fr / 2, 0]));
  grp.add(box(fr, h, 0.12, M.trim, [-w / 2 + fr / 2, 0, 0]));
  grp.add(box(fr, h, 0.12, M.trim, [w / 2 - fr / 2, 0, 0]));
  for (let i = 1; i < cols; i++)
    grp.add(box(0.05, h - fr * 2, 0.11, M.trim, [-w / 2 + (w / cols) * i, 0, 0.005]));
  for (let j = 1; j < rows; j++)
    grp.add(box(w - fr * 2, 0.05, 0.11, M.trim, [0, -h / 2 + (h / rows) * j, 0.005]));
  const gl = box(w - fr * 2, h - fr * 2, 0.03, M.glass, [0, 0, -0.02]);
  gl.castShadow = false;
  grp.add(gl);
  // отлив
  grp.add(box(w + 0.1, 0.035, 0.13, M.trim, [0, -h / 2 - 0.03, 0.03]));
  return grp;
}

export function buildHouse(M) {
  const root = new THREE.Group();
  root.name = 'Жилой дом';

  // ---------- цоколь свайного фундамента с забиркой ----------
  const plH = LEVELS.FF - (LEVELS.ground - 0.06);
  root.add(box(LX + 0.12, plH, LZ + 0.12, M.plinth, [LX / 2, -plH / 2, -LZ / 2]));

  // ---------- стены тёплого контура ----------
  const wH = hh.cornice;
  root.add(box(LX, wH, 0.20, M.wall, [LX / 2, wH / 2, 0]));           // южная
  root.add(box(LX, wH, 0.20, M.wall, [LX / 2, wH / 2, -LZ]));          // северная
  root.add(box(0.20, wH, LZ, M.wall, [0, wH / 2, -LZ / 2]));           // западная
  root.add(box(0.20, wH, LZ, M.wall, [LX, wH / 2, -LZ / 2]));          // восточная

  // ---------- фронтоны (юг и север) ----------
  const gH = hh.ridge - hh.cornice;
  for (const [zPos, off] of [[0.10, 0], [-LZ - 0.10, 0]]) {
    const gb = shapeMesh([[0, 0], [LX, 0], [LX / 2, gH]], 0.14, M.wallGable);
    gb.position.set(0, hh.cornice, zPos - 0.07);
    root.add(gb);
  }

  // ---------- кровля: два ската вдоль длинной оси ----------
  const zS = EAVE, zN = -LZ - EAVE;
  const xW = -EAVE, xE = LX + EAVE;
  const zCorn = hh.cornice, zRid = hh.ridge, xRid = LX / 2;
  root.add(quad([xW, zCorn, zS], [xRid, zRid, zS], [xRid, zRid, zN], [xW, zCorn, zN], M.roof, 8));
  root.add(quad([xRid, zRid, zS], [xE, zCorn, zS], [xE, zCorn, zN], [xRid, zRid, zN], M.roof, 8));
  // лобовые доски и подшивка свесов
  root.add(box(0.06, 0.24, LZ + EAVE * 2, M.trim, [xW, zCorn - 0.12, -LZ / 2]));
  root.add(box(0.06, 0.24, LZ + EAVE * 2, M.trim, [xE, zCorn - 0.12, -LZ / 2]));
  for (const zz of [zS, zN]) {
    const f = shapeMesh([[0, 0], [LX + EAVE * 2, 0], [LX / 2 + EAVE, gH + EAVE * SLOPE]], 0.05, M.trim);
    f.position.set(xW, zCorn - 0.02, zz + (zz > 0 ? 0 : -0.05));
    root.add(f);
  }
  // конёк
  root.add(box(0.16, 0.10, LZ + EAVE * 2, M.trim, [xRid, zRid + 0.03, -LZ / 2]));
  // снегозадержатели
  for (const [x, dir] of [[LX * 0.26, 1], [LX * 0.74, -1]]) {
    const y = zCorn + (Math.abs(x - xRid) < LX / 2 ? (1 - Math.abs(x - xRid) / (LX / 2 + EAVE)) * gH : 0);
    for (let i = 0; i < 4; i++)
      root.add(box(0.05, 0.10, LZ * 0.2, M.steel, [x, y + 0.08, -LZ * (0.14 + i * 0.24)]));
  }

  // ---------- кукушка второго света на восточном скате ----------
  const dz0 = -(H.dormer.v[0] - V0), dz1 = -(H.dormer.v[1] - V0);
  const dW = Math.abs(dz1 - dz0);
  const dRid = hh.dormerRidge, dEave = hh.dormerEave;
  const dx = -EAVE;                            // край кукушки — по западному свесу
  const dDepth = (dRid - dEave) / SLOPE + 1.2;
  const dG = new THREE.Group();
  const gb = shapeMesh([[0, 0], [dW, 0], [dW / 2, dRid - dEave]], 0.16, M.wallGable);
  gb.rotation.y = -Math.PI / 2;
  gb.position.set(dx - 0.08, dEave, dz1);
  dG.add(gb);
  // витраж второго света: верхний треугольный + нижний прямоугольный
  const gl1 = box(0.06, (dRid - dEave) * 0.58, dW - 0.85, M.glass,
    [dx - 0.10, dEave + (dRid - dEave) * 0.28, (dz0 + dz1) / 2]);
  gl1.castShadow = false; dG.add(gl1);
  const gl2 = box(0.06, dEave - 0.40, dW - 0.50, M.glass,
    [dx - 0.10, (dEave - 0.40) / 2 + 0.34, (dz0 + dz1) / 2]);
  gl2.castShadow = false; dG.add(gl2);
  // переплёты витража
  for (let i = 1; i < 4; i++)
    dG.add(box(0.10, dEave - 0.40, 0.09, M.trim, [dx - 0.12, (dEave - 0.40) / 2 + 0.34, dz0 - (dW / 4) * i]));
  dG.add(box(0.10, 0.10, dW - 0.5, M.trim, [dx - 0.12, dEave - 0.44, (dz0 + dz1) / 2]));
  // скаты кукушки
  dG.add(quad([dx - 0.12, dRid, (dz0 + dz1) / 2], [dx - 0.12, dEave, dz0 + 0.25],
              [dx + dDepth, dEave, dz0 + 0.25], [dx + dDepth, dRid, (dz0 + dz1) / 2], M.roof, 3));
  dG.add(quad([dx - 0.12, dEave, dz1 - 0.25], [dx - 0.12, dRid, (dz0 + dz1) / 2],
              [dx + dDepth, dRid, (dz0 + dz1) / 2], [dx + dDepth, dEave, dz1 - 0.25], M.roof, 3));
  root.add(dG);

  // ---------- дымоход ----------
  root.add(box(0.46, hh.chimney - 2.4, 0.46, M.plinth, [xRid - 0.9, (hh.chimney + 2.4) / 2, -LZ * 0.42]));
  root.add(box(0.60, 0.10, 0.60, M.steel, [xRid - 0.9, hh.chimney + 0.05, -LZ * 0.42]));

  // ---------- окна ----------
  // западный фасад — на террасу и сад
  const wWin = [
    { z: -2.6, w: 1.0, h: 0.85, y: 1.95, c: 1 },
    { z: -4.2, w: 1.0, h: 0.85, y: 1.95, c: 1 },
    { z: -6.6, w: 1.75, h: 1.6, y: 1.5, c: 2 },
    { z: -12.4, w: 1.75, h: 1.6, y: 1.5, c: 2 },
  ];
  for (const w of wWin) {
    const q = windowUnit(M, w.w, w.h, w.c, 1);
    q.rotation.y = -Math.PI / 2;
    q.position.set(-0.11, w.y, w.z);
    root.add(q);
  }
  // восточный фасад — вход и рядовые окна
  const eWin = [
    { z: -2.4, w: 1.75, h: 1.6, y: 1.5, c: 2 },
    { z: -5.2, w: 1.1, h: 0.85, y: 1.95, c: 1 },
    { z: -13.0, w: 1.75, h: 1.6, y: 1.5, c: 2 },
  ];
  for (const w of eWin) {
    const q = windowUnit(M, w.w, w.h, w.c, 1);
    q.rotation.y = Math.PI / 2;
    q.position.set(LX + 0.11, w.y, w.z);
    root.add(q);
  }
  // южный и северный фасады
  const sWin = windowUnit(M, 1.6, 1.55, 2, 1);
  sWin.position.set(LX * 0.30, 1.52, 0.11); root.add(sWin);
  const sWin2 = windowUnit(M, 1.0, 0.85, 1, 1);
  sWin2.position.set(LX * 0.70, 1.95, 0.11); root.add(sWin2);
  const nWin = windowUnit(M, 1.6, 1.55, 2, 1);
  nWin.rotation.y = Math.PI;
  nWin.position.set(LX * 0.62, 1.52, -LZ - 0.11); root.add(nWin);

  // ---------- входная дверь с ВОСТОЧНОЙ стороны ----------
  const dz = -(((H.porch.v[0] + H.porch.v[1]) / 2) - V0);
  root.add(box(0.10, 2.15, 1.05, M.trim, [LX + 0.10, 1.07, dz]));
  root.add(box(0.05, 1.98, 0.92, M.woodLight, [LX + 0.15, 1.04, dz]));
  root.add(box(0.06, 1.70, 0.42, M.glass, [LX + 0.12, 1.15, dz + 0.80]));
  // козырёк над входом
  root.add(box(1.30, 0.10, 2.10, M.roof, [LX + 0.65, 2.62, dz]));
  root.add(box(0.10, 0.62, 0.10, M.trim, [LX + 1.15, 2.30, dz + 0.95]));
  root.add(box(0.10, 0.62, 0.10, M.trim, [LX + 1.15, 2.30, dz - 0.95]));

  // ---------- водосточная система ----------
  for (const x of [xW, xE]) {
    root.add(box(0.11, 0.11, LZ + EAVE * 1.6, M.steel, [x + (x < 0 ? 0.06 : -0.06), zCorn - 0.05, -LZ / 2]));
    for (const z of [-0.6, -LZ + 0.6]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, zCorn - 0.3, 8), M.steel);
      p.position.set(x + (x < 0 ? 0.12 : -0.12), (zCorn - 0.3) / 2, z);
      p.castShadow = true;
      root.add(p);
    }
  }

  // ---------- ТЕРРАСА ЗАПАДНАЯ (открытая, к витражу второго света) ----------
  const tw = H.terrW;
  const twW = tw.u[1] - tw.u[0], twL = tw.v[1] - tw.v[0];
  const twG = new THREE.Group();
  const [twx, twz] = g(tw.u[0], tw.v[0]);
  twG.position.set(twx, 0, twz);
  twG.add(box(twW, 0.09, twL, M.deck, [twW / 2, hh.terrace - 0.045, -twL / 2]));
  // забирка по торцам
  twG.add(box(twW, plH - 0.12, 0.10, M.plinth, [twW / 2, -(plH - 0.12) / 2 + hh.terrace, -0.05]));
  twG.add(box(twW, plH - 0.12, 0.10, M.plinth, [twW / 2, -(plH - 0.12) / 2 + hh.terrace, -twL + 0.05]));
  twG.add(box(0.10, plH - 0.12, twL, M.plinth, [0.05, -(plH - 0.12) / 2 + hh.terrace, -twL / 2]));
  // ограждение горизонтальной рейкой по внешнему краю и торцам
  twG.add(box(0.07, 1.02, twL, M.slatDark, [0.035, hh.terrace + 0.51, -twL / 2]));
  twG.add(box(twW, 1.02, 0.07, M.slatDark, [twW / 2, hh.terrace + 0.51, -0.035]));
  //  В ограждении северного торца — ПРОЁМ против марша Л-2 (западная часть),
  //  иначе поднявшийся по ступеням упирается в ограждение. Ограждение остаётся
  //  только на восточном участке, у стены дома.
  twG.add(box(twW * 0.50, 1.02, 0.07, M.slatDark, [twW * 0.75, hh.terrace + 0.51, -twL + 0.035]));
  //  Ступени с северного торца больше НЕ строятся здесь: теперь это марш Л-2
  //  из TERR_STEPS, его положение и ширина задаются в design.js (замечание №2).
  root.add(twG);

  //  Продолжение террасы вдоль стены за торцом: по правке 22.09.2026 между
  //  зданием и ступенями настил идёт дальше, а марш смещён к западному краю.
  if (H.terrWN) {
    const tn2 = H.terrWN;
    const w2 = tn2.u[1] - tn2.u[0], l2 = tn2.v[1] - tn2.v[0];
    const g2 = new THREE.Group();
    const [x2, z2] = g(tn2.u[0], tn2.v[0]);
    g2.position.set(x2, 0, z2);
    g2.add(box(w2, 0.09, l2, M.deck, [w2 / 2, hh.terrace - 0.045, -l2 / 2]));
    g2.add(box(w2, plH - 0.12, 0.10, M.plinth, [w2 / 2, -(plH - 0.12) / 2 + hh.terrace, -l2 + 0.05]));
    g2.add(box(0.10, plH - 0.12, l2, M.plinth, [0.05, -(plH - 0.12) / 2 + hh.terrace, -l2 / 2]));
    g2.add(box(0.07, 1.02, l2, M.slatDark, [0.035, hh.terrace + 0.51, -l2 / 2]));
    g2.add(box(w2, 1.02, 0.07, M.slatDark, [w2 / 2, hh.terrace + 0.51, -l2 + 0.035]));
    root.add(g2);
  }

  // ---------- ТЕРРАСА ЮЖНАЯ под односкатным навесом ----------
  const tn = H.terrS;
  const tnW = tn.u[1] - tn.u[0], tnL = tn.v[1] - tn.v[0];
  const tnG = new THREE.Group();
  const [tnx, tnz] = g(tn.u[0], tn.v[0]);
  tnG.position.set(tnx, 0, tnz);
  tnG.add(box(tnW, 0.09, tnL, M.deck, [tnW / 2, hh.terrace - 0.045, -tnL / 2]));
  tnG.add(box(tnW, plH - 0.12, 0.10, M.plinth, [tnW / 2, -(plH - 0.12) / 2 + hh.terrace, -0.05]));
  tnG.add(box(0.10, plH - 0.12, tnL, M.plinth, [tnW - 0.05, -(plH - 0.12) / 2 + hh.terrace, -tnL / 2]));
  //  Односкатный навес над южной террасой УБРАН по правке Павла 16.09.2026:
  //  в проекте дома его нет, терраса остаётся открытой.
  //  Правка 22.09.2026: старые ступени с южного края террасы УБРАНЫ — спуск
  //  теперь один, марш Л-1 в восточном торце. На их месте южный край закрыт
  //  ограждением на всю длину, без разрыва.
  tnG.add(box(tnW, 1.02, 0.07, M.slatDark, [tnW / 2, hh.terrace + 0.51, -0.035]));
  root.add(tnG);

  // ---------- КРЫЛЬЦО (восток) ----------
  const pc = H.porch;
  const pcW = pc.u[1] - pc.u[0], pcL = pc.v[1] - pc.v[0];
  const pcG = new THREE.Group();
  const [px, pz] = g(pc.u[0], pc.v[0]);
  pcG.position.set(px, 0, pz);
  pcG.add(box(pcW, 0.09, pcL, M.deck, [pcW / 2, hh.terrace - 0.045, -pcL / 2]));
  //  Главный вход оставлен как был: с площадки поднимаешься по ступеням прямо
  //  в дом, фронтально на восток. Разворот в торец 22.09.2026 отменён.
  for (let i = 0; i < 3; i++)
    pcG.add(box(0.33, 0.17, pcL * 0.7, M.deck,
      [pcW + 0.165 + i * 0.33, hh.terrace - 0.17 * (i + 0.5), -pcL / 2]));
  pcG.add(box(pcW, 1.02, 0.07, M.slatDark, [pcW / 2, hh.terrace + 0.51, -0.035]));
  pcG.add(box(pcW, 1.02, 0.07, M.slatDark, [pcW / 2, hh.terrace + 0.51, -pcL + 0.035]));
  root.add(pcG);

  root.userData.spec = {
    warm: +(LX * LZ).toFixed(1),
    terrace: +(twW * twL + tnW * tnL).toFixed(1),
    porch: +(pcW * pcL).toFixed(1),
  };
  return root;
}
