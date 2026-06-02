const FALLBACK_AUDIO_URL = '/assets/fallback-alarm.mp3';

let currentOscillatorNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
let alarmInterval: ReturnType<typeof setInterval> | null = null;

export const playOfflineFallback = async (): Promise<void> => {
  stopOfflineFallback();

  try {
    const audio = new Audio(FALLBACK_AUDIO_URL);
    audio.loop = true;
    audio.volume = 1.0;
    await audio.play();
  } catch {
    // Fallback to synthesized alarm siren
    playSirenAlarm();
  }
};

const playSirenAlarm = (): void => {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Two oscillators for a rich siren sound
    const createOscillator = (type: OscillatorType, freq: number, detune: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.detune.setValueAtTime(detune, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.start();
      return { osc, gain };
    };

    const osc1 = createOscillator('sawtooth', 880, 0);
    const osc2 = createOscillator('square', 880, 10);
    currentOscillatorNodes = [osc1, osc2];

    // Siren sweep: frequency ramps up and down
    let goingUp = true;
    let baseFreq = 600;
    alarmInterval = setInterval(() => {
      if (goingUp) {
        baseFreq += 50;
        if (baseFreq >= 1200) goingUp = false;
      } else {
        baseFreq -= 50;
        if (baseFreq <= 600) goingUp = true;
      }
      osc1.osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc2.osc.frequency.setValueAtTime(baseFreq * 1.01, ctx.currentTime);
    }, 100);

    // Stutter rhythm: gain pulses
    const pulseGain = () => {
      const now = ctx.currentTime;
      osc1.gain.gain.cancelScheduledValues(now);
      osc1.gain.gain.setValueAtTime(0.3, now);
      osc1.gain.gain.setValueAtTime(0.05, now + 0.15);
      osc1.gain.gain.setValueAtTime(0.3, now + 0.2);
      osc1.gain.gain.setValueAtTime(0.05, now + 0.35);
      osc1.gain.gain.setValueAtTime(0.3, now + 0.4);
    };
    const pulseInterval = setInterval(pulseGain, 500);
    // Store interval on first node for cleanup
    (osc1 as any)._pulseInterval = pulseInterval;

  } catch (e) {
    console.warn('[OfflineAudio] Siren fallback failed:', e);
  }
};

export const stopOfflineFallback = (): void => {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
  currentOscillatorNodes.forEach(({ osc, gain }) => {
    try {
      const pulseInterval = (osc as any)._pulseInterval;
      if (pulseInterval) clearInterval(pulseInterval);
      gain.gain.setValueAtTime(0, gain.context.currentTime);
      osc.stop(gain.context.currentTime + 0.1);
    } catch {
      // Ignore already stopped
    }
  });
  currentOscillatorNodes = [];
};

export const preloadFallbackAudio = (): void => {
  const audio = new Audio(FALLBACK_AUDIO_URL);
  audio.preload = 'auto';
};
