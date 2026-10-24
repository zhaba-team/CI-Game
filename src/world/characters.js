// Сборка low-poly персонажей из примитивов. Внешность описывается объектом style,
// поэтому новых NPC можно добавлять без моделей — достаточно описать стиль.
import * as THREE from 'three';
import { mat, box, ico, textPlane } from './lowpoly.js';

// Цвета — hex-строки. Поля одежды collar / belt / cargo / soles / socks / shoeStripe / chestText
// по умолчанию выключены (null).
const DEFAULT_STYLE = {
  skin: '#f1c7a1',
  shirt: '#3f8f5f',
  pants: '#2f3a4a',
  shoes: '#222222',
  hair: '#3b2a20',
  hairStyle: 'short', // short | parted | quiff | long | bun | spiky | bob | none
  beardStyle: 'none', // none | full | trimmed | goatee | stubble
  beardColor: null,   // по умолчанию — цвет hair
  mouth: 'smile',     // smile | grin | neutral
  glassesStyle: 'classic', // classic | bold — вид аксессуара glasses
  accent: '#ffffff',
  accessories: [],    // glasses | beard | beret | beanie | headphones | tie | jacket | backpack | badge | scarf | hood
  collar: null,       // расстёгнутый ворот рубашки (цвет)
  belt: null,         // ремень с пряжкой (цвет)
  cargo: null,        // боковые карманы на штанах (цвет)
  soles: null,        // светлая подошва кроссовок (цвет)
  socks: null,        // видимые носки между штаниной и обувью (цвет)
  shoeStripe: null,   // полоса по бокам кед (цвет)
  sleeves: 'long',    // long | short
  chestText: null,    // надпись на груди (строка)
  chestTextColor: '#ffffff',
  build: 1,           // массивность: 1 — обычная, >1 — шире и плотнее
  height: 1,
};

// Поза сидя: бедро (y 0.82) опускается к сиденью высотой ~0.45 м с учётом толщины ноги
const SIT_DROP = -0.3;
const SIT_LEGS = -Math.PI / 2 + 0.12; // ноги вперёд, ступни чуть ниже колен
const SIT_ARMS = -0.7;                // руки вперёд, на столешницу

const HAIR_STYLES = ['short', 'parted', 'quiff', 'long', 'bun', 'spiky', 'bob', 'none'];
const BEARD_STYLES = ['none', 'full', 'trimmed', 'goatee', 'stubble'];
const MOUTHS = ['smile', 'grin', 'neutral'];
const GLASSES_STYLES = ['classic', 'bold'];
const SLEEVES = ['long', 'short'];
const ACCESSORIES = ['glasses', 'beard', 'beret', 'beanie', 'headphones', 'tie', 'jacket', 'backpack', 'badge', 'scarf', 'hood'];

// Только в dev-сборке: подсказывает об опечатках в style, в продакшене вырезается.
function warnUnknownStyle(s) {
  const check = (field, value, allowed) => {
    if (!allowed.includes(value)) console.warn(`[characters] неизвестное значение style.${field}: ${value}`);
  };
  check('hairStyle', s.hairStyle, HAIR_STYLES);
  check('beardStyle', s.beardStyle, BEARD_STYLES);
  check('mouth', s.mouth, MOUTHS);
  check('glassesStyle', s.glassesStyle, GLASSES_STYLES);
  check('sleeves', s.sleeves, SLEEVES);
  s.accessories.forEach((a) => check('accessories', a, ACCESSORIES));
}

function limb(w, h, d, color, pivotY, pivotX) {
  const pivot = new THREE.Group();
  pivot.position.set(pivotX, pivotY, 0);
  const mesh = box(w, h, d, color, 0, -h, 0);
  pivot.add(mesh);
  return pivot;
}

