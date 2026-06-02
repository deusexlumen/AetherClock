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
  youtubeVideoId: string;
  whyExplanation: string;
}

export interface VoiceBriefingConfig {
  enabled: boolean;
  voiceName: 'Fenrir' | 'Kore' | 'Leda';
  includeWeather: boolean;
  includeAgenda: boolean;
  includeTime: boolean;
  customGreeting: string;
}

export interface PlaylistConfig {
  enabled: boolean;
  trackCount: number;
  shuffle: boolean;
  crossfadeSeconds: number;
}

export type PlaybackSource = 'youtube' | 'lyria';

export type AppStatus = 'idle' | 'generating_prompt' | 'generating_music' | 'generating_briefing' | 'ready' | 'playing_briefing' | 'playing' | 'error';

export interface AppState {
  alarmTime: string;
  isAlarmActive: boolean;
  agenda: string;
  calendar: CalendarItem[];
  genrePreset: MusicGenre;
  playbackSource: PlaybackSource;
  searchedTrack: SearchedSongMetadata | null;
  location: string | null;
  weather: WeatherData | null;
  status: AppStatus;
  errorMessage: string | null;
  audioSrc: string | null;
  youtubeEmbedUrl: string | null;
  lyrics: string;
  logs: string[];
  playlist: PlaylistTrack[];
  currentTrackIndex: number;
  voiceBriefingConfig: VoiceBriefingConfig;
  playlistConfig: PlaylistConfig;
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
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  95: "Thunderstorm",
};
