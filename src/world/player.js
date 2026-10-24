// Игрок: движение относительно камеры, столкновения со стенами и мебелью,
// камера от третьего лица за спиной персонажа, не выше потолка.
// Может сидеть (sit / stand) и замирать на время анимаций (setFrozen) — тогда движение заблокировано.
// Кинокамера показа (startShowcase / endShowcase) снимает игрока сбоку в полный рост, обзор при этом заблокирован.
import * as THREE from 'three';
import { createCharacter } from './characters.js';

const RADIUS = 0.35;
const WALK = 3.6;
const RUN = 6.2;
const CAM_DIST = 4.2;
const CAM_HEIGHT = 1.9;
const LOOK_HEIGHT = 1.45;
const CEIL_CLEARANCE = 0.4; // минимальный зазор между камерой и потолком
const PITCH_MIN = -0.15;
const PITCH_MAX = 0.65;
// Камера показа (startShowcase): персонаж 1.8 м целиком в кадре при fov 60 / 72
const SHOWCASE_DIST = 2.7;
const SHOWCASE_HEIGHT = 1.25;
const SHOWCASE_LOOK = 0.95;
const SHOWCASE_ANGLES = [1.15, -1.15, Math.PI / 2, -Math.PI / 2, 2.0, -2.0]; // от heading: сбоку-спереди → сбоку → сзади-сбоку
const SOFT_TIME = 1.2; // с — мягкий переход камеры в показ и обратно
const MOUSE_LOCK_SENS = 0.0025; // рад/px при захваченном курсоре: мышь двигается постоянно — мягче, чем перетаскивание

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

