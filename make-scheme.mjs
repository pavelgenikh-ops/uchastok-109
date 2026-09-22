// План-схема для согласования: где встают лестницы по замечаниям.
// Рисуем в SVG прямо из design.js, без запуска 3D — быстро и наглядно.
import * as D from './js/design.js';
import fs from 'fs';

const U0 = 8, U1 = 38, V0 = -1, V1 = 26;          // окно плана в координатах участка
const K = 34;                                      // пикселей на метр
const W = (U1 - U0) * K, H = (V1 - V0) * K;
const X = (u) => ((u - U0) * K).toFixed(1);
const Y = (v) => (H - (v - V0) * K).toFixed(1);    // v вверх

const out = [];
const add = (s) => out.push(s);

add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, sans-serif">`);
add(`<rect width="${W}" height="${H}" fill="#eef1ec"/>`);

// сетка по метрам
for (let u = Math.ceil(U0); u <= U1; u += 2)
  add(`<line x1="${X(u)}" y1="0" x2="${X(u)}" y2="${H}" stroke="#dfe4dc" stroke-width="1"/>`);
for (let v = Math.ceil(V0); v <= V1; v += 2)
  add(`<line x1="0" y1="${Y(v)}" x2="${W}" y2="${Y(v)}" stroke="#dfe4dc" stroke-width="1"/>`);

const poly = (pts, fill, stroke, sw = 1.5, dash = '') =>
  add(`<polygon points="${pts.map(([u, v]) => X(u) + ',' + Y(v)).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`);
const rect = (r, fill, stroke, sw = 1.5) =>
  poly([[r.u[0], r.v[0]], [r.u[1], r.v[0]], [r.u[1], r.v[1]], [r.u[0], r.v[1]]], fill, stroke, sw);

// покрытия
for (const p of D.BASE_PAVING) poly(p.poly, '#d9d6cf', '#bcb8b0', 1);
// проезд
rect({ u: D.DRIVE.u, v: D.DRIVE.v }, '#cfcac1', '#b3aea4', 1);

// дом
rect(D.HOUSE.warm, '#3f4a44', '#2b332e', 2);
rect(D.HOUSE.terrW, '#c8a97a', '#a98c5f', 1.5);
if (D.HOUSE.terrWN) rect(D.HOUSE.terrWN, '#c8a97a', '#a98c5f', 1.5);
rect(D.HOUSE.terrS, '#c8a97a', '#a98c5f', 1.5);
rect(D.HOUSE.porch, '#b5966a', '#93794f', 1.5);
add(`<text x="${X(22.5)}" y="${Y(13)}" fill="#fff" font-size="15" text-anchor="middle">ДОМ</text>`);
add(`<text x="${X(16.1)}" y="${Y(11)}" fill="#6b5738" font-size="11" text-anchor="middle" transform="rotate(-90 ${X(16.1)} ${Y(11)})">настил запад</text>`);
add(`<text x="${X(21.2)}" y="${Y(4.6)}" fill="#6b5738" font-size="11" text-anchor="middle">настил юг</text>`);

// подпорные стенки
for (const w of D.WALLS)
  add(`<line x1="${X(w.u)}" y1="${Y(w.v[0])}" x2="${X(w.u)}" y2="${Y(w.v[1])}" stroke="#7a6f62" stroke-width="6"/>`);

// лестницы в стенках
for (const st of D.STEPS) {
  add(`<rect x="${X(st.u - 3.6)}" y="${Y(st.v + st.w / 2)}" width="${(3.6 * K).toFixed(1)}" height="${(st.w * K).toFixed(1)}" fill="#8fb3d9" stroke="#3f6ea8" stroke-width="2"/>`);
}

