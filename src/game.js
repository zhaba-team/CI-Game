// Игровой мир: сцена, цикл обновления, взаимодействие с NPC и маркерами квестов.
import * as THREE from 'three';
import { buildOffice } from './world/office.js';
import { createPlayer } from './world/player.js';
import { createNpc, createQuestMarker } from './world/npc.js';
import { createInput } from './input.js';
import { createHud } from './ui/hud.js';
import { h } from './ui/dom.js';
import { openModal, closeModal, onModalChange, isModalOpen } from './ui/modal.js';
import { NPCS } from './quests/npcs.js';
import { QUESTS, fillTemplate } from './quests/quests.js';
import { getMinigame } from './minigames/index.js';
import * as store from './state.js';

const { QuestStatus } = store;
const TALK_RADIUS = 2.0;
const MARKER_RADIUS = 0.8;

export function createGame({ onNewGame }) {
  const canvas = document.getElementById('game');
  const isMobile = window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile || window.devicePixelRatio < 2 });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe4ff');
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight('#ffffff', '#b59a74', 1.4));
  const sun = new THREE.DirectionalLight('#fff4e0', 1.6);
  sun.position.set(-8, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 16, bottom: -16, near: 1, far: 50 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  // Голубоватая подсветка серверной
  const serverLight = new THREE.PointLight('#ff6b6b', 6, 12);
  serverLight.position.set(11, 2.6, 6);
  scene.add(serverLight);

  const office = buildOffice();
  scene.add(office.root);

  const input = createInput(canvas);
  const hud = createHud();
  const player = createPlayer(scene, camera, office);

  const npcs = NPCS.map((def) => {
    const npc = createNpc(def, office.spots[def.spot]);
    scene.add(npc.group);
    const { x, z } = npc.position;
    office.colliders.push({ x0: x - 0.3, z0: z - 0.3, x1: x + 0.3, z1: z + 0.3 });
    return npc;
  });

  const markers = new Map(QUESTS.map((q) => {
    const spot = office.spots[q.spot];
    const marker = createQuestMarker(spot.x, spot.z);
    scene.add(marker.group);
    return [q.id, marker];
  }));

  const name = () => store.getState().name;
  const t = (text) => fillTemplate(text, name());

  // ---------- Синхронизация мира с состоянием ----------
  function refresh() {
    for (const npc of npcs) {
      const quest = QUESTS.find((q) => q.npc === npc.def.id);
      npc.setStatus(quest ? store.questStatus(quest.id) : null);
    }
    for (const q of QUESTS) markers.get(q.id).group.visible = store.questStatus(q.id) === QuestStatus.ACTIVE;
    const serverFixed = store.questStatus('pipeline') === QuestStatus.DONE;
    office.setServerFixed(serverFixed);
    serverLight.color.set(serverFixed ? '#6bc5ff' : '#ff6b6b');
    hud.renderJournal(QUESTS, NPCS, store.questStatus);
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
          { label: '✋ Взять квест', primary: true, onClick: () => acceptQuest(quest) },
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
    hud.toast(`Новый квест: «${quest.title}». Иди к жёлтому маркеру — ${quest.where}.`, 'quest');
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
    const allDone = QUESTS.every((q) => store.questStatus(q.id) === QuestStatus.DONE);
    openModal({
      title: 'Квест выполнен! 🎉',
      subtitle: quest.title,
      body: h('div', { class: 'lesson' },
        h('div', { class: 'lesson-tag' }, `💡 Что ты узнал: ${quest.lesson.title}`),
        h('p', {}, quest.lesson.text),
        h('p', { class: 'muted' }, `${npc.name} говорит спасибо! Можно подойти ещё раз и поболтать.`),
      ),
      actions: [{
        label: allDone ? 'Дальше →' : 'Супер!',
        primary: true,
        onClick: () => { closeModal(); if (allDone && !store.getState().finaleShown) showFinale(); },
      }],
    });
  }

  function showFinale() {
    store.setFinaleShown();
    openModal({
      title: `Поздравляем, ${name()}! 🏆`,
      subtitle: 'Первая неделя стажировки в DonCode пройдена',
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
  let lastNpcAuto = null;
  let lastMarkerAuto = null;

  function interact() {
    if (isModalOpen()) return;
    if (nearMarker) openMinigame(nearMarker);
    else if (nearNpc) talk(nearNpc);
  }
  input.onAction(interact);

  function checkInteractions() {
    const p = player.position;
    nearNpc = null;
    let best = TALK_RADIUS;
    for (const npc of npcs) {
      const d = Math.hypot(npc.position.x - p.x, npc.position.z - p.z);
      if (d < best) { best = d; nearNpc = npc; }
    }
    nearMarker = null;
    for (const q of QUESTS) {
      if (store.questStatus(q.id) !== QuestStatus.ACTIVE) continue;
      const m = markers.get(q.id).position;
      if (Math.hypot(m.x - p.x, m.z - p.z) < MARKER_RADIUS) { nearMarker = q; break; }
    }

    if (isModalOpen()) return;
    // Автооткрытие окна при подходе — один раз, пока игрок не отойдёт
    if (nearMarker && lastMarkerAuto !== nearMarker.id) {
      lastMarkerAuto = nearMarker.id;
      openMinigame(nearMarker);
      return;
    }
    if (!nearMarker) lastMarkerAuto = null;
    const nearId = nearNpc?.def.id ?? null;
    if (nearNpc && lastNpcAuto !== nearId) {
      lastNpcAuto = nearId;
      const quest = QUESTS.find((q) => q.npc === nearId);
      if (store.questStatus(quest.id) === QuestStatus.AVAILABLE) { talk(nearNpc); return; }
    }
    if (!nearNpc) lastNpcAuto = null;

    const key = input.state.isTouch ? '' : 'E — ';
    if (nearMarker) {
      hud.setPrompt(`${key}Сесть за компьютер`);
      input.setActionVisible(true, '💻');
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
    for (const fn of office.animated) fn(time);
    if (running) checkInteractions();
    saveTimer += dt;
    if (running && saveTimer > 3) { saveTimer = 0; savePose(); }
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  function showWelcome() {
    openModal({
      title: `Добро пожаловать, ${name()}!`,
      subtitle: 'IT-компания DonCode, первый день стажировки',
      body: h('div', { class: 'lesson' },
        h('p', {}, 'Ты — новый стажёр-программист. Познакомься с командой: у коллег с жёлтым знаком «!» над головой есть для тебя задания. Выполнять их можно в любом порядке.'),
        h('div', { class: 'controls' },
          input.state.isTouch
            ? [h('div', {}, '🕹️ Стик слева — ходить'), h('div', {}, '👆 Проведи по экрану — повернуть камеру'), h('div', {}, '💬 Кнопка справа — говорить')]
            : [h('div', {}, h('kbd', {}, 'W A S D'), ' — ходить, ', h('kbd', {}, 'Shift'), ' — бежать'), h('div', {}, '🖱️ Зажми мышь и веди — повернуть камеру'), h('div', {}, h('kbd', {}, 'E'), ' — поговорить / сесть за компьютер')],
        ),
      ),
      actions: [{ label: 'Поехали!', primary: true }],
    });
  }

  function showMenu() {
    const done = QUESTS.filter((q) => store.questStatus(q.id) === QuestStatus.DONE).length;
    openModal({
      title: 'Меню',
      subtitle: `${name()} · выполнено ${done} из ${QUESTS.length}`,
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
      teleport: (x, z, face = 0) => player.place(x, z, face),
      spots: office.spots,
      colliders: office.colliders,
      talk: (npcId) => talk(npcs.find((n) => n.def.id === npcId)),
      minigame: (questId) => openMinigame(QUESTS.find((q) => q.id === questId)),
    };
  }

  return {
    start({ fresh }) {
      const s = store.getState();
      const spawn = office.spots.spawn;
      if (s.player && !fresh) player.place(s.player.x, s.player.z, s.player.heading);
      else player.place(spawn.x, spawn.z, spawn.face);
      lastNpcAuto = null;
      lastMarkerAuto = null;
      refresh();
      hud.show();
      running = true;
      input.setEnabled(true);
      if (fresh) showWelcome();
      // Если игрок сохранился, стоя на маркере, не открываем мини-игру сразу
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
    for (const npc of npcs) {
      if (Math.hypot(npc.position.x - p.x, npc.position.z - p.z) < TALK_RADIUS) lastNpcAuto = npc.def.id;
    }
  }
}
