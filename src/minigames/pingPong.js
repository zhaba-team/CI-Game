// Мини-игра «Пинг-понг»: матч до 5 очков против NPC на столе с видом сверху (2D canvas, реальное время).
// Не квест: ctx.opponent = { name, role, skill, greet, win, lose } — тексты уже с никнеймом;
// complete({ player, rival, won }) вызывается только кнопкой «Закончить».
import { h } from '../ui/dom.js';

const W = 300;            // логическое поле: вид сверху, игрок снизу
const H = 540;
const PAD_W = 60;
const PAD_H = 10;
const PLAYER_Y = H - 34;  // центр ракетки игрока
const RIVAL_Y = 34;
const BALL_R = 6;
const STEP = 1 / 120;     // фиксированный шаг физики
const SERVE_SPEED = 260;
const SPEED_UP = 1.06;    // ускорение после каждого отбивания
const MAX_SPEED = 560;
const MAX_ANGLE = Math.PI / 3; // ±60° — от точки попадания по ракетке
const KEY_SPEED = 420;    // ракетка игрока с клавиатуры, ед/с
const POINTER_SPEED = 1400;
const WIN_SCORE = 5;
const POINT_PAUSE = 0.8;
const COLORS = { table: '#1f5fa8', line: '#f4f4f2', net: '#dfe7e1', ball: '#ff9f1c', player: '#d62828', rival: '#1b1b1f' };
const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const RIGHT_KEYS = ['ArrowRight', 'KeyD'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default {
  id: 'ping-pong',
  title: 'Пинг-понг',
  mount(root, { opponent, complete }) {
    const { skill } = opponent;
    const botSpeed = 120 + skill * 260;
    const botMiss = (1 - skill) * 40;
    const botDelay = (1 - skill) * 0.25;

    // ---------- Разметка ----------
    const playerScore = h('b', {}, '0');
    const rivalScore = h('b', {}, '0');
    const pauseBtn = h('button', { class: 'btn pp-pause', 'aria-label': 'Пауза', onclick: () => setPaused(phase !== 'paused') }, '⏸');
    const canvas = h('canvas', { class: 'pp-canvas', 'aria-label': `Стол для пинг-понга: ты снизу, ${opponent.name} сверху` });
    const overlay = h('div', { class: 'pp-overlay' });
    root.append(h('div', { class: 'pingpong' },
      h('div', { class: 'pp-head' },
        h('div', { class: 'pp-score' }, h('span', {}, 'Ты'), playerScore, ':', rivalScore, h('span', {}, opponent.name)),
        pauseBtn,
      ),
      h('div', { class: 'pp-stage' }, canvas, overlay),
      h('div', { class: 'pp-hint' }, 'Веди мышью или пальцем, на клавиатуре — стрелки или A / D'),
    ));
    const pen = canvas.getContext('2d');

    // ---------- Состояние матча ----------
    let phase = 'start'; // start · play · point · paused · over
    let resumeTo = 'play';
    let score = { player: 0, rival: 0 };
    let result = null;
    let finished = false;
    let px = W / 2;
    let rx = W / 2;
    let pointerX = null;
    const keys = { left: false, right: false };
    const ball = { x: W / 2, y: PLAYER_Y - 20, vx: 0, vy: 0, speed: SERVE_SPEED };
    let aim = 0;       // ошибка прицела бота, пересчитывается на каждом отбивании
    let botWait = 0;   // задержка реакции бота после отбивания игрока
    let pointTimer = 0;
    let server = 'player';

    // Мяч у ракетки подающего, летит к сопернику под небольшим случайным углом
    function serve() {
      const angle = (Math.random() * 2 - 1) * 0.35;
      const dir = server === 'player' ? -1 : 1;
      ball.speed = SERVE_SPEED;
      ball.x = server === 'player' ? px : rx;
      ball.y = server === 'player' ? PLAYER_Y - 20 : RIVAL_Y + 20;
      ball.vx = ball.speed * Math.sin(angle);
      ball.vy = dir * ball.speed * Math.cos(angle);
      aim = (Math.random() * 2 - 1) * botMiss;
      botWait = server === 'player' ? botDelay : 0;
    }

    function resetMatch() {
      score = { player: 0, rival: 0 };
      result = null;
      server = 'player';
      px = W / 2;
      rx = W / 2;
      renderScore();
      serve();
      phase = 'play';
      overlay.replaceChildren();
      overlay.hidden = true;
    }

    function renderScore() {
      playerScore.textContent = String(score.player);
      rivalScore.textContent = String(score.rival);
    }

    // ---------- Экраны поверх стола ----------
    function showOverlay(...children) {
      overlay.replaceChildren(h('div', { class: 'pp-card' }, ...children));
      overlay.hidden = false;
      overlay.querySelector('.primary')?.focus({ preventScroll: true });
    }

    function showStart() {
      showOverlay(
        h('p', {}, opponent.greet),
        h('button', { class: 'btn primary', onclick: resetMatch }, 'Начать'),
      );
    }

    function showResult() {
      const won = score.player > score.rival;
      result = { player: score.player, rival: score.rival, won };
      showOverlay(
        h('div', { class: `pp-result${won ? ' won' : ''}` }, won ? `Победа! ${score.player}:${score.rival}` : `Поражение ${score.player}:${score.rival}`),
        h('p', {}, won ? opponent.win : opponent.lose),
        h('div', { class: 'pp-actions' },
          h('button', { class: 'btn', onclick: resetMatch }, 'Ещё партию'),
          h('button', { class: 'btn primary', onclick: finish }, 'Закончить'),
        ),
      );
    }

    function setPaused(on) {
      if (on && (phase === 'play' || phase === 'point')) {
        resumeTo = phase;
        phase = 'paused';
        showOverlay(
          h('p', {}, 'Пауза'),
          h('button', { class: 'btn primary', onclick: () => setPaused(false) }, 'Продолжить'),
        );
      } else if (!on && phase === 'paused') {
        phase = resumeTo;
        overlay.hidden = true;
      }
      pauseBtn.textContent = phase === 'paused' ? '▶' : '⏸';
      pauseBtn.setAttribute('aria-label', phase === 'paused' ? 'Продолжить' : 'Пауза');
    }

    function finish() {
      if (finished || !result) return;
      finished = true;
      complete(result);
    }

    // ---------- Физика ----------
    // Отскок от ракетки: угол зависит от того, насколько далеко от центра попал мяч
    function bounce(padX, dir) {
      const offset = clamp((ball.x - padX) / (PAD_W / 2 + BALL_R), -1, 1);
      const angle = offset * MAX_ANGLE;
      ball.speed = Math.min(ball.speed * SPEED_UP, MAX_SPEED);
      ball.vx = ball.speed * Math.sin(angle);
      ball.vy = dir * ball.speed * Math.cos(angle);
    }

    function scorePoint(winner) {
      score[winner] += 1;
      renderScore();
      server = winner === 'player' ? 'rival' : 'player'; // подаёт проигравший очко
      if (score[winner] >= WIN_SCORE) {
        phase = 'over';
        showResult();
        return;
      }
      phase = 'point';
      pointTimer = POINT_PAUSE;
    }

    function movePlayer(dt) {
      if (keys.left || keys.right) {
        px += ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * KEY_SPEED * dt;
      } else if (pointerX !== null) {
        const d = pointerX - px;
        px += clamp(d, -POINTER_SPEED * dt, POINTER_SPEED * dt);
      }
      px = clamp(px, PAD_W / 2, W - PAD_W / 2);
    }

    // Бот: к мячу, когда тот летит к нему (с ошибкой прицела и задержкой), иначе — к центру
    function moveBot(dt) {
      if (botWait > 0) { botWait -= dt; return; }
      const target = ball.vy < 0 ? ball.x + aim : W / 2;
      rx += clamp(target - rx, -botSpeed * dt, botSpeed * dt);
      rx = clamp(rx, PAD_W / 2, W - PAD_W / 2);
    }

    function step(dt) {
      movePlayer(dt);
      if (phase === 'point') {
        moveBot(dt);
        pointTimer -= dt;
        if (pointTimer <= 0) { serve(); phase = 'play'; }
        return;
      }
      moveBot(dt);
      const prevY = ball.y;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }

      const playerFace = PLAYER_Y - PAD_H / 2;
      if (ball.vy > 0 && prevY + BALL_R <= playerFace && ball.y + BALL_R >= playerFace && Math.abs(ball.x - px) <= PAD_W / 2 + BALL_R) {
        ball.y = playerFace - BALL_R;
        bounce(px, -1);
        aim = (Math.random() * 2 - 1) * botMiss;
        botWait = botDelay;
      }
      const rivalFace = RIVAL_Y + PAD_H / 2;
      if (ball.vy < 0 && prevY - BALL_R >= rivalFace && ball.y - BALL_R <= rivalFace && Math.abs(ball.x - rx) <= PAD_W / 2 + BALL_R) {
        ball.y = rivalFace + BALL_R;
        bounce(rx, 1);
      }
      if (ball.y > H + BALL_R) scorePoint('rival');
      else if (ball.y < -BALL_R) scorePoint('player');
    }

    // ---------- Отрисовка ----------
    let backingW = 0;
    function fit() {
      const cssW = canvas.clientWidth;
      if (!cssW || cssW === backingW) return;
      backingW = cssW;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssW * (H / W) * dpr);
      pen.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    }

    function paddle(x, y, color) {
      pen.fillStyle = color;
      pen.beginPath();
      pen.roundRect(x - PAD_W / 2, y - PAD_H / 2, PAD_W, PAD_H, PAD_H / 2);
      pen.fill();
    }

    function draw() {
      pen.fillStyle = COLORS.table;
      pen.fillRect(0, 0, W, H);
      pen.strokeStyle = COLORS.line;
      pen.lineWidth = 4;
      pen.strokeRect(2, 2, W - 4, H - 4);
      pen.lineWidth = 1.5;
      pen.beginPath();
      pen.moveTo(W / 2, 0);
      pen.lineTo(W / 2, H);
      pen.stroke();
      pen.fillStyle = COLORS.net;
      pen.fillRect(0, H / 2 - 2, W, 4);
      paddle(rx, RIVAL_Y, COLORS.rival);
      paddle(px, PLAYER_Y, COLORS.player);
      if (phase === 'play' || phase === 'paused') {
        pen.fillStyle = 'rgba(0, 0, 0, 0.25)';
        pen.beginPath();
        pen.arc(ball.x + 3, ball.y + 4, BALL_R, 0, Math.PI * 2);
        pen.fill();
        pen.fillStyle = COLORS.ball;
        pen.beginPath();
        pen.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
        pen.fill();
      }
    }

    // ---------- Ввод и жизненный цикл ----------
    const abort = new AbortController();
    const { signal } = abort;
    const pointerAt = (e) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / rect.width) * W;
    };
    canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture?.(e.pointerId); pointerAt(e); }, { signal });
    canvas.addEventListener('pointermove', pointerAt, { signal });
    const onKey = (down) => (e) => {
      const left = LEFT_KEYS.includes(e.code);
      const right = RIGHT_KEYS.includes(e.code);
      if (!left && !right) return;
      e.preventDefault();
      if (left) keys.left = down;
      if (right) keys.right = down;
      if (down) pointerX = null;
    };
    window.addEventListener('keydown', onKey(true), { signal });
    window.addEventListener('keyup', onKey(false), { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); }, { signal });

    let last = performance.now();
    let acc = 0;
    function frame(now) {
      if (!root.isConnected) { abort.abort(); return; } // модалка закрыта — слушатели сняты, цикл остановлен
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (phase === 'play' || phase === 'point') {
        acc += dt;
        while (acc >= STEP) { step(STEP); acc -= STEP; }
      } else {
        acc = 0;
      }
      fit();
      draw();
      requestAnimationFrame(frame);
    }

    showStart();
    requestAnimationFrame(frame);
  },
};
