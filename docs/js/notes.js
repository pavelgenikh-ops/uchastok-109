// ============================================================================
//  ЗАМЕЧАНИЯ ПО МОДЕЛИ
//  На телефоне: долгое нажатие пальцем по участку → метка и окно ввода текста.
//  На компьютере: правый клик или Shift+клик.
//  Каждое замечание хранит координаты (u,v), отметку и ракурс камеры — поэтому
//  к нему можно вернуться одним касанием, а выгрузка даёт точную привязку
//  к месту, а не «где-то у дорожки».
//  Хранится в localStorage: закрыл вкладку — замечания остались.
// ============================================================================
import * as THREE from '../lib/three.module.js';

const KEY = 'landshaft109.notes.v1';
let CTX = null;              // { scene, camera, controls, renderer, xy2uv }
let notes = [];
const markers = new THREE.Group();
markers.name = 'Замечания';

export function initNotes(ctx) {
  CTX = ctx;
  notes = load();
  CTX.scene.add(markers);
  rebuild();
  bindInput();
  renderList();
}

// ---------------------------------------------------------------------------
//  хранение
// ---------------------------------------------------------------------------
function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (e) { /* приватный режим */ }
  renderList();
}

// ---------------------------------------------------------------------------
//  метки в сцене
// ---------------------------------------------------------------------------
function markerSprite(n, done) {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
  g.fillStyle = done ? 'rgba(90,140,80,.95)' : 'rgba(217,60,48,.95)';
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = (n > 99 ? '700 52px ' : '700 64px ') + 'Segoe UI, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), s / 2, s / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(1.1, 1.1, 1);
  sp.renderOrder = 1200;
  return sp;
}

function rebuild() {
  while (markers.children.length) {
    const m = markers.children.pop();
    m.material.map.dispose();
    m.material.dispose();
  }
  notes.forEach((nt, i) => {
    const sp = markerSprite(i + 1, nt.done);
    sp.position.set(nt.p[0], nt.p[1] + 0.9, nt.p[2]);
    sp.userData.noteId = nt.id;
    markers.add(sp);
  });
}

// ---------------------------------------------------------------------------
//  постановка замечания
// ---------------------------------------------------------------------------
const ray = new THREE.Raycaster();
const pt = new THREE.Vector2();

function pickPoint(clientX, clientY) {
  pt.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(pt, CTX.camera);
  const hits = ray.intersectObjects(CTX.scene.children, true).filter((h) => {
    let o = h.object;
    while (o) {
      if (!o.visible || o === markers) return false;
      o = o.parent;
    }
    return true;
  });
  return hits.length ? hits[0] : null;
}

export function addNoteAt(clientX, clientY) {
  const hit = pickPoint(clientX, clientY);
  if (!hit) return null;
  const p = hit.point;
  const [u, v] = CTX.xy2uv(p.x, -p.z);
  let obj = hit.object, name = '';
  while (obj) {
    if (obj.name) { name = obj.name; break; }
    obj = obj.parent;
  }
  const note = {
    id: 'n' + Date.now().toString(36),
    p: [p.x, p.y, p.z],
    u: +u.toFixed(2),
    v: +v.toFixed(2),
    z: +p.y.toFixed(2),
    place: name.slice(0, 60),
    text: '',
    done: false,
    created: new Date().toISOString(),
    cam: [CTX.camera.position.x, CTX.camera.position.y, CTX.camera.position.z],
    tgt: [CTX.controls.target.x, CTX.controls.target.y, CTX.controls.target.z],
  };
  notes.push(note);
  save();
  rebuild();
  openEditor(note.id);
  return note;
}

// ---------------------------------------------------------------------------
//  ввод: долгое нажатие на телефоне, правый клик / Shift+клик на компьютере
// ---------------------------------------------------------------------------
function bindInput() {
  const el = CTX.renderer.domElement;
  let timer = null, sx = 0, sy = 0, moved = false;

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && !(e.button === 2 || e.shiftKey)) return;
    sx = e.clientX;
    sy = e.clientY;
    moved = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (moved) return;
      try { if (navigator.vibrate) navigator.vibrate(30); } catch (err) { /* браузер может запретить */ }
      addNoteAt(sx, sy);
    }, e.pointerType === 'mouse' ? 0 : 550);
  });
  el.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > 12) {
      moved = true;
      clearTimeout(timer);
    }
  });
  el.addEventListener('pointerup', () => clearTimeout(timer));
  el.addEventListener('pointercancel', () => clearTimeout(timer));
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  // короткий тап по самой метке — открыть её
  el.addEventListener('click', (e) => {
    pt.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(pt, CTX.camera);
    const h = ray.intersectObjects(markers.children, false);
    if (h.length && h[0].object.userData.noteId) openEditor(h[0].object.userData.noteId);
  });
}

