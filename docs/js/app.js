// ============================================================================
//  Ландшафт 3D — СНТ «Мадио Озерки», уч. 109
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.js';
import { initGeo, uv2xy, xy2uv, groundZ, groundZuv, stairSpan, terrain, SITE_DATA } from './geo.js';
import { makeMaterials } from './materials.js';
import {
  buildTerrainMesh, buildHardscape, buildStepping, buildBeds, buildLawn,
  buildWalls, buildFence, buildLights, buildUtility, buildTerraceSteps, buildPlanting,
  placeHouse, placeCarport, treeKeeper, onSiteTest, buildBBQ,
} from './build.js';
import { buildExisting } from './plants.js';
import { computeSpec } from './spec.js';
import { initCarModel } from './carmodel.js';
import { VIEWS, LEVELS, SITE, CONCEPTS, WALLS, STEPS } from './design.js';
import { initUI, renderSpec, setStat } from './ui.js';
import { downloadProject, pickProjectFile } from './projectio.js';
import { initNotes, exportNotes, exportShots, clearNotes } from './notes.js';
import { bindPanel, initBackButton, back as navBack, depth as navDepth } from './nav.js';
import { showQR } from './qr.js';

let renderer, scene, camera, controls, M, sun, hemi, ambient, sky;
let MOBILE = false;
let reliefMode = 'design';
let conceptId = 'soft';
const L = {};              // слои
let glowLights = [];
let evening = false, labelsOn = false, greenOn = true;
const labelSprites = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

init();

async function init() {
  // номер сборки — чтобы сразу видеть, открыта ли свежая версия
  try {
    const r = await fetch('./index.html', { method: 'HEAD', cache: 'no-store' });
    const b = r.headers.get('X-Build');
    const el = document.getElementById('build');
    if (b && el) el.textContent = 'сборка ' + b;
  } catch (e) { /* не критично */ }

  const site = await (await fetch('./data/site.json?t=' + Date.now())).json();
  initGeo(site);

  //  на телефоне режем нагрузку: без сглаживания, ниже pixelRatio, мельче карта
  //  теней — иначе сцена с деревьями и инстансами мощения идёт 15 кадров
  MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 860;
  renderer = new THREE.WebGLRenderer({ antialias: !MOBILE, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('view').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc0dd);
  scene.fog = new THREE.Fog(0x9fc0dd, 90, 260);

  camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.3, 900);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance = 4;
  controls.maxDistance = 220;
  // навигация как в AutoCAD: зажатое колесо — панорамирование, прокрутка — зум
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.screenSpacePanning = true;
  controls.panSpeed = 1.1;
  controls.zoomSpeed = 1.15;

  M = makeMaterials(CONCEPTS[conceptId]);
  buildScene();
  applyView(VIEWS[0], false);
  setupLights();
  initUI({
    layers: L, setView, toggleSun, toggleRelief, toggleLabels, toggleGreen, uvh,
    toggleElev, toggleDims,
    concepts: CONCEPTS, setConcept, getConcept: () => conceptId,
    renderer, scene, camera, spec: computeSpec(reliefMode), views: VIEWS,
  });
  //  замечания по модели: долгое нажатие на телефоне, правый клик на компьютере
  initNotes({ scene, camera, controls, renderer, xy2uv });
  bindPanel('bNotes', 'notes');
  initBackButton();
  document.getElementById('bNotesExport')?.addEventListener('click', () => exportNotes());
  document.getElementById('bNotesShots')?.addEventListener('click', (e) => {
    const b = e.target, t = b.textContent;
    exportShots((i, n) => { b.textContent = i + ' / ' + n; })
      .then(() => { b.textContent = t; });
  });
  document.getElementById('bNotesClear')?.addEventListener('click', () => clearNotes());
  document.getElementById('bQR')?.addEventListener('click', () => showQR());

  //  доступ к сцене из консоли — для отладки ракурсов и проверки геометрии
  window.LS = { renderer, scene, camera, controls, layers: L, setView, VIEWS, uvh };
  renderSpec(computeSpec(reliefMode));
  updateStat();

  addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointerdown', onPick);
  //  перенос проекта между компьютерами: выгрузка и загрузка одного json
  const bS = document.getElementById('bSaveProj');
  if (bS) bS.onclick = () => { const n = downloadProject();
    bS.textContent = 'Сохранено (' + Math.round(n / 1024) + ' КБ)';
    setTimeout(() => bS.textContent = 'Проект → JSON', 2500); };
  const bLd = document.getElementById('bLoadProj');
  if (bLd) bLd.onclick = () => pickProjectFile((err, msg) => {
    if (err) { alert('Не удалось: ' + msg); return; }
    buildScene(); renderSpec(computeSpec(reliefMode)); updateStat();
    bLd.textContent = 'Обновлено'; setTimeout(() => bLd.textContent = 'Загрузить JSON', 2500);
  });

  //  горячие клавиши: H / Р — высотные отметки, С — размеры участка,
  //  Esc — снять замеры, поставленные кликом
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 'h' || k === 'р') { toggleElev(); e.preventDefault(); }
    else if (k === 'd' || k === 'в') { toggleDims(); e.preventDefault(); }
    //  Esc закрывает верхнее открытое окно, и только потом снимает отметки
    else if (k === 'escape') { if (navDepth()) navBack(); else if (elevOn) toggleElev(false); }
  });
  document.getElementById('load').style.display = 'none';
  animate();

  // если в models/car.glb положена готовая модель автомобиля — пересобираем навес
  initCarModel((ok) => {
    if (!ok) return;
    scene.remove(L.carport);
    L.carport = placeCarport(M, reliefMode);
    scene.add(L.carport);
  });
}

