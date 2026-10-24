// Интерьер офиса: мелочи на рабочих столах (InstancedMesh), часы, МФУ, кулер, вешалка, постеры,
// доска меню в столовой, глобус и торшер у директора. Расставлено с проходами ≥ 1.2 м и не ближе 1.2 м к квестовым точкам.
// Помощники офиса (root, solidFrom, animated) приходят в ctx из world/office.js.
import * as THREE from 'three';
import { mat, glow, box, cyl, ico, group, textPlane, createRng } from './lowpoly.js';

const DESK_TOP = 0.78;
const MUG_COLORS = ['#ef476f', '#118ab2', '#ffd166', '#f4f4f2', '#2e9e5b'];
// Предметы на столе в локальных координатах стола (монитор у −z, клавиатура у +z)
const ON_DESK = {
  mug: [-0.65, 0.15],
  cactus: [0.7, -0.3],
  paper: [-0.55, -0.25],
};

// Мелочи на столах: 4 InstancedMesh без теней — +4 draw call на все столы
function addDeskClutter(root, desks) {
  const rng = createRng(4242);
  const placed = { mug: [], cactus: [], paper: [] };
  for (const d of desks) {
    const kinds = Object.keys(ON_DESK).filter(() => rng() < 0.5).slice(0, 2);
    if (kinds.length === 0) kinds.push(Object.keys(ON_DESK)[Math.floor(rng() * 3)]);
    for (const kind of kinds) {
      const [lx, lz] = ON_DESK[kind];
      placed[kind].push({ x: d.x + lx, z: d.z + lz, rot: rng() * Math.PI });
    }
  }
  const dummy = new THREE.Object3D();
  const instanced = (geometry, material, items, colorOf) => {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    items.forEach((it, k) => {
      dummy.position.set(it.x, DESK_TOP, it.z);
      dummy.rotation.set(0, it.rot, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
      if (colorOf) mesh.setColorAt(k, new THREE.Color(colorOf(k)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = mesh.receiveShadow = false;
    root.add(mesh);
  };
  // Геометрии с основанием в y = 0
  instanced(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8).translate(0, 0.05, 0), mat('#ffffff'), placed.mug, (k) => MUG_COLORS[k % MUG_COLORS.length]);
  instanced(new THREE.CylinderGeometry(0.06, 0.045, 0.08, 6).translate(0, 0.04, 0), mat('#c06a3a'), placed.cactus);
  instanced(new THREE.CylinderGeometry(0.035, 0.04, 0.14, 6).translate(0, 0.08 + 0.07, 0), mat('#3f9b4f'), placed.cactus);
  instanced(new THREE.BoxGeometry(0.3, 0.04, 0.21).translate(0, 0.02, 0), mat('#f7f7f2'), placed.paper);
}

// Постер в рамке, лицом в +z: тёмная рамка, цветное поле и надпись в несколько строк
function poster(lines, bg, color) {
  const g = group(box(0.8, 1.0, 0.03, '#2b2d42', 0, 0, 0), box(0.7, 0.9, 0.01, bg, 0, 0.05, 0.02));
  lines.forEach((text, k) => {
    const label = textPlane(text, { color, height: 0.17, maxWidth: 0.62 }); // поле постера 0.7 м
    label.position.set(0, 0.5 + ((lines.length - 1) / 2 - k) * 0.2, 0.031);
    g.add(label);
  });
  return g;
}

export function addOfficeDecor(ctx, { desks }) {
  const { root, solidFrom, animated } = ctx;
  addDeskClutter(root, desks);

  // ---------- Open-space ----------
  // Настенные часы на перегородке, лицом в open-space (−x); стрелки идут по реальному времени
  // Циферблат лицом в +z: обод и белый диск — цилиндры, повёрнутые осью к зрителю
  const clock = new THREE.Group();
  for (const [r, depth, color] of [[0.36, 0.04, '#2b2d42'], [0.32, 0.05, '#f7f7f2']]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, 16).rotateX(Math.PI / 2), mat(color));
    disc.position.z = depth / 2;
    clock.add(disc);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const len = k % 3 === 0 ? 0.06 : 0.035;
    clock.add(box(0.02, len, 0.01, '#2b2d42', Math.sin(a) * 0.27, Math.cos(a) * 0.27 - len / 2, 0.05));
  }
  // Стрелка вращается вокруг центра циферблата: геометрия начинается в нуле и идёт вверх
  const hand = (len, w, color, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.01).translate(0, len / 2 - 0.03, 0), mat(color));
    m.position.z = z; // у каждой стрелки своя глубина — без z-fighting в центре
    clock.add(m);
    return m;
  };
  const hourHand = hand(0.17, 0.035, '#2b2d42', 0.056);
  const minuteHand = hand(0.25, 0.022, '#2b2d42', 0.062);
  const secondHand = hand(0.27, 0.008, '#e63946', 0.068);
  clock.position.set(4.83, 3.0, 0);
  clock.rotation.y = -Math.PI / 2;
  root.add(clock);
  animated.push(() => {
    const now = new Date();
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    // По часовой стрелке, если смотреть на циферблат, — отрицательный угол
    secondHand.rotation.z = -(s / 60) * Math.PI * 2;
    minuteHand.rotation.z = -(m / 60) * Math.PI * 2;
    hourHand.rotation.z = -(h / 12) * Math.PI * 2;
  });

  // МФУ на тумбе у перегородки, лицом в open-space (−x)
  const printer = group(
    box(0.8, 0.6, 0.6, '#5a6b7a', 0, 0, 0),
    box(0.62, 0.36, 0.5, '#e6e8ea', 0, 0.6, 0),
    box(0.62, 0.05, 0.5, '#3a3d44', 0, 0.96, 0),   // крышка сканера
    box(0.36, 0.02, 0.2, '#f7f7f2', 0, 0.75, 0.3),  // лоток с бумагой
    box(0.06, 0.03, 0.02, null, 0.22, 0.86, 0.255, glow('#06d6a0', 1.2)),
  );
  printer.position.set(4.35, 0, -9.3);
  printer.rotation.y = -Math.PI / 2;
  root.add(printer);
  solidFrom(printer, 0.05);

  // Кулер с водой у перегородки
  const cooler = group(
    box(0.38, 1.0, 0.38, '#eef1f3', 0, 0, 0),
    box(0.3, 0.12, 0.04, '#9aa3ab', 0, 0.7, 0.2),
    box(0.04, 0.05, 0.05, null, -0.07, 0.74, 0.22, glow('#4cc9f0', 1)),
    box(0.04, 0.05, 0.05, null, 0.07, 0.74, 0.22, glow('#ef476f', 1)),
    cyl(0.17, 0.17, 0.42, 8, null, 0, 1.0, 0, mat('#8ecae6', { transparent: true, opacity: 0.75 })),
  );
  cooler.position.set(4.45, 0, 1.0);
  cooler.rotation.y = -Math.PI / 2;
  root.add(cooler);
  solidFrom(cooler, 0.05);

  // У выхода: вешалка с двумя куртками и зонтница
  const rack = group(
    cyl(0.25, 0.28, 0.04, 8, '#3f2919', 0, 0, 0),
    cyl(0.03, 0.03, 1.75, 6, '#3f2919', 0, 0, 0),
    box(0.5, 0.03, 0.03, '#3f2919', 0, 1.65, 0),
    box(0.03, 0.03, 0.5, '#3f2919', 0, 1.65, 0),
    box(0.4, 0.75, 0.14, '#264653', 0.2, 0.9, 0),  // куртка
    box(0.14, 0.6, 0.36, '#c0612b', 0, 1.0, -0.18), // куртка
  );
  rack.position.set(-1.9, 0, 11.35);
  root.add(rack);
  solidFrom(rack, 0.05);
  const umbrellas = group(
    cyl(0.16, 0.14, 0.5, 8, '#2b2d42', 0, 0, 0),
    cyl(0.015, 0.015, 0.75, 4, '#e63946', -0.05, 0.2, 0.03),
    cyl(0.015, 0.015, 0.7, 4, '#ffd166', 0.05, 0.2, -0.03),
  );
  umbrellas.children[1].rotation.z = 0.12;
  umbrellas.children[2].rotation.z = -0.1;
  umbrellas.position.set(2.4, 0, 11.5);
  root.add(umbrellas);
  solidFrom(umbrellas, 0.05);

  // Постеры на южной стене и на стене столовой со стороны open-space — лицом от стены (−z)
  const POSTERS = [
    [['Код.', 'Тест.', 'Релиз.'], '#2e9e5b', '#f7f7f2', -0.8, 12 - 0.15],
    [['Ошибки —', 'это опыт'], '#ffd166', '#2b2d42', 3.2, 12 - 0.15],
    [['Коммить', 'почаще'], '#118ab2', '#f7f7f2', -14.3, 4.5 - 0.15],
  ];
  for (const [lines, bg, color, x, z] of POSTERS) {
    const p = poster(lines, bg, color);
    p.position.set(x, 1.4, z - 0.02);
    p.rotation.y = Math.PI;
    root.add(p);
  }

  // ---------- Столовая ----------
  // Доска «Меню дня» на стене столовой изнутри, лицом на юг (+z)
  const menu = group(box(1.3, 1.0, 0.04, '#6b4f36', 0, 0, 0), box(1.18, 0.88, 0.01, '#2b3a2f', 0, 0.06, 0.025));
  const MENU_LINES = [['Меню дня', '#ffd166', 0.12], ['Борщ', '#f7f7f2', 0.08], ['Котлета с пюре', '#f7f7f2', 0.08], ['Компот', '#f7f7f2', 0.08]];
  MENU_LINES.forEach(([text, color, height], k) => {
    const line = textPlane(text, { color, height, maxWidth: 1.05 }); // доска 1.18 м
    line.position.set(0, 0.8 - k * 0.18, 0.031);
    menu.add(line);
  });
  menu.position.set(-8.2, 1.4, 4.5 + 0.15 + 0.02);
  root.add(menu);

  // Ваза с фруктами на обеденном столе
  const bowl = group(cyl(0.16, 0.1, 0.08, 8, '#f4f1ea', 0, 0, 0));
  const FRUITS = [[0.06, 0.04, '#e63946'], [-0.05, 0.05, '#ffd166'], [0.0, -0.06, '#f4a261'], [-0.02, 0.0, '#6bbf59']];
  for (const [fx, fz, color] of FRUITS) {
    const fruit = ico(0.055, color, 1);
    fruit.position.set(fx, 0.1, fz);
    bowl.add(fruit);
  }
  bowl.position.set(-9.1, 0.745, 7.7);
  root.add(bowl);

  // ---------- Кабинет директора ----------
  const globe = group(
    cyl(0.18, 0.22, 0.05, 8, '#4a2e1c', 0, 0, 0),
    cyl(0.03, 0.03, 0.75, 6, '#4a2e1c', 0, 0, 0),
  );
  const sphere = ico(0.25, '#3f8fd6', 1);
  sphere.position.y = 1.0;
  const land = ico(0.252, '#6bbf59', 0);
  land.scale.set(1, 0.7, 0.6);
  land.position.set(0.04, 1.03, 0.03);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.012, 4, 16), mat('#c99a2e', { metalness: 0.4 }));
  ring.position.y = 1.0;
  ring.rotation.y = Math.PI / 2;
  globe.add(sphere, land, ring);
  globe.rotation.y = 0.4;
  globe.position.set(14.6, 0, -1.2);
  root.add(globe);
  solidFrom(globe, 0.05);

  const lamp = group(
    cyl(0.2, 0.22, 0.04, 8, '#2b2d42', 0, 0, 0),
    cyl(0.02, 0.02, 1.55, 6, '#2b2d42', 0, 0, 0),
    cyl(0.16, 0.26, 0.3, 8, null, 0, 1.5, 0, glow('#fff1cf', 0.6)),
  );
  lamp.position.set(14.9, 0, -3.2);
  root.add(lamp);
  solidFrom(lamp, 0.05);
}
