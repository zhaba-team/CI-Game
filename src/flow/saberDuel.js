// Логика боя на световых мечах — конечный автомат без Three.js и DOM: отсчёт, замахи мастера в одну из трёх сторон,
// блоки игрока, контратака после серии блоков, жизни и итог. Импортов нет; сценарий в 3D и HUD — flow/lightsaber.js,
// который каждый кадр вызывает update(dt) и превращает события onEvent в жесты, искры и баннеры.
const PLAYER_HP = 5;
const MASTER_HP = 3;
const COMBO = 3;          // блоков подряд до контратаки
const COUNTDOWN = 3;      // с — «3-2-1»
const WINDUP_MAX = 1.15;  // с — самый долгий замах
const WINDUP_MIN = 0.55;  // с — самый быстрый замах
const OPENING = 0.9;      // с — окно контратаки при skill 0.6
const RECOVER = 0.6;      // с — пауза между атаками
const DIRS = ['left', 'right', 'high'];
const MAX_REPEAT = 2;     // одно направление — не больше двух раз подряд

const lerp = (a, b, k) => a + (b - a) * k;

// skill — 0..1 (quests/npcs.js, saberDuel.skill); onEvent({ type, ... }) — события боя; random — для детерминизма
export function createSaberDuel({ skill, onEvent, random = Math.random }) {
  if (typeof onEvent !== 'function') throw new Error('createSaberDuel: нужен обработчик onEvent');
  if (!(skill >= 0 && skill <= 1)) throw new Error(`createSaberDuel: skill должен быть от 0 до 1, получено ${skill}`);

  let phase;      // countdown | windup | recover | opening | over
  let timeLeft;
  let timeTotal;
  let dir;        // сторона текущего замаха
  let recent;     // последние направления замахов
  let playerHp;
  let masterHp;
  let combo;
  let paused;
  let result;     // win | lose | surrender
  let shownCount; // последнее показанное число отсчёта

  function reset() {
    phase = 'countdown';
    timeLeft = COUNTDOWN;
    timeTotal = COUNTDOWN;
    dir = null;
    recent = [];
    playerHp = PLAYER_HP;
    masterHp = MASTER_HP;
    combo = 0;
    paused = false;
    result = null;
    shownCount = null;
  }
  reset();

  const emit = (type, data = {}) => onEvent({ type, ...data });
  const enter = (next, time) => {
    phase = next;
    timeLeft = time;
    timeTotal = time;
  };

  // Сложность растёт со skill мастера и с каждым его пропущенным ударом
  const hardness = () => Math.min(1, skill * 0.6 + (MASTER_HP - masterHp) * 0.2);

  function pickDir() {
    const repeated = recent.length >= MAX_REPEAT && recent.every((d) => d === recent[0]);
    const pool = repeated ? DIRS.filter((d) => d !== recent[0]) : DIRS;
    const next = pool[Math.floor(random() * pool.length)];
    recent = [...recent, next].slice(-MAX_REPEAT);
    return next;
  }

  function windup() {
    dir = pickDir();
    enter('windup', lerp(WINDUP_MAX, WINDUP_MIN, hardness()));
    emit('windup', { dir, time: timeTotal });
  }

  function recover() {
    dir = null;
    enter('recover', RECOVER);
  }

  function over(outcome) {
    result = outcome;
    dir = null;
    enter('over', 0);
    emit('over', { result });
  }

  // Неверный блок или опоздание: игрок теряет жизнь, серия обнуляется
  function hitPlayer() {
    playerHp -= 1;
    combo = 0;
    emit('hit-player', { hp: playerHp, dir });
    if (playerHp <= 0) over('lose');
    else recover();
  }

  function parry() {
    combo += 1;
    emit('parry', { dir, combo });
    if (combo < COMBO) { recover(); return; }
    dir = null;
    enter('opening', OPENING * (1.3 - skill * 0.5));
    emit('opening', { time: timeTotal });
  }

  function update(dt) {
    if (paused || phase === 'over') return;
    timeLeft -= dt;
    if (phase === 'countdown') {
      const n = Math.ceil(timeLeft);
      if (n > 0 && n !== shownCount) { shownCount = n; emit('countdown', { n }); }
      if (timeLeft > 0) return;
      emit('fight');
      recover();
      return;
    }
    if (timeLeft > 0) return;
    if (phase === 'windup') hitPlayer();
    else if (phase === 'opening') { combo = 0; emit('opening-missed'); recover(); }
    else if (phase === 'recover') windup();
  }

  return {
    update,
    // Блок в сторону side; вне замаха (отсчёт, пауза между атаками) игнорируется без штрафа
    block(side) {
      if (paused || phase !== 'windup') return;
      if (side === dir) parry();
      else hitPlayer();
    },
    // Контратака: работает только в окне opening
    strike() {
      if (paused || phase !== 'opening') return;
      masterHp -= 1;
      combo = 0;
      emit('strike', { hp: masterHp });
      if (masterHp <= 0) over('win');
      else recover();
    },
    pause() { if (phase !== 'over') paused = true; },
    resume() { paused = false; },
    surrender() { if (phase !== 'over') over('surrender'); },
    restart: reset,
    // Отладка: сразу закончить бой с итогом win | lose
    debugEnd(outcome) {
      if (phase === 'over') return;
      if (outcome === 'win') masterHp = 0;
      else playerHp = 0;
      over(outcome);
    },
    get state() {
      return { phase, dir, timeLeft: Math.max(0, timeLeft), timeTotal, playerHp, masterHp, combo, paused, result, maxPlayerHp: PLAYER_HP, maxMasterHp: MASTER_HP, comboGoal: COMBO };
    },
  };
}