// ---------------------------------------------------------------------------
function buildScene() {
  clearLayers();
  L.terrain = buildTerrainMesh(M, reliefMode);
  L.lawn = buildLawn(M, reliefMode);
  L.beds = buildBeds(M, reliefMode);
  L.paving = buildHardscape(M, reliefMode, CONCEPTS[conceptId]);
  L.stepping = buildStepping(M, reliefMode, CONCEPTS[conceptId]);
  L.walls = buildWalls(M, reliefMode, CONCEPTS[conceptId]);
  L.fence = buildFence(M, reliefMode);
  L.house = placeHouse(M);
  L.carport = placeCarport(M, reliefMode);
  L.utility = buildUtility(M, reliefMode);
  L.terrSteps = buildTerraceSteps(M, reliefMode);
  const ex = buildExisting(SITE_DATA.trees, M, (x, y) => groundZ(x, y, reliefMode),
    treeKeeper(CONCEPTS[conceptId]), onSiteTest());
  L.existing = ex.site;   // лес за границей участка не строим — мешает читать проект
  L.planting = buildPlanting(M, reliefMode, CONCEPTS[conceptId]);
  L.bbq = buildBBQ(M, reliefMode, CONCEPTS[conceptId]);
  L.lights = buildLights(M, reliefMode);

  L.terrain.name = 'Рельеф';
  L.lawn.name = 'Газон';

  for (const k of Object.keys(L)) scene.add(L[k]);
  glowLights = L.lights.userData.glows || [];
}

function clearLayers() {
  for (const k of Object.keys(L)) {
    if (!L[k]) continue;
    scene.remove(L[k]);
    L[k].traverse?.(o => { if (o.geometry && o.userData.keepGeo !== true) o.geometry.dispose?.(); });
    delete L[k];
  }
}

// ---------------------------------------------------------------------------
function setupLights() {
  hemi = new THREE.HemisphereLight(0xcfe4f5, 0x6b7854, 1.30);
  scene.add(hemi);
  ambient = new THREE.AmbientLight(0xffffff, 0.52);   // теневые фасады не должны проваливаться в чёрный
  scene.add(ambient);

  sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  const d = 52;
  Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 220 });
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);
  setSunPosition(false);
}

