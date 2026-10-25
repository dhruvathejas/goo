import { Game, VISCOSITY, COLS, ROWS } from './game.js';
import { autopilot } from './autopilot.js';
import { Renderer } from './renderer.js';
import { bindInput } from './input.js';
import { sfx } from './audio.js';
import { store } from './storage.js';

const $ = (id) => document.getElementById(id);

const app = document.querySelector('.app');
const stage = $('stage');
const board = $('board');
const menu = $('menu');
const overlays = [...document.querySelectorAll('.overlay')];
const renderer = new Renderer($('goo-canvas'), $('top-canvas'));

const MAX_CELL = 40;
const GAME_OVER_DELAY = 750; // let the splat play before the dialog covers it
const DEMO_RESTART_DELAY = 900;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let viscosity = store.viscosity;
let screen = 'menu';
let game = null;
let demo = true; // the menu runs a self-driving snake behind the dialog
let acc = 0;
let last = performance.now();

// ---- Screens -------------------------------------------------------------------

function setScreen(next, { focus = true } = {}) {
  screen = next;
  app.dataset.screen = next;
  for (const o of overlays) o.inert = o.dataset.screen !== next;
  const active = overlays.find((o) => o.dataset.screen === next);
  // Keep keyboard users inside the dialog that just appeared (after it becomes visible).
  if (active && focus) requestAnimationFrame(() => active.querySelector('.btn-primary')?.focus({ preventScroll: true }));
  else if (!active) document.activeElement?.blur();
}

/** Restart a CSS animation class on an element. */
function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function begin(level, isDemo) {
  game = new Game({ viscosity: level });
  demo = isDemo;
  acc = 0;
  renderer.reset();
}

function startDemo() {
  begin('syrup', true);
}

function startGame() {
  sfx.unlock();
  begin(viscosity, false);
  updateScore(false);
  updateBestLine();
  announce(`${VISCOSITY[viscosity].name} game started`);
  setScreen('playing');
}

function showMenu({ focus = true } = {}) {
  startDemo();
  refreshMenu();
  updateScore(false);
  setScreen('menu', { focus });
}

function togglePause() {
  if (screen === 'playing') setScreen('paused');
  else if (screen === 'paused') setScreen('playing');
}

function showGameOver() {
  const level = VISCOSITY[viscosity];
  const isNewBest = store.submit(viscosity, game.score);
  const unit = game.score === 1 ? 'drop' : 'drops';

  $('over-title').textContent = game.won ? 'Board full!' : 'Splat!';
  $('over-score').textContent = `${game.score} ${unit} on ${level.name}`;
  const best = $('over-best');
  best.classList.toggle('is-new', isNewBest);
  best.textContent = isNewBest ? 'New best!' : `Best on ${level.name}: ${store.best(viscosity)}`;
  if (isNewBest) sfx.newBest();
  announce(`${$('over-title').textContent} ${$('over-score').textContent}. ${best.textContent}`);

  updateBestLine();
  setScreen('over');
}

// ---- HUD -----------------------------------------------------------------------

function updateScore(bump) {
  const score = demo ? 0 : game.score;
  $('score').textContent = score;
  $('score-unit').textContent = score === 1 ? 'drop' : 'drops';
  if (bump) replay($('score-pill'), 'bump');
}

/** Polite screen-reader announcement (the board itself is a canvas). */
function announce(text) {
  $('status').textContent = text;
}

function updateBestLine() {
  $('best-line').textContent = `Best ${store.best(viscosity)} on ${VISCOSITY[viscosity].name}`;
}

function refreshMenu() {
  const keys = Object.keys(VISCOSITY);
  $('viscosity').style.setProperty('--index', keys.indexOf(viscosity));
  for (const input of menu.elements.viscosity) input.checked = input.value === viscosity;
  for (const el of menu.querySelectorAll('[data-best]')) {
    const best = store.best(el.dataset.best);
    el.textContent = best ? `Best ${best}` : 'No best yet';
  }
  const blurb = $('viscosity-blurb');
  blurb.textContent = VISCOSITY[viscosity].blurb;
  replay(blurb, 'swap');
  updateBestLine();
}

// ---- Loop ----------------------------------------------------------------------

