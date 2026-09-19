import fs from 'fs';
import { initGeo, groundZuv, stairSpan } from './js/geo.js';
import { STEPS, WALLS, HOUSE, PAVING, STEPPING, CARPORT, UTILITY, BBQ, SITE } from './js/design.js';
initGeo(JSON.parse(fs.readFileSync('./data/site.json', 'utf8')));

const bb = (p) => ({ u0: Math.min(...p.map(q=>q[0])), u1: Math.max(...p.map(q=>q[0])),
                     v0: Math.min(...p.map(q=>q[1])), v1: Math.max(...p.map(q=>q[1])) });
const near = (u, v, tol=0.4) => {
  const h = [];
  for (const p of PAVING) { const b = bb(p.poly);
    if (u>=b.u0-tol && u<=b.u1+tol && v>=b.v0-tol && v<=b.v1+tol) h.push(p.id); }
  for (const s of STEPPING) for (let i=0;i<s.path.length-1;i++){
    const [au,av]=s.path[i],[bu,bv]=s.path[i+1]; const dx=bu-au,dy=bv-av,L=dx*dx+dy*dy;
    let t=L?((u-au)*dx+(v-av)*dy)/L:0; t=Math.max(0,Math.min(1,t));
    if (Math.hypot(u-(au+t*dx), v-(av+t*dy))<0.9){h.push(s.id);break;} }
  return h;
};
let bad = 0;
console.log('=== ЛЕСТНИЦЫ ===\n');
for (const st of STEPS) {
  const sp = stairSpan(st); const dz = sp.dz, n = sp.n;
  const len = sp.len + 0.63, uLow = sp.uTop - len;
  const w = WALLS.find(x => Math.abs(x.u-st.u)<0.01);
  const up = near(st.u+0.8, st.v), dn = near(uLow-0.2, st.v);
  const ovl = (a0,a1,b0,b1) => a0 < b1 && a1 > b0;
  const hitHouse = ovl(uLow, st.u, HOUSE.warm.u[0], HOUSE.warm.u[1]) && st.v > HOUSE.warm.v[0]-HOUSE.eave && st.v < HOUSE.warm.v[1]+HOUSE.eave;
  const hitPorch = ovl(uLow, st.u, HOUSE.porch.u[0], HOUSE.porch.u[1]) && st.v > HOUSE.porch.v[0] && st.v < HOUSE.porch.v[1];
  const ok = up.length && dn.length && !hitHouse;
  if (!ok) bad++;
  console.log(`${ok?'OK ':'!! '} ${w.id} v=${st.v}  перепад ${dz.toFixed(2)} м → ${n} ступ. × ${(dz/n*1000).toFixed(0)} мм, марш ${len.toFixed(2)} м (u ${st.u}→${uLow.toFixed(2)})`);
  console.log(`      верх: ${up.join(', ')||'— ПУСТО —'}   низ: ${dn.join(', ')||'— ПУСТО —'}` +
              (hitHouse?'   !! ВРЕЗАЕТСЯ В ДОМ':'') + (hitPorch&&!hitHouse?'   (выходит на крыльцо)':''));
}
console.log('\n=== ПЕРЕСЕЧЕНИЯ ПОКРЫТИЙ СО СТЕНКАМИ ===');
let cross = 0;
for (const w of WALLS) for (const p of PAVING) { const b = bb(p.poly);
  if (b.u0 < w.u-0.02 && b.u1 > w.u+0.02) { cross++; console.log(`!! ${p.id} пересекает ${w.id}`); } }
for (const w of WALLS) for (const s of STEPPING)
  for (let i=0;i<s.path.length-1;i++){ const a=s.path[i],b=s.path[i+1];
    if ((a[0]-w.u)*(b[0]-w.u) < 0) { cross++; console.log(`!! ${s.id} пересекает ${w.id} у v≈${(a[1]+(b[1]-a[1])*(w.u-a[0])/(b[0]-a[0])).toFixed(1)}`); } }
if (!cross) console.log('нет — все покрытия по одну сторону стенок');

console.log('\n=== ГАБАРИТЫ И НАЛОЖЕНИЯ ===');
const w1 = WALLS[0];
console.log(`ПС-1 u=${w1.u}, навес от u=${CARPORT.u[0]} → зазор ${(CARPORT.u[0]-w1.u).toFixed(2)} м ${CARPORT.u[0]>w1.u?'OK':'!! НАЛОЖЕНИЕ'}`);
console.log(`Навес до u=${CARPORT.u[1]}, забор u=${SITE.U} → ${(SITE.U-CARPORT.u[1]).toFixed(2)} м`);
console.log(`ЛОС u ${UTILITY.los.u} ${UTILITY.los.u[0]>w1.u?'OK — восточнее стенки':'!! под стенкой'}`);
const p3 = PAVING.find(p=>p.id==='П-3');
console.log(`Парадная площадка П-3: от крыльца u=${HOUSE.porch.u[1]} до u=${bb(p3.poly).u1}`);
console.log(bad ? `\nИТОГ: ${bad} проблемных лестниц` : '\nИТОГ: все лестницы связаны с покрытиями');
