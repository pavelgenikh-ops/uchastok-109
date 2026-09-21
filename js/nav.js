// ============================================================================
//  КНОПКА «НАЗАД» НА ТЕЛЕФОНЕ
//  Каждое открытое окно (панель, модалка, режим отметок) регистрируется здесь
//  и кладёт запись в историю браузера. Тогда системная кнопка «назад» на
//  Android закрывает верхнее окно, а не выбрасывает из приложения — раньше
//  человек «проваливался» и заходил заново по ссылке.
//  Та же логика обслуживает экранную кнопку «←» и клавишу Esc.
// ============================================================================

const stack = [];        // [{ id, close }]
let guarded = false;     // висит ли наша запись в истории

function guard() {
  if (guarded) return;
  try { history.pushState({ ls: 1 }, ''); guarded = true; } catch (e) { /* file:// */ }
}

function release() {
  if (!guarded) return;
  guarded = false;
  try { history.back(); } catch (e) { /* ignore */ }
}

/** Зарегистрировать открытое окно. Возвращает функцию снятия регистрации. */
export function push(id, close) {
  const i = stack.findIndex((s) => s.id === id);
  if (i >= 0) stack.splice(i, 1);
  stack.push({ id, close });
  guard();
  update();
  return () => pop(id);
}

/** Снять регистрацию (окно закрылось само). */
export function pop(id) {
  const i = stack.findIndex((s) => s.id === id);
  if (i >= 0) stack.splice(i, 1);
  if (!stack.length) release();
  update();
}

/** Закрыть верхнее окно. Возвращает false, если закрывать нечего. */
export function back() {
  const top = stack.pop();
  update();
  if (!top) { release(); return false; }
  try { top.close(); } catch (e) { /* окно могло исчезнуть само */ }
  if (!stack.length) release();
  return true;
}

export function depth() { return stack.length; }

function update() {
  const b = document.getElementById('bBack');
  if (b) b.classList.toggle('show', stack.length > 0);
}

addEventListener('popstate', () => {
  // история уже ушла назад — нашей записи там больше нет
  guarded = false;
  if (stack.length) {
    const top = stack.pop();
    try { top.close(); } catch (e) { /* ignore */ }
    update();
    if (stack.length) guard();   // под ним есть ещё окно — держим защиту дальше
  }
});

/** Вешает экранную кнопку «←». */
export function initBackButton() {
  const b = document.getElementById('bBack');
  if (!b) return;
  b.addEventListener('click', () => back());
  update();
}

// ---------------------------------------------------------------------------
//  боковые панели: кнопка в шапке, крестик, системная «назад» — одно поведение
// ---------------------------------------------------------------------------
const panels = new Map();   // panelId -> { btn, el }

export function closePanel(panelId) {
  const p = panels.get(panelId);
  if (!p || !p.el.classList.contains('open')) return;
  p.el.classList.remove('open');
  if (p.btn) p.btn.classList.remove('on');
  pop(panelId);
}

export function openPanel(panelId) {
  const p = panels.get(panelId);
  if (!p || p.el.classList.contains('open')) return;
  // панели не наслаиваются: на телефоне они во весь экран
  panels.forEach((_, id) => { if (id !== panelId) closePanel(id); });
  p.el.classList.add('open');
  if (p.btn) p.btn.classList.add('on');
  push(panelId, () => {
    p.el.classList.remove('open');
    if (p.btn) p.btn.classList.remove('on');
  });
}

/** Связать кнопку шапки с панелью; крестик внутри панели тоже заработает. */
export function bindPanel(btnId, panelId) {
  const el = document.getElementById(panelId);
  if (!el) return;
  const btn = btnId ? document.getElementById(btnId) : null;
  panels.set(panelId, { btn, el });
  if (btn) btn.onclick = () => {
    if (el.classList.contains('open')) closePanel(panelId); else openPanel(panelId);
  };
  el.querySelectorAll('[data-close]').forEach((x) => { x.onclick = () => closePanel(panelId); });
}
