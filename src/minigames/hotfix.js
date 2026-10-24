// Мини-игра «Срочный фикс»: заполнить три пропуска в функции скидки по промокоду и прогнать тесты.
import { h } from '../ui/dom.js';

// Пропуски в коде: варианты, правильный ответ и объяснение ошибки (why) для неверных вариантов
const SLOTS = [
  {
    key: 'cond',
    options: [
      { code: "code = 'FRIDAY'", why: "Одно «=» не сравнивает, а присваивает: code = 'FRIDAY' всегда «истина», и скидку получат все. Для сравнения нужно «===»." },
      { code: "code === 'FRIDAY'" },
      { code: "'FRIDAY'", why: "Строка 'FRIDAY' сама по себе всегда «истина» — условие не проверяет, что ввёл покупатель. Сравни code с промокодом." },
    ],
  },
  {
    key: 'discount',
    options: [
      { code: 'price - 20', why: 'price - 20 — это минус 20 рублей, а не 20 процентов. Скидка 20 % — значит, покупатель платит 80 % цены.' },
      { code: 'price * 0.8' },
      { code: 'price * 20', why: 'price * 20 увеличивает цену в 20 раз — клиент точно не обрадуется 🙂 Скидка 20 % — это 80 % от цены.' },
    ],
  },
  {
    key: 'fallback',
    options: [
      { code: 'return 0;', why: 'Без промокода покупатель должен платить полную цену, а return 0 раздаёт товар бесплатно.' },
      { code: 'return price;' },
    ],
  },
];
const ANSWERS = { cond: "code === 'FRIDAY'", discount: 'price * 0.8', fallback: 'return price;' };
const TESTS = [
  { price: 1000, code: 'FRIDAY', expected: 800 },
  { price: 1000, code: 'HELLO', expected: 1000 },
  { price: 500, code: 'FRIDAY', expected: 400 },
];

// Что вернёт функция с выбранными вариантами (picked: key → код варианта)
function applyPromo(picked, price, code) {
  const matches = picked.cond === ANSWERS.cond ? code === 'FRIDAY' : true; // присваивание и строка — всегда «истина»
  if (matches) {
    if (picked.discount === 'price - 20') return price - 20;
    if (picked.discount === 'price * 20') return price * 20;
    return price * 0.8;
  }
  return picked.fallback === 'return 0;' ? 0 : price;
}

export default {
  id: 'hotfix',
  title: 'Срочный фикс',
  mount(root, { playerName, complete }) {
    const picked = { cond: null, discount: null, fallback: null };
    let done = false;

    const lines = h('div', { class: 'code' });
    const tests = h('div', { class: 'hotfix-tests' });
    const feedback = h('div', { class: 'feedback' }, 'Функция скидки недописана. Нажимай на варианты под строками, чтобы заполнить пропуски, а потом нажми «Запустить тесты».');
    const runBtn = h('button', { class: 'btn primary', onclick: () => run() }, '▶ Запустить тесты');

    const codeLine = (n, ...content) => h('div', { class: 'code-line' }, h('span', { class: 'ln' }, n), h('span', {}, ...content));
    const slotEl = (key) => (picked[key]
      ? h('span', { class: 'hotfix-filled' }, picked[key])
      : h('span', { class: 'token-slot' }, '___'));
    const chips = (slot) => h('div', { class: 'infra-chips' }, slot.options.map((o) => h('button', {
      class: `chip${picked[slot.key] === o.code ? ' selected' : ''}`,
      disabled: done,
      onclick: () => { picked[slot.key] = o.code; render(); },
    }, o.code)));
    const [cond, discount, fallback] = SLOTS;

    const renderTests = (results = null) => {
      tests.replaceChildren(...TESTS.map((tc, i) => {
        const r = results?.[i];
        const state = r === undefined ? '' : r === tc.expected ? ' ok' : ' fail';
        return h('div', { class: `hotfix-test${state}` },
          h('span', { class: 'hotfix-mark' }, state === ' ok' ? '✓' : state === ' fail' ? '✗' : '•'),
          h('code', {}, `applyPromo(${tc.price}, '${tc.code}')`),
          h('span', {}, `→ ${tc.expected}`),
          state === ' fail' ? h('span', { class: 'hotfix-got' }, `получено ${r}`) : null,
        );
      }));
    };

    const render = () => {
      lines.replaceChildren(
        codeLine(1, h('span', { class: 'tok-comment' }, '// Промокод FRIDAY — скидка 20 %')),
        codeLine(2, h('span', { class: 'tok-kw' }, 'function'), ' applyPromo(price, code) {'),
        codeLine(3, '  ', h('span', { class: 'tok-kw' }, 'if'), ' (', slotEl('cond'), ') {'),
        chips(cond),
        codeLine(4, '    ', h('span', { class: 'tok-kw' }, 'return'), ' ', slotEl('discount'), ';'),
        chips(discount),
        codeLine(5, '  }'),
        codeLine(6, '  ', slotEl('fallback')),
        chips(fallback),
        codeLine(7, '}'),
      );
      runBtn.disabled = done || Object.values(picked).includes(null);
    };

    const run = () => {
      if (done) return;
      const results = TESTS.map((tc) => applyPromo(picked, tc.price, tc.code));
      renderTests(results);
      const passed = results.every((r, i) => r === TESTS[i].expected);
      if (!passed) {
        // Объясняем по первому неверному пропуску
        const wrong = SLOTS.find((s) => picked[s.key] !== ANSWERS[s.key]);
        const why = wrong.options.find((o) => o.code === picked[wrong.key]).why;
        feedback.className = 'feedback warn';
        feedback.textContent = `Тесты упали. ${why}`;
        return;
      }
      done = true;
      render();
      feedback.className = 'feedback ok';
      feedback.textContent = `🎉 Все тесты зелёные, ${playerName}! Промокод работает.`; // текст, не innerHTML
      setTimeout(complete, 900);
    };

    root.append(
      h('div', { class: 'mg-grid hotfix-grid' },
        h('div', { class: 'editor' }, h('div', { class: 'editor-tab' }, 'promo.js'), lines),
        h('div', { class: 'side' }, h('div', { class: 'label' }, 'Тесты'), tests, feedback, runBtn),
      ),
    );
    render();
    renderTests();
  },
};
