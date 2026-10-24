// Коллекционная книга, лежащая плашмя. Только геометрия и попадание луча (без DOM и состояния):
// позицию задают spots в world/office.js, подбор — flow/collectibles.js. Без свечения и анимации — книгу ищут глазами.
import * as THREE from 'three';
import { box } from './lowpoly.js';

const W = 0.24;     // ширина обложки (вдоль x)
const D = 0.17;     // глубина обложки (вдоль z)
const PAGES = 0.04; // толщина блока страниц
const BOARD = 0.006;

// Начало координат — центр нижней обложки на поверхности; корешок — со стороны −x.
// color — обложка, accent — корешок (по умолчанию как обложка)
export function buildCollectibleBook({ color, accent }) {
  const group = new THREE.Group();
  group.add(box(W, BOARD, D, color, 0, 0, 0));                         // нижняя обложка
  group.add(box(W - 0.02, PAGES, D - 0.012, '#f4f1ea', 0.006, BOARD, 0)); // блок страниц
  group.add(box(W, BOARD, D, color, 0, BOARD + PAGES, 0));             // верхняя обложка
  group.add(box(0.012, PAGES + BOARD * 2, D, accent ?? color, -W / 2, 0, 0)); // корешок

  // Невидимый хит-бокс крупнее книги, чтобы по ней можно было попасть пальцем.
  // Raycaster (three r169) видимость не проверяет — только слои
  const hitBox = box(0.5, 0.3, 0.5, '#ffffff', 0, 0, 0);
  hitBox.visible = false;
  hitBox.castShadow = false;
  hitBox.receiveShadow = false;
  group.add(hitBox);

  const raycaster = new THREE.Raycaster();
  return {
    group,
    // ndc — точка экрана (-1..1, y вверх): попал ли луч из камеры в книгу
    hitTest(ndc, camera) {
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObject(group, true).length > 0;
    },
  };
}