function addHair(head, s) {
  const c = s.hair;
  switch (s.hairStyle) {
    case 'short':
      head.add(box(0.44, 0.12, 0.42, c, 0, 0.4, -0.01));
      head.add(box(0.44, 0.28, 0.08, c, 0, 0.18, -0.19));
      break;
    case 'parted': {
      // Опрятная короткая стрижка: шапка, чёлка набок с пробором, виски, затылок.
      // Все грани вынесены за поверхность головы — без совпадающих плоскостей.
      head.add(box(0.43, 0.07, 0.41, c, 0, 0.45, -0.005));
      const fringe = box(0.29, 0.07, 0.08, c, 0.045, 0.46, 0.175);
      fringe.rotation.z = -0.08;
      head.add(fringe);
      head.add(box(0.11, 0.05, 0.06, c, -0.15, 0.455, 0.18)); // чёлка за пробором, ниже основной
      for (const sx of [-1, 1]) head.add(box(0.03, 0.17, 0.3, c, sx * 0.21, 0.3, -0.035)); // виски над зоной ушей
      head.add(box(0.42, 0.3, 0.04, c, 0, 0.17, -0.195));   // затылок
      head.add(box(0.34, 0.07, 0.03, c, 0, 0.11, -0.185));  // сужение к шее
      break;
    }
    case 'quiff': {
      // Квифф: объёмный верх зачёсан вверх-назад, виски и затылок коротко (фейд).
      // Шапка уже головы по x/z — без совпадающих граней.
      head.add(box(0.36, 0.1, 0.34, c, 0, 0.47, -0.02));
      const lift = box(0.34, 0.1, 0.12, c, 0, 0.5, 0.11); // передний край выше заднего — читается в профиль
      lift.rotation.x = -0.35;
      head.add(lift);
      const fade = mat(c, { transparent: true, opacity: 0.55 });
      for (const sx of [-1, 1]) head.add(box(0.012, 0.175, 0.28, null, sx * 0.205, 0.3, -0.03, fade)); // виски до шапки
      head.add(box(0.4, 0.24, 0.012, null, 0, 0.18, -0.197, fade)); // затылок
      head.add(box(0.38, 0.08, 0.04, c, 0, 0.4, -0.18));             // сплошная полоса над затылком
      break;
    }
    case 'long':
      head.add(box(0.46, 0.13, 0.44, c, 0, 0.4, -0.01));
      head.add(box(0.48, 0.55, 0.1, c, 0, -0.08, -0.2));
      head.add(box(0.06, 0.42, 0.3, c, 0.23, 0.02, -0.04));
      head.add(box(0.06, 0.42, 0.3, c, -0.23, 0.02, -0.04));
      break;
    case 'bun': {
      head.add(box(0.44, 0.1, 0.42, c, 0, 0.41, -0.01));
      head.add(box(0.44, 0.26, 0.08, c, 0, 0.2, -0.19));
      const bun = ico(0.13, c);
      bun.position.set(0, 0.56, -0.08);
      head.add(bun);
      break;
    }
    case 'spiky':
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 4), mat(c));
        spike.position.set(-0.15 + (i % 3) * 0.15, 0.5, -0.1 + Math.floor(i / 3) * 0.16);
        spike.rotation.set((Math.floor(i / 3) - 0.5) * 0.5, 0, ((i % 3) - 1) * -0.4);
        spike.castShadow = true;
        head.add(spike);
      }
      head.add(box(0.44, 0.08, 0.42, c, 0, 0.41, 0)); // верх выше макушки: иначе z-fighting
      head.add(box(0.44, 0.3, 0.08, c, 0, 0.16, -0.19));
      break;
    case 'bob': {
      // Каре до подбородка с пробором по центру: шапка, шторка чёлки из двух половинок,
      // пряди по бокам до линии подбородка и затылок до шеи. Все грани — за поверхностью головы.
      head.add(box(0.45, 0.08, 0.43, c, 0, 0.45, -0.01));
      for (const sx of [-1, 1]) {
        const fringe = box(0.17, 0.13, 0.05, c, sx * 0.105, 0.36, 0.205);
        fringe.rotation.z = -sx * 0.18; // к вискам ниже — пробор посередине остаётся виден
        head.add(fringe);
        head.add(box(0.05, 0.44, 0.36, c, sx * 0.228, 0.07, -0.025)); // боковые пряди до подбородка
        head.add(box(0.05, 0.3, 0.06, c, sx * 0.2, 0.1, 0.17));       // пряди, обрамляющие лицо
      }
      head.add(box(0.46, 0.46, 0.05, c, 0, 0.05, -0.215)); // затылок до шеи
      break;
    }
    default:
      break;
  }
}

