// Игрок: движение относительно камеры, столкновения со стенами и мебелью,
// камера от третьего лица за спиной персонажа.
import * as THREE from 'three';
import { createCharacter } from './characters.js';

const RADIUS = 0.35;
const WALK = 3.6;
const RUN = 6.2;
const CAM_DIST = 4.2;
const CAM_HEIGHT = 1.9;
const LOOK_HEIGHT = 1.45;

export const PLAYER_STYLE = {
  skin: '#f3cfae',
  shirt: '#2e9e5b',      // фирменная зелёная толстовка стажёра
  pants: '#3a4a6b',
  shoes: '#f4f1ea',
  hair: '#2a1c14',
  hairStyle: 'parted',
  accent: '#ffd166',     // жёлтый рюкзак
  accent2: '#c99a2e',
  accessories: ['hood', 'backpack', 'badge'],
};

// Выталкивание круга из прямоугольников
function resolveCollisions(pos, colliders) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      const cx = Math.max(c.x0, Math.min(pos.x, c.x1));
      const cz = Math.max(c.z0, Math.min(pos.z, c.z1));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= RADIUS * RADIUS) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * RADIUS;
        pos.z = cz + (dz / d) * RADIUS;
      } else {
        // центр внутри прямоугольника — выталкиваем по кратчайшей оси
        const opts = [
          [pos.x - c.x0 + RADIUS, -1, 0], [c.x1 - pos.x + RADIUS, 1, 0],
          [pos.z - c.z0 + RADIUS, 0, -1], [c.z1 - pos.z + RADIUS, 0, 1],
        ].sort((a, b) => a[0] - b[0]);
        pos.x += opts[0][1] * opts[0][0];
        pos.z += opts[0][2] * opts[0][0];
      }
    }
  }
}

export function createPlayer(scene, camera, { colliders, occluders }) {
  const model = createCharacter(PLAYER_STYLE);
  scene.add(model);

  const pos = new THREE.Vector3();
  let heading = 0;      // куда смотрит персонаж (0 → +z)
  let yaw = Math.PI;    // угол камеры вокруг игрока
  let pitch = 0.28;
  let speed = 0;
  const camPos = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const tmp = new THREE.Vector3();
  const target = new THREE.Vector3();
  const side = new THREE.Vector3();
  const origin = new THREE.Vector3();

  function place(x, z, face = 0) {
    pos.set(x, 0, z);
    heading = face;
    yaw = face + Math.PI;
    model.position.copy(pos);
    model.rotation.y = heading;
    computeCamera(1);
  }

  function computeCamera(lerp) {
    target.set(pos.x, LOOK_HEIGHT, pos.z);
    const horizontal = Math.cos(pitch) * CAM_DIST;
    const desired = tmp.set(
      pos.x + Math.sin(yaw) * horizontal,
      CAM_HEIGHT + Math.sin(pitch) * CAM_DIST,
      pos.z + Math.cos(yaw) * horizontal,
    );
    // Не даём камере уйти за стену: три параллельных луча, чтобы не «проскальзывать» мимо углов
    const dir = desired.clone().sub(target);
    const len = dir.length();
    dir.normalize();
    side.set(-dir.z, 0, dir.x).normalize().multiplyScalar(0.3);
    raycaster.far = len;
    let free = len;
    for (const k of [0, 1, -1]) {
      raycaster.set(origin.copy(target).addScaledVector(side, k), dir);
      const hit = raycaster.intersectObjects(occluders, false)[0];
      if (hit) free = Math.min(free, hit.distance);
    }
    if (free < len) desired.copy(target).addScaledVector(dir, Math.max(0.6, free - 0.25));
    camPos.lerp(desired, lerp);
    camera.position.copy(camPos);
    camera.lookAt(target);
  }

  function update(dt, input, time) {
    const look = input.consumeLook();
    const sens = input.state.isTouch ? 0.006 : 0.0045;
    yaw -= look.x * sens;
    pitch = THREE.MathUtils.clamp(pitch + look.y * sens * 0.6, -0.15, 0.9);

    const { move, run } = input.state;
    const amount = Math.hypot(move.x, move.y);
    // Направления относительно камеры
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = -fz;
    const rz = fx;
    const targetSpeed = amount > 0.05 ? (run ? RUN : WALK) * Math.min(1, amount) : 0;
    speed += (targetSpeed - speed) * (1 - Math.exp(-dt * 10));

    if (amount > 0.05) {
      const mx = fx * move.y + rx * move.x;
      const mz = fz * move.y + rz * move.x;
      const ml = Math.hypot(mx, mz);
      pos.x += (mx / ml) * speed * dt;
      pos.z += (mz / ml) * speed * dt;
      const wanted = Math.atan2(mx, mz);
      let diff = wanted - heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      heading += diff * (1 - Math.exp(-dt * 12));

      // Камера плавно возвращается за спину, если игрок давно не крутил её сам
      const sinceLook = performance.now() - input.state.lastLookTime;
      if (sinceLook > 1500 && move.y > 0.2) {
        let cd = heading + Math.PI - yaw;
        cd = Math.atan2(Math.sin(cd), Math.cos(cd));
        yaw += cd * (1 - Math.exp(-dt * 1.6 * move.y));
      }
    }
    resolveCollisions(pos, colliders);

    model.position.copy(pos);
    model.rotation.y = heading;
    model.userData.animate(dt, speed, time);
    computeCamera(1 - Math.exp(-dt * 10));
  }

  return {
    model,
    position: pos,
    place,
    update,
    get heading() { return heading; },
  };
}
