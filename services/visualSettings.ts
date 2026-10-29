import type { RandomThemeMode, ThemeId, VisualSettings } from '../types';
import { getThemeDefinition, isThemeId, THEME_LIST } from '../components/themes/registry';

export const VISUAL_SETTINGS_KEY = 'aetherclock_visual_settings';
export const DEFAULT_VISUAL_SETTINGS: VisualSettings = {
  themeId: 'obsidian', displayMode: 'device', motionIntensity: 65, motionSpeed: 1,
  audioReactivity: 55, glowIntensity: 65, particleDensity: 65, quality: 'auto',
  reducedMotion: 'system', circadian: false, favoriteThemeIds: [], randomMode: 'off',
};

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
};
const oneOf = <T extends string>(value: unknown, values: readonly T[], fallback: T): T =>
  typeof value === 'string' && values.includes(value as T) ? value as T : fallback;

export function normalizeVisualSettings(input: unknown, legacyTheme?: unknown): VisualSettings {
  const raw = input && typeof input === 'object' ? input as Partial<VisualSettings> : {};
  const legacy = isThemeId(legacyTheme) ? legacyTheme : DEFAULT_VISUAL_SETTINGS.themeId;
  return {
    themeId: isThemeId(raw.themeId) ? raw.themeId : legacy,
    displayMode: oneOf(raw.displayMode, ['device', 'ambient'] as const, 'device'),
    motionIntensity: clamp(raw.motionIntensity, 65, 0, 100),
    motionSpeed: clamp(raw.motionSpeed, 1, .25, 2),
    audioReactivity: clamp(raw.audioReactivity, 55, 0, 100),
    glowIntensity: clamp(raw.glowIntensity, 65, 0, 100),
    particleDensity: clamp(raw.particleDensity, 65, 0, 100),
    quality: oneOf(raw.quality, ['auto', 'high', 'balanced', 'saver'] as const, 'auto'),
    reducedMotion: oneOf(raw.reducedMotion, ['system', 'reduced', 'full'] as const, 'system'),
    circadian: typeof raw.circadian === 'boolean' ? raw.circadian : false,
    favoriteThemeIds: Array.isArray(raw.favoriteThemeIds) ? [...new Set(raw.favoriteThemeIds.filter(isThemeId))] : [],
    randomMode: oneOf(raw.randomMode, ['off', 'daily', 'alarm'] as const, 'off'),
  };
}

export function loadVisualSettings(storage?: Storage): VisualSettings {
  try {
    const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!target) return { ...DEFAULT_VISUAL_SETTINGS };
    const saved = target.getItem(VISUAL_SETTINGS_KEY);
    return normalizeVisualSettings(saved ? JSON.parse(saved) : null, target.getItem('aetherclock_theme'));
  } catch { return { ...DEFAULT_VISUAL_SETTINGS }; }
}

export function saveVisualSettings(settings: VisualSettings, storage?: Storage): boolean {
  try {
    const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!target) return false;
    const normalized = normalizeVisualSettings(settings);
    target.setItem(VISUAL_SETTINGS_KEY, JSON.stringify(normalized));
    target.setItem('aetherclock_theme', normalized.themeId);
    return true;
  } catch { return false; }
}

export function resetMotionSettings(settings: VisualSettings): VisualSettings {
  return { ...DEFAULT_VISUAL_SETTINGS, themeId: settings.themeId, favoriteThemeIds: [...settings.favoriteThemeIds], randomMode: settings.randomMode };
}

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) { result ^= value.charCodeAt(index); result = Math.imul(result, 16777619); }
  return Math.abs(result >>> 0);
};

export function resolveTheme(options: { globalThemeId: ThemeId; alarmThemeId?: ThemeId; randomMode: RandomThemeMode; now?: Date; alarmId?: string }): ThemeId {
  if (options.alarmThemeId && isThemeId(options.alarmThemeId)) return options.alarmThemeId;
  if (options.randomMode === 'alarm' && options.alarmId) return THEME_LIST[hash(options.alarmId) % THEME_LIST.length].id;
  if (options.randomMode === 'daily') {
    const value = options.now ?? new Date();
    const date = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    return THEME_LIST[hash(date) % THEME_LIST.length].id;
  }
  return getThemeDefinition(options.globalThemeId).id;
}

export interface CircadianSnapshot { phase: 'night' | 'dawn' | 'day' | 'dusk'; daylight: number; warmth: number; }
export function getCircadianSnapshot(now: Date, isDay?: boolean): CircadianSnapshot {
  const hour = now.getHours() + now.getMinutes() / 60;
  const phase = hour >= 5 && hour < 8 ? 'dawn' : hour >= 8 && hour < 17 ? 'day' : hour >= 17 && hour < 21 ? 'dusk' : 'night';
  const solar = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const daylight = isDay === undefined ? solar : isDay ? Math.max(.55, solar) : Math.min(.2, solar);
  const warmth = phase === 'dawn' || phase === 'dusk' ? 1 : phase === 'day' ? .25 : 0;
  return { phase, daylight, warmth };
}
