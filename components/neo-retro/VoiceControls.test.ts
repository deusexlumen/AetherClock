import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VoiceControls } from './VoiceControls';
describe('voice settings markup', () => {
  it('renders labeled controls, a preview action and a saved catalog voice before loading', () => {
    const markup = renderToStaticMarkup(React.createElement(VoiceControls, {
      config: { enabled: true, voiceName: 'voice_arlo', includeWeather: true, includeAgenda: true, includeTime: true, customGreeting: '' },
      llmConfig: { textModel: 'gemini-3.5-flash', ttsModel: 'gemini-3.8-flash-tts' }, onChange: () => {},
    }));
    expect(markup).toContain('Speaking pace'); expect(markup).toContain('Expression &amp; emphasis');
    expect(markup).toContain('Preview voice'); expect(markup).toContain('value="voice_arlo" selected');
    expect(markup).toContain('30 available');
  });
});
