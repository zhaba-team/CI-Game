// База знаний на книжной полке open-space: термины и роли, которые игрок узнаёт по ходу стажировки.
// Чтобы добавить термин — допишите запись в GLOSSARY. Схема: { id, emoji, term, text, quest }
//   id    — уникальный kebab-case;
//   quest — id квеста из quests.js: термин открывается, когда квест выполнен; null — открыт с самого начала;
//   text  — 1–2 простых предложения на «ты», не длиннее TEXT_MAX символов.
// Порядок в массиве = порядок карточек внутри дня (день берётся из квеста, см. quests/days.js).
const TEXT_MAX = 160;

export const GLOSSARY = [
  // ---------- Старт ----------
  { id: 'programmer', emoji: '👩‍💻', term: 'Программист', quest: null,
    text: 'Пишет инструкции для компьютера на языках программирования: JavaScript, Python и других.' },
  { id: 'intern', emoji: '🎓', term: 'Стажёр', quest: null,
    text: 'Новичок в команде: учится на настоящих задачах, а опытные коллеги помогают.' },

  // ---------- Покрасить кнопку ----------
  { id: 'manager', emoji: '📋', term: 'Менеджер проекта', quest: 'paint-button',
    text: 'Следит за задачами и сроками и общается с клиентом.' },
  { id: 'frontend', emoji: '🎨', term: 'Frontend', quest: 'paint-button',
    text: 'То, что пользователь видит на сайте: кнопки, тексты, картинки.' },
  { id: 'css', emoji: '🖌️', term: 'CSS', quest: 'paint-button',
    text: 'Язык, которым задают внешний вид страницы: цвета, размеры, скругления (border-radius).' },
  { id: 'hex-color', emoji: '#️⃣', term: 'Hex-цвет', quest: 'paint-button',
    text: 'Цвет, записанный кодом вроде #2E9E5B: сколько в нём красного, зелёного и синего.' },

  // ---------- Найти баг ----------
  { id: 'teamlead', emoji: '🧭', term: 'Тимлид', quest: 'find-bug',
    text: 'Опытный разработчик, который ведёт команду: раздаёт задачи, проверяет код и помогает новичкам.' },
  { id: 'bug', emoji: '🐞', term: 'Баг', quest: 'find-bug',
    text: 'Ошибка, из-за которой программа работает не так, как задумано.' },
  { id: 'autotest', emoji: '✅', term: 'Автотест', quest: 'find-bug',
    text: 'Маленькая программа, которая проверяет другую: «при таких данных ответ должен быть таким».' },
  { id: 'debugging', emoji: '🔍', term: 'Отладка', quest: 'find-bug',
    text: 'Поиск и исправление бага: сравниваешь ожидаемое с полученным и ищешь, где ошибка.' },
  { id: 'code-review', emoji: '👀', term: 'Код-ревью', quest: 'find-bug',
    text: 'Коллега читает твой код перед тем, как его примут, и ищет ошибки.' },

  // ---------- Приветствие ----------
  { id: 'cto', emoji: '🏢', term: 'Технический директор', quest: 'greeting',
    text: 'Решает, какие технологии использовать и что делать команде, и отвечает за результат.' },
  { id: 'variable', emoji: '📦', term: 'Переменная', quest: 'greeting',
    text: '«Коробка» с именем, где программа хранит значение, например твой никнейм.' },
  { id: 'string', emoji: '💬', term: 'Строка', quest: 'greeting',
    text: 'Текст в кавычках: "Привет". Строки склеивают знаком +.' },

  // ---------- Пайплайн ----------
  { id: 'devops', emoji: '⚙️', term: 'DevOps-инженер', quest: 'pipeline',
    text: 'Настраивает серверы и автоматику, чтобы код быстро и надёжно доходил до пользователей.' },
  { id: 'server', emoji: '🖥️', term: 'Сервер', quest: 'pipeline',
    text: 'Компьютер в дата-центре, который круглосуточно отдаёт сайт пользователям.' },
  { id: 'pipeline', emoji: '🔁', term: 'CI/CD-пайплайн', quest: 'pipeline',
    text: 'Конвейер: сам скачивает код, гоняет тесты, собирает и выкладывает на сервер.' },
  { id: 'deploy', emoji: '🚀', term: 'Деплой', quest: 'pipeline',
    text: 'Выкладка новой версии программы на сервер.' },

  // ---------- Нейрокубер ----------
  { id: 'production', emoji: '🌐', term: 'Продакшен', quest: 'neurocuber',
    text: '«Боевая» версия сайта, которой пользуются настоящие люди. Ломать её нельзя.' },
  { id: 'config', emoji: '📝', term: 'Конфиг', quest: 'neurocuber',
    text: 'Файл с настройками: какую версию запустить и сколько памяти дать.' },
  { id: 'replica', emoji: '👯', term: 'Реплика', quest: 'neurocuber',
    text: 'Копия сервиса: упадёт одна — остальные продолжат работать.' },
  { id: 'health-check', emoji: '❤️', term: 'Health-check', quest: 'neurocuber',
    text: 'Регулярная проверка «ты жив?». Сервис не отвечает — его перезапускают.' },
  { id: 'rollback', emoji: '⏪', term: 'Откат', quest: 'neurocuber',
    text: 'Возврат к прошлой стабильной версии, если новая сломалась.' },

  // ---------- Пятничный релиз ----------
  { id: 'release', emoji: '📦', term: 'Релиз', quest: 'friday-release',
    text: 'Выпуск новой версии продукта для пользователей.' },
  { id: 'semver', emoji: '🔢', term: 'SemVer', quest: 'friday-release',
    text: 'Номер версии major.minor.patch: починили баг — растёт patch, новая функция — minor, сломали совместимость — major.' },
  { id: 'hotfix', emoji: '🚑', term: 'Хотфикс', quest: 'friday-release',
    text: 'Срочное исправление ошибки, которую нашли прямо перед релизом или после него.' },
  { id: 'rollback-plan', emoji: '🛟', term: 'План отката', quest: 'friday-release',
    text: 'Заранее готовый способ быстро вернуть старую версию, если релиз сломается.' },
];

// Ошибки в данных ловим при старте игры; quests — массив QUESTS из quests.js
export function validateGlossary(quests) {
  const ids = new Set();
  for (const entry of GLOSSARY) {
    const where = `Термин «${entry.id}» в src/quests/glossary.js`;
    if (ids.has(entry.id)) throw new Error(`${where}: повторяющийся id`);
    ids.add(entry.id);
    if (entry.quest !== null && !quests.some((q) => q.id === entry.quest)) throw new Error(`${where}: нет квеста «${entry.quest}» в quests.js`);
    if (!entry.term?.trim()) throw new Error(`${where}: пустой term`);
    if (!entry.text?.trim()) throw new Error(`${where}: пустой text`);
    if (entry.text.length > TEXT_MAX) throw new Error(`${where}: text длиннее ${TEXT_MAX} символов (${entry.text.length})`);
  }
}
