export type ThemeId =
  | 'obsidian' | 'amber' | 'cobalt' | 'ivory' | 'vaporwave'
  | 'antique' | 'toxic' | 'space' | 'royal' | 'submarine'
  | 'neonNocturne' | 'solaris' | 'artDeco' | 'aurora';

export type DisplayMode = 'device' | 'ambient';
export type SceneQuality = 'auto' | 'high' | 'balanced' | 'saver';
export type ReducedMotionPreference = 'system' | 'reduced' | 'full';
export type RandomThemeMode = 'off' | 'daily' | 'alarm';

export interface VisualSettings {
  themeId: ThemeId;
  displayMode: DisplayMode;
  motionIntensity: number;
  motionSpeed: number;
  audioReactivity: number;
  glowIntensity: number;
  particleDensity: number;
  quality: SceneQuality;
  reducedMotion: ReducedMotionPreference;
  circadian: boolean;
  favoriteThemeIds: ThemeId[];
  randomMode: RandomThemeMode;
}

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
  keywords?: string[];
  active: boolean;
  themeId?: ThemeId;
}

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEKDAYS: readonly WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface Alarm {
  calendarItemId?: string;
  id: string;
  time: string; // "HH:MM"
  label: string;
  isActive: boolean;
  days: WeekDay[];
  genrePreset: MusicGenre;
  playlistConfig: PlaylistConfig;
  voiceBriefingConfig: VoiceBriefingConfig;
  themeId?: ThemeId;
}

export type MusicGenre = 'auto' | 'synthwave' | 'acoustic' | 'lofi' | 'rock' | 'classical' | 'jazz' | 'pop' | 'ambient' | 'hiphop';

export const MUSIC_GENRES: readonly MusicGenre[] = ['auto', 'synthwave', 'acoustic', 'lofi', 'rock', 'classical', 'jazz', 'pop', 'ambient', 'hiphop'];

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
export type TTSModel = 'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts' | 'gemini-3.1-flash-tts-preview' | 'gemini-2.5-flash-tts' | 'gemini-2.5-pro-tts';

export interface VoiceBriefingConfig {
  enabled: boolean;
  voiceName: string;
  language?: 'de' | 'en';
  delivery?: import('./services/voiceOptions').VoiceDelivery;
  includeWeather: boolean;
  includeAgenda: boolean;
  includeTime: boolean;
  customGreeting: string;
}

export { STUDIO_VOICE_NAMES as VOICE_NAMES } from './services/voiceOptions';

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
  alarms: Alarm[];
  currentAlarmId: string | null;
  generatedForAlarmId: string | null;
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
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle", 56: "Light freezing drizzle", 57: "Dense freezing drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain", 66: "Light freezing rain", 67: "Heavy freezing rain",
  71: "Slight snow fall", 73: "Moderate snow fall", 75: "Heavy snow fall", 77: "Snow grains",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers", 85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
};

export interface PushSubscriptionKeys { p256dh: string; auth: string; }
export interface PushSubscriptionJSON { endpoint: string; expirationTime: number | null; keys: PushSubscriptionKeys; }
export interface ServerAlarm { id: string; time: string; label: string; isActive: boolean; days: WeekDay[]; }
export interface DeviceRecord { deviceId: string; subscription: PushSubscriptionJSON | null; alarms: ServerAlarm[]; timezone: string; updatedAt: string; }
