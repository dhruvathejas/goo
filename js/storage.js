// Small persisted settings: best score per viscosity, mute, last chosen viscosity.
// localStorage can be missing or throw (private mode, blocked storage), so every
// access is guarded and the game keeps working in memory.

import { VISCOSITY } from './game.js';

const KEY = 'goo:v1';

const defaults = () => ({
  best: { honey: 0, syrup: 0, water: 0 },
  muted: false,
  viscosity: 'syrup',
});

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

function load() {
  const base = defaults();
  const saved = read();
  if (!saved) return base;
  const data = { ...base, ...saved, best: { ...base.best, ...saved.best } };
  if (!VISCOSITY[data.viscosity]) data.viscosity = base.viscosity;
  return data;
}

const data = load();

function save() {
  // Another tab (or the installed app) may have set a higher best since we loaded;
  // keep the higher score per viscosity rather than overwriting it.
  const latest = read();
  if (latest && latest.best) {
    for (const id of Object.keys(data.best)) data.best[id] = Math.max(data.best[id], latest.best[id] || 0);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable: keep the in-memory copy for this session.
  }
}

export const store = {
  best: (viscosity) => data.best[viscosity] || 0,

  /** Records a score; returns true when it beats the previous best. */
  submit(viscosity, score) {
    if (score <= (data.best[viscosity] || 0)) return false;
    data.best[viscosity] = score;
    save();
    return true;
  },

  get muted() {
    return data.muted;
  },
  set muted(value) {
    data.muted = !!value;
    save();
  },

  get viscosity() {
    return data.viscosity;
  },
  set viscosity(value) {
    data.viscosity = value;
    save();
  },
};
