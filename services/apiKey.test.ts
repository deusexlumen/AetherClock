import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getApiKey, setApiKey, hasApiKey } from './apiKey';

const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
};

describe('apiKey', () => {
  const originalLocalStorage = global.localStorage;

  beforeEach(() => {
    (global as any).window = {};
    (global as any).localStorage = createMockStorage();
  });

  afterEach(() => {
    (global as any).window = undefined;
    (global as any).localStorage = originalLocalStorage;
  });

  it('returns null when no key is stored', () => {
    expect(getApiKey()).toBeNull();
    expect(hasApiKey()).toBe(false);
  });

  it('stores and retrieves a trimmed key', () => {
    setApiKey('  my-secret-key  ');
    expect(getApiKey()).toBe('my-secret-key');
    expect(hasApiKey()).toBe(true);
  });
});
