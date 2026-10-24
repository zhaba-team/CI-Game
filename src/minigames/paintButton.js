// Мини-игра «Покрась кнопку»: подобрать цвет и скругление кнопки по макету дизайнера
// и проверить её на сайте — кликом по «Купить» или кнопкой «Проверить».
import { h } from '../ui/dom.js';

const COLORS = [
  { hex: '#E94F37', name: 'красный' },
  { hex: '#2E9E5B', name: 'зелёный' },
  { hex: '#3A86FF', name: 'синий' },
  { hex: '#FFBE0B', name: 'жёлтый' },
  { hex: '#8338EC', name: 'фиолетовый' },
  { hex: '#3FBF7F', name: 'мятный' },
];
const RADII = [0, 8, 24];
const TARGET = { color: '#2E9E5B', radius: 24 };
const NO_COLOR = '#B0B0B0'; // кнопка до выбора цвета

export default {
  id: 'paint-button',
  title: 'Покрась кнопку',
  mount(root, { complete }) {
    // null — игрок ещё не выбирал; шаг чеклиста отмечается за выбор, а не за верный ответ
    let color = null;
    let radius = null;
    let done = false;

    const code = h('pre', { class: 'code small' });
    const buy = h('button', { class: 'site-buy' }, 'Купить');
    const feedback = h('div', { class: 'feedback' });
    const check = h('button', { class: 'btn primary paint-check hidden' }, '✓ Проверить кнопку на сайте');
    const stepEls = ['Цвет', 'Скругление', 'Проверь на сайте'].map((label, i) => h('li', {}, h('b', {}, i + 1), label));

    const say = (text, kind = '') => {
      feedback.className = `feedback${kind ? ` ${kind}` : ''}`;
      feedback.textContent = text;
    };
    // Подсказка следующего шага (ошибки проверки показывает verify)
    const sayNextStep = () => {
      if (color === null) say('Шаг 1. Выбери цвет кнопки — как на макете дизайнера');
      else if (radius === null) say('Шаг 2. Выбери скругление углов');
      else say('Шаг 3. Нажми «Купить» на сайте или «Проверить»');
    };

    const render = () => {
      const ready = color !== null && radius !== null;
      buy.style.background = color ?? NO_COLOR;
      buy.style.borderRadius = `${radius ?? 0}px`;
      buy.classList.toggle('ready', ready && !done);
      check.classList.toggle('hidden', !ready || done);
      // Только константы и значения из COLORS / RADII — ввода игрока здесь нет
      code.innerHTML = `<span class="tok-sel">.buy-button</span> {\n  <span class="tok-prop">background</span>: <span class="tok-val">${color ?? NO_COLOR}</span>;\n  <span class="tok-prop">border-radius</span>: <span class="tok-val">${radius ?? 0}px</span>;\n}`;
      root.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('selected', b.dataset.color === color));
      root.querySelectorAll('[data-radius]').forEach((b) => b.classList.toggle('selected', Number(b.dataset.radius) === radius));
      [color !== null, radius !== null, done].forEach((on, i) => stepEls[i].classList.toggle('done', on));
    };

    const verify = () => {
      if (done) return;
      if (color === null || radius === null) { sayNextStep(); return; }
      const okColor = color === TARGET.color;
      const okRadius = radius === TARGET.radius;
      if (okColor && okRadius) {
        done = true;
        say('🎉 Точно как на макете! Клиент будет счастлив.', 'ok');
        buy.classList.add('pop');
        render();
        setTimeout(complete, 900);
        return;
      }
      if (!okColor && color === '#3FBF7F') say('Очень похоже, но мятный светлее. Сравни hex-код с макетом: дизайнеры точны до символа.', 'warn');
      else if (!okColor) say('Цвет пока не совпадает с макетом. Посмотри на hex-код в карточке дизайнера.', 'warn');
      else say('Цвет отличный! А вот углы на макете скруглены сильнее.', 'warn');
    };

    buy.addEventListener('click', verify);
    check.addEventListener('click', () => {
      // На телефоне сайт может быть выше экрана — показываем, как кнопка «нажимается» у покупателя
      buy.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      buy.classList.remove('pop');
      void buy.offsetWidth;
      buy.classList.add('pop');
      verify();
    });

    const pick = (apply) => {
      if (done) return;
      apply();
      render();
      sayNextStep();
    };

    const mockup = h('div', { class: 'mockup' },
      h('div', { class: 'mockup-label' }, 'Макет дизайнера'),
      h('div', { class: 'mockup-btn', style: { background: TARGET.color, borderRadius: `${TARGET.radius}px` } }, 'Купить'),
      h('div', { class: 'mockup-spec' }, `цвет: ${TARGET.color}`, h('br'), `скругление: ${TARGET.radius}px`),
    );

    const siteHint = h('div', { class: 'paint-site-hint' }, '👆 Нажми на кнопку «Купить» на сайте — так проверяют, как она работает у покупателя');
    const site = h('div', { class: 'browser' },
      h('div', { class: 'browser-bar' }, h('i'), h('i'), h('i'), h('span', {}, 'shop.жыбийрыр.рф')),
      h('div', { class: 'browser-page shop' },
        h('div', { class: 'shop-img' }, '🎧'),
        h('div', { class: 'shop-info' },
          h('b', {}, 'Беспроводные наушники'),
          h('div', { class: 'price' }, '4 990 ₽'),
          buy,
        ),
      ),
    );

    const palette = h('div', { class: 'swatches' }, COLORS.map((c) => h('button', {
      class: 'swatch',
      'data-color': c.hex,
      title: c.name,
      style: { background: c.hex },
      onclick: () => pick(() => { color = c.hex; }),
    }, h('span', {}, c.hex))));

    const radii = h('div', { class: 'chips' }, RADII.map((r) => h('button', {
      class: 'chip',
      'data-radius': r,
      onclick: () => pick(() => { radius = r; }),
    }, h('span', { class: 'radius-demo', style: { borderRadius: `${r / 2}px` } }), `${r}px`)));

    // На телефоне колонки «раскрываются» (display: contents), и порядок задаёт CSS:
    // макет → палитра → скругление → сайт → подсказка → «Проверить» → CSS-код
    root.append(
      h('ol', { class: 'paint-steps' }, stepEls),
      h('div', { class: 'mg-grid paint-grid' },
        h('div', { class: 'paint-col' },
          h('div', { class: 'paint-site' }, siteHint, site),
          feedback,
          check,
        ),
        h('div', { class: 'side paint-col' },
          mockup,
          h('div', { class: 'paint-pick' }, h('div', { class: 'label' }, '1 · background — цвет'), palette),
          h('div', { class: 'paint-pick' }, h('div', { class: 'label' }, '2 · border-radius — скругление'), radii),
          h('div', { class: 'paint-code' }, h('div', { class: 'label' }, 'Твой CSS-код'), code),
        ),
      ),
    );
    render();
    sayNextStep();
  },
};
