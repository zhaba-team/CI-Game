// Мини-игра «Настрой инфраструктуру»: после пожара выбрать в конфиге service.yml стабильную версию,
// число реплик, лимит памяти и health-check, затем применить конфиг.
import { h } from '../ui/dom.js';

// У каждого параметра: варианты, правильный ответ и объяснения ошибок. start — что выкатил Егор.
const PARAMS = [
  {
    key: 'image',
    options: ['neurocuber:0.0.1-beta', 'shop:1.4.2'],
    answer: 'shop:1.4.2',
    start: 'neurocuber:0.0.1-beta',
    hints: {
      'neurocuber:0.0.1-beta': 'neurocuber:0.0.1-beta — непроверенный код без ревью и тестов, он и устроил пожар. При аварии откатываются на последнюю стабильную версию.',
    },
  },
  {
    key: 'replicas',
    options: ['0', '3', '100'],
    answer: '3',
    start: '100',
    hints: {
      0: '0 реплик — значит, не запущено ни одной копии сайта: сайт лежит.',
      100: '100 копий на три стойки — сервера перегреются и снова загорятся. Хватит трёх: если одна упадёт, две другие удержат нагрузку.',
    },
  },
  {
    key: 'memory',
    options: ['без лимита', '512Mi'],
    answer: '512Mi',
    start: 'без лимита',
    hints: {
      'без лимита': 'Без лимита памяти один зависший процесс съест всю память сервера и уронит соседей. Поставь лимит.',
    },
  },
  {
    key: 'healthcheck',
    options: ['off', 'on'],
    answer: 'on',
    start: 'off',
    hints: {
      off: 'Без health-check никто не заметит, что сервис упал. Проверка здоровья сама найдёт и перезапустит упавшую копию.',
    },
  },
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default {
  id: 'infra-config',
  title: 'Настрой инфраструктуру',
  mount(root, { playerName, complete }) {
    const picked = Object.fromEntries(PARAMS.map((p) => [p.key, p.start]));
    let running = false;
    let done = false;

    const log = h('pre', { class: 'terminal' }, '$ ожидаю новый конфиг…');
    const feedback = h('div', { class: 'feedback' }, 'Егор выкатил свой конфиг — и серверы загорелись. Нажимай на варианты, чтобы исправить каждую строку, а потом нажми «Применить».');
    const applyBtn = h('button', { class: 'btn primary', onclick: () => apply() }, '▶ Применить');
    const lines = h('div', { class: 'code' });

    const render = () => {
      lines.replaceChildren(...PARAMS.flatMap((p, i) => [
        h('div', { class: 'code-line' },
          h('span', { class: 'ln' }, i + 1),
          h('span', {}, h('span', { class: 'tok-prop' }, `${p.key}: `), h('span', { class: 'tok-val' }, picked[p.key])),
        ),
        h('div', { class: 'infra-chips' }, p.options.map((o) => h('button', {
          class: `chip${picked[p.key] === o ? ' selected' : ''}`,
          disabled: running || done,
          onclick: () => { picked[p.key] = o; render(); },
        }, o))),
      ]));
      applyBtn.disabled = running || done;
    };

    const apply = async () => {
      running = true;
      render();
      feedback.className = 'feedback';
      feedback.textContent = 'Применяю конфиг…';
      const out = ['$ kubectl apply -f service.yml'];
      log.textContent = out.join('\n');
      for (const p of PARAMS) {
        await wait(320);
        const ok = picked[p.key] === p.answer;
        out.push(`  ${ok ? '✓' : '✗'} ${p.key}: ${picked[p.key]}`);
        log.textContent = out.join('\n');
        if (ok) continue;
        out.push('', '🔴 Конфиг отклонён');
        log.textContent = out.join('\n');
        feedback.className = 'feedback warn';
        feedback.textContent = `${p.hints[picked[p.key]]} Исправь строку и попробуй снова.`;
        running = false;
        applyBtn.textContent = '↻ Применить ещё раз';
        render();
        return;
      }
      out.push('', '✓ 3/3 instances running · health: OK');
      log.textContent = out.join('\n');
      done = true;
      running = false;
      feedback.className = 'feedback ok';
      feedback.textContent = `🎉 Серверы снова в строю, ${playerName}! Стабильная версия, три реплики, лимит памяти и проверка здоровья.`;
      render();
      setTimeout(complete, 900);
    };

    root.append(
      h('div', { class: 'mg-grid' },
        h('div', {},
          h('div', { class: 'editor infra-editor' }, h('div', { class: 'editor-tab' }, 'service.yml'), lines),
        ),
        h('div', { class: 'side' }, log, feedback, applyBtn),
      ),
    );
    render();
  },
};
