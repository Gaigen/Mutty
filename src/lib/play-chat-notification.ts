import { appConfig } from '../config';

function playDefaultChatNotificationTone(): void {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const schedule = (freq: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(vol, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    };
    void ctx.resume().then(() => {
      const t = ctx.currentTime;
      schedule(784, t, 0.08, 0.1);
      schedule(988, t + 0.06, 0.1, 0.08);
    });
  } catch {
    /* ignore */
  }
}

export function playChatNotificationSound(): void {
  const chance = appConfig.chatNotificationRareChance;
  const src = appConfig.chatNotificationRareSrc?.trim();
  if (chance > 0 && src && Math.random() < chance) {
    const audio = new Audio(src);
    audio.volume = 0.85;
    void audio.play().catch(() => playDefaultChatNotificationTone());
    return;
  }
  playDefaultChatNotificationTone();
}
