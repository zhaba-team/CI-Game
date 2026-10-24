// Коллекционные книги: без маркера — вблизи книги подсказка «Взять книгу» по E / ✋ или тап / клик по самой книге.
// Подобранная книга исчезает из мира и открывается в коллекции 🏆 (ui/trophies.js).
// Импортов нет: всё приходит аргументами из game.js, который проверяет книги после стола для пинг-понга,
// но раньше Базы знаний и пуфиков.
const PICK_RADIUS = 1.1; // от spot книги: подсказка и E
const TAP_RADIUS = 3.5;  // тап / клик по книге работает с этого расстояния

// items — [{ book, mesh: { group, hitTest }, spot }] (quests/books.js, world/collectibleBook.js, office.spots);
// isFound(id) / markFound(id) / found() — state.js; render(cards) → Node (ui/trophies.js)
export function createCollectibles({ items, player, camera, hud, isFound, markFound, found, openModal, render }) {
  const dist = (item) => Math.hypot(player.position.x - item.spot.x, player.position.z - item.spot.z);
  const hidden = () => items.filter((item) => !isFound(item.book.id));

  // Ближайшая ненайденная книга в радиусе подбора или null
  function nearest() {
    let best = PICK_RADIUS;
    let near = null;
    for (const item of hidden()) {
      const d = dist(item);
      if (d < best) { best = d; near = item; }
    }
    return near;
  }

  function pickUp(item) {
    markFound(item.book.id); // onChange → game.js вызовет sync() и обновит бейдж
    item.mesh.group.visible = false;
    const count = found().length;
    console.debug('[books] picked', item.book.id, `${count}/${items.length}`);
    hud.toast(`📖 Найдена книга «${item.book.title}»! Загляни в коллекцию 🏆`, 'quest');
    if (count === items.length) hud.toast('Все книги собраны — настоящий книжный червь! 🏆', 'quest');
  }

  function open() {
    const cards = items.map(({ book }) => ({ ...book, found: isFound(book.id) }));
    const count = cards.filter((c) => c.found).length;
    console.debug('[books] collection opened', count);
    hud.setPrompt(null);
    openModal({
      title: '🏆 Коллекция книг',
      subtitle: `Найдено ${count} из ${items.length}`,
      wide: true,
      body: render(cards),
      actions: [{ label: 'Закрыть', primary: true }],
    });
  }

  return {
    // Показать на местах только ненайденные книги (старт, «Новая игра», подбор)
    sync() {
      for (const item of items) item.mesh.group.visible = !isFound(item.book.id);
    },
    // Подсказка у книги: { text, icon, action } или null. Название не раскрываем — сюрприз в тосте
    check() {
      return nearest() ? { text: 'Взять книгу', icon: '✋', action: true } : null;
    },
    // true, если книгу подобрали
    interact() {
      const item = nearest();
      if (!item) return false;
      pickUp(item);
      return true;
    },
    // ndc — точка тапа / клика на экране; true, если попали в ненайденную книгу.
    // Raycaster не проверяет видимость, поэтому найденные книги отсекаем по состоянию
    tap(ndc) {
      const item = hidden().find((it) => it.mesh.hitTest(ndc, camera));
      if (!item) return false;
      if (dist(item) > TAP_RADIUS) hud.toast('Подойди поближе 📖');
      else pickUp(item);
      return true;
    },
    // Отладка: подобрать книгу по id без подхода
    pickById(id) {
      const item = hidden().find((it) => it.book.id === id);
      if (item) pickUp(item);
    },
    open,
  };
}
