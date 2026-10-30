// Shared allowlists keep the settings UI and the server cascade in agreement.
export const TEXT_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
export const VOICE_MODELS = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];

export const normalizeAIModel = (model: string): string => ({
  'gemini-3.1-flash-tts-preview': 'gemini-3.8-flash-tts',
  'gemini-3.5-flash': 'gemini-3.8-flash',
  'gemini-3-flash': 'gemini-3.8-flash',
  'gemini-2.5-pro': 'gemini-3.8-flash',
  'gemini-2.5-flash-tts': 'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-tts': 'gemini-2.5-pro-preview-tts',
}[model] || model);