// ---------------------------------------------------------------------------
//  окно ввода текста
// ---------------------------------------------------------------------------
function openEditor(id) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  const idx = notes.indexOf(note) + 1;
  const back = document.createElement('div');
  back.className = 'noteModal';
  back.innerHTML =
    '<div class="box">' +
      '<h4>Замечание №' + idx + '<span class="cl">✕</span></h4>' +
      '<div class="meta">' + escapeHtml(note.place || 'точка на участке') +
        ' · отм. ' + note.z.toFixed(2) + ' · u ' + note.u + ' / v ' + note.v + '</div>' +
      '<textarea placeholder="Что здесь не так и что нужно сделать">' + escapeHtml(note.text || '') + '</textarea>' +
      '<div class="row">' +
        '<label><input type="checkbox"' + (note.done ? ' checked' : '') + '> выполнено</label>' +
        '<button class="btn del">Удалить</button>' +
        '<button class="btn ok">Сохранить</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(back);
  const ta = back.querySelector('textarea');
  setTimeout(() => ta.focus(), 50);
  const close = () => back.remove();
  back.querySelector('.cl').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };
  back.querySelector('.del').onclick = () => {
    notes = notes.filter((n) => n.id !== id);
    save(); rebuild(); close();
  };
  back.querySelector('.ok').onclick = () => {
    note.text = ta.value.trim();
    note.done = back.querySelector('input[type=checkbox]').checked;
    save(); rebuild(); close();
  };
}

// ---------------------------------------------------------------------------
//  список в панели
// ---------------------------------------------------------------------------
function renderList() {
  const btn = document.getElementById('bNotes');
  if (btn) btn.textContent = notes.length ? 'Замечания (' + notes.length + ')' : 'Замечания';
  const box = document.getElementById('noteList');
  if (!box) return;
  if (!notes.length) {
    box.innerHTML = '<div class="empty">Замечаний пока нет.<br><br>' +
      'На телефоне: <b>нажмите и удерживайте</b> палец на нужном месте модели.<br>' +
      'На компьютере: <b>правый клик</b> или <b>Shift + клик</b>.</div>';
    return;
  }
  box.innerHTML = notes.map((n, i) =>
    '<div class="note' + (n.done ? ' done' : '') + '" data-id="' + n.id + '">' +
      '<b>' + (i + 1) + '</b>' +
      '<div class="t">' + (n.text ? escapeHtml(n.text) : '<i>без описания</i>') +
        '<span class="p">' + escapeHtml(n.place || '') + ' · отм. ' + n.z.toFixed(2) + '</span>' +
      '</div>' +
    '</div>').join('');
  box.querySelectorAll('.note').forEach((el) => {
    el.onclick = () => flyTo(el.dataset.id);
    el.ondblclick = () => openEditor(el.dataset.id);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** вернуться к ракурсу, с которого поставлено замечание */
export function flyTo(id) {
  const n = notes.find((x) => x.id === id);
  if (!n || !CTX) return;
  CTX.camera.position.set(n.cam[0], n.cam[1], n.cam[2]);
  CTX.controls.target.set(n.tgt[0], n.tgt[1], n.tgt[2]);
  CTX.controls.update();
}

// ---------------------------------------------------------------------------
//  выгрузка: текст + json, отдельно — снимки по каждому замечанию
// ---------------------------------------------------------------------------
function download(name, data, type) {
  const b = data instanceof Blob ? data : new Blob([data], { type: type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function exportNotes() {
  if (!notes.length) { alert('Замечаний пока нет'); return 0; }
  const d = new Date().toISOString().slice(0, 10);
  const rows = notes.map((n, i) =>
    '| ' + (i + 1) + ' | ' + (n.text || '—').replace(/\|/g, '/') + ' | ' +
    (n.place || '—') + ' | ' + n.z.toFixed(2) + ' | ' + n.u + ' / ' + n.v + ' | ' +
    (n.done ? 'выполнено' : 'к работе') + ' |');
  const md = [
    '# Замечания по модели — участок 109, СНТ «Мадио Озерки»',
    '',
    'Дата выгрузки: ' + new Date().toLocaleString('ru-RU'),
    'Всего замечаний: ' + notes.length,
    '',
    '| № | Замечание | Место | Отметка | Координаты (u,v) | Статус |',
    '|---|---|---|---|---|---|',
  ].concat(rows, [
    '',
    '---',
    '',
    'Координаты (u, v) — система участка: u вдоль длинной стороны, 0 у западной границы',
    'и 43,99 у восточной; v поперёк, 0 у южной границы и 25,06 у северной.',
    'Отметка абсолютная, ноль чистого пола 1 этажа — 82,95.',
  ]).join('\n');
  download('замечания-уч109-' + d + '.md', md, 'text/markdown;charset=utf-8');
  download('замечания-уч109-' + d + '.json',
    JSON.stringify({ format: 'landshaft-109-notes', version: 1, saved: new Date().toISOString(), notes: notes }, null, 1),
    'application/json');
  return notes.length;
}

/** снимок по каждому замечанию: камера встаёт на сохранённый ракурс */
export async function exportShots(onStep) {
  if (!notes.length) { alert('Замечаний пока нет'); return; }
  const keepP = CTX.camera.position.clone();
  const keepT = CTX.controls.target.clone();
  for (let i = 0; i < notes.length; i++) {
    flyTo(notes[i].id);
    await new Promise((r) => setTimeout(r, 200));
    CTX.renderer.render(CTX.scene, CTX.camera);
    const blob = await new Promise((r) => CTX.renderer.domElement.toBlob(r, 'image/png'));
    if (blob) download('замечание-' + String(i + 1).padStart(2, '0') + '.png', blob);
    if (onStep) onStep(i + 1, notes.length);
    await new Promise((r) => setTimeout(r, 150));
  }
  CTX.camera.position.copy(keepP);
  CTX.controls.target.copy(keepT);
  CTX.controls.update();
}

export function clearNotes() {
  if (!notes.length) return;
  if (!confirm('Удалить все замечания (' + notes.length + ')?')) return;
  notes = [];
  save();
  rebuild();
}

export function notesCount() { return notes.length; }
