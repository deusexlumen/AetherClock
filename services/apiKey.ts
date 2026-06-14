/*
 * PURPOSE: Per-user Gemini API key persistence (localStorage)
 * ARCHITECTURE: services/apiKey
 * DEPENDENCIES: none
 * PIPELINE: test
 * LAST_VALIDATED: 2026-06-14
 */

const STORAGE_KEY = 'aetherclock_gemini_api_key';

export const getApiKey = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
};

export const setApiKey = (key: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, key.trim());
};

export const hasApiKey = (): boolean => {
  const key = getApiKey();
  return typeof key === 'string' && key.length > 0;
};
