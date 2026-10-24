// Игровой мир: сцена, цикл обновления, взаимодействие с NPC и маркерами квестов,
// рабочие дни (интро, итоги, переход к следующему дню) и финал.
import * as THREE from 'three';
import { buildOffice } from './world/office.js';
import { buildSky } from './world/sky.js';
import { buildOutdoor } from './world/outdoor.js';
import { createPlayer } from './world/player.js';
import { createNpc, createQuestMarker } from './world/npc.js';
import { createInput } from './input.js';
import { createHud } from './ui/hud.js';
import { h } from './ui/dom.js';
import { openModal, closeModal, onModalChange, isModalOpen } from './ui/modal.js';
import { NPCS } from './quests/npcs.js';
import { QUESTS, fillTemplate } from './quests/quests.js';
import { DAYS, questsOfDay, dayOfQuest, lockedRooms } from './quests/days.js';
import { getMinigame } from './minigames/index.js';
import * as store from './state.js';

const { QuestStatus } = store;
const TALK_RADIUS = 2.0;
const MARKER_RADIUS = 0.8;

export function createGame({ onNewGame }) {
  for (const q of QUESTS) {
    if (dayOfQuest(q.id) === -1) throw new Error(`Квест «${q.id}» не привязан ни к одному дню (src/quests/days.js)`);
  }

  const canvas = document.getElementById('game');
  const isMobile = window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile || window.devicePixelRatio < 2 });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d8eeff'); // фолбэк под куполом неба — цвет горизонта
  // Дальность с запасом под купол неба R = 140
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 160);

  // Потолок смотрит вниз и получает groundColor: светлый тон, чтобы он не выглядел «грязным»
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9b391', 1.0));
  // Солнце светит «сквозь» потолок (он не отбрасывает тень) и даёт объёмные тени от мебели
  const sun = new THREE.DirectionalLight('#fff4e0', 1.2);
  sun.position.set(-8, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 16, bottom: -16, near: 1, far: 50 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const office = buildOffice();
  scene.add(office.root);
  // Вид за окнами: небо и улица — декорация без теней и коллизий
  const sky = buildSky();
  scene.add(sky.root);
  const outdoor = buildOutdoor(office.outline);
  scene.add(outdoor.root);
  // Подсветка серверной под потолком: красная, пока сервер «лежит», голубая — после починки
  const serverLight = new THREE.PointLight('#ff6b6b', 6, 12);
  serverLight.position.set(11, office.ceilingHeight - 0.6, 6);
  scene.add(serverLight);

  const input = createInput(canvas);
  const hud = createHud();
  const player = createPlayer(scene, camera, office);

  // Коллайдер NPC есть, только пока NPC в офисе (см. npcArrived в refresh)
  const npcs = NPCS.map((def) => {
    const npc = createNpc(def, office.spots[def.spot]);
    scene.add(npc.group);
    const { x, z } = npc.position;
    npc.collider = { x0: x - 0.3, z0: z - 0.3, x1: x + 0.3, z1: z + 0.3 };
    return npc;
  });

  const markers = new Map(QUESTS.map((q) => {
    const spot = office.spots[q.spot];
    const marker = createQuestMarker(spot.x, spot.z);
    scene.add(marker.group);
    return [q.id, marker];
  }));
  const exitMarker = createQuestMarker(office.spots.exit.x, office.spots.exit.z, { color: '#2e9e5b', beam: '#9be7b4' });
  scene.add(exitMarker.group);

  const name = () => store.getState().name;
  const t = (text) => fillTemplate(text, name());

  // ---------- Рабочие дни ----------
  const day = () => DAYS[store.currentDay()];
  const dayQuests = () => questsOfDay(store.currentDay(), QUESTS);
  const isDayDone = () => dayQuests().every((q) => store.questStatus(q.id) === QuestStatus.DONE);
  // NPC приходит в офис в день своего квеста; NPC без квеста в офисе всегда
  const npcArrived = (npc) => {
    const quest = QUESTS.find((q) => q.npc === npc.def.id);
    return !quest || dayOfQuest(quest.id) <= store.currentDay();
  };

  // ---------- Синхронизация мира с состоянием ----------
  function refresh() {
    office.setLocks(lockedRooms(store.currentDay()));
    for (const npc of npcs) {
      const quest = QUESTS.find((q) => q.npc === npc.def.id);
      npc.setStatus(quest ? store.questStatus(quest.id) : null);
      const arrived = npcArrived(npc);
      npc.group.visible = arrived;
      const k = office.colliders.indexOf(npc.collider);
      if (arrived && k === -1) office.colliders.push(npc.collider);
      if (!arrived && k !== -1) office.colliders.splice(k, 1);
    }
    for (const q of QUESTS) markers.get(q.id).group.visible = store.questStatus(q.id) === QuestStatus.ACTIVE;
    const dayDone = isDayDone();
    exitMarker.group.visible = dayDone;
    const serverFixed = store.questStatus('pipeline') === QuestStatus.DONE;
    office.setServerFixed(serverFixed);
    serverLight.color.set(serverFixed ? '#6bc5ff' : '#ff6b6b');
    hud.renderJournal(dayQuests(), NPCS, store.questStatus, {
      title: day().title,
      doneHint: dayDone ? 'День завершён — выход у ресепшена 🚪' : null,
    });
  }
  store.onChange(refresh);

  onModalChange((open) => input.setEnabled(!open));

  // ---------- Диалоги ----------
  function npcAvatar(def) {
    return h('div', { class: 'avatar', style: { background: def.style.shirt, borderColor: def.style.accent } }, def.name[0]);
  }

  function talk(npc) {
    const quest = QUESTS.find((q) => q.npc === npc.def.id);
    const status = store.questStatus(quest.id);
    const lines = (status === QuestStatus.AVAILABLE ? quest.dialog.intro : status === QuestStatus.ACTIVE ? quest.dialog.active : quest.dialog.done).map(t);
    let index = 0;
    const bubble = h('div', { class: 'bubble' });
    const dots = h('div', { class: 'dots' });
    const body = h('div', { class: 'dialog' }, npcAvatar(npc.def), h('div', { class: 'dialog-text' }, bubble, dots));
    const modal = openModal({ title: npc.def.name, badge: npc.def.role, body });

    const show = () => {
      bubble.textContent = lines[index];
      bubble.classList.remove('appear');
      void bubble.offsetWidth;
      bubble.classList.add('appear');
      dots.replaceChildren(...(lines.length > 1 ? lines.map((_, i) => h('i', { class: i === index ? 'on' : '' })) : []));
      const last = index === lines.length - 1;
      if (!last) modal.setActions([{ label: 'Далее →', primary: true, onClick: () => { index++; show(); } }]);
      else if (status === QuestStatus.AVAILABLE) {
        modal.setActions([
          { label: 'Позже' },
          { label: '✋ Взять задачу', primary: true, onClick: () => acceptQuest(quest) },
        ]);
      } else if (status === QuestStatus.DONE) {
        modal.setActions([{ label: 'Пока!', primary: true }]);
      } else {
        modal.setActions([{ label: 'Понятно', primary: true }]);
      }
    };
    show();
  }

  function acceptQuest(quest) {
    store.setQuestStatus(quest.id, QuestStatus.ACTIVE);
    closeModal();
    hud.toast(`Новая задача: «${quest.title}». Иди к жёлтому маркеру — ${quest.where}.`, 'quest');
  }

  // ---------- Мини-игры ----------
  function openMinigame(quest) {
    const mg = getMinigame(quest.minigame);
    const npc = NPCS.find((n) => n.id === quest.npc);
    const body = h('div', { class: 'minigame' });
    let completed = false;
    openModal({
      title: mg.title,
      subtitle: `Задание от: ${npc.name} (${npc.role})`,
      body,
      wide: true,
      onClose: () => { if (!completed) hud.toast('Задание можно продолжить в любой момент — просто вернись к маркеру.'); },
    });
    mg.mount(body, {
      playerName: name(),
      complete: () => {
        if (completed) return;
        completed = true;
        store.setQuestStatus(quest.id, QuestStatus.DONE);
        showLesson(quest, npc);
      },
    });
  }

  function showLesson(quest, npc) {
    const dayDone = isDayDone();
    openModal({
      title: 'Задача выполнена! 🎉',
      subtitle: quest.title,
      body: h('div', { class: 'lesson' },
        h('div', { class: 'lesson-tag' }, `💡 Что ты узнал: ${quest.lesson.title}`),
        h('p', {}, quest.lesson.text),
        h('p', { class: 'muted' }, `${npc.name} говорит спасибо! Можно подойти ещё раз и поболтать.`),
      ),
      actions: [{
        label: dayDone ? 'Итоги дня →' : 'Супер!',
        primary: true,
        onClick: () => { if (dayDone) showDaySummary(); else closeModal(); },
      }],
    });
  }

  // ---------- Интро, итоги и смена дня ----------
  function showDayIntro() {
    const first = store.currentDay() === 0;
    const touch = input.state.isTouch;
    openModal({
      title: day().title,
      subtitle: day().intro.subtitle,
      body: h('div', { class: 'lesson' },
        day().intro.lines.map((line) => h('p', {}, t(line))),
        first
          ? h('div', { class: 'controls' },
            touch
              ? [h('div', {}, '🕹️ Стик слева — ходить'), h('div', {}, '👆 Проведи по экрану — повернуть камеру'), h('div', {}, '💬 Кнопка справа — говорить')]
              : [h('div', {}, h('kbd', {}, 'W A S D'), ' — ходить, ', h('kbd', {}, 'Shift'), ' — бежать'), h('div', {}, '🖱️ Зажми мышь и веди — повернуть камеру'), h('div', {}, h('kbd', {}, 'E'), ' — поговорить / сесть за компьютер')],
          )
          : null,
      ),
      actions: [{ label: 'Поехали!', primary: true }],
      // Интро считается прочитанным при любом закрытии, в том числе крестиком
      onClose: () => store.setDayIntroShown(),
    });
  }

  function showDaySummary() {
    const quests = dayQuests();
    openModal({
      title: `${day().title} — день завершён! 🎉`,
      subtitle: `Итоги рабочего дня, ${name()}`,
      body: h('div', { class: 'lesson day-summary' },
        h('h3', {}, '💡 Что ты узнал о профессии'),
        h('ul', { class: 'roles' }, quests.map((q) => h('li', {}, h('b', {}, q.lesson.title), ` — ${q.lesson.text}`))),
        h('p', {}, day().summary.insight),
        h('h3', {}, '✅ Что ты сделал'),
        h('ul', { class: 'done-list' }, quests.map((q) => {
          const npc = NPCS.find((n) => n.id === q.npc);
          return h('li', {}, q.title, h('span', { class: 'muted' }, ` (${npc.name}, ${npc.role})`));
        })),
      ),
      actions: [
        { label: 'Продолжить гулять по офису', onClick: () => { closeModal(); hud.toast('Когда захочешь закончить день — встань на зелёный маркер у выхода.'); } },
        { label: 'Закончить рабочий день', primary: true, onClick: endDay },
      ],
    });
  }

  function endDay() {
    if (store.currentDay() === DAYS.length - 1) {
      store.setFinished();
      showFinale();
      return;
    }
    store.advanceDay(); // onChange → refresh: двери, NPC и журнал нового дня
    const spawn = office.spots.spawn;
    player.place(spawn.x, spawn.z, spawn.face);
    lastMarkerAuto = null;
    lastExitAuto = false;
    savePose();
    showDayIntro();
  }

  function showFinale() {
    openModal({
      title: `Поздравляем, ${name()}! 🏆`,
      subtitle: 'Три дня стажировки в «жыбий рыр» позади',
      body: h('div', { class: 'lesson' },
        h('p', {}, 'Ты помог всей команде и попробовал себя в разных ролях IT-компании:'),
        h('ul', { class: 'roles' }, QUESTS.map((q) => {
          const npc = NPCS.find((n) => n.id === q.npc);
          return h('li', {}, h('b', {}, q.lesson.title), ` — ${npc.name}, ${npc.role}`);
        })),
        h('p', {}, 'Программист — это не только код. Это внимание к деталям, умение искать ошибки, автоматизировать рутину и работать в команде. Если тебе понравилось — попробуй написать свою первую программу на JavaScript или Python!'),
      ),
      actions: [
        { label: 'Начать заново', onClick: () => { closeModal(); onNewGame(); } },
        { label: 'Гулять по офису', primary: true },
      ],
    });
  }

  // ---------- Взаимодействие ----------
  let nearNpc = null;
  let nearMarker = null;
  let nearExit = false;
  let lastMarkerAuto = null;
  let lastExitAuto = false;

  function interact() {
    if (isModalOpen()) return;
    if (nearMarker) openMinigame(nearMarker);
    else if (nearExit) showDaySummary();
    else if (nearNpc) talk(nearNpc);
  }
  input.onAction(interact);

  function checkInteractions() {
    const p = player.position;
    nearNpc = null;
    let best = TALK_RADIUS;
    for (const npc of npcs) {
      if (!npc.group.visible) continue;
      const d = Math.hypot(npc.position.x - p.x, npc.position.z - p.z);
      if (d < best) { best = d; nearNpc = npc; }
    }
    nearMarker = null;
    for (const q of QUESTS) {
      if (store.questStatus(q.id) !== QuestStatus.ACTIVE) continue;
      const m = markers.get(q.id).position;
      if (Math.hypot(m.x - p.x, m.z - p.z) < MARKER_RADIUS) { nearMarker = q; break; }
    }
    const e = exitMarker.position;
    nearExit = exitMarker.group.visible && Math.hypot(e.x - p.x, e.z - p.z) < MARKER_RADIUS;

    if (isModalOpen()) return;
    // Автооткрытие мини-игры при подходе к маркеру — один раз, пока игрок не отойдёт.
    // Диалог с NPC открывается только по действию (E / 💬).
    if (nearMarker && lastMarkerAuto !== nearMarker.id) {
      lastMarkerAuto = nearMarker.id;
      openMinigame(nearMarker);
      return;
    }
    if (!nearMarker) lastMarkerAuto = null;
    // Итоги дня на маркере выхода — тоже один раз, пока игрок не сойдёт с маркера
    if (!nearMarker && nearExit && !lastExitAuto) {
      lastExitAuto = true;
      showDaySummary();
      return;
    }
    if (!nearExit) lastExitAuto = false;

    const key = input.state.isTouch ? '' : 'E — ';
    if (nearMarker) {
      hud.setPrompt(`${key}Сесть за компьютер`);
      input.setActionVisible(true, '💻');
    } else if (nearExit) {
      hud.setPrompt(`${key}Завершить рабочий день`);
      input.setActionVisible(true, '🚪');
    } else if (nearNpc) {
      hud.setPrompt(`${key}Поговорить: ${nearNpc.def.name}`);
      input.setActionVisible(true, '💬');
    } else {
      hud.setPrompt(null);
      input.setActionVisible(false);
    }
  }

  // ---------- Цикл ----------
  function resize() {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.fov = w < hgt ? 72 : 60;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  let saveTimer = 0;
  let running = false;

  function savePose() {
    store.setPlayerPose({ x: player.position.x, z: player.position.z, heading: player.heading });
    store.persist();
  }
  window.addEventListener('beforeunload', () => { if (running) savePose(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) savePose(); });

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    input.update();
    player.update(dt, input, time);
    for (const npc of npcs) npc.update(dt, time, player.position);
    for (const m of markers.values()) if (m.group.visible) m.update(time);
    if (exitMarker.group.visible) exitMarker.update(time);
    for (const fn of office.animated) fn(time);
    sky.update(time);
    if (running) checkInteractions();
    saveTimer += dt;
    if (running && saveTimer > 3) { saveTimer = 0; savePose(); }
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  function showMenu() {
    const quests = dayQuests();
    const done = quests.filter((q) => store.questStatus(q.id) === QuestStatus.DONE).length;
    openModal({
      title: 'Меню',
      subtitle: `${name()} · ${day().title} · выполнено ${done} из ${quests.length}`,
      body: h('div', { class: 'lesson' },
        h('p', {}, 'Прогресс сохраняется автоматически в этом браузере.'),
        h('div', { class: 'controls' },
          h('div', {}, h('kbd', {}, 'W A S D'), ' / стик — ходить, ', h('kbd', {}, 'Shift'), ' — бежать'),
          h('div', {}, 'Мышь или палец — поворот камеры'),
          h('div', {}, h('kbd', {}, 'E'), ' / 💬 — взаимодействие'),
        ),
      ),
      actions: [
        { label: '🔄 Новая игра', onClick: () => confirmNewGame() },
        { label: 'Продолжить', primary: true },
      ],
    });
  }

  function confirmNewGame() {
    openModal({
      title: 'Начать заново?',
      body: h('p', {}, 'Весь прогресс и никнейм будут сброшены.'),
      actions: [
        { label: 'Отмена' },
        { label: 'Да, заново', primary: true, onClick: () => { closeModal(); onNewGame(); } },
      ],
    });
  }
  document.getElementById('menu-btn').addEventListener('click', () => { if (running) showMenu(); });

  // Отладочный доступ из консоли браузера (только в dev-сборке)
  if (import.meta.env.DEV) {
    window.__game = {
      player,
      camera,
      renderer,
      ceilingHeight: office.ceilingHeight,
      teleport: (x, z, face = 0) => player.place(x, z, face),
      spots: office.spots,
      colliders: office.colliders,
      outdoor: outdoor.stats,
      talk: (npcId) => talk(npcs.find((n) => n.def.id === npcId)),
      minigame: (questId) => openMinigame(QUESTS.find((q) => q.id === questId)),
      day: () => store.currentDay(),
      completeDay: () => { dayQuests().forEach((q) => store.setQuestStatus(q.id, QuestStatus.DONE)); },
      endDay,
      summary: showDaySummary,
    };
  }

  return {
    start({ fresh }) {
      const s = store.getState();
      const spawn = office.spots.spawn;
      if (s.player && !fresh) player.place(s.player.x, s.player.z, s.player.heading);
      else player.place(spawn.x, spawn.z, spawn.face);
      lastMarkerAuto = null;
      lastExitAuto = false;
      refresh();
      hud.show();
      running = true;
      input.setEnabled(true);
      if (!s.dayIntroShown) showDayIntro();
      // Если игрок сохранился, стоя на маркере, не открываем мини-игру или итоги сразу
      checkInteractionsSilently();
    },
    stop() {
      running = false;
      input.setEnabled(false);
      hud.hide();
      hud.setPrompt(null);
      input.setActionVisible(false);
      closeModal();
    },
  };

  function checkInteractionsSilently() {
    const p = player.position;
    for (const q of QUESTS) {
      const m = markers.get(q.id).position;
      if (store.questStatus(q.id) === QuestStatus.ACTIVE && Math.hypot(m.x - p.x, m.z - p.z) < MARKER_RADIUS) lastMarkerAuto = q.id;
    }
    const e = exitMarker.position;
    if (exitMarker.group.visible && Math.hypot(e.x - p.x, e.z - p.z) < MARKER_RADIUS) lastExitAuto = true;
  }
}
