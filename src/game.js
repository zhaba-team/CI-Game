// Игровой мир: сцена, цикл обновления, взаимодействие с NPC и маркерами квестов,
// шаги многошаговых квестов (диалог, подход NPC, предмет, тушение огня, мини-игра, полноэкранная сцена),
// рабочие дни (интро, итоги, переход к следующему дню, вечер), пинг-понг в Игровой, База знаний на полке,
// коллекционные книги и финал.
import * as THREE from 'three';
import { buildOffice } from './world/office.js';
import { buildSky, SKY_DAY, SKY_EVENING } from './world/sky.js';
import { buildOutdoor } from './world/outdoor.js';
import { createPlayer } from './world/player.js';
import { createNpc, createQuestMarker } from './world/npc.js';
import { createFire, buildExtinguisher } from './world/fire.js';
import { createInput } from './input.js';
import { createProps } from './flow/props.js';
import { createPingPong } from './flow/pingPong.js';
import { createKnowledgeBase } from './flow/knowledge.js';
import { createCollectibles } from './flow/collectibles.js';
import { buildCollectibleBook } from './world/collectibleBook.js';
import { buildHeldRacket } from './world/gameRoom.js';
import { createHud } from './ui/hud.js';
import { h } from './ui/dom.js';
import { openModal, closeModal, onModalChange, isModalOpen } from './ui/modal.js';
import { renderKnowledgeBase } from './ui/knowledgeBase.js';
import { renderTrophies } from './ui/trophies.js';
import { SCREENS } from './ui/screens.js';
import { NPCS } from './quests/npcs.js';
import { QUESTS, fillTemplate, questSteps, stepAt } from './quests/quests.js';
import { DAYS, questsOfDay, dayOfQuest, lockedRooms, isEvening } from './quests/days.js';
import { GLOSSARY, validateGlossary } from './quests/glossary.js';
import { BOOKS, validateBooks } from './quests/books.js';
import { getMinigame } from './minigames/index.js';
import * as store from './state.js';

const { QuestStatus } = store;
const TALK_RADIUS = 2.0;
const MARKER_RADIUS = 0.8;
const FIRE_RADIUS = 1.6;
const STEP_TYPES = ['talk', 'pickup', 'hazard', 'minigame', 'screen'];
const NPC_HALF = 0.3; // половина стороны квадратного коллайдера NPC
// Свет дня и вечера (quests/days.js, evening): солнце, небесный свет и фон под куполом неба.
// Вечернее солнце низко на западе и светит в западные окна; позиция дальше по лучу, чтобы Игровая
// попадала в рамку теней (near/far ниже)
const LIGHTING = {
  day: { sun: '#fff4e0', sunIntensity: 1.2, sunPos: [-8, 18, 6], sky: '#ffffff', ground: '#c9b391', hemi: 1.0, background: SKY_DAY.horizon },
  evening: { sun: '#ff9a5a', sunIntensity: 0.7, sunPos: [-27, 10.5, 6], sky: '#ffd9c0', ground: '#7a6a8a', hemi: 0.75, background: SKY_EVENING.horizon },
};

// Ошибки в данных многошагового квеста ловим при старте, а не посреди сюжета
// «4 дня», «5 дней»
function daysWord(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'день';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'дня';
  return 'дней';
}

function validateSteps(quest, spots) {
  for (const step of questSteps(quest)) {
    const where = `Шаг «${step.id}» квеста «${quest.id}»`;
    if (!STEP_TYPES.includes(step.type)) throw new Error(`${where}: неизвестный type «${step.type}»`);
    if (step.type === 'talk' && !NPCS.some((n) => n.id === step.npc)) throw new Error(`${where}: у шага talk нет npc из npcs.js`);
    if (step.type === 'talk' && !step.lines?.length) throw new Error(`${where}: у шага talk нет lines`);
    if (step.type !== 'hazard' && step.type !== 'screen' && !spots[step.spot]) throw new Error(`${where}: нет точки «${step.spot}» в office.spots`);
    if (step.type === 'screen' && !SCREENS[step.screen]) throw new Error(`${where}: сцена «${step.screen}» не зарегистрирована в ui/screens.js`);
    if (step.type === 'screen' && !(step.duration > 0)) throw new Error(`${where}: у шага screen нет duration > 0`);
    if (step.approach && step.type !== 'talk') throw new Error(`${where}: approach бывает только у шага talk`);
    if (step.approach && spots[NPCS.find((n) => n.id === step.npc).spot].sit) throw new Error(`${where}: сидящий NPC не может подойти к игроку (approach)`);
    if (step.brokenScreen && !spots[step.brokenScreen]) throw new Error(`${where}: нет рабочего места «${step.brokenScreen}» в office.spots`);
    if ((step.type === 'pickup' || step.type === 'hazard') && !step.item) throw new Error(`${where}: не указан item`);
    if (step.type === 'hazard' && !step.targets?.every((id) => spots[id]?.rack)) throw new Error(`${where}: targets должны быть точками office.spots с полем rack`);
    if (step.type === 'minigame') getMinigame(step.minigame);
  }
}

