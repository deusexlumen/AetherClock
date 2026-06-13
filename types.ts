export interface WeatherData {
  temperature: number;
  conditionCode: number;
  isDay: boolean;
}

export interface CalendarItem {
  id: string;
  time: string; // "HH:MM"
  title: string;
  vibe?: string; // e.g. "work", "sport", "chill", "social", "family"
  active: boolean;
}

export type MusicGenre = 'auto' | 'synthwave' | 'acoustic' | 'lofi' | 'rock' | 'classical' | 'jazz' | 'pop' | 'ambient' | 'hiphop';

export interface SearchedSongMetadata {
  title: string;
  artist: string;
  whyExplanation: string;
  foundTheme: string;
  styleDescription: string;
  youtubeVideoId?: string;
}

export interface PlaylistTrack {
  title: string;
  artist: string;
  youtubeVideoId?: string;
  embedUrl: string;
  whyExplanation: string;
}

export type TextModel = 'gemini-3.5-flash' | 'gemini-3-flash' | 'gemini-3.1-flash-lite' | 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gemini-2.5-pro';
export type TTSModel = 'gemini-3.1-flash-tts-preview' | 'gemini-2.5-flash-tts' | 'gemini-2.5-pro-tts';

export interface VoiceBriefingConfig {
  enabled: boolean;
  voiceName: 'Fenrir' | 'Kore' | 'Leda';
  includeWeather: boolean;
  includeAgenda: boolean;
  includeTime: boolean;
  customGreeting: string;
}

export interface LLMConfig {
  textModel: TextModel;
  ttsModel: TTSModel;
}

export interface PlaylistConfig {
  enabled: boolean;
  trackCount: number;
  shuffle: boolean;
  crossfadeSeconds: number;
}

export type AppStatus = 'idle' | 'generating_prompt' | 'generating_briefing' | 'ready' | 'playing_briefing' | 'playing' | 'error';

export interface AppState {
  alarmTime: string;
  isAlarmActive: boolean;
  agenda: string;
  calendar: CalendarItem[];
  genrePreset: MusicGenre;
  searchedTrack: SearchedSongMetadata | null;
  location: string | null;
  weather: WeatherData | null;
  status: AppStatus;
  errorMessage: string | null;
  youtubeEmbedUrl: string | null;
  logs: string[];
  playlist: PlaylistTrack[];
  currentTrackIndex: number;
  briefingAudioSrc: string | null;
}

export const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};
