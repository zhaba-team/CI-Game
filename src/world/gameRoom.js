// Наполнение Игровой: теннисный стол, зона консоли (ТВ, диван, геймпады), пуфики, кофе-бар и декор.
// Интерактивны пуфики (возвращаются как seats), кофемашина (coffee) и теннисный стол (pingPong — габарит,
// ракетки на столе и их цвета; точки spots.pingPongPlayer / pingPongRival у торцов); остальное — декор с коллайдерами.
// Помощники офиса (root, solid, solidFrom, spots, plant) приходят в ctx из world/office.js.
import * as THREE from 'three';
import { glow, box, cyl, ico, group, textPlane } from './lowpoly.js';
import { createCoffeeMachine } from './coffee.js';

const POUF_H = 0.45; // как сиденье лавок: поза сидя (SIT_DROP) рассчитана на эту высоту
const POUF_R = 0.38;
const STAND_OFFSET = 0.95; // точка «встать» перед пуфиком: вне его коллайдера даже по диагонали (0.38·√2 + радиус игрока)
const TABLE_W = 2.74;      // теннисный стол: длинная сторона по X
const TABLE_D = 1.525;
const END_GAP = 0.65;      // игрок у торца стола: вне коллайдера (запас 0.05) с радиусом игрока 0.35
const RACKET_COLORS = ['#d62828', '#1b1b1f']; // ракетка игрока и соперника

// Ракетка, лежащая плашмя: лопасть и ручка вдоль +z
export function buildRacket(color) {
  return group(
    cyl(0.075, 0.075, 0.012, 10, color, 0, 0, 0),
    box(0.03, 0.014, 0.1, '#8b5a2b', 0, 0, 0.12),
  );
}

// Ракетка для руки (player.setHeld / npc.setHeld): начало координат — низ лопасти, ручка вверху у кисти,
// лопасть стоит вертикально плоскостью вперёд. hang — насколько предмет свисает от кисти (соглашение setHeld)
export function buildHeldRacket(color) {
  const blade = cyl(0.075, 0.075, 0.012, 10, color, 0, 0, 0);
  blade.rotation.x = Math.PI / 2; // ось цилиндра — вперёд, плоскость лопасти вертикальна
  blade.position.set(0, 0.075, 0);
  const g = group(blade, box(0.03, 0.1, 0.014, '#8b5a2b', 0, 0.12, 0));
  g.userData.hang = 0.22;
  return g;
}

