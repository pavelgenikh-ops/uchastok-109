// ============================================================================
//  Интерфейс: слои, спецификация, карандаш, экспорт PDF
// ============================================================================
import * as THREE from 'three';

let CTX = null;

const LAYER_DEF = [
  { grp: 'Основа' },
  { k: 'terrain', n: 'Рельеф (подстилающая поверхность)' },
  { k: 'lawn', n: 'Газон' },
  { grp: 'Благоустройство' },
  { k: 'paving', n: 'Покрытия и бортовой камень' },
  { k: 'stepping', n: 'Шаговые дорожки' },
  { k: 'walls', n: 'Подпорные стенки и ступени' },
  { k: 'beds', n: 'Цветники' },
  { k: 'fence', n: 'Ограждение и въездная группа' },
  { grp: 'Сооружения' },
  { k: 'house', n: 'Жилой дом' },
  { k: 'carport', n: 'Навес, парковка, автомобили' },
  { k: 'utility', n: 'ЛОС и колодцы' },
  { k: 'bbq', n: 'Зона барбекю, пергола, мебель' },
  { grp: 'Озеленение' },
  { k: 'existing', n: 'Существующие насаждения на участке' },
  { k: 'planting', n: 'Проектные посадки' },
  { grp: 'Инженерия' },
  { k: 'lights', n: 'Наружное освещение' },
];

export function initUI(ctx) {
  CTX = ctx;
  buildLayerPanel();
  buildViewBar();
  buildConceptBar();
  wireButtons();
  initPen();
}

// ---------------------------------------------------------------------------
//  Варианты дизайна
// ---------------------------------------------------------------------------
function buildConceptBar() {
  const host = document.getElementById('concepts');
  if (!host || !CTX.concepts) return;
  host.innerHTML = '';
  const cur = CTX.getConcept();
  for (const [id, c] of Object.entries(CTX.concepts)) {
    const b = document.createElement('button');
    b.className = 'btn' + (id === cur ? ' acc2 on' : '');
    b.textContent = c.name.split('—')[0].trim();
    b.title = c.name;
    b.onclick = () => {
      [...host.children].forEach(x => { x.className = 'btn'; });
      b.className = 'btn acc2 on';
      CTX.setConcept(id);
      showConceptNote(id);
      setTimeout(buildLayerPanel, 160);
    };
    host.appendChild(b);
  }
  showConceptNote(cur);
}
function showConceptNote(id) {
  const el = document.getElementById('conceptNote');
  const c = CTX.concepts[id];
  if (!el || !c) return;
  el.innerHTML = `<b>${c.name}</b>${c.note}`;
}

// ---------------------------------------------------------------------------
function buildLayerPanel() {
  const box = document.getElementById('layBody');
  box.innerHTML = '';
  for (const it of LAYER_DEF) {
    if (it.grp) {
      const d = document.createElement('div');
      d.className = 'grp'; d.textContent = it.grp;
      box.appendChild(d); continue;
    }
    const lab = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = true;
    cb.onchange = () => { const g = CTX.layers[it.k]; if (g) g.visible = cb.checked; };
    lab.appendChild(cb);
    lab.appendChild(Object.assign(document.createElement('span'), { textContent: it.n }));
    const g = CTX.layers[it.k];
    const cnt = g?.userData?.count;
    if (cnt != null) {
      const c = document.createElement('span');
      c.className = 'cnt';
      c.textContent = typeof cnt === 'object'
        ? Object.values(cnt).reduce((a, b) => a + b, 0) + ' шт' : cnt + ' шт';
      lab.appendChild(c);
    }
    box.appendChild(lab);
  }
}

function buildViewBar() {
  const bar = document.getElementById('views');
  bar.innerHTML = '';
  CTX.views.forEach((v, i) => {
    const b = document.createElement('button');
    b.className = 'btn' + (i === 0 ? ' on' : '');
    b.textContent = v.name;
    b.onclick = () => {
      [...bar.children].forEach(c => c.classList.remove('on'));
      b.classList.add('on');
      CTX.setView(v.id);
    };
    bar.appendChild(b);
  });
}

