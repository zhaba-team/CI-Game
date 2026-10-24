// Синий экран смерти (по образцу классического экрана Windows XP): во весь экран, без кнопок,
// закрывается сам через duration секунд, пока «собирается дамп» 0 → 100 %.
import { h } from './dom.js';
import { openModal, closeModal } from './modal.js';

const TICK_MS = 100;

export function showBsod({ duration, onDone }) {
  const dump = h('p', {}, 'Collecting data for crash dump… 0%');
  const body = h('div', { class: 'bsod' },
    h('p', {}, 'A problem has been detected and Windows has been shut down to prevent damage to your computer.'),
    h('p', {}, 'The problem seems to be caused by the following file: FRIDAY_RELEASE.SYS'),
    h('p', {}, 'PAGE_FAULT_IN_FRIDAY_EVENING'),
    h('p', { class: 'bsod-extra' }, 'If this is the first time you\'ve seen this Stop error screen, restart your computer. If this screen appears again, follow these steps:'),
    h('p', { class: 'bsod-extra' }, 'Check to make sure any new hardware or software is properly installed. Never deploy on Friday evening.'),
    h('p', {}, 'Technical information:'),
    h('p', {}, '*** STOP: 0x0000F12D (0x00000005, 0x00000017, 0x00000059, 0x00000000)'),
    dump,
  );
  openModal({ variant: 'bsod', closable: false, actions: [], body });

  const started = performance.now();
  const timer = setInterval(() => {
    const progress = Math.min(1, (performance.now() - started) / (duration * 1000));
    dump.textContent = `Collecting data for crash dump… ${Math.round(progress * 100)}%`;
    if (progress < 1) return;
    clearInterval(timer);
    closeModal();
    onDone?.();
  }, TICK_MS);
}
