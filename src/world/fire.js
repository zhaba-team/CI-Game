// Огонь на серверной стойке и огнетушитель: low-poly пламя с мерцанием, дым и пена при тушении.
// Собственных источников света нет — на мобильных это дорого; подсветку даёт serverLight из game.js.
import * as THREE from 'three';
import { mat, glow, box, cyl, ico } from './lowpoly.js';

const FLAME_COLORS = ['#ff5a1f', '#ff8c1a', '#ffc23d', '#ff6f2b', '#ffd95a'];
const FLAMES = 6;
const PUFFS = 4;
const FOAM = 7;
const EXTINGUISH_TIME = 1.0; // секунды: пламя сжимается, пена нарастает

// Огонь в точке (x, y, z) — y обычно верх стойки. Состояния: горит / потушен (дым и пена остаются).
export function createFire(x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const flames = [];
  for (let k = 0; k < FLAMES; k++) {
    const r = 0.13 + (k % 3) * 0.04;
    const h = r * 3.2;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), glow(FLAME_COLORS[k % FLAME_COLORS.length], 1.6));
    const a = (k / FLAMES) * Math.PI * 2;
    const d = k === 0 ? 0 : 0.24;
    flame.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d);
    flame.userData.phase = k * 1.7;
    flames.push(flame);
    group.add(flame);
  }

  const smokeMat = mat('#5d6168', { transparent: true, opacity: 0.6, depthWrite: false });
  const puffs = [];
  for (let k = 0; k < PUFFS; k++) {
    const puff = ico(0.2, null, 0, smokeMat);
    puff.castShadow = false;
    puffs.push(puff);
    group.add(puff);
  }

  const foam = [];
  for (let k = 0; k < FOAM; k++) {
    const blob = ico(0.12 + (k % 3) * 0.04, '#f4f6f8');
    const a = (k / FOAM) * Math.PI * 2;
    blob.position.set(Math.cos(a) * 0.28, 0.04 + (k % 2) * 0.08, Math.sin(a) * 0.28);
    blob.visible = false;
    foam.push(blob);
    group.add(blob);
  }

  let burning = true;
  let extinguishing = null; // { start, onDone } на время анимации тушения
  let flameLife = 1;

  const setBurning = (value) => {
    burning = value;
    extinguishing = null;
    flameLife = value ? 1 : 0;
    flames.forEach((f) => { f.visible = value; });
    foam.forEach((b) => { b.visible = !value; b.scale.setScalar(1); });
  };

  return {
    group,
    get burning() { return burning; },
    get busy() { return extinguishing !== null; },
    setBurning,
    // Анимация пены ~1 с, затем огонь гаснет и вызывается onDone
    extinguish(onDone) {
      if (!burning || extinguishing) return;
      extinguishing = { start: null, onDone };
      foam.forEach((b) => { b.visible = true; b.scale.setScalar(0.01); });
    },
    update(time) {
      if (extinguishing) {
        extinguishing.start ??= time;
        const p = Math.min(1, (time - extinguishing.start) / EXTINGUISH_TIME);
        flameLife = 1 - p;
        foam.forEach((b, k) => b.scale.setScalar(Math.max(0.01, Math.min(1, p * 1.6 - k * 0.06))));
        if (p >= 1) {
          const { onDone } = extinguishing;
          setBurning(false);
          onDone?.();
        }
      }
      if (flameLife > 0) {
        for (const f of flames) {
          const s = 0.8 + Math.sin(time * 9 + f.userData.phase) * 0.2;
          const sy = 0.85 + Math.sin(time * 13 + f.userData.phase * 2) * 0.3;
          f.scale.set(s * flameLife, sy * flameLife, s * flameLife);
          f.rotation.y = time * 2 + f.userData.phase;
        }
      }
      // Дым поднимается по кругу; после тушения — реже и бледнее (меньше клубы)
      const size = burning ? 1 : 0.6;
      puffs.forEach((puff, k) => {
        const t = (time * 0.35 + k / PUFFS) % 1;
        const a = time * 0.6 + k * 1.6;
        puff.position.set(Math.cos(a) * 0.25, 0.4 + t * 1.3, Math.sin(a) * 0.25);
        puff.scale.setScalar((0.5 + t * 1.4) * size);
      });
    },
  };
}

// Огнетушитель: начало координат — дно баллона. Один и тот же вид на стене и в руках игрока.
export function buildExtinguisher() {
  const g = new THREE.Group();
  g.add(cyl(0.09, 0.09, 0.42, 8, '#d62828', 0, 0, 0));
  g.add(cyl(0.092, 0.092, 0.1, 8, '#f2f2f2', 0, 0.16, 0)); // этикетка
  g.add(cyl(0.05, 0.075, 0.07, 8, '#1f1f1f', 0, 0.42, 0)); // горловина
  g.add(box(0.05, 0.05, 0.16, '#2b2b2b', 0, 0.49, 0.03));   // рукоять
  const hose = box(0.025, 0.32, 0.025, '#151515', 0.11, 0.12, 0);
  hose.rotation.z = 0.12;
  g.add(hose);
  g.add(cyl(0.02, 0.03, 0.08, 6, '#151515', 0.13, 0.05, 0)); // раструб
  return g;
}
