// Точка входа: стартовый экран (никнейм / продолжить) и запуск игры.
import { createGame } from './game.js';
import { h } from './ui/dom.js';
import * as store from './state.js';
import { QUESTS } from './quests/quests.js';

const screen = document.getElementById('start-screen');
const content = document.getElementById('start-content');

const game = createGame({
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
  if (!saved) {
    content.replaceChildren(nicknameForm());
    return;
  }
  const done = QUESTS.filter((q) => saved.quests[q.id] === store.QuestStatus.DONE).length;
  content.replaceChildren(
    h('div', { class: 'resume' },
      h('p', {}, 'С возвращением, ', h('b', {}, saved.name), '!'),
      h('p', { class: 'muted' }, `Выполнено заданий: ${done} из ${QUESTS.length}`),
      h('button', { class: 'btn primary big', onclick: () => { store.resume(saved); begin(false); } }, 'Продолжить'),
      h('button', { class: 'btn ghost', onclick: () => { store.clearSave(); content.replaceChildren(nicknameForm()); } }, 'Новая игра'),
    ),
  );
}

showStart();