function addBeard(head, s) {
  // Аксессуар beard — прежний способ задать полную бороду
  const kind = s.beardStyle === 'none' && s.accessories.includes('beard') ? 'full' : s.beardStyle;
  const c = s.beardColor ?? s.hair;
  switch (kind) {
    case 'full':
      head.add(box(0.42, 0.16, 0.08, c, 0, -0.02, 0.17));
      head.add(box(0.16, 0.04, 0.03, c, 0, 0.12, 0.2));
      break;
    case 'trimmed':
      // Короткая аккуратная борода по линии челюсти с усами; рот между ними остаётся виден
      head.add(box(0.41, 0.1, 0.07, c, 0, -0.02, 0.165)); // подбородок
      for (const sx of [-1, 1]) {
        head.add(box(0.025, 0.17, 0.24, c, sx * 0.205, -0.015, 0.06)); // челюсть и скулы
        head.add(box(0.04, 0.07, 0.03, c, sx * 0.1, 0.06, 0.195));     // переход к усам
      }
      head.add(box(0.2, 0.035, 0.03, c, 0, 0.125, 0.2)); // усы
      break;
    case 'goatee':
      head.add(box(0.2, 0.15, 0.1, c, 0, -0.08, 0.16));     // клин на подбородке
      head.add(box(0.22, 0.04, 0.03, c, 0, 0.135, 0.2));    // усы
      head.add(box(0.04, 0.1, 0.03, c, -0.11, 0.04, 0.2));  // перемычки по углам рта
      head.add(box(0.04, 0.1, 0.03, c, 0.11, 0.04, 0.2));
      break;
    case 'stubble': {
      const m = mat(c, { transparent: true, opacity: 0.55 });
      head.add(box(0.41, 0.13, 0.012, null, 0, 0.04, 0.192, m));
      head.add(box(0.02, 0.13, 0.3, null, -0.205, 0.04, 0.03, m));
      head.add(box(0.02, 0.13, 0.3, null, 0.205, 0.04, 0.03, m));
      break;
    }
    default:
      break;
  }
}

function addMouth(head, s) {
  switch (s.mouth) {
    case 'grin':
      head.add(box(0.18, 0.06, 0.02, '#5a1f1f', 0, 0.07, 0.19));
      head.add(box(0.15, 0.022, 0.021, '#ffffff', 0, 0.105, 0.192)); // зубы
      break;
    case 'neutral':
      head.add(box(0.11, 0.018, 0.02, '#8c5546', 0, 0.1, 0.19));
      break;
    default:
      head.add(box(0.12, 0.025, 0.02, '#b5654f', 0, 0.1, 0.19));
      break;
  }
}

// Детали одежды: ворот, ремень, карманы-карго, подошвы, полосы на кедах. Каждая включается своим цветом в style.
function addClothes(parts, s) {
  const { torso, legL, legR } = parts;
  if (s.collar) {
    torso.add(box(0.1, 0.1, 0.01, s.skin, 0, 0.55, 0.163)); // V-вырез
    for (const sx of [-1, 1]) {
      const wing = box(0.11, 0.07, 0.03, s.collar, sx * 0.07, 0.6, 0.165);
      wing.rotation.z = sx * 0.5;
      torso.add(wing);
    }
  }
  if (s.belt) {
    torso.add(box(0.58, 0.06, 0.34, s.belt, 0, 0, 0));
    torso.add(box(0.08, 0.05, 0.02, '#c9c9c9', 0, 0.005, 0.172)); // пряжка
  }
  for (const [leg, sx] of [[legL, -1], [legR, 1]]) {
    if (s.cargo) {
      leg.add(box(0.05, 0.2, 0.17, s.cargo, sx * 0.11 * s.build, -0.52, 0));
      leg.add(box(0.055, 0.04, 0.18, s.cargo, sx * 0.11 * s.build, -0.34, 0)); // клапан
    }
    if (s.soles) leg.add(box(0.23 * s.build, 0.04, 0.31, s.soles, 0, -0.82, 0.04));
    // Полоса снаружи и изнутри кеда, над подошвой (подошва — до y −0.78)
    if (s.shoeStripe) {
      for (const side of [-1, 1]) leg.add(box(0.008, 0.03, 0.2, s.shoeStripe, side * (0.11 * s.build + 0.004), -0.78, 0.04));
    }
  }
}

// Принт на груди справа у носящего (слева для зрителя).
function addChestText(parts, s) {
  if (!s.chestText) return;
  const plane = textPlane(s.chestText, { color: s.chestTextColor, height: 0.11 });
  plane.position.set(-0.13, 0.52, 0.163);
  plane.scale.x = 1 / s.build; // торс растянут по x — буквы не должны растягиваться
  parts.torso.add(plane);
}

const LENS = { transparent: true, opacity: 0.55 };

// Тонкая оправа с линзами, закрывающими глаза
function addClassicGlasses(head, frame) {
  head.add(box(0.14, 0.1, 0.03, frame, -0.1, 0.2, 0.2));
  head.add(box(0.14, 0.1, 0.03, frame, 0.1, 0.2, 0.2));
  head.add(box(0.06, 0.02, 0.03, frame, 0, 0.24, 0.2));
  const lens = mat('#bfe6ff', LENS);
  head.add(box(0.1, 0.06, 0.01, null, -0.1, 0.22, 0.217, lens));
  head.add(box(0.1, 0.06, 0.01, null, 0.1, 0.22, 0.217, lens));
}

