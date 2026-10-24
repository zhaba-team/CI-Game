// NPC с табличкой и значком над головой + маркеры на полу (активные квесты, выход из офиса).
// spot.sit — NPC сидит (на лавке у стола): не разворачивается к игроку целиком, только поворачивает голову.
// Стоящий NPC умеет ходить по точкам (walkTo / returnHome) — маршрут задаёт оркестратор, поиска пути нет.
// setStanding(true) поднимает сидящего NPC (например, для пинг-понга; переставлять — только place),
// setHeld(object) — предмет в правой руке, как у игрока.
import * as THREE from 'three';
import { createCharacter } from './characters.js';
import { mat, glow, textSprite } from './lowpoly.js';

const HEAD_TURN = 0.7; // насколько сидящий NPC поворачивает голову к игроку
const WALK_SPEED = 2.2; // м/с

function exclamation() {
  const g = new THREE.Group();
  const m = glow('#ffc93c', 0.9);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.36, 0.13), m);
  bar.position.y = 0.26;
  const dot = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), m);
  g.add(bar, dot);
  return g;
}

export function createNpc(def, spot) {
  const group = new THREE.Group();
  const model = createCharacter(def.style);
  group.add(model);
  group.position.set(spot.x, 0, spot.z);
  model.rotation.y = spot.face ?? 0;
  let seated = Boolean(spot.sit);
  if (seated) model.userData.setPose('sit');

  // Имя крупно, под ним должность — мельче и бледнее
  const nameLabel = textSprite(def.name, { height: 0.26, size: 40, maxWidth: 1.6 });
  const roleLabel = textSprite(def.role, { height: 0.2, size: 34, bg: 'rgba(18,53,36,0.6)', color: '#d6f5e2', maxWidth: 1.6 });
  group.add(nameLabel, roleLabel);

  const markers = {
    available: exclamation(),
    active: textSprite('…', { bg: 'rgba(90,90,90,0.85)', height: 0.34 }),
    done: textSprite('✓', { bg: 'rgba(46,158,91,0.95)', height: 0.34 }),
  };
  Object.values(markers).forEach((m) => { m.visible = false; group.add(m); });

  // Высота плашек и значков статуса зависит от позы: сидящий ниже
  let markerY = 0;
  const layoutLabels = () => {
    const top = (seated ? 1.85 : 2.15) * (def.style.height ?? 1);
    nameLabel.position.y = top + 0.38;
    roleLabel.position.y = top + 0.12;
    markerY = top + 0.8; // значки статуса — над плашкой с именем
    Object.values(markers).forEach((m) => { m.position.y = markerY; });
  };
  layoutLabels();

  const baseFace = spot.face ?? 0;
  const tmp = new THREE.Vector3();
  let restFace = baseFace; // куда смотрит стоящий NPC, когда игрок далеко
  let route = null;        // { points, face, onArrive } — идёт по точкам points
  let trail = [];          // точки последнего пути от своего места: returnHome проходит их в обратном порядке
  let held = null;         // предмет в руке (setHeld)

  const turnTo = (want, lerp) => {
    let diff = want - model.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    model.rotation.y += diff * lerp;
  };
  const go = (points, face, onArrive) => {
    if (spot.sit) throw new Error(`NPC «${def.id}» сидит и не может ходить (spot.sit)`);
    route = { points: points.map(({ x, z }) => ({ x, z })), face, onArrive };
  };

  // Шаг по маршруту; возвращает скорость для анимации ходьбы
  const walk = (dt) => {
    const target = route.points[0];
    const dx = target.x - group.position.x;
    const dz = target.z - group.position.z;
    const dist = Math.hypot(dx, dz);
    const step = WALK_SPEED * dt;
    turnTo(Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
    if (dist > step) {
      group.position.x += (dx / dist) * step;
      group.position.z += (dz / dist) * step;
      return WALK_SPEED;
    }
    group.position.x = target.x;
    group.position.z = target.z;
    route.points.shift();
    if (route.points.length > 0) return WALK_SPEED;
    const { face, onArrive } = route;
    route = null;
    restFace = face;
    onArrive?.();
    return 0;
  };

  return {
    def,
    group,
    position: group.position,
    get walking() { return route !== null; },
    setStatus(status) {
      for (const [k, m] of Object.entries(markers)) m.visible = k === status;
    },
    // Идти по точкам [{ x, z }] от своего места; по прибытии развернуться к face и вызвать onArrive
    walkTo(points, { face = restFace, onArrive } = {}) {
      trail = points.map(({ x, z }) => ({ x, z }));
      go(points, face, onArrive);
    },
    // Вернуться на своё место по тому же пути в обратном порядке
    returnHome({ onArrive } = {}) {
      go([...trail.slice(0, -1).reverse(), { x: spot.x, z: spot.z }], baseFace, onArrive);
      trail = [];
    },
    // Мгновенно поставить NPC (восстановление после перезагрузки); via — точки пути от своего места для returnHome
    place(x, z, face = baseFace, { via = [] } = {}) {
      route = null;
      group.position.set(x, 0, z);
      model.rotation.y = face;
      restFace = face;
      trail = [...via.map((p) => ({ x: p.x, z: p.z })), { x, z }];
    },
    // Встать / снова сесть; только для NPC со spot.sit, у стоящих — ничего не делает
    setStanding(on) {
      if (!spot.sit) return;
      seated = !on;
      model.userData.setPose(on ? 'stand' : 'sit');
      model.userData.parts.head.rotation.y = 0;
      layoutLabels();
    },
    // Предмет в правой руке (как player.setHeld): начало координат — дно предмета, hang — насколько
    // он свисает от кисти; рука при этом вытянута вперёд (жест 'hold'). null — убрать предмет
    setHeld(object) {
      if (held === object) return;
      if (held) held.removeFromParent();
      held = object;
      model.userData.setGesture(held ? 'hold' : null);
      if (!held) return;
      held.position.set(0, -0.71 - (held.userData.hang ?? 0.5), 0.06);
      held.rotation.set(0, 0, 0);
      model.userData.parts.armR.add(held);
    },
    update(dt, time, playerPos) {
      markers.available.position.y = markerY - 0.05 + Math.sin(time * 3) * 0.08;
      markers.available.rotation.y = time * 2;
      // Пока идёт — смотрит по ходу движения, к игроку не поворачивается
      if (route) {
        model.userData.animate(dt, walk(dt), time + group.position.x);
        return;
      }
      // Поворачиваемся к игроку, когда он рядом; сидящий — только головой
      tmp.copy(playerPos).sub(group.position);
      const near = tmp.lengthSq() < 16;
      const want = near ? Math.atan2(tmp.x, tmp.z) : restFace;
      const lerp = 1 - Math.exp(-dt * 5);
      if (seated) {
        const { head } = model.userData.parts;
        let look = want - baseFace;
        look = THREE.MathUtils.clamp(Math.atan2(Math.sin(look), Math.cos(look)), -HEAD_TURN, HEAD_TURN);
        head.rotation.y += (look - head.rotation.y) * lerp;
      } else {
        turnTo(want, lerp);
      }
      model.userData.animate(dt, 0, time + group.position.x);
    },
  };
}

export function createQuestMarker(x, z, { color = '#ffc93c', beam: beamColor = '#ffe08a' } = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 6), mat(color, {
    emissive: color, emissiveIntensity: 1, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
  }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2.6, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: beamColor, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 1.3;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), glow(color, 0.9));
  arrow.rotation.x = Math.PI;
  arrow.position.y = 2.3;
  g.add(ring, beam, arrow);
  g.visible = false;
  return {
    group: g,
    position: g.position,
    update(time) {
      const s = 1 + Math.sin(time * 4) * 0.08;
      ring.scale.set(s, s, s);
      ring.rotation.z = time * 0.8;
      arrow.position.y = 2.3 + Math.sin(time * 3) * 0.15;
      arrow.rotation.y = time * 2;
    },
  };
}
