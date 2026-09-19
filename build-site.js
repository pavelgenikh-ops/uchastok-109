// Разбор выгрузки DWG (dump.tsv) в модель участка site.json
// Запуск: node.exe build-site.js   (из папки приложения)
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SRC = path.join(DIR, 'data', 'dwg_dump.tsv');
const OUT = path.join(DIR, 'data', 'site.json');

// Локальное начало координат — сдвигаем МСК к нулю
const OX = 2229300; // dwg X  (геодезический Y, восток)
const OY = 460290;  // dwg Y  (геодезический X, север)

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/).filter(Boolean);

function parseRow(row) {
  const f = row.split('\t');
  const o = { type: f[0], layer: f[1], pts: [], attrs: {} };
  for (let i = 2; i < f.length; i++) {
    const s = f[i];
    let m = s.match(/^P(10|11)=(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)$/);
    if (m) {
      o.pts.push({ g: +m[1], x: +m[2] - OX, y: +m[3] - OY, z: +m[4] });
      continue;
    }
    m = s.match(/^(TXT|NAME|V40|V70)=(.*)$/s);
    if (m) o.attrs[m[1]] = m[2];
  }
  return o;
}

const rows = lines.map(parseRow);

// ---------- 1. Граница участка ----------
const bLines = rows.filter(r => r.layer === 'граница' && r.type === 'LINE');
// собираем замкнутый контур из отрезков
const segs = bLines.map(r => [r.pts[0], r.pts[1]]);
const key = p => `${p.x.toFixed(2)}|${p.y.toFixed(2)}`;
const ring = [];
let cur = segs[0][0], end = segs[0][1];
ring.push(cur, end);
const used = new Set([0]);
while (used.size < segs.length) {
  let found = false;
  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue;
    const [a, b] = segs[i];
    if (key(a) === key(end)) { ring.push(b); end = b; used.add(i); found = true; break; }
    if (key(b) === key(end)) { ring.push(a); end = a; used.add(i); found = true; break; }
  }
  if (!found) break;
}
// убираем дубль-замыкание
if (ring.length > 1 && key(ring[0]) === key(ring[ring.length - 1])) ring.pop();
const boundary = ring.map(p => [+p.x.toFixed(3), +p.y.toFixed(3)]);

function polyArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}
function polyPerim(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += Math.hypot(x2 - x1, y2 - y1);
  }
  return s;
}

// ---------- 2. Отметки рельефа ----------
const spots = [];
for (const r of rows) {
  if (r.type !== 'TEXT') continue;
  if (!/Отметки высоты|траншея|газ|септик/.test(r.layer)) continue;
  const t = (r.attrs.TXT || '').trim();
  const v = parseFloat(t);
  if (!isFinite(v) || v < 60 || v > 100) continue;
  const p = r.pts.find(q => q.g === 10);
  if (!p) continue;
  spots.push({ x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +v.toFixed(3), src: r.layer.includes('Отметки') ? 'topo' : 'net' });
}
// дедуп по координате
const seen = new Set();
const elev = spots.filter(s => {
  const k = `${s.x.toFixed(1)}|${s.y.toFixed(1)}`;
  if (seen.has(k)) return false;
  seen.add(k); return true;
});

// ---------- 3. Растительность ----------
// классификация по имени блока (сверено с PDF-подложкой)
const TREE_CLASS = {
  'g5_401': 'shrub',    // мелкий кустарник / поросль
  'g5_368': 'conifer',  // хвойное (ёлочка)
  '*U5': 'decid',       // лиственное (крона-кружок)
};
const trees = [];
for (const r of rows) {
  if (r.type !== 'INSERT') continue;
  if (!/астительность/.test(r.layer)) continue;
  const p = r.pts.find(q => q.g === 10);
  if (!p) continue;
  const nm = r.attrs.NAME || '';
  let cls = TREE_CLASS[nm] || null;
  if (!cls) cls = /U/.test(nm) ? 'decid' : 'conifer';
  trees.push({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +(p.z || 0).toFixed(2), cls, blk: nm });
}
// дедуп совпадающих вставок
const tseen = new Set();
const treesU = trees.filter(t => {
  const k = `${t.x.toFixed(1)}|${t.y.toFixed(1)}`;
  if (tseen.has(k)) return false;
  tseen.add(k); return true;
});