// Толстая оправа-рамка: глаза видны сквозь линзу, дужки до ушей
function addBoldGlasses(head, frame) {
  const lens = mat('#bfe6ff', LENS);
  for (const sx of [-1, 1]) {
    const x = sx * 0.1;
    head.add(box(0.16, 0.03, 0.035, frame, x, 0.29, 0.21));  // верх оправы
    head.add(box(0.16, 0.025, 0.035, frame, x, 0.19, 0.21)); // низ оправы
    for (const side of [-1, 1]) head.add(box(0.025, 0.125, 0.035, frame, x + side * 0.0675, 0.19, 0.21));
    head.add(box(0.11, 0.075, 0.006, null, x, 0.215, 0.222, lens));
    head.add(box(0.045, 0.02, 0.025, frame, sx * 0.1925, 0.271, 0.21)); // шарнир: соединяет оправу с дужкой
    head.add(box(0.015, 0.022, 0.22, frame, sx * 0.21, 0.27, 0.09));    // дужка
  }
  head.add(box(0.05, 0.022, 0.03, frame, 0, 0.25, 0.215)); // перемычка
}

function addAccessories(root, parts, s) {
  const { head, torso } = parts;
  const has = (a) => s.accessories.includes(a);
  const dark = '#1d1d1d';

  if (has('glasses')) {
    const addGlasses = s.glassesStyle === 'bold' ? addBoldGlasses : addClassicGlasses;
    addGlasses(head, s.glassesColor ?? dark);
  }
  if (has('beret')) {
    const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.25, 0.09, 8), mat(s.accent));
    beret.position.set(0.04, 0.5, -0.02);
    beret.rotation.z = -0.25;
    beret.castShadow = true;
    head.add(beret);
  }
  if (has('beanie')) {
    head.add(box(0.47, 0.2, 0.45, s.accent, 0, 0.36, -0.01));
    head.add(box(0.49, 0.07, 0.47, s.accent2 ?? '#222', 0, 0.33, -0.01));
  }
  if (has('headphones')) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 4, 10, Math.PI), mat(dark));
    band.position.set(0, 0.24, 0);
    band.castShadow = true;
    head.add(band);
    head.add(box(0.06, 0.14, 0.12, s.accent, -0.23, 0.15, 0));
    head.add(box(0.06, 0.14, 0.12, s.accent, 0.23, 0.15, 0));
  }
  if (has('tie')) {
    torso.add(box(0.08, 0.38, 0.02, s.accent, 0, 0.2, 0.17));
  }
  if (has('jacket')) {
    // Полы чуть шире торса, чтобы бока рубашки не просвечивали (z-fighting)
    torso.add(box(0.21, 0.62, 0.34, s.jacket, -0.185, 0.02, 0.005));
    torso.add(box(0.21, 0.62, 0.34, s.jacket, 0.185, 0.02, 0.005));
    torso.add(box(0.58, 0.62, 0.1, s.jacket, 0, 0.02, -0.13));
    parts.armL.children[0].material = mat(s.jacket);
    parts.armR.children[0].material = mat(s.jacket);
  }
  if (has('backpack')) {
    torso.add(box(0.42, 0.5, 0.18, s.accent, 0, 0.08, -0.24));
    torso.add(box(0.3, 0.18, 0.06, s.accent2 ?? '#222', 0, 0.12, -0.35));
  }
  if (has('badge')) {
    torso.add(box(0.12, 0.08, 0.02, '#ffffff', 0.14, 0.42, 0.17));
    torso.add(box(0.12, 0.025, 0.021, s.accent, 0.14, 0.47, 0.172));
  }
  if (has('scarf')) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 4, 8), mat(s.accent));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.64, 0);
    torso.add(ring);
    torso.add(box(0.1, 0.32, 0.05, s.accent, 0.1, 0.3, 0.17));
  }
  if (has('hood')) {
    torso.add(box(0.46, 0.16, 0.14, s.shirt, 0, 0.6, -0.17));
    torso.add(box(0.04, 0.22, 0.02, '#ffffff', -0.08, 0.38, 0.17));
    torso.add(box(0.04, 0.22, 0.02, '#ffffff', 0.08, 0.38, 0.17));
  }
}

