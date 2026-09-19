import fs from 'fs';
import { initGeo } from './js/geo.js';
import { PAVING, STEPPING, HOUSE, CARPORT, BBQ, STEPS, WALLS } from './js/design.js';
import { stairSpan } from './js/geo.js';
initGeo(JSON.parse(fs.readFileSync('./data/site.json','utf8')));
const bb = p => ({u0:Math.min(...p.map(q=>q[0])),u1:Math.max(...p.map(q=>q[0])),
                  v0:Math.min(...p.map(q=>q[1])),v1:Math.max(...p.map(q=>q[1]))});
const ovl = (a,b,tol=0.35) => a.u0-tol<b.u1 && a.u1+tol>b.u0 && a.v0-tol<b.v1 && a.v1+tol>b.v0;
const rect = (o) => ({u0:o.u[0],u1:o.u[1],v0:o.v[0],v1:o.v[1]});

console.log('=== ПОКРЫТИЯ ПОД ПРИПОДНЯТЫМИ КОНСТРУКЦИЯМИ ===');
let bad = 0;
for (const p of PAVING) {
  const b = bb(p.poly);
  for (const [nm, r] of [['терраса западная', rect(HOUSE.terrW)], ['терраса южная', rect(HOUSE.terrS)],
                         ['дом', rect(HOUSE.warm)], ['навес', rect(CARPORT)]]) {
    if (b.u0 < r.u1-0.1 && b.u1 > r.u0+0.1 && b.v0 < r.v1-0.1 && b.v1 > r.v0+0.1) {
      // навес — там мощение нужно
      if (nm === 'навес') continue;
      if (p.id.startsWith('О-')) continue;   // отмостка идёт по периметру фундамента, под террасами это норма
      bad++; console.log(`!! ${p.id} проходит под «${nm}»`);
    }
  }
}
if (!bad) console.log('нет');

console.log('\n=== СВЯЗНОСТЬ: с чем граничит каждое покрытие ===');
const marshRect = (st) => { const s = stairSpan(st);
  return {u0:s.uTop-s.len-0.4, u1:s.uTop+0.4, v0:st.v-st.w/2-0.3, v1:st.v+st.w/2+0.3}; };
const nodes = PAVING.map(p => ({id:p.id, name:p.name, b:bb(p.poly)}));
STEPS.forEach((st,i)=>nodes.push({id:`Л${i+1}`, name:`лестница u=${st.u} v=${st.v}`, b:marshRect(st)}));
STEPPING.forEach(s=>nodes.push({id:s.id, name:s.name, b:bb(s.path)}));
nodes.push({id:'крыльцо', name:'крыльцо дома', b:rect(HOUSE.porch)});
nodes.push({id:'террЗ', name:'терраса западная', b:rect(HOUSE.terrW)});
nodes.push({id:'террЮ', name:'терраса южная', b:rect(HOUSE.terrS)});
let lone = 0;
for (const n of nodes) {
  const nb = nodes.filter(m => m !== n && ovl(n.b, m.b)).map(m => m.id);
  if (nb.length === 0) { lone++; console.log(`!! ${n.id} (${n.name}) — НИ С ЧЕМ не связано`); }
  else if (nb.length === 1 && /^П-/.test(n.id)) console.log(`·  ${n.id} — только ${nb[0]} (тупик)`);
}
if (!lone) console.log('изолированных элементов нет');
