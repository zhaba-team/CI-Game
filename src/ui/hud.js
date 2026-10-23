// HUD: журнал заданий, подсказка взаимодействия, всплывающие уведомления.
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
  let collapsed = window.innerWidth < 640;

  return {
    show() { hud.classList.remove('hidden'); },
    hide() { hud.classList.add('hidden'); },

    renderJournal(quests, npcs, statusOf) {
      const done = quests.filter((q) => statusOf(q.id) === QuestStatus.DONE).length;
      const header = h('button', {
        class: 'journal-head',
        onclick: () => { collapsed = !collapsed; journal.classList.toggle('collapsed', collapsed); },
      }, h('b', {}, '📋 Задания'), h('span', { class: 'progress' }, `${done}/${quests.length}`));
      const items = quests.map((q) => {
        const st = statusOf(q.id);
        const npc = npcs.find((n) => n.id === q.npc);
        const hint = st === QuestStatus.AVAILABLE ? `Поговори: ${npc.name}` : st === QuestStatus.ACTIVE ? `Иди: ${q.where}` : 'Выполнено';
        return h('li', { class: st }, h('span', { class: 'qi' }, STATUS_ICON[st]), h('div', {}, h('div', { class: 'qt' }, q.title), h('div', { class: 'qh' }, hint)));
      });
      const bar = h('div', { class: 'bar' }, h('div', { style: { width: `${(done / quests.length) * 100}%` } }));
      journal.replaceChildren(header, bar, h('ul', {}, items));
      journal.classList.toggle('collapsed', collapsed);
    },

    setPrompt(text) {
      if (!text) { prompt.classList.add('hidden'); return; }
      prompt.textContent = text;
      prompt.classList.remove('hidden');
    },

    toast(text, kind = '') {
      const el = h('div', { class: `toast ${kind}` }, text);
      toasts.append(el);
      setTimeout(() => el.classList.add('out'), 2800);
      setTimeout(() => el.remove(), 3300);
    },
  };
}