export function createCharacter(styleOverrides = {}) {
  const s = { ...DEFAULT_STYLE, ...styleOverrides };
  if (import.meta.env.DEV) warnUnknownStyle(s);
  const b = s.build;
  const root = new THREE.Group();
  const body = new THREE.Group(); // всё, что качается при ходьбе
  root.add(body);

  // Штанина заканчивается на верхней грани кроссовка, а не уходит внутрь него
  const legL = limb(0.2 * b, 0.72, 0.22, s.pants, 0.82, -0.13 * b);
  const legR = limb(0.2 * b, 0.72, 0.22, s.pants, 0.82, 0.13 * b);
  legL.add(box(0.22 * b, 0.1, 0.3, s.shoes, 0, -0.82, 0.04));
  legR.add(box(0.22 * b, 0.1, 0.3, s.shoes, 0, -0.82, 0.04));
  // Манжета джинсов чуть шире штанины и ложится на верх кроссовка — без совпадающих граней.
  // Укороченная штанина: между манжетой и кедом видна полоска носка.
  const cuffY = s.socks ? -0.62 : -0.74;
  for (const leg of [legL, legR]) {
    leg.add(box(0.215 * b, 0.05, 0.235, s.pants, 0, cuffY, 0));
    if (s.socks) leg.add(box(0.21 * b, 0.115, 0.228, s.socks, 0, -0.735, 0));
  }

  // Всё, что добавлено в torso (пиджак, ремень, ворот…), масштабируется вместе с ним
  const torso = new THREE.Group();
  torso.position.y = 0.82;
  torso.scale.set(b, 1, 1 + (b - 1) * 0.5);
  torso.add(box(0.56, 0.68, 0.32, s.shirt, 0, 0, 0));

  // Короткий рукав: рука цвета кожи и рукав поверх. Меш руки остаётся children[0] —
  // на него опирается аксессуар jacket (с коротким рукавом не сочетается).
  const short = s.sleeves === 'short';
  const armColor = short ? s.skin : s.shirt;
  const armL = limb(0.15, 0.58, 0.17, armColor, 1.42, -0.36 * b);
  const armR = limb(0.15, 0.58, 0.17, armColor, 1.42, 0.36 * b);
  if (short) {
    // Рукав чуть выше руки: иначе верхние грани совпадают и мерцают (z-fighting)
    armL.add(box(0.17, 0.27, 0.19, s.shirt, 0, -0.26, 0));
    armR.add(box(0.17, 0.27, 0.19, s.shirt, 0, -0.26, 0));
  }
  armL.add(box(0.13, 0.13, 0.14, s.skin, 0, -0.71, 0));
  armR.add(box(0.13, 0.13, 0.14, s.skin, 0, -0.71, 0));

  const head = new THREE.Group();
  head.position.y = 1.5;
  head.scale.x = 1 + (b - 1) * 0.4; // шире лицо у массивных персонажей
  head.add(box(0.12, 0.08, 0.12, s.skin, 0, 0, 0));          // шея
  head.add(box(0.4, 0.42, 0.38, s.skin, 0, 0.06, 0));        // голова
  head.add(box(0.06, 0.07, 0.02, '#1e1e1e', -0.1, 0.21, 0.19));
  head.add(box(0.06, 0.07, 0.02, '#1e1e1e', 0.1, 0.21, 0.19));
  addMouth(head, s);
  addHair(head, s);
  addBeard(head, s);

  body.add(legL, legR, torso, armL, armR, head);
  const parts = { legL, legR, armL, armR, torso, head, body };
  addClothes(parts, s);
  addChestText(parts, s);
  addAccessories(root, parts, s);

  root.scale.setScalar(s.height);

  let phase = 0;
  let sitting = false;
  root.userData.parts = parts;
  // 'sit' — бёдра на высоте сиденья SEAT_H, ноги вперёд, руки на столе; 'stand' — обычная поза
  root.userData.setPose = (pose) => { sitting = pose === 'sit'; };
  // speed — текущая скорость (м/с), чтобы анимация ходьбы соответствовала движению
  root.userData.animate = (dt, speed, time) => {
    const moving = speed > 0.1 && !sitting;
    phase += dt * (moving ? 2.2 + speed * 1.3 : 0);
    const swing = moving ? Math.sin(phase) * Math.min(0.7, speed * 0.16) : 0;
    const lerp = 1 - Math.exp(-dt * 12);
    const leg = sitting ? SIT_LEGS : 0;
    const arm = sitting ? SIT_ARMS : 0;
    legL.rotation.x += (leg + swing - legL.rotation.x) * lerp;
    legR.rotation.x += (leg - swing - legR.rotation.x) * lerp;
    armL.rotation.x += (arm - swing - armL.rotation.x) * lerp;
    armR.rotation.x += (arm + swing - armR.rotation.x) * lerp;
    const base = sitting ? SIT_DROP : 0;
    body.position.y = base + (moving ? Math.abs(Math.sin(phase)) * 0.05 : Math.sin(time * 2) * 0.012);
  };
  return root;
}
