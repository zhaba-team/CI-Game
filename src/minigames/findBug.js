// Мини-игра «Найди баг»: по упавшему тесту найти строку с ошибкой и выбрать исправление.
import { h } from '../ui/dom.js';

const ROUNDS = [
  {
    file: 'cart.js',
    lines: [
      'function calcTotal(prices) {',
      '  let total = 0;',
      '  for (let i = 0; i <= prices.length; i++) {',
      '    total += prices[i];',
      '  }',
      '  return total;',
      '}',
    ],
    test: { call: 'calcTotal([100, 250, 50])', expected: '400', got: 'NaN' },
    bugLine: 2,
    wrongLineHint: 'Эта строка выглядит нормально. Подумай: откуда в сумме может взяться NaN — «не число»? Возможно, цикл берёт лишний элемент.',
    fixes: [
      { code: '  for (let i = 0; i < prices.length; i++) {', ok: true },
      { code: '  for (let i = 1; i <= prices.length; i++) {', ok: false, why: 'Теперь пропустим первый элемент (индексы начинаются с 0), а лишний всё равно останется.' },
      { code: '  for (let i = 0; i <= prices.length + 1; i++) {', ok: false, why: 'Так цикл зайдёт ещё дальше за конец массива — NaN никуда не денется.' },
    ],
    explain: 'В массиве из 3 элементов индексы 0, 1, 2. Условие i <= 3 добавляло несуществующий prices[3] = undefined, и сумма превращалась в NaN.',
  },
  {
    file: 'access.js',
    lines: [
      'function canBuyTicket(age) {',
      '  // Билет можно купить с 18 лет',
      '  return age > 18;',
      '}',
    ],
    test: { call: 'canBuyTicket(18)', expected: 'true', got: 'false' },
    bugLine: 2,
    wrongLineHint: 'Комментарии и объявление функции не влияют на результат. Ищи строку, где вычисляется ответ.',
    fixes: [
      { code: '  return age < 18;', ok: false, why: 'Так билет смогут купить только младше 18 — наоборот!' },
      { code: '  return age >= 18;', ok: true },
      { code: '  return age == 81;', ok: false, why: 'Цифры перепутались местами — так билет достанется только тем, кому ровно 81.' },
    ],
    explain: 'Знак > значит «строго больше», и 18 > 18 — ложь. Нужен >= — «больше или равно».',
  },
];

export default {
  id: 'find-bug',
  title: 'Найди баг',
  mount(root, { complete }) {
    let round = 0;

    const renderRound = () => {
      const r = ROUNDS[round];
      let solved = false;
      const feedback = h('div', { class: 'feedback' }, 'Шаг 1. Нажми на строку кода, в которой, по-твоему, ошибка.');
      const fixes = h('div', { class: 'fixes hidden' });
      const testBox = h('div', { class: 'test fail' },
        h('b', {}, '✗ Тест упал'),
        h('code', {}, r.test.call),
        h('div', {}, 'ожидалось: ', h('code', {}, r.test.expected), '  получено: ', h('code', {}, r.test.got)),
      );

      const lineEls = r.lines.map((text, i) => h('div', {
        class: 'code-line',
        onclick: () => pickLine(i),
      }, h('span', { class: 'ln' }, i + 1), h('span', {}, text)));

      const pickLine = (i) => {
        if (solved) return;
        lineEls.forEach((el) => el.classList.remove('picked', 'wrong'));
        if (i !== r.bugLine) {
          lineEls[i].classList.add('wrong');
          feedback.className = 'feedback warn';
          feedback.textContent = r.wrongLineHint;
          return;
        }
        lineEls[i].classList.add('picked');
        feedback.className = 'feedback';
        feedback.textContent = 'Верно, ошибка здесь! Шаг 2. Выбери, на что заменить строку.';
        fixes.classList.remove('hidden');
      };

      fixes.append(...r.fixes.map((f) => h('button', {
        class: 'fix',
        onclick: (e) => {
          if (solved) return;
          if (!f.ok) {
            e.currentTarget.classList.add('wrong');
            feedback.className = 'feedback warn';
            feedback.textContent = f.why;
            return;
          }
          solved = true;
          lineEls[r.bugLine].lastChild.textContent = f.code;
          lineEls[r.bugLine].classList.replace('picked', 'fixed');
          testBox.className = 'test ok';
          testBox.firstChild.textContent = '✓ Тест прошёл';
          testBox.lastChild.replaceChildren('получено: ', h('code', {}, r.test.expected));
          feedback.className = 'feedback ok';
          feedback.textContent = r.explain;
          fixes.replaceChildren(h('button', {
            class: 'btn primary',
            onclick: () => {
              round += 1;
              if (round < ROUNDS.length) renderRound();
              else complete();
            },
          }, round + 1 < ROUNDS.length ? 'Следующий тест →' : 'Готово!'));
        },
      }, h('code', {}, f.code.trim()))));

      root.replaceChildren(
        h('div', { class: 'mg-progress' }, `Тест ${round + 1} из ${ROUNDS.length}`),
        h('div', { class: 'mg-grid' },
          h('div', { class: 'editor' },
            h('div', { class: 'editor-tab' }, r.file),
            h('div', { class: 'code' }, lineEls),
          ),
          h('div', { class: 'side' }, testBox, feedback, fixes),
        ),
      );
    };
    renderRound();
  },
};
