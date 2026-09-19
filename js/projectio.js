// ============================================================================
//  Перенос проекта между компьютерами.
//    export → выгружает всё проектное решение одним .json (без кода и моделей)
//    import → подставляет такой .json в работающее приложение и пересобирает сцену
//  Так обновление проекта не требует переустановки: кладём новый json — готово.
// ============================================================================
import * as D from './design.js';

const KEYS = ['SITE', 'LEVELS', 'WALLS', 'STEPS', 'HOUSE', 'CARPORT', 'UTILITY',
  'DRIVE', 'BBQ', 'BASE_PAVING', 'BASE_STEPPING', 'BEDS', 'PLANTING',
  'LIGHTS', 'IRRIGATION', 'DRAINAGE', 'FENCE', 'CONCEPTS', 'VIEWS'];

/** снимок текущего проектного решения */
export function exportProject() {
  const out = { format: 'landshaft-109', version: 1, saved: new Date().toISOString() };
  for (const k of KEYS) if (D[k] !== undefined) out[k] = D[k];
  return out;
}

export function downloadProject() {
  const data = JSON.stringify(exportProject(), null, 1);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `проект-109-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  // и копия рядом с приложением, чтобы не искать в загрузках
  fetch('/_save?name=' + encodeURIComponent(a.download), { method: 'POST', body: blob })
    .catch(() => {});
  return data.length;
}

/**
 * Подстановка данных из файла. Переписываем поля ВНУТРИ существующих объектов
 * и массивов — тогда модули, которые уже импортировали их по ссылке,
 * увидят новые значения без перезагрузки страницы.
 */
export function applyProject(json) {
  if (!json || json.format !== 'landshaft-109')
    throw new Error('Это не файл проекта участка 109');
  let changed = 0;
  for (const k of KEYS) {
    if (json[k] === undefined || D[k] === undefined) continue;
    const dst = D[k], src = json[k];
    if (Array.isArray(dst) && Array.isArray(src)) {
      dst.length = 0; dst.push(...src); changed++;
    } else if (dst && typeof dst === 'object') {
      for (const key of Object.keys(dst)) delete dst[key];
      Object.assign(dst, src); changed++;
    }
  }
  return changed;
}

/** кнопка «Загрузить проект» — выбор файла и применение */
export function pickProjectFile(onDone) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try {
      const n = applyProject(JSON.parse(await f.text()));
      onDone(null, `${f.name}: обновлено разделов — ${n}`);
    } catch (e) {
      onDone(e, e.message);
    }
  };
  inp.click();
}
