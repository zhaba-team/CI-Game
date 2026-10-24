// HUD боя на световых мечах: жизни игрока и мастера, серия блоков, баннеры («3-2-1», «Бой!», «Блок!»),
// стрелка замаха с кольцом-таймером, кнопки блоков ← ↑ → и контратаки ⚡, пауза. Клавиатура слушается,
// только пока HUD показан. Состояние боя приходит в render(state) из flow/lightsaber.js — сам HUD ничего не решает.
import { h } from './dom.js';

const ARROWS = { left: '←', right: '→', high: '↑' };
const BLOCK_KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'high', KeyW: 'high' };
const BANNER_TIME = 800; // мс
const URGENT = 0.35;     // доля оставшегося времени, когда кольцо краснеет

export function createDuelHud({ onBlock, onStrike, onPause, onResume, onSurrender }) {
  const root = document.getElementById('duel-hud');
  let paused = false;
  let bannerTimer = 0;
  let last = {}; // прошлые значения render: DOM трогаем только при изменениях

  const hearts = (el, hp, max) => {
    el.replaceChildren(...Array.from({ length: max }, (_, i) => h('i', { class: i < hp ? '' : 'lost' }, '❤')));
  };
  // Кнопка срабатывает на нажатие пальца / мыши, без задержки click
  const press = (label, text, key, fn, extra = '') => h('button', {
    class: `duel-btn ${extra}`,
    'aria-label': label,
    onpointerdown: (e) => { e.preventDefault(); fn(); },
  }, text, key ? h('small', {}, key) : null);

  const playerHearts = h('span', { class: 'duel-hearts' });
  const masterHearts = h('span', { class: 'duel-hearts' });
  const masterLabel = h('b', {});
  const combo = h('div', { class: 'duel-combo panel' });
  const pauseBtn = h('button', { class: 'duel-btn duel-pause-btn', 'aria-label': 'Пауза', onclick: () => onPause() }, '⏸');
  const banner = h('div', { class: 'duel-banner hidden' });
  const arrow = h('span', {});
  const cue = h('div', { class: 'duel-cue hidden' }, arrow);
  const strikeBtn = press('Контратака', '⚡', 'Space', () => onStrike(), 'duel-strike');
  const flash = h('div', { class: 'alarm-flash duel-flash hidden' });
  const pauseCard = h('div', { class: 'duel-overlay hidden' },
    h('div', { class: 'duel-card' },
      h('b', {}, 'Пауза'),
      h('button', { class: 'btn primary', onclick: () => onResume() }, 'Продолжить'),
      h('button', { class: 'btn', onclick: () => onSurrender() }, 'Сдаться'),
    ),
  );

  root.replaceChildren(
    flash,
    h('div', { class: 'duel-top' },
      h('div', { class: 'duel-side panel' }, h('b', {}, 'Ты'), playerHearts),
      combo,
      h('div', { class: 'duel-side panel' }, masterLabel, masterHearts),
      pauseBtn,
    ),
    cue,
    banner,
    h('div', { class: 'duel-controls' },
      h('div', { class: 'duel-blocks' },
        press('Блок слева', '←', 'A', () => onBlock('left')),
        press('Блок сверху', '↑', 'W', () => onBlock('high')),
        press('Блок справа', '→', 'D', () => onBlock('right')),
      ),
      strikeBtn,
    ),
    pauseCard,
  );

  function onKey(e) {
    if (e.repeat) return;
    const side = BLOCK_KEYS[e.code];
    if (side) { e.preventDefault(); onBlock(side); return; }
    if (e.code === 'Space') { e.preventDefault(); onStrike(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (paused) onResume();
      else onPause();
    }
  }

  return {
    show({ masterName }) {
      masterLabel.textContent = masterName;
      last = {};
      root.classList.remove('hidden');
      window.addEventListener('keydown', onKey);
    },
    hide() {
      root.classList.add('hidden');
      banner.classList.add('hidden');
      clearTimeout(bannerTimer);
      window.removeEventListener('keydown', onKey);
    },
    // state — снимок createSaberDuel().state
    render(state) {
      paused = state.paused;
      if (last.playerHp !== state.playerHp) hearts(playerHearts, state.playerHp, state.maxPlayerHp);
      if (last.masterHp !== state.masterHp) hearts(masterHearts, state.masterHp, state.maxMasterHp);
      if (last.combo !== state.combo) combo.textContent = `⚔ ${state.combo}/${state.comboGoal}`;
      if (last.paused !== state.paused) pauseCard.classList.toggle('hidden', !state.paused);
      if (last.phase !== state.phase) strikeBtn.classList.toggle('ready', state.phase === 'opening');
      const timed = state.phase === 'windup' || state.phase === 'opening';
      cue.classList.toggle('hidden', !timed);
      if (timed) {
        const p = state.timeTotal > 0 ? state.timeLeft / state.timeTotal : 0;
        cue.style.setProperty('--p', p.toFixed(3));
        cue.classList.toggle('urgent', p < URGENT);
        cue.classList.toggle('opening', state.phase === 'opening');
        arrow.textContent = state.phase === 'opening' ? '⚡' : ARROWS[state.dir];
      }
      last = { playerHp: state.playerHp, masterHp: state.masterHp, combo: state.combo, paused: state.paused, phase: state.phase };
    },
    // kind: 'hit' — красная вспышка по краям экрана (игрок пропустил удар)
    flash(kind) {
      if (kind !== 'hit') return;
      flash.classList.remove('hidden', 'on');
      void flash.offsetWidth;
      flash.classList.add('on');
    },
    // Крупная надпись по центру на BANNER_TIME; persist — не прятать (например, «Пауза»)
    banner(text, { persist = false } = {}) {
      clearTimeout(bannerTimer);
      banner.textContent = text;
      banner.classList.remove('hidden', 'pop');
      void banner.offsetWidth;
      banner.classList.add('pop');
      if (!persist) bannerTimer = setTimeout(() => banner.classList.add('hidden'), BANNER_TIME);
    },
  };
}
