import fs from 'fs';
import { initGeo } from './js/geo.js';
import { PAVING, STEPPING, HOUSE, STEPS } from './js/design.js';
import { stairSpan } from './js/geo.js';
initGeo(JSON.parse(fs.readFileSync('./data/site.json','utf8')));
const bb = p => ({u0:Math.min(...p.map(q=>q[0])),u1:Math.max(...p.map(q=>q[0])),
                  v0:Math.min(...p.map(q=>q[1])),v1:Math.max(...p.map(q=>q[1]))});
const gap = (a,b) => {           // зазор между прямоугольниками, 0 = соприкасаются
  const du = Math.max(0, Math.max(a.u0 - b.u1, b.u0 - a.u1));
  const dv = Math.max(0, Math.max(a.v0 - b.v1, b.v0 - a.v1));
  return Math.hypot(du, dv);
};
const nodes = PAVING.map(p => ({id:p.id, name:p.name, b:bb(p.poly)}));
STEPPING.forEach(s => nodes.push({id:s.id, name:s.name, b:bb(s.path)}));
STEPS.forEach((st,i) => { const s = stairSpan(st);
  nodes.push({id:`Л${i+1}`, name:`лестница u=${st.u} v=${st.v}`,
    b:{u0:s.uTop-s.len-1.0, u1:s.uTop+0.4, v0:st.v-st.w/2-0.2, v1:st.v+st.w/2+0.2}}); });   // с нижней площадкой марша
for (const [id, r] of [['крыльцо', HOUSE.porch], ['террЗ', HOUSE.terrW], ['террЮ', HOUSE.terrS]])
  nodes.push({id, name:id, b:{u0:r.u[0],u1:r.u[1],v0:r.v[0],v1:r.v[1]}});

console.log('=== ВИЗУАЛЬНЫЕ РАЗРЫВЫ (0,05…1,2 м — «почти достаёт, но не доходит») ===');
let n = 0;
for (let i = 0; i < nodes.length; i++) for (let j = i+1; j < nodes.length; j++) {
  const d = gap(nodes[i].b, nodes[j].b);
  if (d <= 0.05 || d >= 1.2) continue;
  // пары «верх/низ» по разные стороны лестницы разделены маршем — это норма
  const viaStairs = nodes.some(k => /^Л/.test(k.id) && gap(k.b, nodes[i].b) < 0.35 && gap(k.b, nodes[j].b) < 0.35);
  if (viaStairs) continue;
  n++; console.log(`!! ${nodes[i].id} ↔ ${nodes[j].id}: ${d.toFixed(2)} м`);
}
console.log(n ? `всего ${n}` : 'разрывов нет');

// ---- достижимость: можно ли дойти от крыльца до каждой зоны по мощению ----
console.log('\n=== МАРШРУТЫ ОТ КРЫЛЬЦА (по покрытиям и лестницам) ===');
const adj = new Map(nodes.map(n => [n.id, []]));
for (let i = 0; i < nodes.length; i++) for (let j = i+1; j < nodes.length; j++)
  if (gap(nodes[i].b, nodes[j].b) <= 0.05) {
    adj.get(nodes[i].id).push(nodes[j].id); adj.get(nodes[j].id).push(nodes[i].id);
  }
const seen = new Set(['крыльцо']); const q = ['крыльцо'];
while (q.length) for (const nb of adj.get(q.shift()) || [])
  if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
const lost = nodes.filter(n => !seen.has(n.id));
if (lost.length) {
  console.log('!! НЕ ДОЙТИ от крыльца:');
  for (const n of lost) console.log(`   ${n.id} — ${n.name}`);
} else console.log('от крыльца достижимы все зоны');
