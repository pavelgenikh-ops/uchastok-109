// ============================================================================
//  СПЕЦИФИКАЦИЯ — объёмы считаются по фактической геометрии проекта,
//  а не задаются вручную. Любое изменение design.js пересчитывает объёмы.
// ============================================================================
import {
  SITE, LEVELS, WALLS, STEPS, HOUSE, CARPORT, UTILITY,
  PAVING, STEPPING, BEDS, PLANTING, LIGHTS, IRRIGATION, DRAINAGE, FENCE, BBQ,
} from './design.js';
import { uv2xy, xy2uv, groundZ, groundZuv, terrain, inPoly, polyArea, polyPerim, stairSpan, SITE_DATA } from './geo.js';
import { treeKeeper } from './build.js';

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

/** полигон из (u,v) → реальная площадь на местности, м² */
function areaUV(polyUV) {
  return polyArea(polyUV.map(([u, v]) => uv2xy(u, v)));
}
function perimUV(polyUV, close = true) {
  return polyPerim(polyUV.map(([u, v]) => uv2xy(u, v)), close);
}
/** длина трассы «обход ближайшего соседа» от заданной точки — оценка кабеля/трубы */
function routeLen(ptsUV, startUV) {
  if (!ptsUV.length) return 0;
  const pts = ptsUV.map(([u, v]) => uv2xy(u, v));
  let cur = uv2xy(startUV[0], startUV[1]);
  const left = pts.slice();
  let L = 0;
  while (left.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = Math.hypot(left[i][0] - cur[0], left[i][1] - cur[1]);
      if (d < bd) { bd = d; bi = i; }
    }
    L += bd; cur = left[bi]; left.splice(bi, 1);
  }
  return L;
}

// конструкции покрытий (пироги оснований)
const PIE = {
  pave:   { dig: 0.45, gravel: 0.25, sand: 0.05, name: 'брусчатка 60 мм по щебёночному основанию (проездная)' },
  stone:  { dig: 0.32, gravel: 0.15, sand: 0.05, name: 'плита тротуарная 400×400 по щебню (пешеходная)' },
  slab:   { dig: 0.32, gravel: 0.15, sand: 0.05, name: 'плита 600×400 по щебню' },
  deck:   { dig: 0.20, gravel: 0.12, sand: 0.00, name: 'террасная доска по лагам на регулируемых опорах' },
  gravel: { dig: 0.22, gravel: 0.15, sand: 0.00, name: 'отсыпка гранитной крошкой по геотекстилю' },
};