export function buildGameRoom(ctx, room) {
  const { root, solid, solidFrom, spots, plant } = ctx;
  const cx = (room.x0 + room.x1) / 2; // -20.5
  const north = room.z0 + 0.15;        // внутренние грани стен
  const south = room.z1 - 0.15;
  const west = room.x0 + 0.15;

  // ---------- Теннисный стол ----------
  const table = group(
    box(TABLE_W, 0.05, TABLE_D, '#1f5fa8', 0, 0.71, 0),
    box(2.74, 0.002, 0.02, '#f4f4f2', 0, 0.76, 0.7525),  // белые кромки
    box(2.74, 0.002, 0.02, '#f4f4f2', 0, 0.76, -0.7525),
    box(0.02, 0.002, 1.525, '#f4f4f2', 1.36, 0.76, 0),
    box(0.02, 0.002, 1.525, '#f4f4f2', -1.36, 0.76, 0),
    box(2.74, 0.002, 0.01, '#f4f4f2', 0, 0.76, 0),       // центральная линия
    box(0.02, 0.15, 1.68, '#f4f4f2', 0, 0.76, 0),        // сетка
    box(0.03, 0.17, 0.03, '#333', 0, 0.71, 0.84),        // стойки сетки
    box(0.03, 0.17, 0.03, '#333', 0, 0.71, -0.84),
  );
  for (const lx of [-1.2, 1.2]) for (const lz of [-0.65, 0.65]) table.add(box(0.06, 0.71, 0.06, '#333', lx, 0, lz));
  const racket = (color, x, z, rot) => {
    const g = buildRacket(color);
    g.position.set(x, 0.762, z);
    g.rotation.y = rot;
    return g;
  };
  const rackets = [racket(RACKET_COLORS[0], -0.75, 0.35, 0.6), racket(RACKET_COLORS[1], 0.8, -0.3, -2.4)];
  table.add(...rackets);
  const ball = ico(0.02, '#ff9f1c', 1);
  ball.position.set(0.3, 0.782, 0.2);
  table.add(ball);
  table.position.set(-21.2, 0, 0.2);
  root.add(table);
  solidFrom(table, 0.05);
  const { x: tx, z: tz } = table.position;
  const pingPong = {
    table: { x0: tx - TABLE_W / 2, x1: tx + TABLE_W / 2, z0: tz - TABLE_D / 2, z1: tz + TABLE_D / 2 },
    rackets,
    colors: RACKET_COLORS,
  };
  // Игрок — у восточного торца лицом на запад, соперник — у западного лицом на восток
  spots.pingPongPlayer = { x: pingPong.table.x1 + END_GAP, z: tz, face: -Math.PI / 2 };
  spots.pingPongRival = { x: pingPong.table.x0 - END_GAP, z: tz, face: Math.PI / 2 };

  // ---------- Зона консоли (юг комнаты) ----------
  const tvZ = south - 0.3; // 8.55
  root.add(box(2.4, 0.5, 0.5, '#2b2d42', cx, 0, tvZ));
  solid(cx - 1.2, tvZ - 0.25, cx + 1.2, south);
  // ТВ лицом на север (−z): рамка на ножке, светящийся экран и «игровая картинка»
  const tv = group(
    box(0.3, 0.02, 0.2, '#111', 0, 0, 0),
    box(0.06, 0.16, 0.04, '#111', 0, 0, 0),
    box(1.7, 1.0, 0.07, '#111', 0, 0.15, 0),
  );
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), glow('#3b2a8a', 0.9));
  screen.position.set(0, 0.65, 0.036);
  tv.add(screen);
  const picture = [
    [0.9, 0.12, -0.0, -0.3, '#4cc9f0'],  // «пол» уровня
    [0.12, 0.12, -0.4, -0.18, '#ffd166'], // герой
    [0.25, 0.08, 0.35, 0.05, '#06d6a0'],  // платформа
    [0.08, 0.08, 0.5, 0.15, '#ff6bd6'],   // бонус
  ];
  for (const [w, h, px, py, color] of picture) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glow(color, 1.1));
    m.position.set(px, 0.65 + py, 0.038);
    tv.add(m);
  }
  tv.position.set(cx, 0.5, tvZ);
  tv.rotation.y = Math.PI;
  root.add(tv);
  // Консоль: вертикальный чёрный корпус между белыми панелями, без надписей
  const consoleBox = group(
    box(0.1, 0.4, 0.3, '#1b1b1f', 0, 0, 0),
    box(0.03, 0.42, 0.34, '#f4f4f2', -0.065, 0, 0),
    box(0.03, 0.42, 0.34, '#f4f4f2', 0.065, 0, 0),
    box(0.012, 0.3, 0.012, null, 0, 0.05, -0.155, glow('#4cc9f0', 1.4)),
  );
  consoleBox.position.set(cx + 1.05, 0.5, tvZ);
  root.add(consoleBox);

  // Диван лицом к ТВ (+z), по схеме дивана столовой
  const sofa = group(
    box(2.8, 0.45, 1, '#3d5a80', 0, 0, 0),
    box(2.8, 0.6, 0.25, '#3d5a80', 0, 0.45, -0.38),
    box(0.25, 0.35, 1, '#324a6b', -1.28, 0.45, 0),
    box(0.25, 0.35, 1, '#324a6b', 1.28, 0.45, 0),
  );
  sofa.position.set(cx, 0, 5.6);
  root.add(sofa);
  solidFrom(sofa);
  // Журнальный столик с двумя геймпадами
  root.add(box(1.2, 0.42, 0.55, '#c98f5a', cx, 0, 7.0));
  solid(cx - 0.6, 6.725, cx + 0.6, 7.275);
  const gamepad = (color, x, z, rot) => {
    const g = group(
      box(0.16, 0.03, 0.09, color, 0, 0, 0),
      box(0.05, 0.03, 0.06, color, -0.08, 0, 0.03),
      box(0.05, 0.03, 0.06, color, 0.08, 0, 0.03),
      box(0.02, 0.012, 0.02, '#4cc9f0', 0.04, 0.03, -0.01),
    );
    g.position.set(x, 0.42, z);
    g.rotation.y = rot;
    root.add(g);
  };
  gamepad('#f4f4f2', cx - 0.25, 6.95, 0.3);
  gamepad('#1b1b1f', cx + 0.3, 7.05, -0.2);
  // Ковёр чуть выше пола — без z-fighting
  const rug = box(4.4, 0.015, 3.2, '#5b3a8a', cx, 0.005, 6.9);
  rug.castShadow = false;
  root.add(rug);

  // ---------- Пуфики ----------
  const toTv = (x, z) => Math.atan2(cx - x, tvZ - z);
  const POUFS = [
    [-23.9, 2.3, '#ef476f', Math.PI], // к теннисному столу
    [-22.6, 2.6, '#ffd166', Math.PI],
    [-21.3, 2.7, '#06d6a0', Math.PI],
    [-23.0, 6.2, '#118ab2', null],    // к ТВ
    [-18.0, 6.2, '#8338ec', null],
  ];
  const seats = POUFS.map(([x, z, color, faceTo], k) => {
    const darker = `#${new THREE.Color(color).multiplyScalar(0.75).getHexString()}`;
    root.add(cyl(POUF_R, 0.4, POUF_H, 8, color, x, 0, z));
    root.add(cyl(POUF_R + 0.005, POUF_R + 0.005, 0.04, 8, darker, x, POUF_H / 2 - 0.02, z)); // шов
    solid(x - POUF_R, z - POUF_R, x + POUF_R, z + POUF_R);
    const face = faceTo ?? toTv(x, z);
    return {
      id: `pouf-${k + 1}`,
      x,
      z,
      face,
      stand: { x: x + Math.sin(face) * STAND_OFFSET, z: z + Math.cos(face) * STAND_OFFSET },
    };
  });

  // ---------- Кофе-бар у северной стены ----------
  const barX = -17.3;
  const barZ = north + 0.4; // -2.45
  root.add(box(1.7, 0.88, 0.7, '#5a6b7a', barX, 0, barZ));
  root.add(box(1.76, 0.05, 0.76, '#e9e6df', barX, 0.88, barZ));
  solid(barX - 0.93, barZ - 0.43, barX + 0.93, barZ + 0.43);
  const coffee = createCoffeeMachine();
  coffee.group.position.set(barX + 0.3, 0.93, barZ - 0.05);
  root.add(coffee.group);
  // Стопка стаканчиков: каждый следующий чуть шире — боковые грани не совпадают (иначе z-fighting)
  for (let k = 0; k < 3; k++) root.add(cyl(0.05 + k * 0.003, 0.038 + k * 0.003, 0.06, 8, '#f6f1e7', barX - 0.4, 0.93 + k * 0.035, barZ - 0.1));
  root.add(cyl(0.05, 0.06, 0.14, 6, '#e9e6df', barX - 0.7, 0.93, barZ + 0.05)); // вазочка с лавандой
  for (let k = 0; k < 5; k++) {
    const sprig = cyl(0.012, 0.008, 0.26, 4, '#9d79c7', barX - 0.7 + Math.cos(k * 1.3) * 0.03, 1.02, barZ + 0.05 + Math.sin(k * 1.3) * 0.03);
    sprig.rotation.z = (k - 2) * 0.12;
    root.add(sprig);
  }
  const menu = textPlane('Лавандовый раф', { color: '#5b3a8a', bg: '#f3ecfb', height: 0.22, maxWidth: 1.6 });
  menu.position.set(barX, 1.75, north + 0.01);
  root.add(menu);
  spots.coffee = { x: barX + 0.3, z: -1.35, face: Math.PI };

  // ---------- Декор ----------
  // Открытый стеллаж с настольными играми в юго-западном углу, лицом на север (−z)
  const shelf = group(
    box(1.4, 1.6, 0.04, '#6b4f36', 0, 0, 0.18),
    box(0.04, 1.6, 0.4, '#6b4f36', -0.68, 0, 0),
    box(0.04, 1.6, 0.4, '#6b4f36', 0.68, 0, 0),
  );
  const LEVELS = [0, 0.53, 1.06];
  for (const y of [...LEVELS, 1.57]) shelf.add(box(1.32, 0.03, 0.36, '#5a412c', 0, y, 0));
  // Стопки коробок: [полка, смещение по x, цвета снизу вверх]
  const STACKS = [
    [0, -0.4, ['#ef476f', '#118ab2', '#ffd166']],
    [0, 0.3, ['#06d6a0', '#8338ec']],
    [1, -0.25, ['#ff9f1c', '#f4f4f2', '#118ab2']],
    [2, 0.2, ['#8338ec', '#ef476f']],
  ];
  for (const [level, x, colors] of STACKS) {
    colors.forEach((color, k) => shelf.add(box(0.36, 0.07, 0.3, color, x + (k % 2) * 0.03, LEVELS[level] + 0.03 + k * 0.07, -0.02)));
  }
  shelf.position.set(-23.8, 0, south - 0.2);
  root.add(shelf);
  solidFrom(shelf, 0.05);

  plant(west + 0.55, north + 0.55);
  plant(room.x1 - 0.8, south - 0.55);

  // Постеры на западном простенке, лицом в комнату (+x)
  const poster = (text, bg, color, z) => {
    const g = group(box(0.72, 0.92, 0.03, '#1b1b2f', 0, 0, 0), box(0.62, 0.82, 0.01, bg, 0, 0.05, 0.02));
    const label = textPlane(text, { color, height: 0.16, maxWidth: 0.56 }); // поле постера 0.62 м
    label.position.set(0, 0.46, 0.031);
    g.add(label);
    g.position.set(west + 0.02, 1.45, z);
    g.rotation.y = Math.PI / 2;
    root.add(g);
  };
  poster('Level Up!', '#5b3a8a', '#ffd166', 2.2);
  poster('GG', '#118ab2', '#f4f4f2', 3.8);

  // Неоновая надпись на тёмной плашке у северной стены
  root.add(box(2.2, 0.4, 0.04, '#1b1b2f', -23.3, 2.4, north));
  const neon = textPlane('Играй · Отдыхай · Кодь', { color: '#ff6bd6', height: 0.24, maxWidth: 2.05 }); // плашка 2.2 м
  neon.material.emissive = new THREE.Color('#ff6bd6');
  neon.material.emissiveMap = neon.material.map;
  neon.material.emissiveIntensity = 0.8;
  neon.position.set(-23.3, 2.6, north + 0.025);
  root.add(neon);

  return { seats, coffee, pingPong };
}