export function createPlayer(scene, camera, { colliders, occluders, ceilingHeight = Infinity }) {
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
  const camDir = new THREE.Vector3();
  const camMaxY = ceilingHeight - CEIL_CLEARANCE;
  let seat = null;     // { x, z, face, stand: { x, z } } — на чём сидит игрок
  let frozen = false;  // идёт анимация (например, кофе) — ходить нельзя
  // Кинокамера показа (например, кофе): камера сбоку, игрок в полный рост; обзор заблокирован
  let showcase = null; // { cam: Vector3, look: Vector3 }
  let softTime = 0;    // сколько ещё секунд камера едет мягко (переход в показ и обратно)
  const lookTarget = new THREE.Vector3(); // куда смотрит камера — сглаживается вместе с позицией

  function place(x, z, face = 0) {
    seat = null;
    frozen = false;
    showcase = null;
    softTime = 0;
    model.userData.setPose('stand');
    model.userData.setGesture(null);
    pos.set(x, 0, z);
    heading = face;
    yaw = face + Math.PI;
    model.position.copy(pos);
    model.rotation.y = heading;
    computeCamera(1);
  }

  // Свободное расстояние от from в сторону to (≤ |to − from|): три параллельных луча,
  // чтобы не «проскальзывать» мимо углов. dir получает нормализованное направление
  function freeDistance(from, to, dir) {
    dir.copy(to).sub(from);
    const len = dir.length();
    dir.normalize();
    side.set(-dir.z, 0, dir.x).normalize().multiplyScalar(0.3);
    raycaster.far = len;
    let free = len;
    for (const k of [0, 1, -1]) {
      raycaster.set(origin.copy(from).addScaledVector(side, k), dir);
      const hit = raycaster.intersectObjects(occluders, false)[0];
      if (hit) free = Math.min(free, hit.distance);
    }
    return { free, len };
  }

  function computeCamera(lerp) {
    if (showcase) {
      camPos.lerp(showcase.cam, lerp);
      lookTarget.lerp(showcase.look, lerp);
      camera.position.copy(camPos);
      camera.lookAt(lookTarget);
      return;
    }
    target.set(pos.x, LOOK_HEIGHT, pos.z);
    const horizontal = Math.cos(pitch) * CAM_DIST;
    const desired = tmp.set(
      pos.x + Math.sin(yaw) * horizontal,
      CAM_HEIGHT + Math.sin(pitch) * CAM_DIST,
      pos.z + Math.cos(yaw) * horizontal,
    );
    // Не даём камере уйти за стену
    const { free, len } = freeDistance(target, desired, camDir);
    if (free < len) desired.copy(target).addScaledVector(camDir, Math.max(0.6, free - 0.25));
    // Не даём камере упереться в потолок: сдвигаем её к игроку вдоль луча
    if (desired.y > camMaxY) {
      const k = (camMaxY - target.y) / (desired.y - target.y);
      desired.lerpVectors(target, desired, k);
    }
    camPos.lerp(desired, lerp);
    lookTarget.lerp(target, lerp);
    camera.position.copy(camPos);
    camera.lookAt(lookTarget);
  }

  // Камера показа: сбоку и чуть спереди (видно лицо и стаканчик), иначе просто сбоку или сзади-сбоку.
  // Берём первую сторону, где до стены не меньше SHOWCASE_DIST, иначе — самую свободную
  function startShowcase() {
    const look = new THREE.Vector3(pos.x, SHOWCASE_LOOK, pos.z);
    const dir = new THREE.Vector3();
    let best = null;
    for (const offset of SHOWCASE_ANGLES) {
      const a = heading + offset;
      const cam = new THREE.Vector3(pos.x + Math.sin(a) * SHOWCASE_DIST, SHOWCASE_HEIGHT, pos.z + Math.cos(a) * SHOWCASE_DIST);
      const { free, len } = freeDistance(look, cam, dir);
      if (free < len) cam.copy(look).addScaledVector(dir, Math.max(0.6, free - 0.25));
      if (!best || free > best.free + 1e-3) best = { cam, free };
      if (free >= len) break;
    }
    showcase = { cam: best.cam, look };
    softTime = SOFT_TIME;
  }

  // Камера возвращается на орбиту с прежними yaw / pitch — они во время показа не менялись
  function endShowcase() {
    if (!showcase) return;
    showcase = null;
    softTime = SOFT_TIME;
  }

  function update(dt, input, time) {
    const look = input.consumeLook();
    if (showcase) { look.x = 0; look.y = 0; } // во время показа камеру не крутят
    const sens = input.state.isTouch ? 0.006 : input.state.pointerLocked ? MOUSE_LOCK_SENS : 0.0045;
    yaw -= look.x * sens;
    pitch = THREE.MathUtils.clamp(pitch + look.y * sens * 0.6, PITCH_MIN, PITCH_MAX);

    const { move, run } = input.state;
    // Сидя или во время анимации стоим на месте, камера и анимация тела работают
    const amount = seat || frozen ? 0 : Math.hypot(move.x, move.y);
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
      if (sinceLook > 1500 && move.y > 0.2 && !showcase) {
        let cd = heading + Math.PI - yaw;
        cd = Math.atan2(Math.sin(cd), Math.cos(cd));
        yaw += cd * (1 - Math.exp(-dt * 1.6 * move.y));
      }
    }
    if (!seat) resolveCollisions(pos, colliders); // сиденье само в коллайдере — не выталкиваем

    model.position.copy(pos);
    model.rotation.y = heading;
    model.userData.animate(dt, speed, time);
    // Переход в показ и обратно мягче обычного следования
    softTime = Math.max(0, softTime - dt);
    computeCamera(1 - Math.exp(-dt * (showcase || softTime > 0 ? 4 : 10)));
  }

  // Предмет в правой руке (например, огнетушитель): начало координат предмета — его дно,
  // верх висит у кисти. null — убрать предмет из рук
  let held = null;
  function setHeld(object) {
    if (held === object) return;
    if (held) held.removeFromParent();
    held = object;
    if (!held) return;
    held.position.set(0, -0.71 - (held.userData.hang ?? 0.5), 0.06); // hang — насколько предмет свисает от кисти
    held.rotation.set(0, 0, 0);
    model.userData.parts.armR.add(held);
  }

  // Сесть: тело в центре сиденья лицом по seat.face, камера — за спиной
  function sit(target) {
    seat = target;
    showcase = null;
    pos.set(seat.x, 0, seat.z);
    heading = seat.face;
    yaw = seat.face + Math.PI;
    speed = 0;
    model.userData.setPose('lounge');
  }

  // Встать в точку seat.stand рядом с сиденьем
  function stand() {
    if (!seat) return;
    pos.set(seat.stand.x, 0, seat.stand.z);
    seat = null;
    model.userData.setPose('stand');
    resolveCollisions(pos, colliders);
  }

  // Повернуться лицом к точке (x, z)
  function face(x, z) {
    heading = Math.atan2(x - pos.x, z - pos.z);
  }

  return {
    model,
    position: pos,
    place,
    update,
    setHeld,
    sit,
    stand,
    face,
    setFrozen(value) { frozen = value; },
    startShowcase,
    endShowcase,
    get inShowcase() { return showcase !== null; },
    get seated() { return seat; },
    get heading() { return heading; },
    get yaw() { return yaw; },
    get pitch() { return pitch; },
  };
}
