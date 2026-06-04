export class TTSPlayer {
  private audio: HTMLAudioElement | null = null;

  play(audioBase64: string, mimeType: string, onEnded?: () => void): void {
    this.stop();
    const url = `data:${mimeType};base64,${audioBase64}`;
    this.audio = new Audio(url);
    if (onEnded) {
      this.audio.addEventListener('ended', onEnded, { once: true });
      this.audio.addEventListener('error', onEnded, { once: true });
    }
    this.audio.play().catch((err) => {
      console.error('[TTS] Playback failed:', err);
      if (onEnded) onEnded();
    });
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }

  get isPlaying(): boolean {
    return !!this.audio && !this.audio.paused;
  }
}
