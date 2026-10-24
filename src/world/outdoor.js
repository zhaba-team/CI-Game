// Улица за окнами: газон, Г-образная дорога с парковкой, low-poly деревья, кусты и машины.
// Западная улица отступает за пристройки офиса (outline.annexes), у их стен — деревья и кусты.
// Всё через InstancedMesh, без теней и коллизий — только декорация.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, createRng } from './lowpoly.js';

const LEAF_COLORS = ['#3f9b4f', '#55b864', '#4a8f3c', '#6bbf59'];
const SPRUCE_COLORS = ['#2f7a46', '#3b8a50', '#2a6b40'];
const CAR_COLORS = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#ffd166', '#f1faee', '#6d597a', '#264653'];
const SIDEWALK = '#c9c6bf';
const ROAD = '#4a4e55';
const SLOT = 5.5; // шаг парковочных мест

// Модели машин: кузов L × H × W и кабина L × H × W со смещением по x (длина — вдоль локального x)
const CAR_MODELS = [
  { body: [4.2, 0.7, 1.8], cabin: [2.3, 0.6, 1.6], offset: -0.2 },  // седан
  { body: [3.6, 0.75, 1.7], cabin: [2.0, 0.65, 1.55], offset: -0.5 }, // хэтчбек
  { body: [4.6, 1.1, 1.9], cabin: [3.4, 0.65, 1.8], offset: -0.4 },   // минивэн
];
const CAR_BOTTOM = 0.3;
const WHEEL_R = 0.33;

// Бокс L × H × W с низом на высоте y и центром в (x, ·, 0)
function boxAt(l, h, w, x, y) {
  return new THREE.BoxGeometry(l, h, w).translate(x, y + h / 2, 0);
}

