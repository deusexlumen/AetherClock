import { GoogleGenAI, Modality } from "@google/genai";
import { WeatherData, WEATHER_CODES, CalendarItem, VoiceBriefingConfig, LLMConfig } from '../types';

const DEFAULT_TTS_MODEL = "gemini-3.1-flash-tts-preview";

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
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: { 'User-Agent': 'lyria-radio-client' }
    }
  });

  const parts: string[] = [];

  if (config.customGreeting) {
    parts.push(config.customGreeting);
  } else {
    parts.push("Good morning.");
  }

  if (config.includeTime) {
    parts.push(`Es ist ${alarmTime}.`);
  }

  if (config.includeWeather && weather) {
    const weatherDesc = `${weather.temperature} degrees and ${WEATHER_CODES[weather.conditionCode] || 'clear'}`;
    parts.push(`The weather: ${weatherDesc}.`);
  }

  if (config.includeAgenda && agenda.length > 0) {
    const activeItems = agenda.filter(i => i.active).slice(0, 3);
    if (activeItems.length > 0) {
      const itemTexts = activeItems.map(i => `${i.time} ${i.title}`).join(', ');
      parts.push(`Deine nächsten Termine: ${itemTexts}.`);
    }
  }

  const text = parts.join(' ');

  const response = await ai.models.generateContent({
    model: MODEL_TTS,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: config.voiceName },
        },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  const audioBase64 = part?.inlineData?.data || '';
  const mimeType = part?.inlineData?.mimeType || 'audio/wav';

  if (!audioBase64) {
    throw new Error('TTS generation returned no audio');
  }

  return { audioBase64, mimeType, text };
};
