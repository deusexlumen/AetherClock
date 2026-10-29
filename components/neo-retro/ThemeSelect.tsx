import React from 'react';
import type { ThemeId } from '../../types';
import { THEME_LIST } from '../themes/registry';
interface Props { value?: ThemeId; onChange: (themeId: ThemeId | undefined) => void; label: string; compact?: boolean; }
export const ThemeSelect: React.FC<Props> = ({ value, onChange, label, compact = false }) => <label className={`alarm-theme-select ${compact ? 'is-compact' : ''}`}><span>{label}</span><select aria-label={label} value={value ?? ''} onChange={event => onChange(event.target.value ? event.target.value as ThemeId : undefined)}><option value="">Use global theme</option>{THEME_LIST.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>;
