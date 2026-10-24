// Световой меч и искры столкновения клинков для боя с Ильёй. Только геометрия и анимация (без DOM и состояния):
// где лежит меч и когда он загорается, решает flow/lightsaber.js. Клинки светятся материалом glow(),
// отдельных источников света и теней у них нет.
import * as THREE from 'three';
import { mat, glow, box, cyl, group } from './lowpoly.js';

const HILT_LEN = 0.26;
const BLADE_LEN = 0.95;
const IGNITE_TIME = 0.25; // с — клинок вырастает / втягивается
// Наклон внутреннего пивота: клинок (ось +Y) ложится вдоль +Z. На столе это горизонталь, в руке —
// перпендикуляр к предплечью, поэтому при жесте guard клинок смотрит вверх-вперёд
const LAY_TILT = Math.PI / 2;
const HOLD_TILT = Math.PI / 2 - 0.2;
const SPARKS = 10;
const SPARK_LIFE = 0.35; // с

// Меч цвета color. Начало координат — у кисти (центр рукояти): по соглашению setHeld hang отрицательный,
// чтобы рукоять легла в ладонь, а клинок продолжил руку
export function buildLightsaber(color) {
  const tilt = new THREE.Group();
  tilt.add(cyl(0.03, 0.03, HILT_LEN, 8, '#b8bcc4', 0, -HILT_LEN / 2, 0));
  for (const y of [-0.08, -0.04, 0, 0.04]) tilt.add(cyl(0.034, 0.034, 0.018, 8, '#2a2d33', 0, y, 0)); // грипы
  tilt.add(cyl(0.04, 0.032, 0.05, 8, '#d7dadf', 0, HILT_LEN / 2, 0)); // эмиттер
  tilt.add(box(0.02, 0.03, 0.02, '#c0392b', 0, 0.06, 0.03));          // кнопка

  // Клинок растёт по scale.y от эмиттера: яркая сердцевина и полупрозрачное сияние вокруг
  const blade = group(
    cyl(0.03, 0.03, BLADE_LEN, 6, null, 0, 0, 0, glow(color, 1.6)),
    cyl(0.065, 0.065, BLADE_LEN + 0.03, 6, null, 0, -0.015, 0, mat(color, {
      emissive: color, emissiveIntensity: 1.2, transparent: true, opacity: 0.35, depthWrite: false,
    })),
  );
  blade.traverse((m) => { m.castShadow = false; m.receiveShadow = false; });
  blade.position.y = HILT_LEN / 2 + 0.05;
  blade.scale.y = 0.001;
  blade.visible = false;
  tilt.add(blade);

  const root = group(tilt);
  let power = 0;  // 0 — погашен, 1 — клинок целиком
  let target = 0;
  root.userData.hang = -0.065;
  root.userData.setIgnited = (on) => { target = on ? 1 : 0; };
  root.userData.update = (dt) => {
    if (power === target) return;
    const step = dt / IGNITE_TIME;
    power = target > power ? Math.min(target, power + step) : Math.max(target, power - step);
    blade.visible = power > 0;
    blade.scale.y = Math.max(0.001, power);
  };
  root.userData.layFlat = () => { tilt.rotation.x = LAY_TILT; };
  root.userData.holdPose = () => { tilt.rotation.x = HOLD_TILT; };
  root.userData.layFlat();
  return root;
}

// Искры при столкновении клинков: пул мелких октаэдров, разлетаются и гаснут за SPARK_LIFE.
// Пока искр нет, все меши скрыты и не рисуются
export function createSaberClash() {
  const root = new THREE.Group();
  const geometry = new THREE.OctahedronGeometry(0.03);
  const sparks = Array.from({ length: SPARKS }, (_, i) => {
    const mesh = new THREE.Mesh(geometry, glow(i % 2 ? '#9be7ff' : '#ffffff', 2));
    mesh.castShadow = false;
    mesh.visible = false;
    root.add(mesh);
    return { mesh, velocity: new THREE.Vector3(), life: 0 };
  });

  return {
    group: root,
    burst(x, y, z) {
      for (const s of sparks) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 1.5;
        s.velocity.set(Math.cos(angle) * speed, 0.5 + Math.random() * 2, Math.sin(angle) * speed);
        s.mesh.position.set(x, y, z);
        s.mesh.visible = true;
        s.life = SPARK_LIFE;
      }
    },
    update(dt) {
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt;
        if (s.life <= 0) { s.mesh.visible = false; continue; }
        s.velocity.y -= 9 * dt;
        s.mesh.position.addScaledVector(s.velocity, dt);
        s.mesh.scale.setScalar(s.life / SPARK_LIFE);
      }
    },
  };
}
