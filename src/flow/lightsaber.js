// Световой меч на столе Ильи: у меча по E «Пробудить силу» — клинок загорается, Илья бросает вызов (диалог),
// а после «Принять вызов» начинается бой прямо в кабинете: игрок и Илья встают на арену с мечами в руках,
// камера остаётся за спиной игрока. Логика боя — createDuel (flow/saberDuel.js), кнопки и жизни — duelHud (ui/duelHud.js).
// Это досуг, а не квест: прогресс и сохранение не меняются. Импортов нет: всё приходит аргументами из game.js,
// который проверяет меч после маркеров, огня и выхода, но раньше NPC — меч лежит рядом с Ильёй.
const SABER_RADIUS = 1.0;  // от spot меча
const TURN_TIME = 0.6;     // с — Илья успевает повернуться к игроку до реплики
const POSE_TIME = 0.32;    // с — блок / удар держится, потом снова стойка
const CLASH_Y = 1.35;      // высота искр между клинками
const TOASTS = {
  win: '⚔️ Победа над мастером!',
  lose: '⚔️ Мастер победил. Реванш?',
  surrender: '⚔️ Бой окончен — приходи ещё!',
};
const TITLES = { win: 'Победа!', lose: 'Поражение', surrender: 'Бой окончен' };
const POSE = { left: 'Left', right: 'Right', high: 'High' };