function wireButtons() {
  const tog = (id, panel) => {
    document.getElementById(id).onclick = (e) => {
      const p = document.getElementById(panel);
      p.classList.toggle('open');
      e.currentTarget.classList.toggle('on', p.classList.contains('open'));
    };
  };
  tog('bLayers', 'layers');
  tog('bSpec', 'spec');
  document.querySelectorAll('[data-close]').forEach(x => {
    x.onclick = () => {
      const p = document.getElementById(x.dataset.close);
      p.classList.remove('open');
      document.getElementById(x.dataset.close === 'spec' ? 'bSpec' : 'bLayers').classList.remove('on');
    };
  });
  const bSun = document.getElementById('bSun');
  bSun.onclick = () => {
    const ev = CTX.toggleSun();
    bSun.textContent = ev ? 'День' : 'Вечер';
    bSun.classList.toggle('on', ev);
  };
  const bR = document.getElementById('bRelief');
  bR.onclick = () => {
    const m = CTX.toggleRelief();
    bR.textContent = m === 'design' ? 'Рельеф: проектный' : 'Рельеф: существующий';
    bR.classList.toggle('on', m === 'exist');
    setTimeout(buildLayerPanel, 120);
  };
  const bG = document.getElementById('bGreen');
  if (bG) bG.onclick = () => {
    const on = CTX.toggleGreen();
    bG.textContent = on ? 'Скрыть деревья' : 'Показать деревья';
    bG.classList.toggle('on', !on);
  };
  const bL = document.getElementById('bLabels');
  bL.onclick = () => bL.classList.toggle('on', CTX.toggleLabels());
  const bE = document.getElementById('bElev');
  if (bE && CTX.toggleElev) bE.onclick = () => bE.classList.toggle('on', CTX.toggleElev());
  const bD = document.getElementById('bDims');
  if (bD && CTX.toggleDims) bD.onclick = () => bD.classList.toggle('on', CTX.toggleDims());
  document.getElementById('bPdf').onclick = exportPDF;
}

export function setStat(pairs) {
  document.getElementById('stat').innerHTML = pairs
    .map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('');
}

// ---------------------------------------------------------------------------
//  Спецификация
// ---------------------------------------------------------------------------
let LAST_SPEC = null;
export function renderSpec(spec) {
  LAST_SPEC = spec;
  const b = document.getElementById('specBody');
  const t = spec.totals;
  const COL = { 'Покрытия': '#c9a227', 'Газон': '#7fb069', 'Цветники': '#b06fb0', 'Застройка': '#7a8794' };
  let html = `<div class="sum">
    <div><b>${t.area}</b><span>площадь участка, м²</span></div>
    <div><b>${t.built}</b><span>застройка, м²</span></div>
    <div><b>${t.paving}</b><span>покрытия, м²</span></div>
    <div><b>${t.lawn}</b><span>газон, м²</span></div>
    <div><b>${t.plants}</b><span>проектных растений, шт</span></div>
    <div><b>${t.exTrees}</b><span>сохраняемых деревьев</span></div>
  </div>
  <div class="bal">`;
  const sum = Object.values(t.balance).reduce((a, x) => a + x, 0);
  for (const [k, v] of Object.entries(t.balance)) {
    html += `<div class="row"><span style="width:76px">${k}</span>
      <span class="bar"><i style="width:${(v / sum * 100).toFixed(1)}%;background:${COL[k]}"></i></span>
      <span class="pv">${(v / sum * 100).toFixed(1)}%</span></div>`;
  }
  html += '</div>';

  for (const s of spec.sections) {
    html += `<div class="sec"><h4><span class="n">${s.id}</span>${s.name}<span class="ch">▾</span></h4><table>`;
    for (const [nm, un, vl] of s.rows) {
      html += `<tr><td>${nm}</td><td class="u">${un}</td><td class="v">${vl == null ? '—' : fmt(vl)}</td></tr>`;
    }
    html += '</table></div>';
  }
  b.innerHTML = html;
  b.querySelectorAll('.sec > h4').forEach(h => {
    h.onclick = () => {
      const s = h.parentElement;
      s.classList.toggle('closed');
      h.querySelector('.ch').textContent = s.classList.contains('closed') ? '▸' : '▾';
    };
  });
}
const fmt = (v) => typeof v === 'number'
  ? v.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) : v;

