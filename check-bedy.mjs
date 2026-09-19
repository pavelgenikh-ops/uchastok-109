import fs from 'fs';
import { initGeo, groundZuv } from './js/geo.js';
import { BEDS, PAVING, WALLS, STEPS, LIGHTS, CARPORT } from './js/design.js';
initGeo(JSON.parse(fs.readFileSync('./data/site.json','utf8')));
const inPoly = (u,v,p) => { let c=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){ const [xi,yi]=p[i],[xj,yj]=p[j];
    if((yi>v)!==(yj>v) && u<(xj-xi)*(v-yi)/(yj-yi)+xi) c=!c; } return c; };
// марш лестницы как прямоугольник
const marsh = (st) => { const dz=Math.max(0.30, groundZuv(st.u+0.7,st.v,'design')-groundZuv(st.u-1.6,st.v,'design'));
  const n=Math.max(2,Math.round(dz/0.15)); const len=n*0.33+0.63;
  return {u0:st.u-len, u1:st.u+0.4, v0:st.v-st.w/2-0.15, v1:st.v+st.w/2+0.15}; };
console.log('=== ЦВЕТНИКИ: наложение на покрытия, стенки, марши ===');
let bad=0;
for (const bed of BEDS) {
  const hits = new Set();
  const b = {u0:Math.min(...bed.poly.map(p=>p[0])), u1:Math.max(...bed.poly.map(p=>p[0])),
             v0:Math.min(...bed.poly.map(p=>p[1])), v1:Math.max(...bed.poly.map(p=>p[1]))};
  for (let u=b.u0; u<=b.u1; u+=0.2) for (let v=b.v0; v<=b.v1; v+=0.2) {
    if (!inPoly(u,v,bed.poly)) continue;
    for (const p of PAVING) if (inPoly(u,v,p.poly)) hits.add(p.id);
    for (const w of WALLS) if (Math.abs(u-w.u)<0.25 && v>=w.v[0] && v<=w.v[1]) hits.add(w.id);
    for (const st of STEPS) { const m=marsh(st);
      if (u>=m.u0&&u<=m.u1&&v>=m.v0&&v<=m.v1) hits.add(`марш ${st.u}/${st.v}`); }
  }
  if (hits.size) { bad++; console.log(`!! ${bed.id} ${bed.name} → ${[...hits].join(', ')}`); }
}
console.log(bad?`всего ${bad}`:'конфликтов нет');
console.log('\n=== СВЕТИЛЬНИКИ ===');
let k=0;
for (const [type,cfg] of Object.entries(LIGHTS)) { if (!cfg.pts) continue;
  for (const [u,v] of cfg.pts) { const bad=[];
    for (const st of STEPS) { const m=marsh(st); if (u>=m.u0&&u<=m.u1&&v>=m.v0&&v<=m.v1) bad.push(`марш ${st.u}/${st.v}`); }
    for (const w of WALLS) if (Math.abs(u-w.u)<0.2 && v>=w.v[0]&&v<=w.v[1]) bad.push(w.id);
    if (u>=CARPORT.u[0]&&u<=CARPORT.u[1]&&v>=CARPORT.v[0]&&v<=CARPORT.v[1]) bad.push('под навесом');
    if (bad.length){k++;console.log(`!! ${type} (${u}, ${v}) → ${bad.join(', ')}`);} } }
console.log(k?`всего ${k}`:'конфликтов нет');

// ---- посадки на конструкциях ----
import { PLANTING, HOUSE } from './js/design.js';
console.log('\n=== ПОСАДКИ НА КОНСТРУКЦИЯХ ===');
let np = 0;
for (const g of PLANTING) for (const [u, v] of g.pts) {
  const hit = [];
  for (const p of PAVING) if (inPoly(u, v, p.poly)) hit.push(p.id);
  for (const w of WALLS) if (Math.abs(u - w.u) < 0.4 && v >= w.v[0] && v <= w.v[1]) hit.push(w.id);
  for (const st of STEPS) { const m = marsh(st);
    if (u >= m.u0 && u <= m.u1 && v >= m.v0 && v <= m.v1) hit.push(`марш ${st.u}/${st.v}`); }
  if (u >= CARPORT.u[0] - 0.6 && u <= CARPORT.u[1] + 0.6 &&
      v >= CARPORT.v[0] - 1.3 && v <= CARPORT.v[1] + 0.6) hit.push('навес');
  for (const [nm, r] of [['дом', HOUSE.warm], ['терраса З', HOUSE.terrW], ['терраса Ю', HOUSE.terrS]])
    if (u >= r.u[0] - HOUSE.eave && u <= r.u[1] + HOUSE.eave &&
        v >= r.v[0] - HOUSE.eave && v <= r.v[1] + HOUSE.eave) hit.push(nm);
  if (hit.length) { np++; console.log(`!! ${g.sp} (${u}, ${v}) → ${[...new Set(hit)].join(', ')}`); }
}
console.log(np ? `всего ${np}` : 'конфликтов нет');
