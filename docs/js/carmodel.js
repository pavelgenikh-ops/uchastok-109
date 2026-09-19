// ============================================================================
//  Подстановка готовой 3D-модели автомобиля.
//  Положите файл модели в models/car.glb — приложение подхватит его вместо
//  процедурной модели. Модель автоматически масштабируется под габарит
//  4485 × 1800 × 1615 и ставится колёсами на отметку площадки.
//  Пока файла нет — используется процедурная модель из car.js.
// ============================================================================
import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { DRACOLoader } from '../lib/DRACOLoader.js';

const TARGET = { len: 4.485, wid: 1.80, hgt: 1.615 };
let template = null;          // загруженная модель-образец
let state = 'idle';           // idle | loading | ready | absent
const listeners = [];

/** нормализация: центрируем, ставим на «землю», масштабируем по длине */
function normalize(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  // длинная горизонтальная ось модели — вдоль неё и есть длина кузова
  const alongX = size.x >= size.z;
  const k = TARGET.len / (alongX ? size.x : size.z);
  const wrap = new THREE.Group();
  obj.position.sub(center);
  obj.position.y += size.y / 2;              // низ модели в ноль
  obj.scale.multiplyScalar(k);
  obj.position.multiplyScalar(k);
  if (!alongX) obj.rotation.y = Math.PI / 2; // разворачиваем капотом по X
  obj.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  wrap.add(obj);
  wrap.name = 'Автомобиль (модель)';
  return wrap;
}

/** перекраска кузова: самый крупный непрозрачный материал считаем краской */
function repaint(root, color) {
  let best = null, bestArea = 0;
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    o.geometry.computeBoundingBox();
    const s = o.geometry.boundingBox.getSize(new THREE.Vector3());
    const area = s.x * s.y + s.y * s.z + s.x * s.z;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && !m.transparent && area > bestArea) { bestArea = area; best = o; }
  });
  if (!best) return;
  const src = Array.isArray(best.material) ? best.material[0] : best.material;
  const m = src.clone();
  m.color = new THREE.Color(color);
  if ('metalness' in m) m.metalness = 0.65;
  if ('roughness' in m) m.roughness = 0.22;
  best.material = m;
}

export function initCarModel(onReady) {
  if (onReady) {
    if (state === 'ready') { onReady(true); return; }
    if (state === 'absent') { onReady(false); return; }
    listeners.push(onReady);
  }
  if (state !== 'idle') return;
  state = 'loading';
  const loader = new GLTFLoader();
  // модели часто сжаты Draco — подключаем локальный декодер
  const draco = new DRACOLoader();
  draco.setDecoderPath('./lib/draco/');
  loader.setDRACOLoader(draco);
  loader.load('./models/car.glb',
    (gltf) => {
      template = normalize(gltf.scene);
      state = 'ready';
      listeners.splice(0).forEach(f => f(true));
    },
    undefined,
    () => {
      state = 'absent';
      listeners.splice(0).forEach(f => f(false));
    });
}

/** копия модели нужного цвета; null — если файла нет и работает процедурная */
export function loadCarModel(color) {
  if (state === 'idle') initCarModel();
  if (state !== 'ready' || !template) return null;
  const clone = template.clone(true);
  repaint(clone, color);
  return clone;
}

export const carModelState = () => state;
