// Общие помощники для полигонального (low-poly) стиля: плоское затенение и кэш материалов.
import * as THREE from 'three';

const materials = new Map();

export function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.85,
      metalness: 0.05,
      ...opts,
    }));
  }
  return materials.get(key);
}

// Детерминированный генератор случайных чисел (mulberry32): декор одинаков при каждой загрузке.
// Возвращает функцию, выдающую числа в [0, 1).
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function glow(color, intensity = 1) {
  return mat(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
}

function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

// Прямоугольный блок; (x, y, z) — центр нижней грани, так проще ставить мебель на пол.
export function box(w, h, d, color, x = 0, y = 0, z = 0, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material ?? mat(color));
  mesh.position.set(x, y + h / 2, z);
  return shadowed(mesh);
}

export function cyl(rTop, rBottom, h, segments, color, x = 0, y = 0, z = 0, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material ?? mat(color));
  mesh.position.set(x, y + h / 2, z);
  return shadowed(mesh);
}

export function ico(radius, color, detail = 0, material) {
  return shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(radius, detail), material ?? mat(color)));
}

export function group(...children) {
  const g = new THREE.Group();
  children.forEach((c) => g.add(c));
  return g;
}

// Холст с надписью: общая отрисовка для спрайтов и надписей на поверхностях.
function textCanvas(text, { color, bg, size }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `800 ${size}px Nunito, system-ui, sans-serif`;
  ctx.font = font;
  const padX = size * 0.6;
  const w = Math.ceil(ctx.measureText(text).width + padX * 2);
  const h = Math.ceil(size * 1.6);
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  if (bg) {
    ctx.fillStyle = bg;
    const r = h / 2;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + size * 0.05);
  return { canvas, w, h };
}

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Текстура-надпись для спрайтов (имена и значки над NPC).
export function textSprite(text, { color = '#fff', bg = 'rgba(18,53,36,0.85)', size = 48, height = 0.35 } = {}) {
  const { canvas, w, h } = textCanvas(text, { color, bg, size });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(canvas), depthWrite: false }));
  sprite.scale.set(height * (w / h), height, 1);
  return sprite;
}

// Надпись на поверхности (принт на одежде, табличка). Лицевая сторона смотрит в +z.
export function textPlane(text, { color = '#fff', bg = null, size = 64, height = 0.1 } = {}) {
  const { canvas, w, h } = textCanvas(text, { color, bg, size });
  const material = new THREE.MeshStandardMaterial({
    map: canvasTexture(canvas),
    transparent: true,
    roughness: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(height * (w / h), height), material);
  plane.castShadow = false;
  return plane;
}
