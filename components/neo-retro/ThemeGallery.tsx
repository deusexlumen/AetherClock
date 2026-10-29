import React, { useMemo, useState } from 'react';
import { Check, Star } from 'lucide-react';
import type { ThemeId } from '../../types';
import { THEME_LIST } from '../themes/registry';
import type { NeoRetroProps } from './NeoRetroTypes';
export const ThemePreview: React.FC<{ themeId: ThemeId; large?: boolean }> = ({ themeId, large = false }) => {
  const theme = THEME_LIST.find(item => item.id === themeId) ?? THEME_LIST[0];
  const style = { '--preview-case': theme.colors.case, '--preview-face': theme.colors.face, '--preview-lit': theme.colors.lit, '--preview-dim': theme.colors.dim, '--preview-bg': theme.colors.bodyBgGradient } as React.CSSProperties;
  return <div className={`theme-preview preview-${theme.preview} ${large ? 'theme-preview--large' : ''}`} style={style} aria-hidden="true"><div className="preview-atmosphere" /><div className="preview-radio"><span className="preview-speaker" /><span className="preview-screen"><i /><b>08:30</b><em /></span><span className="preview-knob" /></div></div>;
};
type GalleryProps = Pick<NeoRetroProps, 'globalThemeId' | 'visualSettings' | 'onVisualSettingsChange' | 'onSelectTheme' | 'reducedMotion'>;
export const ThemeGallery: React.FC<GalleryProps> = ({ globalThemeId, visualSettings, onVisualSettingsChange, onSelectTheme, reducedMotion }) => {
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const visible = useMemo(() => favoritesOnly ? THEME_LIST.filter(theme => visualSettings.favoriteThemeIds.includes(theme.id)) : THEME_LIST, [favoritesOnly, visualSettings.favoriteThemeIds]);
  const toggleFavorite = (id: ThemeId) => { const exists = visualSettings.favoriteThemeIds.includes(id); onVisualSettingsChange({ ...visualSettings, favoriteThemeIds: exists ? visualSettings.favoriteThemeIds.filter(item => item !== id) : [...visualSettings.favoriteThemeIds, id] }); };
  return <div className={`theme-gallery ${reducedMotion ? 'reduce-motion' : ''}`}><div className="theme-gallery-toolbar"><div><span className="panel-kicker">Visual archive · {THEME_LIST.length} cabinets</span><h2>Choose your receiver</h2></div><div className="gallery-filters" aria-label="Theme filters"><button type="button" className={!favoritesOnly ? 'is-active' : ''} onClick={() => setFavoritesOnly(false)}>All themes</button><button type="button" className={favoritesOnly ? 'is-active' : ''} onClick={() => setFavoritesOnly(true)}>Favorites · {visualSettings.favoriteThemeIds.length}</button></div></div>
    <label className="field-row random-theme-row"><span><b>Theme rotation</b><small>Daily stays consistent for the day; alarm mode is stable per alarm event.</small></span><select value={visualSettings.randomMode} onChange={event => onVisualSettingsChange({ ...visualSettings, randomMode: event.target.value as typeof visualSettings.randomMode })}><option value="off">Off · use selected theme</option><option value="daily">Daily shuffle</option><option value="alarm">Shuffle at each alarm</option></select></label>
    {visible.length === 0 ? <div className="empty-gallery"><Star size={20} /><p>No favorite receivers yet. Add a star to any theme.</p><button type="button" onClick={() => setFavoritesOnly(false)}>Browse all themes</button></div> : <div className="theme-card-grid">{visible.map(theme => {
      const selected = globalThemeId === theme.id; const favorite = visualSettings.favoriteThemeIds.includes(theme.id);
      return <article key={theme.id} className={`theme-card ${selected ? 'is-selected' : ''}`}><button type="button" className="theme-apply" onClick={() => onSelectTheme(theme.id)} aria-pressed={selected} aria-label={`Apply ${theme.name}`}><ThemePreview themeId={theme.id} /><span className="theme-card-copy"><span className="theme-card-title">{theme.name}{selected && <Check size={15} aria-label="Selected" />}</span><span className="theme-card-category">{theme.category}</span><span className="theme-card-description">{theme.description}</span><span className="theme-card-anchor">Hardware anchor · {theme.hardwareAnchor}</span></span></button><button type="button" className={`favorite-button ${favorite ? 'is-favorite' : ''}`} onClick={() => toggleFavorite(theme.id)} aria-label={`${favorite ? 'Remove' : 'Add'} ${theme.name} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite}><Star size={16} fill={favorite ? 'currentColor' : 'none'} /></button></article>;
    })}</div>}
  </div>;
};
