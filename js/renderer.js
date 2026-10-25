// Draws the board on two stacked canvases:
//  - `goo`: snake, food and droplets. CSS applies an SVG blur+threshold filter to this
//    canvas, which is what melts the circles together into one liquid body.
//  - `top`: crisp details that must not melt (eyes, highlights).
// All positions are in cell units; `cell` converts to CSS pixels.

import { mod, ringDelta } from './ring.js';

const TAU = Math.PI * 2;
const GULP_SPEED = 1.6; // segments a swallowed drop travels per tick
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export class Renderer {
  constructor(gooCanvas, topCanvas) {
    this.goo = gooCanvas.getContext('2d');
    this.top = topCanvas.getContext('2d');
    this.canvases = [gooCanvas, topCanvas];
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.colors = { snake: '#FF6B4A', food: '#14A58C', ink: '#2D1B5A', eye: '#FFFFFF' };
    this.cell = 20;
    this.cols = 1;
    this.rows = 1;
    this.eyeAngle = 0;
    this.nextBlink = 0;
    this.reset();
  }

  reset() {
    this.particles = [];
    this.gulps = [];
    this.splat = null;
    this.foodKey = null;
    this.foodBorn = 0;
  }

  setColors(colors) {
    Object.assign(this.colors, colors);
  }

  resize(cell, cols, rows) {
    this.cell = cell;
    this.cols = cols;
    this.rows = rows;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cell * cols;
    const h = cell * rows;
    for (const c of this.canvases) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  get calm() {
    return this.reducedMotion.matches;
  }

  // ---- events from the game loop -------------------------------------------------

  onEat(game, now) {
    const head = game.snake[0];
    if (!this.calm) this.gulps.push(now);
    this.burst(head.x + 0.5, head.y + 0.5, this.calm ? 3 : 7, 4.5, now, [this.colors.food, this.colors.snake]);
  }

  onDie(game, now) {
    const head = game.snake[0];
    this.splat = {
      start: now,
      drift: game.snake.map((p) => {
        const dx = ringDelta(head.x, p.x, this.cols);
        const dy = ringDelta(head.y, p.y, this.rows);
        const len = Math.hypot(dx, dy) || 1;
        const kick = this.calm ? 0.15 : 0.6 + Math.random() * 0.5;
        return { x: (dx / len) * kick + (Math.random() - 0.5) * 0.5, y: (dy / len) * kick + (Math.random() - 0.5) * 0.5 };
      }),
    };
    this.burst(head.x + 0.5, head.y + 0.5, this.calm ? 4 : 14, 7, now, [this.colors.snake]);
  }

  burst(x, y, count, speed, now, palette) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + Math.random() * 0.6;
      const v = speed * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        r: 0.16 + Math.random() * 0.14,
        born: now,
        life: 420 + Math.random() * 260,
        color: palette[i % palette.length],
      });
    }
  }

  // ---- frame ---------------------------------------------------------------------

  draw(game, alpha, now, dt) {
    const { cell } = this;
    const W = cell * this.cols;
    const H = cell * this.rows;
    this.goo.clearRect(0, 0, W, H);
    this.top.clearRect(0, 0, W, H);

    const gulp = (g) => ((now - g) / game.tick) * GULP_SPEED;
    this.gulps = this.gulps.filter((g) => gulp(g) < game.snake.length + 3);

    const pts = this.snakePoints(game, alpha, now, gulp);
    this.drawFood(game, pts[0], now);
    // Droplets go under the body so a fresh splash looks like it squirts out from beneath.
    this.drawParticles(now, dt);
    this.drawSnake(pts);
    this.drawEyes(game, pts[0], now);
  }

  /** Interpolated segment centres with radii, in cell units. */
  snakePoints(game, alpha, now, gulp) {
    const n = game.snake.length;
    const t = game.alive ? alpha : 1;
    const splatK = this.splat ? easeOutCubic(clamp01((now - this.splat.start) / 700)) : 0;

    return game.snake.map((p, i) => {
      const f = game.from[i];
      let x = f.x + ringDelta(f.x, p.x, this.cols) * t + 0.5;
      let y = f.y + ringDelta(f.y, p.y, this.rows) * t + 0.5;
      let r = 0.54 - 0.18 * (n > 1 ? i / (n - 1) : 0);
      for (const g of this.gulps) r += 0.17 * Math.exp(-((i - gulp(g)) ** 2) / 0.9);
      if (this.splat) {
        const d = this.splat.drift[i];
        x += d.x * splatK;
        y += d.y * splatK;
        r *= 1 - 0.15 * splatK;
      }
      return { x: mod(x, this.cols), y: mod(y, this.rows), r };
    });
  }

  /** Calls fn(px, py) for a point and its wrapped copies near the board edges. */
  eachWrap(x, y, reach, fn) {
    const W = this.cell * this.cols;
    const H = this.cell * this.rows;
    const px = x * this.cell;
    const py = y * this.cell;
    const xs = [0];
    const ys = [0];
    if (px - reach < 0) xs.push(W);
    if (px + reach > W) xs.push(-W);
    if (py - reach < 0) ys.push(H);
    if (py + reach > H) ys.push(-H);
    for (const ox of xs) for (const oy of ys) fn(px + ox, py + oy);
  }

  blob(ctx, x, y, r, rx = r, ry = r) {
    this.eachWrap(x, y, Math.max(rx, ry) * this.cell, (px, py) => {
      ctx.beginPath();
      ctx.ellipse(px, py, rx * this.cell, ry * this.cell, 0, 0, TAU);
      ctx.fill();
    });
  }

  drawSnake(pts) {
    const ctx = this.goo;
    ctx.fillStyle = this.colors.snake;
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      this.blob(ctx, p.x, p.y, p.r);
      // A filler drop between neighbours keeps the body continuous at speed.
      const q = pts[i + 1];
      if (q && !this.splat) {
        const mx = p.x + ringDelta(p.x, q.x, this.cols) / 2;
        const my = p.y + ringDelta(p.y, q.y, this.rows) / 2;
        this.blob(ctx, mod(mx, this.cols), mod(my, this.rows), (p.r + q.r) / 2 - 0.04);
      }
    }
  }

  drawFood(game, head, now) {
    if (!game.food) return;
    const key = `${game.food.x},${game.food.y}`;
    if (key !== this.foodKey) {
      this.foodKey = key;
      this.foodBorn = now;
    }
    const grow = easeOutBack(clamp01((now - this.foodBorn) / 420));
    const x = game.food.x + 0.5;
    const y = game.food.y + 0.5;
    const r = 0.4 * grow;
    const wob = this.calm ? 0 : Math.sin(now / 170) * 0.09;

    const ctx = this.goo;
    ctx.fillStyle = this.colors.food;
    this.blob(ctx, x, y, r, r * (1 + wob), r * (1 - wob));

    // When the head is close, the drop leans toward it and the two start to merge.
    if (game.alive) {
      const dx = ringDelta(x, head.x, this.cols);
      const dy = ringDelta(y, head.y, this.rows);
      const dist = Math.hypot(dx, dy);
      if (dist < 2.4 && dist > 0.01) {
        const pull = (1 - dist / 2.4) * 0.55;
        this.blob(ctx, mod(x + (dx / dist) * pull, this.cols), mod(y + (dy / dist) * pull, this.rows), r * 0.62);
      }
    }

    this.top.fillStyle = 'rgba(255,255,255,0.65)';
    this.blob(this.top, x - 0.13 * grow, y - 0.14 * grow, 0.08 * grow);
  }

  drawParticles(now, dt) {
    const ctx = this.goo;
    const drag = Math.pow(0.9, dt / 16);
    this.particles = this.particles.filter((p) => now - p.born < p.life);
    for (const p of this.particles) {
      p.x = mod(p.x + (p.vx * dt) / 1000, this.cols);
      p.y = mod(p.y + (p.vy * dt) / 1000, this.rows);
      p.vx *= drag;
      p.vy *= drag;
      const k = 1 - (now - p.born) / p.life;
      ctx.fillStyle = p.color;
      this.blob(ctx, p.x, p.y, p.r * (0.4 + 0.6 * k));
    }
  }

  drawEyes(game, head, now) {
    const ctx = this.top;
    const { cell } = this;

    // Turn smoothly toward the direction of travel.
    const target = Math.atan2(game.dir.y, game.dir.x);
    const diff = Math.atan2(Math.sin(target - this.eyeAngle), Math.cos(target - this.eyeAngle));
    this.eyeAngle += diff * (this.calm ? 1 : 0.35);

    if (now > this.nextBlink + 140) this.nextBlink = now + 2500 + Math.random() * 3000;
    const blinking = now > this.nextBlink;

    const cos = Math.cos(this.eyeAngle);
    const sin = Math.sin(this.eyeAngle);
    let look = { x: cos, y: sin };
    if (game.food) {
      const fx = ringDelta(head.x, game.food.x + 0.5, this.cols);
      const fy = ringDelta(head.y, game.food.y + 0.5, this.rows);
      const len = Math.hypot(fx, fy) || 1;
      look = { x: fx / len, y: fy / len };
    }

    for (const side of [-1, 1]) {
      const ex = head.x + cos * 0.16 - sin * 0.24 * side;
      const ey = head.y + sin * 0.16 + cos * 0.24 * side;
      this.eachWrap(ex, ey, cell * 0.3, (px, py) => {
        if (!game.alive && !game.won) {
          // Splatted: little crosses for eyes.
          const s = cell * 0.1;
          ctx.strokeStyle = this.colors.ink;
          ctx.lineWidth = Math.max(1.5, cell * 0.07);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(px - s, py - s); ctx.lineTo(px + s, py + s);
          ctx.moveTo(px + s, py - s); ctx.lineTo(px - s, py + s);
          ctx.stroke();
          return;
        }
        const r = cell * 0.17;
        ctx.fillStyle = this.colors.eye;
        ctx.beginPath();
        ctx.ellipse(px, py, r, blinking ? r * 0.18 : r, this.eyeAngle, 0, TAU);
        ctx.fill();
        if (!blinking) {
          ctx.fillStyle = this.colors.ink;
          ctx.beginPath();
          ctx.arc(px + look.x * r * 0.38, py + look.y * r * 0.38, r * 0.52, 0, TAU);
          ctx.fill();
        }
      });
    }
  }
}