function handle(events, now) {
  if (events.turned && !demo) sfx.turn();
  if (events.ate) {
    renderer.onEat(game, now);
    if (!demo) {
      sfx.eat(game.snake.length);
      updateScore(true);
      announce(`${game.score} ${game.score === 1 ? 'drop' : 'drops'}`);
    }
  }
  if (game.alive) return;

  // Delayed follow-ups only apply if the player hasn't moved on to another game.
  const ended = game;
  if (demo) {
    if (events.died) renderer.onDie(game, now);
    setTimeout(() => { if (game === ended) startDemo(); }, DEMO_RESTART_DELAY);
    return;
  }
  if (game.won) {
    showGameOver();
    return;
  }
  renderer.onDie(game, now);
  sfx.splat();
  replay(board, 'is-splat');
  setTimeout(() => { if (game === ended && screen !== 'menu') showGameOver(); }, GAME_OVER_DELAY);
}

function frame(now) {
  const dt = Math.min(now - last, 100);
  last = now;
  // The menu demo holds still for people who asked for less motion.
  const running = screen === 'playing' || (screen === 'menu' && demo && !reducedMotion.matches);

  if (running && game.alive) {
    acc += dt;
    while (acc >= game.tick && game.alive) {
      acc -= game.tick;
      if (demo) game.turn(autopilot(game));
      handle(game.step(), now);
    }
  }

  const alpha = game.alive ? acc / game.tick : 1;
  renderer.draw(game, alpha, now, screen === 'paused' ? 0 : dt);
  requestAnimationFrame(frame);
}

// ---- Sizing & theme --------------------------------------------------------------

function layout() {
  const { width, height } = stage.getBoundingClientRect();
  const cell = Math.max(10, Math.min(MAX_CELL, Math.floor(Math.min(width / COLS, height / ROWS))));
  board.style.width = `${cell * COLS}px`;
  board.style.height = `${cell * ROWS}px`;
  app.style.setProperty('--cell', `${cell}px`);
  // Scale the goo blur with the cell so the liquid looks the same at every size.
  $('goo-blur').setAttribute('stdDeviation', (cell * 0.2).toFixed(1));
  renderer.resize(cell, COLS, ROWS);
}

function readColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  renderer.setColors({ snake: v('--coral'), food: v('--mint'), ink: v('--on-accent'), eye: '#FFFFFF' });
}

// ---- Wiring --------------------------------------------------------------------

menu.addEventListener('change', (e) => {
  if (e.target.name !== 'viscosity') return;
  viscosity = e.target.value;
  store.viscosity = viscosity;
  sfx.unlock();
  sfx.select();
  refreshMenu();
});

menu.addEventListener('submit', (e) => {
  e.preventDefault();
  startGame();
});

$('resume').addEventListener('click', togglePause);
$('quit').addEventListener('click', showMenu);
$('again').addEventListener('click', startGame);
$('change').addEventListener('click', showMenu);
$('pause').addEventListener('click', togglePause);

const muteBtn = $('mute');
function applyMute() {
  sfx.setMuted(store.muted);
  muteBtn.setAttribute('aria-pressed', String(store.muted));
}
muteBtn.addEventListener('click', () => {
  store.muted = !store.muted;
  applyMute();
  if (!store.muted) {
    sfx.unlock();
    sfx.select();
  }
});

bindInput({
  surface: stage,
  onTurn: (dir) => game.turn(dir),
  onTogglePause: togglePause,
  isPlaying: () => screen === 'playing',
  isPaused: () => screen === 'paused',
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'playing') setScreen('paused');
});

// Install prompt (Chromium). Other browsers install from their own menus.
let installEvent = null;
const installBtn = $('install');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => { installBtn.hidden = true; });

new ResizeObserver(layout).observe(stage);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js');
}

// Open with ?debug to poke at the running game from the console.
if (new URLSearchParams(location.search).has('debug')) {
  window.goo = { get game() { return game; } };
}

// ---- Boot ----------------------------------------------------------------------

applyMute();
readColors();
layout();
showMenu({ focus: false });
requestAnimationFrame((t) => {
  last = t;
  requestAnimationFrame(frame);
});
