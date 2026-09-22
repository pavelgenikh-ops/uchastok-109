// Сборка того же JSON, что делает кнопка «Проект → JSON» в приложении:
// всё проектное решение без кода. Нужен, чтобы обновить уже установленную
// копию, не пересылая архив целиком.
import * as D from './js/design.js';
import fs from 'fs';

const KEYS = ['SITE', 'LEVELS', 'WALLS', 'STEPS', 'HOUSE', 'CARPORT', 'UTILITY',
  'DRIVE', 'BBQ', 'BASE_PAVING', 'BASE_STEPPING', 'BEDS', 'PLANTING',
  'LIGHTS', 'IRRIGATION', 'DRAINAGE', 'FENCE', 'CONCEPTS', 'VIEWS'];

const out = { format: 'landshaft-109', version: 1, saved: new Date().toISOString() };
for (const k of KEYS) if (D[k] !== undefined) out[k] = D[k];

fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log('разделов: ' + KEYS.filter((k) => D[k] !== undefined).length);
console.log('лестницы: ' + JSON.stringify(out.STEPS));
const p15 = (out.BASE_PAVING || []).find((p) => p.id === 'П-15');
console.log('сход П-15: ' + JSON.stringify(p15 && p15.poly));