function setSunPosition(isEvening) {
  const [cx, cy] = uv2xy(SITE.U / 2, SITE.V / 2);
  sun.target.position.set(cx, 82, -cy);
  if (!isEvening) {
    sun.position.set(cx + 38, 82 + 62, -cy + 52);
    sun.color.set(0xfff2dc); sun.intensity = 2.3;
    hemi.intensity = 1.30; ambient.intensity = 0.52;
    scene.background = new THREE.Color(0x9fc0dd);
    scene.fog.color.set(0x9fc0dd);
    renderer.toneMappingExposure = 1.05;
  } else {
    sun.position.set(cx - 70, 82 + 14, -cy + 26);
    sun.color.set(0xffb98a); sun.intensity = 0.42;
    hemi.intensity = 0.20; ambient.intensity = 0.10;   // контраст: иначе подсветку не видно
    scene.background = new THREE.Color(0x1b2436);
    scene.fog.color.set(0x1b2436);
    renderer.toneMappingExposure = 1.35;
  }
  applyGlow(isEvening);
}

/** точечные источники от светильников — только вечером, ограниченным числом */
let pointLights = [];
function applyGlow(on) {
  pointLights.forEach(p => scene.remove(p));
  pointLights = [];
  if (!on) return;
  // берём ограниченный набор, чтобы не упереться в лимит источников
  const picked = glowLights.slice(0, 30);
  for (const g of picked) {
    const p = new THREE.PointLight(0xffd9a0, g.i * 7.5, g.d * 1.5, 1.5);
    p.position.set(g.x, g.z, -g.y);
    scene.add(p); pointLights.push(p);
  }
  // тёплый свет из окон дома
  const [hx, hy] = uv2xy(23, 10.4);
  const win = new THREE.PointLight(0xffd0a0, 6.0, 26, 1.5);
  win.position.set(hx, LEVELS.FF + 1.8, -hy);
  scene.add(win); pointLights.push(win);
}

// ---------------------------------------------------------------------------
/** [u, v, превышение] → мировая точка Three */
function uvh(a) {
  const [x, y] = uv2xy(a[0], a[1]);
  return new THREE.Vector3(x, groundZ(x, y, reliefMode) + a[2], -y);
}
/** есть ли зелень/забор между целью и камерой */
function blocked(cam, tgt) {
  const dir = cam.clone().sub(tgt);
  const dist = dir.length();
  dir.normalize();
  raycaster.set(tgt, dir);
  raycaster.far = dist;
  // мешают только крупные существующие деревья: на здания мы как раз смотрим,
  // а проектные кустарники низкие и вид не закрывают
  // скрытые слои не должны отталкивать камеру
  const src = [L.existing].filter(o => o && o.visible);
  if (!src.length) return null;
  const hits = raycaster.intersectObjects(src, true);
  return hits.find(h => h.distance > 2.5 && h.distance < dist - 1.5 && h.object.visible) || null;
}
/** если обзор перекрыт кроной — поднимаем камеру, не меняя дистанцию */
function unblock(cam, tgt) {
  const c = cam.clone();
  for (let i = 0; i < 3; i++) {
    if (!blocked(c, tgt)) break;
    c.y += 2.2;
  }
  return c;
}
function applyView(v, animate = true) {
  const tg = uvh(v.tgt);
  const to = unblock(uvh(v.cam), tg);
  if (!animate) { camera.position.copy(to); controls.target.copy(tg); controls.update(); return; }
  const from = camera.position.clone(), ft = controls.target.clone();
  const t0 = performance.now(), dur = 950;
  (function step() {
    const t = Math.min(1, (performance.now() - t0) / dur);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    camera.position.lerpVectors(from, to, e);
    controls.target.lerpVectors(ft, tg, e);
    controls.update();
    if (t < 1) requestAnimationFrame(step);
  })();
}
function setView(id) {
  const v = VIEWS.find(x => x.id === id);
  if (v) applyView(v, true);
}

function toggleSun() { evening = !evening; setSunPosition(evening); return evening; }

function setConcept(id) {
  if (!CONCEPTS[id] || id === conceptId) return conceptId;
  conceptId = id;
  document.getElementById('load').style.display = 'grid';
  setTimeout(() => {
    M = makeMaterials(CONCEPTS[conceptId]);
    buildScene();
    setSunPosition(evening);
    renderSpec(computeSpec(reliefMode));
    updateStat();
    if (labelsOn) { labelsOn = false; toggleLabels(); }
    document.getElementById('load').style.display = 'none';
  }, 30);
  return conceptId;
}

