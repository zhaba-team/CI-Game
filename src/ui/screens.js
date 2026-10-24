// Реестр полноэкранных сцен для шагов квеста type: 'screen' (quests/quests.js).
// Сцена — функция ({ duration, onDone }) => void: показывает себя и вызывает onDone, когда закончилась.
import { showBsod } from './bsod.js';

export const SCREENS = {
  bsod: showBsod,
};
