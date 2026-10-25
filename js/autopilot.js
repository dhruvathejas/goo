// A simple self-driving snake for the menu screen. Greedy toward the food, but it
// avoids moves that would trap it in a pocket smaller than its own body.

import { DIRS, opposite } from './game.js';
import { ringDelta } from './ring.js';

const ALL = Object.values(DIRS);

/** Count free cells reachable from `start` (capped, since we only need "enough"). */
function room(game, start, blocked, cap) {
  const seen = new Set(blocked);
  seen.add(game.key(start));
  const stack = [start];
  let n = 0;
  while (stack.length && n < cap) {
    const cur = stack.pop();
    n++;
    for (const d of ALL) {
      const p = game.wrap({ x: cur.x + d.x, y: cur.y + d.y });
      if (seen.has(game.key(p))) continue;
      seen.add(game.key(p));
      stack.push(p);
    }
  }
  return n;
}

export function autopilot(game) {
  const head = game.snake[0];
  const blocked = new Set(game.snake.slice(0, -1).map((p) => game.key(p)));
  const need = game.snake.length + 4;
  let best = null;
  let bestCost = Infinity;

  for (const d of ALL) {
    if (opposite(d, game.dir)) continue;
    const p = game.wrap({ x: head.x + d.x, y: head.y + d.y });
    if (blocked.has(game.key(p))) continue;
    const space = room(game, p, blocked, need * 2);
    const toFood = game.food
      ? Math.abs(ringDelta(p.x, game.food.x, game.cols)) + Math.abs(ringDelta(p.y, game.food.y, game.rows))
      : 0;
    const cost = (space < need ? 1000 - space : 0) + toFood + game.random() * 0.9;
    if (cost < bestCost) {
      bestCost = cost;
      best = d;
    }
  }
  return best || game.dir;
}