function toggleRelief() {
  reliefMode = reliefMode === 'design' ? 'exist' : 'design';
  document.getElementById('load').style.display = 'grid';
  setTimeout(() => {
    buildScene();
    setSunPosition(evening);
    renderSpec(computeSpec(reliefMode));
    updateStat();
    if (labelsOn) { labelsOn = false; toggleLabels(); }
    document.getElementById('load').style.display = 'none';
  }, 30);
  return reliefMode;
}

// ---------------------------------------------------------------------------
//  Подписи зон
// ---------------------------------------------------------------------------
const LABELS = [
  { u: 38.9, v: 15.0, t: 'Навес-парковка' },
  { u: 38.5, v: 21.8, t: 'Хвойная группа' },
  { u: 37.5, v: 4.6, t: 'Хозблок' },
  { u: 32.9, v: 3.0, t: 'ЛОС' },
  { u: 23.0, v: 11.0, t: 'Жилой дом 195,1 м²' },
  { u: 17.5, v: 16.9, t: 'Терраса' },
  { u: 8.4, v: 15.5, t: 'Зона отдыха / патио' },
  { u: 21.5, v: 22.3, t: 'Парадный миксбордер' },
  { u: 2.2, v: 12.0, t: 'Лесная зона (сохраняется)' },
  { u: 43.2, v: 15.6, t: 'Въезд' },
  { u: 32.0, v: 19.5, t: 'ПС-1' },
  { u: 13.0, v: 19.5, t: 'ПС-2' },
];
function makeLabel(text) {
  const pad = 10, f = 30;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `600 ${f}px "Segoe UI",sans-serif`;
  const w = g.measureText(text).width;
  c.width = w + pad * 2; c.height = f + pad * 1.4;
  const g2 = c.getContext('2d');
  g2.fillStyle = 'rgba(16,18,21,.86)';
  g2.roundRect(0, 0, c.width, c.height, 7); g2.fill();
  g2.strokeStyle = 'rgba(127,176,105,.8)'; g2.lineWidth = 2;
  g2.roundRect(1, 1, c.width - 2, c.height - 2, 7); g2.stroke();
  g2.font = `600 ${f}px "Segoe UI",sans-serif`;
  g2.fillStyle = '#e8eaed'; g2.textBaseline = 'middle';
  g2.fillText(text, pad, c.height / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(c.width / 26, c.height / 26, 1);
  sp.renderOrder = 999;
  return sp;
}
// ---------------------------------------------------------------------------
//  ВЫСОТНЫЕ ОТМЕТКИ
//  Ноль — чистый пол 1-го этажа (LEVELS.FF). Подписи показывают превышение
//  относительно него; абсолютная отметка идёт второй строкой, мельче.
// ---------------------------------------------------------------------------
const DATUM = () => LEVELS.FF;

/** отметка в формате ±0.000 относительно нуля пола */
function relMark(zAbs) {
  const d = zAbs - DATUM();
  return (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(3).replace('.', ',');
}

function makeElevLabel(zAbs, note) {
  const t1 = relMark(zAbs), t2 = zAbs.toFixed(2).replace('.', ',');
  const f1 = 30, f2 = 19, pad = 9;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `700 ${f1}px "Segoe UI",sans-serif`;
  const w1 = g.measureText(t1).width;
  g.font = `400 ${f2}px "Segoe UI",sans-serif`;
  const sub = note ? `${t2}  ·  ${note}` : t2;
  const w2 = g.measureText(sub).width;
  c.width = Math.max(w1, w2) + pad * 2;
  c.height = f1 + f2 + pad * 2.2;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(14,16,19,.90)';
  x.roundRect(0, 0, c.width, c.height, 7); x.fill();
  x.strokeStyle = 'rgba(201,162,39,.95)'; x.lineWidth = 2;
  x.roundRect(1, 1, c.width - 2, c.height - 2, 7); x.stroke();
  x.textBaseline = 'top';
  x.font = `700 ${f1}px "Segoe UI",sans-serif`;
  x.fillStyle = '#ffd666';
  x.fillText(t1, pad, pad * 0.7);
  x.font = `400 ${f2}px "Segoe UI",sans-serif`;
  x.fillStyle = '#9aa3af';
  x.fillText(sub, pad, pad * 0.7 + f1 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(c.width / 30, c.height / 30, 1);
  sp.renderOrder = 1000;
  return sp;
}

/** точки, для которых отметка показывается постоянно */
function elevPoints() {
  const P = [];
  P.push({ u: 23.0, v: 13.7, z: LEVELS.FF, t: 'пол 1 этажа' });
  for (const w of WALLS) {
    const vm = (w.v[0] + w.v[1]) / 2;
    P.push({ u: w.u + 0.9, v: vm, z: groundZuv(w.u + 0.9, vm, reliefMode), t: `верх ${w.id}` });
    P.push({ u: w.u - 1.6, v: vm, z: groundZuv(w.u - 1.6, vm, reliefMode), t: `низ ${w.id}` });
  }
  for (const st of STEPS) {
    const s = stairSpan(st);
    P.push({ u: st.u + 0.8, v: st.v, z: s.zT, t: `верх лестницы (${s.n} ст.)` });
    P.push({ u: s.uTop - s.len - 0.6, v: st.v, z: s.zB, t: 'низ лестницы' });
  }
  const T = LEVELS.terrace;
  P.push({ u: 38.0, v: 9.0, z: groundZuv(38.0, 9.0, reliefMode), t: 'въездная площадка' });
  P.push({ u: 9.4, v: 14.7, z: groundZuv(9.4, 14.7, reliefMode), t: 'зона отдыха' });
  P.push({ u: 2.4, v: 12.0, z: groundZuv(2.4, 12.0, reliefMode), t: 'лесная зона' });
  return P;
}

let elevOn = false;
const elevSprites = [];
function toggleElev(force) {
  elevOn = force === undefined ? !elevOn : !!force;
  clearElev();
  if (elevOn) {
    for (const p of elevPoints()) {
      const [x, y] = uv2xy(p.u, p.v);
      const s = makeElevLabel(p.z, p.t);
      s.position.set(x, p.z + 1.5, -y);
      scene.add(s); elevSprites.push(s);
    }
  }
  const btn = document.getElementById('bElev');
  if (btn) btn.classList.toggle('on', elevOn);
  return elevOn;
}
function clearElev() {
  elevSprites.forEach(s => { scene.remove(s); s.material.map.dispose(); s.material.dispose(); });
  elevSprites.length = 0;
}

/** отметка в произвольной точке — по клику, когда режим включён */
function elevAtPoint(pt) {
  const s = makeElevLabel(pt.y, 'замер');
  s.position.set(pt.x, pt.y + 1.2, pt.z);
  scene.add(s); elevSprites.push(s);
}

// ---------------------------------------------------------------------------
//  РАЗМЕРЫ УЧАСТКА — по фактическим углам исполнительной съёмки
//  (координаты МСК из «Плана участка с инженерными сетями»)
// ---------------------------------------------------------------------------
let dimsOn = false;
const dimObjs = [];
function toggleDims(force) {
  dimsOn = force === undefined ? !dimsOn : !!force;
  dimObjs.forEach(o => {
    scene.remove(o);
    o.material?.map?.dispose?.(); o.material?.dispose?.(); o.geometry?.dispose?.();
  });
  dimObjs.length = 0;
  if (dimsOn) {
    const B = SITE_DATA.boundary;
    const mat = new THREE.LineBasicMaterial({ color: 0xffd666, depthTest: false });
    for (let i = 0; i < B.length; i++) {
      const a = B[i], b = B[(i + 1) % B.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // вынос размерной линии наружу от центра участка
      const cx = B.reduce((s, p) => s + p[0], 0) / B.length;
      const cy = B.reduce((s, p) => s + p[1], 0) / B.length;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const dx = mx - cx, dy = my - cy, dl = Math.hypot(dx, dy) || 1;
      const off = 1.9;
      const ax = a[0] + dx / dl * off, ay = a[1] + dy / dl * off;
      const bx = b[0] + dx / dl * off, by = b[1] + dy / dl * off;
      const za = groundZ(ax, ay, reliefMode) + 0.6, zb = groundZ(bx, by, reliefMode) + 0.6;
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a[0], groundZ(a[0], a[1], reliefMode) + 0.1, -a[1]),
        new THREE.Vector3(ax, za, -ay), new THREE.Vector3(bx, zb, -by),
        new THREE.Vector3(b[0], groundZ(b[0], b[1], reliefMode) + 0.1, -b[1]),
      ]), mat);
      line.renderOrder = 998;
      scene.add(line); dimObjs.push(line);
      const s = makeLabel(len.toFixed(2).replace('.', ',') + ' м');
      s.position.set((ax + bx) / 2, (za + zb) / 2 + 1.0, -(ay + by) / 2);
      scene.add(s); dimObjs.push(s);
    }
    const area = Math.abs(B.reduce((s, p, i) => {
      const q = B[(i + 1) % B.length]; return s + (p[0] * q[1] - q[0] * p[1]);
    }, 0)) / 2;
    const [tx, ty] = uv2xy(SITE.U / 2, SITE.V + 3.2);
    const tot = makeLabel(`участок ${area.toFixed(1).replace('.', ',')} м² · по съёмке`);
    tot.position.set(tx, groundZ(tx, ty, reliefMode) + 2.6, -ty);
    scene.add(tot); dimObjs.push(tot);
  }
  const btn = document.getElementById('bDims');
  if (btn) btn.classList.toggle('on', dimsOn);
  return dimsOn;
}

