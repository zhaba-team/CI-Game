// Разметка модалки коллекции книг 🏆: карточки найденных (обложка, название, автор, описание)
// и ненайденных (силуэт, «???» и подсказка-помещение). Только DOM — данные готовит flow/collectibles.js.
// cards: [{ id, found, title, author, cover, description, room }]
import { h } from './dom.js';

function card(book) {
  if (!book.found) {
    return h('div', { class: 'trophy-card locked' },
      h('div', { class: 'trophy-cover trophy-placeholder' }, '📕'),
      h('div', { class: 'trophy-text' }, h('b', {}, '???'), h('div', { class: 'trophy-hint' }, `Где-то: ${book.room}`)),
    );
  }
  return h('div', { class: 'trophy-card' },
    h('img', { class: 'trophy-cover', src: book.cover, alt: book.title, loading: 'lazy' }),
    h('div', { class: 'trophy-text' },
      h('b', {}, book.title),
      h('div', { class: 'trophy-author' }, book.author),
      h('p', {}, book.description),
    ),
  );
}

export function renderTrophies(cards) {
  return h('div', { class: 'trophies' }, cards.map(card));
}
