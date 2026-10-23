// Сборка low-poly персонажей из примитивов. Внешность описывается объектом style,
// поэтому новых NPC можно добавлять без моделей — достаточно описать стиль.
import * as THREE from 'three';
import { mat, box, ico } from './lowpoly.js';

const DEFAULT_STYLE = {
  skin: '#f1c7a1',
  shirt: '#3f8f5f',
  pants: '#2f3a4a',
  shoes: '#222222',
  hair: '#3b2a20',
  hairStyle: 'short', // short | long | bun | spiky | none
  accent: '#ffffff',
  accessories: [],    // glasses | beard | beret | beanie | headphones | tie | jacket | backpack | badge | scarf | hood
  height: 1,
};

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
      head.add(box(0.44, 0.08, 0.42, c, 0, 0.4, 0));
      head.add(box(0.44, 0.3, 0.08, c, 0, 0.16, -0.19));
      break;
    default:
      break;
  }
}

function addAccessories(root, parts, s) {
  const { head, torso } = parts;
  const has = (a) => s.accessories.includes(a);
  const dark = '#1d1d1d';

  if (has('glasses')) {
    const frame = s.glassesColor ?? dark;
    head.add(box(0.14, 0.1, 0.03, frame, -0.1, 0.2, 0.2));
    head.add(box(0.14, 0.1, 0.03, frame, 0.1, 0.2, 0.2));
    head.add(box(0.06, 0.02, 0.03, frame, 0, 0.24, 0.2));
    const lens = mat('#bfe6ff', { transparent: true, opacity: 0.55 });
    head.add(box(0.1, 0.06, 0.01, null, -0.1, 0.22, 0.217, lens));
    head.add(box(0.1, 0.06, 0.01, null, 0.1, 0.22, 0.217, lens));
  }
  if (has('beard')) {
    head.add(box(0.42, 0.16, 0.08, s.hair, 0, -0.02, 0.17));
    head.add(box(0.16, 0.04, 0.03, s.hair, 0, 0.12, 0.2));
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
    torso.add(box(0.2, 0.62, 0.34, s.jacket, -0.18, 0.02, 0.005));
    torso.add(box(0.2, 0.62, 0.34, s.jacket, 0.18, 0.02, 0.005));
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
  const root = new THREE.Group();
  const body = new THREE.Group(); // всё, что качается при ходьбе
  root.add(body);

  const legL = limb(0.2, 0.78, 0.22, s.pants, 0.82, -0.13);
  const legR = limb(0.2, 0.78, 0.22, s.pants, 0.82, 0.13);
  legL.add(box(0.22, 0.1, 0.3, s.shoes, 0, -0.82, 0.04));
  legR.add(box(0.22, 0.1, 0.3, s.shoes, 0, -0.82, 0.04));

  const torso = new THREE.Group();
  torso.position.y = 0.82;
  torso.add(box(0.56, 0.68, 0.32, s.shirt, 0, 0, 0));

  const armL = limb(0.15, 0.58, 0.17, s.shirt, 1.42, -0.36);
  const armR = limb(0.15, 0.58, 0.17, s.shirt, 1.42, 0.36);
  armL.add(box(0.13, 0.13, 0.14, s.skin, 0, -0.71, 0));
  armR.add(box(0.13, 0.13, 0.14, s.skin, 0, -0.71, 0));

  const head = new THREE.Group();
  head.position.y = 1.5;
  head.add(box(0.12, 0.08, 0.12, s.skin, 0, 0, 0));          // шея
  head.add(box(0.4, 0.42, 0.38, s.skin, 0, 0.06, 0));        // голова
  head.add(box(0.06, 0.07, 0.02, '#1e1e1e', -0.1, 0.21, 0.19));
  head.add(box(0.06, 0.07, 0.02, '#1e1e1e', 0.1, 0.21, 0.19));
  head.add(box(0.12, 0.025, 0.02, '#b5654f', 0, 0.1, 0.19)); // улыбка
  addHair(head, s);

  body.add(legL, legR, torso, armL, armR, head);
  const parts = { legL, legR, armL, armR, torso, head, body };
  addAccessories(root, parts, s);

  root.scale.setScalar(s.height);

  let phase = 0;
  root.userData.parts = parts;
  // speed — текущая скорость (м/с), чтобы анимация ходьбы соответствовала движению
  root.userData.animate = (dt, speed, time) => {
    const moving = speed > 0.1;
    phase += dt * (moving ? 2.2 + speed * 1.3 : 0);
    const swing = moving ? Math.sin(phase) * Math.min(0.7, speed * 0.16) : 0;
    const lerp = 1 - Math.exp(-dt * 12);
    legL.rotation.x += (swing - legL.rotation.x) * lerp;
    legR.rotation.x += (-swing - legR.rotation.x) * lerp;
    armL.rotation.x += (-swing - armL.rotation.x) * lerp;
    armR.rotation.x += (swing - armR.rotation.x) * lerp;
    body.position.y = moving ? Math.abs(Math.sin(phase)) * 0.05 : Math.sin(time * 2) * 0.012;
  };
  return root;
}
