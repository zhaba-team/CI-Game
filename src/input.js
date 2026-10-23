// Ввод: клавиатура, мышь (вращение камеры перетаскиванием), сенсорный стик и кнопка действия.
export function createInput(canvas) {
  const keys = new Set();
  const state = {
    enabled: false,
    move: { x: 0, y: 0 },     // x — вправо, y — вперёд; длина ≤ 1
    run: false,
    lookDelta: { x: 0, y: 0 }, // накопленное смещение для камеры (в пикселях)
    lastLookTime: -Infinity,
    isTouch: false,
  };
  const actionHandlers = new Set();
  const fireAction = () => { if (state.enabled) actionHandlers.forEach((fn) => fn()); };

  // ---------- Клавиатура ----------
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    keys.add(e.code);
    if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) fireAction();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // ---------- Мышь / тач-перетаскивание для обзора ----------
  let lookPointer = null;
  let last = { x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    if (lookPointer !== null) return;
    lookPointer = e.pointerId;
    last = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookPointer || !state.enabled) return;
    state.lookDelta.x += e.clientX - last.x;
    state.lookDelta.y += e.clientY - last.y;
    state.lastLookTime = performance.now();
    last = { x: e.clientX, y: e.clientY };
  });
  const endLook = (e) => { if (e.pointerId === lookPointer) lookPointer = null; };
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
