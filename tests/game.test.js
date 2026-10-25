import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, DIRS, VISCOSITY } from '../js/game.js';
import { autopilot } from '../js/autopilot.js';

/** A game with a fixed food position so steps are predictable. */
function fixture(opts = {}) {
  const game = new Game({ cols: 10, rows: 8, random: () => 0, ...opts });
  return game;
}

test('starts as a three-segment snake heading right, centred', () => {
  const g = fixture();
  assert.deepEqual(g.snake, [{ x: 5, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 4 }]);
  assert.deepEqual(g.dir, DIRS.right);
  assert.equal(g.alive, true);
});

test('moves one cell per step and records where each segment came from', () => {
  const g = fixture();
  g.food = { x: 0, y: 0 };
  g.step();
  assert.deepEqual(g.snake, [{ x: 6, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 4 }]);
  assert.deepEqual(g.from, [{ x: 5, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 4 }]);
});

test('wraps through the right edge to the left', () => {
  const g = fixture();
  g.food = { x: 0, y: 0 };
  for (let i = 0; i < 5; i++) g.step();
  assert.deepEqual(g.snake[0], { x: 0, y: 4 });
  assert.equal(g.alive, true);
});

test('wraps through the top edge to the bottom', () => {
  const g = fixture();
  g.food = { x: 9, y: 0 };
  g.turn(DIRS.up);
  for (let i = 0; i < 5; i++) g.step();
  assert.deepEqual(g.snake[0], { x: 5, y: 7 });
});

test('ignores reversals and repeated directions', () => {
  const g = fixture();
  assert.equal(g.turn(DIRS.left), false);
  assert.equal(g.turn(DIRS.right), false);
  assert.equal(g.turn(DIRS.up), true);
  // Relative to the queued "up", "down" is now the reversal.
  assert.equal(g.turn(DIRS.down), false);
  assert.equal(g.turn(DIRS.left), true);
});

test('queued turns apply one per step, so quick double-taps both land', () => {
  const g = fixture();
  g.food = { x: 0, y: 0 };
  g.turn(DIRS.up);
  g.turn(DIRS.left);
  g.step();
  assert.deepEqual(g.snake[0], { x: 5, y: 3 });
  g.step();
  assert.deepEqual(g.snake[0], { x: 4, y: 3 });
});

test('eating grows the snake, scores and respawns food on a free cell', () => {
  const g = fixture();
  g.food = { x: 6, y: 4 };
  const ev = g.step();
  assert.equal(ev.ate, true);
  assert.equal(g.score, 1);
  assert.equal(g.snake.length, 4);
  assert.ok(!g.snake.some((p) => p.x === g.food.x && p.y === g.food.y));
});

test('only Water speeds up, and never past its floor', () => {
  for (const [id, level] of Object.entries(VISCOSITY)) {
    const g = fixture({ viscosity: id });
    for (let i = 0; i < 200; i++) {
      g.food = g.wrap({ x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y });
      g.snake = g.snake.slice(0, 3); // keep it short so it never bites itself
      g.step();
    }
    if (level.speedup) assert.equal(g.tick, level.minTick);
    else assert.equal(g.tick, level.tick);
  }
});

test('biting its own body ends the game', () => {
  const g = fixture();
  g.food = { x: 0, y: 0 };
  g.snake = [{ x: 5, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }];
  g.turn(DIRS.up);
  const ev = g.step();
  assert.equal(ev.died, true);
  assert.equal(g.alive, false);
  assert.equal(g.step().died, false, 'a dead game stays still');
});

test('moving into the cell the tail is leaving is allowed', () => {
  const g = fixture();
  g.food = { x: 0, y: 0 };
  g.snake = [{ x: 5, y: 4 }, { x: 5, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 4 }];
  g.dir = DIRS.down;
  g.turn(DIRS.left);
  assert.equal(g.step().died, false);
  assert.deepEqual(g.snake[0], { x: 4, y: 4 });
});

test('filling the board wins', () => {
  const g = new Game({ cols: 2, rows: 2, random: () => 0 });
  g.snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
  g.dir = DIRS.down;
  g.food = { x: 0, y: 1 };
  const ev = g.step();
  assert.equal(ev.ate, true);
  assert.equal(g.won, true);
  assert.equal(g.alive, false);
});

test('autopilot survives a long run on the real board', () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ random });
  for (let i = 0; i < 600 && g.alive; i++) {
    g.turn(autopilot(g));
    g.step();
  }
  assert.ok(g.score >= 10, `expected the demo snake to eat a fair amount, got ${g.score}`);
});

test('ring arithmetic takes the short way around the board', async () => {
  const { ringDelta, mod } = await import('../js/ring.js');
  assert.equal(ringDelta(14, 0, 15), 1);
  assert.equal(ringDelta(0, 14, 15), -1);
  assert.equal(ringDelta(3, 5, 15), 2);
  assert.equal(mod(-0.5, 15), 14.5);
  assert.equal(mod(15.25, 15), 0.25);
});
