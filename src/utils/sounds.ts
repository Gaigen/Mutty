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

/** Two short ascending tones — someone joined */
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

/** One descending tone — someone left */
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
