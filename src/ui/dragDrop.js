// Перетаскивание карточек на Pointer Events: работает и мышью, и пальцем (HTML5 Drag and Drop на тач-экранах не работает).
// Клик без сдвига остаётся обычным кликом — запасной способ для тех, кому неудобно тащить.

const zones = new WeakMap(); // элемент-зона → payload, который получит onDrop
const START_DISTANCE = 6; // px: меньший сдвиг — это ещё клик, а не перетаскивание

// Пометить элемент как место, куда можно бросить карточку.
export function dropZone(el, payload) {
  zones.set(el, payload);
  el.dataset.drop = '';
  return el;
}

function zoneAt(x, y) {
  let el = document.elementFromPoint(x, y)?.closest('[data-drop]');
  while (el && !zones.has(el)) el = el.parentElement?.closest('[data-drop]');
  return el ?? null;
}

// Гасит один клик сразу после перетаскивания, чтобы бросок не сработал ещё и как нажатие.
function swallowNextClick() {
  const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
}

/**
 * @param {HTMLElement} el
 * @param {object} o
 * @param {*} o.data                      — что перетаскиваем (передаётся в onDrop)
 * @param {Function} [o.canDrag]          — false: перетаскивание сейчас запрещено
 * @param {Function} o.onDrop             — onDrop(data, payload зоны); вне зоны карточка просто возвращается
 */
export function makeDraggable(el, { data, canDrag = () => true, onDrop }) {
  el.classList.add('draggable');
  el.addEventListener('pointerdown', (down) => {
    if (down.button !== 0 || el.disabled || !canDrag()) return;
    const startX = down.clientX;
    const startY = down.clientY;
    const rect = el.getBoundingClientRect();
    let ghost = null;
    let hover = null;

    const setHover = (zone) => {
      if (zone === hover) return;
      hover?.classList.remove('drop-hover');
      hover = zone;
      hover?.classList.add('drop-hover');
    };

    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('keydown', key, true);
      setHover(null);
      ghost?.remove();
      el.classList.remove('dragging');
    };

    const start = () => {
      ghost = el.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.classList.remove('dragging');
      Object.assign(ghost.style, { width: `${rect.width}px`, height: `${rect.height}px`, left: `${rect.left}px`, top: `${rect.top}px` });
      document.body.append(ghost);
      el.classList.add('dragging');
    };

    function move(e) {
      if (e.pointerId !== down.pointerId) return;
      // Окно закрыли посреди перетаскивания — карточки уже нет в DOM
      if (!el.isConnected) { finish(); return; }
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!ghost) {
        if (Math.hypot(dx, dy) < START_DISTANCE || !canDrag()) return;
        start();
      }
      e.preventDefault();
      ghost.style.transform = `translate(${dx}px, ${dy}px) rotate(-3deg)`;
      setHover(zoneAt(e.clientX, e.clientY));
    }

    function up(e) {
      if (e.pointerId !== down.pointerId) return;
      const dragged = Boolean(ghost);
      const zone = dragged ? zoneAt(e.clientX, e.clientY) : null;
      finish();
      if (!dragged) return; // обычный клик — его обработает onclick
      swallowNextClick();
      if (zone && el.isConnected && canDrag()) onDrop(data, zones.get(zone));
    }

    function key(e) {
      if (e.key === 'Escape') finish();
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('keydown', key, true);
  });
  return el;
}
