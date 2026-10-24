// Кофемашина Игровой и анимация «сварить и выпить» лавандовый раф:
// стаканчик под носиком → струя и пенка → игрок берёт стаканчик → три глотка → стаканчик исчезает.
// Своих источников света нет; таймеры — свои, обновление через update(dt) из игрового цикла.
import * as THREE from 'three';
import { mat, glow, box, cyl, ico } from './lowpoly.js';

// Таймлайн, секунды
const CUP_IN = 0.3;   // стаканчик появляется под носиком
const BREW = 2.6;     // наливается кофе, пенка поднимается
const HANDOFF = 0.5;  // крышка надета, игрок забирает стаканчик
const SIP = 0.9;      // один глоток: половину времени рука у рта, половину — перед собой
const SIPS = 3;
const VANISH = 0.4;   // пустой стаканчик исчезает
const TOTAL = CUP_IN + BREW + HANDOFF + SIP * SIPS + VANISH;

const TRAY_Z = 0.29;     // стаканчик стоит на решётке перед корпусом
const TRAY_TOP = 0.02;
const SPOUT_Y = 0.3;     // низ носика
const FOAM_LOW = 0.02;   // уровень пенки в пустом стаканчике
const FOAM_HIGH = 0.115; // и в полном
const CUP_TILT = 0.35;   // наклон стаканчика к губам во время глотка

const LED_IDLE = new THREE.Color('#b497d6');
const LED_DONE = new THREE.Color('#4dff88');

// Стаканчик рафа: начало координат — дно. Корпус открыт сверху, чтобы была видна пенка
function buildCup() {
  const cup = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.038, 0.13, 8, 1, true).translate(0, 0.065, 0),
    mat('#f6f1e7', { side: THREE.DoubleSide }),
  );
  body.castShadow = true;
  const sleeve = cyl(0.052, 0.044, 0.05, 8, '#b497d6', 0, 0.04, 0);
  const bottom = cyl(0.038, 0.038, 0.005, 8, '#f6f1e7', 0, 0, 0);
  const foam = cyl(0.045, 0.045, 0.01, 8, '#d9c3ec', 0, 0, 0);
  const lid = cyl(0.053, 0.053, 0.015, 8, '#ffffff', 0, 0.13, 0);
  cup.add(body, sleeve, bottom, foam, lid);
  // Пар над стаканчиком: поднимается и тает, как дым в fire.js
  const steamMat = mat('#ffffff', { transparent: true, opacity: 0.5, depthWrite: false });
  const steam = [0, 1, 2].map(() => {
    const puff = ico(0.03, null, 0, steamMat);
    puff.castShadow = false;
    puff.visible = false;
    cup.add(puff);
    return puff;
  });
  cup.userData.hang = 0.065; // кисть обхватывает стаканчик посередине (см. player.setHeld)
  return { cup, foam, lid, steam };
}

