// Геометрия офиса: open-space, кабинет директора, серверная.
// Возвращает сцену-группу, список коллайдеров (AABB в плоскости XZ),
// объекты, загораживающие камеру, и именованные точки (spots) для NPC и маркеров.
import * as THREE from 'three';
import { mat, glow, box, cyl, ico, group } from './lowpoly.js';
import { createWallSign } from './signs.js';

const WALL_H = 3;
const WALL_T = 0.3;

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
  // Внешние стены
  wallSegment(-16, -12, 16, -12);
  wallSegment(-16, 12, 16, 12);
  wallSegment(-16, -12, -16, 12);
  wallSegment(16, -12, 16, 12);
  // Перегородка между open-space и правым крылом с двумя дверями
  wallSegment(5, -12, 5, -7);
  wallSegment(5, -3.5, 5, 3.5);
  wallSegment(5, 7, 5, 12);
  // Стена между кабинетом директора и серверной
  wallSegment(5, 0, 16, 0);

  // Дверные проёмы: перемычка над проёмом и табличка на простенке рядом
  const doorSign = (text, doorZ, signZ, color) => {
    root.add(box(0.32, 0.12, 3.5, '#c9d1c9', 5, WALL_H - 0.12, doorZ));
    const sign = createWallSign(text, { width: 1.9, height: 0.34, letterColor: color, frameColor: color });
    sign.position.set(5 - WALL_T / 2, 1.85, signZ);
    sign.rotation.y = -Math.PI / 2; // лицом в open-space (−x)
    root.add(sign);
    solidFrom(sign);
  };
  doorSign('Кабинет директора', -5.25, -2.35, '#8c3b3b');
  doorSign('Серверная', 5.25, 2.35, '#28405a');

  // Окна на внешних стенах
  const windowMat = glow('#bfe4ff', 0.55);
  for (let x = -13; x <= 3; x += 4) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), windowMat);
    w.position.set(x, 1.7, -11.84);
    root.add(w);
    root.add(box(2.6, 0.08, 0.1, '#9aa7a0', x, 0.96, -11.8));
  }
  for (let z = -9; z <= 9; z += 4) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), windowMat);
    w.rotation.y = Math.PI / 2;
    w.position.set(-15.84, 1.7, z);
    root.add(w);
  }

  // Вывеска компании: на внутренней грани задней стены, лицом в open-space
  const logo = createWallSign('жыбий рыр', { width: 3, height: 0.8, letterColor: '#2e9e5b', frameColor: '#1f7442' });
  logo.position.set(-8, 2.2, 12 - WALL_T / 2);
  logo.rotation.y = Math.PI;
  root.add(logo);
  solidFrom(logo);

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

  // Доска дизайнера с цветными стикерами
  const board = group(box(2.6, 1.5, 0.08, '#ffffff', 0, 0.9, 0));
  const stickers = ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#2e9e5b', '#ef476f'];
  stickers.forEach((c, k) => board.add(box(0.32, 0.32, 0.02, c, -0.9 + (k % 3) * 0.9, 1.05 + Math.floor(k / 3) * 0.6, 0.05)));
  board.add(box(0.08, 0.9, 0.08, '#888', -1.1, 0, -0.05));
  board.add(box(0.08, 0.9, 0.08, '#888', 1.1, 0, -0.05));
  board.position.set(-1.2, 0, 3.2);
  board.rotation.y = -0.25;
  root.add(board);
  solidFrom(board, 0.1);
  spots.designer = { x: -0.4, z: 4.3, face: 0.4 };

  // Тимлид у своего стола
  spots.teamlead = { x: -2.5, z: -4.6, face: Math.PI * 0.6 };
  root.add(box(1.6, 1.8, 0.4, '#6b4f36', -1.2, 0, -11.6)); // шкаф с книгами
  for (let k = 0; k < 4; k++) {
    root.add(box(1.5, 0.04, 0.38, '#5a412c', -1.2, 0.4 + k * 0.45, -11.55));
    for (let b = 0; b < 5; b++) {
      root.add(box(0.2, 0.32, 0.26, ['#ef476f', '#118ab2', '#ffd166', '#06d6a0', '#8338ec'][(b + k) % 5], -1.75 + b * 0.27, 0.44 + k * 0.45, -11.5));
    }
  }
  solid(-2.05, -11.85, -0.35, -11.3);

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
  plant(1.5, -11.2);

  // Стойка ресепшн у входа
  root.add(box(2.6, 1.05, 0.7, '#2e9e5b', -4, 0, 10));
  root.add(box(2.7, 0.06, 0.8, '#f4f1ea', -4, 1.05, 10));
  solid(-5.35, 9.6, -2.65, 10.4);

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

  return { root, colliders, occluders, spots, animated, setServerFixed };
}
