// Synthesised sound effects (no audio files) plus vibration on devices that support it.
// The AudioContext is created lazily on the first user gesture, as browsers require.

let ctx = null;
let master = null;
let noise = null;
let muted = false;

function ensure() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(ac) {
  if (noise) return noise;
  noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const ch = noise.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  return noise;
}

/** One enveloped oscillator with a pitch glide. */
function tone({ type = 'sine', from, to, dur, gain = 0.4, delay = 0 }) {
  const ac = ensure();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function vibrate(pattern) {
  // Browsers reject vibration before the first tap; skip it instead of logging errors.
  const activated = navigator.userActivation ? navigator.userActivation.hasBeenActive : true;
  if (!muted && activated && navigator.vibrate) navigator.vibrate(pattern);
}

export const sfx = {
  /** Call from a user gesture so later sounds are allowed to play. */
  unlock() {
    ensure();
  },

  setMuted(value) {
    muted = value;
    if (muted && ctx) ctx.suspend();
  },

  /** A wet "bloop" that climbs a little as the snake grows. */
  eat(length) {
    const lift = Math.min(length, 30) * 12;
    tone({ from: 260 + lift, to: 820 + lift, dur: 0.13, gain: 0.35 });
    tone({ type: 'triangle', from: 1300 + lift, to: 1700 + lift, dur: 0.06, gain: 0.08, delay: 0.05 });
    vibrate(12);
  },

  turn() {
    tone({ type: 'triangle', from: 210, to: 150, dur: 0.045, gain: 0.07 });
  },

  splat() {
    const ac = ensure();
    if (ac) {
      const t = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer(ac);
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, t);
      filter.frequency.exponentialRampToValueAtTime(180, t + 0.35);
      const env = ac.createGain();
      env.gain.setValueAtTime(0.5, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      src.connect(filter).connect(env).connect(master);
      src.start(t);
      src.stop(t + 0.42);
      tone({ from: 140, to: 40, dur: 0.3, gain: 0.5 });
    }
    vibrate([30, 40, 70]);
  },

  newBest() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ from: f, to: f * 1.01, dur: 0.16, gain: 0.18, delay: 0.08 * i }));
    vibrate([15, 60, 15, 60, 30]);
  },

  select() {
    tone({ from: 420, to: 640, dur: 0.07, gain: 0.15 });
  },
};
