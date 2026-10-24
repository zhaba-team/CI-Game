// Интерактивные предметы офиса: пуфики (сесть / встать) и кофемашина (сварить и выпить раф).
// Импортов нет: мир, игрок, HUD и ввод приходят аргументами из game.js,
// который сначала проверяет маркеры, огонь, выход и NPC, а предметы — в последнюю очередь.
const SEAT_RADIUS = 1.0;   // от центра пуфика
const COFFEE_RADIUS = 1.2; // от spots.coffee
const STAND_UP_MOVE = 0.5; // сидя: стик / WASD сильнее этого — встать

// handsFree() — false, пока в руке предмет квеста (огнетушитель)
export function createProps({ seats, coffee, coffeeSpot, player, hud, input, handsFree }) {
  const dist = (x, z) => Math.hypot(player.position.x - x, player.position.z - z);

  // Ближайший пуфик в радиусе или null
  const nearSeat = () => {
    let best = SEAT_RADIUS;
    let found = null;
    for (const seat of seats) {
      const d = dist(seat.x, seat.z);
      if (d < best) { best = d; found = seat; }
    }
    return found;
  };
  const nearCoffee = () => dist(coffeeSpot.x, coffeeSpot.z) < COFFEE_RADIUS;

  function brewCoffee() {
    if (coffee.busy || player.seated) return;
    player.setFrozen(true);
    coffee.play(player, () => {
      player.endShowcase();
      player.setFrozen(false);
      hud.toast('☕ Лавандовый раф выпит — бодрость на весь рабочий день!');
    });
    player.startShowcase(); // после play: игрок уже развёрнут к машине — камера сбоку, видно, как он пьёт
  }

  return {
    get busy() { return coffee.busy; },
    get holdsItem() { return coffee.holdsCup; },
    update(dt, time) {
      coffee.update(dt, time);
      const { move } = input.state;
      if (player.seated && Math.hypot(move.x, move.y) > STAND_UP_MOVE) player.stand();
    },
    // Подсказка для ближайшего предмета: { text, icon, action } или null
    check() {
      if (coffee.busy) return null;
      if (player.seated) return { text: 'Встать', icon: '🧍', action: true };
      if (nearCoffee()) {
        if (!handsFree()) return { text: 'Руки заняты — сначала потуши пожар', icon: '☕', action: false };
        return { text: 'Выпить лавандовый раф', icon: '☕', action: true };
      }
      if (nearSeat()) return { text: 'Сесть на пуфик', icon: '🪑', action: true };
      return null;
    },
    // true, если действие обработано
    interact() {
      if (coffee.busy) return true;
      if (player.seated) { player.stand(); return true; }
      if (nearCoffee()) {
        if (handsFree()) brewCoffee();
        return true;
      }
      const seat = nearSeat();
      if (!seat) return false;
      player.sit(seat);
      return true;
    },
    brewCoffee,
  };
}
