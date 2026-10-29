import type { Scene } from '@babylonjs/core';
import type { AppStatus, SceneQuality, VisualSettings } from '../../../types';
import type { CircadianSnapshot } from '../../../services/visualSettings';
export interface SceneRuntime { settings: VisualSettings; reducedMotion: boolean; circadian: CircadianSnapshot; status: AppStatus; }
export const DEFAULT_SCENE_RUNTIME: SceneRuntime = {
  settings: { themeId: 'obsidian', displayMode: 'device', motionIntensity: 65, motionSpeed: 1, audioReactivity: 55, glowIntensity: 65, particleDensity: 65, quality: 'auto', reducedMotion: 'system', circadian: false, favoriteThemeIds: [], randomMode: 'off' },
  reducedMotion: false, circadian: { phase: 'day', daylight: .65, warmth: 0 }, status: 'idle',
};
export function getSceneRuntime(scene: Scene): SceneRuntime { return (scene.metadata?.aether as SceneRuntime | undefined) ?? DEFAULT_SCENE_RUNTIME; }
export function motionAmount(runtime: SceneRuntime): number { return runtime.reducedMotion ? 0 : runtime.settings.motionIntensity / 100; }
export function particleScale(quality: SceneQuality): number { if (quality === 'saver') return .3; if (quality === 'balanced') return .65; return 1; }
export function renderScale(quality: SceneQuality): number { if (quality === 'saver') return 1.6; if (quality === 'balanced') return 1.2; if (quality === 'high') return .85; return 1; }
export function bloomAmount(runtime: SceneRuntime, base: number): number { if (runtime.settings.quality === 'saver' || runtime.settings.glowIntensity === 0) return 0; const playingLift = runtime.status === 'playing' ? 1.08 : 1; return base * (runtime.settings.glowIntensity / 65) * playingLift; }
