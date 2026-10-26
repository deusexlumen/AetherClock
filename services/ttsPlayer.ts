// BUXE_OS v24.X -- TTS PLAYER
const audioUrl = (source: string, mimeType: string): string => {
  const match = source.match(/^data:(.+);base64,([\s\S]*)$/);
  const mime = match?.[1] || mimeType;
  const base64 = match?.[2] ?? source;
  if (!/^audio\/(l16|pcm)(;|$)/i.test(mime)) {
    return source.startsWith('data:') ? source : `data:${mime};base64,${base64}`;
  }
  // Gemini's raw PCM output needs a WAV container for HTMLAudioElement.
  const pcm = atob(base64);
  const rate = Number(mime.match(/rate=(\d+)/i)?.[1] || 24000);
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + pcm.length, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, pcm.length, true);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...new Uint8Array(header)) + pcm)}`;
};

export class TTSPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentOnEnded: (() => void) | null = null;
  private generation = 0;

  play(audioBase64: string, mimeType: string, onEnded?: () => void): void {
    this.stop();
    const generation = this.generation;
    const url = audioUrl(audioBase64, mimeType);
    this.audio = new Audio(url);

    let finished = false;
    this.currentOnEnded = () => {
      if (generation !== this.generation || finished) return;
      finished = true;
      this.cleanupListeners();
      if (onEnded) onEnded();
    };

    this.audio.addEventListener('ended', this.currentOnEnded, { once: true });
    this.audio.addEventListener('error', this.currentOnEnded, { once: true });

    this.audio.play().catch((err) => {
      if (generation !== this.generation || finished) return;
      console.error('[TTS] Playback failed:', err);
      this.currentOnEnded?.();
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
    this.generation++;
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
