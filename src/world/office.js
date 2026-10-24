// Геометрия офиса: open-space, кабинет директора, серверная.
// Окна — настоящие проёмы со стеклом; наружу смотрят северная и западная стены.
// Двери в кабинет и серверную закрываются по рабочим дням (setLocks), у южной стены — выход из офиса.
// Возвращает сцену-группу, список коллайдеров (AABB в плоскости XZ),
// объекты, загораживающие камеру, и именованные точки (spots) для NPC и маркеров.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, glow, box, cyl, ico, group } from './lowpoly.js';
import { createWallSign } from './signs.js';

const WALL_H = 4.2;
const WALL_T = 0.3;
const DOOR_H = 2.7; // высота дверного проёма, выше — фрамуга
const WIN_BOTTOM = 0.9;
const WIN_H = 2.4;
const WIN_W = 2.4;
const NORTH_WINDOWS = [-13, -9, -5, -1, 3]; // x-центры окон на стене z = -12
const WEST_WINDOWS = [-9, -5, -1, 3, 7];    // z-центры окон на стене x = -16
const SHELF_X = 1.0;                        // книжный шкаф — в простенке между окнами x = -1 и x = 3
const LAMP = 0.6;        // светящийся рассеиватель панели 60×60
const LAMP_FRAME = 0.68;
const LAMP_DROP = 0.04;  // насколько панель выступает из потолка

// Границы помещений (x: -16..16, z: -12..12)
export const ROOMS = {
  openSpace: { x0: -16, x1: 5, z0: -12, z1: 12 },
  director: { x0: 5, x1: 16, z0: -12, z1: 0 },
  server: { x0: 5, x1: 16, z0: 0, z1: 12 },
};

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
  // Стена с оконными проёмами: один меш из кусков (1 draw call) и цельный коллайдер,
  // так что окна остаются непроходимыми. axis 'x' — стена вдоль x на z = fixed, 'z' — вдоль z на x = fixed.
  const windowWall = (axis, fixed, from, to, centers) => {
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
    piece(from, to, 0, WIN_BOTTOM);
    piece(from, to, winTop, WALL_H);
    let edge = from;
    for (const c of centers) {
      piece(edge, c - WIN_W / 2, WIN_BOTTOM, winTop);
      edge = c + WIN_W / 2;
    }
    piece(edge, to, WIN_BOTTOM, winTop);
    const m = new THREE.Mesh(mergeGeometries(pieces), wallMat);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    occluders.push(m);
    if (axis === 'x') solid(from, fixed - WALL_T / 2, to, fixed + WALL_T / 2);
    else solid(fixed - WALL_T / 2, from, fixed + WALL_T / 2, to);
  };
  // Внешние стены
  windowWall('x', -12, -16, 16, NORTH_WINDOWS);
  wallSegment(-16, 12, 16, 12);
  windowWall('z', -16, -12, 12, WEST_WINDOWS);
  wallSegment(16, -12, 16, 12);
  // Перегородка между open-space и правым крылом с двумя дверями
  wallSegment(5, -12, 5, -7);
  wallSegment(5, -3.5, 5, 3.5);
  wallSegment(5, 7, 5, 12);
  // Стена между кабинетом директора и серверной
  wallSegment(5, 0, 16, 0);

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

  // Закрываемые двери в проёмах перегородки. Коллайдер и occluder не через solid():
  // их добавляет и убирает setLocks в зависимости от дня
  const lockableDoor = (doorZ, color) => {
    const leafH = DOOR_H - 0.12; // под наличником проёма
    const leaf = box(0.12, leafH, 3.5, color, 5, 0, doorZ);
    const g = group(
      leaf,
      box(0.04, 0.05, 0.22, '#d9dde0', 5 - 0.08, 1.05, doorZ + 0.35),
      box(0.04, 0.05, 0.22, '#d9dde0', 5 + 0.08, 1.05, doorZ + 0.35),
    );
    g.visible = false;
    root.add(g);
    return {
      group: g,
      collider: { x0: 5 - 0.15, z0: doorZ - 1.75, x1: 5 + 0.15, z1: doorZ + 1.75 },
      occluder: leaf,
    };
  };
  const doors = {
    director: lockableDoor(-5.25, '#8c3b3b'),
    server: lockableDoor(5.25, '#28405a'),
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
  logo.position.set(-8, 2.9, 12 - WALL_T / 2);
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
  // 74 PointLight убили бы FPS на мобильных. Серверную освещает serverLight из game.js.
  const openSpaceLight = new THREE.PointLight('#fff6e8', 19, 26, 1);
  openSpaceLight.position.set(-5.5, WALL_H - 0.5, 0);
  const directorLight = new THREE.PointLight('#ffe9c7', 14, 14, 1);
  directorLight.position.set(10.5, WALL_H - 0.5, -6);
  root.add(openSpaceLight, directorLight);

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
  const desk = (x, z, facing = 1, screenColor) => {
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

  // Зона отдыха: диван, кофемашина, кулер
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
  root.add(box(1.4, 0.4, 0.8, '#7a5a3a', -11.5, 0, 8.6));
  solid(-12.2, 8.2, -10.8, 9);
  root.add(box(1.2, 0.95, 0.7, '#5a5a5a', -15.2, 0, 4));
  root.add(box(0.45, 0.55, 0.45, '#222', -15.25, 0.95, 4));
  root.add(box(0.12, 0.08, 0.05, '#ff5a5a', -15.0, 1.3, 4.18, glow('#ff5a5a', 1)));
  solid(-16, 3.6, -14.5, 4.4);
  root.add(cyl(0.22, 0.22, 1.1, 8, '#ffffff', -15.3, 0, 6));
  root.add(cyl(0.2, 0.2, 0.5, 8, '#8ecae6', -15.3, 1.1, 6, mat('#8ecae6', { transparent: true, opacity: 0.8 })));
  solid(-15.6, 5.7, -15, 6.3);

  plant(-15.2, -11.2);
  plant(4.3, -11.2);
  plant(4.3, 11.2, 1.2);
  plant(-15.2, 11.2, 0.9);
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
  const outline = { x0: -16, x1: 16, z0: -12, z1: 12, wallT: WALL_T, winW: WIN_W, northWindows: NORTH_WINDOWS, westWindows: WEST_WINDOWS };

  return { root, colliders, occluders, spots, animated, setServerFixed, setLocks, ceilingHeight: WALL_H, outline };
}
