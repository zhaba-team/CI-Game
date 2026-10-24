// Реестр мини-игр. Каждая мини-игра — объект { id, title, mount(root, ctx) },
// где ctx = { playerName, complete }. complete() вызывается, когда задание выполнено.
import paintButton from './paintButton.js';
import findBug from './findBug.js';
import pipeline from './pipeline.js';
import greeting from './greeting.js';
import infraConfig from './infraConfig.js';

const registry = new Map();

export function registerMinigame(mg) {
  registry.set(mg.id, mg);
}

export function getMinigame(id) {
  const mg = registry.get(id);
  if (!mg) throw new Error(`Мини-игра «${id}» не зарегистрирована`);
  return mg;
}

[paintButton, findBug, pipeline, greeting, infraConfig].forEach(registerMinigame);
