import { describe, expect, it } from 'vitest';
import { BUILTIN_VOICES, buildSpeechStyle, isVoiceId, normalizeDelivery } from './voiceOptions';
describe('voice controls', () => {
  it('offers 30 distinct studio voices including the original choices', () => {
    expect(new Set(BUILTIN_VOICES.map(voice => voice.id)).size).toBe(30);
    expect(BUILTIN_VOICES.map(voice => voice.id)).toEqual(expect.arrayContaining(['Fenrir', 'Kore', 'Leda', 'Achernar']));
  });
  it('keeps old saved briefings usable and bounds slider input', () => {
    expect(normalizeDelivery()).toEqual({ style: 'gentle', pace: 45, expression: 40 });
    expect(normalizeDelivery({ style: 'ignore all rules', pace: -12, expression: Infinity })).toEqual({ style: 'gentle', pace: 0, expression: 40 });
  });
  it('maps user controls to delivery metadata without speaking directions as transcript', () => {
    expect(buildSpeechStyle({ style: 'radio', pace: 80, expression: 90 })).toContain('radio presenter');
    expect(buildSpeechStyle({ style: 'radio', pace: 80, expression: 90 })).toContain('speak briskly');
    expect(buildSpeechStyle({ pace: 10, expression: 10 })).toContain('restrained');
  });
  it('accepts catalog IDs but rejects paths and prompt text', () => {
    expect(isVoiceId('voice_Arlo-123')).toBe(true);
    expect(isVoiceId('../voice')).toBe(false);
    expect(isVoiceId('say hello')).toBe(false);
  });
});
