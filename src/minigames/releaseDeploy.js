// Мини-игра «Релиз в пятницу»: расставить шаги релиза по порядку, выбрать номер версии по SemVer и выкатить.
import { h } from '../ui/dom.js';

const STEPS = [
  { id: 'merge', icon: '🔀', title: 'Слить ветку в main', cmd: 'git merge feature/promo' },
  { id: 'test', icon: '🧪', title: 'Прогнать тесты', cmd: 'npm test', needs: 'merge', fail: 'Тесты проверили старый код: ветка с промокодом ещё не слита в main.' },
  { id: 'version', icon: '🏷️', title: 'Поставить версию', cmd: 'npm version', needs: 'test', fail: 'Стоп! Номер версии ставят только проверенному коду — сначала тесты.' },
  { id: 'build', icon: '🛠️', title: 'Собрать', cmd: 'npm run build', needs: 'version', fail: 'Сборка без номера версии — потом не поймёшь, что именно выкатили и на что откатываться.' },
  { id: 'deploy', icon: '🚀', title: 'Выкатить', cmd: './deploy.sh production', needs: 'build', fail: 'Нечего выкатывать — релиз ещё не собран.' },
];
const SHUFFLED = ['build', 'deploy', 'merge', 'version', 'test'];
const byId = Object.fromEntries(STEPS.map((s) => [s.id, s]));
const CURRENT = '1.4.2';
const VERSIONS = [
  { v: '1.4.3', why: '1.4.3 — это patch: его повышают только для исправлений ошибок. А промокод — новая функция.' },
  { v: '1.5.0' },
  { v: '2.0.0', why: '2.0.0 — это major: его повышают, когда ломается совместимость. Промокод ничего не ломает, это новая функция.' },
];
const ANSWER = '1.5.0';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default {
  id: 'release-deploy',
  title: 'Релиз в пятницу',
  mount(root, { playerName, complete }) {
    let placed = [];
    let version = null;
    let running = false;

    const pool = h('div', { class: 'pool' });
    const track = h('div', { class: 'track' });
    const versions = h('div', { class: 'chips release-versions' });
    const log = h('pre', { class: 'terminal' }, '$ ожидаю запуск релиза… (до конца дня 1 минута)');
    const feedback = h('div', { class: 'feedback' }, 'Нажимай на карточки, чтобы собрать релиз по шагам, и выбери номер новой версии. Нажми на шаг в релизе, чтобы убрать его.');
    const runBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => run() }, '🚀 Запустить релиз');

    const cmdOf = (step) => (step.id === 'version' ? `npm version ${version ?? '?'}` : step.cmd);
    const card = (step, onclick, extra = '') => h('button', { class: `step-card ${extra}`, onclick, 'data-step': step.id },
      h('span', { class: 'step-icon' }, step.icon),
      h('span', {}, h('b', {}, step.title), h('code', {}, cmdOf(step))),
    );

    const render = () => {
      pool.replaceChildren(...SHUFFLED.filter((id) => !placed.includes(id)).map((id) => card(byId[id], () => {
        if (running) return;
        placed.push(id);
        render();
      })));
      if (pool.childElementCount === 0) pool.append(h('div', { class: 'pool-empty' }, 'Все шаги в релизе — выбери версию и запускай!'));
      track.replaceChildren(...STEPS.map((_, i) => {
        const id = placed[i];
        return id
          ? card(byId[id], () => { if (!running) { placed = placed.filter((p) => p !== id); render(); } }, 'placed')
          : h('div', { class: 'step-slot' }, `Шаг ${i + 1}`);
      }));
      versions.replaceChildren(...VERSIONS.map(({ v }) => h('button', {
        class: `chip${version === v ? ' selected' : ''}`,
        disabled: running,
        onclick: () => { version = v; render(); },
      }, v)));
      runBtn.disabled = running || placed.length !== STEPS.length || !version;
    };

    const fail = (cardEl, text, lines) => {
      cardEl?.classList.add('failed');
      log.textContent = lines.join('\n');
      feedback.className = 'feedback warn';
      feedback.textContent = `${text} Исправь и попробуй снова.`;
      running = false;
      render();
      runBtn.textContent = '↻ Запустить ещё раз';
    };

    const run = async () => {
      running = true;
      render();
      feedback.className = 'feedback';
      feedback.textContent = 'Релиз запущен…';
      const done = new Set();
      const lines = [];
      const cards = [...track.children];
      for (let i = 0; i < placed.length; i++) {
        const step = byId[placed[i]];
        cards[i].classList.add('running');
        lines.push(`$ ${cmdOf(step)}`);
        log.textContent = lines.join('\n');
        await wait(300);
        cards[i].classList.remove('running');
        if (step.needs && !done.has(step.needs)) {
          lines.push(`✗ ошибка на шаге «${step.title}»`);
          fail(cards[i], step.fail, lines);
          return;
        }
        if (step.id === 'version' && version !== ANSWER) {
          lines.push(`✗ v${version}: номер версии не соответствует изменениям`);
          fail(cards[i], VERSIONS.find((o) => o.v === version).why, lines);
          return;
        }
        cards[i].classList.add('passed');
        lines.push(step.id === 'version' ? `  ✓ v${CURRENT} → v${version}` : '  ✓ ok');
        log.textContent = lines.join('\n');
        done.add(step.id);
      }
      lines.push('', `🚀 v${version} deployed to production · 17:59`);
      log.textContent = lines.join('\n');
      feedback.className = 'feedback ok';
      feedback.textContent = `🎉 Релиз выкачен за минуту до конца дня, ${playerName}!`; // текст, не innerHTML
      runBtn.remove();
      setTimeout(complete, 1200);
    };

    root.append(
      h('div', { class: 'label' }, 'Доступные шаги'), pool,
      h('div', { class: 'label' }, 'Релиз'), track,
      h('div', { class: 'mg-grid' },
        log,
        h('div', { class: 'side' },
          h('div', { class: 'release-version' },
            h('div', { class: 'label' }, `Новая версия · сейчас ${CURRENT}, добавили промокод`),
            versions,
            h('div', { class: 'release-semver' }, h('code', {}, 'major.minor.patch'), ' — ломающие изменения · новая функция · исправление'),
          ),
          feedback, runBtn,
        ),
      ),
    );
    render();
  },
};