// saber / masterSaber — мечи из world/lightsaber.js (игрока лежит на столе в spot), clash — искры; scene — куда
// класть меч на стол; spots — office.spots (duelPlayer, duelMaster); master — NPC Ильи; createDuel — createSaberDuel;
// homeOf(npc) → { x, z, face, via }; onMasterEnter / onMasterLeave — game.js убирает / возвращает коллайдер Ильи;
// setDuelMode(on) — game.js отключает обычный ввод, курсор и HUD на время боя
export function createLightsaber({
  saber, masterSaber, clash, scene, spot, spots, master, player, hud, duelHud, createDuel,
  openDialog, openModal, closeModal, isModalOpen, h, fill, handsFree, homeOf, onMasterEnter, onMasterLeave, setDuelMode,
}) {
  const data = master.def.saberDuel;
  const texts = ['challenge', 'decline', 'win', 'lose', 'surrender'];
  const valid = data && data.skill >= 0 && data.skill <= 1 && texts.every((k) => typeof data[k] === 'string');
  if (!valid) throw new Error(`У NPC «${master.def.id}» нет данных saberDuel (src/quests/npcs.js)`);

  let phase = null;  // null | awaken | challenge | duel | result
  let turnTimer = 0;
  let duel = null;
  let rematching = false;
  let playerPose = 0; // секунд до возврата в стойку
  let masterPose = 0;

  const near = () => Math.hypot(player.position.x - spot.x, player.position.z - spot.z) <= SABER_RADIUS;
  const setPlayerGesture = (name) => player.model.userData.setGesture(name);

  function layOnDesk() {
    saber.userData.layFlat();
    saber.userData.setIgnited(false);
    scene.add(saber);
    saber.position.set(spot.x, spot.y, spot.z);
    saber.rotation.set(0, spot.rot ?? 0, 0);
  }
  layOnDesk();

  // Вызов отклонён или окно закрыто: меч гаснет, игрок снова ходит
  function reset() {
    phase = null;
    saber.userData.setIgnited(false);
    player.setFrozen(false);
  }

  function awaken() {
    phase = 'awaken';
    turnTimer = TURN_TIME;
    saber.userData.setIgnited(true);
    player.setFrozen(true);
    player.face(master.position.x, master.position.z);
    hud.setPrompt(null);
  }

  function challenge() {
    phase = 'challenge';
    openDialog(master.def, [fill(data.challenge)], [
      { label: 'Отклонить вызов', onClick: decline },
      { label: 'Принять вызов', primary: true, onClick: accept },
    ]);
  }

  function decline() {
    reset();
    openDialog(master.def, [fill(data.decline)], [{ label: 'Понятно', primary: true }]);
  }

  function accept() {
    phase = 'duel'; // до closeModal: game.js не вернёт обычный ввод, а update не примет закрытие за отказ
    closeModal();
    startDuel();
  }

  function guard() {
    setPlayerGesture('guard');
    master.setGesture('guard');
    playerPose = 0;
    masterPose = 0;
  }

  function startDuel() {
    phase = 'duel';
    onMasterEnter(master);
    const m = spots.duelMaster;
    const p = spots.duelPlayer;
    master.place(m.x, m.z, m.face);
    player.place(p.x, p.z, p.face); // камера встаёт за спину игрока
    player.setFrozen(true);
    saber.userData.holdPose();
    masterSaber.userData.holdPose();
    player.setHeld(saber);
    master.setHeld(masterSaber);
    saber.userData.setIgnited(true);
    masterSaber.userData.setIgnited(true);
    guard();
    setDuelMode(true);
    duelHud.show({ masterName: master.def.name });
    if (duel) duel.restart();
    else duel = createDuel({ skill: data.skill, onEvent });
  }

  // Искры между клинками: сторона блока — со стороны экрана (игрок смотрит на север, экран слева — это −x)
  function burst(dir) {
    const p = spots.duelPlayer;
    const m = spots.duelMaster;
    const dx = { left: -0.35, right: 0.35, high: 0 }[dir] ?? 0;
    const y = dir === 'high' ? CLASH_Y + 0.55 : CLASH_Y;
    clash.burst((p.x + m.x) / 2 + dx, y, (p.z + m.z) / 2);
  }

  function onEvent(e) {
    if (e.type === 'countdown') duelHud.banner(String(e.n));
    else if (e.type === 'fight') duelHud.banner('Бой!');
    else if (e.type === 'windup') master.setGesture(`windup${POSE[e.dir]}`);
    else if (e.type === 'parry') {
      setPlayerGesture(`block${POSE[e.dir]}`);
      master.setGesture('guard');
      playerPose = POSE_TIME;
      burst(e.dir);
      duelHud.banner('Блок!');
    } else if (e.type === 'hit-player') {
      master.setGesture('strike');
      masterPose = POSE_TIME;
      duelHud.flash('hit');
      duelHud.banner('Пропущен!');
    } else if (e.type === 'opening') {
      master.setGesture('stagger');
      duelHud.banner('Контратака!');
    } else if (e.type === 'opening-missed') {
      master.setGesture('guard');
      duelHud.banner('Упустил момент');
    } else if (e.type === 'strike') {
      setPlayerGesture('strike');
      playerPose = POSE_TIME;
      masterPose = POSE_TIME;
      clash.burst(spots.duelMaster.x, CLASH_Y, spots.duelMaster.z + 0.4);
      duelHud.banner('Попал!');
    } else if (e.type === 'over') showResult(e.result);
  }

  function showResult(result) {
    phase = 'result';
    duelHud.hide();
    guard();
    openModal({
      title: TITLES[result],
      subtitle: `${master.def.name} (${master.def.role})`,
      body: h('div', { class: 'lesson' }, h('p', {}, fill(data[result]))),
      actions: [
        { label: 'Закончить' },
        { label: 'Реванш', primary: true, onClick: rematch },
      ],
      onClose: () => finish(result),
    });
  }

  function rematch() {
    rematching = true;
    closeModal(); // onClose → finish: при rematching — новый бой без повторного вызова
  }

  // Любое закрытие окна итога: мечи на место, Илья домой, обычное управление и тост
  function finish(result) {
    if (rematching) {
      rematching = false;
      startDuel();
      return;
    }
    phase = null;
    player.setHeld(null);
    master.setHeld(null);
    setPlayerGesture(null);
    master.setGesture(null);
    masterSaber.userData.setIgnited(false);
    layOnDesk();
    const home = homeOf(master);
    master.place(home.x, home.z, home.face, { via: home.via });
    onMasterLeave(master);
    player.setFrozen(false);
    setDuelMode(false);
    duelHud.hide();
    hud.toast(TOASTS[result] ?? TOASTS.surrender);
  }

  function update(dt) {
    if (phase === 'awaken') {
      turnTimer -= dt;
      if (turnTimer <= 0) challenge();
    } else if (phase === 'challenge' && !isModalOpen()) {
      reset(); // ✕, фон или Esc — окно закрыто без ответа
    }
    if (playerPose > 0 && (playerPose -= dt) <= 0) setPlayerGesture('guard');
    if (masterPose > 0 && (masterPose -= dt) <= 0) master.setGesture('guard');
    if (phase === 'duel') {
      duel.update(dt);
      if (phase === 'duel') duelHud.render(duel.state); // update мог закончить бой
    }
    saber.userData.update(dt);
    masterSaber.userData.update(dt);
    clash.update(dt);
  }

  const inDuel = () => phase === 'duel';

  return {
    get active() { return phase !== null; },
    // NPC-соперник, пока идёт бой или открыто окно итога (game.js держит его видимым и без коллайдера)
    get master() { return phase === 'duel' || phase === 'result' ? master : null; },
    get state() { return phase === 'duel' || phase === 'result' ? duel.state : { phase }; },
    // Подсказка у меча: { text, icon, action } или null
    check() {
      if (phase || !near() || !master.group.visible || master.walking) return null;
      if (!handsFree()) return { text: 'Руки заняты — сначала потуши пожар', icon: '⚔️', action: false };
      return { text: 'Пробудить силу', icon: '⚔️', action: true };
    },
    // true, если действие обработано (у меча — даже с занятыми руками)
    interact() {
      if (phase || !near() || !master.group.visible || master.walking) return false;
      if (handsFree()) awaken();
      return true;
    },
    update,
    block(dir) { if (inDuel()) duel.block(dir); },
    strike() { if (inDuel()) duel.strike(); },
    pause() { if (inDuel()) duel.pause(); },
    resume() { if (inDuel()) duel.resume(); },
    surrender() { if (inDuel()) duel.surrender(); },
    // Отладка: сразу бой без вызова / сразу итог
    start() { if (!phase) startDuel(); },
    debugFinish(result) { if (inDuel()) duel.debugEnd(result); },
  };
}
