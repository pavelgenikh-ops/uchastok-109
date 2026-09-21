// ============================================================================
//  ПЕРЕДАЧА ФАЙЛОВ С ТЕЛЕФОНА
//  На компьютере файл просто скачивается. На телефоне ссылка <a download>
//  молча проглатывается: файл либо не сохраняется, либо лежит там, где его
//  не найти и не отправить. Поэтому порядок такой:
//    1) системное «Поделиться» с самими файлами (Web Share API level 2) —
//       замечания уходят в мессенджер или почту одним движением;
//    2) если файлы поделить нельзя — «Поделиться» текстом;
//    3) если и этого нет — окно с текстом и кнопкой «Скопировать».
//  Скачивание остаётся запасным путём и основным на компьютере.
// ============================================================================

import { push as navPush, pop as navPop } from './nav.js';

const isTouch = () => matchMedia('(pointer: coarse)').matches || innerWidth < 860;

function toFile(item) {
  if (item.blob instanceof File) return item.blob;
  const blob = item.blob instanceof Blob ? item.blob : new Blob([item.blob], { type: item.type });
  return new File([blob], item.name, { type: item.type || blob.type || 'application/octet-stream' });
}

export function downloadFile(item) {
  const f = toFile(item);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(f);
  a.download = item.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/**
 * Отдать файлы пользователю самым подходящим способом.
 * items: [{ name, blob | строка, type }], text — что показать/отправить словами.
 * Возвращает 'share' | 'download' | 'text' — как именно ушло.
 */
export async function deliver(items, { title, text } = {}) {
  const files = items.map(toFile);

  // 1. поделиться файлами
  try {
    if (navigator.canShare && navigator.canShare({ files }) && navigator.share) {
      await navigator.share({ files, title: title || 'Замечания по модели', text: text || '' });
      return 'share';
    }
  } catch (e) {
    // пользователь закрыл системное окно — это не ошибка, дальше не сыплем файлами
    if (e && e.name === 'AbortError') return 'share';
  }

  // 2. поделиться текстом (файлы не поддерживаются — так бывает в части браузеров)
  if (text && isTouch()) {
    try {
      if (navigator.share) {
        await navigator.share({ title: title || 'Замечания по модели', text });
        return 'share';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'share';
    }
  }

  // 3. на компьютере — обычное скачивание
  if (!isTouch()) {
    items.forEach(downloadFile);
    return 'download';
  }

  // 4. телефон без share: показываем текст, его можно скопировать и вставить куда угодно
  showText(text || '', items);
  return 'text';
}

/** окно с текстом: скопировать в буфер или всё-таки попробовать скачать */
export function showText(text, items) {
  const back = document.createElement('div');
  back.className = 'noteModal';
  back.innerHTML =
    '<div class="box">' +
      '<h4>Замечания текстом<span class="cl">✕</span></h4>' +
      '<div class="meta">Браузер не умеет отправлять файлы. Скопируйте текст ' +
        'и вставьте в сообщение — этого достаточно, место каждого замечания указано.</div>' +
      '<textarea readonly style="height:220px"></textarea>' +
      '<div class="row">' +
        '<button class="btn dl">Всё-таки скачать</button>' +
        '<button class="btn ok">Скопировать</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(back);
  const ta = back.querySelector('textarea');
  ta.value = text;
  const close = () => { back.remove(); navPop('shareText'); };
  navPush('shareText', () => back.remove());
  back.querySelector('.cl').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };
  back.querySelector('.dl').onclick = () => { (items || []).forEach(downloadFile); close(); };
  back.querySelector('.ok').onclick = async () => {
    const b = back.querySelector('.ok');
    try {
      await navigator.clipboard.writeText(text);
      b.textContent = 'Скопировано';
    } catch (e) {
      ta.focus(); ta.select();
      b.textContent = 'Выделено — нажмите «Копировать»';
    }
    setTimeout(close, 1200);
  };
  return back;
}
