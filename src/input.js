// Ввод: клавиатура, мышь (на десктопе — захват курсора, иначе вращение камеры перетаскиванием),
// сенсорный стик и кнопка действия. Тап / клик по сцене (onTap) — для предметов, по которым можно ткнуть.
const TAP_MOVE = 10;  // px: палец сдвинулся сильнее — это поворот камеры, а не тап
const TAP_TIME = 350; // мс: дольше — тоже не тап

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    enabled: false,
    move: { x: 0, y: 0 },     // x — вправо, y — вперёд; длина ≤ 1
    run: false,
    lookDelta: { x: 0, y: 0 }, // накопленное смещение для камеры (в пикселях)
    lastLookTime: -Infinity,
    isTouch: false,
    pointerLocked: false,    // курсор захвачен канвасом (десктоп)
  };
  const actionHandlers = new Set();
  const fireAction = () => { if (state.enabled) actionHandlers.forEach((fn) => fn()); };
  const tapHandlers = new Set();
  // ndc — точка экрана в координатах -1..1, y вверх
  const fireTap = (ndc) => { if (state.enabled && running) tapHandlers.forEach((fn) => fn(ndc)); };

  // ---------- Клавиатура ----------
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    keys.add(e.code);
    if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) fireAction();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // ---------- Захват курсора (десктоп): камера следует за мышью без нажатия ----------
  // Режим мыши — только с точным указателем и без тача; Esc (браузер) освобождает курсор
  let mouseMode = !window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(pointer: fine)').matches;
  let running = false; // игра запущена — захват имеет смысл
  const lockHandlers = new Set();
  const isLocked = () => document.pointerLockElement === canvas;
  const lockPointer = () => {
    if (!mouseMode || !running || !state.enabled || isLocked() || !canvas.requestPointerLock) return;
    try {
      // Отказ браузера (нет жеста пользователя, кулдаун после Esc) не ошибка — останется подсказка
      canvas.requestPointerLock()?.catch?.(() => {});
    } catch { /* старые браузеры бросают синхронно */ }
  };
  const unlockPointer = () => { if (isLocked()) document.exitPointerLock(); };
  document.addEventListener('pointerlockchange', () => {
    state.pointerLocked = isLocked();
    lookPointer = null;
    lockHandlers.forEach((fn) => fn(state.pointerLocked));
  });
  document.addEventListener('mousemove', (e) => {
    if (!isLocked() || !state.enabled) return;
    state.lookDelta.x += e.movementX;
    state.lookDelta.y += e.movementY;
    state.lastLookTime = performance.now();
  });

  // ---------- Мышь / тач-перетаскивание для обзора (фолбэк, пока курсор не захвачен) ----------
  // Тап — короткое касание без сдвига. Мышь в mouseMode тапом не считается: её клик — захват курсора
  let lookPointer = null;
  let last = { x: 0, y: 0 };
  let tap = null; // { x, y, time, moved } — начало касания, пока оно может оказаться тапом
  canvas.addEventListener('pointerdown', (e) => {
    const lockingMouse = e.pointerType === 'mouse' && mouseMode;
    if (lockingMouse && isLocked()) { fireTap({ x: 0, y: 0 }); return; } // курсор захвачен — клик туда, куда смотрит камера
    if (lockingMouse) lockPointer(); // клик — захват, без fireAction
    if (lookPointer !== null || isLocked()) return;
    lookPointer = e.pointerId;
    last = { x: e.clientX, y: e.clientY };
    tap = lockingMouse ? null : { x: e.clientX, y: e.clientY, time: performance.now(), moved: 0 };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch { /* пока ждём ответа на захват курсора, браузер не даёт pointer capture — перетаскивание работает и без него */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookPointer || !state.enabled) return;
    state.lookDelta.x += e.clientX - last.x;
    state.lookDelta.y += e.clientY - last.y;
    state.lastLookTime = performance.now();
    last = { x: e.clientX, y: e.clientY };
    if (tap) tap.moved = Math.max(tap.moved, Math.hypot(e.clientX - tap.x, e.clientY - tap.y));
  });
  const endLook = (e) => {
    if (e.pointerId !== lookPointer) return;
    lookPointer = null;
    const start = tap;
    tap = null;
    if (e.type !== 'pointerup' || !start) return;
    if (start.moved > TAP_MOVE || performance.now() - start.time > TAP_TIME) return;
    const r = canvas.getBoundingClientRect();
    fireTap({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 });
  };
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);

  // ---------- Сенсорный стик ----------
  const touchRoot = document.getElementById('touch');
  const stick = document.getElementById('joystick');
  const knob = document.getElementById('joystick-knob');
  const actionBtn = document.getElementById('action-btn');
  const stickMove = { x: 0, y: 0 };
  let stickPointer = null;

  const enableTouchUI = () => {
    if (state.isTouch) return;
    state.isTouch = true;
    mouseMode = false;
    unlockPointer();
    touchRoot.classList.remove('hidden');
    document.body.classList.add('touch');
  };
  window.addEventListener('touchstart', enableTouchUI, { passive: true, once: true });
  if (window.matchMedia('(pointer: coarse)').matches) enableTouchUI();

  const updateStick = (e) => {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const max = r.width / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    stickMove.x = dx / max;
    stickMove.y = -dy / max;
  };
  stick.addEventListener('pointerdown', (e) => {
    stickPointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    updateStick(e);
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickPointer) updateStick(e); });
  const endStick = (e) => {
    if (e.pointerId !== stickPointer) return;
    stickPointer = null;
    stickMove.x = 0;
    stickMove.y = 0;
    knob.style.transform = '';
  };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
  actionBtn.addEventListener('click', fireAction);

  return {
    state,
    onAction(fn) { actionHandlers.add(fn); },
    // fn({ x, y }) — тап / клик по сцене в координатах экрана -1..1 (при захвате курсора — центр экрана)
    onTap(fn) { tapHandlers.add(fn); },
    get mouseMode() { return mouseMode; },
    // Игра запущена / остановлена: вне игры курсор не захватываем
    setRunning(value) {
      running = value;
      if (!running) unlockPointer();
    },
    lockPointer,
    unlockPointer,
    onPointerLockChange(fn) { lockHandlers.add(fn); },
    setActionVisible(visible, label = '💬') {
      actionBtn.classList.toggle('hidden', !visible);
      actionBtn.textContent = label;
    },
    setEnabled(enabled) {
      state.enabled = enabled;
      if (!enabled) {
        keys.clear();
        state.lookDelta.x = state.lookDelta.y = 0;
      }
    },
    // Вызывается каждый кадр: собирает итоговый вектор движения
    update() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      x += stickMove.x;
      y += stickMove.y;
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      if (!state.enabled) { x = 0; y = 0; }
      state.move.x = x;
      state.move.y = y;
      state.run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(stickMove.x, stickMove.y) > 0.95;
    },
    consumeLook() {
      const d = { ...state.lookDelta };
      state.lookDelta.x = state.lookDelta.y = 0;
      return d;
    },
  };
}
