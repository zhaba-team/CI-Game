// База знаний на книжной полке open-space: у фиолетового маркера по E / 📚 или тапом / кликом по шкафу
// открывается модалка с терминами (quests/glossary.js), которые игрок уже узнал, и замками на будущие.
// Импортов нет: всё приходит аргументами из game.js, который проверяет полку после стола для пинг-понга,
// но раньше пуфиков и кофемашины.
const KB_RADIUS = 1.0;     // от spots.bookshelf: подсказка и E
const KB_TAP_RADIUS = 3.5; // тап / клик по шкафу работает с этого расстояния

// bookshelf — { group, hitTest } из world/bookshelf.js; spot — spots.bookshelf; marker — createQuestMarker;
// render(sections) → Node (ui/knowledgeBase.js); sections() — данные карточек по дням от game.js;
// markSeen(ids) — запомнить просмотренные открытые термины (state.js)
export function createKnowledgeBase({ bookshelf, spot, marker, camera, player, hud, openModal, render, sections, markSeen }) {
  marker.group.visible = true; // open-space открыт с первого дня — маркер виден всегда
  const dist = () => Math.hypot(player.position.x - spot.x, player.position.z - spot.z);
  const entries = (list) => list.flatMap((s) => s.entries);

  function open() {
    const list = sections();
    const all = entries(list);
    const opened = all.filter((e) => e.open);
    hud.setPrompt(null);
    openModal({
      title: '📚 База знаний',
      subtitle: `Открыто ${opened.length} из ${all.length}`,
      wide: true,
      body: render(list),
      actions: [{ label: 'Закрыть', primary: true }],
      onClose: () => markSeen(opened.map((e) => e.id)),
    });
  }

  return {
    // Подсказка у полки: { text, icon, action } или null
    check() {
      if (dist() > KB_RADIUS) return null;
      return { text: 'Открыть Базу знаний', icon: '📚', action: true };
    },
    // true, если действие обработано
    interact() {
      if (dist() > KB_RADIUS) return false;
      open();
      return true;
    },
    // ndc — точка тапа / клика на экране; true, если попали в шкаф
    tap(ndc) {
      if (!bookshelf.hitTest(ndc, camera)) return false;
      if (dist() > KB_TAP_RADIUS) hud.toast('Подойди к книжной полке поближе 📚');
      else open();
      return true;
    },
    // Открытые, но ещё не просмотренные термины
    newCount() {
      return entries(sections()).filter((e) => e.isNew).length;
    },
    update(time) {
      marker.update(time);
    },
    open,
  };
}
