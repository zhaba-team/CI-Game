// Небо за окнами: купол с градиентом, low-poly облака и дальние холмы.
// Лёгкая декорация: без теней и коллизий.
import * as THREE from 'three';
import { mat, createRng } from './lowpoly.js';

const SKY_R = 140;
const ZENITH = new THREE.Color('#4f9fe0');
const HORIZON = new THREE.Color('#d8eeff');
const HILL_COLORS = ['#6f9e6a', '#5d8c63', '#7fae7a'];

// Готовый InstancedMesh без теней, с bounding sphere по инстансам (frustum culling работает)
function instanced(geometry, material, transforms, colors) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const dummy = new THREE.Object3D();
  transforms.forEach(({ position, scale, rotationY }, k) => {
    dummy.position.copy(position);
    dummy.scale.copy(scale);
    dummy.rotation.set(0, rotationY, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(k, dummy.matrix);
    if (colors) mesh.setColorAt(k, new THREE.Color(colors[k]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.computeBoundingSphere();
  return mesh;
}

export function buildSky() {
  const root = new THREE.Group();
  const rng = createRng(1337);
  const range = (a, b) => a + rng() * (b - a);

  // Купол: вертикальный градиент вершинными цветами, ниже горизонта — цвет горизонта (скрыт землёй)
  const domeGeometry = new THREE.SphereGeometry(SKY_R, 24, 12);
  const pos = domeGeometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const t = Math.max(0, pos.getY(k) / SKY_R);
    c.lerpColors(HORIZON, ZENITH, Math.pow(t, 0.7));
    c.toArray(colors, k * 3);
  }
  domeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Исключение из mat(): небу не нужно освещение, а flatShading дал бы полосы
  const dome = new THREE.Mesh(domeGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  dome.renderOrder = -1;
  dome.frustumCulled = false; // камера внутри купола
  root.add(dome);

  // Облака: отдельная группа, медленно вращается целиком — без перерасчёта матриц
  const cloudTransforms = Array.from({ length: 12 }, () => {
    const r = range(50, 110);
    const a = rng() * Math.PI * 2;
    return {
      position: new THREE.Vector3(Math.cos(a) * r, range(30, 45), Math.sin(a) * r),
      scale: new THREE.Vector3(range(6, 10), range(1.8, 3), range(4, 7)),
      rotationY: rng() * Math.PI * 2,
    };
  });
  const clouds = new THREE.Group();
  clouds.add(instanced(
    new THREE.IcosahedronGeometry(1, 0),
    mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 1 }),
    cloudTransforms,
  ));
  root.add(clouds);

  // Холмы по кругу: наполовину в земле, прячут край газона у горизонта
  const hillCount = 18;
  const hillTransforms = Array.from({ length: hillCount }, (_, k) => {
    const r = range(100, 112);
    const a = (k / hillCount) * Math.PI * 2 + range(-0.1, 0.1);
    const scale = new THREE.Vector3(range(18, 28), range(6, 12), range(14, 20));
    return {
      position: new THREE.Vector3(Math.cos(a) * r, -0.3 * scale.y, Math.sin(a) * r),
      scale,
      rotationY: -a,
    };
  });
  const hillColors = hillTransforms.map(() => HILL_COLORS[Math.floor(rng() * HILL_COLORS.length)]);
  root.add(instanced(new THREE.IcosahedronGeometry(1, 0), mat('#ffffff', { roughness: 1 }), hillTransforms, hillColors));

  return {
    root,
    update(time) {
      clouds.rotation.y = time * 0.003;
    },
  };
}
