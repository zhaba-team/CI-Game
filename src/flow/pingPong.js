// Пинг-понг в Игровой: у стола по E игрок играет со случайным NPC (матч — мини-игра 'ping-pong' в модалке).
// Соперник мгновенно встаёт у западного торца с ракеткой, игрок — у восточного; после матча NPC возвращается домой.
// Это досуг, а не квест: прогресс и сохранение не меняются. Импортов нет: всё приходит аргументами из game.js,
// который проверяет стол после маркеров, огня, выхода и NPC, но раньше пуфиков и кофемашины.
const TABLE_RADIUS = 1.0; // от края столешницы

// table — габарит столешницы { x0, x1, z0, z1 }; rackets — декоративные ракетки на столе; colors — [игрок, соперник];
// makeRacket(color) — ракетка для руки; homeOf(npc) → { x, z, face, via } — куда вернуть NPC;
// onOpponentEnter(npc) / onOpponentLeave(npc) — game.js убирает / возвращает коллайдер и видимость NPC
export function createPingPong({
  table, rackets, colors, makeRacket, spots, npcs, player, hud, handsFree,
  openModal, closeModal, getMinigame, h, playerName, fill, homeOf, onOpponentEnter, onOpponentLeave,
}) {
  for (const npc of npcs) {
    const data = npc.def.pingPong;
    const valid = data && data.skill >= 0 && data.skill <= 1 && ['greet', 'win', 'lose'].every((k) => typeof data[k] === 'string');
    if (!valid) throw new Error(`У NPC «${npc.def.id}» нет данных pingPong (src/quests/npcs.js)`);
  }

  const playerRacket = makeRacket(colors[0]);
  const rivalRacket = makeRacket(colors[1]);
  let opponent = null; // NPC, с которым идёт матч
  let previous = null; // прошлый соперник — подряд не выпадает
  let result = null;   // итог из complete() мини-игры

  // Расстояние от игрока до прямоугольника столешницы
  const near = () => {
    const { x, z } = player.position;
    const dx = Math.max(table.x0 - x, 0, x - table.x1);
    const dz = Math.max(table.z0 - z, 0, z - table.z1);
    return Math.hypot(dx, dz) <= TABLE_RADIUS;
  };

  // Случайный NPC, который сейчас не идёт; прошлого соперника пропускаем, если есть выбор
  function pickOpponent(npcId) {
    if (npcId) {
      const npc = npcs.find((n) => n.def.id === npcId);
      if (!npc) throw new Error(`Нет NPC «${npcId}» для пинг-понга`);
      return npc;
    }
    const free = npcs.filter((n) => !n.walking);
    const pool = free.length > 1 ? free.filter((n) => n !== previous) : free;
    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  }

  function start(npcId) {
    if (opponent) return;
    const npc = pickOpponent(npcId);
    if (!npc) { hud.toast('Все коллеги заняты — попробуй чуть позже.'); return; }
    opponent = npc;
    previous = npc;
    result = null;

    const rival = spots.pingPongRival;
    npc.setStanding(true);
    npc.place(rival.x, rival.z, rival.face);
    npc.setHeld(rivalRacket);
    npc.group.visible = true;
    onOpponentEnter(npc);

    const me = spots.pingPongPlayer;
    player.place(me.x, me.z, me.face);
    player.setHeld(playerRacket);
    player.model.userData.setGesture('hold');
    rackets.forEach((r) => { r.visible = false; });
    hud.setPrompt(null);

    const { def } = npc;
    const body = h('div', { class: 'minigame' });
    openModal({
      title: 'Пинг-понг',
      subtitle: `Соперник: ${def.name} (${def.role})`,
      body,
      wide: true,
      onClose: finish,
    });
    getMinigame('ping-pong').mount(body, {
      playerName: playerName(),
      opponent: {
        name: def.name,
        role: def.role,
        skill: def.pingPong.skill,
        greet: fill(def.pingPong.greet),
        win: fill(def.pingPong.win),
        lose: fill(def.pingPong.lose),
      },
      complete: (r) => {
        if (result) return;
        result = r;
        closeModal(); // onClose → finish
      },
    });
  }

  // Любое закрытие модалки: убрать ракетки, вернуть NPC домой, тост с итогом
  function finish() {
    if (!opponent) return;
    const npc = opponent;
    opponent = null;
    player.setHeld(null);
    player.model.userData.setGesture(null);
    npc.setHeld(null);
    rackets.forEach((r) => { r.visible = true; });
    const home = homeOf(npc);
    npc.setStanding(false);
    npc.place(home.x, home.z, home.face, { via: home.via });
    onOpponentLeave(npc);

    const { name } = npc.def;
    if (!result) hud.toast('Партия прервана — приходи ещё!');
    else if (result.won) hud.toast(`🏓 Победа! Ты ${result.player}:${result.rival} ${name}`);
    else hud.toast(`🏓 ${name} выигрывает ${result.rival}:${result.player}. Реванш?`);
  }

  return {
    get active() { return opponent !== null; },
    get opponent() { return opponent; },
    // Подсказка у стола: { text, icon, action } или null
    check() {
      if (!near()) return null;
      if (!handsFree()) return { text: 'Руки заняты — сначала потуши пожар', icon: '🏓', action: false };
      return { text: 'Сыграть в пинг-понг', icon: '🏓', action: true };
    },
    // true, если действие обработано (у стола — даже с занятыми руками)
    interact() {
      if (!near()) return false;
      if (handsFree()) start();
      return true;
    },
    start,
  };
}
