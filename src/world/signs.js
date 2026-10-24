// Физические настенные вывески: металлическая панель с гравированным текстом, рамка-подложка и болты.
// Локальные координаты: тыльная сторона в плоскости z = 0 (поверхность стены), лицо смотрит в +z.
import * as THREE from 'three';
import { mat } from './lowpoly.js';

const GAP = 0.002; // зазор от стены против z-fighting
const BACK_D = 0.03;
const PANEL_D = 0.025;
const FRAME = 0.04; // кант подложки вокруг панели
const PX_PER_M = 512;
const MAX_PX = 2048;

// Детерминированный PRNG (mulberry32): узор шлифовки одинаковый между запусками
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shadowed(mesh, receive = true) {
  mesh.castShadow = true;
  mesh.receiveShadow = receive;
  return mesh;
}

export function createWallSign(text, { width, height, letterColor = '#2e9e5b', frameColor = '#2b3038' }) {
  const w = Math.min(MAX_PX, Math.round(width * PX_PER_M));
  const h = Math.round(w * height / width);
  const canvases = [0, 1, 2].map(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  });
  const [colorCanvas, roughCanvas, bumpCanvas] = canvases;
  const pxPerM = w / width;

  // Размер шрифта: не выше 55% панели и с полями под болты по краям
  const fontFor = (ctx) => {
    let size = h * 0.55;
    ctx.font = `800 ${size}px Nunito, system-ui, sans-serif`;
    const maxW = (w - 0.2 * pxPerM) * 0.9;
    const textW = ctx.measureText(text).width;
    if (textW > maxW) size *= maxW / textW;
    return { size, font: `800 ${size}px Nunito, system-ui, sans-serif` };
  };

  // Горизонтальные штрихи шлифовки; colorFn(светлый ли, α) → цвет штриха
  const brush = (ctx, colorFn) => {
    const rand = mulberry32(text.length * 7919 + 17);
    const count = Math.round(h * 1.5);
    for (let k = 0; k < count; k++) {
      const y = Math.floor(rand() * h);
      const len = w * (0.2 + rand() * 0.8);
      const x = rand() * w - len * 0.3;
      const light = rand() > 0.5;
      const alpha = 0.03 + rand() * 0.05;
      ctx.fillStyle = colorFn(light, alpha);
      ctx.fillRect(x, y, len, 1);
    }
  };

  const writeText = (ctx, color, dx = 0, dy = 0) => {
    const { size, font } = fontFor(ctx);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2 + dx, h / 2 + size * 0.05 + dy);
  };

  const draw = () => {
    // Цвет: шлифованный алюминий, тень верхнего края канавки и краска в гравировке
    const c = colorCanvas.getContext('2d');
    c.fillStyle = '#c9ced4';
    c.fillRect(0, 0, w, h);
    brush(c, (light, a) => (light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`));
    writeText(c, 'rgba(0,0,0,0.45)', -2, -2);
    writeText(c, letterColor);

    // Шероховатость: краска в гравировке матовее металла
    const r = roughCanvas.getContext('2d');
    r.fillStyle = '#6e6e6e';
    r.fillRect(0, 0, w, h);
    brush(r, (light) => (light ? '#787878' : '#646464'));
    writeText(r, '#b4b4b4');

    // Рельеф: буквы ниже поверхности — это и есть гравировка
    const b = bumpCanvas.getContext('2d');
    b.filter = 'none';
    b.fillStyle = '#ffffff';
    b.fillRect(0, 0, w, h);
    b.filter = 'blur(1px)'; // где filter не поддерживается — просто без размытия
    writeText(b, '#000000');
    b.filter = 'none';
  };
  draw();

  const textures = canvases.map((canvas) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  });
  const [map, roughnessMap, bumpMap] = textures;
  map.colorSpace = THREE.SRGBColorSpace;

  // Перерисовать, когда подгрузится кириллица Nunito; без шрифта остаётся fallback
  document.fonts?.load('800 64px Nunito', text).then(() => {
    draw();
    textures.forEach((t) => { t.needsUpdate = true; });
  }).catch(() => {});

  // Уникальные текстуры на каждую вывеску — кэш mat() здесь не подходит, как и в textPlane
  const faceMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map,
    roughnessMap,
    bumpMap,
    bumpScale: 1,
    roughness: 1,
    metalness: 0.45,
  });
  const edgeMaterial = mat('#b9bfc6', { metalness: 0.5, roughness: 0.4 });

  const sign = new THREE.Group();

  const back = shadowed(new THREE.Mesh(
    new THREE.BoxGeometry(width + 2 * FRAME, height + 2 * FRAME, BACK_D),
    mat(frameColor, { metalness: 0.4, roughness: 0.5 }),
  ));
  back.position.z = GAP + BACK_D / 2;
  sign.add(back);

  // Порядок граней BoxGeometry: +x, −x, +y, −y, +z, −z
  const panel = shadowed(new THREE.Mesh(
    new THREE.BoxGeometry(width, height, PANEL_D),
    [edgeMaterial, edgeMaterial, edgeMaterial, edgeMaterial, faceMaterial, edgeMaterial],
  ));
  panel.position.z = GAP + BACK_D + PANEL_D / 2;
  sign.add(panel);

  const faceZ = GAP + BACK_D + PANEL_D;
  const boltGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.012, 8);
  const boltMat = mat('#8d949c', { metalness: 0.6, roughness: 0.35 });
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const bolt = shadowed(new THREE.Mesh(boltGeo, boltMat), false);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(sx * (width / 2 - 0.05), sy * (height / 2 - 0.05), faceZ + 0.006);
      sign.add(bolt);
    }
  }

  return sign;
}