// ---------------------------------------------------------------------------
//  Карандаш
// ---------------------------------------------------------------------------
const strokes = [];
let penColor = '#e53935', penW = 3, drawing = false, cur = null;

function initPen() {
  const cv = document.getElementById('draw');
  cv.width = innerWidth; cv.height = innerHeight;
  const g = cv.getContext('2d');

  const bPen = document.getElementById('bPen');
  bPen.onclick = () => {
    const on = cv.classList.toggle('on');
    bPen.classList.toggle('on', on);
    document.getElementById('pen').classList.toggle('on', on);
  };
  document.querySelectorAll('#pen .sw').forEach(s => {
    s.onclick = () => {
      document.querySelectorAll('#pen .sw').forEach(x => x.classList.remove('on'));
      s.classList.add('on'); penColor = s.dataset.c;
    };
  });
  document.getElementById('penW').oninput = (e) => penW = +e.target.value;
  document.getElementById('penUndo').onclick = () => { strokes.pop(); redraw(); };
  document.getElementById('penClear').onclick = () => { strokes.length = 0; redraw(); };

  cv.addEventListener('pointerdown', e => {
    drawing = true;
    cur = { c: penColor, w: penW, p: [[e.clientX, e.clientY]] };
    strokes.push(cur);
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (!drawing) return;
    cur.p.push([e.clientX, e.clientY]);
    redraw();
  });
  const stop = () => { drawing = false; cur = null; };
  cv.addEventListener('pointerup', stop);
  cv.addEventListener('pointerleave', stop);

  function redraw() {
    g.clearRect(0, 0, cv.width, cv.height);
    g.lineCap = g.lineJoin = 'round';
    for (const s of strokes) {
      g.strokeStyle = s.c; g.lineWidth = s.w;
      g.beginPath();
      s.p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
      g.stroke();
    }
  }
  initPen.redraw = redraw;
  window.__penRedraw = redraw;
}

