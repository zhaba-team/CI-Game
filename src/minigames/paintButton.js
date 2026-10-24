// Мини-игра «Покрась кнопку»: подобрать цвет и скругление кнопки по макету дизайнера.
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

export default {
  id: 'paint-button',
  title: 'Покрась кнопку',
  mount(root, { complete }) {
    let color = '#B0B0B0';
    let radius = 0;
    let done = false;

    const code = h('pre', { class: 'code small' });
    const buy = h('button', { class: 'site-buy' }, 'Купить');
    const feedback = h('div', { class: 'feedback' }, 'Выбери цвет и скругление, затем нажми на кнопку «Купить» на сайте, чтобы проверить.');

    const render = () => {
      buy.style.background = color;
      buy.style.borderRadius = `${radius}px`;
      code.innerHTML = `<span class="tok-sel">.buy-button</span> {\n  <span class="tok-prop">background</span>: <span class="tok-val">${color}</span>;\n  <span class="tok-prop">border-radius</span>: <span class="tok-val">${radius}px</span>;\n}`;
      root.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('selected', b.dataset.color === color));
      root.querySelectorAll('[data-radius]').forEach((b) => b.classList.toggle('selected', Number(b.dataset.radius) === radius));
    };

    buy.addEventListener('click', () => {
      if (done) return;
      const okColor = color === TARGET.color;
      const okRadius = radius === TARGET.radius;
      if (okColor && okRadius) {
        done = true;
        feedback.className = 'feedback ok';
        feedback.textContent = '🎉 Точно как на макете! Аня будет счастлива.';
        buy.classList.add('pop');
        setTimeout(complete, 900);
        return;
      }
      feedback.className = 'feedback warn';
      if (!okColor && color === '#3FBF7F') feedback.textContent = 'Очень похоже, но мятный светлее. Сравни hex-код с макетом: дизайнеры точны до символа.';
      else if (!okColor) feedback.textContent = 'Цвет пока не совпадает с макетом. Посмотри на hex-код в карточке дизайнера.';
      else feedback.textContent = 'Цвет отличный! А вот углы на макете скруглены сильнее.';
    });

    const mockup = h('div', { class: 'mockup' },
      h('div', { class: 'mockup-label' }, 'Макет от Ани'),
      h('div', { class: 'mockup-btn', style: { background: TARGET.color, borderRadius: `${TARGET.radius}px` } }, 'Купить'),
      h('div', { class: 'mockup-spec' }, `цвет: ${TARGET.color}`, h('br'), `скругление: ${TARGET.radius}px`),
    );

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
      onclick: () => { color = c.hex; render(); },
    }, h('span', {}, c.hex))));

    const radii = h('div', { class: 'chips' }, RADII.map((r) => h('button', {
      class: 'chip',
      'data-radius': r,
      onclick: () => { radius = r; render(); },
    }, h('span', { class: 'radius-demo', style: { borderRadius: `${r / 2}px` } }), `${r}px`)));

    root.append(
      h('div', { class: 'mg-grid' },
        h('div', {}, site, feedback),
        h('div', { class: 'side' },
          mockup,
          h('div', { class: 'label' }, 'background — цвет'), palette,
          h('div', { class: 'label' }, 'border-radius — скругление'), radii,
          h('div', { class: 'label' }, 'Твой CSS-код'), code,
        ),
      ),
    );
    render();
  },
};