function toggleGreen() {
  greenOn = !greenOn;
  if (L.existing) L.existing.visible = greenOn;
  // крупные проектные деревья тоже скрываем — кустарник и цветники остаются
  if (L.planting) L.planting.children.forEach(p => {
    const tall = (p.userData?.h || 0) > 1.6;
    if (tall) p.visible = greenOn;
  });
  return greenOn;
}

function toggleLabels() {
  labelsOn = !labelsOn;
  if (labelsOn) {
    for (const l of LABELS) {
      const [x, y] = uv2xy(l.u, l.v);
      const s = makeLabel(l.t);
      s.position.set(x, groundZ(x, y, reliefMode) + 3.2, -y);
      scene.add(s); labelSprites.push(s);
    }
  } else {
    labelSprites.forEach(s => { scene.remove(s); s.material.map.dispose(); s.material.dispose(); });
    labelSprites.length = 0;
  }
  return labelsOn;
}

// ---------------------------------------------------------------------------
function onPick(e) {
  if (e.button !== 0 || document.getElementById('draw').classList.contains('on')) return;
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(scene.children, true)
    .filter(h => { let o = h.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; });
  const hint = document.getElementById('hint');
  if (!hits.length) { hint.style.display = 'none'; return; }
  //  режим отметок: клик ставит метку с превышением над полом 1 этажа
  if (elevOn && !e.shiftKey) { elevAtPoint(hits[0].point); return; }
  let o = hits[0].object, name = '', extra = '';
  while (o) {
    if (o.userData?.sp) { name = o.userData.sp; extra = `проектная посадка, h≈${o.userData.h} м`; break; }
    if (o.userData?.existing) { name = 'Существующее насаждение'; extra = `сохраняется, h≈${o.userData.h} м`; break; }
    if (o.name && o.name !== '') { name = o.name; break; }
    o = o.parent;
  }
  if (!name) { hint.style.display = 'none'; return; }
  const z = hits[0].point.y;
  hint.innerHTML = `<b>${name}</b>${extra ? '<br>' + extra : ''}<br><span style="color:#9aa3af">отм. ${z.toFixed(2)}</span>`;
  hint.style.display = 'block';
  hint.style.left = Math.min(e.clientX + 14, innerWidth - 280) + 'px';
  hint.style.top = (e.clientY + 14) + 'px';
  clearTimeout(onPick._t);
  onPick._t = setTimeout(() => hint.style.display = 'none', 4000);
}

function updateStat() {
  const s = computeSpec(reliefMode);
  setStat([
    ['Участок', s.totals.area + ' м²'],
    ['Покрытия', s.totals.paving + ' м²'],
    ['Газон', s.totals.lawn + ' м²'],
    ['Растений', s.totals.plants + ' / ' + s.totals.exTrees],
    ['Светильников', s.totals.lights],
  ]);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  const d = document.getElementById('draw');
  d.width = innerWidth; d.height = innerHeight;
  if (typeof window.__penRedraw === 'function') window.__penRedraw();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

export { camera, renderer, scene, reliefMode };