export function buildOutdoor(outline) {
  const root = new THREE.Group();
  const stats = { trees: 0, bushes: 0, cars: 0, drawCalls: 0 };
  const rng = createRng(20261024);
  const range = (a, b) => a + rng() * (b - a);
  const pick = (list) => list[Math.floor(rng() * list.length)];

  const flat = (mesh) => {
    mesh.castShadow = mesh.receiveShadow = false;
    root.add(mesh);
    stats.drawCalls++;
    return mesh;
  };

  // InstancedMesh из готовых матриц (и цветов), с bounding sphere по инстансам — frustum culling работает
  const instanced = (geometry, material, matrices, colors) => {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((m, k) => mesh.setMatrixAt(k, m));
    colors?.forEach((c, k) => mesh.setColorAt(k, new THREE.Color(c)));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    return flat(mesh);
  };

  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const compose = (x, y, z, rotY, sx, sy = sx, sz = sx) => new THREE.Matrix4().compose(
    position.set(x, y, z),
    rotation.setFromAxisAngle(up, rotY),
    scale.set(sx, sy, sz),
  );

  // Края улицы считаем от внешних граней стен; западная улица — от самой западной пристройки
  const half = outline.wallT / 2;
  const N = outline.z0 - half;      // -12.15
  const officeW = outline.x0 - half; // -16.15 — стена офиса
  const W = Math.min(outline.x0, ...outline.annexes.map((a) => a.x0)) - half; // -25.15
  // Север: тротуар, дорога (у тротуара — парковочная полоса), дальний тротуар
  const nWalk = N - 2.85;     // -15
  const nRoad = nWalk - 2;    // -17
  const nPark = nRoad - 2.5;  // -19.5
  const nFar = nRoad - 8;     // -25
  const nEnd = nFar - 2;      // -27
  // Запад: то же зеркально по x
  const wWalk = W - 2.85;     // -28
  const wRoad = wWalk - 2;    // -30
  const wPark = wRoad - 2.5;  // -32.5
  const wFar = wRoad - 8;     // -38
  const wEnd = wFar - 2;      // -40
  const FAR = 100;

  // ---------- Земля и дороги ----------
  const lawn = flat(new THREE.Mesh(new THREE.CircleGeometry(120, 32), mat('#7fb46a')));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = -0.02; // под офисом скрыт полами (y = 0)

  // Плоская полоса в XZ; полосы на углу стыкуются без перекрытий — нет z-fighting
  const strip = (x0, z0, x1, z1, y, color) => {
    const m = flat(new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)), mat(color)));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  };
  // Перекрёсток (квадрат на углу) принадлежит северной дороге
  strip(wRoad, nWalk, FAR, nRoad, 0.04, SIDEWALK);
  strip(wFar, nRoad, FAR, nFar, 0.01, ROAD);
  strip(wEnd, nFar, FAR, nEnd, 0.04, SIDEWALK);
  strip(wWalk, nWalk, wRoad, FAR, 0.04, SIDEWALK);
  strip(wRoad, nRoad, wFar, FAR, 0.01, ROAD);
  strip(wFar, nFar, wEnd, FAR, 0.04, SIDEWALK);

  // Разметка: пунктир по оси проезжей части и линии парковочных мест
  const lines = [];
  const nAxis = (nPark + nFar) / 2; // -22.25
  const wAxis = (wPark + wFar) / 2; // -35.25
  for (let x = wRoad + 2; x < FAR; x += 4) lines.push(compose(x, 0.02, nAxis, 0, 2, 1, 0.12));
  for (let z = nRoad + 2; z < FAR; z += 4) lines.push(compose(wAxis, 0.02, z, 0, 0.12, 1, 2));
  const nSlotZ = (nRoad + nPark) / 2; // -18.25
  const wSlotX = (wRoad + wPark) / 2; // -31.25
  const nSlots = [];
  const wSlots = [];
  for (let x = wRoad + 4; x <= 40; x += SLOT) nSlots.push(x); // не начинаем внутри перекрёстка
  for (let z = -15; z <= 40; z += SLOT) wSlots.push(z);
  for (const x of nSlots) lines.push(compose(x - SLOT / 2, 0.02, nSlotZ, 0, 0.12, 1, 2.5));
  for (const z of wSlots) lines.push(compose(wSlotX, 0.02, z - SLOT / 2, 0, 2.5, 1, 0.12));
  instanced(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat('#f2f2ee'), lines);

  // Пятна-«тени» под деревьями и машинами вместо настоящих теней
  const blobs = [];

  // ---------- Деревья ----------
  const leafy = { matrices: [], colors: [] };
  const spruce = { matrices: [], colors: [] };
  const addTree = (kind, x, z, s) => {
    const tree = kind === 'spruce' ? spruce : leafy;
    tree.matrices.push(compose(x, 0, z, rng() * Math.PI * 2, s));
    tree.colors.push(pick(kind === 'spruce' ? SPRUCE_COLORS : LEAF_COLORS));
    blobs.push(compose(x, 0.03, z, 0, 1.1 * s, 1, 1.1 * s));
    stats.trees++;
  };

  // Точка внутри пристройки, расширенной на pad, — дерево или куст там ставить нельзя
  const nearAnnex = (x, z, pad) => outline.annexes.some((a) => x > a.x0 - pad && x < a.x1 + pad && z > a.z0 - pad && z < a.z1 + pad);
  const gaps = (centers) => [...new Set(centers.flatMap((c) => [c - 2, c + 2]))];

  // Газон у стен: в простенках между окнами и вдоль кабинета директора; масштаб скромнее — крона не задевает стену
  const nearScale = () => range(0.8, 1.05);
  for (const x of [...gaps(outline.northWindows), 8.5, 12, 15.5]) addTree('leafy', x, N - 1.45 + range(-0.3, 0.3), nearScale());
  for (const z of gaps([...outline.westWindows, ...outline.westDoors])) {
    const x = officeW - 1.45 + range(-0.3, 0.3);
    if (!nearAnnex(x, z, 1.5)) addTree('leafy', x, z, nearScale());
  }
  addTree('spruce', officeW - 1.45, N - 1.45, 1);
  // У стен пристроек — в простенках их окон, ель — в северо-западном углу
  for (const a of outline.annexes) {
    const aw = a.x0 - half - 1.45;
    const an = a.z0 - half - 1.45;
    for (const z of gaps(a.westWindows)) addTree('leafy', aw + range(-0.2, 0.2), z, nearScale());
    for (const x of gaps(a.northWindows)) addTree('leafy', x, an + range(-0.2, 0.2), nearScale());
    addTree('spruce', aw, an, 1);
  }
  // Газон между офисом и западной улицей: фиксированные точки, чтобы стволы не сближались
  const LAWN_TREES = [[-21, -8.8], [-24.8, -9.6], [-22.6, -12.6], [-26.6, -12.8], [-27, -7.6], [-23.5, 12.2], [-19.2, 11.6]];
  for (const [x, z] of LAWN_TREES) addTree('leafy', x, z, range(0.9, 1.15));

  // ---------- Кусты ----------
  // Ниже подоконника (0.9 м): под окнами пристроек, вдоль глухих стен и у западной стены офиса
  const bushes = { matrices: [], colors: [] };
  const addBush = (x, z) => {
    bushes.matrices.push(compose(x, 0, z, rng() * Math.PI * 2, range(0.8, 1.0)));
    bushes.colors.push(pick(LEAF_COLORS));
    stats.bushes++;
  };
  for (const a of outline.annexes) {
    for (const c of a.westWindows) for (const dz of [-0.8, 0.8]) addBush(a.x0 - half - 0.7, c + dz);
    for (const c of a.northWindows) for (const dx of [-0.8, 0.8]) addBush(c + dx, a.z0 - half - 0.7);
    for (let x = a.x0 + 0.8; x < a.x1 - 0.5; x += 1.6) addBush(x, a.z1 + half + 0.7);
  }
  for (const c of outline.westWindows) {
    for (const dz of [-0.8, 0.8]) {
      if (!nearAnnex(officeW - 0.7, c + dz, 0.8)) addBush(officeW - 0.7, c + dz);
    }
  }

  // Лесополосы за дальними тротуарами: сетка с джиттером, деревья не заходят на тротуар
  const belt = (x0, x1, z0, z1, keep) => {
    for (let x = x0; x <= x1; x += 6) {
      for (let z = z0; z <= z1; z += 6) {
        const tx = x + range(-2, 2);
        const tz = z + range(-2, 2);
        const kind = rng() < 0.5 ? 'spruce' : 'leafy';
        const s = range(0.8, 1.4);
        if (rng() > 0.6 || !keep(tx, tz)) continue;
        addTree(kind, tx, tz, s);
      }
    }
  };
  belt(-70, 60, -60, nEnd - 2, (x, z) => z < nEnd - 2);
  belt(-70, wEnd - 2, nEnd - 2, 60, (x, z) => x < wEnd - 2 && z > nEnd - 2);

  // Ствол и крона — два InstancedMesh с одной матрицей; основание геометрий в y = 0
  const crownMat = mat('#ffffff', { roughness: 0.9 });
  const trunkMat = mat('#7a5232');
  instanced(new THREE.CylinderGeometry(0.15, 0.2, 1.6, 6).translate(0, 0.8, 0), trunkMat, leafy.matrices);
  instanced(new THREE.IcosahedronGeometry(1.2, 0).scale(1, 1.15, 1).translate(0, 1.6 + 1.1, 0), crownMat, leafy.matrices, leafy.colors);
  instanced(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 5).translate(0, 0.4, 0), trunkMat, spruce.matrices);
  instanced(new THREE.ConeGeometry(1.0, 2.6, 7).translate(0, 0.8 + 1.3, 0), crownMat, spruce.matrices, spruce.colors);
  instanced(new THREE.IcosahedronGeometry(0.55, 0).scale(1, 0.7, 1).translate(0, 0.35, 0), crownMat, bushes.matrices, bushes.colors);

  // ---------- Машины ----------
  const cars = CAR_MODELS.map(() => ({ matrices: [], colors: [] }));
  const wheels = [];
  const wheelLocal = new THREE.Matrix4();
  const addCar = (x, z, rotY) => {
    if (rng() > 0.65) return;
    const model = Math.floor(rng() * CAR_MODELS.length);
    const [l, , w] = CAR_MODELS[model].body;
    const m = compose(x, 0, z, rotY, 1);
    cars[model].matrices.push(m);
    cars[model].colors.push(pick(CAR_COLORS));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        wheelLocal.makeTranslation(sx * (l / 2 - 0.75), WHEEL_R, sz * (w / 2 - 0.05));
        wheels.push(new THREE.Matrix4().multiplyMatrices(m, wheelLocal));
      }
    }
    blobs.push(compose(x, 0.03, z, rotY, l / 2, 1, w / 2));
    stats.cars++;
  };
  for (const x of nSlots) addCar(x, nSlotZ, rng() < 0.5 ? 0 : Math.PI);
  for (const z of wSlots) addCar(wSlotX, z, rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);

  const paint = mat('#ffffff', { roughness: 0.5, metalness: 0.15 });
  const glass = mat('#2b3a4a', { roughness: 0.2, metalness: 0.5 });
  CAR_MODELS.forEach(({ body: [l, h, w], cabin: [cl, ch, cw], offset }, k) => {
    if (cars[k].matrices.length === 0) return;
    const cabinY = CAR_BOTTOM + h;
    // Кузов и кабина — одна геометрия, одна краска
    const bodyGeometry = mergeGeometries([boxAt(l, h, w, 0, CAR_BOTTOM), boxAt(cl, ch, cw, offset, cabinY)]);
    instanced(bodyGeometry, paint, cars[k].matrices, cars[k].colors);
    // Стёкла чуть шире кабины и ниже крыши: видна полоса окон, крыша остаётся окрашенной
    instanced(boxAt(cl + 0.02, ch - 0.2, cw + 0.02, offset, cabinY + 0.05), glass, cars[k].matrices);
  });
  instanced(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.24, 8).rotateX(Math.PI / 2), mat('#1f1f1f'), wheels);

  instanced(
    new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2),
    mat('#000000', { transparent: true, opacity: 0.22, depthWrite: false }),
    blobs,
  );

  return { root, stats };
}
