// Состояние игры и его сохранение в localStorage.
const KEY = 'doncode-intern-save';
// VERSION не повышаем при добавлении полей: resume() мержит emptyState,
// поэтому старые сейвы v2 получают новые поля (например, steps) со значениями по умолчанию.
const VERSION = 2;

export const QuestStatus = {
  AVAILABLE: 'available', // у NPC горит «!»
  ACTIVE: 'active',       // квест взят, нужно дойти до маркера
  DONE: 'done',           // мини-игра пройдена
};

function emptyState(name) {
  return {
    version: VERSION,
    name,
    quests: {},           // questId -> QuestStatus
    steps: {},            // questId -> { index, cleared } — шаг многошагового квеста и выполненные цели шага
    player: null,         // { x, z, heading }
    day: 0,               // индекс текущего рабочего дня в DAYS (quests/days.js)
    dayIntroShown: false, // интро текущего дня уже закрыто
    finished: false,      // последний день завершён — стажировка пройдена
    kbSeen: [],           // id терминов Базы знаний (quests/glossary.js), которые игрок уже видел открытыми
    books: [],            // id найденных коллекционных книг (quests/books.js)
  };
}

let state = null;
const listeners = new Set();

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== VERSION || typeof data.name !== 'string' || typeof data.day !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function startNew(name) {
  state = emptyState(name);
  persist();
  return state;
}

export function resume(saved) {
  state = { ...emptyState(saved.name), ...saved };
  return state;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* приватный режим и т.п. */ }
}

export function getState() {
  return state;
}

export function questStatus(id) {
  return state.quests[id] ?? QuestStatus.AVAILABLE;
}

export function setQuestStatus(id, status) {
  state.quests[id] = status;
  persist();
  listeners.forEach((fn) => fn(state));
}

// Текущий шаг квеста со steps (quests/quests.js): index — номер шага, cleared — id выполненных целей шага
export function questStep(id) {
  return state.steps[id] ?? { index: 0, cleared: [] };
}

export function setQuestStep(id, index) {
  state.steps[id] = { index, cleared: [] };
  persist();
  listeners.forEach((fn) => fn(state));
}

export function markCleared(id, targetId) {
  const step = questStep(id);
  if (step.cleared.includes(targetId)) return;
  state.steps[id] = { index: step.index, cleared: [...step.cleared, targetId] };
  persist();
  listeners.forEach((fn) => fn(state));
}

export function setPlayerPose(pose) {
  state.player = pose;
}

export function currentDay() {
  return state.day;
}

export function setDayIntroShown() {
  state.dayIntroShown = true;
  persist();
}

// Следующий рабочий день: игрок начинает его со спавна. Сейв, пройденный до появления новых дней,
// снова становится незавершённым
export function advanceDay() {
  state.day += 1;
  state.dayIntroShown = false;
  state.finished = false;
  state.player = null;
  persist();
  listeners.forEach((fn) => fn(state));
}

export function setFinished() {
  state.finished = true;
  persist();
}

// Просмотренные термины Базы знаний: открытые, но не просмотренные помечаются «NEW»
export function kbSeen() {
  return state.kbSeen;
}

// HUD это не интересует — подписчиков не оповещаем
export function markKbSeen(ids) {
  const fresh = ids.filter((id) => !state.kbSeen.includes(id));
  if (!fresh.length) return;
  state.kbSeen = [...state.kbSeen, ...fresh];
  persist();
}

// Найденные коллекционные книги: HUD обновляет бейдж 🏆, мир прячет подобранную книгу
export function booksFound() {
  return state.books;
}

export function markBookFound(id) {
  if (state.books.includes(id)) return;
  state.books = [...state.books, id];
  persist();
  listeners.forEach((fn) => fn(state));
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function persist() {
  if (!state) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* игнорируем */ }
}
