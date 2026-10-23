// Мини-игра «Приветствие»: собрать из блоков функцию, которая здоровается с пользователем по имени.
import { h } from '../ui/dom.js';

const TOKENS = [
  { id: 'hello', code: '"Привет, "', value: 'Привет, ' },
  { id: 'nameStr', code: '"name"', value: 'name' },
  { id: 'bye', code: '"Пока, "', value: 'Пока, ' },
  { id: 'name', code: 'name', value: null }, // значение переменной — никнейм игрока
  { id: 'excl', code: '"!"', value: '!' },
  { id: 'q', code: '"?"', value: '?' },
];
const SLOTS = 3;

export default {
  id: 'greeting',
  title: 'Функция приветствия',
  mount(root, { playerName, complete }) {
    const slots = Array(SLOTS).fill(null);
    let done = false;
    const valueOf = (t) => (t.value === null ? playerName : t.value);

    const slotsEl = h('span', { class: 'slots' });
    const tokensEl = h('div', { class: 'tokens' });
    const result = h('div', { class: 'hero-title' }, '…');
    const feedback = h('div', { class: 'feedback' }, 'Нажимай на блоки, чтобы вставить их в код. Нажми на блок в коде, чтобы убрать его. Потом нажми «Запустить».');
    const runBtn = h('button', { class: 'btn primary', onclick: () => run() }, '▶ Запустить');

    const render = () => {
      slotsEl.replaceChildren(...slots.flatMap((t, i) => [
        i > 0 ? h('span', { class: 'tok-op' }, ' + ') : null,
        t
          ? h('button', { class: `token in-code ${t.value === null ? 'var' : 'str'}`, onclick: () => { if (!done) { slots[i] = null; render(); } } }, t.code)
          : h('span', { class: 'token-slot' }, '___'),
      ].filter(Boolean)));
      tokensEl.replaceChildren(...TOKENS.map((t) => h('button', {
        class: `token ${t.value === null ? 'var' : 'str'}`,
        disabled: slots.includes(t) || done,
        onclick: () => {
          const free = slots.indexOf(null);
          if (free === -1) return;
          slots[free] = t;
          render();
        },
      }, t.code)));
      runBtn.disabled = done || slots.includes(null);
    };

    const run = () => {
      const text = slots.map(valueOf).join('');
      result.textContent = text;
      result.classList.remove('flash');
      void result.offsetWidth;
      result.classList.add('flash');
      const target = `Привет, ${playerName}!`;
      if (text === target) {
        done = true;
        render();
        feedback.className = 'feedback ok';
        feedback.textContent = `🎉 Сайт здоровается: «${text}». Фича готова!`;
        setTimeout(complete, 1200);
        return;
      }
      feedback.className = 'feedback warn';
      if (slots.includes(TOKENS[1])) feedback.textContent = 'Сайт написал буквально «name». В кавычках — просто текст, а чтобы подставить имя, нужна переменная name без кавычек.';
      else if (slots.includes(TOKENS[2])) feedback.textContent = 'Хм, сайт прощается, хотя должен здороваться 🙂';
      else if (slots.includes(TOKENS[5])) feedback.textContent = 'Почти! Но приветствие с вопросом звучит странно — нужен восклицательный знак.';
      else feedback.textContent = `Получилось «${text}», а нужно «${target}». Проверь порядок блоков.`;
    };

    root.append(
      h('div', { class: 'mg-grid' },
        h('div', {},
          h('div', { class: 'editor' },
            h('div', { class: 'editor-tab' }, 'greeting.js'),
            h('div', { class: 'code' },
              h('div', { class: 'code-line' }, h('span', { class: 'ln' }, 1), h('span', {}, h('span', { class: 'tok-kw' }, 'function'), ' greet(name) {')),
              h('div', { class: 'code-line tall' }, h('span', { class: 'ln' }, 2), h('span', {}, '  ', h('span', { class: 'tok-kw' }, 'return'), ' ', slotsEl, ';')),
              h('div', { class: 'code-line' }, h('span', { class: 'ln' }, 3), h('span', {}, '}')),
              h('div', { class: 'code-line' }, h('span', { class: 'ln' }, 4), h('span', {}, '')),
              h('div', { class: 'code-line' }, h('span', { class: 'ln' }, 5), h('span', { class: 'tok-comment' }, `greet("${playerName}");`)),
            ),
          ),
          h('div', { class: 'label' }, 'Блоки кода'), tokensEl,
        ),
        h('div', { class: 'side' },
          h('div', { class: 'browser' },
            h('div', { class: 'browser-bar' }, h('i'), h('i'), h('i'), h('span', {}, 'doncode.ru')),
            h('div', { class: 'browser-page hero' }, result, h('div', { class: 'hero-sub' }, 'Главная страница')),
          ),
          feedback, runBtn,
        ),
      ),
    );
    render();
  },
};
