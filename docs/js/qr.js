// ============================================================================
//  QR на текущий адрес приложения.
//  Открыл на компьютере, нажал «QR» — отсканировал телефоном, смотришь там же.
//  Работает и для локального адреса в домашней сети, и для адреса на GitHub Pages.
// ============================================================================
import { push as navPush, pop as navPop } from './nav.js';

/** локальный адрес в домашней сети вместо localhost — его поймёт телефон */
function lanHint() {
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') {
    return 'localhost телефон не откроет. Запустите сервер и введите в адрес IP компьютера '
         + 'в домашней сети (например 192.168.1.50:' + (location.port || 80) + '), '
         + 'или опубликуйте на GitHub Pages.';
  }
  return '';
}

export function showQR() {
  const url = location.href.split('#')[0];
  const back = document.createElement('div');
  back.className = 'noteModal';
  const hint = lanHint();
  back.innerHTML =
    '<div class="box" style="text-align:center">' +
      '<h4>Открыть на телефоне<span class="cl">✕</span></h4>' +
      '<div class="qrBox"></div>' +
      '<div class="meta" style="margin:10px 0 0;word-break:break-all">' + url + '</div>' +
      (hint ? '<div class="meta" style="color:#d98346;margin-top:8px">' + hint + '</div>' : '') +
    '</div>';
  document.body.appendChild(back);
  const close = () => { back.remove(); navPop('qr'); };
  navPush('qr', () => back.remove());
  back.querySelector('.cl').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };

  const box = back.querySelector('.qrBox');
  try {
    const qr = window.qrcode(0, 'M');      // 0 = автоподбор версии
    qr.addData(url);
    qr.make();
    box.innerHTML = qr.createImgTag(6, 10);
    const img = box.querySelector('img');
    if (img) { img.style.background = '#fff'; img.style.borderRadius = '8px'; }
  } catch (e) {
    box.innerHTML = '<div class="meta">Не удалось построить QR: ' + e.message + '</div>';
  }
}
