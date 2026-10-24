// Рабочие дни стажировки (уровни): какие комнаты открыты, какие квесты даются и тексты интро/итогов.
// Чтобы добавить день — допишите запись в DAYS. unlocks — ключ из ROOMS (world/office.js),
// комната открыта с этого дня и до конца стажировки; пока она закрыта, дверь заперта.
// В текстах можно использовать {name} — подставится никнейм игрока.
export const DAYS = [
  {
    id: 'monday',
    title: 'Понедельник',
    unlocks: 'openSpace',
    quests: ['find-bug', 'paint-button'],
    intro: {
      subtitle: 'День 1 · знакомство с командой',
      lines: [
        'Первый рабочий день, {name}! Сегодня ты знакомишься с командой open-space — тимлидом Романом и менеджером Любой.',
        'У коллег со знаком «!» над головой есть для тебя задания. Выполняй их в любом порядке.',
        'Кабинет директора и серверная пока закрыты — до них дойдёт очередь.',
      ],
    },
    summary: {
      insight: 'Программист работает в команде: тимлид следит за качеством кода, а менеджер — за задачами и сроками.',
    },
  },
  {
    id: 'tuesday',
    title: 'Вторник',
    unlocks: 'director',
    quests: ['greeting'],
    intro: {
      subtitle: 'День 2 · встреча с директором',
      lines: [
        'Технический директор Илья вернулся с IT-конференции и хочет познакомиться с новым стажёром.',
        'Сегодня открыт его кабинет — загляни к Илье, у него есть задание.',
      ],
    },
    summary: {
      insight: 'Технический директор решает, что и зачем делает команда, и отвечает за результат разработки.',
    },
  },
  {
    id: 'wednesday',
    title: 'Среда',
    unlocks: 'server',
    quests: ['pipeline'],
    intro: {
      subtitle: 'День 3 · авария в серверной',
      lines: [
        'DevOps-инженер Серёга вернулся с удалёнки — и сразу аврал: сервера пищат.',
        'Сегодня тебя пустят в серверную. Помоги Серёге вернуть сайт к жизни!',
      ],
    },
    summary: {
      insight: 'Код мало написать — его нужно доставить пользователям и следить, чтобы всё работало. Этим занимаются DevOps-инженеры.',
    },
  },
  {
    id: 'thursday',
    title: 'Четверг',
    unlocks: 'canteen',
    quests: ['neurocuber'],
    intro: {
      subtitle: 'День 4 · стажёр Егор',
      lines: [
        'Четверг, {name}! В команде ещё один стажёр — Егор. Говорят, у него «прорывные» идеи.',
        'Сегодня открыли столовую. Егор сидит там за столом — загляни к нему, познакомься.',
      ],
    },
    summary: {
      insight: 'Изменения на продакшене — дело всей команды: код проходит ревью и пайплайн, инфраструктура описана в конфигах, а при аварии сервис откатывают на стабильную версию.',
    },
  },
];

// Индекс дня, в который даётся квест, или -1
export function dayOfQuest(questId) {
  return DAYS.findIndex((d) => d.quests.includes(questId));
}

// Записи квестов дня в порядке DAYS[i].quests (quests — массив QUESTS)
export function questsOfDay(dayIndex, quests) {
  return DAYS[dayIndex].quests.map((id) => quests.find((q) => q.id === id)).filter(Boolean);
}

export function isRoomOpen(roomId, dayIndex) {
  const opensOn = DAYS.findIndex((d) => d.unlocks === roomId);
  return opensOn !== -1 && opensOn <= dayIndex;
}

// Комнаты, которые ещё закрыты в день dayIndex: [{ room }]
export function lockedRooms(dayIndex) {
  return DAYS.slice(dayIndex + 1).map((d) => ({ room: d.unlocks }));
}
