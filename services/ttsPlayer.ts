// BUXE_OS v24.X -- TTS PLAYER
export class TTSPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentOnEnded: (() => void) | null = null;

  play(audioBase64: string, mimeType: string, onEnded?: () => void): void {
    this.stop();
    const url = `data:${mimeType};base64,${audioBase64}`;
    this.audio = new Audio(url);

    this.currentOnEnded = () => {
      this.cleanupListeners();
      if (onEnded) onEnded();
    };

    this.audio.addEventListener('ended', this.currentOnEnded, { once: true });
    this.audio.addEventListener('error', this.currentOnEnded, { once: true });

    this.audio.play().catch((err) => {
      console.error('[TTS] Playback failed:', err);
      this.cleanupListeners();
      if (onEnded) onEnded();
    });
  }

  private cleanupListeners(): void {
    if (this.audio && this.currentOnEnded) {
      this.audio.removeEventListener('ended', this.currentOnEnded);
      this.audio.removeEventListener('error', this.currentOnEnded);
    }
    this.currentOnEnded = null;
  }

  stop(): void {
    this.cleanupListeners();
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
  }

  get isPlaying(): boolean {
    return !!this.audio && !this.audio.paused;
  }
}
