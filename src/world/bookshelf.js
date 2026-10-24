// Книжный шкаф open-space — Полка с Базой знаний. Только геометрия и попадание луча (без DOM и состояния):
// позицию и коллайдер задаёт world/office.js, открытие Базы знаний — flow/knowledge.js.
import * as THREE from 'three';
import { box } from './lowpoly.js';

const BOOK_COLORS = ['#ef476f', '#118ab2', '#ffd166', '#06d6a0', '#8338ec'];

// Начало координат — центр основания шкафа; лицевая сторона смотрит в +z
export function buildBookshelf() {
  const group = new THREE.Group();
  group.add(box(1.6, 1.8, 0.4, '#6b4f36', 0, 0, 0)); // корпус
  for (let k = 0; k < 4; k++) {
    group.add(box(1.5, 0.04, 0.38, '#5a412c', 0, 0.4 + k * 0.45, 0.05));
    for (let b = 0; b < 5; b++) {
      group.add(box(0.2, 0.32, 0.26, BOOK_COLORS[(b + k) % 5], -0.55 + b * 0.27, 0.44 + k * 0.45, 0.1));
    }
  }

  const raycaster = new THREE.Raycaster();
  return {
    group,
    // ndc — точка экрана (-1..1, y вверх): попал ли луч из камеры в шкаф
    hitTest(ndc, camera) {
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObject(group, true).length > 0;
    },
  };
}
