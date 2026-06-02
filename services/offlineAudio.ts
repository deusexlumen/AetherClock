const FALLBACK_AUDIO_URL = '/assets/fallback-alarm.mp3';

export const playOfflineFallback = async (): Promise<void> => {
  try {
    const audio = new Audio(FALLBACK_AUDIO_URL);
    audio.loop = true;
    audio.volume = 1.0;
    await audio.play();
  } catch (err) {
    console.warn('[OfflineAudio] Fallback playback failed:', err);
    // Ultimate fallback: try oscillator beep
    playOscillatorFallback();
  }
};

const playOscillatorFallback = (): void => {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 2);
  } catch (e) {
    console.warn('[OfflineAudio] Oscillator fallback failed:', e);
  }
};

export const preloadFallbackAudio = (): void => {
  const audio = new Audio(FALLBACK_AUDIO_URL);
  audio.preload = 'auto';
};