// НОВЫЕ марши по замечаниям
const DIRV = { south: [0, -1], north: [0, 1], west: [-1, 0], east: [1, 0] };
const NUM = { 'Л-1': '1', 'Л-2': '2', 'Л-3': '' };
const VAR2 = [];
for (const s of D.TERR_STEPS) {
  const d = DIRV[s.dir];
  const len = 1.8;
  const a = [s.u, s.v], b = [s.u + d[0] * len, s.v + d[1] * len];
  const nx = -d[1], ny = d[0];
  const pts = [
    [a[0] + nx * s.w / 2, a[1] + ny * s.w / 2],
    [b[0] + nx * s.w / 2, b[1] + ny * s.w / 2],
    [b[0] - nx * s.w / 2, b[1] - ny * s.w / 2],
    [a[0] - nx * s.w / 2, a[1] - ny * s.w / 2],
  ];
  poly(pts, '#e8553a', '#a92d16', 2.5);
  // стрелка направления подъёма: от низа к верху марша
  add(`<line x1="${X(b[0] + d[0] * 0.9)}" y1="${Y(b[1] + d[1] * 0.9)}" x2="${X(a[0] - d[0] * 0.4)}" y2="${Y(a[1] - d[1] * 0.4)}" stroke="#a92d16" stroke-width="3" marker-end="url(#ar)"/>`);
  const n = NUM[s.id];
  if (n) {
    const cx = b[0] + d[0] * 1.9, cy = b[1] + d[1] * 1.9;
    add(`<circle cx="${X(cx)}" cy="${Y(cy)}" r="15" fill="#a92d16"/>`);
    add(`<text x="${X(cx)}" y="${Y(cy)}" dy="6" fill="#fff" font-size="18" font-weight="bold" text-anchor="middle">${n}</text>`);
  }
}

// два варианта прочтения замечания №2 — пунктиром, на выбор
for (const v2 of VAR2) {
  const d = DIRV[v2.dir], len = 1.8;
  const a = [v2.u, v2.v], b = [v2.u + d[0] * len, v2.v + d[1] * len];
  const nx = -d[1], ny = d[0];
  poly([
    [a[0] + nx * v2.w / 2, a[1] + ny * v2.w / 2], [b[0] + nx * v2.w / 2, b[1] + ny * v2.w / 2],
    [b[0] - nx * v2.w / 2, b[1] - ny * v2.w / 2], [a[0] - nx * v2.w / 2, a[1] - ny * v2.w / 2],
  ], 'rgba(232,85,58,0.35)', '#a92d16', 2.5, '7 5');
  const cx = b[0] + d[0] * 1.5, cy = b[1] + d[1] * 1.5;
  add(`<circle cx="${X(cx)}" cy="${Y(cy)}" r="17" fill="#fff" stroke="#a92d16" stroke-width="3"/>`);
  add(`<text x="${X(cx)}" y="${Y(cy)}" dy="6" fill="#a92d16" font-size="16" font-weight="bold" text-anchor="middle">${v2.id}</text>`);
}

// подпись к лестнице №3 (она в стенке)
const s3 = D.STEPS[0];
add(`<circle cx="${X(s3.u + 1.6)}" cy="${Y(s3.v)}" r="15" fill="#a92d16"/>`);
add(`<text x="${X(s3.u + 1.6)}" y="${Y(s3.v)}" dy="6" fill="#fff" font-size="18" font-weight="bold" text-anchor="middle">3</text>`);

// створ: лестница №3 и марш №1 стоят на одной оси
const axis = D.TERR_STEPS.find((s) => s.id === 'Л-1');
if (axis) {
  add(`<line x1="${X(14)}" y1="${Y(axis.v)}" x2="${X(36)}" y2="${Y(axis.v)}" stroke="#a92d16" stroke-width="1.6" stroke-dasharray="10 6" opacity="0.75"/>`);
  add(`<text x="${X(29.5)}" y="${Y(axis.v + 0.5)}" font-size="12" fill="#a92d16">створ: одна ось подъёма</text>`);
}

add(`<defs><marker id="ar" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#a92d16"/></marker></defs>`);

// стороны света и пояснения
add(`<text x="14" y="26" font-size="15" fill="#2b332e" font-weight="bold">СХЕМА СОГЛАСОВАНИЯ — лестницы по замечаниям 22.09.2026</text>`);
add(`<text x="14" y="46" font-size="12" fill="#5a625c">красным — новые марши, стрелка показывает направление подъёма; синим — лестницы в подпорных стенках</text>`);
add(`<text x="${W - 90}" y="${H - 40}" font-size="13" fill="#5a625c">ВОСТОК →</text>`);
add(`<text x="${W - 90}" y="${H - 22}" font-size="13" fill="#5a625c">(въезд, парковка)</text>`);
add(`<text x="16" y="${H - 22}" font-size="13" fill="#5a625c">← ЗАПАД (сад)</text>`);
add(`<text x="${W / 2}" y="${H - 8}" font-size="13" fill="#5a625c" text-anchor="middle">ЮГ</text>`);
add(`<text x="${W / 2}" y="68" font-size="13" fill="#5a625c" text-anchor="middle">СЕВЕР</text>`);
add('</svg>');

fs.writeFileSync(process.argv[2], out.join('\n'));
console.log('маршей на схеме: ' + D.TERR_STEPS.length + ', лестниц в стенках: ' + D.STEPS.length);
