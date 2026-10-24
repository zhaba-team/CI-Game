// Коллекционные книги: необязательная активность — книги спрятаны по офису без маркеров,
// найденные показываются в коллекции 🏆 (ui/trophies.js). Чтобы добавить книгу — допишите запись в BOOKS
// и точку spots.<spot> в world/office.js. Схема: { id, title, author, cover, color, accent, spot, room, description }
//   id     — уникальный kebab-case;
//   cover  — импорт картинки обложки из src/assets/books/ (Vite отдаёт URL);
//   color  — цвет обложки 3D-модели, accent — цвет корешка (необязателен, по умолчанию color);
//   spot   — ключ в office.spots, где лежит книга: { x, y, z, rot }, y — высота поверхности;
//   room   — где искать, для подсказки на карточке ненайденной книги.
import cleanCodeCover from '../assets/books/clean-code.jpg';
import grokkingCover from '../assets/books/grokking-algorithms.jpg';
import cleanArchCover from '../assets/books/clean-architecture.jpg';
import ddiaCover from '../assets/books/designing-data-intensive.jpg';
import modernOsCover from '../assets/books/modern-os.jpg';

export const BOOKS = [
  {
    id: 'clean-code',
    title: 'Чистый код',
    author: 'Роберт Мартин',
    cover: cleanCodeCover,
    color: '#ffd600',
    spot: 'bookCleanCode',
    room: 'open-space',
    description: '«Библия» аккуратного программиста. Как называть переменные и функции так, чтобы код читался как текст, '
      + 'почему функции должны быть короткими и делать одну вещь, и как постепенно улучшать чужой запутанный код '
      + '(рефакторинг), ничего не сломав. Много примеров «было» и «стало».',
  },
  {
    id: 'grokking-algorithms',
    title: 'Грокаем алгоритмы',
    author: 'Адитья Бхаргава',
    cover: grokkingCover,
    color: '#f2efe6',
    accent: '#2b2d42',
    spot: 'bookGrokking',
    room: 'столовая',
    description: 'Самая дружелюбная книга про алгоритмы: с картинками и без страшной математики. Бинарный поиск, '
      + 'сортировки, рекурсия, графы, поиск кратчайшего пути и динамическое программирование — на понятных примерах '
      + 'и с объяснением, почему одни решения в тысячи раз быстрее других.',
  },
  {
    id: 'clean-architecture',
    title: 'Чистая архитектура',
    author: 'Роберт Мартин',
    cover: cleanArchCover,
    color: '#ffd600',
    accent: '#b3202a',
    spot: 'bookCleanArch',
    room: 'кабинет директора',
    description: 'Продолжение «Чистого кода», но уже про устройство всей программы. Как разделить проект на независимые '
      + 'слои, чтобы бизнес-логика не зависела от базы данных, фреймворка и интерфейса, и почему хорошая архитектура '
      + 'позволяет менять систему годами без боли.',
  },
  {
    id: 'designing-data-intensive',
    title: 'Высоконагруженные приложения',
    author: 'Мартин Клеппман',
    cover: ddiaCover,
    color: '#e8312f',
    spot: 'bookDdia',
    room: 'серверная',
    description: 'Книга о том, как устроены системы, которыми пользуются миллионы людей одновременно. Базы данных, '
      + 'репликация, шардирование, очереди сообщений и что делать, когда серверы падают, а данные должны остаться '
      + 'целыми. Настольная книга бэкенд-разработчиков и архитекторов.',
  },
  {
    id: 'modern-os',
    title: 'Современные операционные системы',
    author: 'Эндрю Таненбаум, Херберт Бос',
    cover: modernOsCover,
    color: '#1b1b1f',
    accent: '#d4a72c',
    spot: 'bookModernOs',
    room: 'Игровая',
    description: 'Классика computer science про то, что происходит «под капотом» компьютера. Процессы и потоки, '
      + 'управление памятью, файловые системы, драйверы и безопасность — как Windows, Linux и Android делят ресурсы '
      + 'между тысячами программ.',
  },
];

// Проверка данных при старте: ошибки — сразу, а не когда игрок найдёт книгу
export function validateBooks(spots) {
  const ids = new Set();
  for (const book of BOOKS) {
    const where = `Книга «${book.id}» в src/quests/books.js`;
    if (ids.has(book.id)) throw new Error(`${where}: повторяющийся id`);
    ids.add(book.id);
    if (!book.title?.trim()) throw new Error(`${where}: пустой title`);
    if (!book.description?.trim()) throw new Error(`${where}: пустой description`);
    if (!book.cover) throw new Error(`${where}: нет обложки cover`);
    if (!book.room?.trim()) throw new Error(`${where}: пустой room`);
    const spot = spots[book.spot];
    if (!spot) throw new Error(`${where}: нет точки spots.${book.spot} в world/office.js`);
    if (![spot.x, spot.y, spot.z].every(Number.isFinite)) throw new Error(`${where}: у spots.${book.spot} нет числовых x, y, z`);
  }
}