export function createCoffeeMachine() {
  const group = new THREE.Group();
  const housing = new THREE.Group();
  housing.add(
    box(0.46, 0.62, 0.42, '#2d2f36', 0, 0, 0),
    box(0.47, 0.07, 0.43, '#b497d6', 0, 0.565, 0),         // лавандовая полоса сверху: выше крышки корпуса (0.62), без z-fighting
    box(0.12, 0.05, 0.12, '#3b3e47', 0, SPOUT_Y + 0.04, 0.24), // кронштейн носика
    cyl(0.025, 0.018, 0.04, 6, '#9aa3ab', 0, SPOUT_Y, TRAY_Z),  // носик
    box(0.3, TRAY_TOP, 0.15, '#5c606b', 0, 0, TRAY_Z),       // решётка-поддон: зазор с фасадом корпуса (z 0.21)
  );
  const led = box(0.05, 0.05, 0.02, null, 0.15, 0.46, 0.215, glow('#b497d6', 1.2));
  led.material = led.material.clone(); // цвет светодиода меняется — свой материал
  housing.add(led);
  group.add(housing);

  // Струя: геометрия свисает вниз от начала координат, длина — scale.y
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6).translate(0, -0.5, 0), mat('#c9a6d9'));
  stream.position.set(0, SPOUT_Y, TRAY_Z);
  stream.visible = false;
  group.add(stream);

  const { cup, foam, lid, steam } = buildCup();
  const machinePos = new THREE.Vector3();

  // Стаканчик снова в машине: скрыт, пустой, без крышки
  const resetCup = () => {
    cup.removeFromParent();
    group.add(cup);
    cup.position.set(0, TRAY_TOP + 0.001, TRAY_Z); // дно чуть выше решётки — без z-fighting
    cup.rotation.set(0, 0, 0);
    cup.scale.setScalar(1);
    cup.visible = false;
    foam.position.y = FOAM_LOW;
    lid.visible = false;
    steam.forEach((puff) => { puff.visible = false; });
  };
  const setLed = (color, intensity) => {
    led.material.color.copy(color);
    led.material.emissive.copy(color);
    led.material.emissiveIntensity = intensity;
  };
  resetCup();
  setLed(LED_IDLE, 1.2);

  let run = null; // { t, player, onDone, held } на время анимации

  const finish = () => {
    const { player, onDone } = run;
    player.setHeld(null);
    player.model.userData.setGesture(null);
    housing.position.x = 0;
    stream.visible = false;
    setLed(LED_IDLE, 1.2);
    resetCup();
    run = null;
    onDone?.();
  };

  const updateSteam = (time) => {
    steam.forEach((puff, k) => {
      const t = (time * 0.7 + k / steam.length) % 1;
      puff.visible = true;
      puff.position.set(Math.sin(time * 2 + k * 2) * 0.02, 0.15 + t * 0.2, Math.cos(time * 2 + k * 2) * 0.02);
      puff.scale.setScalar(0.6 + t * 1.2);
    });
  };

  return {
    group,
    get busy() { return run !== null; },
    get holdsCup() { return run?.held ?? false; },
    // Вся последовательность ~6.5 с; onDone — когда стаканчик исчез
    play(player, onDone) {
      if (run) return;
      group.getWorldPosition(machinePos);
      player.face(machinePos.x, machinePos.z);
      run = { t: 0, player, onDone, held: false };
      cup.visible = true;
      cup.scale.setScalar(0.01);
    },
    update(dt, time) {
      if (!run) return;
      run.t += dt;
      const { t, player } = run;
      const rig = player.model.userData;
      if (t >= TOTAL) { finish(); return; }

      if (t < CUP_IN) {
        cup.scale.setScalar(Math.max(0.01, t / CUP_IN));
        return;
      }
      if (t < CUP_IN + BREW) {
        const p = (t - CUP_IN) / BREW;
        cup.scale.setScalar(1);
        stream.visible = true;
        foam.position.y = FOAM_LOW + (FOAM_HIGH - FOAM_LOW) * p;
        // Частоты анимаций ниже половины частоты кадров: быстрые синусы на 60 fps давали стробоскоп
        const wobble = 0.9 + Math.sin(time * 12) * 0.1;
        stream.scale.set(wobble, SPOUT_Y - TRAY_TOP - foam.position.y - 0.01, wobble);
        housing.position.x = Math.sin(time * 25) * 0.002; // машина гудит
        setLed(LED_IDLE, 1.2 + 0.8 * Math.sin(time * 6)); // плавная пульсация вместо мигания
        return;
      }
      if (t < CUP_IN + BREW + HANDOFF) {
        housing.position.x = 0;
        stream.visible = false;
        lid.visible = true;
        setLed(LED_DONE, 1.4);
        return;
      }
      if (!run.held) {
        run.held = true;
        player.setHeld(cup);
        rig.setGesture('hold');
      }
      const sipT = t - CUP_IN - BREW - HANDOFF;
      const drinking = sipT < SIP * SIPS && sipT % SIP < SIP / 2;
      rig.setGesture(drinking ? 'drink' : 'hold');
      // Стаканчик держим вертикально, во время глотка — с наклоном к губам
      cup.rotation.x = -rig.parts.armR.rotation.x - (drinking ? CUP_TILT : 0);
      updateSteam(time);
      if (sipT >= SIP * SIPS) cup.scale.setScalar(Math.max(0.01, 1 - (sipT - SIP * SIPS) / VANISH));
    },
  };
}
