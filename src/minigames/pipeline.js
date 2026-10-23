// Мини-игра «Пайплайн»: расставить шаги CI/CD в правильном порядке и запустить выкладку.
import { h } from '../ui/dom.js';

const STEPS = [
  { id: 'pull', icon: '⬇️', title: 'Скачать код', cmd: 'git pull' },
  { id: 'install', icon: '📦', title: 'Установить зависимости', cmd: 'npm install', needs: 'pull', fail: 'Нечего устанавливать — код ещё не скачан из репозитория.' },
  { id: 'test', icon: '🧪', title: 'Запустить тесты', cmd: 'npm test', needs: 'install', fail: 'Тесты не запускаются: не установлены библиотеки, от которых зависит проект.' },
  { id: 'build', icon: '🛠️', title: 'Собрать проект', cmd: 'npm run build', needs: 'test', fail: 'Стоп! Собирать и выкладывать непроверенный код опасно — сначала тесты.' },
  { id: 'deploy', icon: '🚀', title: 'Выложить на сервер', cmd: './deploy.sh', needs: 'build', fail: 'Нечего выкладывать — проект ещё не собран.' },
];
const SHUFFLED = ['build', 'pull', 'deploy', 'test', 'install'];
const byId = Object.fromEntries(STEPS.map((s) => [s.id, s]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default {
  id: 'pipeline',
  title: 'Почини пайплайн',
  mount(root, { complete }) {
    let placed = [];
    let running = false;

    const pool = h('div', { class: 'pool' });
    const track = h('div', { class: 'track' });
    const log = h('pre', { class: 'terminal' }, '$ ожидаю запуск пайплайна…');
    const feedback = h('div', { class: 'feedback' }, 'Нажимай на карточки, чтобы добавить шаги в пайплайн по порядку. Нажми на шаг в пайплайне, чтобы убрать его.');
    const runBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => run() }, '▶ Запустить пайплайн');

    const card = (step, onclick, extra = '') => h('button', { class: `step-card ${extra}`, onclick, 'data-step': step.id },
      h('span', { class: 'step-icon' }, step.icon),
      h('span', {}, h('b', {}, step.title), h('code', {}, step.cmd)),
    );

    const render = () => {
      pool.replaceChildren(...SHUFFLED.filter((id) => !placed.includes(id)).map((id) => card(byId[id], () => {
        if (running) return;
        placed.push(id);
        render();
      })));
      const slots = [];
      for (let i = 0; i < STEPS.length; i++) {
        const id = placed[i];
        slots.push(id
          ? card(byId[id], () => { if (!running) { placed = placed.filter((p) => p !== id); render(); } }, 'placed')
          : h('div', { class: 'step-slot' }, `Шаг ${i + 1}`));
      }
      track.replaceChildren(...slots);
      runBtn.disabled = running || placed.length !== STEPS.length;
      if (pool.childElementCount === 0) pool.append(h('div', { class: 'pool-empty' }, 'Все шаги расставлены — запускай!'));
    };

    const run = async () => {
      running = true;
      render();
      feedback.className = 'feedback';
      feedback.textContent = 'Пайплайн запущен…';
      const done = new Set();
      const lines = [];
      const cards = [...track.children];
      for (let i = 0; i < placed.length; i++) {
        const step = byId[placed[i]];
        cards[i].classList.add('running');
        lines.push(`$ ${step.cmd}`);
        log.textContent = lines.join('\n');
        await wait(550);
        cards[i].classList.remove('running');
        if (step.needs && !done.has(step.needs)) {
          cards[i].classList.add('failed');
          lines.push(`✗ ошибка на шаге «${step.title}»`);
          log.textContent = lines.join('\n');
          feedback.className = 'feedback warn';
          feedback.textContent = `${step.fail} Поменяй порядок и попробуй снова.`;
          running = false;
          runBtn.disabled = false;
          runBtn.textContent = '↻ Запустить ещё раз';
          return;
        }
        cards[i].classList.add('passed');
        lines.push('  ✓ ok');
        log.textContent = lines.join('\n');
        done.add(step.id);
      }
      lines.push('', '🟢 Сайт обновлён, сервера работают!');
      log.textContent = lines.join('\n');
      feedback.className = 'feedback ok';
      feedback.textContent = '🎉 Пайплайн прошёл целиком. Лампочки в серверной снова зелёные!';
      runBtn.remove();
      setTimeout(complete, 1300);
    };

    root.append(
      h('div', { class: 'label' }, 'Доступные шаги'), pool,
      h('div', { class: 'label' }, 'Пайплайн выкладки'), track,
      h('div', { class: 'mg-grid' }, log, h('div', { class: 'side' }, feedback, runBtn)),
    );
    render();
  },
};
