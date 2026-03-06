/**
 * Shared AudioContext for Web Audio API.
 * Must be resumed after a user gesture (Chrome autoplay policy).
 * Call initOnUserGesture() when user clicks "Join Room" — then audio works in the room.
 */
let _ctx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!_ctx) {
    _ctx = new AudioContext();
  }
  return _ctx;
}

/** Call this on user gesture (e.g. Join Room click) to unlock audio in Chrome. */
export function initOnUserGesture(): void {
  const ctx = getSharedAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}