export function createGame({ onNewGame }) {
  for (const q of QUESTS) {
    if (dayOfQuest(q.id) === -1) throw new Error(`Квест «${q.id}» не привязан ни к одному дню (src/quests/days.js)`);
  }
  validateGlossary(QUESTS);

  const canvas = document.getElementById('game');
  const isMobile = window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile || window.devicePixelRatio < 2 });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d8eeff'); // фолбэк под куполом неба — цвет горизонта
  // Дальность с запасом под купол неба R = 140
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 160);

  // Потолок смотрит вниз и получает groundColor: светлый тон, чтобы он не выглядел «грязным»
  const hemi = new THREE.HemisphereLight(LIGHTING.day.sky, LIGHTING.day.ground, LIGHTING.day.hemi);
  scene.add(hemi);
  // Солнце светит «сквозь» потолок (он не отбрасывает тень) и даёт объёмные тени от мебели
  const sun = new THREE.DirectionalLight('#fff4e0', 1.2);
  sun.position.set(-8, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  // Рамка в осях света: x ≈ 0.6·X + 0.8·Z, y ≈ 0.7·X − 0.52·Z; bottom −23 захватывает Игровую (x −25..−16, z −3..9)
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 18, bottom: -23, near: 1, far: 50 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const office = buildOffice();
  scene.add(office.root);
  for (const q of QUESTS) validateSteps(q, office.spots);
  validateBooks(office.spots);
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

  // Коллайдер NPC есть, только пока NPC в офисе (см. npcArrived в refresh) и не идёт (см. подход NPC ниже)
  const placeCollider = (npc) => {
    const { x, z } = npc.position;
    Object.assign(npc.collider, { x0: x - NPC_HALF, z0: z - NPC_HALF, x1: x + NPC_HALF, z1: z + NPC_HALF });
  };
  const npcs = NPCS.map((def) => {
    const npc = createNpc(def, office.spots[def.spot]);
    scene.add(npc.group);
    npc.collider = {};
    placeCollider(npc);
    return npc;
  });
  const npcById = (id) => npcs.find((n) => n.def.id === id);
  const removeCollider = (npc) => {
    const k = office.colliders.indexOf(npc.collider);
    if (k !== -1) office.colliders.splice(k, 1);
  };
  const addCollider = (npc) => {
    if (!office.colliders.includes(npc.collider)) office.colliders.push(npc.collider);
  };

  // Маркер квеста без шагов — на его spot; у многошагового — по маркеру на каждый шаг со spot.
  // У talk с approach spot — точка, куда подходит NPC, маркер не нужен
  const markers = QUESTS.flatMap((q) => {
    const targets = q.steps ? questSteps(q).filter((step) => step.spot && !step.approach) : [null];
    return targets.map((step) => {
      const spot = office.spots[step ? step.spot : q.spot];
      const marker = createQuestMarker(spot.x, spot.z);
      scene.add(marker.group);
      return { key: step ? `${q.id}:${step.id}` : q.id, quest: q, step, marker };
    });
  });

  // Огонь у каждой цели hazard-шагов: горит до тушения, потом дымит, пока серверная «лежит»
  const fires = QUESTS.flatMap((q) => questSteps(q).flatMap((step, stepIndex) => {
    if (step.type !== 'hazard') return [];
    return step.targets.map((targetId) => {
      const spot = office.spots[targetId];
      const fire = createFire(spot.rack.x, spot.rack.y, spot.rack.z);
      fire.group.visible = false;
      scene.add(fire.group);
      return { quest: q, step, stepIndex, targetId, spot, fire };
    });
  }));
  // Рабочие места, мониторы которых «падают» на шагах с brokenScreen
  const screenKeys = [...new Set(QUESTS.flatMap((q) => questSteps(q).map((step) => step.brokenScreen).filter(Boolean)))];
  const heldExtinguisher = buildExtinguisher();
  // Пуфики и кофемашина Игровой; руки свободны, пока нет предмета квеста (см. heldItem ниже)
  const props = createProps({
    seats: office.seats,
    coffee: office.coffee,
    coffeeSpot: office.spots.coffee,
    player,
    hud,
    input,
    handsFree: () => heldItem() === null,
  });
  // Теннисный стол: матч со случайным NPC; соперник на время матча без коллайдера
  const pingPong = createPingPong({
    ...office.pingPong,
    makeRacket: buildHeldRacket,
    spots: office.spots,
    npcs,
    player,
    hud,
    handsFree: () => heldItem() === null,
    openModal,
    closeModal,
    getMinigame,
    h,
    playerName: () => name(),
    fill: (text) => t(text),
    homeOf,
    onOpponentEnter: (npc) => removeCollider(npc),
    onOpponentLeave: (npc) => {
      placeCollider(npc);
      if (npcArrived(npc)) addCollider(npc);
      refresh(); // не пришедший по сюжету NPC снова скрыт, в руке — предмет квеста
    },
  });
  let fireBurning = false; // хоть одна стойка горит — свет серверной мерцает
  const exitMarker = createQuestMarker(office.spots.exit.x, office.spots.exit.z, { color: '#2e9e5b', beam: '#9be7b4' });
  scene.add(exitMarker.group);
  // База знаний: фиолетовый маркер у книжного шкафа open-space
  const kbMarker = createQuestMarker(office.spots.bookshelf.x, office.spots.bookshelf.z, { color: '#9b5de5', beam: '#d7b8ff' });
  scene.add(kbMarker.group);
  const knowledge = createKnowledgeBase({
    bookshelf: office.bookshelf,
    spot: office.spots.bookshelf,
    marker: kbMarker,
    camera,
    player,
    hud,
    openModal,
    render: renderKnowledgeBase,
    sections: () => knowledgeSections(),
    markSeen: store.markKbSeen,
  });
  // Коллекционные книги: лежат без маркеров на spots из office.js, найденные — в коллекции 🏆
  const bookItems = BOOKS.map((book) => {
    const spot = office.spots[book.spot];
    const mesh = buildCollectibleBook(book);
    mesh.group.position.set(spot.x, spot.y, spot.z);
    mesh.group.rotation.y = spot.rot ?? 0;
    scene.add(mesh.group);
    return { book, mesh, spot };
  });
  const isBookFound = (id) => store.booksFound().includes(id);
  const collectibles = createCollectibles({
    items: bookItems,
    player,
    camera,
    hud,
    isFound: isBookFound,
    markFound: store.markBookFound,
    found: store.booksFound,
    openModal,
    render: renderTrophies,
  });

  const name = () => store.getState().name;
  const t = (text) => fillTemplate(text, name());
  const npcDef = (id) => NPCS.find((n) => n.id === id);

  // ---------- Шаги квестов ----------
  const isActive = (q) => store.questStatus(q.id) === QuestStatus.ACTIVE;
  // Текущий шаг активного многошагового квеста или null
  const currentStep = (q) => (isActive(q) ? stepAt(q, store.questStep(q.id).index) : null);
  const markerLive = (m) => (m.step ? currentStep(m.quest) === m.step : isActive(m.quest));
  // Активный talk-шаг, цель которого — этот NPC
  const talkStepFor = (npcId) => {
    for (const quest of QUESTS) {
      const step = currentStep(quest);
      if (step?.type === 'talk' && step.npc === npcId) return { quest, step };
    }
    return null;
  };
  // Предмет в руках — пока текущий шаг hazard, которому он нужен
  const heldItem = () => QUESTS.map(currentStep).find((step) => step?.type === 'hazard')?.item ?? null;
  const fireBurns = (f) => {
    if (!isActive(f.quest)) return false;
    const { index, cleared } = store.questStep(f.quest.id);
    return index < f.stepIndex || (index === f.stepIndex && !cleared.includes(f.targetId));
  };
  const fireVisible = (f) => isActive(f.quest) && (store.questStep(f.quest.id).index <= f.stepIndex || Boolean(currentStep(f.quest)?.serverDown));

  // Подсказка в журнале для активного квеста
  function activeHint(q) {
    const step = currentStep(q);
    if (!step) return `Иди: ${q.where}`;
    if (step.type === 'hazard') return `${step.hint}: ${store.questStep(q.id).cleared.length} из ${step.targets.length}`;
    return step.hint ?? `Иди: ${step.where}`;
  }

  // ---------- Рабочие дни ----------
  const day = () => DAYS[store.currentDay()];
  const isLastDay = () => store.currentDay() === DAYS.length - 1;
  const dayQuests = () => questsOfDay(store.currentDay(), QUESTS);
  const isDayDone = () => dayQuests().every((q) => store.questStatus(q.id) === QuestStatus.DONE);
  // Квест NPC на сегодня: у NPC может быть несколько квестов в разные дни. Берём квест текущего дня,
  // иначе — самый поздний из прошедших дней; null, если все его квесты ещё впереди
  const questOfNpc = (npcId) => {
    const today = store.currentDay();
    const own = QUESTS.filter((q) => q.npc === npcId && dayOfQuest(q.id) <= today);
    const latest = (a, b) => (dayOfQuest(b.id) > dayOfQuest(a.id) ? b : a);
    return own.length ? own.reduce(latest) : null;
  };
  // NPC приходит в офис в день своего первого квеста; NPC без квестов в офисе всегда
  const npcArrived = (npc) => !QUESTS.some((q) => q.npc === npc.def.id) || questOfNpc(npc.def.id) !== null;

  // ---------- База знаний ----------
  // Термин открыт, когда его квест выполнен; замок подсказывает, что сделать или в какой день он откроется
  function glossaryCard(entry) {
    const open = !entry.quest || store.questStatus(entry.quest) === QuestStatus.DONE;
    const card = { ...entry, open, hint: null, isNew: open && !store.kbSeen().includes(entry.id) };
    if (open) return card;
    const questDay = dayOfQuest(entry.quest);
    const quest = QUESTS.find((q) => q.id === entry.quest);
    card.hint = questDay <= store.currentDay() ? `Выполни задачу «${quest.title}»` : `Откроется: ${DAYS[questDay].title}`;
    return card;
  }
  // Секции модалки: «Старт» и по секции на каждый день; дни без терминов не выводим
  function knowledgeSections() {
    const ofDay = (dayIndex) => GLOSSARY.filter((e) => e.quest && dayOfQuest(e.quest) === dayIndex);
    const list = [{ title: 'Старт', entries: GLOSSARY.filter((e) => !e.quest) }, ...DAYS.map((d, i) => ({ title: d.title, entries: ofDay(i) }))];
    return list.filter((s) => s.entries.length).map((s) => ({ title: s.title, entries: s.entries.map(glossaryCard) }));
  }

  // ---------- Вечер ----------
  let eveningOn = null;
  function applyTimeOfDay(on) {
    if (eveningOn === on) return;
    eveningOn = on;
    const light = on ? LIGHTING.evening : LIGHTING.day;
    sky.setEvening(on);
    office.setEvening(on);
    sun.color.set(light.sun);
    sun.intensity = light.sunIntensity;
    sun.position.set(...light.sunPos);
    hemi.color.set(light.sky);
    hemi.groundColor.set(light.ground);
    hemi.intensity = light.hemi;
    scene.background.set(light.background);
  }

  // ---------- Синхронизация мира с состоянием ----------
  // Последняя строка журнала, когда все задачи дня выполнены
  function exitHint(dayDone) {
    if (!dayDone) return null;
    if (!isLastDay()) return 'День завершён — выход у ресепшена 🚪';
    return store.getState().finished ? 'Стажировка пройдена 🏆 — гуляй по офису' : 'Все задачи выполнены — выход у ресепшена 🚪';
  }

  function refresh() {
    office.setLocks(lockedRooms(store.currentDay()));
    applyTimeOfDay(isEvening(store.currentDay()));
    for (const npc of npcs) {
      const quest = questOfNpc(npc.def.id);
      // «!» над NPC, к которому ведёт текущий talk-шаг, иначе — статус его квеста на сегодня
      const status = talkStepFor(npc.def.id) ? QuestStatus.AVAILABLE : quest ? store.questStatus(quest.id) : null;
      npc.setStatus(status);
      const arrived = npcArrived(npc);
      npc.group.visible = arrived || pingPong.opponent === npc; // соперник виден у стола, даже если ещё не пришёл
      if (npc.walking || pingPong.opponent === npc) continue; // коллайдер вернёт окончание пути / матча
      if (arrived) addCollider(npc);
      else removeCollider(npc);
    }
    for (const m of markers) m.marker.group.visible = markerLive(m);
    fireBurning = false;
    for (const f of fires) {
      f.fire.group.visible = fireVisible(f);
      if (f.fire.busy) continue; // идёт анимация тушения — состояние выставит её окончание
      const burns = fireBurns(f);
      if (f.fire.burning !== burns) f.fire.setBurning(burns);
      fireBurning ||= burns;
    }
    const held = heldItem() === 'extinguisher';
    if (!props.holdsItem && !pingPong.active) player.setHeld(held ? heldExtinguisher : null); // стаканчик рафа не выбиваем из рук
    office.setExtinguisherOnWall(!held);
    const dayDone = isDayDone();
    exitMarker.group.visible = dayDone;
    // Сервер «лежит», пока не пройден пайплайн или пока текущий шаг квеста помечен serverDown
    const serverDown = QUESTS.some((q) => currentStep(q)?.serverDown);
    const serverFixed = store.questStatus('pipeline') === QuestStatus.DONE && !serverDown;
    office.setServerFixed(serverFixed);
    // Синий экран на мониторе, пока текущий шаг квеста помечен brokenScreen
    const broken = new Set(QUESTS.map((q) => currentStep(q)?.brokenScreen).filter(Boolean));
    for (const key of screenKeys) office.setScreenCrashed(key, broken.has(key));
    serverLight.color.set(serverFixed ? '#6bc5ff' : '#ff6b6b');
    serverLight.intensity = 6;
    collectibles.sync();
    hud.setTrophies(store.booksFound().length, BOOKS.length);
    hud.renderJournal(dayQuests(), NPCS, store.questStatus, {
      title: day().title,
      doneHint: exitHint(dayDone),
      hintOf: activeHint,
    });
  }
  store.onChange(refresh);

  // Захват курсора (десктоп): на время модалки курсор свободен, после — захватываем снова.
  // Закрытие кнопкой — жест пользователя, браузер разрешит захват; иначе останется подсказка «кликни»
  let running = false;
  const updateLockHint = () => hud.setLockHint(running && input.mouseMode && !isModalOpen() && !input.state.pointerLocked);
  onModalChange((open) => {
    input.setEnabled(!open);
    if (open) input.unlockPointer();
    // openModal поверх открытого окна сначала закрывает старое — ждём, не откроется ли новое
    else setTimeout(() => { if (!isModalOpen()) input.lockPointer(); }, 0);
    updateLockHint();
  });
  input.onPointerLockChange(updateLockHint);

  // ---------- Диалоги ----------
  function npcAvatar(def) {
    return h('div', { class: 'avatar', style: { background: def.style.shirt, borderColor: def.style.accent } }, def.name[0]);
  }

  // Диалог по репликам lines; на последней реплике — кнопки lastActions
  function openDialog(def, lines, lastActions) {
    let index = 0;
    const bubble = h('div', { class: 'bubble' });
    const dots = h('div', { class: 'dots' });
    const body = h('div', { class: 'dialog' }, npcAvatar(def), h('div', { class: 'dialog-text' }, bubble, dots));
    const modal = openModal({ title: def.name, badge: def.role, body });

    const show = () => {
      bubble.textContent = lines[index];
      bubble.classList.remove('appear');
      void bubble.offsetWidth;
      bubble.classList.add('appear');
      dots.replaceChildren(...(lines.length > 1 ? lines.map((_, i) => h('i', { class: i === index ? 'on' : '' })) : []));
      if (index < lines.length - 1) modal.setActions([{ label: 'Далее →', primary: true, onClick: () => { index++; show(); } }]);
      else modal.setActions(lastActions);
    };
    show();
  }

  function talk(npc) {
    const target = talkStepFor(npc.def.id);
    if (target) { talkStep(target.quest, target.step); return; }
    const quest = questOfNpc(npc.def.id);
    const status = store.questStatus(quest.id);
    const lines = status === QuestStatus.AVAILABLE ? quest.dialog.intro : status === QuestStatus.ACTIVE ? quest.dialog.active : quest.dialog.done;
    let actions = [{ label: 'Понятно', primary: true }];
    if (status === QuestStatus.AVAILABLE) {
      actions = [
        { label: 'Позже' },
        { label: quest.dialog.accept ?? '✋ Взять задачу', primary: true, onClick: () => acceptQuest(quest) },
      ];
    } else if (status === QuestStatus.DONE) {
      actions = [{ label: 'Пока!', primary: true }];
    }
    openDialog(npc.def, lines.map(t), actions);
  }

  function talkStep(quest, step) {
    openDialog(npcDef(step.npc), step.lines.map(t), [
      {
        label: step.action ?? 'Понятно',
        primary: true,
        onClick: () => {
          closeModal();
          if (step.approach) sendHome(npcById(step.npc)); // подошедший NPC возвращается на место
          advanceStep(quest);
        },
      },
    ]);
  }

  function acceptQuest(quest) {
    if (quest.steps) store.setQuestStep(quest.id, 0);
    store.setQuestStatus(quest.id, QuestStatus.ACTIVE);
    closeModal();
    if (quest.steps) enterStep(quest, stepAt(quest, 0));
    else hud.toast(`Новая задача: «${quest.title}». Иди к жёлтому маркеру — ${quest.where}.`, 'quest');
  }

  function announceStep(step) {
    if (step.alarm) hud.alarm();
    if (step.toast) hud.toast(step.toast, step.alarm ? 'alarm' : 'quest');
  }

  // Шаг стал текущим: уведомление; шаги screen и talk с approach начинаются сами
  function enterStep(quest, step) {
    announceStep(step);
    if (step.type === 'screen') runScreen(quest, step);
    else if (step.approach) approach(quest, step);
  }

  // Следующий шаг; после последнего квест выполнен
  function advanceStep(quest) {
    const next = store.questStep(quest.id).index + 1;
    const step = stepAt(quest, next);
    if (!step) { completeQuest(quest); return; }
    store.setQuestStep(quest.id, next);
    enterStep(quest, step);
  }

  // Полноэкранная сцена шага screen (ui/screens.js); закончилась — следующий шаг
  let screenRunning = false;
  function runScreen(quest, step) {
    if (screenRunning) return;
    screenRunning = true;
    SCREENS[step.screen]({
      duration: step.duration,
      onDone: () => {
        screenRunning = false;
        advanceStep(quest);
      },
    });
  }

  // ---------- Подход NPC (talk с approach) ----------
  // Пока NPC идёт к игроку, игрок «заморожен», а взаимодействие отключено
  let cutscene = null; // { npc } — кто сейчас идёт к игроку

  function approach(quest, step) {
    const npc = npcById(step.npc);
    const spot = office.spots[step.spot];
    const p = player.position;
    cutscene = { npc };
    player.setFrozen(true);
    removeCollider(npc);
    npc.walkTo([...(spot.path ?? []), spot], {
      face: Math.atan2(p.x - spot.x, p.z - spot.z),
      onArrive: () => {
        placeCollider(npc);
        addCollider(npc);
        player.face(npc.position.x, npc.position.z);
        player.setFrozen(false);
        cutscene = null;
        hud.setPrompt(null);
        if (!isModalOpen()) talkStep(quest, step); // иначе диалог откроется по E — над NPC горит «!»
      },
    });
  }

  function sendHome(npc) {
    removeCollider(npc);
    npc.returnHome({
      onArrive: () => {
        placeCollider(npc);
        if (npcArrived(npc)) addCollider(npc);
      },
    });
  }

  // Расставить NPC по состоянию (старт и перезапуск игры): подошедший по approach-шагу стоит у игрока,
  // остальные — на своих местах
  // Где NPC должен стоять сейчас: у игрока по approach-шагу (via — путь от своего места) или на своём spot
  function homeOf(npc) {
    const target = talkStepFor(npc.def.id);
    const spot = target?.step.approach ? office.spots[target.step.spot] : office.spots[npc.def.spot];
    return { x: spot.x, z: spot.z, face: spot.face, via: target?.step.approach ? spot.path ?? [] : [] };
  }

  function placeNpcs() {
    for (const npc of npcs) {
      const home = homeOf(npc);
      if (!npc.walking && npc.position.x === home.x && npc.position.z === home.z) continue;
      removeCollider(npc);
      npc.place(home.x, home.z, home.face, { via: home.via });
      placeCollider(npc);
      if (npcArrived(npc)) addCollider(npc);
    }
  }

  function completeQuest(quest) {
    store.setQuestStatus(quest.id, QuestStatus.DONE);
    showLesson(quest, npcDef(quest.npc));
  }

  function pickUp(quest) {
    advanceStep(quest);
  }

  // Тушение одной цели hazard-шага: анимация пены, затем отметка в сохранении
  function extinguish(f) {
    if (f.fire.busy || !f.fire.burning) return;
    f.fire.extinguish(() => {
      store.markCleared(f.quest.id, f.targetId);
      const { cleared } = store.questStep(f.quest.id);
      const left = f.step.targets.filter((id) => !cleared.includes(id)).length;
      if (left > 0) { hud.toast(`🧯 Потушено: ${cleared.length} из ${f.step.targets.length}`); return; }
      advanceStep(f.quest);
    });
  }

  // ---------- Мини-игры ----------
  // step — шаг minigame многошагового квеста; без него мини-игра завершает весь квест
  function openMinigame(quest, step = null) {
    const mg = getMinigame(step ? step.minigame : quest.minigame);
    const npc = npcDef(step?.npc ?? quest.npc);
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
        if (!step) { completeQuest(quest); return; }
        closeModal();
        advanceStep(quest);
      },
    });
  }

  function showLesson(quest, npc) {
    const dayDone = isDayDone();
    // В последний день финал открывается только на выходе из офиса
    const finalDone = dayDone && isLastDay();
    let action = { label: 'Супер!', primary: true };
    if (finalDone) {
      action = { label: 'Супер!', primary: true, onClick: () => { closeModal(); hud.toast('Все задачи пятницы готовы — выходи из офиса у ресепшена 🚪', 'quest'); } };
    } else if (dayDone) {
      action = { label: 'Итоги дня →', primary: true, onClick: showDaySummary };
    }
    openModal({
      title: 'Задача выполнена! 🎉',
      subtitle: quest.title,
      body: h('div', { class: 'lesson' },
        h('div', { class: 'lesson-tag' }, `💡 Что ты узнал: ${quest.lesson.title}`),
        h('p', {}, quest.lesson.text),
        h('p', { class: 'muted' }, `${npc.name} говорит спасибо! Можно подойти ещё раз и поболтать.`),
        GLOSSARY.some((e) => e.quest === quest.id)
          ? h('p', { class: 'muted' }, '📚 Новые термины — в Базе знаний на книжной полке в open-space.')
          : null,
      ),
      actions: [action],
    });
  }

  // ---------- Интро, итоги и смена дня ----------
  const mouseControls = () => (input.mouseMode
    ? h('div', {}, '🖱️ Двигай мышью — повернуть камеру, ', h('kbd', {}, 'Esc'), ' — показать курсор')
    : h('div', {}, '🖱️ Зажми мышь и веди — повернуть камеру'));

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
              : [h('div', {}, h('kbd', {}, 'W A S D'), ' — ходить, ', h('kbd', {}, 'Shift'), ' — бежать'), mouseControls(), h('div', {}, h('kbd', {}, 'E'), ' — поговорить / сесть за компьютер')],
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

  // Выход из офиса: в последний день — сразу финал, иначе — итоги дня
  function leaveOffice() {
    if (isLastDay()) showFinale();
    else showDaySummary();
  }

  function endDay() {
    if (isLastDay()) { showFinale(); return; }
    store.advanceDay(); // onChange → refresh: двери, NPC и журнал нового дня
    const spawn = office.spots.spawn;
    player.place(spawn.x, spawn.z, spawn.face);
    lastMarkerAuto = null;
    lastExitAuto = false;
    savePose();
    showDayIntro();
  }

  // Финал стажировки: итоги последнего дня и всей игры. Повторный выход снова открывает это окно
  function showFinale() {
    if (!store.getState().finished) {
      store.setFinished();
      refresh(); // setFinished не оповещает подписчиков — подсказка журнала меняется здесь
    }
    openModal({
      title: `Стажировка пройдена, ${name()}! 🏆`,
      subtitle: `${DAYS.length} ${daysWord(DAYS.length)} стажировки позади — игра завершена`,
      body: h('div', { class: 'lesson day-summary' },
        h('p', {}, 'Ты прошёл все рабочие дни. Можешь дальше гулять по офису, болтать с командой, пить раф и играть в пинг-понг.'),
        h('h3', {}, '💡 Что ты узнал в последний день'),
        h('ul', { class: 'roles' }, dayQuests().map((q) => h('li', {}, h('b', {}, q.lesson.title), ` — ${q.lesson.text}`))),
        h('p', {}, day().summary.insight),
        h('h3', {}, '🧑‍💻 Роли, которые ты попробовал'),
        h('ul', { class: 'roles' }, QUESTS.map((q) => {
          const npc = npcDef(q.npc);
          return h('li', {}, h('b', {}, q.lesson.title), ` — ${npc.name}, ${npc.role}`);
        })),
        h('p', {}, 'Программист — это не только код. Это внимание к деталям, умение искать ошибки, автоматизировать рутину и работать в команде. Если тебе понравилось — попробуй написать свою первую программу на JavaScript или Python!'),
      ),
      actions: [
        { label: 'Начать заново', onClick: () => { closeModal(); onNewGame(); } },
        { label: 'Гулять по офису', primary: true, onClick: () => { closeModal(); hud.toast('Офис твой — гуляй сколько хочешь. Новая игра — в меню ☰'); } },
      ],
    });
  }

  // ---------- Взаимодействие ----------
  let nearNpc = null;
  let nearMarker = null; // запись из markers
  let nearFire = null;   // запись из fires — горящая цель рядом
  let nearExit = false;
  let lastMarkerAuto = null;
  let lastExitAuto = false;

  // Подход к маркеру: мини-игра, диалог talk-шага или подбор предмета
  function activateMarker(m) {
    if (!m.step || m.step.type === 'minigame') openMinigame(m.quest, m.step);
    else if (m.step.type === 'talk') talkStep(m.quest, m.step);
    else if (m.step.type === 'pickup') pickUp(m.quest);
  }

  // Потушить можно, только когда hazard-шаг этой цели текущий (тогда предмет в руках)
  const canExtinguish = (f) => currentStep(f.quest) === f.step;

  function interact() {
    if (isModalOpen() || props.busy || cutscene) return;
    if (player.seated) { props.interact(); return; }
    if (nearMarker) activateMarker(nearMarker);
    else if (nearFire) { if (canExtinguish(nearFire)) extinguish(nearFire); }
    else if (nearExit) leaveOffice();
    else if (nearNpc) talk(nearNpc);
    else if (!pingPong.interact() && !collectibles.interact() && !knowledge.interact()) props.interact();
  }
  input.onAction(interact);
  // Тап / клик по коллекционной книге подбирает её, по книжному шкафу — открывает Базу знаний (рядом)
  // или просит подойти ближе
  input.onTap((ndc) => {
    if (isModalOpen() || props.busy || player.seated || cutscene) return;
    if (!collectibles.tap(ndc)) knowledge.tap(ndc);
  });

  function markerPrompt(m) {
    if (m.step?.type === 'talk') return { text: `Поговорить: ${npcDef(m.step.npc).name}`, icon: '💬' };
    if (m.step?.type === 'pickup') return { text: 'Взять', icon: '✋' };
    return { text: 'Сесть за компьютер', icon: '💻' };
  }

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
    for (const m of markers) {
      if (!m.marker.group.visible) continue;
      const mp = m.marker.position;
      if (Math.hypot(mp.x - p.x, mp.z - p.z) < MARKER_RADIUS) { nearMarker = m; break; }
    }
    nearFire = null;
    let bestFire = FIRE_RADIUS;
    for (const f of fires) {
      if (!f.fire.group.visible || !f.fire.burning || f.fire.busy) continue;
      const d = Math.hypot(f.spot.x - p.x, f.spot.z - p.z);
      if (d < bestFire) { bestFire = d; nearFire = f; }
    }
    const e = exitMarker.position;
    nearExit = exitMarker.group.visible && Math.hypot(e.x - p.x, e.z - p.z) < MARKER_RADIUS;

    if (isModalOpen()) return;
    const key = input.state.isTouch ? '' : 'E — ';
    if (cutscene) {
      hud.setPrompt(`${cutscene.npc.def.name} идёт к тебе…`);
      input.setActionVisible(false);
      return;
    }
    // Пока игрок пьёт кофе или сидит, говорят только предметы
    if (props.busy || player.seated) {
      const prop = props.check();
      hud.setPrompt(prop ? `${key}${prop.text}` : null);
      input.setActionVisible(Boolean(prop), prop?.icon);
      return;
    }
    // Автооткрытие мини-игры при подходе к маркеру — один раз, пока игрок не отойдёт.
    // Диалог с NPC открывается только по действию (E / 💬).
    if (nearMarker && lastMarkerAuto !== nearMarker.key) {
      lastMarkerAuto = nearMarker.key;
      activateMarker(nearMarker);
      return;
    }
    if (!nearMarker) lastMarkerAuto = null;
    // Итоги дня (в последний день — финал) на маркере выхода — тоже один раз, пока игрок не сойдёт с маркера
    if (!nearMarker && nearExit && !lastExitAuto) {
      lastExitAuto = true;
      leaveOffice();
      return;
    }
    if (!nearExit) lastExitAuto = false;

    if (nearMarker) {
      const { text, icon } = markerPrompt(nearMarker);
      hud.setPrompt(`${key}${text}`);
      input.setActionVisible(true, icon);
    } else if (nearFire && canExtinguish(nearFire)) {
      hud.setPrompt(`${key}${nearFire.step.action}`);
      input.setActionVisible(true, '🧯');
    } else if (nearFire) {
      hud.setPrompt(nearFire.step.need ?? nearFire.step.hint);
      input.setActionVisible(false);
    } else if (nearExit) {
      hud.setPrompt(`${key}${isLastDay() ? 'Выйти из офиса' : 'Завершить рабочий день'}`);
      input.setActionVisible(true, '🚪');
    } else if (nearNpc) {
      hud.setPrompt(`${key}Поговорить: ${nearNpc.def.name}`);
      input.setActionVisible(true, '💬');
    } else {
      const prop = pingPong.check() ?? collectibles.check() ?? knowledge.check() ?? props.check();
      hud.setPrompt(prop ? `${prop.action ? key : ''}${prop.text}` : null);
      input.setActionVisible(Boolean(prop?.action), prop?.icon);
    }
  }

  // ---------- Цикл ----------
  // Размер рендера — реальный размер канваса (его задаёт CSS inset: 0), а не innerWidth/innerHeight:
  // на iOS они расходятся (панель Safari, клавиатура, поворот) и картинка растягивается
  const view = { w: 0, h: 0, dpr: 0 };
  const pixelRatio = () => Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const hgt = canvas.clientHeight || window.innerHeight;
    const dpr = pixelRatio();
    if (w === view.w && hgt === view.h && dpr === view.dpr) return;
    Object.assign(view, { w, h: hgt, dpr });
    renderer.setPixelRatio(dpr); // зум страницы (Safari «aA») меняет devicePixelRatio
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.fov = w < hgt ? 72 : 60;
    camera.updateProjectionMatrix();
  }
  // iOS в первом событии поворота отдаёт старые размеры — пересчитываем ещё раз на следующем кадре
  const resizeSoon = () => { resize(); requestAnimationFrame(resize); };
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resizeSoon);
  window.addEventListener('orientationchange', resizeSoon);
  window.visualViewport?.addEventListener('resize', resizeSoon);
  resize();

  const clock = new THREE.Clock();
  let saveTimer = 0;

  function savePose() {
    const rest = player.seated?.stand ?? player.position; // сидя сохраняем точку «встать», а не центр пуфика
    store.setPlayerPose({ x: rest.x, z: rest.z, heading: player.heading });
    store.persist();
  }
  window.addEventListener('beforeunload', () => { if (running) savePose(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) savePose(); });

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    resize(); // страховка от пропущенных событий: при неизменном размере — сразу return
    input.update();
    props.update(dt, time);
    player.update(dt, input, time);
    for (const npc of npcs) npc.update(dt, time, player.position);
    for (const m of markers) if (m.marker.group.visible) m.marker.update(time);
    for (const f of fires) if (f.fire.group.visible) f.fire.update(time);
    // Пока горит огонь, свет серверной мерцает рыже-красным
    if (fireBurning) {
      serverLight.color.set('#ff7a3a');
      serverLight.intensity = 6 + Math.sin(time * 11) * 1.6 + Math.sin(time * 23) * 0.8;
    }
    if (exitMarker.group.visible) exitMarker.update(time);
    knowledge.update(time);
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
          input.state.isTouch ? h('div', {}, '👆 Проведи по экрану — поворот камеры') : mouseControls(),
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
  document.getElementById('trophy-btn').addEventListener('click', () => { if (running && !isModalOpen()) collectibles.open(); });

  // Отладочный доступ из консоли браузера (только в dev-сборке)
  if (import.meta.env.DEV) {
    window.__game = {
      player,
      camera,
      renderer,
      pointerLocked: () => input.state.pointerLocked,
      viewport: () => {
        const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
        return {
          inner: { w: window.innerWidth, h: window.innerHeight },
          client: { w: canvas.clientWidth, h: canvas.clientHeight },
          buffer: { w: buffer.x, h: buffer.y },
          dpr: renderer.getPixelRatio(),
          aspect: camera.aspect,
        };
      },
      ceilingHeight: office.ceilingHeight,
      teleport: (x, z, face = 0) => player.place(x, z, face),
      spots: office.spots,
      colliders: office.colliders,
      outdoor: outdoor.stats,
      talk: (npcId) => talk(npcs.find((n) => n.def.id === npcId)),
      minigame: (questId) => openMinigame(QUESTS.find((q) => q.id === questId)),
      step: (questId) => store.questStep(questId),
      setStep: (questId, index) => store.setQuestStep(questId, index),
      // Снова поджечь: квесты с hazard-шагами — активны и на первом шаге
      ignite: () => {
        for (const q of QUESTS) {
          if (!questSteps(q).some((step) => step.type === 'hazard')) continue;
          store.setQuestStep(q.id, 0);
          store.setQuestStatus(q.id, QuestStatus.ACTIVE);
        }
      },
      // Потушить всё на текущем hazard-шаге и перейти дальше
      extinguishAll: () => {
        for (const q of QUESTS) {
          const step = currentStep(q);
          if (step?.type !== 'hazard') continue;
          step.targets.forEach((id) => store.markCleared(q.id, id));
          advanceStep(q);
        }
      },
      day: () => store.currentDay(),
      completeDay: () => { dayQuests().forEach((q) => store.setQuestStatus(q.id, QuestStatus.DONE)); },
      endDay,
      summary: showDaySummary,
      // Перейти в последний день и выполнить его квесты (выход из офиса откроет финал)
      lastDay: () => {
        while (!isLastDay()) store.advanceDay();
        dayQuests().forEach((q) => store.setQuestStatus(q.id, QuestStatus.DONE));
      },
      finale: showFinale,
      seats: office.seats,
      sit: (k) => player.sit(office.seats[k]),
      stand: () => player.stand(),
      coffee: () => props.brewCoffee(),
      cameraState: () => ({ yaw: player.yaw, pitch: player.pitch, showcase: player.inShowcase }),
      bsod: () => SCREENS.bsod({ duration: 5 }),
      // Запустить подход NPC для текущего approach-шага
      approach: () => {
        for (const q of QUESTS) {
          const step = currentStep(q);
          if (step?.approach) approach(q, step);
        }
      },
      evening: (on) => applyTimeOfDay(on),
      pingPong: (npcId) => pingPong.start(npcId),
      knowledge: () => knowledge.open(),
      knowledgeNew: () => knowledge.newCount(),
      books: () => collectibles.open(),
      findBook: (id) => collectibles.pickById(id),
      bookItems,
      npc: (id) => npcById(id),
      office,
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
      cutscene = null;
      refresh(); // в том числе книги на местах и бейдж 🏆
      console.debug('[books] spawned', BOOKS.length - store.booksFound().length, 'of', BOOKS.length);
      placeNpcs();
      hud.show();
      running = true;
      input.setRunning(true);
      input.setEnabled(true);
      if (!s.dayIntroShown) showDayIntro();
      // Перезагрузка посреди полноэкранной сцены — показываем её снова
      for (const q of QUESTS) {
        const step = currentStep(q);
        if (step?.type === 'screen') runScreen(q, step);
      }
      // Если игрок сохранился, стоя на маркере, не открываем мини-игру или итоги сразу
      checkInteractionsSilently();
      input.lockPointer(); // старт — клик по кнопке, захват разрешён; при открытом интро — после него
      updateLockHint();
    },
    stop() {
      running = false;
      input.setRunning(false);
      input.setEnabled(false);
      hud.setLockHint(false);
      hud.hide();
      hud.setPrompt(null);
      input.setActionVisible(false);
      closeModal();
    },
  };

  function checkInteractionsSilently() {
    const p = player.position;
    for (const m of markers) {
      const mp = m.marker.position;
      if (markerLive(m) && Math.hypot(mp.x - p.x, mp.z - p.z) < MARKER_RADIUS) lastMarkerAuto = m.key;
    }
    const e = exitMarker.position;
    if (exitMarker.group.visible && Math.hypot(e.x - p.x, e.z - p.z) < MARKER_RADIUS) lastExitAuto = true;
  }
}
