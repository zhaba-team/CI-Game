// NPC с табличкой и значком над головой + маркеры на полу (активные квесты, выход из офиса).
import * as THREE from 'three';
import { createCharacter } from './characters.js';
import { mat, glow, textSprite } from './lowpoly.js';

function exclamation() {
  const g = new THREE.Group();
  const m = glow('#ffc93c', 0.9);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.36, 0.13), m);
  bar.position.y = 0.26;
  const dot = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), m);
  g.add(bar, dot);
  return g;
}

export function createNpc(def, spot) {
  const group = new THREE.Group();
  const model = createCharacter(def.style);
  group.add(model);
  group.position.set(spot.x, 0, spot.z);
  model.rotation.y = spot.face ?? 0;
  const top = 2.15 * (def.style.height ?? 1);

  // Имя крупно, под ним должность — мельче и бледнее
  const nameLabel = textSprite(def.name, { height: 0.26, size: 40 });
  nameLabel.position.y = top + 0.38;
  const roleLabel = textSprite(def.role, { height: 0.2, size: 34, bg: 'rgba(18,53,36,0.6)', color: '#d6f5e2' });
  roleLabel.position.y = top + 0.12;
  group.add(nameLabel, roleLabel);
  const markerY = top + 0.8; // значки статуса — над плашкой с именем

  const markers = {
    available: exclamation(),
    active: textSprite('…', { bg: 'rgba(90,90,90,0.85)', height: 0.34 }),
    done: textSprite('✓', { bg: 'rgba(46,158,91,0.95)', height: 0.34 }),
  };
  Object.values(markers).forEach((m) => { m.position.y = markerY; m.visible = false; group.add(m); });

  const baseFace = spot.face ?? 0;
  const tmp = new THREE.Vector3();

  return {
    def,
    group,
    position: group.position,
    setStatus(status) {
      for (const [k, m] of Object.entries(markers)) m.visible = k === status;
    },
    update(dt, time, playerPos) {
      // Поворачиваемся к игроку, когда он рядом
      tmp.copy(playerPos).sub(group.position);
      const near = tmp.lengthSq() < 16;
      const want = near ? Math.atan2(tmp.x, tmp.z) : baseFace;
      let diff = want - model.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      model.rotation.y += diff * (1 - Math.exp(-dt * 5));
      model.userData.animate(dt, 0, time + group.position.x);
      markers.available.position.y = markerY - 0.05 + Math.sin(time * 3) * 0.08;
      markers.available.rotation.y = time * 2;
    },
  };
}

export function createQuestMarker(x, z, { color = '#ffc93c', beam: beamColor = '#ffe08a' } = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 6), mat(color, {
    emissive: color, emissiveIntensity: 1, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
  }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2.6, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: beamColor, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 1.3;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), glow(color, 0.9));
  arrow.rotation.x = Math.PI;
  arrow.position.y = 2.3;
  g.add(ring, beam, arrow);
  g.visible = false;
  return {
    group: g,
    position: g.position,
    update(time) {
      const s = 1 + Math.sin(time * 4) * 0.08;
      ring.scale.set(s, s, s);
      ring.rotation.z = time * 0.8;
      arrow.position.y = 2.3 + Math.sin(time * 3) * 0.15;
      arrow.rotation.y = time * 2;
    },
  };
}
