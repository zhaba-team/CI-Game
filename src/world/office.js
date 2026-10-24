// Геометрия офиса: open-space, столовая, кабинет директора, серверная и Игровая —
// пристройка за западной стеной (вход из open-space на месте окна у столовой).
// Окна — настоящие проёмы со стеклом; наружу смотрят северная и западная стены и окна Игровой.
// Двери в кабинет, серверную и столовую закрываются по рабочим дням (setLocks), у южной стены — выход из офиса.
// Возвращает сцену-группу, список коллайдеров (AABB в плоскости XZ),
// объекты, загораживающие камеру, и именованные точки (spots) для NPC и маркеров.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, glow, box, cyl, ico, group, textPlane } from './lowpoly.js';
import { createWallSign } from './signs.js';
import { buildExtinguisher } from './fire.js';
import { buildGameRoom } from './gameRoom.js';
import { addOfficeDecor } from './decor.js';

const WALL_H = 4.2;
const WALL_T = 0.3;
const DOOR_H = 2.7; // высота дверного проёма, выше — фрамуга
const WIN_BOTTOM = 0.9;
const WIN_H = 2.4;
const WIN_W = 2.4;
const DOOR_W = 2.4; // проём в Игровую — во всю ширину бывшего окна
const NORTH_WINDOWS = [-13, -9, -5, -1, 3]; // x-центры окон на стене z = -12
const WEST_WINDOWS = [-9, -5, -1, 7];       // z-центры окон на стене x = -16; z = -1 и 7 смотрят в Игровую
const WEST_DOORS = [3];                     // вход в Игровую на месте окна у столовой
const GAME_NORTH_WINDOWS = [-20.5];         // x-центры окон северной стены Игровой (z = -3)
const GAME_WEST_WINDOWS = [0, 6];           // z-центры окон западной стены Игровой (x = -25)
const SHELF_X = 1.0;                        // книжный шкаф — в простенке между окнами x = -1 и x = 3
const LAMP = 0.6;        // светящийся рассеиватель панели 60×60
const LAMP_FRAME = 0.68;
const LAMP_DROP = 0.04;  // насколько панель выступает из потолка

// Границы помещений (x: -16..16, z: -12..12)
export const ROOMS = {
  openSpace: { x0: -16, x1: 5, z0: -12, z1: 12 },
  director: { x0: 5, x1: 16, z0: -12, z1: 0 },
  server: { x0: 5, x1: 16, z0: 0, z1: 12 },
  canteen: { x0: -16, x1: -7, z0: 4.5, z1: 12 }, // отгороженный юго-западный угол внутри контура open-space
  gameRoom: { x0: -25, x1: -16, z0: -3, z1: 9 },  // пристройка за западной стеной, открыта всегда
};
const CANTEEN_DOOR_X = -11.25; // центр проёма в стене столовой z = 4.5

