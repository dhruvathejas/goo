// Pure game rules: no DOM, no timing. The loop in main.js calls step() once per tick.

export const COLS = 15;
export const ROWS = 21;

/** Difficulty levels. `tick` is ms per move; Water speeds up as you eat. */
export const VISCOSITY = {
  honey: { name: 'Honey', blurb: 'Slow and thick. Plenty of time to turn.', tick: 210, minTick: 210, speedup: 0 },
  syrup: { name: 'Syrup', blurb: 'A steady ooze.', tick: 145, minTick: 145, speedup: 0 },
  water: { name: 'Water', blurb: 'Fast, and faster with every drop.', tick: 105, minTick: 68, speedup: 1.6 },
};

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const MAX_QUEUED_TURNS = 3;

const same = (a, b) => a.x === b.x && a.y === b.y;
export const opposite = (a, b) => a.x === -b.x && a.y === -b.y;

export class Game {
  /**
   * @param {object} opts
   * @param {keyof VISCOSITY} [opts.viscosity]
   * @param {number} [opts.cols]
   * @param {number} [opts.rows]
   * @param {() => number} [opts.random] injectable for tests
   */
  constructor({ viscosity = 'syrup', cols = COLS, rows = ROWS, random = Math.random } = {}) {
    this.level = VISCOSITY[viscosity];
    this.cols = cols;
    this.rows = rows;
    this.random = random;

    const y = Math.floor(rows / 2);
    const x = Math.floor(cols / 2);
    // Points are never mutated, only replaced, so arrays can share them safely.
    this.snake = [{ x, y }, { x: x - 1, y }, { x: x - 2, y }];
    // from[i] is where snake[i] was before the last step; the renderer interpolates between them.
    this.from = this.snake;
    this.dir = DIRS.right;
    this.queue = [];
    this.tick = this.level.tick;
    this.score = 0;
    this.alive = true;
    this.won = false;
    this.food = this.spawnFood();
  }

  /** Queue a direction change. Ignores no-ops and 180° reversals. */
  turn(dir) {
    const ref = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (same(dir, ref) || opposite(dir, ref) || this.queue.length >= MAX_QUEUED_TURNS) return false;
    this.queue.push(dir);
    return true;
  }

  /** Advance one tick. Returns what happened so the caller can play effects. */
  step() {
    const events = { ate: false, died: false, turned: false };
    if (!this.alive) return events;

    if (this.queue.length) {
      this.dir = this.queue.shift();
      events.turned = true;
    }

    const old = this.snake;
    const next = this.wrap({ x: old[0].x + this.dir.x, y: old[0].y + this.dir.y });
    const eats = this.food && same(next, this.food);
    // The tail moves out of the way this tick unless we are growing.
    const body = eats ? old : old.slice(0, -1);
    if (body.some((p) => same(p, next))) {
      this.alive = false;
      this.from = old;
      events.died = true;
      return events;
    }

    this.snake = [next, ...body];
    this.from = [old[0], ...old.slice(0, this.snake.length - 1)];

    if (eats) {
      this.score += 1;
      this.tick = Math.max(this.level.minTick, this.tick - this.level.speedup);
      this.food = this.spawnFood();
      events.ate = true;
      if (!this.food) {
        this.alive = false;
        this.won = true;
      }
    }
    return events;
  }

  wrap(p) {
    return { x: (p.x + this.cols) % this.cols, y: (p.y + this.rows) % this.rows };
  }

  /** A unique number per cell, for sets and lookups. */
  key(p) {
    return p.y * this.cols + p.x;
  }

  /** A random free cell, or null when the snake fills the board. */
  spawnFood() {
    const taken = new Set(this.snake.map((p) => this.key(p)));
    const free = this.cols * this.rows - taken.size;
    if (free <= 0) return null;
    let n = Math.floor(this.random() * free);
    for (let i = 0; i < this.cols * this.rows; i++) {
      if (taken.has(i)) continue;
      if (n-- === 0) return { x: i % this.cols, y: Math.floor(i / this.cols) };
    }
    return null;
  }
}