// ---------------------------------------------------------------------------
//  Экспорт PDF — альбом визуализаций + спецификация
// ---------------------------------------------------------------------------
async function exportPDF() {
  const btn = document.getElementById('bPdf');
  const old = btn.textContent;
  btn.textContent = 'Готовим…'; btn.disabled = true;
  await new Promise(r => setTimeout(r, 30));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const PW = 420, PH = 297, m = 12;

  // кириллический шрифт — подгружаем только при экспорте
  try {
    const { ROBOTO_B64 } = await import('../lib/font-roboto.js');
    doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_B64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto', 'normal');
  } catch (e) { console.warn('шрифт не подгрузился, кириллица может не отобразиться', e); }

  const { renderer, scene, camera, views, setView } = CTX;
  const savePos = camera.position.clone();
  const saveTgt = renderer.__ctrlTarget || null;

  // --- страница 1: текущий вид + рукописные пометки ---
  const shot = grabWithPen(renderer);
  page1(doc, shot);

  // --- страницы с ракурсами ---
  const keyViews = views.filter(v => ['iso', 'entry', 'carport', 'terrace', 'top'].includes(v.id));
  for (const v of keyViews) {
    const c = CTX.uvh(v.cam), t = CTX.uvh(v.tgt);
    camera.position.copy(c);
    camera.lookAt(t);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const img = renderer.domElement.toDataURL('image/jpeg', 0.92);
    doc.addPage();
    imgPage(doc, img, v.name);
  }
  camera.position.copy(savePos);

  // --- спецификация ---
  specPages(doc);

  const stamp = new Date().toISOString().slice(0, 10);
  const fname = `Благоустройство_уч109_${stamp}.pdf`;
  doc.save(fname);
  // дублируем в папку проекта — надёжнее, чем полагаться на загрузки браузера
  try {
    const r = await fetch('/_save?name=' + encodeURIComponent(fname),
      { method: 'POST', body: doc.output('blob') });
    const j = await r.json();
    if (j.ok) toast('PDF сохранён: ' + j.file.split('\\').slice(-2).join('\\'));
  } catch (e) { /* сервер мог быть открыт как файл — не критично */ }
  btn.textContent = old; btn.disabled = false;
  // вернуть текущий вид
  renderer.render(scene, camera);

  function page1(doc, img) {
    doc.setFillColor(16, 18, 21); doc.rect(0, 0, PW, PH, 'F');
    doc.addImage(img, 'JPEG', m, m + 16, PW - m * 2, PH - m * 2 - 30, undefined, 'FAST');
    doc.setTextColor(232, 234, 237);
    doc.setFontSize(15); doc.text('ПРОЕКТ БЛАГОУСТРОЙСТВА И ОЗЕЛЕНЕНИЯ', m, m + 9);
    doc.setFontSize(9); doc.setTextColor(154, 163, 175);
    doc.text('СНТ «Мадио Озерки», участок № 109, кад. 47:07:0518004:14 · Ленинградская обл., Всеволожский р-н, массив Токсово',
      m, PH - m - 5);
    doc.text(new Date().toLocaleDateString('ru-RU'), PW - m, PH - m - 5, { align: 'right' });
  }
  function imgPage(doc, img, title) {
    doc.setFillColor(16, 18, 21); doc.rect(0, 0, PW, PH, 'F');
    doc.addImage(img, 'JPEG', m, m + 12, PW - m * 2, PH - m * 2 - 22, undefined, 'FAST');
    doc.setTextColor(232, 234, 237); doc.setFontSize(12);
    doc.text(title, m, m + 8);
    doc.setFontSize(8); doc.setTextColor(154, 163, 175);
    doc.text('СНТ «Мадио Озерки», уч. 109', PW - m, PH - m - 3, { align: 'right' });
  }
  function specPages(doc) {
    const S = LAST_SPEC;
    let y = 0;
    const newPage = () => {
      doc.addPage(); doc.setFillColor(255, 255, 255); doc.rect(0, 0, PW, PH, 'F');
      doc.setTextColor(30, 30, 30); doc.setFontSize(13);
      doc.text('ВЕДОМОСТЬ ОБЪЁМОВ РАБОТ И МАТЕРИАЛОВ', m, 16);
      doc.setFontSize(8); doc.setTextColor(110, 110, 110);
      doc.text('СНТ «Мадио Озерки», уч. 109 · объёмы рассчитаны по геометрии проекта', m, 21);
      y = 30;
    };
    newPage();
    const colX = [m, PW / 2 - 40, PW / 2 - 14];
    for (const s of S.sections) {
      if (y > PH - 30) newPage();
      doc.setFillColor(238, 241, 236); doc.rect(m, y - 4.5, PW / 2 - m, 7, 'F');
      doc.setTextColor(30, 40, 25); doc.setFontSize(9.5);
      doc.text(`${s.id}. ${s.name}`, m + 2, y);
      y += 7;
      doc.setFontSize(8); doc.setTextColor(40, 40, 40);
      for (const [nm, un, vl] of s.rows) {
        if (y > PH - 14) { newPage(); }
        const lines = doc.splitTextToSize(nm, PW / 2 - 76);
        doc.text(lines, colX[0] + 2, y);
        doc.setTextColor(120, 120, 120);
        doc.text(un, colX[1], y, { align: 'right' });
        doc.setTextColor(20, 20, 20);
        doc.text(vl == null ? '—' : fmt(vl), colX[2] + 18, y, { align: 'right' });
        doc.setTextColor(40, 40, 40);
        doc.setDrawColor(228, 228, 228);
        y += lines.length * 3.6 + 1.2;
        doc.line(m, y - 2.4, PW / 2 - 14 + 18, y - 2.4);
      }
      y += 4;
    }
  }
}

/** короткое уведомление внизу экрана */
function toast(text, ms = 5000) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:40;' +
      'background:#1d2a18;border:1px solid #3d5a30;color:#cfe6c0;padding:9px 14px;border-radius:8px;' +
      'font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,.45);max-width:70vw';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.style.display = 'none', ms);
}

/** снимок сцены вместе со слоем карандаша */
function grabWithPen(renderer) {
  const base = renderer.domElement;
  const pen = document.getElementById('draw');
  const c = document.createElement('canvas');
  c.width = base.width; c.height = base.height;
  const g = c.getContext('2d');
  g.drawImage(base, 0, 0);
  g.drawImage(pen, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.94);
}