export function computeSpec(mode = 'design') {
  const S = { sections: [], totals: {} };

  // ---------- 1. ЗЕМЛЯНЫЕ РАБОТЫ И ВЕРТИКАЛЬНАЯ ПЛАНИРОВКА ----------
  const t = terrain;
  const cell = t.step * t.step;
  let cut = 0, fill = 0, cells = 0;
  const B = SITE_DATA.boundary;
  for (let j = 0; j < t.ny; j++) {
    for (let i = 0; i < t.nx; i++) {
      const x = t.x0 + i * t.step, y = t.y0 + j * t.step;
      if (!inPoly(x, y, B)) continue;
      const d = t.design[j * t.nx + i] - t.exist[j * t.nx + i];
      if (d > 0) fill += d * cell; else cut += -d * cell;
      cells++;
    }
  }
  const siteArea = SITE.area;
  S.sections.push({
    id: 1, name: 'Земляные работы и вертикальная планировка',
    rows: [
      ['Площадь участка по исполнительной съёмке', 'м²', r1(siteArea)],
      ['Перепад отметок в границах участка', 'м', 5.46],
      ['Снятие растительного грунта h=0,15 м с буртованием', 'м³', r1(siteArea * 0.15 * 0.75)],
      ['Разработка грунта (выемка) при террасировании', 'м³', r1(cut)],
      ['Насыпь с послойным уплотнением', 'м³', r1(fill)],
      ['Вывоз излишков грунта', 'м³', r1(Math.max(0, cut - fill) * 1.2)],
      ['Завоз грунта при недостатке (дефицит баланса)', 'м³', r1(Math.max(0, fill - cut) * 1.2)],
      ['Планировка поверхности механизированная', 'м²', r1(siteArea)],
    ],
  });

  // ---------- 2. ПОКРЫТИЯ ----------
  const pav = { byKind: {}, curb: 0, total: 0 };
  for (const p of PAVING) {
    const a = areaUV(p.poly);
    pav.byKind[p.kind] = (pav.byKind[p.kind] || 0) + a;
    pav.total += a;
    if (p.edge) pav.curb += perimUV(p.poly);
  }
  // шаговые плиты
  let stepN = 0, stepLen = 0;
  for (const s of STEPPING) {
    const L = perimUV(s.path, false);
    stepLen += L;
    stepN += Math.floor((L - 0.2) / 0.78) + 1;
  }
  const stepArea = stepN * 0.6 * 0.4;

  const pavRows = [];
  const kindTitle = { pave: 'Брусчатка вибропрессованная 200×100×60 (проезд, парковка)',
                      stone: 'Плита тротуарная 400×400×50 (дорожки у дома)',
                      deck: 'Террасная доска ДПК (патио зоны отдыха)',
                      gravel: 'Отсыпка гранитной крошкой фр. 5–20 (хозплощадка)' };
  let digV = 0, gravV = 0, sandV = 0, geo = 0;
  for (const [k, a] of Object.entries(pav.byKind)) {
    pavRows.push([kindTitle[k] || k, 'м²', r1(a)]);
    const pie = PIE[k] || PIE.stone;
    digV += a * pie.dig; gravV += a * pie.gravel; sandV += a * pie.sand; geo += a;
  }
  pavRows.push(['Плиты шаговые 600×400×50 по газону', 'шт', stepN]);
  pavRows.push(['То же, площадь мощения', 'м²', r1(stepArea)]);
  digV += stepArea * 0.25; gravV += stepArea * 0.12; sandV += stepArea * 0.05; geo += stepArea;
  pavRows.push(['Камень бортовой садовый 500×200×80', 'м.п.', r1(pav.curb)]);
  pavRows.push(['Основание: щебень фр. 20–40 с уплотнением', 'м³', r1(gravV)]);
  pavRows.push(['Основание: песок / ЦПС подстилающий', 'м³', r1(sandV)]);
  pavRows.push(['Геотекстиль дорнит 200 г/м²', 'м²', r1(geo * 1.1)]);
  pavRows.push(['Корыто под покрытия (разработка грунта)', 'м³', r1(digV)]);
  S.sections.push({ id: 2, name: 'Покрытия, основания и бортовой камень', rows: pavRows });

  // ---------- 3. ПОДПОРНЫЕ СТЕНКИ И ЛЕСТНИЦЫ ----------
  let wLen = 0, wFace = 0;
  for (const w of WALLS) {
    const [x0, y0] = uv2xy(w.u, w.v[0]), [x1, y1] = uv2xy(w.u, w.v[1]);
    const L = Math.hypot(x1 - x0, y1 - y0);
    // средняя высота — по фактическому перепаду проектного рельефа
    let hSum = 0, n = 0;
    for (let v = w.v[0]; v <= w.v[1]; v += 1) {
      const zT = groundZuv(w.u + 0.35, v, mode), zB = groundZuv(w.u - 0.55, v, mode);
      hSum += Math.max(0.25, zT - zB + 0.20); n++;
    }
    const hAvg = hSum / Math.max(1, n);
    wLen += L; wFace += L * hAvg;
  }
  //  число ступеней считает geo.js по фактическому перепаду — здесь только суммируем
  const stepsTotal = STEPS.reduce((s, x) => s + stairSpan(x).n, 0);
  const stepsW = STEPS.reduce((s, x) => s + stairSpan(x).n * x.w, 0);
  S.sections.push({
    id: 3, name: 'Подпорные стенки, лестницы',
    rows: [
      ['Подпорная стенка ПС-1 (между въездной и домовой террасами)', 'м.п.',
        r1(Math.hypot(...(() => { const a = uv2xy(WALLS[0].u, WALLS[0].v[0]), b = uv2xy(WALLS[0].u, WALLS[0].v[1]); return [b[0] - a[0], b[1] - a[1]]; })()))],
      ['Подпорная стенка ПС-2 (между домовой и садовой террасами)', 'м.п.',
        r1(Math.hypot(...(() => { const a = uv2xy(WALLS[1].u, WALLS[1].v[0]), b = uv2xy(WALLS[1].u, WALLS[1].v[1]); return [b[0] - a[0], b[1] - a[1]]; })()))],
      ['Площадь лицевой поверхности стенок', 'м²', r1(wFace)],
      ['Бетон В20 фундамента стенок (ленты 0,4×0,5)', 'м³', r1(wLen * 0.4 * 0.5)],
      ['Облицовка натуральным камнем / габион', 'м²', r1(wFace * 1.08)],
      ['Плита накрывная 460×70', 'м.п.', r1(wLen)],
      ['Дренаж застенный (труба 110 + щебень)', 'м.п.', r1(wLen)],
      ['Ступени садовые (блок 340×140)', 'шт', stepsTotal],
      ['То же, погонаж', 'м.п.', r1(stepsW)],
    ],
  });

  // ---------- 4. ОЗЕЛЕНЕНИЕ ----------
  const bedArea = BEDS.reduce((s, b) => s + areaUV(b.poly), 0);
  const bedPerim = BEDS.reduce((s, b) => s + perimUV(b.poly), 0);
  const builtUp = (HOUSE.warm.u[1] - HOUSE.warm.u[0]) * (HOUSE.warm.v[1] - HOUSE.warm.v[0])
    + (HOUSE.terrW.u[1] - HOUSE.terrW.u[0]) * (HOUSE.terrW.v[1] - HOUSE.terrW.v[0])
    + (HOUSE.terrS.u[1] - HOUSE.terrS.u[0]) * (HOUSE.terrS.v[1] - HOUSE.terrS.v[0])
    + (CARPORT.u[1] - CARPORT.u[0]) * (CARPORT.v[1] - CARPORT.v[0])
;
  const lawn = siteArea - builtUp - pav.total - bedArea;

  const plantRows = [['Газон посевной (мятлик/овсяница), с подготовкой основания', 'м²', r1(lawn)]];
  plantRows.push(['Цветники и миксбордеры — площадь', 'м²', r1(bedArea)]);
  plantRows.push(['Бордюрная лента цветников', 'м.п.', r1(bedPerim)]);
  let plantTotal = 0;
  for (const p of PLANTING) { plantRows.push([p.sp, 'шт', p.pts.length]); plantTotal += p.pts.length; }
  // существующие насаждения строго в границах участка
  const onSite = SITE_DATA.trees.filter(t => inPoly(t.x, t.y, SITE_DATA.boundary));
  const keep = treeKeeper();
  const kept = onSite.filter(keep), cutTrees = onSite.filter(t => !keep(t));
  const cc = (arr) => arr.reduce((a, t) => (a[t.cls] = (a[t.cls] || 0) + 1, a), {});
  const ex = cc(kept), exCut = cc(cutTrees);
  plantRows.push(['Итого проектных посадок', 'шт', plantTotal]);
  plantRows.push(['Сохраняемые существующие деревья (хвойные)', 'шт', ex.conifer || 0]);
  plantRows.push(['Сохраняемые существующие деревья (лиственные)', 'шт', ex.decid || 0]);
  plantRows.push(['Сохраняемый подлесок и кустарник', 'шт', ex.shrub || 0]);
  plantRows.push(['Вырубка в пятнах застройки и покрытий (деревья)', 'шт',
    (exCut.conifer || 0) + (exCut.decid || 0)]);
  plantRows.push(['То же, корчёвка подлеска', 'шт', exCut.shrub || 0]);
  plantRows.push(['Защита сохраняемых стволов на период работ', 'шт',
    (ex.conifer || 0) + (ex.decid || 0)]);
  plantRows.push(['Мульча — кора сосновая, h=0,05 м', 'м³', r1(bedArea * 0.05)]);
  plantRows.push(['Плодородный грунт в цветники, h=0,35 м', 'м³', r1(bedArea * 0.35)]);
  plantRows.push(['Плодородный грунт под газон, h=0,20 м', 'м³', r1(lawn * 0.20)]);
  S.sections.push({ id: 4, name: 'Озеленение', rows: plantRows });

  // ---------- 5. НАРУЖНОЕ ОСВЕЩЕНИЕ ----------
  const panel = [33.0, 7.0];   // условный щит у хозблока
  const allLights = [...LIGHTS.bollard.pts, ...LIGHTS.post.pts, ...LIGHTS.facade.pts, ...LIGHTS.spot.pts];
  const cable = routeLen(allLights, panel) * 1.15 + 12;
  S.sections.push({
    id: 5, name: 'Наружное освещение',
    rows: [
      [LIGHTS.bollard.name, 'шт', LIGHTS.bollard.pts.length],
      [LIGHTS.post.name, 'шт', LIGHTS.post.pts.length],
      [LIGHTS.facade.name, 'шт', LIGHTS.facade.pts.length],
      [LIGHTS.spot.name, 'шт', LIGHTS.spot.pts.length],
      ['Итого светильников', 'шт', allLights.length],
      ['Кабель ВВГнг-LS 3×1,5 в гофре ПНД, в траншее', 'м.п.', r1(cable)],
      ['Траншея под кабель 0,4×0,7 м', 'м.п.', r1(cable * 0.85)],
      ['Щит уличного освещения с реле времени и УЗО', 'компл.', 1],
      ['Расчётная мощность линии освещения', 'Вт',
        r1(LIGHTS.bollard.pts.length * 7 + LIGHTS.post.pts.length * 18
          + LIGHTS.facade.pts.length * 12 + LIGHTS.spot.pts.length * 9)],
    ],
  });

  // ---------- 6. АВТОПОЛИВ ----------
  const irr = [...IRRIGATION.rotor.pts, ...IRRIGATION.spray.pts];
  const pipe = routeLen(irr, [34.0, 8.0]) * 1.2 + 15;
  S.sections.push({
    id: 6, name: 'Автоматический полив',
    rows: [
      [IRRIGATION.rotor.name, 'шт', IRRIGATION.rotor.pts.length],
      [IRRIGATION.spray.name, 'шт', IRRIGATION.spray.pts.length],
      ['Труба ПНД 32/25 мм магистральная и разводящая', 'м.п.', r1(pipe)],
      ['Капельная линия в цветники', 'м.п.', r1(bedArea * 0.9)],
      ['Клапан электромагнитный 1"', 'шт', 6],
      ['Короб клапанный', 'шт', 3],
      ['Контроллер полива 6 зон + датчик дождя', 'компл.', 1],
      ['Траншея под трубу 0,3×0,4 м', 'м.п.', r1(pipe)],
    ],
  });

  // ---------- 7. ЛИВНЕВАЯ КАНАЛИЗАЦИЯ И ДРЕНАЖ ----------
  let drLen = 0;
  const drRows = [];
  for (const d of DRAINAGE) {
    const L = perimUV(d.path, d.id === 'Д-4');
    drLen += L;
    drRows.push([`${d.id} ${d.name}`, 'м.п.', r1(L)]);
  }
  drRows.push(['Лоток водоотводный бетонный DN100 с решёткой', 'м.п.',
    r1(perimUV(DRAINAGE[0].path, false) + perimUV(DRAINAGE[1].path, false) + perimUV(DRAINAGE[2].path, false))]);
  drRows.push(['Труба дренажная гофр. DN110 в геотекстиле', 'м.п.',
    r1(perimUV(DRAINAGE[3].path, true) + perimUV(DRAINAGE[4].path, false))]);
  drRows.push(['Колодец дренажный смотровой DN315', 'шт', 5]);
  drRows.push(['Колодец дренажный поглотительный DN700', 'шт', 1]);
  drRows.push(['Пескоуловитель', 'шт', 3]);
  drRows.push(['Щебень фр. 20–40 в обсыпку дрен', 'м³', r1(drLen * 0.18)]);
  drRows.push(['Итого протяжённость лотков и дрен', 'м.п.', r1(drLen)]);
  S.sections.push({ id: 7, name: 'Ливневая канализация и дренаж', rows: drRows });

  // ---------- 8. СООРУЖЕНИЯ И МАФ ----------
  const cpA = (CARPORT.u[1] - CARPORT.u[0]) * (CARPORT.v[1] - CARPORT.v[0]);
  const shA = CARPORT.rotated
    ? (CARPORT.store.u[1] - CARPORT.store.u[0]) * (CARPORT.v[1] - CARPORT.v[0])
    : (CARPORT.u[1] - CARPORT.u[0]) * (CARPORT.store.v[1] - CARPORT.store.v[0]);
  const stA = shA;
  S.sections.push({
    id: 8, name: 'Сооружения и малые архитектурные формы',
    rows: [
      ['Навес-парковка на 2 м/м: стальной каркас, кровля плоская', 'м²', r1(cpA)],
      ['То же — хозпостройка, встроенная в объём навеса', 'м²', r1(shA)],
      ['Отделка навеса: рейка лиственница/термо, антрацит RAL 7016', 'м²', r1((7.0 + 6.8) * 2 * 2.9 * 0.55)],
      ['Ворота секционные кладовой 2300×2150', 'шт', 1],
      ['Свайное основание навеса (буронабивные d300)', 'шт', 6],
      
      ['Патио зоны барбекю с очагом (террасный настил)', 'м²', r1(areaUV(BBQ.patio.poly))],
      ['Пергола-навес над обеденной зоной ' + (BBQ.pergola.u[1]-BBQ.pergola.u[0]).toFixed(1) + '×' + (BBQ.pergola.v[1]-BBQ.pergola.v[0]).toFixed(1), 'компл.', 1],
      ['Барбекю-комплекс: мангал с порталом, гриль, столешница, дровница', 'компл.', 1],
      ['Обеденная группа на 8 персон', 'компл.', 1],
      ['Лаунж-кресла', 'шт', BBQ.lounge.length],
      ['Гирлянда ретро-ламп над патио', 'м.п.', 12],
      ['Очаг-кострище d1200 с бортом из камня', 'шт', 1],
      ['Скамья садовая', 'шт', 3],
      ['ЛОС (станция биологической очистки) — установка', 'компл.', 1],
    ],
  });

  // ---------- 9. ОГРАЖДЕНИЕ ----------
  const fLen = SITE.perim - FENCE.gate.w - FENCE.wicket.w;
  S.sections.push({
    id: 9, name: 'Ограждение и въездная группа',
    rows: [
      ['Ограждение: штакетник металлический вертикальный, RAL 7004 серый, h=1,8 м', 'м.п.', r1(fLen)],
      ['Столб стальной 110×110 на бетонном основании', 'шт', Math.round(fLen / 2.5)],
      ['Штакетина 100×20, шаг 135 мм', 'шт', Math.round(fLen / 0.135)],
      ['Лага стальная 40×20, 2 ряда', 'м.п.', r1(fLen * 2)],
      ['Цоколь ограждения бетонный h=0,30 м', 'м.п.', r1(fLen)],
      [FENCE.gate.name + ' с электроприводом', 'компл.', 1],
      [FENCE.wicket.name + ' с электромеханическим замком', 'компл.', 1],
      ['Видеодомофон и вызывная панель', 'компл.', 1],
    ],
  });

  // ---------- СВОДКА ----------
  S.totals = {
    area: r1(siteArea),
    paving: r1(pav.total + stepArea),
    lawn: r1(lawn),
    beds: r1(bedArea),
    built: r1(builtUp),
    cut: r1(cut), fill: r1(fill),
    plants: plantTotal,
    exTrees: (ex.conifer || 0) + (ex.decid || 0),
    lights: allLights.length,
    cable: r1(cable),
    walls: r1(wLen),
    drain: r1(drLen),
    balance: {
      'Покрытия': r1(pav.total + stepArea),
      'Газон': r1(lawn),
      'Цветники': r1(bedArea),
      'Застройка': r1(builtUp),
    },
  };
  return S;
}
