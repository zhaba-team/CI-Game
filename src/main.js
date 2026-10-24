// Точка входа: стартовый экран (никнейм / продолжить) и запуск игры.
import '@fontsource/press-start-2p/400.css';
import { createGame } from './game.js';
import { h } from './ui/dom.js';
import * as store from './state.js';
import { QUESTS } from './quests/quests.js';
import { DAYS, questsOfDay } from './quests/days.js';

const screen = document.getElementById('start-screen');
const content = document.getElementById('start-content');

// Надписи на canvas-текстурах (имена NPC, постеры, меню) рисуются один раз при сборке мира,
// поэтому мир строим после загрузки пиксельного шрифта. На медленной сети не ждём дольше 3 с —
// игра стартует с запасным шрифтом, а вывески (signs.js) перерисуются сами.
const waitForFont = () => Promise.race([
  document.fonts?.load('16px "Press Start 2P"', 'Стажёр ЁЖ Aa 0!') ?? Promise.resolve(),
  new Promise((resolve) => setTimeout(resolve, 3000)),
]).catch(() => {});

let game;
const createWorld = () => createGame({
  onNewGame: () => {
    game.stop();
    store.clearSave();
    showStart();
  },
});

function begin(fresh) {
  screen.classList.add('hidden');
  game.start({ fresh });
}

function nicknameForm() {
  const inputEl = h('input', {
    type: 'text',
    maxlength: 16,
    placeholder: 'Твой никнейм',
    autocomplete: 'off',
    enterkeyhint: 'go',
    'aria-label': 'Никнейм',
  });
  const error = h('div', { class: 'error' });
  const submit = (e) => {
    e.preventDefault();
    const name = inputEl.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      error.textContent = 'Никнейм должен быть хотя бы из 2 символов';
      inputEl.focus();
      return;
    }
    inputEl.blur();
    store.startNew(name);
    begin(true);
  };
  const form = h('form', { class: 'nick-form', onsubmit: submit },
    h('label', {}, 'Как к тебе обращаться?'),
    inputEl,
    error,
    h('button', { class: 'btn primary big', type: 'submit' }, 'Начать стажировку'),
  );
  setTimeout(() => inputEl.focus(), 50);
  return form;
}

function showStart() {
  screen.classList.remove('hidden');
  const saved = store.loadSave();
  // Сейв с днём, которого больше нет в DAYS (данные дней изменились), — как пустой
  if (!saved || !DAYS[saved.day]) {
    content.replaceChildren(nicknameForm());
    return;
  }
  const dayQuests = questsOfDay(saved.day, QUESTS);
  const done = dayQuests.filter((q) => saved.quests[q.id] === store.QuestStatus.DONE).length;
  // Многошаговый квест посреди сюжета — показываем, на каком он шаге
  const inSteps = dayQuests.find((q) => q.steps && saved.quests[q.id] === store.QuestStatus.ACTIVE);
  const stepIndex = inSteps ? (saved.steps?.[inSteps.id]?.index ?? 0) : 0;
  const stepNote = inSteps ? ` · «${inSteps.title}»: шаг ${stepIndex + 1} из ${inSteps.steps.length}` : '';
  const progress = saved.finished
    ? 'Стажировка пройдена 🏆'
    : `${DAYS[saved.day].title} · заданий дня выполнено ${done} из ${dayQuests.length}${stepNote}`;
  content.replaceChildren(
    h('div', { class: 'resume' },
      h('p', {}, 'С возвращением, ', h('b', {}, saved.name), '!'),
      h('p', { class: 'muted' }, progress),
      h('button', { class: 'btn primary big', onclick: () => { store.resume(saved); begin(false); } }, 'Продолжить'),
      h('button', { class: 'btn ghost', onclick: () => { store.clearSave(); content.replaceChildren(nicknameForm()); } }, 'Новая игра'),
    ),
  );
}

waitForFont().then(() => {
  game = createWorld();
  showStart();
});
