// Разметка модалки Базы знаний: секции по дням и карточки терминов. Только DOM — данные готовит game.js.
// sections: [{ title, entries: [{ id, emoji, term, text, open, hint, isNew }] }]
import { h } from './dom.js';

function card(entry) {
  if (!entry.open) {
    return h('div', { class: 'kb-card locked' },
      h('div', { class: 'kb-emoji' }, '🔒'),
      h('div', { class: 'kb-text' }, h('b', {}, '???'), h('div', { class: 'kb-hint' }, entry.hint)),
    );
  }
  return h('div', { class: 'kb-card' },
    h('div', { class: 'kb-emoji' }, entry.emoji),
    h('div', { class: 'kb-text' },
      h('b', {}, entry.term, entry.isNew ? h('span', { class: 'kb-new' }, 'NEW') : null),
      h('p', {}, entry.text),
    ),
  );
}

export function renderKnowledgeBase(sections) {
  return h('div', { class: 'kb' }, sections.map((s) => h('section', { class: 'kb-section' },
    h('h3', {}, s.title),
    h('div', { class: 'kb-grid' }, s.entries.map(card)),
  )));
}
