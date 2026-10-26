const FALLBACK_AUDIO_URL = '/assets/fallback-alarm.wav';

let currentOscillatorNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
let alarmInterval: ReturnType<typeof setInterval> | null = null;
let pulseInterval: ReturnType<typeof setInterval> | null = null;
let audioCtx: AudioContext | null = null;
let currentAudio: HTMLAudioElement | null = null;
let playbackGeneration = 0;

export const playOfflineFallback = async (): Promise<void> => {
  stopOfflineFallback();
  const generation = playbackGeneration;

  try {
    const audio = new Audio(FALLBACK_AUDIO_URL);
    currentAudio = audio;
    audio.loop = true;
    audio.volume = 1.0;
    await audio.play();
  } catch {
    // Fallback to synthesized alarm siren
    if (generation === playbackGeneration) {
      currentAudio = null;
      playSirenAlarm();
    }
  }
};

const playSirenAlarm = (): void => {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioCtx();
    }
    const ctx = audioCtx;

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
    pulseInterval = setInterval(pulseGain, 500);

  } catch (e) {
    console.warn('[OfflineAudio] Siren fallback failed:', e);
  }
};

export const stopOfflineFallback = (): void => {
  playbackGeneration++;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
  if (pulseInterval) {
    clearInterval(pulseInterval);
    pulseInterval = null;
  }
  currentOscillatorNodes.forEach(({ osc, gain }) => {
    try {
      gain.gain.setValueAtTime(0, gain.context.currentTime);
      osc.stop(gain.context.currentTime + 0.1);
    } catch {
      // Ignore already stopped
    }
  });
  currentOscillatorNodes = [];
  if (audioCtx && audioCtx.state !== 'closed') {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
};

export const preloadFallbackAudio = (): void => {
  const audio = new Audio(FALLBACK_AUDIO_URL);
  audio.preload = 'auto';
};