// ---------- 4. Контур дома (подложка «PDF _Сваи буровые» + слой 0) ----------
// самая длинная полилиния слоя 0 внутри участка = наружный контур дома
let house = null, houseLen = 0;
for (const r of rows) {
  if (r.type !== 'LWPOLYLINE' || r.layer !== '0') continue;
  const pts = r.pts.filter(q => q.g === 10).map(q => [q.x, q.y]);
  if (pts.length < 8) continue;
  const per = polyPerim(pts);
  if (per > houseLen) { houseLen = per; house = pts.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]); }
}

// сваи дома — мелкие полилинии подложки
const piles = [];
for (const r of rows) {
  if (r.type !== 'LWPOLYLINE' || !/Сваи/.test(r.layer)) continue;
  const pts = r.pts.filter(q => q.g === 10);
  if (!pts.length) continue;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  if (w > 0.05 && w < 0.6 && h > 0.05 && h < 0.6) {
    piles.push([+((Math.min(...xs) + w / 2)).toFixed(3), +((Math.min(...ys) + h / 2)).toFixed(3)]);
  }
}

// ---------- 5. Инженерные сети ----------
const nets = { gas: [], power: [], sewer: [], water: [] };
for (const r of rows) {
  if (r.type !== 'LWPOLYLINE' && r.type !== 'LINE') continue;
  const pts = r.pts.filter(q => q.g === 10 || q.g === 11).map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]);
  if (pts.length < 2) continue;
  if (/Газопровод|^газ$/.test(r.layer)) nets.gas.push(pts);
  else if (/Кабел|электропередач/.test(r.layer)) nets.power.push(pts);
  else if (/канализац|септик/.test(r.layer)) nets.sewer.push(pts);
}

// ---------- 6. Горизонтали ----------
const contours = [];
for (const r of rows) {
  if (r.type !== 'LWPOLYLINE' || !/C-TOPO/.test(r.layer)) continue;
  const pts = r.pts.filter(q => q.g === 10).map(q => [+q.x.toFixed(2), +q.y.toFixed(2)]);
  if (pts.length > 1) contours.push({ major: /MAJR/.test(r.layer), pts });
}

// ---------- 7. Статистика рельефа ----------
const zs = elev.map(e => e.z);
const stat = {
  n: elev.length,
  zmin: Math.min(...zs), zmax: Math.max(...zs),
  drop: +(Math.max(...zs) - Math.min(...zs)).toFixed(2),
};

const site = {
  meta: {
    title: 'СНТ «МАДИО Озерки», уч. 109',
    cadastr: '47:07:0518004:14',
    source: 'План участка для благоустройства.dwg (исполнительная съёмка)',
    origin: { dwgX: OX, dwgY: OY, note: 'локальные координаты = МСК минус origin; X — на восток, Y — на север' },
    areaFact: +polyArea(boundary).toFixed(1),
    perimeter: +polyPerim(boundary).toFixed(1),
  },
  boundary,
  elev,
  trees: treesU,
  house,
  piles,
  nets,
  contours,
  stat,
};

fs.writeFileSync(OUT, JSON.stringify(site));
console.log('boundary pts:', boundary.length, boundary.map(p => p.join(',')).join(' | '));
console.log('площадь по съёмке:', site.meta.areaFact, 'м²  периметр:', site.meta.perimeter, 'м');
console.log('отметок:', elev.length, ' z:', stat.zmin, '…', stat.zmax, ' перепад:', stat.drop, 'м');
console.log('деревьев/кустов:', treesU.length, JSON.stringify(treesU.reduce((a, t) => (a[t.cls] = (a[t.cls] || 0) + 1, a), {})));
console.log('контур дома вершин:', house ? house.length : 0, ' периметр:', house ? polyPerim(house).toFixed(1) : 0);
console.log('свай:', piles.length);
console.log('сети: газ', nets.gas.length, ' электро', nets.power.length, ' канализация', nets.sewer.length);
console.log('горизонталей:', contours.length);
console.log('→', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' КБ');
