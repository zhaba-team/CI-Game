// HUD: журнал заданий, подсказка взаимодействия, подсказка захвата курсора, всплывающие уведомления, вспышка тревоги.
import { h } from './dom.js';
import { QuestStatus } from '../state.js';

const STATUS_ICON = {
  [QuestStatus.AVAILABLE]: '❗',
  [QuestStatus.ACTIVE]: '➡️',
  [QuestStatus.DONE]: '✅',
};

export function createHud() {
  const hud = document.getElementById('hud');
  const journal = document.getElementById('journal');
  const prompt = document.getElementById('prompt');
  const toasts = document.getElementById('toasts');
  const lockHint = document.getElementById('lock-hint');
  let collapsed = window.innerWidth < 640;
  const flash = h('div', { class: 'alarm-flash hidden' });
  hud.append(flash);

  return {
    show() { hud.classList.remove('hidden'); },
    hide() { hud.classList.add('hidden'); },

    // title — заголовок журнала (название дня), doneHint — подсказка последней строкой, когда день завершён,
    // hintOf(quest) — подсказка для активного квеста (у многошагового — из текущего шага)
    renderJournal(quests, npcs, statusOf, { title, doneHint, hintOf = (q) => `Иди: ${q.where}` } = {}) {
      const done = quests.filter((q) => statusOf(q.id) === QuestStatus.DONE).length;
      const header = h('button', {
        class: 'journal-head',
        onclick: () => { collapsed = !collapsed; journal.classList.toggle('collapsed', collapsed); },
      }, h('b', {}, `📋 ${title ?? 'Задания'}`), h('span', { class: 'progress' }, `${done}/${quests.length}`));
      const items = quests.map((q) => {
        const st = statusOf(q.id);
        const npc = npcs.find((n) => n.id === q.npc);
        const hint = st === QuestStatus.AVAILABLE ? `Поговори: ${npc.name}` : st === QuestStatus.ACTIVE ? hintOf(q) : 'Выполнено';
        return h('li', { class: st }, h('span', { class: 'qi' }, STATUS_ICON[st]), h('div', {}, h('div', { class: 'qt' }, q.title), h('div', { class: 'qh' }, hint)));
      });
      if (doneHint) items.push(h('li', { class: 'exit-hint' }, doneHint));
      const bar = h('div', { class: 'bar' }, h('div', { style: { width: `${(done / quests.length) * 100}%` } }));
      journal.replaceChildren(header, bar, h('ul', {}, items));
      journal.classList.toggle('collapsed', collapsed);
    },

    setPrompt(text) {
      if (!text) { prompt.classList.add('hidden'); return; }
      prompt.textContent = text;
      prompt.classList.remove('hidden');
    },

    // Подсказка «кликни, чтобы управлять камерой мышью» (десктоп, курсор не захвачен)
    setLockHint(visible) { lockHint.classList.toggle('hidden', !visible); },

    // Короткая красная вспышка по краям экрана (начало пожара)
    alarm() {
      flash.classList.remove('hidden', 'on');
      void flash.offsetWidth;
      flash.classList.add('on');
      setTimeout(() => flash.classList.add('hidden'), 2000);
    },

    toast(text, kind = '') {
      const el = h('div', { class: `toast ${kind}` }, text);
      toasts.append(el);
      setTimeout(() => el.classList.add('out'), 2800);
      setTimeout(() => el.remove(), 3300);
    },
  };
}
