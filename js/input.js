// Keyboard and swipe input, translated into game directions and commands.

import { DIRS } from './game.js';

const KEYS = {
  ArrowUp: DIRS.up, KeyW: DIRS.up,
  ArrowDown: DIRS.down, KeyS: DIRS.down,
  ArrowLeft: DIRS.left, KeyA: DIRS.left,
  ArrowRight: DIRS.right, KeyD: DIRS.right,
};

const SWIPE_THRESHOLD = 22; // px of travel before a drag counts as a turn

/**
 * @param {object} opts
 * @param {HTMLElement} opts.surface element that receives swipes
 * @param {(dir: {x:number,y:number}) => void} opts.onTurn
 * @param {() => void} opts.onTogglePause Space / Escape / P pause; Escape / P resume
 * @param {() => boolean} opts.isPlaying keys only steer while a game is running
 * @param {() => boolean} opts.isPaused
 */
export function bindInput({ surface, onTurn, onTogglePause, isPlaying, isPaused }) {
  let swallowSpaceUp = false;

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const dir = KEYS[e.code];
    if (dir && isPlaying()) {
      e.preventDefault();
      onTurn(dir);
      return;
    }
    // Held keys auto-repeat; only the first press may toggle pause.
    if (e.repeat) return;
    const pauses = (e.code === 'Space' || e.code === 'Escape' || e.code === 'KeyP') && isPlaying();
    const resumes = (e.code === 'Escape' || e.code === 'KeyP') && isPaused();
    if (!pauses && !resumes) return;
    e.preventDefault();
    // Pausing moves focus to "Resume"; without this the same key's keyup would click it.
    swallowSpaceUp = e.code === 'Space';
    onTogglePause();
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && swallowSpaceUp) {
      e.preventDefault();
      swallowSpaceUp = false;
    }
  }, true);

  // Swipes fire as soon as the finger has travelled far enough, then re-anchor,
  // so one continuous drag can make several quick turns.
  let origin = null;
  surface.addEventListener('pointerdown', (e) => {
    if (!isPlaying() || e.target.closest('button, a, input, label')) return;
    origin = { x: e.clientX, y: e.clientY, id: e.pointerId };
    // Keep receiving the drag even if it leaves the board, so the release is never missed.
    surface.setPointerCapture(e.pointerId);
  });
  surface.addEventListener('pointermove', (e) => {
    if (!origin || e.pointerId !== origin.id) return;
    if (!isPlaying() || e.buttons === 0) {
      origin = null;
      return;
    }
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) onTurn(dx > 0 ? DIRS.right : DIRS.left);
    else onTurn(dy > 0 ? DIRS.down : DIRS.up);
    origin = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  const end = () => { origin = null; };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
}
