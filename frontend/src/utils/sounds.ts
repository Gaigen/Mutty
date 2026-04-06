let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

/** Два коротких восходящих тона — кто-то вошёл */
export function playJoinSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    playNote(ctx, 523, t,        0.12, 0.18); // C5
    playNote(ctx, 784, t + 0.11, 0.20, 0.22); // G5
  } catch {
    // ignore
  }
}

/** Один нисходящий тон — кто-то вышел */
export function playLeaveSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    playNote(ctx, 659, t,        0.10, 0.14); // E5
    playNote(ctx, 392, t + 0.09, 0.22, 0.12); // G4
  } catch {
    // ignore
  }
}

/** Two low beeps — full mute (all incoming audio muted) */
export function playFullMuteSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    playNote(ctx, 294, t,        0.08, 0.10, 'triangle'); // D4
    playNote(ctx, 262, t + 0.09, 0.15, 0.10, 'triangle'); // C4
  } catch {
    // ignore
  }
}

/** Two high beeps — full unmute */
export function playFullUnmuteSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    playNote(ctx, 523, t,        0.08, 0.10, 'triangle'); // C5
    playNote(ctx, 659, t + 0.09, 0.15, 0.10, 'triangle'); // E5
  } catch {
    // ignore
  }
}

/** Short low beep — mic muted */
export function playMicMuteSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    playNote(ctx, 330, t, 0.10, 0.12, 'sine'); // E4
  } catch {
    // ignore
  }
}

/** Short high beep — mic unmuted */
export function playMicUnmuteSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    playNote(ctx, 660, t, 0.10, 0.12, 'sine'); // E5
  } catch {
    // ignore
  }
}

/** Three-note ascending chime — someone started screen sharing */
export function playScreenShareSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    playNote(ctx, 440, t,        0.08, 0.10, 'triangle'); // A4
    playNote(ctx, 554, t + 0.08, 0.08, 0.12, 'triangle'); // C#5
    playNote(ctx, 659, t + 0.16, 0.18, 0.16, 'triangle'); // E5
  } catch {
    // ignore
  }
}
