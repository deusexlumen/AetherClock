import { describe, expect, it } from 'vitest';
import { THEME_LIST, THEME_REGISTRY, WEBGL_THEME_IDS, getThemeDefinition } from './registry';
describe('theme registry', () => {
  it('contains fourteen unique, fully described themes', () => { expect(THEME_LIST).toHaveLength(14); expect(new Set(THEME_LIST.map(theme => theme.id)).size).toBe(14); for (const theme of THEME_LIST) { expect(theme.name.length).toBeGreaterThan(2); expect(theme.hardwareAnchor.length).toBeGreaterThan(5); expect(theme.colors.case).toMatch(/^#/); expect(theme.colors.lit).toMatch(/^#/); } });
  it('keeps exactly the three existing WebGL scenes', () => { expect([...WEBGL_THEME_IDS].sort()).toEqual(['space', 'submarine', 'vaporwave']); });
  it('falls back safely for unknown IDs', () => { expect(getThemeDefinition('not-a-theme').id).toBe('obsidian'); expect(THEME_REGISTRY.neonNocturne.category).toBe('Neo-retro hybrids'); });
});