export function buildOffice() {
  const root = new THREE.Group();
  const colliders = [];
  const occluders = [];
  const spots = {};
  const animated = [];

  const solid = (x0, z0, x1, z1) => colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  // Коллайдер по габаритам объекта в мировых координатах
  const solidFrom = (obj, pad = 0) => {
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj);
    solid(b.min.x - pad, b.min.z - pad, b.max.x + pad, b.max.z + pad);
  };

  // ---------- Полы ----------
  const floor = (r, color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), mat(color));
    m.rotation.x = -Math.PI / 2;
    m.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
    m.receiveShadow = true;
    root.add(m);
  };
  floor(ROOMS.openSpace, '#d9c4a0');
  floor(ROOMS.director, '#8c3b3b');
  floor(ROOMS.server, '#3a4250');
  // Пол Игровой заходит под её западную стену; восточный край встык с полом open-space (x = −16)
  floor({ ...ROOMS.gameRoom, x0: ROOMS.gameRoom.x0 - WALL_T / 2 }, '#b9c4d6');
  // Плитка столовой лежит поверх пола и «паркета» open-space (они до y 0.005) — без z-fighting
  const canteenFloor = new THREE.Mesh(new THREE.PlaneGeometry(ROOMS.canteen.x1 - ROOMS.canteen.x0, ROOMS.canteen.z1 - ROOMS.canteen.z0), mat('#e8e2d4'));
  canteenFloor.rotation.x = -Math.PI / 2;
  canteenFloor.position.set((ROOMS.canteen.x0 + ROOMS.canteen.x1) / 2, 0.007, (ROOMS.canteen.z0 + ROOMS.canteen.z1) / 2);
  canteenFloor.receiveShadow = true;
  root.add(canteenFloor);
  for (let x = ROOMS.canteen.x0 + 0.9; x < ROOMS.canteen.x1; x += 0.9) root.add(box(0.025, 0.003, 7.5, '#cfc6b3', x, 0.007, 8.25));
  for (let z = ROOMS.canteen.z0 + 0.9; z < ROOMS.canteen.z1; z += 0.9) root.add(box(9, 0.003, 0.025, '#cfc6b3', -11.5, 0.007, z));

  // Плитка в серверной и «паркет» в open-space — тонкие полоски
  for (let x = ROOMS.server.x0 + 1; x < ROOMS.server.x1; x += 1.5) {
    root.add(box(0.03, 0.005, 12, '#56606f', x, 0.001, 6));
  }
  for (let z = -11; z < 12; z += 1.2) {
    root.add(box(21, 0.004, 0.03, '#c7b08a', -5.5, 0.001, z));
  }
  // Ковёр в кабинете директора
  root.add(box(6, 0.02, 4, '#d6b25e', 11, 0, -6));
  root.add(box(5.4, 0.021, 3.4, '#a84a4a', 11, 0, -6));

  // ---------- Стены ----------
  const wallMat = mat('#eef1ec');
  const wallSegment = (x0, z0, x1, z1, color) => {
    const w = Math.abs(x1 - x0) || WALL_T;
    const d = Math.abs(z1 - z0) || WALL_T;
    const m = box(w, WALL_H, d, null, (x0 + x1) / 2, 0, (z0 + z1) / 2, color ? mat(color) : wallMat);
    root.add(m);
    occluders.push(m);
    solid(x0 - (x0 === x1 ? WALL_T / 2 : 0), z0 - (z0 === z1 ? WALL_T / 2 : 0), x1 + (x0 === x1 ? WALL_T / 2 : 0), z1 + (z0 === z1 ? WALL_T / 2 : 0));
  };
  // Стена с оконными и дверными проёмами: один меш из кусков (1 draw call). Коллайдер — куски между
  // дверями, так что окна остаются непроходимыми. axis 'x' — стена вдоль x на z = fixed, 'z' — вдоль z на x = fixed.
  const windowWall = (axis, fixed, from, to, centers, doors = []) => {
    const pieces = [];
    // Кусок стены [a..b] вдоль оси, [y0..y1] по высоте
    const piece = (a, b, y0, y1) => {
      if (b - a <= 0) return;
      const len = b - a;
      const g = axis === 'x' ? new THREE.BoxGeometry(len, y1 - y0, WALL_T) : new THREE.BoxGeometry(WALL_T, y1 - y0, len);
      const mid = (a + b) / 2;
      g.translate(axis === 'x' ? mid : fixed, (y0 + y1) / 2, axis === 'x' ? fixed : mid);
      pieces.push(g);
    };
    const winTop = WIN_BOTTOM + WIN_H;
    const openings = [
      ...centers.map((c) => ({ c, w: WIN_W, door: false })),
      ...doors.map((c) => ({ c, w: DOOR_W, door: true })),
    ].sort((a, b) => a.c - b.c);
    const doorways = openings.filter((o) => o.door);
    // Полоса [y0..y1], прерванная проёмами list
    const band = (list, y0, y1) => {
      let edge = from;
      for (const o of list) {
        piece(edge, o.c - o.w / 2, y0, y1);
        edge = o.c + o.w / 2;
      }
      piece(edge, to, y0, y1);
    };
    band(doorways, 0, WIN_BOTTOM);
    band(openings, WIN_BOTTOM, winTop);
    for (const d of doorways) piece(d.c - d.w / 2, d.c + d.w / 2, DOOR_H, winTop); // перемычка над дверью
    piece(from, to, winTop, WALL_H);
    const m = new THREE.Mesh(mergeGeometries(pieces), wallMat);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    occluders.push(m);
    const span = (a, b) => {
      if (b - a <= 0) return;
      if (axis === 'x') solid(a, fixed - WALL_T / 2, b, fixed + WALL_T / 2);
      else solid(fixed - WALL_T / 2, a, fixed + WALL_T / 2, b);
    };
    let edge = from;
    for (const d of doorways) {
      span(edge, d.c - d.w / 2);
      edge = d.c + d.w / 2;
    }
    span(edge, to);
  };
  // Внешние стены
  windowWall('x', -12, -16, 16, NORTH_WINDOWS);
  wallSegment(-16, 12, 16, 12);
  windowWall('z', -16, -12, 12, WEST_WINDOWS, WEST_DOORS);
  wallSegment(16, -12, 16, 12);
  // Стены Игровой: концы удлинены на полтолщины, чтобы в углах не было щелей
  const game = ROOMS.gameRoom;
  windowWall('x', game.z0, game.x0 - WALL_T / 2, game.x1 - WALL_T / 2, GAME_NORTH_WINDOWS);
  windowWall('z', game.x0, game.z0 - WALL_T / 2, game.z1 + WALL_T / 2, GAME_WEST_WINDOWS);
  wallSegment(game.x0 - WALL_T / 2, game.z1, game.x1 - WALL_T / 2, game.z1);
  // Перегородка между open-space и правым крылом с двумя дверями
  wallSegment(5, -12, 5, -7);
  wallSegment(5, -3.5, 5, 3.5);
  wallSegment(5, 7, 5, 12);
  // Стена между кабинетом директора и серверной
  wallSegment(5, 0, 16, 0);
  // Стены столовой: вдоль z = 4.5 с проёмом 3.5 м и вдоль x = −7 до южной стены.
  // Правый кусок доходит до внешней грани стены x = −7, чтобы в углу не было щели.
  wallSegment(-16, 4.5, CANTEEN_DOOR_X - 1.75, 4.5);
  wallSegment(CANTEEN_DOOR_X + 1.75, 4.5, -7 + WALL_T / 2, 4.5);
  wallSegment(-7, 4.5, -7, 12);

  // Дверные проёмы: фрамуга до потолка, наличник по её нижнему краю и табличка на простенке рядом
  const doorSign = (text, doorZ, signZ, color) => {
    const transom = box(WALL_T, WALL_H - DOOR_H, 3.5, null, 5, DOOR_H, doorZ, wallMat);
    root.add(transom);
    occluders.push(transom); // коллайдер не нужен: игрок проходит под фрамугой
    root.add(box(0.32, 0.12, 3.5, '#c9d1c9', 5, DOOR_H - 0.12, doorZ));
    const sign = createWallSign(text, { width: 1.9, height: 0.34, letterColor: color, frameColor: color });
    sign.position.set(5 - WALL_T / 2, 1.85, signZ);
    sign.rotation.y = -Math.PI / 2; // лицом в open-space (−x)
    root.add(sign);
    solidFrom(sign);
  };
  doorSign('Кабинет директора', -5.25, -2.35, '#8c3b3b');
  doorSign('Серверная', 5.25, 2.35, '#28405a');
  // Проём столовой в стене вдоль x: фрамуга, наличник и вывеска справа, лицом в open-space (−z)
  {
    const transom = box(3.5, WALL_H - DOOR_H, WALL_T, null, CANTEEN_DOOR_X, DOOR_H, 4.5, wallMat);
    root.add(transom);
    occluders.push(transom);
    root.add(box(3.5, 0.12, 0.32, '#c9d1c9', CANTEEN_DOOR_X, DOOR_H - 0.12, 4.5));
    const sign = createWallSign('Столовая', { width: 1.9, height: 0.34, letterColor: '#c0612b', frameColor: '#c0612b' });
    sign.position.set(-8.25, 1.85, 4.5 - WALL_T / 2);
    sign.rotation.y = Math.PI;
    root.add(sign);
    solidFrom(sign);
  }

  // Вход в Игровую: проём без двери, наличник по низу перемычки и порог, закрывающий шов полов.
  // Вывеска — без solidFrom: её коллайдер по XZ перекрыл бы проход под ней
  for (const z of WEST_DOORS) {
    root.add(box(0.32, 0.12, DOOR_W, '#c9d1c9', -16, DOOR_H - 0.12, z));
    root.add(box(WALL_T + 0.02, 0.01, DOOR_W, '#b9c4d6', -16, 0, z));
    const sign = createWallSign('Игровая', { width: 1.9, height: 0.34, letterColor: '#7b4fd6', frameColor: '#7b4fd6' });
    sign.position.set(-16 + WALL_T / 2, 3.25, z);
    sign.rotation.y = Math.PI / 2; // лицом в open-space (+x)
    root.add(sign);
  }

  // Закрываемые двери в проёмах шириной 3.5 м. Коллайдер и occluder не через solid():
  // их добавляет и убирает setLocks в зависимости от дня.
  // axis 'z' — проём в стене вдоль z на x = fixed, 'x' — в стене вдоль x на z = fixed; center — центр проёма.
  const lockableDoor = (axis, fixed, center, color) => {
    const alongX = axis === 'x';
    // Мировые координаты по смещению вдоль стены и поперёк неё
    const at = (along, across) => (alongX ? [center + along, fixed + across] : [fixed + across, center + along]);
    const leafH = DOOR_H - 0.12; // под наличником проёма
    const [lx, lz] = at(0, 0);
    const leaf = box(alongX ? 3.5 : 0.12, leafH, alongX ? 0.12 : 3.5, color, lx, 0, lz);
    const handle = (side) => {
      const [hx, hz] = at(0.35, side * 0.08);
      return box(alongX ? 0.22 : 0.04, 0.05, alongX ? 0.04 : 0.22, '#d9dde0', hx, 1.05, hz);
    };
    const g = group(leaf, handle(-1), handle(1));
    g.visible = false;
    root.add(g);
    const [ax, az] = at(-1.75, -0.15);
    const [bx, bz] = at(1.75, 0.15);
    return {
      group: g,
      collider: { x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz) },
      occluder: leaf,
    };
  };
  const doors = {
    director: lockableDoor('z', 5, -5.25, '#8c3b3b'),
    server: lockableDoor('z', 5, 5.25, '#28405a'),
    canteen: lockableDoor('x', 4.5, CANTEEN_DOOR_X, '#c0612b'),
  };
  const addOnce = (list, item) => { if (!list.includes(item)) list.push(item); };
  const removeFrom = (list, item) => {
    const k = list.indexOf(item);
    if (k !== -1) list.splice(k, 1);
  };
  // locked — [{ room }] закрытых комнат
  const setLocks = (locked) => {
    for (const [room, door] of Object.entries(doors)) {
      const lock = locked.find((l) => l.room === room);
      door.group.visible = Boolean(lock);
      if (!lock) {
        removeFrom(colliders, door.collider);
        removeFrom(occluders, door.occluder); // raycast камеры не смотрит на visible — скрытую дверь убираем из occluders
        continue;
      }
      addOnce(colliders, door.collider);
      addOnce(occluders, door.occluder);
    }
  };

  // Окна на внешних стенах: стекло в середине толщины стены и рамы одним InstancedMesh
  const glassMat = mat('#cfe8ff', { transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0.1, depthWrite: false });
  const winY = WIN_BOTTOM + WIN_H / 2;
  const windows = [
    ...NORTH_WINDOWS.map((x) => ({ x, z: -12, west: false })),
    ...WEST_WINDOWS.map((z) => ({ x: -16, z, west: true })),
    ...GAME_NORTH_WINDOWS.map((x) => ({ x, z: game.z0, west: false })),
    ...GAME_WEST_WINDOWS.map((z) => ({ x: game.x0, z, west: true })),
  ];
  // Бруски рамы: [смещение вдоль стены, смещение по y, длина вдоль стены, высота]
  const FRAME_DEPTH = 0.36;
  const frameBars = [
    [0, WIN_H / 2, WIN_W + 0.2, 0.08],  // верх
    [0, -WIN_H / 2, WIN_W + 0.2, 0.08], // подоконник
    [-WIN_W / 2, 0, 0.08, WIN_H],
    [WIN_W / 2, 0, 0.08, WIN_H],
    [0, 0, 0.06, WIN_H],                // импост
  ];
  const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('#9aa7a0'), windows.length * frameBars.length);
  const dummy = new THREE.Object3D();
  let frameIndex = 0;
  for (const w of windows) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), glassMat);
    glass.position.set(w.x, winY, w.z);
    if (w.west) glass.rotation.y = Math.PI / 2;
    root.add(glass);
    occluders.push(glass); // стекло держит камеру в помещении: raycast по FrontSide попадает изнутри
    for (const [along, dy, len, hgt] of frameBars) {
      dummy.position.set(w.west ? w.x : w.x + along, winY + dy, w.west ? w.z + along : w.z);
      dummy.scale.set(w.west ? FRAME_DEPTH : len, hgt, w.west ? len : FRAME_DEPTH);
      dummy.updateMatrix();
      frames.setMatrixAt(frameIndex++, dummy.matrix);
    }
  }
  frames.instanceMatrix.needsUpdate = true;
  frames.computeBoundingSphere();
  frames.castShadow = false;
  root.add(frames);

  // Вывеска компании: на внутренней грани задней стены, лицом в open-space,
  // центр на ~70 % высоты стены
  const logo = createWallSign('жыбий рыр', { width: 3, height: 0.8, letterColor: '#2e9e5b', frameColor: '#1f7442' });
  logo.position.set(-4, 2.9, 12 - WALL_T / 2); // над ресепшеном: левее теперь стена столовой
  logo.rotation.y = Math.PI;
  root.add(logo);
  solidFrom(logo);

  // ---------- Потолок и светильники ----------
  // Лицом вниз: сверху плоскость отсекается backface culling, а камера не поднимается выше WALL_H − 0.4.
  // Тени не отбрасывает, иначе солнце не попадёт в офис.
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(32 + WALL_T, 24 + WALL_T), mat('#f3f4f0'));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, WALL_H, 0);
  root.add(ceiling);
  // Потолок Игровой встык с основным (по оси западной стены) — без перекрытия
  const gameCeiling = new THREE.Mesh(new THREE.PlaneGeometry(game.x1 - game.x0, game.z1 - game.z0 + WALL_T), mat('#f3f4f0'));
  gameCeiling.rotation.x = Math.PI / 2;
  gameCeiling.position.set((game.x0 + game.x1) / 2 - WALL_T / 2, WALL_H, (game.z0 + game.z1) / 2);
  root.add(gameCeiling);

  // Центры панелей: ровная сетка nx × nz внутри помещения
  const lampCenters = [];
  const lampGrid = (room, nx, nz) => {
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        lampCenters.push([
          room.x0 + (ix + 0.5) * (room.x1 - room.x0) / nx,
          room.z0 + (iz + 0.5) * (room.z1 - room.z0) / nz,
        ]);
      }
    }
  };
  lampGrid(ROOMS.openSpace, 7, 8);
  lampGrid(ROOMS.director, 3, 3);
  lampGrid(ROOMS.server, 3, 3);
  lampGrid(ROOMS.gameRoom, 3, 4);
  // Ряд панелей open-space на z = 4.5 пришёлся бы на стену столовой — убираем его над столовой
  const onCanteenWall = ([x, z]) => x > ROOMS.canteen.x0 && x < ROOMS.canteen.x1 && Math.abs(z - ROOMS.canteen.z0) < LAMP_FRAME;
  for (let k = lampCenters.length - 1; k >= 0; k--) if (onCanteenWall(lampCenters[k])) lampCenters.splice(k, 1);

  // Все панели — два InstancedMesh (рамки и рассеиватели): +2 draw call вместо сотни
  const lampMesh = (geometry, material, y) => {
    const mesh = new THREE.InstancedMesh(geometry, material, lampCenters.length);
    const dummy = new THREE.Object3D();
    lampCenters.forEach(([x, z], k) => {
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false; // bounding sphere в r169 не учитывает инстансы
    root.add(mesh);
  };
  lampMesh(new THREE.BoxGeometry(LAMP_FRAME, LAMP_DROP, LAMP_FRAME), mat('#d9dde0', { metalness: 0.3, roughness: 0.5 }), WALL_H - LAMP_DROP / 2);
  // Рассеиватель на 5 мм ниже рамки, чтобы не было z-fighting
  lampMesh(new THREE.BoxGeometry(LAMP, 0.01, LAMP), glow('#f4f8ff', 1.1), WALL_H - LAMP_DROP - 0.005);

  // Один мягкий источник на помещение вместо света на каждую лампу:
  // 83 PointLight убили бы FPS на мобильных. Серверную освещает serverLight из game.js.
  const openSpaceLight = new THREE.PointLight('#fff6e8', 19, 26, 1);
  openSpaceLight.position.set(-5.5, WALL_H - 0.5, 0);
  const directorLight = new THREE.PointLight('#ffe9c7', 14, 14, 1);
  directorLight.position.set(10.5, WALL_H - 0.5, -6);
  const gameRoomLight = new THREE.PointLight('#ffeef6', 12, 14, 1);
  gameRoomLight.position.set((game.x0 + game.x1) / 2, WALL_H - 0.5, (game.z0 + game.z1) / 2);
  root.add(openSpaceLight, directorLight, gameRoomLight);

  // ---------- Мебель ----------
  const monitor = (x, z, rot, screenColor = '#2b5d8a') => {
    const g = group(
      box(0.08, 0.3, 0.08, '#333', 0, 0, 0),
      box(0.3, 0.03, 0.2, '#333', 0, 0, 0),
      box(0.9, 0.55, 0.06, '#222', 0, 0.28, 0),
    );
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.47), glow(screenColor, 0.8));
    screen.position.set(0, 0.555, 0.032);
    g.add(screen);
    g.position.set(x, 0.76, z);
    g.rotation.y = rot;
    return g;
  };

  const chair = (x, z, rot, color = '#2e9e5b') => {
    const g = group(
      cyl(0.05, 0.05, 0.45, 6, '#333', 0, 0, 0),
      cyl(0.32, 0.32, 0.05, 6, '#333', 0, 0, 0),
      box(0.5, 0.1, 0.5, color, 0, 0.45, 0),
      box(0.5, 0.55, 0.08, color, 0, 0.55, -0.24),
    );
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    return g;
  };

  // Рабочее место: стол + монитор + стул; facing — куда смотрит сидящий (+1 → +z)
  const deskCenters = []; // для мелочей на столах (decor.js)
  const desk = (x, z, facing = 1, screenColor) => {
    deskCenters.push({ x, z });
    const g = new THREE.Group();
    g.add(box(1.8, 0.06, 0.9, '#f4f1ea', 0, 0.72, 0));
    [[-0.82, -0.38], [0.82, -0.38], [-0.82, 0.38], [0.82, 0.38]].forEach(([lx, lz]) => g.add(box(0.06, 0.72, 0.06, '#7a7a7a', lx, 0, lz)));
    g.add(monitor(0, -0.2 * facing, facing > 0 ? 0 : Math.PI, screenColor));
    g.add(box(0.5, 0.03, 0.16, '#3a3a3a', 0, 0.78, 0.12 * facing)); // клавиатура
    g.add(box(0.08, 0.03, 0.12, '#3a3a3a', 0.4, 0.78, 0.12 * facing)); // мышь
    g.position.set(x, 0, z);
    root.add(g);
    solidFrom(g, 0.05);
    const c = chair(x, z + 0.85 * facing, facing > 0 ? Math.PI : 0);
    root.add(c);
    return { x, z: z + 1.25 * facing };
  };

  const plant = (x, z, s = 1) => {
    const g = group(cyl(0.25, 0.2, 0.45, 6, '#c06a3a', 0, 0, 0));
    const leaves = ico(0.5, '#3f9b4f');
    leaves.position.y = 0.95;
    leaves.scale.set(1, 1.3, 1);
    const leaves2 = ico(0.35, '#55b864');
    leaves2.position.set(0.15, 1.4, 0.05);
    g.add(leaves, leaves2);
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    root.add(g);
    solid(x - 0.3 * s, z - 0.3 * s, x + 0.3 * s, z + 0.3 * s);
  };

  // Помощники для модулей наполнения комнат (gameRoom.js, decor.js)
  const ctx = { root, solid, solidFrom, occluders, spots, animated, plant };
  const gameRoom = buildGameRoom(ctx, ROOMS.gameRoom);

  // Ряды столов в open-space
  const screens = ['#2b5d8a', '#3a7a4f', '#5b3a8a', '#2b5d8a', '#8a5b2b', '#2b6d7a'];
  const deskSpots = [];
  let i = 0;
  for (const z of [-7.5, -1.5]) {
    for (const x of [-12, -9.5, -7, -4.5]) {
      deskSpots.push(desk(x, z, 1, screens[i++ % screens.length]));
    }
  }
  // Ряд у стены лицом к стене
  for (const x of [-12, -9.5, -7]) {
    deskSpots.push(desk(x, -10.6, 1, screens[i++ % screens.length]));
  }

  // Рабочие места, к которым привязаны квесты
  spots.deskDesign = deskSpots[1];
  spots.deskBug = deskSpots[6];
  spots.deskFeature = deskSpots[3];

  // Канбан-доска менеджера с цветными стикерами
  const board = group(box(2.6, 1.5, 0.08, '#ffffff', 0, 0.9, 0));
  const stickers = ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#2e9e5b', '#ef476f'];
  stickers.forEach((c, k) => board.add(box(0.32, 0.32, 0.02, c, -0.9 + (k % 3) * 0.9, 1.05 + Math.floor(k / 3) * 0.6, 0.05)));
  board.add(box(0.08, 0.9, 0.08, '#888', -1.1, 0, -0.05));
  board.add(box(0.08, 0.9, 0.08, '#888', 1.1, 0, -0.05));
  board.position.set(-1.2, 0, 3.2);
  board.rotation.y = -0.25;
  root.add(board);
  solidFrom(board, 0.1);
  spots.manager = { x: -0.4, z: 4.3, face: 0.4 };

  // Тимлид у своего стола
  spots.teamlead = { x: -2.5, z: -4.6, face: Math.PI * 0.6 };
  root.add(box(1.6, 1.8, 0.4, '#6b4f36', SHELF_X, 0, -11.6)); // шкаф с книгами
  for (let k = 0; k < 4; k++) {
    root.add(box(1.5, 0.04, 0.38, '#5a412c', SHELF_X, 0.4 + k * 0.45, -11.55));
    for (let b = 0; b < 5; b++) {
      root.add(box(0.2, 0.32, 0.26, ['#ef476f', '#118ab2', '#ffd166', '#06d6a0', '#8338ec'][(b + k) % 5], SHELF_X - 0.55 + b * 0.27, 0.44 + k * 0.45, -11.5));
    }
  }
  solid(SHELF_X - 0.85, -11.85, SHELF_X + 0.85, -11.3);

  // ---------- Столовая ----------
  // Диван у южной стены, кухонная стойка с кофемашиной и микроволновкой у западной, холодильник и кулер
  const sofa = group(
    box(3, 0.45, 1, '#ef8354', 0, 0, 0),
    box(3, 0.6, 0.25, '#ef8354', 0, 0.45, -0.38),
    box(0.25, 0.35, 1, '#d96f43', -1.38, 0.45, 0),
    box(0.25, 0.35, 1, '#d96f43', 1.38, 0.45, 0),
  );
  sofa.position.set(-11.5, 0, 10.8);
  sofa.rotation.y = Math.PI;
  root.add(sofa);
  solidFrom(sofa);
  // Кухонная стойка в простенке западной стены за окном z = 7 (стойка ниже подоконника не нужна)
  const counter = group(
    box(0.7, 0.88, 2.4, '#5a6b7a', 0, 0, 0),
    box(0.76, 0.05, 2.46, '#e9e6df', 0, 0.88, 0),
    box(0.45, 0.5, 0.4, '#222', 0.02, 0.93, -0.75),             // кофемашина
    box(0.05, 0.08, 0.12, null, 0.25, 1.25, -0.75, glow('#ff5a5a', 1)),
    box(0.45, 0.3, 0.6, '#d9dde0', 0, 0.93, 0.35),              // микроволновка
    box(0.02, 0.2, 0.36, '#1b2430', 0.235, 0.98, 0.3),          // её дверца
  );
  counter.position.set(-15.5, 0, 9.6);
  root.add(counter);
  solidFrom(counter, 0.05);
  const fridge = group(
    box(0.75, 1.9, 0.75, '#eef1f3', 0, 0, 0),
    box(0.03, 0.5, 0.05, '#9aa3ab', 0.39, 1.1, 0.25),
    box(0.76, 0.02, 0.76, '#c9d1d6', 0, 1.25, 0),
  );
  fridge.position.set(-15.45, 0, 11.4);
  root.add(fridge);
  solidFrom(fridge, 0.05);
  root.add(cyl(0.22, 0.22, 1.1, 8, '#ffffff', -15.4, 0, 5.1));
  root.add(cyl(0.2, 0.2, 0.5, 8, '#8ecae6', -15.4, 1.1, 5.1, mat('#8ecae6', { transparent: true, opacity: 0.8 })));
  solid(-15.7, 4.8, -15.1, 5.4);

  // Обеденный стол с двумя лавками вдоль длинных сторон
  const SEAT_H = 0.45;
  const diningTable = (x, z) => {
    const g = group(
      box(1.6, 0.05, 0.9, '#c98f5a', 0, 0.72, 0),
      box(0.08, 0.72, 0.08, '#6b4f36', -0.7, 0, 0),
      box(0.08, 0.72, 0.08, '#6b4f36', 0.7, 0, 0),
    );
    for (const sz of [-1, 1]) {
      g.add(box(1.6, 0.06, 0.36, '#a8744a', 0, SEAT_H - 0.06, sz * 0.72));
      g.add(box(0.06, SEAT_H - 0.06, 0.3, '#6b4f36', -0.65, 0, sz * 0.72));
      g.add(box(0.06, SEAT_H - 0.06, 0.3, '#6b4f36', 0.65, 0, sz * 0.72));
    }
    g.position.set(x, 0, z);
    root.add(g);
    solidFrom(g, 0.05);
  };
  diningTable(-12.2, 7.6);
  diningTable(-8.8, 7.6);
  // На столе Егора — коробка «Нейрокубер» и кружка
  const cube = box(0.34, 0.12, 0.26, '#f4f4f2', -12.2, 0.745, 7.75);
  cube.rotation.y = 0.2;
  root.add(cube);
  const cubeLabel = textPlane('Нейрокубер', { color: '#1b2430', height: 0.06, size: 64 });
  cubeLabel.rotation.set(-Math.PI / 2, 0, 0.2 + Math.PI); // на крышке, читается со стороны прохода
  cubeLabel.position.set(-12.2, 0.867, 7.75);
  root.add(cubeLabel);
  root.add(cyl(0.05, 0.045, 0.1, 8, '#2e9e5b', -11.75, 0.745, 7.95));
  root.add(cyl(0.05, 0.045, 0.1, 8, '#ef476f', -8.5, 0.745, 7.4));
  spots.egor = { x: -12.2, z: 8.32, face: Math.PI, sit: true }; // на лавке лицом к проходу
  spots.egorTalk = { x: -10.5, z: 8.4 };

  plant(-15.2, -11.2);
  plant(4.3, -11.2);
  plant(4.3, 11.2, 1.2);
  plant(-7.7, 11.3, 0.9);
  plant(-3, 8, 1.1);
  plant(-3, -11.2);

  // Стойка ресепшн у входа
  root.add(box(2.6, 1.05, 0.7, '#2e9e5b', -4, 0, 10));
  root.add(box(2.7, 0.06, 0.8, '#f4f1ea', -4, 1.05, 10));
  solid(-5.35, 9.6, -2.65, 10.4);

  // Выход из офиса на южной стене между ресепшеном и растением. Декор в плоскости стены:
  // коллайдер даёт сама стена, а маркер выхода ставит game.js в spots.exit
  const exitFace = 12 - WALL_T / 2;
  root.add(box(1.4, 2.4, 0.08, '#5a3b26', 1, 0, exitFace - 0.04));
  root.add(box(1.6, 0.1, 0.12, '#3f2919', 1, 2.4, exitFace - 0.06)); // наличник
  root.add(box(0.1, 2.4, 0.12, '#3f2919', 1 - 0.75, 0, exitFace - 0.06));
  root.add(box(0.1, 2.4, 0.12, '#3f2919', 1 + 0.75, 0, exitFace - 0.06));
  root.add(box(0.22, 0.05, 0.05, '#d9dde0', 1 + 0.45, 1.05, exitFace - 0.1)); // ручка
  const exitSign = createWallSign('Выход', { width: 1.2, height: 0.3, letterColor: '#2e9e5b', frameColor: '#1f7442' });
  exitSign.position.set(1, 2.75, exitFace);
  exitSign.rotation.y = Math.PI;
  root.add(exitSign);
  spots.exit = { x: 1, z: 10.9 };

  addOfficeDecor(ctx, { desks: deskCenters });

  // ---------- Кабинет директора ----------
  const bossDesk = group(
    box(2.8, 0.08, 1.2, '#5a3b26', 0, 0.74, 0),
    box(0.12, 0.74, 1.1, '#4a2e1c', -1.3, 0, 0),
    box(0.12, 0.74, 1.1, '#4a2e1c', 1.3, 0, 0),
    box(2.5, 0.6, 0.06, '#4a2e1c', 0, 0.14, 0.5),
  );
  bossDesk.add(monitor(0.6, -0.2, Math.PI, '#2e9e5b'));
  bossDesk.position.set(12, 0, -8.5);
  root.add(bossDesk);
  solidFrom(bossDesk, 0.05);
  const bossChair = group(
    box(0.7, 0.5, 0.7, '#1f1f1f', 0, 0, 0),
    box(0.7, 0.9, 0.15, '#1f1f1f', 0, 0.5, -0.3),
  );
  bossChair.position.set(12, 0, -9.7);
  root.add(bossChair);
  root.add(box(0.45, 2.1, 1.2, '#6b4f36', 15.6, 0, -6));
  solid(15.3, -6.6, 16, -5.4);
  plant(15.2, -11.2, 1.2);
  plant(6, -11.2);
  // Кубок и грамоты
  root.add(cyl(0.12, 0.08, 0.3, 6, '#ffd166', 11.2, 0.82, -8.5, glow('#ffd166', 0.3)));
  for (let k = 0; k < 3; k++) {
    const frame = box(0.8, 0.6, 0.04, '#f4e3b2', 8.5 + k * 1.2, 1.4, -11.8);
    root.add(frame);
  }
  spots.director = { x: 10.2, z: -7.8, face: -Math.PI * 0.3 };

  // ---------- Серверная ----------
  const leds = [];
  const rack = (x, z) => {
    const g = group(box(0.9, 2.3, 0.9, '#1c1f26', 0, 0, 0));
    for (let k = 0; k < 7; k++) {
      g.add(box(0.8, 0.22, 0.02, '#2b3038', 0, 0.2 + k * 0.29, 0.455));
      const led = box(0.06, 0.06, 0.02, null, -0.3 + (k % 2) * 0.1, 0.28 + k * 0.29, 0.47, glow('#ff4d4d', 1.4));
      led.material = led.material.clone();
      led.userData.offset = Math.random() * 6;
      leds.push(led);
      g.add(led);
    }
    g.position.set(x, 0, z);
    root.add(g);
    occluders.push(g.children[0]);
    solidFrom(g, 0.05);
  };
  for (const z of [3, 5.5, 8]) {
    for (const x of [9, 11]) rack(x, z);
  }
  for (const z of [3, 5.5, 8]) rack(15.2, z);
  // Пульт администратора
  const consoleDesk = group(box(1.6, 0.75, 0.7, '#2b3038', 0, 0, 0));
  consoleDesk.add(monitor(-0.35, -0.1, 0, '#0b1f12'));
  consoleDesk.add(monitor(0.45, -0.1, 0, '#0b1f12'));
  consoleDesk.position.set(7.2, 0, 10.8);
  consoleDesk.rotation.y = Math.PI;
  root.add(consoleDesk);
  solidFrom(consoleDesk, 0.05);
  spots.devops = { x: 6.6, z: 3, face: -Math.PI / 2 };
  spots.deskServer = { x: 7.2, z: 9.6 };
  spots.devopsAlarm = { x: 7.4, z: 4.4 };
  // Точки тушения — перед лицевой стороной стоек; rack — где горит огонь (верх стойки)
  spots.fireA = { x: 9, z: 4.15, rack: { x: 9, y: 2.3, z: 3 } };
  spots.fireB = { x: 11, z: 6.65, rack: { x: 11, y: 2.3, z: 5.5 } };
  spots.fireC = { x: 9, z: 9.15, rack: { x: 9, y: 2.3, z: 8 } };

  // Огнетушитель на стене open-space рядом с дверью серверной
  const extinguisher = buildExtinguisher();
  extinguisher.position.set(5 - WALL_T / 2 - 0.1, 0.75, 8);
  extinguisher.rotation.y = -Math.PI / 2;
  const bracket = box(0.06, 0.06, 0.24, '#3a3a3a', 5 - WALL_T / 2 - 0.03, 1.05, 8);
  root.add(extinguisher, bracket);
  spots.extinguisher = { x: 4.2, z: 8 };
  const setExtinguisherOnWall = (visible) => { extinguisher.visible = visible; };

  // Мигание лампочек: красные, пока сервер «лежит», зелёные — после починки
  const serverState = { fixed: false };
  animated.push((t) => {
    for (const led of leds) {
      const blink = serverState.fixed ? 0.9 + Math.sin(t * 6 + led.userData.offset) * 0.4 : (Math.sin(t * 3 + led.userData.offset) > 0 ? 1.6 : 0.2);
      led.material.emissiveIntensity = blink;
    }
  });
  const setServerFixed = (fixed) => {
    serverState.fixed = fixed;
    const c = new THREE.Color(fixed ? '#4dff88' : '#ff4d4d');
    for (const led of leds) { led.material.color.copy(c); led.material.emissive.copy(c); }
  };

  spots.spawn = { x: -6, z: 7, face: Math.PI };

  // Описание внешнего контура для декорации снаружи (world/outdoor.js)
  const outline = {
    x0: -16, x1: 16, z0: -12, z1: 12, wallT: WALL_T, winW: WIN_W,
    northWindows: NORTH_WINDOWS, westWindows: WEST_WINDOWS, westDoors: WEST_DOORS,
    annexes: [{ ...ROOMS.gameRoom, northWindows: GAME_NORTH_WINDOWS, westWindows: GAME_WEST_WINDOWS }],
  };

  return {
    root, colliders, occluders, spots, animated, setServerFixed, setLocks, setExtinguisherOnWall, ceilingHeight: WALL_H, outline,
    seats: gameRoom.seats,
    coffee: gameRoom.coffee,
  };
}
