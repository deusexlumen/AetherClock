import { Modality } from '@google/genai';
import { generateAI } from './aiTransport';
import { WeatherData, WEATHER_CODES, CalendarItem, VoiceBriefingConfig, LLMConfig } from '../types';

const DEFAULT_TTS_MODEL = "gemini-3.8-flash-tts";

export interface BriefingResult {
  audioBase64: string;
  mimeType: string;
  text: string;
}

export const generateVoiceBriefing = async (
  weather: WeatherData | null,
  agenda: CalendarItem[],
  alarmTime: string,
  config: VoiceBriefingConfig,
  llmConfig?: LLMConfig
): Promise<BriefingResult> => {
  const parts: string[] = [];
  const german = config.language !== 'en';

  if (config.customGreeting) {
    parts.push(config.customGreeting);
  } else {
    parts.push(german ? 'Guten Morgen.' : 'Good morning.');
  }

  if (config.includeTime) {
    parts.push(german ? `Es ist ${alarmTime} Uhr.` : `It is ${alarmTime}.`);
  }

  if (config.includeWeather && weather) {
    const weatherDesc = `${weather.temperature} degrees and ${WEATHER_CODES[weather.conditionCode] || 'clear'}`;
    parts.push(german ? `Das Wetter: ${weather.temperature} Grad.` : `The weather: ${weatherDesc}.`);
  }

  if (config.includeAgenda && agenda.length > 0) {
    const activeItems = agenda.filter(i => i.active).slice(0, 3);
    if (activeItems.length > 0) {
      const itemTexts = activeItems.map(i => `${i.time} ${i.title}`).join(', ');
      parts.push(german ? `Deine nächsten Termine: ${itemTexts}.` : `Your upcoming appointments: ${itemTexts}.`);
    }
  }

  const text = parts.join(' ');

  try {
    const response = await generateAI('voice', {
      model: llmConfig?.ttsModel || DEFAULT_TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: config.voiceName },
          },
        },
      },
    }, config.delivery);

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const audioBase64 = part?.inlineData?.data || '';
    const mimeType = part?.inlineData?.mimeType || 'audio/wav';

    if (!audioBase64) {
      throw new Error('TTS generation returned no audio');
    }

    return { audioBase64, mimeType, text };
  } catch (error) {
    console.warn('[VoiceBriefing] Voice unavailable.');
    return { audioBase64: '', mimeType: 'audio/wav', text: '' };
  }
};
