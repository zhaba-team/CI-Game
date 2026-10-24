// Модальные окна. Одновременно открыто не больше одного; пока окно открыто, игра на паузе для ввода.
import { h } from './dom.js';

const root = () => document.getElementById('modal-root');
let current = null;
const openListeners = new Set();

export function onModalChange(fn) {
  openListeners.add(fn);
}

export function isModalOpen() {
  return current !== null;
}

export function closeModal() {
  if (!current) return;
  const { el, onClose } = current;
  current = null;
  el.classList.add('closing');
  setTimeout(() => el.remove(), 160);
  openListeners.forEach((fn) => fn(false));
  onClose?.();
}

/**
 * @param {object} o
 * @param {string} [o.title]  — пустой заголовок не рендерится
 * @param {string} [o.subtitle]
 * @param {string} [o.badge]   — цветная плашка рядом с заголовком (например, роль NPC)
 * @param {Node|string} o.body
 * @param {Array<{label:string, primary?:boolean, onClick?:Function}>} [o.actions]
 * @param {boolean} [o.wide]
 * @param {Function} [o.onClose]
 * @param {boolean} [o.closable] — false: нет ✕, окно не закрывается кликом по фону и Esc
 * @param {string} [o.variant]   — особый вид окна: классы modal--<variant> и modal-backdrop--<variant>
 */
export function openModal({ title, subtitle, badge, body, actions = [], wide = false, onClose, closable = true, variant }) {
  if (current) closeModal();
  const footer = h('div', { class: 'modal-actions' });
  const head = title || subtitle || closable
    ? h('div', { class: 'modal-head' },
      h('div', {},
        title ? h('h2', {}, title, badge ? h('span', { class: 'badge' }, badge) : null) : null,
        subtitle ? h('div', { class: 'modal-sub' }, subtitle) : null,
      ),
      closable ? h('button', { class: 'modal-x', 'aria-label': 'Закрыть', onclick: closeModal }, '✕') : null,
    )
    : null;
  const card = h('div', { class: `modal${wide ? ' wide' : ''}${variant ? ` modal--${variant}` : ''}`, role: 'dialog', 'aria-modal': 'true' },
    head,
    h('div', { class: 'modal-body' }, body),
    footer,
  );
  const el = h('div', { class: `modal-backdrop${variant ? ` modal-backdrop--${variant}` : ''}` }, card);
  if (closable) el.addEventListener('pointerdown', (e) => { if (e.target === el) closeModal(); });
  root().append(el);

  const setActions = (list) => {
    footer.replaceChildren(...list.map((a) => h('button', {
      class: `btn${a.primary ? ' primary' : ''}`,
      onclick: () => a.onClick ? a.onClick() : closeModal(),
    }, a.label)));
    footer.classList.toggle('hidden', list.length === 0);
    footer.querySelector('.primary')?.focus({ preventScroll: true });
  };
  setActions(actions);

  current = { el, onClose };
  openListeners.forEach((fn) => fn(true));
  return { el: card, setActions, close: closeModal };
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && current && current.el.querySelector('.modal-x')) closeModal();
});
