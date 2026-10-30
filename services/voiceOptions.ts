export const STUDIO_VOICES = [
  ['Zephyr', 'Bright'], ['Puck', 'Upbeat'], ['Charon', 'Informative'],
  ['Kore', 'Firm'], ['Fenrir', 'Excitable'], ['Leda', 'Youthful'],
  ['Orus', 'Firm'], ['Aoede', 'Breezy'], ['Callirrhoe', 'Easy-going'],
  ['Autonoe', 'Bright'], ['Enceladus', 'Breathy'], ['Iapetus', 'Clear'],
  ['Umbriel', 'Easy-going'], ['Algieba', 'Smooth'], ['Despina', 'Smooth'],
  ['Erinome', 'Clear'], ['Algenib', 'Gravelly'], ['Rasalgethi', 'Informative'],
  ['Laomedeia', 'Upbeat'], ['Achernar', 'Soft'], ['Alnilam', 'Firm'],
  ['Schedar', 'Even'], ['Gacrux', 'Mature'], ['Pulcherrima', 'Forward'],
  ['Achird', 'Friendly'], ['Zubenelgenubi', 'Casual'], ['Vindemiatrix', 'Gentle'],
  ['Sadachbia', 'Lively'], ['Sadaltager', 'Knowledgeable'], ['Sulafat', 'Warm'],
] as const;
export interface VoiceOption { id: string; name: string; description: string; }
export const BUILTIN_VOICES: VoiceOption[] = STUDIO_VOICES.map(([id, description]) => ({ id, name: id, description }));
export const STUDIO_VOICE_NAMES: readonly string[] = STUDIO_VOICES.map(([id]) => id);
export const DELIVERY_STYLES = [
  { id: 'natural', name: 'Natural', direction: '' },
  { id: 'gentle', name: 'Gentle wake-up', direction: 'gentle, reassuring morning delivery' },
  { id: 'radio', name: 'Radio host', direction: 'warm, conversational radio presenter' },
  { id: 'energizing', name: 'Energizing', direction: 'cheerful, motivating delivery' },
  { id: 'calm', name: 'Calm evening', direction: 'calm, relaxed delivery' },
] as const;
export interface VoiceDelivery { style?: string; pace?: number; expression?: number; }
export const DEFAULT_DELIVERY = { style: 'gentle', pace: 45, expression: 40 };
const level = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
export function normalizeDelivery(value?: VoiceDelivery | null) {
  return {
    style: DELIVERY_STYLES.some(style => style.id === value?.style) ? value!.style! : DEFAULT_DELIVERY.style,
    pace: level(value?.pace, DEFAULT_DELIVERY.pace), expression: level(value?.expression, DEFAULT_DELIVERY.expression),
  };
}
export function buildSpeechStyle(value?: VoiceDelivery | null): string {
  const delivery = normalizeDelivery(value);
  return [DELIVERY_STYLES.find(style => style.id === delivery.style)!.direction,
    delivery.pace < 35 ? 'speak slowly with unhurried pauses' : delivery.pace > 65 ? 'speak briskly and clearly' : 'natural conversational pace',
    delivery.expression < 35 ? 'restrained, subtle intonation' : delivery.expression > 65 ? 'expressive intonation with clear emphasis' : 'moderately expressive intonation',
  ].filter(Boolean).join('; ');
}
/** Voice IDs are data, never prompt text, paths, or endpoints. */
export const isVoiceId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,95}$/.test(value);
