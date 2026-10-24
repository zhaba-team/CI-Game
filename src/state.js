// Состояние игры и его сохранение в localStorage.
const KEY = 'doncode-intern-save';
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
    player: null,         // { x, z, heading }
    day: 0,               // индекс текущего рабочего дня в DAYS (quests/days.js)
    dayIntroShown: false, // интро текущего дня уже закрыто
    finished: false,      // последний день завершён — стажировка пройдена
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

// Следующий рабочий день: игрок начинает его со спавна
export function advanceDay() {
  state.day += 1;
  state.dayIntroShown = false;
  state.player = null;
  persist();
  listeners.forEach((fn) => fn(state));
}

export function setFinished() {
  state.finished = true;
  persist();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function persist() {
  if (!state) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* игнорируем */ }
}
