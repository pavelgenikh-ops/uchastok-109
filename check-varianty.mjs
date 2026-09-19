import fs from 'fs';
import { initGeo, stairSpan } from './js/geo.js';
import { pavingFor, steppingFor, HOUSE, STEPS, CONCEPTS } from './js/design.js';
initGeo(JSON.parse(fs.readFileSync('./data/site.json','utf8')));
const bb = p => ({u0:Math.min(...p.map(q=>q[0])),u1:Math.max(...p.map(q=>q[0])),
                  v0:Math.min(...p.map(q=>q[1])),v1:Math.max(...p.map(q=>q[1]))});
const gap = (a,b) => Math.hypot(Math.max(0, Math.max(a.u0-b.u1, b.u0-a.u1)),
                                Math.max(0, Math.max(a.v0-b.v1, b.v0-a.v1)));
for (const id of ['soft','strict','warm']) {
  const nodes = pavingFor(id).map(p => ({id:p.id, name:p.name, b:bb(p.poly)}));
  steppingFor(id).forEach(s => nodes.push({id:s.id, name:s.name, b:bb(s.path)}));
  STEPS.forEach((st,i) => { const s = stairSpan(st);
    nodes.push({id:`Л${i+1}`, name:`лестница v=${st.v}`,
      b:{u0:s.uTop-s.len-1.0, u1:s.uTop+0.4, v0:st.v-st.w/2-0.2, v1:st.v+st.w/2+0.2}}); });
  for (const [nm, r] of [['крыльцо',HOUSE.porch],['террЗ',HOUSE.terrW],['террЮ',HOUSE.terrS]])
    nodes.push({id:nm, name:nm, b:{u0:r.u[0],u1:r.u[1],v0:r.v[0],v1:r.v[1]}});

  const adj = new Map(nodes.map(n => [n.id, []]));
  for (let i=0;i<nodes.length;i++) for (let j=i+1;j<nodes.length;j++)
    if (gap(nodes[i].b, nodes[j].b) <= 0.30) {
      adj.get(nodes[i].id).push(nodes[j].id); adj.get(nodes[j].id).push(nodes[i].id); }
  const seen = new Set(['крыльцо']); const q = ['крыльцо'];
  while (q.length) for (const nb of adj.get(q.shift()) || []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
  const lost = nodes.filter(n => !seen.has(n.id));
  console.log(`\n${CONCEPTS[id].name}  (${nodes.length} элементов)`);
  if (lost.length) { console.log('  !! НЕ ДОЙТИ от крыльца:');
    for (const n of lost) console.log(`     ${n.id} — ${n.name}`); }
  else console.log('  OK — от крыльца достижимо всё');
}
